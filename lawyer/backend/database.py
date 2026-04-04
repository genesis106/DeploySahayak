"""
database.py — Motor async client + collection accessors.
All collections are now case-scoped (fragments, conversations, cache).
Global collections (testimonies, evidence, documents) remain shared.
"""
from motor.motor_asyncio import AsyncIOMotorClient
from config import (
    MONGO_URI,
    MONGO_DB_NAME,
    COLLECTION_FRAGMENTS,
    COLLECTION_TESTIMONIES,
    COLLECTION_EVIDENCE,
    COLLECTION_CONVERSATIONS,
    COLLECTION_DOCUMENTS,
    COLLECTION_CASES,
    COLLECTION_USERS,
    COLLECTION_MEDIA_UPLOADS,
    COLLECTION_SHARED_LINKS,
)

client   = AsyncIOMotorClient(MONGO_URI)
database = client[MONGO_DB_NAME]

# ── Global / shared collections ───────────────────────────────────────────────
testimony_collection    = database.get_collection(COLLECTION_TESTIMONIES)
evidence_collection     = database.get_collection(COLLECTION_EVIDENCE)
document_collection     = database.get_collection(COLLECTION_DOCUMENTS)
user_collection         = database.get_collection(COLLECTION_USERS)
cases_collection        = database.get_collection(COLLECTION_CASES)
media_upload_collection = database.get_collection(COLLECTION_MEDIA_UPLOADS)
shared_links_collection = database.get_collection(COLLECTION_SHARED_LINKS)

# ── Default (legacy / no-case) collections ────────────────────────────────────
fragment_collection     = database.get_collection(COLLECTION_FRAGMENTS)
conversation_collection = database.get_collection(COLLECTION_CONVERSATIONS)


# ── Case-scoped collection helpers ────────────────────────────────────────────

def get_case_fragment_collection(case_id: str):
    """Returns the fragments collection namespaced to a specific case."""
    return database.get_collection(f"fragments_{case_id}")


def get_case_conversation_collection(case_id: str):
    """Returns the conversations collection namespaced to a specific case."""
    return database.get_collection(f"conversations_{case_id}")


def get_case_cache_collection(case_id: str):
    """Returns the cache collection namespaced to a specific case."""
    return database.get_collection(f"cache_{case_id}")


# ── Serialisers ───────────────────────────────────────────────────────────────

def fragment_helper(fragment) -> dict:
    """Serialize a raw MongoDB fragment document to a clean API dict."""
    return {
        "id":                str(fragment["_id"]),
        "type":              fragment["type"],
        "content":           fragment["content"],
        "timestamp":         fragment["timestamp"],
        "cluster":           fragment.get("cluster"),
        "position":          fragment.get("position", {"x": 50, "y": 50}),
        "has_evidence":      fragment.get("has_evidence", False),
        "original_text":     fragment.get("original_text", ""),
        "original_language": fragment.get("original_language", "en"),
        "linked_evidence":   fragment.get("linked_evidence", []),
    }


def testimony_helper(doc) -> dict:
    """Serialize a testimony/case document."""
    out = dict(doc)
    out["id"] = str(out.pop("_id"))
    for frag in out.get("fragments", []):
        if "_id" in frag:
            frag["id"] = str(frag.pop("_id"))
    return out
