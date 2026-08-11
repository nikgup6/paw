from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, List
from datetime import datetime
from enum import Enum
import uuid

from app.models.vaccination import ProcessingStatus, utc_now


class DocumentType(str, Enum):
    """Kinds of medical document the Health Vault can hold. Only VACCINATION is
    processed today; the rest are accepted, stored, and left for future
    processors (see services/ai_processing/registry.py)."""
    VACCINATION = "vaccination"
    PRESCRIPTION = "prescription"
    BLOOD_TEST = "blood_test"
    XRAY = "xray"
    LAB_REPORT = "lab_report"
    OTHER = "other"


class AIMetadata(BaseModel):
    """Provenance of an AI processing run, stored on every processed document."""
    ai_provider: Optional[str] = None       # gemini | openai | anthropic
    ai_model: Optional[str] = None
    ai_version: Optional[str] = None         # SDK / API version
    prompt_version: Optional[str] = None
    processing_job_id: Optional[str] = None
    processed_at: Optional[datetime] = None
    last_error: Optional[str] = None


class HealthDocument(BaseModel):
    """One medical document in the Health Vault: the original file (on Cloudinary),
    its metadata, the AI extraction results, a short summary, and status. This is
    the generalized store that supersedes the legacy `vaccination_documents`."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dog_id: str
    document_type: DocumentType = DocumentType.VACCINATION

    # Cloudinary (the permanently-kept original)
    cloudinary_url: str
    cloudinary_public_id: Optional[str] = None
    cloudinary_resource_type: Optional[str] = "image"

    # File metadata
    original_filename: str
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    uploaded_at: datetime = Field(default_factory=utc_now)

    # Processing
    processing_status: ProcessingStatus = ProcessingStatus.PENDING
    ai_extraction: Optional[Dict[str, Any]] = None    # structured JSON (never the raw model text)
    ai_summary: Optional[str] = None                  # short human-readable summary
    confidence_score: Optional[float] = None
    ai_metadata: Optional[AIMetadata] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = {"use_enum_values": True, "validate_default": True}
