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

class BuyRequest(BaseModel):
    user_id: Optional[str] = None
    user_name: str
    mobile: str
    city: str
    breed_name: str
    intent: str
    status: str = "NEW"
    created_at: datetime = Field(default_factory=datetime.utcnow)
