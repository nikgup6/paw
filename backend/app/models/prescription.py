from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid

from app.models.vaccination import utc_now


class Medicine(BaseModel):
    """One line off a prescription. Everything is optional because vets write
    what they write — a name with no duration is still worth keeping."""
    name: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    notes: Optional[str] = None


class Prescription(BaseModel):
    """A prescription read off an uploaded document. Stored one row per
    prescription in the `prescriptions` collection, always scoped to a dog."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dog_id: str
    source_document_id: str
    doctor: Optional[str] = None
    clinic_name: Optional[str] = None
    prescribed_date: Optional[str] = None      # ISO YYYY-MM-DD
    diagnosis: Optional[str] = None
    medicines: List[Medicine] = Field(default_factory=list)
    summary: Optional[str] = None
    confidence_score: Optional[float] = None
    needs_review: bool = False
    created_at: datetime = Field(default_factory=utc_now)
