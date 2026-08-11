from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

from app.models.vaccination import utc_now


class DogProfileIn(BaseModel):
    """What the client sends when creating or updating a dog.

    `dob` drives the generated vaccination and deworming schedules (see
    services/vaccination_schedule.py) — an age in years can't place a 6-week
    puppy dose — and `breed` tunes the schedule for large breeds. The photo is
    uploaded separately (POST /api/dogs/photo) so a dog can be re-photographed
    without resubmitting the whole profile."""
    name: str
    breed: Optional[str] = None
    dob: str                                    # ISO YYYY-MM-DD
    gender: Optional[str] = None
    weight_kg: Optional[float] = None
    city: Optional[str] = None
    photo_url: Optional[str] = None
    photo_public_id: Optional[str] = None
    health_complications: Optional[str] = None


class DogProfile(DogProfileIn):
    """A saved dog.

    `id` is the dog id every health document, vaccination, prescription and
    reminder is filtered by — health records cannot exist without one, and no
    query ever spans two dogs. `owner_id` groups an owner's dogs; an owner may
    have as many as they like."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_id: str
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
