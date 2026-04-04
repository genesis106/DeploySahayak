"""
utils.py — AI helpers specifically for the Lawyer Portal.
Handles document generation, AI interrogation (query), and legal drafting.
"""
import json
import asyncio
import logging
from typing import Optional, List, Dict
from datetime import datetime

try:
    from google import genai as _genai_module
except ImportError:
    _genai_module = None

from config import (
    GEMINI_API_KEY,
    GEMINI_API_KEY_DOCS,
    GEMINI_API_KEY_INSIGHTS,
    GEMINI_MODEL,
    GEMINI_TIMEOUT_DEFAULT,
    GEMINI_TIMEOUT_DRAFT,
    LEGAL_DRAFT_DISCLAIMER,
)
from database import get_case_fragment_collection

logger = logging.getLogger(__name__)

# ── Gemini client (lazy) ──────────────────────────────────────────────────────
_gemini_clients = {}
if _genai_module:
    if GEMINI_API_KEY:
        _gemini_clients["default"] = _genai_module.Client(api_key=GEMINI_API_KEY)
    if GEMINI_API_KEY_DOCS:
        _gemini_clients["docs"] = _genai_module.Client(api_key=GEMINI_API_KEY_DOCS)
    if GEMINI_API_KEY_INSIGHTS:
        _gemini_clients["insights"] = _genai_module.Client(api_key=GEMINI_API_KEY_INSIGHTS)

def _gemini_available() -> bool:
    return len(_gemini_clients) > 0

def _get_client(feature: str):
    return _gemini_clients.get(feature) or _gemini_clients.get("default")

def _now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")

def _strip_json_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()

async def _gemini_call(prompt: str, feature: str = "default", timeout: Optional[float] = None, _max_retries: int = 2) -> str:
    effective_timeout = timeout if timeout is not None else GEMINI_TIMEOUT_DEFAULT
    client = _get_client(feature)
    if not client:
        raise ValueError("No usable API Key configuration found")

    for attempt in range(_max_retries + 1):
        try:
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    client.models.generate_content,
                    model=GEMINI_MODEL,
                    contents=prompt,
                ),
                timeout=effective_timeout,
            )
            return response.text.strip()
        except Exception as exc:
            if attempt < _max_retries:
                await asyncio.sleep(2 * (attempt + 1))
                continue
            logger.warning("[_gemini_call] Failed after %d retries: %s", _max_retries, exc)
            raise exc

async def _get_case_fragments(case_id: str) -> List[Dict]:
    """Internal helper to fetch all fragments for a case."""
    col = get_case_fragment_collection(case_id)
    return [doc async for doc in col.find()]

# ─────────────────────────────────────────────────────────────────────────────
# AI Query Handler
# ─────────────────────────────────────────────────────────────────────────────

async def ask_gemini_query(fragments: List[Dict], query: str) -> Dict:
    """Answers a lawyer's question regarding a specific case based on its testimony fragments."""
    if not fragments or not _gemini_available():
        return {
            "answer": "No case testimonies available to analyze or AI offline.",
            "evidence": [],
            "confidence": 0
        }

    combined = "\n".join(f"- {f.get('content', '')}" for f in fragments)
    prompt = f"""You are an advanced forensic intelligence query handler.
A lawyer is asking a question about a case based strictly on these testimony fragments:
{combined}

Question: {query}

Answer the question strictly using the provided facts.
Do THREE things:
1. Provide a comprehensive "answer" (2-4 sentences max).
2. Provide an array of "evidence" strings which are the specific facts used.
3. Provide a "confidence" integer from 0 to 100.

Return ONLY valid JSON:
{{
  "answer": "...",
  "evidence": ["...", "..."],
  "confidence": 95
}}
"""
    try:
        text = await _gemini_call(prompt, feature="insights")
        return json.loads(_strip_json_fences(text))
    except Exception as exc:
        logger.warning("[ask_gemini_query] Gemini failed: %s", exc)
        return {
            "answer": "Generation failed. Please try a different question.",
            "evidence": [],
            "confidence": 0
        }

# ─────────────────────────────────────────────────────────────────────────────
# Legal Draft Generation
# ─────────────────────────────────────────────────────────────────────────────

async def generate_legal_draft(fragments: List[Dict], case_name: str, draft_type: str, bns_sections: str = "") -> Dict:
    """Generates a formal Indian legal document using Gemini."""
    if not _gemini_available():
        return {"error": "AI Service Offline"}

    testimonies_text = "\n".join([f"- {f.get('content', '')}" for f in fragments])
    
    prompt = f"""You are an expert Indian Legal Drafter.
Based on the following testimony fragments, generate a formal {draft_type} document for the case: {case_name}.

Testimony Facts:
{testimonies_text}

Relevant BNS Sections (if any provided):
{bns_sections}

Standard Draft Structure:
1. Heading / Court Name
2. Parties Involved
3. Facts of the Case
4. Applicable Law (BNS 2023)
5. Relief / Prayer
6. Declaration

Return ONLY valid JSON:
{{
  "draft_type": "{draft_type}",
  "case_name": "{case_name}",
  "sections": [
     {{"heading": "...", "content": "..."}},
     ...
  ],
  "disclaimer": "{LEGAL_DRAFT_DISCLAIMER}"
}}
"""
    try:
        text = await _gemini_call(prompt, feature="docs", timeout=GEMINI_TIMEOUT_DRAFT)
        result = json.loads(_strip_json_fences(text))
        if not result.get("disclaimer"):
            result["disclaimer"] = LEGAL_DRAFT_DISCLAIMER
        return result
    except Exception as exc:
        logger.warning("[generate_legal_draft] Failed: %s", exc)
        return {"error": "Failed to generate legal draft."}

async def generate_document_from_graph(fragments: List[Dict], case_name: str, draft_type: str, bns_sections: str = "") -> Dict:
    """Fallback / high-level wrapper for document generation."""
    # Simplified version for now.
    return await generate_legal_draft(fragments, case_name, draft_type, bns_sections)
