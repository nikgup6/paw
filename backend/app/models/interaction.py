from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class QuizResult(BaseModel):
    user_id: Optional[str] = None
    answers: Dict[str, Any]
    top_breeds: List[str]
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Feedback(BaseModel):
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    rating: int
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
