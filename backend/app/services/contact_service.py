"""Contact capture without OTP: the mobile number is a CONTACT DETAIL, not a login.

Why: there is no way to prove a number belongs to the person typing it (no OTP
yet). While a number could sign someone in, anyone who knew it could become that
person. So every contact form makes a brand-new account, owned by the browser
that holds its token. A number typed twice makes two accounts - never one
account found by its number - and nothing about the first is ever returned to
the second.

Everything here is re-checked on the server; the browser's checks are only
there to give quick feedback.
"""
import logging
import re
import uuid
from datetime import datetime, timedelta
from typing import Optional

from pydantic import EmailStr, TypeAdapter, ValidationError

from app.auth.security import create_access_token
from app.config.settings import settings
from app.models.funnel import safe_id
from app.models.user import AGE_RANGES, UserResponse

logger = logging.getLogger(__name__)

USERS = "users"
PROGRESS = "quiz_progress"

#: Numbers that pass the shape check but are plainly not someone's real number.
OBVIOUSLY_FAKE = {"1234567890", "9876543210"}
_EMAIL = TypeAdapter(EmailStr)


class ContactError(ValueError):
    """A field the person must fix. `field` says which, `message` is plain words."""
    def __init__(self, field: str, message: str):
        super().__init__(message)
        self.field = field
        self.message = message


def normalise_mobile(raw: str) -> str:
    """Digits only, without +91 / 91 / a leading 0. Not yet validated."""
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return digits


def mobile_problem(mobile: str) -> Optional[str]:
    """Why this (normalised) number cannot be right, or None."""
    if len(mobile) != 10:
        return "Please enter a 10-digit mobile number."
    if mobile[0] not in "6789":
        return "Indian mobile numbers start with 6, 7, 8 or 9."
    if len(set(mobile)) == 1 or mobile in OBVIOUSLY_FAKE:
        return "Please enter your real mobile number."
    return None


def masked(mobile: str) -> str:
    """For logs: the last 4 digits at most."""
    return f"******{mobile[-4:]}" if len(mobile) >= 4 else "******"


def clean(data: dict) -> dict:
    """Validate the form. Raises ContactError for the first problem found."""
    name = " ".join((data.get("name") or "").split())[:80]
    if len(name) < 2:
        raise ContactError("name", "Please enter your name.")
    mobile = normalise_mobile(data.get("mobile"))
    problem = mobile_problem(mobile)
    if problem:
        raise ContactError("mobile", problem)
    email = (data.get("email") or "").strip()
    if email:
        try:
            email = str(_EMAIL.validate_python(email))
        except ValidationError:
            raise ContactError("email", "That email doesn't look right. You can leave it empty.") from None
    age = data.get("age_range")
    return {
        "name": name,
        "mobile": mobile,
        "email": email or None,
        # Only a known code is kept; anything else is treated as "not chosen".
        "age_range": age if age in AGE_RANGES else None,
    }


async def create_account(db, fields: dict, session_id: Optional[str]) -> dict:
    """Always a NEW account. Returns the same shape /login returns."""
    duplicate = await db[USERS].find_one({"mobile": fields["mobile"]}, {"_id": 1}) is not None
    user = {
        "id": str(uuid.uuid4()),
        "name": fields["name"],
        "mobile": fields["mobile"],
        "city": "",
        "email": fields["email"],
        "role": "USER",
        "pwd_hash": None,                 # no password can sign this account in
        "mobile_verified": False,
        "source": "contact_form",
        "duplicate_mobile": duplicate,
        "created_at": datetime.utcnow(),
    }
    if fields["age_range"]:
        user["age_range"] = fields["age_range"]
    await db[USERS].insert_one(dict(user))

    if safe_id(session_id):
        # Join the quiz session that is already running to this new account, so
        # the dashboard can follow one person from first answer to result.
        await db[PROGRESS].update_one({"session_id": session_id}, {"$set": {"user_id": user["id"]}})

    logger.info("Contact captured for mobile %s (duplicate=%s, age_range=%s).",
                masked(fields["mobile"]), duplicate, "given" if fields["age_range"] else "none")

    token = create_access_token({"sub": user["id"], "role": "USER"},
                                expires_delta=timedelta(days=settings.USER_TOKEN_DAYS))
    return {"access_token": token, "token_type": "bearer", "user": UserResponse(**user)}
