from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

from app.models.vaccination import utc_now


class Reminder(BaseModel):
    """A vaccination reminder, generated from a confirmed vaccination's due date.
    Status (Due Today / Overdue / Upcoming) is derived from `due_date` vs the
    current date at read time — see services/health_status.py."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dog_id: str
    vaccination_id: str
    source_document_id: Optional[str] = None
    vaccine_name: Optional[str] = None
    due_date: str                      # ISO YYYY-MM-DD
    created_at: datetime = Field(default_factory=utc_now)
