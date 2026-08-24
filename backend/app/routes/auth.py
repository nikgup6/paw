import logging
import secrets
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel

from app.auth.dependencies import ADMIN_ROLE
from app.auth.security import get_password_hash, verify_password, create_access_token
from app.config.settings import ENV_FILE, settings
from app.database.connection import get_database
from app.models.user import UserCreate, UserInDB, UserResponse


class QuickRegisterRequest(BaseModel):
    name: str
    mobile: str
    email: str | None = None

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


@router.post("/quick-register")
async def quick_register(req: QuickRegisterRequest):
    """Register-or-return: creates the account if the mobile is new, returns the
    existing user if not. Called by the post-quiz login gate (QuickLoginModal)
    so the modal always has an account to sign into.

    Unlike /register, this never 400s on a duplicate — the whole point is that
    the caller doesn't know (or care) whether this mobile already exists."""
    db = get_database()
    users_collection = db["users"]

    existing = await users_collection.find_one({"mobile": req.mobile})
    if existing:
        return {"status": "existing", "user": UserResponse(**existing).dict()}

    # EmailStr won't accept an empty string, so use a mobile-based placeholder
    # when the user skips the optional email field.
    safe_email = req.email.strip() if req.email and req.email.strip() else f"user{req.mobile}@pawbuddy.app"
    user_in_db = UserInDB(
        id=str(uuid.uuid4()),
        name=req.name,
        mobile=req.mobile,
        city="",
        email=safe_email,
        role="USER",
        pwd_hash=get_password_hash("PawBuddy@123"),
        created_at=datetime.utcnow(),
    )
    await users_collection.insert_one(user_in_db.dict())
    return {"status": "created", "user": UserResponse(**user_in_db.dict()).dict()}


@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Sign in with a mobile number.

    USER accounts use the shared placeholder password (PawBuddy@123) — these
    accounts were created without a real password, and the placeholder is the
    only thing that works.

    ADMIN accounts have a REAL password set via create_admin.py. When an ADMIN
    tries to log in with the placeholder, the server returns a specific error
    so the frontend can show the password field. The admin must then enter the
    real password to proceed.
    """
    db = get_database()
    users_collection = db["users"]

    user = await users_collection.find_one({"mobile": form_data.username})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect mobile",
            headers={"WWW-Authenticate": "Bearer"},
        )

    is_admin = user.get("role") == ADMIN_ROLE

    if is_admin:
        # Admin accounts have a real password. If the caller sent the
        # placeholder (which is what the Login page sends by default when
        # no password field is shown), tell the frontend to ask for one.
        if not verify_password(form_data.password, user["pwd_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="admin_password_required",
                headers={"WWW-Authenticate": "Bearer"},
            )
    else:
        # Regular users: accept the placeholder password. Every non-admin
        # account was created with PawBuddy@123, so this is the only check
        # that makes sense for them.
        if not verify_password(form_data.password, user["pwd_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password",
                headers={"WWW-Authenticate": "Bearer"},
            )

    access_token = create_access_token(data={"sub": user["id"], "role": user["role"]})
    return {"access_token": access_token, "token_type": "bearer", "user": UserResponse(**user)}
