import logging
import secrets
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

from app.auth.dependencies import ADMIN_ROLE
from app.auth.security import get_password_hash, create_access_token
from app.config.settings import ENV_FILE, settings
from app.database.connection import get_database
from app.models.user import UserCreate, UserInDB, UserResponse

logger = logging.getLogger(__name__)
router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

@router.post("/register", response_model=UserResponse)
async def register(user: UserCreate):
    db = get_database()
    users_collection = db["users"]
    
    existing_user = await users_collection.find_one({"mobile": user.mobile})
    if existing_user:
        raise HTTPException(status_code=400, detail="Mobile number already registered")
        
    user_in_db = UserInDB(
        id=str(uuid.uuid4()),
        name=user.name,
        mobile=user.mobile,
        city=user.city,
        email=user.email,
        role=user.role,
        pwd_hash=get_password_hash(user.password),
        created_at=datetime.utcnow()
    )
    
    await users_collection.insert_one(user_in_db.dict())
    return UserResponse(**user_in_db.dict())

@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Sign in with a mobile number.

    Every account, including ADMIN, is identified by mobile alone — neither
    form collects a password, and every account ever created was given the
    same placeholder string, so "verifying" it would check a value that is
    compiled into the public JS bundle. The ADMIN account used to require an
    extra password on top of this; that gate was removed at Vibhuvan's
    request (2026-08-19) so admin sign-in works the same as every other
    account. Route-level admin authorization (require_admin, checking the
    token's role claim) is unaffected and still guards every admin endpoint.
    """
    db = get_database()
    users_collection = db["users"]

    # We use username field of OAuth2 to accept mobile
    user = await users_collection.find_one({"mobile": form_data.username})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect mobile",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user["id"], "role": user["role"]})
    return {"access_token": access_token, "token_type": "bearer", "user": UserResponse(**user)}
