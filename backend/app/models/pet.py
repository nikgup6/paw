from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class PetProfile(BaseModel):
    # Set by the server from the sign-in token (routes/pets.py); a value sent by
    # the browser is ignored, so it is optional here.
    user_id: Optional[str] = None
    name: str
    dob: str
    age_display: str
    gender: str
    breed: str
    health_complications: Optional[str] = None
    vaccines: Optional[List[Dict[str, Any]]] = None
    reminders: Optional[List[Dict[str, Any]]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PetProfileResponse(PetProfile):
    id: Optional[str] = None
