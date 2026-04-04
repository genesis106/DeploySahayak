"""
main.py — Sahayak Cognitive Map API  v3.0
Multi-case architecture: every resource is scoped to a case_id.
Global route structure:
  /api/auth/*                        — authentication (register, login, me)
  /api/cases                         — case management
  /api/cases/{case_id}/fragments     — cognitive map fragments
  /api/cases/{case_id}/graph         — entity relationship graph
  /api/cases/{case_id}/chat          — testimony chat / contradiction detection
  /api/cases/{case_id}/documents     — generated legal documents
  /api/cases/{case_id}/dashboard     — dashboard stats
  /api/cases/{case_id}/legal/*       — BNS map, gap detect, draft, precedents (Case Insights)
  /api/cases/{case_id}/voice         — voice transcript processing
  /api/evidence                      — global evidence items
"""
import asyncio
import random
import logging
from datetime import datetime

from bson import ObjectId
from fastapi import FastAPI, Body, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional

from config import (
    APP_TITLE, APP_VERSION, APP_DESCRIPTION,
    CORS_ORIGINS,
    DEFAULT_CASE_ID,
    TIMESTAMP_FORMAT,
    DEFAULT_FRAGMENT_TIMESTAMP,
    POWERED_BY_BNS, POWERED_BY_GAP, POWERED_BY_DRAFT, POWERED_BY_FULL, POWERED_BY_CASES,
    COLLECTION_CASES,
)
from models import (
    FragmentSchema, TestimonySchema,
    VoiceProcessRequest, VoiceProcessResponse, EvidenceMention,
    SaveMapRequest, ChatRequest, ChatResponse,
    CreateClustersRequest, GenerateDraftRequest, LegalAnalysisResponse,
    CreateCaseRequest,
    RegisterRequest, LoginRequest, TokenResponse,
    GenerateDocumentRequest, UpdateDocumentRequest,
    MediaUploadResponse, MediaUpdateTagsRequest, MediaRenameRequest, 
    ShareLinkRequest, ShareLinkResponse,
    TranslateRequest, TranslateResponse, LinkClusterRequest,
)
from database import (
    database,
    fragment_collection, testimony_collection,
    evidence_collection, conversation_collection,
    document_collection, user_collection,
    media_upload_collection, shared_links_collection,
    fragment_helper, testimony_helper,
    get_case_fragment_collection,
    get_case_conversation_collection,
    get_case_cache_collection,
)
from utils import (
    split_into_fragments, check_clashes, check_evidence,
    check_contradiction_gemini,
    map_to_bns_sections, detect_legal_gaps, generate_legal_draft,
    get_fragments_hash, extract_graph_edges, search_precedent_cases,
    generate_entity_graph, synthesize_and_fragment_testimony,
    generate_case_match_summary, generate_document_from_graph,
    detect_and_translate_to_english, translate_text,
    SUPPORTED_LANGUAGES, LANGUAGE_LOCALES,
)
from auth import hash_password, verify_password, create_access_token, get_current_user
import cloudinary
import cloudinary.uploader
import base64
import hashlib
import secrets
import io
import zipfile
import urllib.request
from datetime import timedelta
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad

from config import (
    CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET,
    AES_ENCRYPTION_KEY, SHARE_LINK_EXPIRY_HOURS,
    APP_TITLE, APP_VERSION, APP_DESCRIPTION,
    CORS_ORIGINS,
    DEFAULT_CASE_ID,
    TIMESTAMP_FORMAT,
    DEFAULT_FRAGMENT_TIMESTAMP,
    POWERED_BY_BNS, POWERED_BY_GAP, POWERED_BY_DRAFT, POWERED_BY_FULL, POWERED_BY_CASES,
    COLLECTION_CASES,
)

logger = logging.getLogger(__name__)

# ── Cloudinary setup ──────────────────────────────────────────────────────────
cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
    secure=True,
)

# ── AES-256 Config ────────────────────────────────────────────────────────────
def _get_aes_key() -> bytes:
    # Hash the key to ensure it's exactly 32 bytes for AES-256
    raw_key = AES_ENCRYPTION_KEY or "fallback-sahayak-aes-key-32bytes++"
    return hashlib.sha256(raw_key.encode("utf-8")).digest()

def aes_encrypt(plaintext: str) -> str:
    if not plaintext:
        return ""
    key = _get_aes_key()
    cipher = AES.new(key, AES.MODE_CBC)
    ct_bytes = cipher.encrypt(pad(plaintext.encode("utf-8"), AES.block_size))
    iv = base64.b64encode(cipher.iv).decode("utf-8")
    ct = base64.b64encode(ct_bytes).decode("utf-8")
    return f"{iv}:{ct}"

def aes_decrypt(ciphertext: str) -> str:
    if not ciphertext or ":" not in ciphertext:
        return ciphertext  # Try to return unencrypted fallback
    try:
        iv_b64, ct_b64 = ciphertext.split(":", 1)
        iv = base64.b64decode(iv_b64)
        ct = base64.b64decode(ct_b64)
        key = _get_aes_key()
        cipher = AES.new(key, AES.MODE_CBC, iv)
        pt = unpad(cipher.decrypt(ct), AES.block_size)
        return pt.decode("utf-8")
    except Exception:
        logger.warning(f"Failed to decrypt AES string: {ciphertext}")
        return ""

app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    description=APP_DESCRIPTION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cases_collection = database.get_collection(COLLECTION_CASES)


# ─────────────────────────────────────────────────────────────────────────────
# Shared helpers
# ─────────────────────────────────────────────────────────────────────────────

def _now_str() -> str:
    return datetime.now().strftime(TIMESTAMP_FORMAT)


def _now_iso() -> str:
    return datetime.now().isoformat()


async def _resolve_case(case_id: str) -> dict:
    """Fetch a case document; raise 404 if not found."""
    doc = await cases_collection.find_one({"_id": ObjectId(case_id)})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")
    return doc


async def _get_case_fragments(case_id: str) -> list:
    col = get_case_fragment_collection(case_id)
    return [fragment_helper(doc) async for doc in col.find()]


# ─────────────────────────────────────────────────────────────────────────────
# Root
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/")
def read_root():
    return {
        "message": f"Welcome to {APP_TITLE}",
        "legal_integration": APP_DESCRIPTION,
        "version": APP_VERSION,
    }


# ═════════════════════════════════════════════════════════════════════════════
# AUTHENTICATION   /api/auth
# ═════════════════════════════════════════════════════════════════════════════

@app.post("/api/auth/register", tags=["Auth"], status_code=201)
async def register(req: RegisterRequest = Body(...)):
    """Register a new user with phone + password."""
    existing = await user_collection.find_one({"phone": req.phone})
    if existing:
        raise HTTPException(status_code=409, detail="Phone number already registered.")

    user_doc = {
        "phone":           req.phone,
        "hashed_password": hash_password(req.password),
        "name":            req.name or "",
        "created_at":      _now_iso(),
    }
    result = await user_collection.insert_one(user_doc)
    user_id = str(result.inserted_id)

    token = create_access_token({"sub": req.phone, "user_id": user_id})
    return TokenResponse(
        access_token=token,
        user={"id": user_id, "phone": req.phone, "name": req.name or ""},
    )


@app.post("/api/auth/login", tags=["Auth"])
async def login(req: LoginRequest = Body(...)):
    """Login with phone + password, returns JWT."""
    user = await user_collection.find_one({"phone": req.phone})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid phone number or password.")

    if not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid phone number or password.")

    user_id = str(user["_id"])
    token = create_access_token({"sub": req.phone, "user_id": user_id})
    return TokenResponse(
        access_token=token,
        user={"id": user_id, "phone": req.phone, "name": user.get("name", "")},
    )


@app.get("/api/auth/me", tags=["Auth"])
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return the currently authenticated user."""
    return current_user


# ═════════════════════════════════════════════════════════════════════════════
# CASE MANAGEMENT   /api/cases
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/api/cases", tags=["Cases"])
async def list_cases():
    """Return all cases with fragment counts."""
    result = []
    async for doc in cases_collection.find().sort("created_at", -1):
        cid = str(doc["_id"])
        frag_count = await get_case_fragment_collection(cid).count_documents({})
        result.append({
            "id":          cid,
            "title":       doc.get("title", "Untitled Case"),
            "description": doc.get("description", ""),
            "created_at":  doc.get("created_at", ""),
            "updated_at":  doc.get("updated_at", ""),
            "fragment_count": frag_count,
            "status":      doc.get("status", "active"),
        })
    return result


@app.post("/api/cases", tags=["Cases"], status_code=201)
async def create_case(req: CreateCaseRequest = Body(...)):
    """Create a new case and return its ID."""
    doc = {
        "title":       req.title,
        "description": req.description or "",
        "created_at":  _now_iso(),
        "updated_at":  _now_iso(),
        "status":      "active",
    }
    res = await cases_collection.insert_one(doc)
    doc.pop("_id", None)
    return {"id": str(res.inserted_id), **doc}


@app.get("/api/cases/{case_id}", tags=["Cases"])
async def get_case(case_id: str):
    doc = await _resolve_case(case_id)
    frag_count = await get_case_fragment_collection(case_id).count_documents({})
    return {
        "id":          case_id,
        "title":       doc.get("title", "Untitled Case"),
        "description": doc.get("description", ""),
        "created_at":  doc.get("created_at", ""),
        "updated_at":  doc.get("updated_at", ""),
        "fragment_count": frag_count,
        "status":      doc.get("status", "active"),
    }


@app.patch("/api/cases/{case_id}", tags=["Cases"])
async def update_case(case_id: str, data: dict = Body(...)):
    await _resolve_case(case_id)
    data["updated_at"] = _now_iso()
    await cases_collection.update_one({"_id": ObjectId(case_id)}, {"$set": data})
    return {"status": "success"}


@app.delete("/api/cases/{case_id}", tags=["Cases"])
async def delete_case(case_id: str):
    await _resolve_case(case_id)
    # Cascade delete all case-scoped collections
    await get_case_fragment_collection(case_id).drop()
    await get_case_conversation_collection(case_id).drop()
    await get_case_cache_collection(case_id).drop()
    await cases_collection.delete_one({"_id": ObjectId(case_id)})
    return {"status": "success"}


# ═════════════════════════════════════════════════════════════════════════════
# FRAGMENTS (Cognitive Map)   /api/cases/{case_id}/fragments
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/api/cases/{case_id}/fragments", tags=["Cognitive Map"])
async def get_fragments(case_id: str):
    await _resolve_case(case_id)
    return await _get_case_fragments(case_id)


@app.post("/api/cases/{case_id}/fragments", tags=["Cognitive Map"])
async def add_fragment(case_id: str, fragment: FragmentSchema = Body(...)):
    await _resolve_case(case_id)
    col = get_case_fragment_collection(case_id)
    fragment_data = jsonable_encoder(fragment)
    existing_evidence = [ev async for ev in evidence_collection.find()]
    matches = check_evidence(fragment_data.get("content", ""), existing_evidence)
    fragment_data["has_evidence"] = len(matches) > 0
    res = await col.insert_one(fragment_data)
    created = await col.find_one({"_id": res.inserted_id})
    return fragment_helper(created)
@app.get("/api/cases/{case_id}/fragments/edges", tags=["Cognitive Map"])
async def get_fragment_edges(case_id: str):
    """Returns logical edges directly between fragment IDs for the Cognitive Map."""
    await _resolve_case(case_id)
    fragments = await _get_case_fragments(case_id)
    if not fragments:
        return {"edges": []}

    cache_col = get_case_cache_collection(case_id)
    current_hash = get_fragments_hash(fragments)

    cached = await cache_col.find_one({"type": "fragment_edges", "hash": current_hash})
    if cached and "edges" in cached:
        return {"edges": cached["edges"]}

    # This function uses MongoDB IDs, which perfectly matches Cognitive Map!
    edges = await extract_graph_edges(fragments)

    await cache_col.update_one(
        {"type": "fragment_edges"},
        {"$set": {"hash": current_hash, "edges": edges}},
        upsert=True,
    )
    return {"edges": edges}

@app.put("/api/cases/{case_id}/fragments/{fragment_id}", tags=["Cognitive Map"])
async def update_fragment(case_id: str, fragment_id: str, update_data: dict = Body(...)):
    await _resolve_case(case_id)
    col = get_case_fragment_collection(case_id)
    if "content" in update_data:
        existing_evidence = [ev async for ev in evidence_collection.find()]
        matches = check_evidence(update_data["content"], existing_evidence)
        update_data["has_evidence"] = len(matches) > 0
    await col.update_one({"_id": ObjectId(fragment_id)}, {"$set": update_data})
    updated = await col.find_one({"_id": ObjectId(fragment_id)})
    if updated:
        return fragment_helper(updated)
    raise HTTPException(status_code=404, detail="Fragment not found")


@app.delete("/api/cases/{case_id}/fragments/{fragment_id}", tags=["Cognitive Map"])
async def delete_fragment(case_id: str, fragment_id: str):
    await _resolve_case(case_id)
    col = get_case_fragment_collection(case_id)
    result = await col.delete_one({"_id": ObjectId(fragment_id)})
    if result.deleted_count == 1:
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Fragment not found")


@app.delete("/api/cases/{case_id}/fragments", tags=["Cognitive Map"])
async def clear_fragments(case_id: str):
    await _resolve_case(case_id)
    await get_case_fragment_collection(case_id).delete_many({})
    return {"status": "success"}


# ═════════════════════════════════════════════════════════════════════════════
# VOICE PROCESSING   /api/cases/{case_id}/voice
# ═════════════════════════════════════════════════════════════════════════════

@app.post("/api/cases/{case_id}/voice/process", tags=["Voice"], response_model=VoiceProcessResponse)
async def process_voice(case_id: str, req: VoiceProcessRequest = Body(...)):
    """
    Sends the raw transcript to Gemini which cleans fillers, extracts key facts,
    and returns them as structured fragments stored in the case's cognitive map.
    Supports multilingual input — auto-detects language and translates to English.
    """
    await _resolve_case(case_id)
    col = get_case_fragment_collection(case_id)
    transcript = req.transcript

    # ── Multilingual: detect language and translate to English ──────────────
    translation_result = await detect_and_translate_to_english(transcript)
    original_text = translation_result["original_text"]
    original_language = translation_result["original_language"]
    translated_text = translation_result["translated_text_en"]

    # Use the English translation for all downstream processing
    existing_fragments = [fragment_helper(doc) async for doc in col.find()]
    clashes = check_clashes(translated_text, existing_fragments)
    insights = await split_into_fragments(translated_text)
    existing_evidence = [ev async for ev in evidence_collection.find()]

    created_fragments: list = []
    all_evidence_matches: list = []

    for insight in insights:
        matches = check_evidence(insight["content"], existing_evidence)
        all_evidence_matches.extend(matches)
        fragment_data = {
            "type":              "voice",
            "content":           insight["content"],
            "timestamp":         DEFAULT_FRAGMENT_TIMESTAMP,
            "cluster":           insight["cluster"],
            "position":          {"x": random.uniform(10, 90), "y": random.uniform(10, 90)},
            "has_evidence":      len(matches) > 0,
            "original_text":     original_text,
            "original_language": original_language,
        }
        res = await col.insert_one(fragment_data)
        doc = await col.find_one({"_id": res.inserted_id})
        created_fragments.append(fragment_helper(doc))

    unique_ev = list({v["evidence_id"]: v for v in all_evidence_matches}.values())
    return VoiceProcessResponse(
        fragments=created_fragments,
        clashes=clashes,
        evidence_matches=unique_ev,
        original_text=original_text,
        original_language=original_language,
        translated_text_en=translated_text,
    )


# ═════════════════════════════════════════════════════════════════════════════
# CHAT / CONTRADICTION DETECTION   /api/cases/{case_id}/chat
# ═════════════════════════════════════════════════════════════════════════════

@app.post("/api/cases/{case_id}/chat", tags=["Chat"], response_model=ChatResponse)
async def chat_message(case_id: str, req: ChatRequest = Body(...)):
    """
    Accepts a testimony message (any supported language), detects contradictions via Gemini,
    and stores the full conversation so it can later be synthesised into fragments.
    Multilingual: input is auto-translated to English for contradiction detection.
    """
    await _resolve_case(case_id)
    conv_col = get_case_conversation_collection(case_id)
    conversation = await conv_col.find_one({"case_id": case_id})

    if not conversation:
        res = await conv_col.insert_one({
            "case_id":    case_id,
            "messages":   [],
            "created_at": _now_iso(),
        })
        conversation = {"_id": res.inserted_id, "case_id": case_id, "messages": []}

    # ── Multilingual: translate input to English for contradiction detection ──
    translation_result = await detect_and_translate_to_english(req.message)
    english_message = translation_result["translated_text_en"]
    original_language = translation_result["original_language"]

    past_user_statements = [
        m.get("content_en", m["content"]) for m in conversation.get("messages", []) if m["role"] == "user"
    ]
    contradiction_result = await check_contradiction_gemini(english_message, past_user_statements)

    user_msg = {
        "role": "user",
        "content": req.message,
        "content_en": english_message,
        "original_language": original_language,
        "timestamp": _now_iso(),
    }
    bot_msg = {
        "role": "assistant",
        "content": contradiction_result["reply"],
        "has_contradiction": contradiction_result["has_contradiction"],
        "timestamp": _now_iso(),
    }

    await conv_col.update_one(
        {"case_id": case_id},
        {"$push": {"messages": {"$each": [user_msg, bot_msg]}}},
    )
    return ChatResponse(
        reply=contradiction_result["reply"],
        has_contradiction=contradiction_result["has_contradiction"],
        contradiction_detail=contradiction_result.get("contradiction_detail"),
    )


@app.get("/api/cases/{case_id}/chat/history", tags=["Chat"])
async def get_chat_history(case_id: str):
    await _resolve_case(case_id)
    conv_col = get_case_conversation_collection(case_id)
    conversation = await conv_col.find_one({"case_id": case_id})
    if not conversation:
        return {"messages": []}
    return {"messages": conversation.get("messages", [])}


@app.delete("/api/cases/{case_id}/chat/history", tags=["Chat"])
async def clear_chat_history(case_id: str):
    await _resolve_case(case_id)
    await get_case_conversation_collection(case_id).delete_one({"case_id": case_id})
    return {"status": "success"}


@app.post("/api/cases/{case_id}/chat/create-clusters", tags=["Chat"])
async def create_clusters_from_chat(case_id: str, req: CreateClustersRequest = Body(...)):
    """
    Reads the full chat history, resolves contradictions via Gemini,
    and creates clean cognitive map fragments for the case.
    """
    await _resolve_case(case_id)
    conv_col  = get_case_conversation_collection(case_id)
    frag_col  = get_case_fragment_collection(case_id)

    conversation = await conv_col.find_one({"case_id": case_id})
    if not conversation or not conversation.get("messages"):
        raise HTTPException(status_code=404, detail="No conversation found for this case.")

    messages = conversation["messages"]
    await frag_col.delete_many({})

    # Gemini synthesises the full chat, removes fillers, resolves contradictions
    insights = await synthesize_and_fragment_testimony(messages)
    created_fragments = []

    for insight in insights:
        fragment_data = {
            "type":         "text",
            "content":      insight["content"],
            "timestamp":    DEFAULT_FRAGMENT_TIMESTAMP,
            "cluster":      insight["cluster"],
            "position":     {"x": random.uniform(10, 90), "y": random.uniform(10, 90)},
            "has_evidence": False,
        }
        res = await frag_col.insert_one(fragment_data)
        doc = await frag_col.find_one({"_id": res.inserted_id})
        created_fragments.append(fragment_helper(doc))

    # Invalidate graph + precedent cache for this case
    cache_col = get_case_cache_collection(case_id)
    await cache_col.delete_many({"type": {"$in": ["entity_graph", "precedents"]}})

    return {"status": "success", "fragments": created_fragments}


# ═════════════════════════════════════════════════════════════════════════════
# GRAPH VIEW   /api/cases/{case_id}/graph
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/api/cases/{case_id}/graph", tags=["Graph View"])
async def get_graph(case_id: str):
    """
    Returns nodes and edges for the entity-relationship knowledge graph of the case.
    Includes Evidence nodes linked via HAS_EVIDENCE edges from clusters.
    Result is cached per fragment hash to avoid repeated Gemini calls.
    """
    await _resolve_case(case_id)
    fragments = await _get_case_fragments(case_id)
    if not fragments:
        return {"nodes": [], "edges": []}

    cache_col = get_case_cache_collection(case_id)
    current_hash = get_fragments_hash(fragments)

    cached = await cache_col.find_one({"type": "entity_graph", "hash": current_hash})
    if cached and cached.get("graph_data"):
        graph_data = cached["graph_data"]
    else:
        graph_data = await generate_entity_graph(fragments)

        if graph_data.get("nodes"):
            await cache_col.update_one(
                {"type": "entity_graph"},
                {"$set": {"hash": current_hash, "graph_data": graph_data}},
                upsert=True,
            )

    # ── Inject Evidence nodes and HAS_EVIDENCE edges from linked media ─────
    linked_media = []
    async for doc in media_upload_collection.find({"case_id": case_id, "linked_cluster_id": {"$ne": None}}):
        linked_media.append(_media_helper(doc, decrypt=False))

    if linked_media:
        nodes = graph_data.get("nodes", [])
        edges = graph_data.get("edges", [])
        existing_node_ids = {n["id"] for n in nodes}

        for media in linked_media:
            ev_node_id = f"ev_{media['id']}"
            if ev_node_id not in existing_node_ids:
                # Determine icon label based on type
                type_emoji = {"photo": "📸", "video": "🎥", "audio": "🎙"}.get(media["media_type"], "📄")
                nodes.append({
                    "id": ev_node_id,
                    "label": f"{type_emoji} {media['filename'][:20]}",
                    "type": "evidence",
                    "x": random.randint(10, 90),
                    "y": random.randint(10, 90),
                })
                existing_node_ids.add(ev_node_id)

            # Find the graph node closest to the cluster fragment
            cluster_id = media.get("linked_cluster_id")
            if cluster_id:
                # Try to match cluster_id to a fragment, then find corresponding graph node
                frag = next((f for f in fragments if f["id"] == cluster_id), None)
                if frag:
                    # Find the nearest graph node by matching content keywords
                    best_match = None
                    for node in nodes:
                        if node["id"] == ev_node_id:
                            continue
                        if node.get("type") != "evidence":
                            best_match = node["id"]
                            break
                    if best_match:
                        edges.append({
                            "from": best_match,
                            "to": ev_node_id,
                            "label": "HAS_EVIDENCE",
                        })

        graph_data["nodes"] = nodes
        graph_data["edges"] = edges

    return graph_data


# ═════════════════════════════════════════════════════════════════════════════
# DOCUMENTS   /api/cases/{case_id}/documents
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/api/cases/{case_id}/documents", tags=["Documents"])
async def get_documents(case_id: str):
    """Return all generated legal documents for a case."""
    await _resolve_case(case_id)
    docs = []
    async for doc in document_collection.find({"case_id": case_id}).sort("generatedAt", -1):
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        docs.append(doc)
    return docs


@app.get("/api/cases/{case_id}/documents/{doc_id}", tags=["Documents"])
async def get_single_document(case_id: str, doc_id: str):
    """Return a single document by ID."""
    await _resolve_case(case_id)
    doc = await document_collection.find_one({"_id": ObjectId(doc_id), "case_id": case_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    doc["id"] = str(doc["_id"])
    del doc["_id"]
    return doc


@app.delete("/api/cases/{case_id}/documents/{doc_id}", tags=["Documents"])
async def delete_document(case_id: str, doc_id: str):
    await _resolve_case(case_id)
    await document_collection.delete_one({"_id": ObjectId(doc_id), "case_id": case_id})
    return {"status": "success"}


@app.post("/api/cases/{case_id}/documents/generate", tags=["Documents"])
async def generate_document(case_id: str, req: GenerateDocumentRequest = Body(...)):
    """
    Generates a legal document from the testimony graph using Gemini.
    The document is built from both entity graph data and raw fragments.
    """
    await _resolve_case(case_id)
    fragments = await _get_case_fragments(case_id)
    if not fragments:
        raise HTTPException(status_code=404, detail="No fragments found. Record testimony first.")

    # Get entity graph for richer context
    cache_col = get_case_cache_collection(case_id)
    current_hash = get_fragments_hash(fragments)
    graph_data = {"nodes": [], "edges": []}
    cached = await cache_col.find_one({"type": "entity_graph", "hash": current_hash})
    if cached and cached.get("graph_data"):
        graph_data = cached["graph_data"]
    else:
        graph_data = await generate_entity_graph(fragments)

    # Get BNS sections for legal context
    bns_result: dict = {}
    try:
        bns_result = await map_to_bns_sections(fragments)
    except Exception as exc:
        logger.warning("[generate_document] BNS pre-mapping failed: %s", exc)

    result = await generate_document_from_graph(
        fragments=fragments,
        graph_data=graph_data,
        case_name=req.case_name,
        draft_type=req.draft_type,
        bns_sections=bns_result.get("bns_sections"),
    )

    # Persist to documents collection
    doc_data = {
        "case_id":     case_id,
        "title":       f"{req.draft_type} — {req.case_name}",
        "type":        req.draft_type.lower(),
        "status":      "ready",
        "generatedAt": _now_str(),
        "sections":    [s["section"] for s in bns_result.get("bns_sections", [])],
        "content":     result,
    }
    inserted = await document_collection.insert_one(doc_data)

    result["id"]           = str(inserted.inserted_id)
    result["powered_by"]   = POWERED_BY_DRAFT
    result["generated_at"] = doc_data["generatedAt"]
    return result


@app.patch("/api/cases/{case_id}/documents/{doc_id}", tags=["Documents"])
async def update_document(case_id: str, doc_id: str, req: UpdateDocumentRequest = Body(...)):
    """Edit an existing document's title, content, or status."""
    await _resolve_case(case_id)
    doc = await document_collection.find_one({"_id": ObjectId(doc_id), "case_id": case_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    update_fields = {}
    if req.title is not None:
        update_fields["title"] = req.title
    if req.content is not None:
        update_fields["content"] = req.content
    if req.status is not None:
        update_fields["status"] = req.status

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update.")

    update_fields["updatedAt"] = _now_str()
    await document_collection.update_one(
        {"_id": ObjectId(doc_id), "case_id": case_id},
        {"$set": update_fields},
    )

    updated = await document_collection.find_one({"_id": ObjectId(doc_id)})
    updated["id"] = str(updated["_id"])
    del updated["_id"]
    return updated



# ═════════════════════════════════════════════════════════════════════════════
# MULTILINGUAL   /api/translate, /api/languages
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/api/languages", tags=["Multilingual"])
async def get_supported_languages():
    """Returns the list of supported input/output languages with BCP-47 locale tags."""
    return {
        "languages": [
            {"code": code, "name": name, "locale": LANGUAGE_LOCALES.get(code, code)}
            for code, name in SUPPORTED_LANGUAGES.items()
        ]
    }


@app.post("/api/translate", tags=["Multilingual"], response_model=TranslateResponse)
async def translate_endpoint(req: TranslateRequest = Body(...)):
    """
    Translates text from English to a target language.
    This is a USER-FACING translation for display only.
    Backend always uses English as source of truth.
    """
    if req.target_language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {req.target_language}")
    translated = await translate_text(req.text, req.target_language)
    return TranslateResponse(
        translated_text=translated,
        source_language="en",
        target_language=req.target_language,
    )


# ═════════════════════════════════════════════════════════════════════════════
# MEDIA UPLOAD (Cloudinary)   /api/cases/{case_id}/media
# ═════════════════════════════════════════════════════════════════════════════

def _detect_media_type(mime_type: str) -> str:
    if mime_type and mime_type.startswith("image/"):
        return "photo"
    if mime_type and mime_type.startswith("video/"):
        return "video"
    if mime_type and mime_type.startswith("audio/"):
        return "audio"
    return "document"


def _media_helper(doc: dict, decrypt: bool = True) -> dict:
    url = doc.get("cloudinary_url", "")
    if decrypt and url:
        url = aes_decrypt(url)
        
    return {
        "id":                   str(doc["_id"]),
        "case_id":              doc.get("case_id", ""),
        "filename":             doc.get("filename", ""),
        "media_type":           doc.get("media_type", "document"),
        "cloudinary_url":       url,
        "cloudinary_public_id": doc.get("cloudinary_public_id", ""),
        "tags":                 doc.get("tags", []),
        "size":                 doc.get("size", 0),
        "mime_type":            doc.get("mime_type", ""),
        "uploaded_at":          doc.get("uploaded_at", ""),
        "linked_cluster_id":    doc.get("linked_cluster_id"),
    }


@app.post("/api/cases/{case_id}/media/upload", tags=["Media Upload"])
async def upload_case_media(
    case_id: str,
    file: UploadFile = File(...),
    tags: str = Form(""),
    linked_cluster_id: str = Form(""),
):
    await _resolve_case(case_id)
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    mime = file.content_type or ""
    media_type = _detect_media_type(mime)
    file_bytes = await file.read()
    file_size = len(file_bytes)

    try:
        upload_result = cloudinary.uploader.upload(
            file_bytes,
            resource_type="auto",
            folder=f"sahayak_evidence/{case_id}",
            public_id=f"{file.filename}_{int(datetime.now().timestamp())}",
        )
    except Exception as exc:
        logger.error("[upload_media] Cloudinary upload failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Cloudinary upload failed: {exc}")

    cloudinary_url = upload_result.get("secure_url", upload_result.get("url", ""))
    cloudinary_public_id = upload_result.get("public_id", "")
    
    # Encrypt the link before storing for AES-256 compliance
    encrypted_url = aes_encrypt(cloudinary_url)

    doc_data = {
        "case_id":              case_id,
        "filename":             file.filename,
        "media_type":           media_type,
        "cloudinary_url":       encrypted_url,
        "cloudinary_public_id": cloudinary_public_id,
        "tags":                 tag_list,
        "size":                 file_size,
        "mime_type":            mime,
        "uploaded_at":          _now_iso(),
        "linked_cluster_id":    linked_cluster_id or None,
    }
    result = await media_upload_collection.insert_one(doc_data)

    # If linked to a cluster, update the fragment's has_evidence + linked_evidence
    if linked_cluster_id:
        frag_col = get_case_fragment_collection(case_id)
        media_id = str(result.inserted_id)
        await frag_col.update_one(
            {"_id": ObjectId(linked_cluster_id)},
            {
                "$set": {"has_evidence": True},
                "$addToSet": {"linked_evidence": {
                    "evidence_id": media_id,
                    "file_name": file.filename,
                    "type": media_type,
                }},
            },
        )

    created = await media_upload_collection.find_one({"_id": result.inserted_id})
    return _media_helper(created, decrypt=True)


@app.get("/api/cases/{case_id}/media", tags=["Media Upload"])
async def list_case_media(
    case_id: str,
    media_type: Optional[str] = Query(None, alias="type", description="photo | video | document"),
    tag: Optional[str] = Query(None, description="Filter by evidence tag"),
):
    query: dict = {"case_id": case_id}
    if media_type and media_type != "all":
        query["media_type"] = media_type
    if tag:
        query["tags"] = tag

    docs = []
    async for doc in media_upload_collection.find(query).sort("uploaded_at", -1):
        docs.append(_media_helper(doc, decrypt=True))
    return docs


@app.delete("/api/media/{media_id}", tags=["Media Upload"])
async def delete_media(media_id: str):
    doc = await media_upload_collection.find_one({"_id": ObjectId(media_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Media not found.")

    public_id = doc.get("cloudinary_public_id")
    if public_id:
        try:
            mime = doc.get("mime_type", "")
            if mime.startswith("video/"):
                cloudinary.uploader.destroy(public_id, resource_type="video")
            elif mime.startswith("image/"):
                cloudinary.uploader.destroy(public_id, resource_type="image")
            else:
                cloudinary.uploader.destroy(public_id, resource_type="raw")
        except Exception as exc:
            logger.warning("[delete_media] Cloudinary delete failed: %s", exc)

    await media_upload_collection.delete_one({"_id": ObjectId(media_id)})
    return {"status": "success"}


@app.patch("/api/media/{media_id}/tags", tags=["Media Upload"])
async def update_media_tags(media_id: str, req: MediaUpdateTagsRequest = Body(...)):
    doc = await media_upload_collection.find_one({"_id": ObjectId(media_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Media not found.")
    await media_upload_collection.update_one(
        {"_id": ObjectId(media_id)},
        {"$set": {"tags": req.tags}},
    )
    updated = await media_upload_collection.find_one({"_id": ObjectId(media_id)})
    return _media_helper(updated, decrypt=True)


@app.patch("/api/media/{media_id}/rename", tags=["Media Upload"])
async def rename_media(media_id: str, req: MediaRenameRequest = Body(...)):
    doc = await media_upload_collection.find_one({"_id": ObjectId(media_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Media not found.")
    await media_upload_collection.update_one(
        {"_id": ObjectId(media_id)},
        {"$set": {"filename": req.filename}},
    )
    updated = await media_upload_collection.find_one({"_id": ObjectId(media_id)})
    return _media_helper(updated, decrypt=True)


@app.get("/api/cases/{case_id}/media/download-zip", tags=["Media Upload"])
async def download_case_media_zip(case_id: str):
    """Zips all media files in a case and streams the download directly."""
    await _resolve_case(case_id)
    files = []
    async for doc in media_upload_collection.find({"case_id": case_id}):
        files.append(_media_helper(doc, decrypt=True))
    
    if not files:
        raise HTTPException(status_code=404, detail="No media files to download.")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        for f in files:
            try:
                # Synchronously download the file from Cloudinary (for brevity). 
                # In production, use aiohttp or pre-signed AWS S3 URL.
                resp = urllib.request.urlopen(f["cloudinary_url"])
                file_bytes = resp.read()
                zip_file.writestr(f["filename"], file_bytes)
            except Exception as e:
                logger.warning("Failed to download file %s for zip: %s", f["filename"], e)
                
    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/x-zip-compressed",
        headers={"Content-Disposition": f"attachment; filename=sahayak_case_{case_id}_media.zip"}
    )


# ── Evidence ↔ Cluster Linking ────────────────────────────────────────────────

@app.post("/api/cases/{case_id}/media/{media_id}/link-cluster", tags=["Media Upload"])
async def link_media_to_cluster(case_id: str, media_id: str, req: LinkClusterRequest = Body(...)):
    """Link an existing uploaded media item to a testimony cluster/fragment."""
    await _resolve_case(case_id)
    doc = await media_upload_collection.find_one({"_id": ObjectId(media_id), "case_id": case_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Media not found.")

    # Update media document with linked cluster
    await media_upload_collection.update_one(
        {"_id": ObjectId(media_id)},
        {"$set": {"linked_cluster_id": req.cluster_id}},
    )

    # Update the fragment to flag it as having evidence
    frag_col = get_case_fragment_collection(case_id)
    await frag_col.update_one(
        {"_id": ObjectId(req.cluster_id)},
        {
            "$set": {"has_evidence": True},
            "$addToSet": {"linked_evidence": {
                "evidence_id": media_id,
                "file_name": doc.get("filename", ""),
                "type": doc.get("media_type", "document"),
            }},
        },
    )

    # Invalidate the graph cache so evidence shows up immediately
    cache_col = get_case_cache_collection(case_id)
    await cache_col.delete_many({"type": {"$in": ["entity_graph", "fragment_edges"]}})

    updated = await media_upload_collection.find_one({"_id": ObjectId(media_id)})
    return _media_helper(updated, decrypt=True)


@app.get("/api/cases/{case_id}/media/by-cluster/{cluster_id}", tags=["Media Upload"])
async def get_media_by_cluster(case_id: str, cluster_id: str):
    """Get all media files linked to a specific testimony cluster/fragment."""
    await _resolve_case(case_id)
    docs = []
    async for doc in media_upload_collection.find({"case_id": case_id, "linked_cluster_id": cluster_id}):
        docs.append(_media_helper(doc, decrypt=True))
    return docs


# ═════════════════════════════════════════════════════════════════════════════
# SECURE SHARE   /api/cases/{case_id}/share
# ═════════════════════════════════════════════════════════════════════════════

def _share_link_helper(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "case_id": doc.get("case_id", ""),
        "token": doc.get("token", ""),
        "share_url": doc.get("share_url", ""),
        "recipient_name": doc.get("recipient_name"),
        "recipient_type": doc.get("recipient_type", "lawyer"),
        "recipient_org": doc.get("recipient_org"),
        "created_at": doc.get("created_at", ""),
        "expires_at": doc.get("expires_at", ""),
        "status": doc.get("status", "active"),
    }

@app.post("/api/cases/{case_id}/share/links", tags=["Secure Share"], response_model=ShareLinkResponse)
async def create_share_link(case_id: str, req: ShareLinkRequest = Body(...)):
    await _resolve_case(case_id)
    token = secrets.token_urlsafe(32)
    # Generate local frontend URL for Dev
    share_url = f"http://localhost:8080/share/{token}"  
    
    now = datetime.now()
    expires_at = now + timedelta(hours=SHARE_LINK_EXPIRY_HOURS)

    doc_data = {
        "case_id": case_id,
        "token": token,
        "share_url": share_url,
        "recipient_name": req.recipient_name,
        "recipient_type": req.recipient_type,
        "recipient_org": req.recipient_org,
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "status": "active", # pending, active, revoked
    }
    result = await shared_links_collection.insert_one(doc_data)
    created = await shared_links_collection.find_one({"_id": result.inserted_id})
    return _share_link_helper(created)


@app.get("/api/cases/{case_id}/share/links", tags=["Secure Share"])
async def list_share_links(case_id: str):
    await _resolve_case(case_id)
    docs = []
    async for doc in shared_links_collection.find({"case_id": case_id}).sort("created_at", -1):
        docs.append(_share_link_helper(doc))
    return docs


@app.delete("/api/cases/{case_id}/share/links/{link_id}", tags=["Secure Share"])
async def revoke_share_link(case_id: str, link_id: str):
    await _resolve_case(case_id)
    doc = await shared_links_collection.find_one({"_id": ObjectId(link_id), "case_id": case_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Link not found")
    
    # We can hard-delete or just mark revoked
    await shared_links_collection.update_one(
        {"_id": ObjectId(link_id)},
        {"$set": {"status": "revoked"}}
    )
    return {"status": "success"}


@app.get("/api/share/{token}", tags=["Secure Share"])
async def access_shared_case(token: str):
    """
    Public endpoint. A secure recipient hits this with their token.
    Decodes everything and exposes the case evidence securely.
    """
    link_doc = await shared_links_collection.find_one({"token": token})
    if not link_doc:
        raise HTTPException(status_code=404, detail="Invalid or expired share link")
    
    # Check expiry
    expires_at = datetime.fromisoformat(link_doc["expires_at"])
    now = datetime.now()
    if now > expires_at:
        print(f"[access_shared_case] EXPIRED: now={now.isoformat()} > expires_at={expires_at.isoformat()}")
        if link_doc.get("status") != "revoked":
            await shared_links_collection.update_one({"_id": link_doc["_id"]}, {"$set": {"status": "revoked"}})
        raise HTTPException(status_code=403, detail="Share link has expired")
    
    if link_doc.get("status") == "revoked":
        print(f"[access_shared_case] REVOKED: status=revoked")
        raise HTTPException(status_code=403, detail="Share link has been revoked")
    
    # Mark as viewed
    if link_doc.get("status") == "active":
        await shared_links_collection.update_one({"_id": link_doc["_id"]}, {"$set": {"status": "viewed"}})
    
    case_id = link_doc["case_id"]
    from database import database, COLLECTION_CASES
    case = await database[COLLECTION_CASES].find_one({"_id": ObjectId(case_id)})
    
    # Fetch all media for this case, decrypted!
    media = []
    async for m in media_upload_collection.find({"case_id": case_id}):
        media.append(_media_helper(m, decrypt=True))
    
    # ── [NEW] Fetch Fragments (Cognitive Map) ──
    from database import get_case_fragment_collection, fragment_helper
    fragments = []
    frag_col = get_case_fragment_collection(case_id)
    async for f in frag_col.find({}):
        fragments.append(fragment_helper(f))

    # ── [NEW] Fetch Documents ──
    from database import document_collection
    documents = []
    async for d in document_collection.find({"case_id": case_id}):
        doc_obj = dict(d)
        doc_obj["id"] = str(doc_obj.pop("_id"))
        documents.append(doc_obj)
        
    return {
        "case_id": str(case_id),
        "case_title": case.get("title") if case else "Unknown Case",
        "case_description": case.get("description") if case else "",
        "recipient_name": link_doc.get("recipient_name"),
        "expires_at": link_doc.get("expires_at"),
        "media": media,
        "fragments": fragments,
        "documents": documents
    }


# ═════════════════════════════════════════════════════════════════════════════
# CASE INSIGHTS — Claw Legal Integration   /api/cases/{case_id}/legal/*
# ═════════════════════════════════════════════════════════════════════════════

# ── BNS Mapping ───────────────────────────────────────────────────────────────

@app.post("/api/cases/{case_id}/legal/bns-map", tags=["Case Insights"])
async def bns_map(case_id: str):
    """
    [Claw LegalGPT] Cleans testimony and maps to BNS 2023 sections.
    """
    await _resolve_case(case_id)
    fragments = await _get_case_fragments(case_id)
    if not fragments:
        raise HTTPException(status_code=404, detail="No fragments found. Record testimony first.")

    result = await map_to_bns_sections(fragments)
    result["powered_by"]     = POWERED_BY_BNS
    result["fragment_count"] = len(fragments)
    return result


# ── Gap Detection ─────────────────────────────────────────────────────────────

@app.post("/api/cases/{case_id}/legal/gap-detect", tags=["Case Insights"])
async def gap_detect(case_id: str):
    """
    [Claw ATG + AI] Detects missing legal elements in the testimony.
    """
    await _resolve_case(case_id)
    fragments = await _get_case_fragments(case_id)
    if not fragments:
        raise HTTPException(status_code=404, detail="No fragments found. Record testimony first.")

    result = await detect_legal_gaps(fragments)
    result["powered_by"]     = POWERED_BY_GAP
    result["fragment_count"] = len(fragments)
    return result


# ── Legal Draft ───────────────────────────────────────────────────────────────

@app.post("/api/cases/{case_id}/legal/generate-draft", tags=["Case Insights"])
async def generate_draft(case_id: str, req: GenerateDraftRequest = Body(...)):
    """
    [Claw Adira AI] Generates a court-ready legal document (FIR / Complaint / Affidavit).
    The generated draft is saved to the case's documents collection.
    """
    await _resolve_case(case_id)
    fragments = await _get_case_fragments(case_id)
    if not fragments:
        raise HTTPException(status_code=404, detail="No fragments found. Record testimony first.")

    bns_result: dict = {}
    try:
        bns_result = await map_to_bns_sections(fragments)
    except Exception as exc:
        logger.warning("[generate_draft] BNS pre-mapping failed: %s", exc)

    result = await generate_legal_draft(
        fragments=fragments,
        case_name=req.case_name,
        draft_type=req.draft_type,
        bns_sections=bns_result.get("bns_sections"),
    )

    # Persist to documents collection
    doc_data = {
        "case_id":     case_id,
        "title":       f"{req.draft_type} — {req.case_name}",
        "type":        req.draft_type.lower(),
        "status":      "ready",
        "generatedAt": _now_str(),
        "sections":    [s["section"] for s in bns_result.get("bns_sections", [])],
        "content":     result,
    }
    inserted = await document_collection.insert_one(doc_data)

    result["id"]          = str(inserted.inserted_id)
    result["powered_by"]  = POWERED_BY_DRAFT
    result["generated_at"] = doc_data["generatedAt"]
    return result


# ── Related Cases / Precedents (Claw Law judgment search) ─────────────────────

@app.get("/api/cases/{case_id}/legal/related-cases", tags=["Case Insights"])
async def related_cases(case_id: str, force_refresh: bool = False):
    """
    [Claw Judgment Search × Sahayak]
    1. Fetches real Indian court judgments from clawlaw.in/judgment matching our case.
    2. Uses Gemini to rank, annotate, and explain WHY each case matches.
    3. Returns a match summary paragraph for legal strategy.

    Results are cached per fragment hash. Pass ?force_refresh=true to bypass cache.
    """
    await _resolve_case(case_id)
    fragments = await _get_case_fragments(case_id)
    if not fragments:
        return {"cases": [], "overall_match_summary": "", "powered_by": POWERED_BY_CASES}

    cache_col    = get_case_cache_collection(case_id)
    current_hash = get_fragments_hash(fragments)

    if not force_refresh:
        cached = await cache_col.find_one({"type": "precedents", "hash": current_hash})
        if cached and cached.get("cases"):
            return {
                "cases":                 cached["cases"],
                "overall_match_summary": cached.get("overall_match_summary", ""),
                "powered_by":            POWERED_BY_CASES,
            }

    # BNS map (used to sharpen the search query)
    bns_res: dict = {}
    try:
        bns_res = await map_to_bns_sections(fragments)
    except Exception as exc:
        logger.warning("[related_cases] BNS map failed: %s", exc)

    cases = await search_precedent_cases(fragments, bns_res.get("bns_sections", []))

    # Gemini writes an overall legal strategy paragraph
    case_context = " ".join(f.get("content", "") for f in fragments)
    match_summary = await generate_case_match_summary(case_context, cases)

    if cases:
        await cache_col.update_one(
            {"type": "precedents"},
            {"$set": {
                "hash":                  current_hash,
                "cases":                 cases,
                "overall_match_summary": match_summary,
            }},
            upsert=True,
        )

    return {
        "cases":                 cases,
        "overall_match_summary": match_summary,
        "powered_by":            POWERED_BY_CASES,
    }


# ── Full Analysis (BNS + Gap + Draft in one call) ─────────────────────────────

@app.get("/api/cases/{case_id}/legal/full-analysis", tags=["Case Insights"])
async def get_full_analysis(case_id: str):
    """Fetches the SAVED analysis from MongoDB cache so it survives refreshes."""
    await _resolve_case(case_id)
    cache_col = get_case_cache_collection(case_id)
    cached = await cache_col.find_one({"type": "full_analysis"})
    if cached and "data" in cached:
        return cached["data"]
    return None

@app.post("/api/cases/{case_id}/legal/full-analysis", tags=["Case Insights"])
async def full_legal_analysis(case_id: str, req: GenerateDraftRequest = Body(...)):
    """[Claw Full Suite] Runs BNS + Gap + Draft, and SAVES it to MongoDB."""
    await _resolve_case(case_id)
    fragments = await _get_case_fragments(case_id)
    if not fragments:
        raise HTTPException(status_code=404, detail="No fragments found. Record testimony first.")

    # Run sequentially to avoid overwhelming Gemini rate limits
    bns_result = await map_to_bns_sections(fragments)
    gaps_result = await detect_legal_gaps(fragments)
    draft_result = await generate_legal_draft(
        fragments=fragments,
        case_name=req.case_name,
        draft_type=req.draft_type,
        bns_sections=bns_result.get("bns_sections"),
    )

    result_data = {
        "powered_by":     POWERED_BY_FULL,
        "generated_at":   _now_str(),
        "fragment_count": len(fragments),
        "bns_mapping":    bns_result,
        "gap_analysis":   gaps_result,
        "legal_draft":    draft_result,
    }

    # ✨ NEW: Actually SAVE the analysis to MongoDB Case Cache!
    cache_col = get_case_cache_collection(case_id)
    current_hash = get_fragments_hash(fragments)
    await cache_col.update_one(
        {"type": "full_analysis"},
        {"$set": {"hash": current_hash, "data": result_data}},
        upsert=True
    )

    return result_data


# ═════════════════════════════════════════════════════════════════════════════
# DASHBOARD STATS   /api/cases/{case_id}/dashboard
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/api/cases/{case_id}/dashboard/stats", tags=["Dashboard"])
async def dashboard_stats(case_id: str):
    """
    Consolidated dashboard endpoint. Returns fragment count, graph stats,
    gap analysis, case strength, recent fragments, BNS sections, and
    detailed analysis — all in a single call.
    """
    await _resolve_case(case_id)
    fragments = await _get_case_fragments(case_id)
    cache_col = get_case_cache_collection(case_id)

    # Graph stats (from cache)
    graph_nodes = 0
    graph_edges = 0
    cached_graph = await cache_col.find_one({"type": "entity_graph"})
    if cached_graph and cached_graph.get("graph_data"):
        graph_nodes = len(cached_graph["graph_data"].get("nodes", []))
        graph_edges = len(cached_graph["graph_data"].get("edges", []))

    # Analysis stats (from cache)
    gaps_found = 0
    case_strength = 0
    bns_sections = []
    detailed_analysis = ""
    cached_analysis = await cache_col.find_one({"type": "full_analysis"})
    if cached_analysis and cached_analysis.get("data"):
        data = cached_analysis["data"]
        gap_data = data.get("gap_analysis", {})
        gaps_found = len([g for g in gap_data.get("gaps", []) if g.get("status") == "missing"])
        case_strength = gap_data.get("completeness_score", 0)
        bns_sections = data.get("bns_mapping", {}).get("bns_sections", [])
        detailed_analysis = data.get("bns_mapping", {}).get("detailed_analysis", "")

    # Recent fragments (latest 5)
    recent_fragments = sorted(
        fragments, key=lambda f: f.get("timestamp", ""), reverse=True
    )[:5]

    return {
        "fragment_count":    len(fragments),
        "graph_nodes":       graph_nodes,
        "graph_edges":       graph_edges,
        "gaps_found":        gaps_found,
        "case_strength":     case_strength,
        "recent_fragments":  recent_fragments,
        "bns_sections":      bns_sections,
        "detailed_analysis": detailed_analysis,
    }

# ═════════════════════════════════════════════════════════════════════════════
# GLOBAL EVIDENCE   /api/evidence
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/api/evidence", tags=["Evidence"])
async def get_evidence():
    docs = []
    async for doc in evidence_collection.find():
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        docs.append(doc)
    return docs


@app.post("/api/evidence", tags=["Evidence"])
async def add_evidence(data: dict = Body(...)):
    res = await evidence_collection.insert_one(data)
    created = await evidence_collection.find_one({"_id": res.inserted_id})
    created["id"] = str(created["_id"])
    del created["_id"]
    return created


@app.delete("/api/evidence/{evidence_id}", tags=["Evidence"])
async def delete_evidence(evidence_id: str):
    await evidence_collection.delete_one({"_id": ObjectId(evidence_id)})
    return {"status": "success"}


# ── Community Routes ─────────────────────────────────────────────────────────

@app.get("/api/community/stories", tags=["Community"])
async def get_stories(category: str = "all"):
    """Fetches stories, optionally filtered by category."""
    from database import get_community_stories
    return await get_community_stories(category)


@app.post("/api/community/stories", tags=["Community"])
async def create_story(data: dict = Body(...)):
    """Creates a new anonymous community story."""
    from database import add_community_story
    return await add_community_story(
        alias=data.get("alias"),
        title=data.get("title"),
        full_story=data.get("fullStory"),
        category=data.get("category", "all"),
        category_label=data.get("categoryLabel", "Survivor Story"),
        tags=data.get("tags", []),
    )


@app.post("/api/community/stories/{story_id}/like", tags=["Community"])
async def like_story(story_id: str):
    """Increments likes for a community story."""
    from database import like_community_story
    updated = await like_community_story(story_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Story not found")
    return updated


# ═════════════════════════════════════════════════════════════════════════════
# LEGACY ROUTES (kept for backward compatibility — delegate to default case)
# These will be removed in v4.0. Prefer /api/cases/{case_id}/* routes.
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/api/fragments", tags=["Legacy"], deprecated=True)
async def legacy_get_fragments():
    return [fragment_helper(doc) async for doc in fragment_collection.find()]


@app.post("/api/chat", tags=["Legacy"], deprecated=True, response_model=ChatResponse)
async def legacy_chat(req: ChatRequest = Body(...)):
    case_id = req.case_id or DEFAULT_CASE_ID
    conversation = await conversation_collection.find_one({"case_id": case_id})
    if not conversation:
        res = await conversation_collection.insert_one({
            "case_id": case_id, "messages": [], "created_at": _now_iso(),
        })
        conversation = {"_id": res.inserted_id, "case_id": case_id, "messages": []}

    past = [m["content"] for m in conversation.get("messages", []) if m["role"] == "user"]
    result = await check_contradiction_gemini(req.message, past)
    user_msg = {"role": "user",      "content": req.message,        "timestamp": _now_iso()}
    bot_msg  = {"role": "assistant", "content": result["reply"],
                "has_contradiction": result["has_contradiction"],    "timestamp": _now_iso()}
    await conversation_collection.update_one(
        {"case_id": case_id},
        {"$push": {"messages": {"$each": [user_msg, bot_msg]}}},
    )
    return ChatResponse(
        reply=result["reply"],
        has_contradiction=result["has_contradiction"],
        contradiction_detail=result.get("contradiction_detail"),
    )


@app.get("/api/testimonies", tags=["Legacy"], deprecated=True)
async def legacy_get_testimonies():
    return [testimony_helper(doc) async for doc in testimony_collection.find()]