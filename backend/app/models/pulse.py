"""The "Was this useful?" pop-up and its screener questions (ResultsPulse).

This file is the SERVER's whitelist. The questions people see live in
frontend/src/config/pulse.js; when you change a question there, change the
codes here in the same commit, and bump PULSE_VERSION in both so people who
answered the old set can be asked the new one.

Only short codes are stored for the taps. The one free-text field (the
comment) is plain text, at most 200 characters, with no links.
"""
import re
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.funnel import safe_id
from app.models.interaction import Feedback

#: The current question set. Must match PULSE_VERSION in config/pulse.js.
PULSE_VERSION = 1

#: "Was this recommendation useful to you?" -> the 3/2/1 rating it is filed as.
USEFUL_RATING = {"yes": 3, "some": 2, "no": 1}

#: The screener questions: key -> the answer codes allowed for it.
SCREENER_ANSWERS = {
    "breed_known": ("known", "shortlist", "none"),
    "price_fair": ("cheap", "fair", "high", "too_high"),
    "not_paid_reason": ("price", "trust", "enough", "exploring", "payment", "other"),
}

#: Where the person stood with the paywall. Worked out by the SERVER from the
#: account (never sent by the browser):
#:   paid       a REAL payment exists (a payments row with status "paid", mode test or live)
#:   fake_door  unlocked through the fake door: tapped Pay, no money moved
#:   dismissed  the paywall is on and this account has not unlocked
#:   none       the paywall is off
#: Rows written before fake_door existed may say "paid" for a fake-door unlock;
#: they are left as they are (the admin summary counts them).
PAYWALL_STATES = ("paid", "fake_door", "dismissed", "none")

COMMENT_MAX = 200
_LINK = re.compile(r"(https?://|www\.|\b[a-z0-9-]+\.(com|in|net|org|io|co|me|ly|app|xyz|link)\b)", re.I)
_CONTROL = re.compile(r"[\x00-\x1f\x7f]")


def clean_comment(value: Optional[str]) -> Optional[str]:
    """Plain text on one line, or None. Raises ValueError for a link."""
    if value is None:
        return None
    text = " ".join(_CONTROL.sub(" ", str(value)).split())
    if not text:
        return None
    if len(text) > COMMENT_MAX:
        raise ValueError(f"Please keep it under {COMMENT_MAX} characters.")
    if _LINK.search(text):
        raise ValueError("Please leave out links.")
    return text


class _FromBrowser(BaseModel):
    session_id: str
    version: int = Field(ge=1, le=1000)

    @field_validator("session_id")
    @classmethod
    def _session(cls, v):
        if not safe_id(v):
            raise ValueError("bad session_id")
        return v


class PulseIn(_FromBrowser):
    useful: Literal["yes", "some", "no"]
    comment: Optional[str] = Field(None, max_length=COMMENT_MAX * 2)   # trimmed and checked below

    @field_validator("comment")
    @classmethod
    def _comment(cls, v):
        return clean_comment(v)


class ScreenerIn(_FromBrowser):
    key: Literal["breed_known", "price_fair", "not_paid_reason"]
    answer: str = Field(max_length=20)

    @model_validator(mode="after")
    def _answer_allowed(self):
        if self.answer not in SCREENER_ANSWERS[self.key]:
            raise ValueError(f"{self.answer!r} is not an answer to {self.key}")
        return self


class PulseFeedback(Feedback):
    """A `feedback` row from the pop-up: the existing Feedback shape
    (context="rec_useful", rating 3/2/1, rating_type="quick") plus the fields
    only this pop-up has. A separate class so the existing POST /api/feedback
    accepts exactly what it accepted before."""
    session_id: str
    paywall_state: Literal["paid", "fake_door", "dismissed", "none"]
    paywall_mode: str
    useful: Literal["yes", "some", "no"]
    version: int
    updated_at: datetime = Field(default_factory=datetime.utcnow)
