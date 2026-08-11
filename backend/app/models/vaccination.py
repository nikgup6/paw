from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
from enum import Enum
import uuid


def utc_now() -> datetime:
    """Timezone-aware UTC timestamp. Every stored instant uses this instead of
    the naive `datetime.utcnow()`, which serialises without an offset and is
    then misread by clients as local time."""
    return datetime.now(timezone.utc)


class ProcessingStatus(str, Enum):
    """Lifecycle of a document through the AI processing pipeline."""
    PENDING = "Pending"
    PROCESSING = "Processing"
    COMPLETED = "Completed"
    NEEDS_REVIEW = "Needs Review"   # AI unsure / data invalid — user must confirm
    FAILED = "Failed"


class VaccinationDocument(BaseModel):
    """Legacy vaccination-document shape, kept for backward compatibility. New
    uploads are stored as HealthDocument (see models/health_vault.py); this model
    remains so older code/tests referencing it still import cleanly."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dog_id: str
    cloudinary_url: str
    cloudinary_public_id: Optional[str] = None
    cloudinary_resource_type: Optional[str] = "image"
    original_filename: str
    upload_date: datetime = Field(default_factory=utc_now)
    processing_status: ProcessingStatus = ProcessingStatus.PENDING

    model_config = {"use_enum_values": True, "validate_default": True}


class StatusUpdate(BaseModel):
    """Payload for the PATCH status endpoint."""
    processing_status: ProcessingStatus


class Vaccination(BaseModel):
    """One structured vaccination — the single source of truth for the timeline.
    Stored one row per shot in the `vaccinations` collection."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dog_id: str
    source_document_id: str
    vaccine_name: Optional[str] = None
    administration_date: Optional[str] = None   # ISO YYYY-MM-DD
    due_date: Optional[str] = None              # ISO YYYY-MM-DD — the ONLY date that drives a reminder
    #: Shelf life printed on the vial. Recorded for provenance and never used in
    #: any schedule or reminder calculation — see vaccination_processor.
    product_expiry_date: Optional[str] = None   # ISO YYYY-MM-DD
    booster_interval: Optional[str] = None
    manufacturer: Optional[str] = None
    batch_number: Optional[str] = None
    veterinarian: Optional[str] = None
    clinic_name: Optional[str] = None
    confidence_score: Optional[float] = None
    confidence_notes: Optional[str] = None      # what the scanner found illegible or ambiguous
    needs_review: bool = False                  # True until the user confirms low-confidence data
    reviewed: bool = False                      # True once a human has confirmed/edited it
    created_at: datetime = Field(default_factory=utc_now)


class VaccinationEdit(BaseModel):
    """Fields a user may correct in the Needs-Review flow. All optional."""
    vaccine_name: Optional[str] = None
    administration_date: Optional[str] = None
    due_date: Optional[str] = None
    booster_interval: Optional[str] = None
    manufacturer: Optional[str] = None
    batch_number: Optional[str] = None
    veterinarian: Optional[str] = None
    clinic_name: Optional[str] = None
