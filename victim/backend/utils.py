"""
utils.py — AI helpers and heuristic fallbacks.
All magic strings / numbers come from config.py or named module-level constants.
"""
from typing import Optional
import re
import json
import asyncio
import hashlib
import random
import logging

try:
    from google import genai as _genai_module
except ImportError:
    _genai_module = None

try:
    import httpx as _httpx
except ImportError:
    _httpx = None

from config import (
    GEMINI_API_KEY,
    GEMINI_API_KEY_DOCS,
    GEMINI_API_KEY_MAP,
    GEMINI_API_KEY_INSIGHTS,
    GEMINI_API_KEY_CHAT,
    GEMINI_MODEL,
    GEMINI_TIMEOUT_DEFAULT,
    GEMINI_TIMEOUT_DRAFT,
    FALLBACK_CHAT_REPLY,
    LEGAL_DRAFT_DISCLAIMER,
    CLAWLAW_JUDGMENT_URL,
)

logger = logging.getLogger(__name__)

# ── Gemini client (lazy) ──────────────────────────────────────────────────────
_gemini_clients = {}
if _genai_module:
    if GEMINI_API_KEY:
        _gemini_clients["default"] = _genai_module.Client(api_key=GEMINI_API_KEY)
    if GEMINI_API_KEY_DOCS:
        _gemini_clients["docs"] = _genai_module.Client(api_key=GEMINI_API_KEY_DOCS)
    if GEMINI_API_KEY_MAP:
        _gemini_clients["map"] = _genai_module.Client(api_key=GEMINI_API_KEY_MAP)
    if GEMINI_API_KEY_INSIGHTS:
        _gemini_clients["insights"] = _genai_module.Client(api_key=GEMINI_API_KEY_INSIGHTS)
    if GEMINI_API_KEY_CHAT:
        _gemini_clients["chat"] = _genai_module.Client(api_key=GEMINI_API_KEY_CHAT)

def _gemini_available() -> bool:
    return len(_gemini_clients) > 0

def _get_client(feature: str):
    return _gemini_clients.get(feature) or _gemini_clients.get("default")


# ── Anonymous Alias Generator ────────────────────────────────────────────────

ADJECTIVES = ["Brave", "Quiet", "Phoenix", "Resilient", "Strong", "Hopeful", "Wise", "Daring", "Gentle", "Radiant", "Calm", "Fierce"]
NOUNS = ["Lotus", "Rising", "Strength", "Grace", "Sunflower", "Mountain", "River", "Sparrow", "Flame", "Anchor", "Healer", "Warrior"]

def generate_anonymous_alias() -> str:
    """Generates a Reddit-like anonymous alias for survivors."""
    adj = random.choice(ADJECTIVES)
    noun = random.choice(NOUNS)
    return f"{adj} {noun}"


# ── Supported languages ───────────────────────────────────────────────────────
SUPPORTED_LANGUAGES: dict[str, str] = {
    "en": "English",
    "hi": "Hindi",
    "mr": "Marathi",
    "ta": "Tamil",
    "te": "Telugu",
    "bn": "Bengali",
    "kn": "Kannada",
    "ml": "Malayalam",
    "gu": "Gujarati",
    "pa": "Punjabi",
}

# BCP-47 locale tags for the Web Speech API
LANGUAGE_LOCALES: dict[str, str] = {
    "en": "en-IN", "hi": "hi-IN", "mr": "mr-IN", "ta": "ta-IN",
    "te": "te-IN", "bn": "bn-IN", "kn": "kn-IN", "ml": "ml-IN",
    "gu": "gu-IN", "pa": "pa-IN",
}


async def detect_and_translate_to_english(text: str) -> dict:
    """
    Uses Gemini to detect the language of input text and translate it to English.
    Returns: {"original_text": str, "original_language": str, "translated_text_en": str}
    """
    if not text or not text.strip():
        return {"original_text": text, "original_language": "en", "translated_text_en": text}

    if not _gemini_available():
        return {"original_text": text, "original_language": "en", "translated_text_en": text}

    supported_list = ", ".join(f"{code} ({name})" for code, name in SUPPORTED_LANGUAGES.items())
    try:
        prompt = f"""You are a language detection and translation expert for Indian languages.

Given the following text, do TWO things:
1. Detect which language it is written in. It must be one of: {supported_list}
2. If the text is NOT in English, translate it accurately to English.
   If the text IS English, keep it unchanged.

Return ONLY valid JSON, no markdown:
{{
  "original_language": "<2-letter code like hi, ta, en, etc>",
  "translated_text_en": "<English translation or original if already English>"
}}

Text: {text}"""
        raw = await _gemini_call(prompt, feature="default")
        result = json.loads(_strip_json_fences(raw))
        return {
            "original_text": text,
            "original_language": result.get("original_language", "en"),
            "translated_text_en": result.get("translated_text_en", text),
        }
    except Exception as exc:
        logger.warning("[detect_and_translate_to_english] Failed: %s — assuming English.", exc)
        return {"original_text": text, "original_language": "en", "translated_text_en": text}


async def translate_text(text: str, target_language: str) -> str:
    """
    Translates English text to the specified target language using Gemini.
    Returns the translated text string.
    """
    if not text or not text.strip():
        return text
    if target_language == "en":
        return text
    if target_language not in SUPPORTED_LANGUAGES:
        return text
    if not _gemini_available():
        return text

    target_name = SUPPORTED_LANGUAGES[target_language]
    try:
        prompt = f"""Translate the following English text to {target_name} ({target_language}).
Return ONLY the translated text, nothing else. No quotes, no explanation.

Text: {text}"""
        return await _gemini_call(prompt, feature="default")
    except Exception as exc:
        logger.warning("[translate_text] Failed: %s — returning original.", exc)
        return text


# ── Cluster labels ─────────────────────────────────────────────────────────────
CLUSTER_APPEARANCE = "Appearance"
CLUSTER_SENSORY    = "Sensory"
CLUSTER_LOCATION   = "Location"
CLUSTER_WITNESS    = "Witness"
CLUSTER_TIMELINE   = "Timeline"
CLUSTER_EVENT      = "Event"

# ── Heuristic maps ─────────────────────────────────────────────────────────────
_FILLER_PREFIXES: list[str] = [
    "i saw that ", "i saw ", "i was walking ", "i was ",
    "there was a ", "there was ",
    "i noticed that ", "i noticed ",
    "he was ", "she was ",
    "it happened ",
    "i remember that ", "i remember ",
    "it must have been ",
    "and the area was ",
]

_CLUSTER_KEYWORDS: list[tuple[str, list[str]]] = [
    (CLUSTER_APPEARANCE, ["saw", "looked", "wearing", "shirt", "car", "red", "blue", "colour", "color", "clothes"]),
    (CLUSTER_SENSORY,    ["smell", "hear", "loud", "dark", "bright", "noise", "sound", "light"]),
    (CLUSTER_LOCATION,   ["near", "place", "street", "village", "station", "building", "road", "area", "location"]),
    (CLUSTER_WITNESS,    ["he", "she", "neighbour", "neighbor", "they", "person", "man", "woman", "suspect", "accused"]),
    (CLUSTER_TIMELINE,   ["pm", "am", "time", "around", "morning", "night", "evening", "afternoon", "o'clock"]),
]

_BNS_KEYWORD_MAP: list[tuple[list[str], str, str]] = [
    (["kill", "murder", "dead", "death", "shot", "stabbed"],          "BNS 103", "Murder"),
    (["hurt", "beat", "assault", "hit", "injured", "attacked"],       "BNS 115", "Voluntarily causing grievous hurt"),
    (["stole", "theft", "stolen", "rob", "robbery", "snatched"],      "BNS 303", "Theft"),
    (["threaten", "threat", "intimidat"],                              "BNS 351", "Criminal intimidation"),
    (["trespass", "broke in", "entered forcibly"],                    "BNS 329", "Criminal trespass"),
    (["molest", "outrage", "modesty", "groped"],                      "BNS 74",  "Assault to outrage modesty"),
    (["rape", "sexually assaulted"],                                   "BNS 64",  "Rape"),
    (["cheat", "fraud", "deceived", "false"],                         "BNS 318", "Cheating"),
    (["extort", "ransom", "blackmail"],                                "BNS 308", "Extortion"),
    (["dacoity", "gang robbery", "armed gang"],                        "BNS 191", "Dacoity"),
    (["breach of trust", "misappropriat", "embezzl"],                 "BNS 316", "Criminal breach of trust"),
    (["defam", "slander", "libel"],                                    "BNS 356", "Defamation"),
    (["counterfeit", "fake currency", "forged note"],                 "BNS 238", "Counterfeiting currency"),
    (["sexual harassment", "unwanted touch", "stalking", "eve teas"], "BNS 75",  "Sexual harassment"),
    (["criminal force", "restrain", "wrongful confinement"],          "BNS 140", "Assault or criminal force to deter public servant"),
]

_GAP_ELEMENTS: list[tuple[str, list[str], str]] = [
    ("Date and time of incident",
     ["pm", "am", "morning", "night", "around", "o'clock", "at", "evening", "afternoon"],
     "Witness must state when exactly the incident occurred."),
    ("Place of incident",
     ["near", "at", "street", "village", "station", "building", "road"],
     "Specify where the incident took place."),
    ("Identity of accused",
     ["he", "she", "man", "person", "suspect", "accused", "name"],
     "Full name, physical description, or known address of accused is needed."),
    ("Identity of complainant",
     ["i", "my", "me", "complainant"],
     "Complainant's name and contact must be stated."),
    ("Motive or reason",
     ["because", "motive", "reason", "dispute", "argument", "quarrel"],
     "State the apparent motive or prior dispute if known."),
    ("Sequence of events",
     ["first", "then", "after", "before", "next", "subsequently"],
     "A step-by-step chronological account is required."),
    ("Witnesses present",
     ["witness", "bystander", "neighbour", "neighbor", "saw", "seen"],
     "Names and contact details of bystanders or witnesses."),
    ("Physical evidence",
     ["weapon", "knife", "gun", "evidence", "blood", "mark", "injury"],
     "Describe any physical evidence or injuries observed."),
    ("Injuries or harm suffered",
     ["hurt", "injured", "wound", "bleed", "pain", "fracture", "bruise"],
     "Describe nature and extent of injuries, supported by medical report if any."),
    ("Applicable law / offence type",
     ["theft", "assault", "murder", "robbery", "rape", "fraud", "extortion", "trespass"],
     "Specify the nature of the crime to identify applicable BNS sections."),
]

_BNS_CONTEXT = """
Key Bharatiya Nyaya Sanhita (BNS) 2023 sections for reference:
- BNS 64:  Rape
- BNS 74:  Assault or use of criminal force on woman with intent to outrage modesty
- BNS 75:  Sexual harassment
- BNS 103: Murder
- BNS 105: Culpable homicide not amounting to murder
- BNS 109: Abetment of suicide
- BNS 115: Voluntarily causing grievous hurt
- BNS 118: Causing hurt by dangerous weapons
- BNS 140: Assault or criminal force to deter public servant
- BNS 191: Dacoity
- BNS 238: Counterfeiting currency
- BNS 303: Theft
- BNS 308: Extortion
- BNS 310: Robbery
- BNS 316: Criminal breach of trust
- BNS 318: Cheating
- BNS 324: Mischief causing damage
- BNS 329: Criminal trespass
- BNS 351: Criminal intimidation
- BNS 356: Defamation
""".strip()


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _strip_json_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


async def _gemini_call(prompt: str, feature: str = "default", timeout: Optional[float] = None, _max_retries: int = 3) -> str:
    effective_timeout = timeout if timeout is not None else GEMINI_TIMEOUT_DEFAULT
    client = _get_client(feature)
    if not client:
        raise ValueError("No usable API Key configuration found")

    last_exc = None
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
            last_exc = exc
            err_str = str(exc)
            # Retry on 429 RESOURCE_EXHAUSTED (rate limit) errors
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                if attempt < _max_retries:
                    # Try a different client key on retry if available
                    alt_features = [f for f in _gemini_clients if f != feature]
                    if alt_features and attempt > 0:
                        alt_feature = alt_features[attempt % len(alt_features)]
                        alt_client = _get_client(alt_feature)
                        if alt_client:
                            client = alt_client
                            logger.info("[_gemini_call] Switching to '%s' key for retry %d", alt_feature, attempt + 1)

                    wait_secs = 10 * (2 ** attempt)  # 10s, 20s, 40s
                    logger.warning("[_gemini_call] 429 rate-limited (attempt %d/%d). Retrying in %ds…",
                                   attempt + 1, _max_retries + 1, wait_secs)
                    await asyncio.sleep(wait_secs)
                    continue
            # Non-retryable error — raise immediately
            raise

    # All retries exhausted
    raise last_exc


# ─────────────────────────────────────────────────────────────────────────────
# Fragment / transcript utilities
# ─────────────────────────────────────────────────────────────────────────────

def extract_insight_text(transcript: str) -> str:
    """Strips common conversational filler to return a punchy insight fragment."""
    text = transcript.strip()
    text_lower = text.lower()
    for filler in _FILLER_PREFIXES:
        if text_lower.startswith(filler):
            text = text[len(filler):].strip()
            text_lower = text.lower()
            break
    return (text[0].upper() + text[1:]) if text else transcript


def _heuristic_cluster(sentence: str) -> str:
    low = sentence.lower()
    for cluster, keywords in _CLUSTER_KEYWORDS:
        if any(kw in low for kw in keywords):
            return cluster
    return CLUSTER_EVENT


async def split_into_fragments(transcript: str) -> list:
    """Split a transcript into categorised forensic fragments via Gemini or heuristic fallback."""
    if _gemini_available():
        try:
            prompt = f"""
You are an expert forensic intelligence analyst. Extract ONLY the most critical, highly specific
facts, entities, timestamps, and sensory details from the following victim/witness transcript.
DO NOT summarise broadly, and DO NOT extract vague or trivial statements.
Only extract ACTIONABLE forensically valuable evidence.

CRITICAL FORMATTING INSTRUCTION:
Do NOT write full sentences! Extract as EXTREMELY CONCISE short phrases (2–6 words maximum).
Example: "Suspect wore black jacket" not "The suspect was wearing a black jacket".

Assign each fact to EXACTLY ONE cluster from this fixed list:
{CLUSTER_APPEARANCE}, {CLUSTER_SENSORY}, {CLUSTER_LOCATION}, {CLUSTER_WITNESS}, {CLUSTER_TIMELINE}, {CLUSTER_EVENT}

Cluster definitions:
- {CLUSTER_APPEARANCE}: clothing, physical traits, vehicle/object descriptions
- {CLUSTER_SENSORY}: smells, sounds, lighting, textures
- {CLUSTER_LOCATION}: places, directions, relative positions
- {CLUSTER_WITNESS}: names, identities, people mentioned, suspect actions
- {CLUSTER_TIMELINE}: exact times, sequence, duration
- {CLUSTER_EVENT}: main inciting incidents, crime actions

Respond ONLY with a valid JSON array of objects with "content" and "cluster" keys.
Discard irrelevant chatter. Return only forensically valuable facts.

Transcript: {transcript}
"""
            text = await _gemini_call(prompt, feature="map")
            return json.loads(_strip_json_fences(text))
        except Exception as exc:
            logger.warning("[split_into_fragments] Gemini failed: %s — using heuristic fallback.", exc)

    sentences = re.split(r'(?<=[.!?])\s+| and | then | but ', transcript)
    fragments = []
    for sentence in sentences:
        sentence = sentence.strip()
        if len(sentence) < 5:
            continue
        fragments.append({
            "content": extract_insight_text(sentence),
            "cluster": _heuristic_cluster(sentence),
        })
    if not fragments and transcript.strip():
        fragments.append({"content": extract_insight_text(transcript), "cluster": CLUSTER_EVENT})
    return fragments


def check_clashes(transcript: str, existing_fragments: list) -> list:
    clashes = []
    low = transcript.lower()
    if "car" in low:
        if "red" in low:
            for frag in existing_fragments:
                if "blue car" in frag.get("content", "").lower():
                    clashes.append(
                        f"Clash detected: You mentioned a 'red car', "
                        f"but previously '{frag['content']}' was recorded."
                    )
        elif "blue" in low:
            for frag in existing_fragments:
                if "red car" in frag.get("content", "").lower():
                    clashes.append(
                        f"Clash detected: You mentioned a 'blue car', "
                        f"but previously '{frag['content']}' was recorded."
                    )
    return clashes


def check_evidence(transcript: str, evidence_list: list) -> list:
    low = transcript.lower()
    return [
        {"evidence_id": str(ev["_id"]), "name": ev["name"]}
        for ev in evidence_list
        if ev["name"].lower() in low
    ]


async def check_contradiction_gemini(new_statement: str, past_statements: list) -> dict:
    if _gemini_available():
        try:
            past_text = (
                "\n".join(f"- {s}" for s in past_statements)
                if past_statements
                else "No previous statements yet."
            )
            prompt = f"""You are a careful forensic interview assistant. A witness/victim is giving testimony.

Past statements:
{past_text}

New statement: "{new_statement}"

Tasks:
1. Check if the NEW statement contradicts any previous statement (conflicting descriptions, times, locations).
2. Check if the NEW statement contradicts itself internally.
3. EXCEPTION: If the witness is explicitly correcting or clarifying a previous mistake, do NOT flag it.
4. If a real unacknowledged contradiction exists, respond with EXACTLY this JSON:
{{
  "has_contradiction": true,
  "contradiction_detail": "<brief factual description of the conflict>. Could you clarify?",
  "reply": "Hold on — I noticed something. You mentioned [X], but you also said [Y]. Can you clarify which one is correct?"
}}
5. Otherwise respond with EXACTLY:
{{
  "has_contradiction": false,
  "contradiction_detail": null,
  "reply": "{FALLBACK_CHAT_REPLY}"
}}

IMPORTANT: Respond ONLY with valid JSON. No markdown, no extra text."""
            text = await _gemini_call(prompt, feature="chat")
            return json.loads(_strip_json_fences(text))
        except Exception as exc:
            logger.warning("[check_contradiction_gemini] Failed: %s", exc)

    return {
        "has_contradiction": False,
        "contradiction_detail": None,
        "reply": FALLBACK_CHAT_REPLY,
    }


async def synthesize_and_fragment_testimony(messages: list[dict]) -> list[dict]:
    """
    Reads the FULL chat history, resolves contradictions (keeping corrected values),
    and outputs clean formal facts ready for the Cognitive Map.
    """
    if not messages or not _gemini_available():
        return []

    transcript = ""
    for m in messages:
        role = "Investigator" if m["role"] == "assistant" else "Witness"
        transcript += f"{role}: {m.get('content', '')}\n"

    prompt = f"""You are an expert forensic intelligence analyst.
Below is a raw interview transcript between an Investigator and a Witness.
The witness makes some mistakes, contradicts themselves, and later corrects them.

Your task is to extract the FINAL, CORRECTED, and CONSOLIDATED facts.
- DISCARD any corrected mistakes (e.g. if they say 9:20 then correct it to 9:30, extract ONLY 9:30).
- DISCARD all conversational filler, apologies, and investigator questions.
- REWORD the final facts into highly specific, formal legal language 
  (e.g. "Witness observed a female victim wearing a red dress").
- Keep facts sharp — 5-10 words maximum per fact.

Assign each fact to EXACTLY ONE cluster: {CLUSTER_APPEARANCE}, {CLUSTER_SENSORY}, {CLUSTER_LOCATION}, {CLUSTER_WITNESS}, {CLUSTER_TIMELINE}, {CLUSTER_EVENT}.

Return ONLY a valid JSON array of objects with "content" and "cluster" keys.
Transcript:
{transcript}
"""
    try:
        text = await _gemini_call(prompt, feature="chat")
        return json.loads(_strip_json_fences(text))
    except Exception as exc:
        logger.warning("[synthesize_and_fragment_testimony] Failed: %s", exc)
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Graph
# ─────────────────────────────────────────────────────────────────────────────

def get_fragments_hash(fragments: list[dict]) -> str:
    if not fragments:
        return "empty"
    combined = "".join(sorted([f"{f.get('id', '')}:{f.get('content', '')}" for f in fragments]))
    return hashlib.md5(combined.encode("utf-8")).hexdigest()


async def extract_graph_edges(fragments: list[dict]) -> list[dict]:
    """Uses Gemini to identify logical relationships between memory fragments."""
    if not fragments or not _gemini_available():
        return []

    fragment_list = "\n".join([
        f"ID: {f.get('id')} | Content: {f.get('content')}" for f in fragments
    ])
    prompt = f"""You are a forensic data mapper. Given these testimony fragments, identify logical relationships (edges) between them.
Return ONLY a JSON array of objects with keys: "from" (ID string), "to" (ID string), "label" (short relationship text like 'witnessed by', 'located at', 'occurred at').
Fragments:
{fragment_list}
"""
    try:
        text = await _gemini_call(prompt, feature="map")
        return json.loads(_strip_json_fences(text))
    except Exception as exc:
        logger.warning("[extract_graph_edges] Failed: %s", exc)
        return []


async def generate_entity_graph(fragments: list[dict]) -> dict:
    """Creates a true Entity-Relationship Knowledge Graph from fragments."""
    if not fragments or not _gemini_available():
        return {"nodes": [], "edges": []}

    context = "\n".join([f"- {f.get('content', '')}" for f in fragments])
    prompt = f"""You are a forensic graph mapper. Convert these testimony facts into a Knowledge Graph.
Nodes must be specific entities (people, places, objects, specific times), NOT long sentences.
Labels should be 1-3 words max (e.g., "Red Dress", "9:30 PM", "Thick Beard").

Return EXACTLY this JSON structure:
{{
  "nodes": [
    {{ "id": "n1", "label": "Short Name", "type": "event" | "person" | "location" | "evidence" | "time" }}
  ],
  "edges": [
    {{ "from": "n1", "to": "n2", "label": "relationship (e.g., 'occurred at', 'wore')" }}
  ]
}}

Testimony Facts:
{context}
"""
    try:
        text = await _gemini_call(prompt, feature="map")
        graph_data = json.loads(_strip_json_fences(text))
        for node in graph_data.get("nodes", []):
            node["x"] = random.randint(15, 85)
            node["y"] = random.randint(15, 85)
        return graph_data
    except Exception as exc:
        logger.warning("[generate_entity_graph] Failed: %s", exc)
        return {"nodes": [], "edges": []}


# ─────────────────────────────────────────────────────────────────────────────
# Claw Legal Integration
# ─────────────────────────────────────────────────────────────────────────────

async def map_to_bns_sections(fragments: list[dict]) -> dict:
    """(Claw LegalGPT) Maps testimony fragments to BNS 2023 sections and provides detailed analysis."""
    if not fragments:
        return {"bns_sections": [], "cleaned_testimony": "", "detailed_analysis": "", "error": "No fragments to analyse."}

    combined = "\n".join(f"- {f.get('content', '')}" for f in fragments)

    if _gemini_available():
        try:
            # ✨ CHANGE 1: Upgraded Prompt to request 'detailed_analysis' with Markdown
            prompt = f"""You are an expert in Indian criminal law specialising in the Bharatiya Nyaya Sanhita (BNS) 2023.

{_BNS_CONTEXT}

Given these witness/victim testimony fragments from a forensic case:
{combined}

Do three things:

1. Write a CLEANED TESTIMONY: a concise, formal legal summary (2–4 sentences) removing all informal speech,
   filler phrases, and repetition while preserving every factual detail.

2. Identify all APPLICABLE BNS SECTIONS based on the facts described. For each section include:
   - section: "BNS 103"
   - title: section name
   - relevance: one sentence explaining which specific fact triggers this section
   - confidence: "high" | "medium" | "low"

3. Write a 'detailed_analysis': A comprehensive legal analysis of the entire testimony. Explain exactly WHY these BNS sections apply, the severity of the charges, and what evidence supports them. 
   **CRITICAL FORMATTING:** You MUST use Markdown formatting in this field. Use **double asterisks** to bold key legal terms and BNS sections (e.g., **BNS 103**). Use line breaks for readability.

Return ONLY valid JSON, no markdown outside the JSON block:
{{
  "cleaned_testimony": "...",
  "bns_sections": [
    {{
      "section": "BNS 103",
      "title": "Murder",
      "relevance": "Witness describes suspect striking victim with lethal force.",
      "confidence": "high"
    }}
  ],
  "detailed_analysis": "Based on the testimony, the primary offense mapped is **BNS 103 (Murder)**.\\n\\nThis applies because..."
}}"""
            text = await _gemini_call(prompt, feature="insights")
            return json.loads(_strip_json_fences(text))
        except Exception as exc:
            logger.warning("[map_to_bns_sections] Gemini failed: %s — keyword fallback.", exc)

    all_text = combined.lower()
    sections = []
    for keywords, section_id, title in _BNS_KEYWORD_MAP:
        if any(kw in all_text for kw in keywords):
            sections.append({
                "section": section_id, "title": title,
                "relevance": "Detected via keyword match.", "confidence": "low",
            })
            
    # ✨ CHANGE 2: Added 'detailed_analysis' to the fallback response
    return {
        "cleaned_testimony": " ".join(f.get("content", "") for f in fragments),
        "bns_sections": sections,
        "detailed_analysis": "Detailed analysis requires AI generation. Displaying basic keyword-matched sections instead.",
    }


async def detect_legal_gaps(fragments: list[dict]) -> dict:
    """(Claw ATG + AI) Audits case fragments for missing legal elements."""
    if not fragments:
        return {"gaps": [], "completeness_score": 0, "priority_gaps": [], "error": "No fragments."}

    combined = "\n".join(f"- {f.get('content', '')} (Evidence Attached: {'Yes' if f.get('has_evidence', False) else 'No'})" for f in fragments)
    example_gaps = "\n    ".join(
        f'{{"element": "{el}", "status": "missing", "suggestion": "{hint}"}}'
        for el, _, hint in _GAP_ELEMENTS
    )

    if _gemini_available():
        try:
            prompt = f"""You are a forensic legal analyst expert in Indian criminal procedure.

Analyse these case testimony fragments. Each fragment indicates if physical evidence is attached:
{combined}

Check for the presence, partial presence, or absence of each of the following critical legal elements.
Additionally, if a fragment mentions a physical object, document, or injury, but 'Evidence Attached' is 'No', you MUST flag that as a missing or partial gap.
For each element set status to "present", "partial", or "missing", and provide a concrete suggestion
for missing/partial ones (empty string for present).

Elements to check: {", ".join(el for el, _, _ in _GAP_ELEMENTS)}

Return ONLY valid JSON, no markdown:
{{
  "gaps": [
    {example_gaps}
  ],
  "completeness_score": <integer 0-100>,
  "priority_gaps": ["<top missing element 1>", "<top missing element 2>", "<top missing element 3>"]
}}"""
            text = await _gemini_call(prompt, feature="insights")
            result = json.loads(_strip_json_fences(text))
            result["completeness_score"] = max(0, min(100, int(result.get("completeness_score", 0))))
            return result
        except Exception as exc:
            logger.warning("[detect_legal_gaps] Gemini failed: %s — heuristic fallback.", exc)

    all_text = combined.lower()
    gaps = []
    present_count = 0
    priority_gaps = []
    for element, keywords, suggestion in _GAP_ELEMENTS:
        status = "present" if any(kw in all_text for kw in keywords) else "missing"
        if status == "present":
            present_count += 1
        else:
            priority_gaps.append(element)
        gaps.append({"element": element, "status": status,
                     "suggestion": "" if status == "present" else suggestion})
    score = int((present_count / len(_GAP_ELEMENTS)) * 100)
    return {"gaps": gaps, "completeness_score": score, "priority_gaps": priority_gaps[:3]}


async def generate_legal_draft(
    fragments: list[dict],
    case_name: str,
    draft_type: str = "FIR",
    bns_sections: Optional[list[dict]] = None,
) -> dict:
    """(Claw Adira AI) Generates a formal Indian legal document from testimony fragments."""
    if not fragments:
        return {"draft_type": draft_type, "case_name": case_name,
                "sections": [], "error": "No fragments available."}

    combined = "\n".join(f"- {f.get('content', '')}" for f in fragments)
    sections_hint = ""
    if bns_sections:
        sections_hint = "Applicable BNS sections already identified: " + ", ".join(
            f"{s['section']} ({s['title']})" for s in bns_sections
        )

    if _gemini_available():
        try:
            prompt = f"""You are an expert Indian legal drafter specialising in criminal law under BNS 2023.

Generate a formal {draft_type} document for the following case.

Case Name: {case_name}
{sections_hint}

Testimony Facts:
{combined}

Generate a complete, court-ready {draft_type} in the standard Indian format.
Use formal legal language. Insert [PLACEHOLDER] for any details that are missing but legally required.

Return ONLY valid JSON, no markdown:
{{
  "draft_type": "{draft_type}",
  "case_name": "{case_name}",
  "sections": [
    {{"heading": "Before the Officer-in-Charge / Court",  "content": "..."}},
    {{"heading": "Complainant Details",                    "content": "..."}},
    {{"heading": "Date, Time and Place of Incident",       "content": "..."}},
    {{"heading": "Facts of the Case",                      "content": "..."}},
    {{"heading": "Applicable Provisions (BNS 2023)",       "content": "..."}},
    {{"heading": "Relief / Prayer Sought",                 "content": "..."}},
    {{"heading": "Declaration",                            "content": "..."}}
  ],
  "disclaimer": "{LEGAL_DRAFT_DISCLAIMER}"
}}"""
            text = await _gemini_call(prompt, feature="docs", timeout=GEMINI_TIMEOUT_DRAFT)
            result = json.loads(_strip_json_fences(text))
            if not result.get("disclaimer"):
                result["disclaimer"] = LEGAL_DRAFT_DISCLAIMER
            return result
        except Exception as exc:
            logger.warning("[generate_legal_draft] Gemini failed: %s — static fallback.", exc)

    return {
        "draft_type": draft_type,
        "case_name":  case_name,
        "sections": [
            {"heading": "Complainant Details",         "content": "[PLACEHOLDER]"},
            {"heading": "Date, Time and Place",        "content": "[PLACEHOLDER]"},
            {"heading": "Facts of the Case",           "content": combined},
            {"heading": "Applicable Provisions (BNS)", "content": "[PLACEHOLDER]"},
            {"heading": "Relief / Prayer Sought",      "content": "[PLACEHOLDER]"},
            {"heading": "Declaration",                 "content": "The above information is true to the best of my knowledge and belief."},
        ],
        "disclaimer": LEGAL_DRAFT_DISCLAIMER,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Claw Judgment Search — scrapes clawlaw.in/judgment and analyses matches
# ─────────────────────────────────────────────────────────────────────────────

async def _fetch_clawlaw_cases(query: str) -> list[dict]:
    """
    Hits the Claw Law judgment search endpoint and returns raw case results.
    Falls back to an empty list on any network / parse failure.
    The Claw Law search API returns results at:
      https://clawlaw.in/judgment?q=<query>   (HTML page with embedded JSON)
    We use their public search API endpoint if available, else scrape the page.
    """
    if _httpx is None:
        logger.warning("[_fetch_clawlaw_cases] httpx not installed — cannot fetch from clawlaw.in")
        return []

    # Claw Law exposes a JSON search endpoint at /api/search/judgments
    api_url = "https://clawlaw.in/api/search/judgments"
    params = {"q": query, "limit": 10}

    try:
        async with _httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(api_url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                # Normalise: Claw Law returns { results: [...] } or a top-level array
                if isinstance(data, list):
                    return data
                return data.get("results", data.get("data", []))
    except Exception as exc:
        logger.warning("[_fetch_clawlaw_cases] API call failed (%s) — trying page scrape.", exc)

    # Fallback: scrape the HTML page and extract embedded __NEXT_DATA__ JSON
    try:
        page_url = f"{CLAWLAW_JUDGMENT_URL}?q={query}"
        async with _httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(page_url)
        if resp.status_code != 200:
            return []
        html = resp.text
        # Next.js apps embed data in <script id="__NEXT_DATA__">
        match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
        if not match:
            return []
        next_data = json.loads(match.group(1))
        # Traverse the Next.js page props to find the cases list
        page_props = next_data.get("props", {}).get("pageProps", {})
        cases = (
            page_props.get("judgments")
            or page_props.get("cases")
            or page_props.get("results")
            or []
        )
        return cases
    except Exception as exc:
        logger.warning("[_fetch_clawlaw_cases] Scrape also failed: %s", exc)
        return []


async def search_precedent_cases(fragments: list[dict], bns_sections: list[dict]) -> list[dict]:
    """
    1. Builds a smart search query from the case fragments + BNS sections.
    2. Fetches real cases from clawlaw.in/judgment.
    3. Uses Gemini to pick the best matching cases, explain WHY each matches,
       and score them against our case.
    Falls back to Gemini-generated fictional precedents if the live search fails.
    """
    if not fragments:
        return []

    context = " ".join([f.get("content", "") for f in fragments])
    bns_str = ", ".join([s.get("section", "") for s in (bns_sections or [])])

    # ── Step 1: build search query ─────────────────────────────────────────
    search_query = context[:120]   # keep it short for URL
    if bns_str:
        search_query = f"{bns_str} {search_query}"

    # ── Step 2: fetch from Claw Law ────────────────────────────────────────
    raw_cases = await _fetch_clawlaw_cases(search_query)

    # ── Step 3: Gemini analysis ────────────────────────────────────────────
    if raw_cases and _gemini_available():
        try:
            cases_json = json.dumps(raw_cases[:15], ensure_ascii=False)
            prompt = f"""You are a senior Indian legal analyst.

Our Case Summary: "{context}"
Applicable BNS Sections: {bns_str}

Below are judgment cases retrieved from Claw Law database:
{cases_json}

Your task:
1. Select the TOP 5 most relevant cases that factually match our case.
2. For each selected case, add a "matchAnalysis" field — a 2-3 sentence explanation of:
   - Which specific facts / BNS sections match
   - How the outcome of that case is relevant to ours
   - An overall match percentage (0–100) in the "relevance" field
3. Preserve ALL original fields of each case object, just add "matchAnalysis" and set "relevance".

Return ONLY a valid JSON array of the top 5 case objects. No markdown."""
            text = await _gemini_call(prompt, feature="insights", timeout=45)
            analysed = json.loads(_strip_json_fences(text))
            return analysed
        except Exception as exc:
            logger.warning("[search_precedent_cases] Gemini analysis failed: %s", exc)
            # Return the raw cases without analysis
            return raw_cases[:5]

    # ── Fallback: Gemini generates fictional but realistic precedents ──────
    if not _gemini_available():
        return []

    try:
        prompt = f"""You are an Indian Legal Search Engine. Based on this case summary: "{context}"
and BNS sections: "{bns_str}",
generate 5 fictional but highly realistic Indian case precedents (from High Courts or Supreme Court)
that closely match this scenario.

Return ONLY a JSON array matching this structure exactly:
[
  {{
    "id": "<random_id>",
    "title": "State v. [Name]",
    "court": "[State] High Court",
    "year": "2023",
    "sections": ["BNS Section ..."],
    "relevance": <integer 70-98>,
    "outcome": "conviction" | "acquittal" | "settlement",
    "summary": "<2 sentence summary>",
    "location": "<City>",
    "keyFactors": ["<Factor 1>", "<Factor 2>", "<Factor 3>"],
    "matchAnalysis": "<2 sentences explaining why this case matches ours and what we can learn from it>"
  }}
]"""
        text = await _gemini_call(prompt, feature="insights", timeout=45)
        return json.loads(_strip_json_fences(text))
    except Exception as exc:
        logger.warning("[search_precedent_cases] Fallback also failed: %s", exc)
        return []


async def generate_case_match_summary(
    our_case_context: str, matched_cases: list[dict]
) -> str:
    """
    Uses Gemini to write an overall legal strategy paragraph based on the matched precedents.
    """
    if not matched_cases or not _gemini_available():
        return ""

    cases_text = "\n".join(
        f"- {c.get('title', 'Unknown')} ({c.get('year', '')}, {c.get('court', '')}): "
        f"{c.get('summary', '')} — Outcome: {c.get('outcome', 'unknown')}"
        for c in matched_cases[:5]
    )
    prompt = f"""You are a senior Indian criminal lawyer.

Our Case: "{our_case_context}"

Matched Precedents:
{cases_text}

Write a concise 3-4 sentence legal strategy summary that:
1. States which precedents are most favourable and why
2. Highlights the strongest legal argument supported by these cases
3. Notes any risks based on unfavourable outcomes in similar cases

Write in formal legal English. No bullet points."""
    try:
        return await _gemini_call(prompt, feature="insights", timeout=30)
    except Exception as exc:
        logger.warning("[generate_case_match_summary] Failed: %s", exc)
        return ""


# ─────────────────────────────────────────────────────────────────────────────
# Graph-aware document generation
# ─────────────────────────────────────────────────────────────────────────────

async def generate_document_from_graph(
    fragments: list[dict],
    graph_data: dict,
    case_name: str,
    draft_type: str = "FIR",
    bns_sections: Optional[list[dict]] = None,
) -> dict:
    """
    Generates a legal document using BOTH raw fragments AND the entity-relationship
    graph for richer, more structured output. Falls back to generate_legal_draft
    if Gemini fails or graph is empty.
    """
    if not fragments:
        return {"draft_type": draft_type, "case_name": case_name,
                "sections": [], "error": "No fragments available."}

    combined = "\n".join(f"- {f.get('content', '')}" for f in fragments)

    # Build graph context string
    graph_context = ""
    nodes = graph_data.get("nodes", [])
    edges = graph_data.get("edges", [])
    if nodes:
        node_map = {n.get("id", ""): n.get("label", "") for n in nodes}
        graph_context += "Entity Graph Nodes:\n"
        for n in nodes:
            graph_context += f"  - {n.get('label', 'Unknown')} (type: {n.get('type', 'unknown')})\n"
        if edges:
            graph_context += "\nEntity Relationships:\n"
            for e in edges:
                src = node_map.get(e.get("from", ""), e.get("from", ""))
                tgt = node_map.get(e.get("to", ""), e.get("to", ""))
                graph_context += f"  - {src} --[{e.get('label', 'related')}]--> {tgt}\n"

    sections_hint = ""
    if bns_sections:
        sections_hint = "Applicable BNS sections already identified: " + ", ".join(
            f"{s['section']} ({s['title']})" for s in bns_sections
        )

    if _gemini_available() and graph_context:
        try:
            prompt = f"""You are an expert Indian legal drafter specialising in criminal law under BNS 2023.

Generate a formal {draft_type} document for the following case.

Case Name: {case_name}
{sections_hint}

Testimony Facts:
{combined}

Entity-Relationship Graph (extracted from testimony):
{graph_context}

INSTRUCTIONS:
1. Use the entity graph to identify ALL key persons, locations, times, and evidence.
2. Cross-reference graph relationships with testimony facts for a complete narrative.
3. Generate a complete, court-ready {draft_type} in the standard Indian format.
4. Use formal legal language throughout.
5. Insert [PLACEHOLDER] for any details that are missing but legally required.
6. Ensure every entity from the graph is referenced where relevant in the document.

Return ONLY valid JSON, no markdown:
{{
  "draft_type": "{draft_type}",
  "case_name": "{case_name}",
  "sections": [
    {{"heading": "Before the Officer-in-Charge / Court",  "content": "..."}},
    {{"heading": "Complainant Details",                    "content": "..."}},
    {{"heading": "Date, Time and Place of Incident",       "content": "..."}},
    {{"heading": "Facts of the Case",                      "content": "..."}},
    {{"heading": "Accused / Suspect Details",              "content": "..."}},
    {{"heading": "Witnesses",                              "content": "..."}},
    {{"heading": "Physical Evidence",                      "content": "..."}},
    {{"heading": "Applicable Provisions (BNS 2023)",       "content": "..."}},
    {{"heading": "Relief / Prayer Sought",                 "content": "..."}},
    {{"heading": "Declaration",                            "content": "..."}}
  ],
  "disclaimer": "{LEGAL_DRAFT_DISCLAIMER}"
}}"""
            text = await _gemini_call(prompt, feature="docs", timeout=GEMINI_TIMEOUT_DRAFT)
            result = json.loads(_strip_json_fences(text))
            if not result.get("disclaimer"):
                result["disclaimer"] = LEGAL_DRAFT_DISCLAIMER
            return result
        except Exception as exc:
            logger.warning("[generate_document_from_graph] Gemini failed: %s — falling back.", exc)

    # Fallback to standard draft generation
    return await generate_legal_draft(
        fragments=fragments,
        case_name=case_name,
        draft_type=draft_type,
        bns_sections=bns_sections,
    )