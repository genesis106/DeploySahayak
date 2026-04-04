"""
main.py — Lawyer Portal Backend entry point.
Handles all lawyer-specific logic: Case Dashboard, AI Query Interrogation, and Document Generation.
"""
import os
import logging
from typing import List, Dict
from datetime import datetime
from bson import ObjectId

from fastapi import FastAPI, HTTPException, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import (
    APP_TITLE, APP_VERSION, APP_DESCRIPTION,
    CORS_ORIGINS,
)
from database import (
    database,
    cases_collection,
    testimony_collection,
    get_case_fragment_collection,
    get_case_cache_collection,
    testimony_helper,
)
from utils import (
    ask_gemini_query,
    generate_legal_draft,
    generate_document_from_graph,
    _get_case_fragments,
    _now_str,
)

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    description=APP_DESCRIPTION,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ────────────────────────────────────────────────────────────────────
class AIQueryRequest(BaseModel):
    case_id: str
    query: str

class DocumentRequest(BaseModel):
    case_id: str
    case_name: str
    doc_type: str
    bns_sections: str = ""

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "Sahayak Lawyer API is online", "status": "ok"}

@app.get("/api/lawyer/dashboard/cases", tags=["Lawyer Dashboard"])
async def get_lawyer_cases():
    """Returns all cases structured for the Lawyer Dashboard."""
    result = []
    async for doc in cases_collection.find().sort("created_at", -1):
        cid = str(doc["_id"])
        
        # Get testimonies
        fragments = await _get_case_fragments(cid)
        formatted_testimonies = []
        for frag in fragments:
            formatted_testimonies.append({
                "id": str(frag["_id"]),
                "summary": frag.get("content", ""),
                "tags": [f"Cluster: {frag.get('cluster', 'Unknown')}", "Evidence: Yes" if frag.get("has_evidence") else "Evidence: No"],
                "date": frag.get("timestamp", _now_str())[:10]
            })
            
        # Get graph data from cache
        cache_col = get_case_cache_collection(cid)
        cached_graph = await cache_col.find_one({"type": "entity_graph"})
        graph_data = {"nodes": [], "edges": []}
        if cached_graph and cached_graph.get("graph_data"):
            graph_data = cached_graph["graph_data"]
            
        status = doc.get("status", "Active")
        
        # Default severity
        severity = "Medium"
        cached_analysis = await cache_col.find_one({"type": "full_analysis"})
        if cached_analysis and cached_analysis.get("data"):
            case_strength = cached_analysis["data"].get("gap_analysis", {}).get("completeness_score", 0)
            if case_strength < 40: severity = "Critical"
            elif case_strength < 70: severity = "High"
            else: severity = "Medium"

        result.append({
            "id": cid,
            "name": doc.get("title", f"Client {cid[-4:]}"),
            "case": cid[-6:].upper() + "-2024",
            "severity": severity,
            "status": status.capitalize(),
            "date": doc.get("created_at", _now_str())[:10],
            "testimonies": formatted_testimonies,
            "graph_data": graph_data
        })
    return result

@app.post("/api/lawyer/query", tags=["Lawyer Dashboard"])
async def generate_lawyer_query(req: AIQueryRequest):
    case_id = req.case_id
    query_text = req.query

    case = await cases_collection.find_one({"_id": ObjectId(case_id)})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    fragments = await _get_case_fragments(case_id)
    if not fragments:
        return {
            "answer": "No testimony evidence available in this case to process queries.",
            "evidence": [],
            "confidence": 0
        }

    return await ask_gemini_query(fragments, query_text)

@app.post("/api/lawyer/generate-document", tags=["Lawyer Dashboard"])
async def lawyer_generate_document(req: DocumentRequest):
    case_id = req.case_id
    case_name = req.case_name
    doc_type = req.doc_type
    bns_sections = req.bns_sections

    fragments = await _get_case_fragments(case_id)
    if not fragments:
        raise HTTPException(status_code=400, detail="No testimonies found for this case")

    # Generate
    result = await generate_document_from_graph(
        fragments=fragments,
        case_name=case_name,
        draft_type=doc_type,
        bns_sections=bns_sections
    )

    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    # Format the sections into a string for the frontend
    text = f"--- {result.get('draft_type', doc_type)} ---\nCase: {result.get('case_name', case_name)}\n\n"
    for sec in result.get("sections", []):
        text += f"{sec.get('heading', '')}\n\n{sec.get('content', '')}\n\n{'='*40}\n\n"
    text += f"\nDECLARATION / DISCLAIMER:\n{result.get('disclaimer', '')}"

    return {"status": "success", "text": text}

# ── Cognitive Map Routes ──────────────────────────────────────────────────────

@app.get("/api/cases/{case_id}/fragments", tags=["Cognitive Map"])
async def get_case_fragments_api(case_id: str):
    fragments = await _get_case_fragments(case_id)
    return [fragment_helper(f) for f in fragments]

@app.get("/api/cases/{case_id}/fragments/edges", tags=["Cognitive Map"])
async def get_case_edges(case_id: str):
    cache_col = get_case_cache_collection(case_id)
    cached_edges = await cache_col.find_one({"type": "entity_graph"})
    if cached_edges and "graph_data" in cached_edges:
        return cached_edges["graph_data"]
    return {"nodes": [], "edges": []}

from database import fragment_helper

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
