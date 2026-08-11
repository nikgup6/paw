from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

from app.models.vaccination import utc_now


class Deworming(BaseModel):
    """One deworming dose read off a health booklet.

    Kept apart from `Vaccination` because it is a different thing: a dewormer is
    a medicine given on a rolling cadence, with no vaccine family, no booster
    interval and no place in the vaccination schedule. Sharing a table with a
    type column would mean every vaccination query had to remember to exclude
    these, and one forgotten filter would put a dewormer on the timeline as a
    shot.

    `dose` carries the quantity written beside the date ("0.7ml", "1 tab") —
    which on an Indian booklet is often the only evidence the dose was actually
    given rather than merely scheduled."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dog_id: str
    source_document_id: str
    product_name: Optional[str] = None
    administration_date: Optional[str] = None   # ISO YYYY-MM-DD
    due_date: Optional[str] = None              # ISO YYYY-MM-DD
    dose: Optional[str] = None
    veterinarian: Optional[str] = None
    clinic_name: Optional[str] = None
    confidence_score: Optional[float] = None
    confidence_notes: Optional[str] = None
    needs_review: bool = False
    reviewed: bool = False
    created_at: datetime = Field(default_factory=utc_now)
