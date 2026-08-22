from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class QuizResult(BaseModel):
    user_id: Optional[str] = None
    answers: Dict[str, Any]
    top_breeds: List[str]
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Feedback(BaseModel):
    """One piece of feedback — either a one-tap rating or the 3-question modal.

    The context fields are what make a rating actionable: "3/5" on its own says
    nothing, but "2/5 on breeder X" is something you can act on. Every field
    added here is optional with a default, so the existing detailed modal keeps
    posting exactly what it posts today and older records stay readable.
    """

    user_id: Optional[str] = None
    user_name: Optional[str] = None
    rating: int
    comment: Optional[str] = None

    #: What this is about — "breeder_contact", "care_tip", "vet_call",
    #: "quiz_result", "vaccination_scan". Defaults to "general" so feedback
    #: posted without a context (the existing modal) is still queryable rather
    #: than carrying a null that every reader has to special-case.
    context: str = "general"
    #: WHICH breeder / tip / document — lets a bad rating point at one item.
    context_id: Optional[str] = None
    #: "quick" = one tap, "detailed" = the 3-question modal.
    rating_type: str = "quick"

    created_at: datetime = Field(default_factory=datetime.utcnow)

#: The five fixed questions of the experience survey, in display order. The
#: frontend posts exactly these keys; the admin listing sorts and filters on
#: them, and nothing else — an unrecognised field name is rejected rather than
#: passed through to a Mongo sort.
EXPERIENCE_QUESTIONS = (
    "reliability",
    "ease_of_use",
    "match_accuracy",
    "unbiased",
    "recommend",
)


class ExperienceFeedback(BaseModel):
    """The 5-question rated survey opened from the app's "More" sheet.

    Its own model and its own collection rather than more optional columns on
    Feedback above, for one reason: Feedback is posted by the one-tap
    QuickFeedback toasts, which fire from logged-out marketing pages, so it can
    never require an identity. This survey always can — and does.

    Every score is stored as its OWN column, never averaged. "Matching accuracy
    is the weak score and the other four are fine" is an actionable finding;
    the single blended number that would replace it is not, and the averaging
    is irreversible once written.

    On identity: this app has no login. `/app` is not behind ProtectedRoute and
    Sign In was removed from the site, so an auth session exists only for an
    admin. The real per-user identity is `owner_id`, the per-device id every
    dog profile and health record is already filed under — so that is what is
    required here, and `user_id` is recorded only opportunistically.
    """

    #: Who sent it. Required with no default, so a submission that somehow
    #: arrives without one is a 422 rather than a silently anonymous row.
    owner_id: str = Field(..., min_length=1)

    #: Set only when a real auth session happened to exist at submit time
    #: (in practice: an admin). Kept so nothing is lost if login is restored
    #: later — but this is NOT the field the record is attributed by.
    user_id: Optional[str] = None
    user_name: Optional[str] = None

    #: 1-5 each, all five mandatory. The modal disables submit until every one
    #: is answered; these bounds are the server-side half of that same rule, so
    #: a partial set cannot be written by anything that skips the UI.
    reliability: int = Field(..., ge=1, le=5)
    ease_of_use: int = Field(..., ge=1, le=5)
    match_accuracy: int = Field(..., ge=1, le=5)
    unbiased: int = Field(..., ge=1, le=5)
    recommend: int = Field(..., ge=1, le=5)

    #: Genuinely optional — submit works with or without it.
    comment: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)


class BuyRequest(BaseModel):
    user_id: Optional[str] = None
    user_name: str
    mobile: str
    city: str
    breed_name: str
    intent: str
    status: str = "NEW"
    created_at: datetime = Field(default_factory=datetime.utcnow)
