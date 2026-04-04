"""
models.py — Pydantic schemas for all API request / response shapes.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


# ─────────────────────────────────────────────────────────────────────────────
# Core fragment / testimony / case models
# ─────────────────────────────────────────────────────────────────────────────

class Position(BaseModel):
    x: float
    y: float


class FragmentSchema(BaseModel):
    type: str = Field(..., description="voice | text | sensory")
    content: str
    timestamp: str
    cluster: Optional[str] = None
    position: Optional[Position] = Field(default_factory=lambda: Position(x=50, y=50))
    has_evidence: Optional[bool] = False


class TestimonySchema(BaseModel):
    title: str
    content: str
    date: str
    tags: Optional[List[str]] = []
    fragments: Optional[List[dict]] = []


# ── Case management ───────────────────────────────────────────────────────────

class CreateCaseRequest(BaseModel):
    title: str = Field(..., description="Human-readable case name")
    description: Optional[str] = None


class ArchiveRequest(BaseModel):
    title: str


class SaveMapRequest(BaseModel):
    testimony_id: Optional[str] = None
    title: str
    session_id: Optional[str] = None


# ── Voice / chat ──────────────────────────────────────────────────────────────

class VoiceProcessRequest(BaseModel):
    transcript: str
    case_id: Optional[str] = None
    language: Optional[str] = Field(default="en", description="Language code: en, hi, mr, ta, te, bn, kn, ml, gu, pa")


class EvidenceMention(BaseModel):
    evidence_id: str
    name: str


class VoiceProcessResponse(BaseModel):
    fragments: List[dict] = []
    clashes: List[str] = []
    evidence_matches: List[EvidenceMention] = []
    original_text: Optional[str] = None
    original_language: Optional[str] = None
    translated_text_en: Optional[str] = None


class ChatRequest(BaseModel):
    message: str = Field(..., description="Witness testimony message")
    case_id: Optional[str] = None
    language: Optional[str] = Field(default="en", description="Language code of the message")


class ChatResponse(BaseModel):
    reply: str
    has_contradiction: bool = False
    contradiction_detail: Optional[str] = None


class CreateClustersRequest(BaseModel):
    case_id: Optional[str] = None


# ── Claw Legal Integration ────────────────────────────────────────────────────

class GenerateDraftRequest(BaseModel):
    case_name: str
    draft_type: str = Field(
        default="FIR",
        description="FIR | Complaint | Affidavit | Bail Application",
    )
    case_id: Optional[str] = None


class BNSSection(BaseModel):
    section: str
    title: str
    relevance: str
    confidence: str   # "high" | "medium" | "low"


class BNSMapResponse(BaseModel):
    cleaned_testimony: str
    bns_sections: List[BNSSection]
    powered_by: Optional[str] = None
    fragment_count: Optional[int] = None


class GapItem(BaseModel):
    element: str
    status: str        # "present" | "partial" | "missing"
    suggestion: str


class GapDetectResponse(BaseModel):
    gaps: List[GapItem]
    completeness_score: int
    priority_gaps: List[str]
    powered_by: Optional[str] = None
    fragment_count: Optional[int] = None


class DraftSection(BaseModel):
    heading: str
    content: str


class LegalDraftResponse(BaseModel):
    draft_type: str
    case_name: str
    sections: List[DraftSection]
    disclaimer: str
    powered_by: Optional[str] = None
    generated_at: Optional[str] = None


class LegalAnalysisResponse(BaseModel):
    powered_by: str
    generated_at: str
    fragment_count: int
    bns_mapping: Dict[str, Any]
    gap_analysis: Dict[str, Any]
    legal_draft: Dict[str, Any]


# ── Precedent / case search (clawlaw integration) ─────────────────────────────

class PrecedentCase(BaseModel):
    id: str
    title: str
    court: str
    year: str
    sections: List[str]
    relevance: int            # 0-100
    outcome: str              # conviction | acquittal | settlement
    summary: str
    location: str
    keyFactors: List[str]
    matchAnalysis: Optional[str] = None   # Gemini's why-it-matches explanation


class CasePrecedentResponse(BaseModel):
    cases: List[PrecedentCase]
    overall_match_summary: Optional[str] = None
    powered_by: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Authentication models
# ─────────────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    phone: str = Field(..., description="Phone number (unique identifier)")
    password: str = Field(..., min_length=4, description="User password")
    name: Optional[str] = Field(None, description="Display name (optional, can be pseudonym)")


class LoginRequest(BaseModel):
    phone: str = Field(..., description="Phone number")
    password: str = Field(..., description="User password")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    id: str
    phone: str
    name: Optional[str] = None
    created_at: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Document models (graph-based generation + edit)
# ─────────────────────────────────────────────────────────────────────────────

class GenerateDocumentRequest(BaseModel):
    case_name: str
    draft_type: str = Field(
        default="FIR",
        description="FIR | Complaint | Affidavit | Bail Application",
    )


class UpdateDocumentRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[dict] = None
    status: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Media Upload models
# ─────────────────────────────────────────────────────────────────────────────

class MediaUploadResponse(BaseModel):
    id: str
    filename: str
    media_type: str  # "photo" | "video" | "audio" | "document"
    cloudinary_url: str
    cloudinary_public_id: str
    tags: List[str] = []
    size: int = 0
    mime_type: str = ""
    uploaded_at: str = ""
    linked_cluster_id: Optional[str] = None


class MediaUpdateTagsRequest(BaseModel):
    tags: List[str] = Field(..., description="List of evidence tags")


class MediaRenameRequest(BaseModel):
    filename: str = Field(..., description="New filename for the media item")


class ShareLinkRequest(BaseModel):
    recipient_name: Optional[str] = None
    recipient_type: str = Field(default="lawyer", description="lawyer | ngo")
    recipient_org: Optional[str] = None


class ShareLinkResponse(BaseModel):
    id: str
    case_id: str
    token: str
    share_url: str
    recipient_name: Optional[str] = None
    recipient_type: str = "lawyer"
    recipient_org: Optional[str] = None
    created_at: str = ""
    expires_at: str = ""
    status: str = "active"


# ─────────────────────────────────────────────────────────────────────────────
# Multilingual translation models
# ─────────────────────────────────────────────────────────────────────────────

class TranslateRequest(BaseModel):
    text: str = Field(..., description="Text to translate (should be English)")
    target_language: str = Field(..., description="Target language code: hi, ta, te, bn, kn, ml, gu, pa, mr, en")


class TranslateResponse(BaseModel):
    translated_text: str
    source_language: str = "en"
    target_language: str


# ─────────────────────────────────────────────────────────────────────────────
# Evidence ↔ Cluster linking models
# ─────────────────────────────────────────────────────────────────────────────

class LinkClusterRequest(BaseModel):
    cluster_id: str = Field(..., description="ID of the cluster/fragment to link")
    status: str = "active"