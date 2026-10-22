"""Sign-up and sign-in.

ORDINARY VISITORS do not sign in with a mobile number any more. There is no OTP
to prove a number is theirs, so a number cannot be an identity: the contact
screen (POST /contact) makes a NEW account every time and hands that browser a
30-day token. That token is the account. Typing someone else's number gets you a
new, empty account of your own - never theirs. (services/contact_service.py)

ADMINS still sign in with mobile + a real password (create_admin.py), exactly
as before, including the "admin_password_required" step the Login page uses.

/register and /quick-register are kept for old callers but now run the same
contact logic: neither can create a password account or return an existing one.
"""
import logging
from datetime import timedelta

from fastapi import APIRouter, Form, HTTPException, Request, status
from pydantic import BaseModel, Field
from fastapi.security import OAuth2PasswordBearer

from app.auth.dependencies import ADMIN_ROLE
from app.auth.security import create_access_token, verify_password
from app.config.settings import settings
from app.database.connection import get_database
from app.models.user import ContactIn, UserResponse
from app.security import rate_limit as rl
from app.services import contact_service

logger = logging.getLogger(__name__)
router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

WRONG_CREDENTIALS = "Incorrect mobile number or password."

#: An admin session never lasts longer than this. Ordinary accounts get
#: USER_TOKEN_DAYS (30 days); an admin token is a key to everyone's data, so it
#: stays short whatever the other settings say.
ADMIN_TOKEN_MAX_MINUTES = 120


async def _contact(request: Request, data: dict) -> dict:
    """The one way an ordinary account is made. Limits (rate_limit.RULES):
    60 an hour per connection (a classroom on one Wi-Fi can all start), and 3 an
    hour per mobile number."""
    await rl.enforce("contact_ip", rl.client_ip(request))
    try:
        fields = contact_service.clean(data)
    except contact_service.ContactError as err:
        raise HTTPException(status_code=422, detail={"field": err.field, "message": err.message})
    await rl.enforce("contact_mobile", fields["mobile"], whose="for this number")
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Please try again in a moment.")
    return await contact_service.create_account(db, fields, data.get("session_id"))


@router.post("/contact")
async def contact(payload: ContactIn, request: Request):
    """The contact screen: name, mobile (unverified), optional email and age range.
    Always a new account; returns {access_token, token_type, user} like /login."""
    return await _contact(request, payload.dict())


@router.post("/register")
async def register(payload: dict, request: Request):
    """Old sign-up path (Signup page, AuthModal). Any password sent is ignored:
    it now makes a contact-form account, exactly like /contact."""
    return await _contact(request, {k: payload.get(k) for k in ("name", "mobile", "email", "age_range", "session_id")})


@router.post("/quick-register")
async def quick_register(payload: dict, request: Request):
    """Old post-quiz gate path. It used to find an existing account by number;
    now it can only ever make a new one (same as /contact)."""
    return await _contact(request, {k: payload.get(k) for k in ("name", "mobile", "email", "age_range", "session_id")})


@router.post("/login")
async def login(request: Request, username: str = Form(...), password: str = Form("")):
    """ADMIN sign-in only: mobile + the real password from create_admin.py.

    The Login page first sends the number with an EMPTY password. For an admin
    that answers "admin_password_required" and the page shows a password field -
    the same step as before, without the old shared password. Every other
    account is refused: there is no password that signs an ordinary account in.

    Limits (app/security/rate_limit.py): 10 FAILED sign-ins per connection per
    10 minutes; an admin account locks for 15 minutes after 5 wrong passwords
    (the empty first probe is not a wrong password).

    The form fields are declared here rather than with OAuth2PasswordRequestForm
    only so the password may be EMPTY (that form rejects an empty one before this
    code runs). The request is the same form the Login page has always sent.
    """
    await rl.refuse_if_too_many_failures(request)

    db = get_database()
    user = await db["users"].find_one({"mobile": username, "role": ADMIN_ROLE})
    if not user or not user.get("pwd_hash"):
        await rl.record_login_failure(request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=WRONG_CREDENTIALS,
            headers={"WWW-Authenticate": "Bearer"},
        )

    locked_for = await rl.admin_lock_remaining(username)
    if locked_for:
        raise rl.admin_locked_error(locked_for)
    if not password or not verify_password(password, user["pwd_hash"]):
        if password:
            await rl.record_login_failure(request)
            await rl.record_admin_failure(username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="admin_password_required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    await rl.clear_admin_failures(username)

    lifetime = timedelta(minutes=min(settings.ACCESS_TOKEN_EXPIRE_MINUTES, ADMIN_TOKEN_MAX_MINUTES))
    access_token = create_access_token(data={"sub": user["id"], "role": user["role"]}, expires_delta=lifetime)
    return {"access_token": access_token, "token_type": "bearer", "user": UserResponse(**user)}


# ========================================================================= #
# TEMPORARY. Delete this endpoint and the allowlist when OTP is live.
# Anyone who knows an allowlisted number can open that person's dog records,
# which is acceptable only while the list is the team's own numbers.
#
# Number-only sign-in for EXISTING dog owners (review item 7b), so the dog
# profiles - which now need a sign-in - stay reachable from a new phone.
#   - Only numbers in LEGACY_MOBILE_LOGIN_ALLOWLIST (backend/.env); blank = nobody.
#   - Only an account with role USER (never ADMIN) that owns at least one dog.
#   - Every refusal says the same thing, so nobody learns which case it was.
#   - 5 an hour per connection, 3 an hour per number.
# Marketing visitors never use this: they get an account from the contact form.
# ========================================================================= #

NO_DOG_PROFILE = "We couldn't find a dog profile for that number."


class LegacyLoginIn(BaseModel):
    mobile: str = Field(..., max_length=20)


@router.post("/legacy-login")
async def legacy_login(request: Request, payload: LegacyLoginIn):
    await rl.enforce("legacy_login_ip", rl.client_ip(request))
    mobile = contact_service.normalise_mobile(payload.mobile)
    if len(mobile) != 10:
        raise HTTPException(status_code=404, detail=NO_DOG_PROFILE)
    await rl.enforce("legacy_login_mobile", mobile, whose="for this number")

    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    user = None
    if mobile in settings.legacy_login_allowlist:
        candidates = await db["users"].find({"mobile": mobile, "role": "USER"}).sort("created_at", 1).to_list(50)
        for candidate in candidates:            # the oldest account that owns a dog
            if await db["dog_profiles"].find_one({"owner_id": candidate["id"]}):
                user = candidate
                break
    if not user:
        logger.info("Legacy sign-in refused for %s", contact_service.masked(mobile))
        raise HTTPException(status_code=404, detail=NO_DOG_PROFILE)

    logger.info("Legacy sign-in for %s", contact_service.masked(mobile))
    token = create_access_token({"sub": user["id"], "role": "USER"},
                                expires_delta=timedelta(days=settings.USER_TOKEN_DAYS))
    return {"access_token": token, "token_type": "bearer", "user": UserResponse(**user)}
