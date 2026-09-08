"""The two shapes behind the acquisition funnel.

`Event` is an append-only fact: something happened, at a time, in a session.
Nothing ever updates one. `QuizProgress` is the opposite — one mutable row per
session, rewritten on every answer, so a quiz abandoned at question 4 still
leaves four answers on file instead of nothing at all.

Keeping them apart is the point. Counts and drop-off come from the log, which
can't be rewritten after the fact; "who is mid-quiz right now" comes from the
row, which is always current. One collection could not honestly do both.
"""
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from app.models.vaccination import utc_now

from app.services.readiness import CODES as READINESS_CODES  # noqa: F401  (re-export)

#: The funnel, in order. Every dashboard number is derived from these five.
FUNNEL_EVENTS = (
    "quiz_started",
    "quiz_completed",
    "results_viewed",
    "breeder_cta_clicked",
    "contact_submitted",
)

#: Everything the client is allowed to write. An unknown event name is rejected
#: rather than stored: the log is only useful if a typo in one deploy can't
#: quietly create a second, near-identical event that splits a funnel step.
KNOWN_EVENTS = FUNNEL_EVENTS + (
    "question_viewed",
    "question_answered",
    "timeline_selected",
    "login_started",
    "login_completed",
)


class EventIn(BaseModel):
    session_id: str
    user_id: Optional[str] = None
    event_name: str
    props: Dict[str, Any] = Field(default_factory=dict)


class Event(EventIn):
    created_at: datetime = Field(default_factory=utc_now)


class ProgressIn(BaseModel):
    """A partial update. Every field but the session is optional because this is
    upserted after each answer, and an answer only knows about its own field."""
    session_id: str
    user_id: Optional[str] = None
    answers: Optional[Dict[str, Any]] = None
    current_question: Optional[int] = None
    #: The option's own wording ("Within the next month") — kept verbatim so an
    #: admin reading the table sees what the person actually picked.
    purchase_timeline: Optional[str] = None
    #: One of the four canonical codes. The rank is NOT accepted from the
    #: client: it is derived from the code server-side, so the two can never
    #: disagree no matter what a stale build sends.
    readiness_code: Optional[str] = None
    #: MUST be the exact "Breed Name" string from the breed database, so lead
    #: data can be joined to breed data later without fuzzy matching.
    top_breed: Optional[str] = None
    city: Optional[str] = None
    status: Optional[str] = None
