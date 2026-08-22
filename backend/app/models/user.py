from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    name: str
    mobile: str
    city: str
    email: EmailStr
    role: str = "USER"

class UserCreate(UserBase):
    password: str

class UserInDB(UserBase):
    id: str
    pwd_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserResponse(UserBase):
    id: str
    created_at: datetime
