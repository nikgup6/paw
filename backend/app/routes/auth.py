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
from app.models.user import QuickRegisterRequest, UserCreate, UserInDB, UserResponse

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
    """Register-or-login with just name + mobile (email optional).

    If the mobile is already registered, sign them in directly.
    Otherwise create a new account with the provided fields and
    sensible defaults for the rest, then sign them in.

    This is the post-quiz / post-survey gate — it must never fail
    for a valid mobile, and it must never ask for more than name,
    number, and optionally email.
    """
    db = get_database()
    users_collection = db["users"]

    existing = await users_collection.find_one({"mobile": req.mobile})
    if existing:
        # Already registered — sign them in directly.
        # Sanitise email: old accounts may have a placeholder.local address that
        # fails EmailStr validation; replace it with a valid one on the fly.
        email = existing.get("email", "")
        if not email or email.endswith("@placeholder.local"):
            existing["email"] = f"{req.mobile}@pawbuddy.in"
        access_token = create_access_token(data={"sub": existing["id"], "role": existing.get("role", "USER")})
        return {"access_token": access_token, "token_type": "bearer", "user": UserResponse(**existing)}

    # New account with minimal fields
    user_in_db = UserInDB(
        id=str(uuid.uuid4()),
        name=req.name,
        mobile=req.mobile,
        city="",                          # not collected at this gate
        email=req.email or f"{req.mobile}@pawbuddy.in",
        role="USER",
        pwd_hash=get_password_hash("PawBuddy@123"),
        created_at=datetime.utcnow(),
    )

    await users_collection.insert_one(user_in_db.dict())
    access_token = create_access_token(data={"sub": user_in_db.id, "role": user_in_db.role})
    return {"access_token": access_token, "token_type": "bearer", "user": UserResponse(**user_in_db.dict())}


@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Sign in with a mobile number.

    Ordinary accounts are identified by mobile alone. That is the product's
    existing design — neither form collects a password, and every account ever
    created was given the same placeholder string, so "verifying" it would
    check a value that is compiled into the public JS bundle. Turning that on
    would add no security and would lock out anyone whose hash predates it.

    The ADMIN account is different, because it can read every user's record.
    It requires the real secret from ADMIN_PASSWORD (backend/.env), and if that
    isn't configured the account cannot sign in at all — an unprotected admin
    login is worse than no admin login.
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

    if user.get("role") == ADMIN_ROLE:
        expected = settings.ADMIN_PASSWORD
        if not expected:
            logger.error(
                "Admin sign-in refused: ADMIN_PASSWORD is not set in %s. The admin "
                "account is the only one that can read every user's record, so it "
                "is failed closed rather than left open.", ENV_FILE)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Administrator sign-in is not configured on this server.",
            )
        # compare_digest: a plain == leaks the length of the matching prefix
        # through timing, which is the one thing worth being careful about on
        # the single credential that guards everyone's data.
        if not secrets.compare_digest(str(form_data.password or ""), str(expected)):
            logger.warning("Failed admin sign-in attempt for mobile %s", form_data.username)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                # The code lets the client know to show a password field; the
                # message never reveals whether the mobile itself was right.
                detail="admin_password_required",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # Sanitise email: old accounts may have a placeholder.local address that
    # fails EmailStr validation; replace it with a valid one on the fly.
    email = user.get("email", "")
    if not email or email.endswith("@placeholder.local"):
        user["email"] = f"{form_data.username}@pawbuddy.in"

    access_token = create_access_token(data={"sub": user["id"], "role": user["role"]})
    return {"access_token": access_token, "token_type": "bearer", "user": UserResponse(**user)}
