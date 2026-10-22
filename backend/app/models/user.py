from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

#: Optional age range from the contact form. Only these CODES are ever stored -
#: never free text. The labels live in the frontend (components/auth/ContactCapture.jsx).
AGE_RANGES = ("u20", "20_24", "25_29", "30_34", "35_44", "45p", "na")


class UserBase(BaseModel):
    name: str
    mobile: str
    # Optional since the contact form: an email is optional there, and the city is
    # asked in the quiz, not at sign-up. Older accounts all have both.
    city: str = ""
    email: Optional[EmailStr] = None
    role: str = "USER"

class UserCreate(UserBase):
    password: str

class UserInDB(UserBase):
    id: str
    # None for every contact-form account: there is NO password that can sign it
    # in. Only admin accounts (create_admin.py) have a real hash.
    pwd_hash: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    #: Paywall: full matches are unlocked until this moment (UTC). Absent on every
    #: account that never paid, so existing users are unaffected.
    full_match_until: Optional[datetime] = None
    # --- contact form (routes/auth.py, /contact). All optional: older accounts lack them.
    #: The number is what the person TYPED. Nobody has checked it belongs to them.
    mobile_verified: Optional[bool] = None
    #: "contact_form" for accounts made by the contact screen.
    source: Optional[str] = None
    #: True when another account already gave the same number. Accounts are never
    #: merged; this only lets the dashboard count unique numbers.
    duplicate_mobile: Optional[bool] = None
    #: One of AGE_RANGES, or absent when the person chose nothing.
    age_range: Optional[str] = None

class UserResponse(UserBase):
    """What an account's own owner gets back. Never includes pwd_hash."""
    id: str
    created_at: datetime
    age_range: Optional[str] = None
    mobile_verified: Optional[bool] = None


class ContactIn(BaseModel):
    """The contact screen. The server re-checks everything the browser checked."""
    name: str = ""
    mobile: str = ""
    email: Optional[str] = None
    age_range: Optional[str] = None
    session_id: Optional[str] = None
