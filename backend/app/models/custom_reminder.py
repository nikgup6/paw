from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum
import uuid

from app.models.vaccination import utc_now


class ReminderCategory(str, Enum):
    """What a self-made reminder is about. Fixed list so the UI can colour and
    group them; "Other" is the escape hatch."""
    MEDICINE = "Medicine"
    VET_VISIT = "Vet Visit"
    GROOMING = "Grooming"
    BATH = "Bath"
    NAIL_TRIMMING = "Nail Trimming"
    FOOD = "Food"
    EXERCISE = "Exercise"
    OTHER = "Other"


class Recurrence(str, Enum):
    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class CustomReminderIn(BaseModel):
    """What the owner fills in. `due_time` is optional — plenty of reminders
    ("nail trimming") only need a day."""
    title: str
    category: ReminderCategory = ReminderCategory.OTHER
    due_date: str                                   # ISO YYYY-MM-DD
    due_time: Optional[str] = None                  # HH:MM, owner's local clock
    recurrence: Recurrence = Recurrence.NONE
    notes: Optional[str] = None


class CustomReminder(CustomReminderIn):
    """An owner-created reminder, always scoped to one dog.

    Completing a recurring reminder rolls `due_date` to the next occurrence and
    leaves it active; completing a one-off closes it. Status (Due Today /
    Overdue / Upcoming) is never stored — it is derived from `due_date` at read
    time, like every other date in the app."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dog_id: str
    completed: bool = False
    completed_at: Optional[datetime] = None
    last_completed_date: Optional[str] = None       # ISO day of the last tick-off
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    model_config = {"use_enum_values": True, "validate_default": True}
