"""Rate limits: how often one connection may call the endpoints that cost money,
fill up the numbers, or guess passwords.

EVERY LIMIT IS IN `RULES` BELOW. Change a number there and nowhere else.

How a limit works ("fixed window"): time is cut into windows - 60 seconds for
the tracking endpoints, an hour for feedback, and so on. Each request adds 1 to
the counter for (this endpoint, this connection, this window). Past the limit,
the request gets HTTP 429 "Too Many Requests" with a Retry-After header saying
how many seconds until the window rolls over. Simple and cheap; the one quirk is
that someone timing it exactly can squeeze up to twice the limit across a window
boundary, which is fine for what these protect.

WHERE THE COUNTS LIVE: MongoDB (collection `rate_limits`), not memory. The
backend runs on Vercel serverless, where requests are spread across short-lived
processes that each start with empty memory - an in-memory counter there would
reset constantly and limit nothing. Every counter document carries an
`expires_at`, and a TTL index (database/indexes.py) has MongoDB delete it once
its window is over, so the collection stays small on its own. The cost is one
small database write per limited request.

WHO "ONE CONNECTION" IS: see client_ip(). Behind Vercel every request arrives
from Vercel's own servers, so the visitor's real address has to be read from the
X-Forwarded-For header - and only as far as TRUSTED_PROXY_COUNT says, because a
visitor can put anything they like in that header themselves.

IPs ARE NEVER STORED. A counter's key is a keyed hash of the address (HMAC with
SECRET_KEY), so the collection can't be read back into a list of who visited.

FAILS OPEN. If the database errors, the request is allowed and a warning is
logged. Tracking must never be able to break the quiz, and a limiter that takes
the site down when Atlas hiccups would be worse than no limiter.

SHARED WI-FI. A college or office puts many people behind one address. The
limits are sized so a normal visitor never notices, but a large group on one
network can reach the tracking limits - see the notes on RULES.
"""
import hashlib
import hmac
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.config.settings import settings
from app.database.connection import get_database

logger = logging.getLogger(__name__)

COLLECTION = "rate_limits"
IST_OFFSET_SECONDS = 5 * 3600 + 30 * 60   # the AI's daily cap resets at midnight India time


@dataclass(frozen=True)
class Rule:
    limit: int      # requests allowed per window
    window: int     # seconds
    what: str       # finishes "Too many ... from your connection"


#: Every limit, per connection (IP), in one place.
RULES = {
    # Each call is a paid request to the Anthropic API. On top of this per-
    # connection limit there is a global daily cap, MATCHMAKER_DAILY_CAP, after
    # which the route answers with the empty fallback and the browser uses its
    # own keyword parser - the visitor still gets matches, we stop paying.
    "matchmaker":       Rule(10, 60 * 60, "matchmaker requests"),

    # FAILED sign-ins only. Counting every sign-in would lock out a college lab
    # signing in after a demo; counting failures still stops password guessing,
    # which is nothing but failures. Admin accounts also lock after 5 wrong
    # passwords - see ADMIN_* below.
    "login_failures":   Rule(10, 10 * 60, "failed sign-in attempts"),

    # /register and /quick-register. Generous for a classroom, hard on a script.
    # (Kept for reference; since contact capture those routes use the two below.)
    "signup":           Rule(30, 60 * 60, "sign-ups"),

    # The contact screen before question 1 (/contact, /register, /quick-register).
    # Per connection it is generous on purpose: the form sits in front of the quiz,
    # and a classroom on one Wi-Fi must all be able to start. Per NUMBER it is tight.
    "contact_ip":       Rule(60, 60 * 60, "sign-ups"),
    "contact_mobile":   Rule(3, 60 * 60, "sign-ups"),

    # Tracking. A normal quiz sends a few dozen events over a few minutes. A big
    # group on one network can exceed these; their extra events are dropped
    # (the browser ignores the 429 - the quiz itself is never affected), so the
    # dashboard would undercount a large campus session. Raise these for events
    # like that.
    "funnel_events":    Rule(300, 60, "tracking events"),
    "funnel_progress":  Rule(120, 60, "progress saves"),
    "analytics_visit":  Rule(60, 60, "visit records"),

    "feedback":            Rule(20, 60 * 60, "feedback submissions"),
    "owner_survey":        Rule(20, 60 * 60, "survey submissions"),
    "feedback_experience": Rule(20, 60 * 60, "survey submissions"),
    # "Was this useful?" pop-up: up to 5 posts per person. Per connection is
    # generous because a campus Wi-Fi is one address for everyone on it; per
    # visit (session id) is what stops one browser flooding it.
    "pulse_ip":            Rule(200, 60 * 60, "answers"),
    "pulse_session":       Rule(10, 60 * 60, "answers"),
    "pulse_status":        Rule(300, 60 * 60, "status checks"),
    # Dog profiles: moving a browser's dogs to an account (normally once).
    "dogs_adopt":          Rule(10, 60 * 60, "requests"),
    # TEMPORARY number-only sign-in for existing dog owners (auth.py legacy_login).
    "legacy_login_ip":     Rule(5, 60 * 60, "sign-in attempts"),
    "legacy_login_mobile": Rule(3, 60 * 60, "sign-in attempts"),
    "buy":                 Rule(10, 60 * 60, "breeder requests"),

    # Dog photos, health documents, and re-running the document AI (which is
    # paid per call, like the matchmaker) all draw on this one allowance.
    "uploads":          Rule(20, 60 * 60, "uploads"),

    # Paywall. Orders are counted per ACCOUNT and per connection, so nobody can
    # flood Razorpay from one account or by cycling accounts on one connection.
    "paywall_order_user":  Rule(10, 60 * 60, "payment attempts"),
    "paywall_order_ip":    Rule(30, 60 * 60, "payment attempts"),
    "paywall_verify_user": Rule(20, 60 * 60, "payment checks"),
    # Called on every quiz load and by "Check my payment"; generous for shared Wi-Fi.
    "paywall_status":      Rule(300, 60 * 60, "status checks"),
}

ADMIN_LOCK_AFTER_FAILURES = 5
ADMIN_LOCK_SECONDS = 15 * 60


# ------------------------------------------------------------------- who is it

def client_ip(request: Request) -> str:
    """The visitor's address, read safely from behind proxies.

    Each proxy a request passes through APPENDS the address it received the
    connection from to X-Forwarded-For. So with N proxies we trust, the last N
    entries were written by them and the entry N from the end is the visitor.
    Anything further left was written by whoever sent the request - possibly an
    attacker inventing addresses to dodge a limit - and is never used.

        TRUSTED_PROXY_COUNT=0  ignore the header; use the connection's own address
        TRUSTED_PROXY_COUNT=1  one proxy in front (Vercel): the LAST entry

    A header with fewer entries than that did not come through all our proxies,
    so it is ignored too."""
    peer = request.client.host if request.client else "unknown"
    hops = settings.TRUSTED_PROXY_COUNT
    if hops <= 0:
        return peer
    parts = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",") if p.strip()]
    return parts[-hops] if len(parts) >= hops else peer


def _hashed(value: str) -> str:
    """A keyed hash: the same input always maps to the same key, but nobody
    without SECRET_KEY can work back from the stored key to the address."""
    return hmac.new(settings.SECRET_KEY.encode(), value.encode(), hashlib.sha256).hexdigest()[:24]


# ----------------------------------------------------------------- the counter

async def _count(db, bucket: str, key: str, window: int, offset: int = 0):
    """Add one to this window's counter. Returns (count now, seconds left)."""
    now = time.time()
    start = int((now + offset) // window) * window - offset
    doc_id = f"{bucket}:{key}:{start}"
    update = {
        "$inc": {"n": 1},
        "$setOnInsert": {"expires_at": datetime.fromtimestamp(start + window + 60, tz=timezone.utc)},
    }
    for attempt in (1, 2):
        try:
            doc = await db[COLLECTION].find_one_and_update(
                {"_id": doc_id}, update, upsert=True, return_document=ReturnDocument.AFTER)
            break
        except DuplicateKeyError:
            # Two requests created the same window's document at once; the
            # loser simply increments the winner's.
            if attempt == 2:
                raise
    return doc["n"], max(1, int(start + window - now))


async def _peek(db, bucket: str, key: str, window: int):
    """The current count WITHOUT adding to it. Returns (count, seconds left)."""
    now = time.time()
    start = int(now // window) * window
    doc = await db[COLLECTION].find_one({"_id": f"{bucket}:{key}:{start}"})
    return (doc or {}).get("n", 0), max(1, int(start + window - now))


def _wait_words(seconds: int) -> str:
    if seconds < 90:
        return "a minute"
    return f"{round(seconds / 60)} minutes"


def too_many(what: str, retry_after: int, whose: str = "from your connection") -> HTTPException:
    return HTTPException(
        status_code=429,
        detail=f"Too many {what} {whose}. Please wait {_wait_words(retry_after)} and try again.",
        headers={"Retry-After": str(retry_after)},
    )


# ------------------------------------------------------- the route dependency

def rate_limit(bucket: str):
    """FastAPI dependency: count this request against RULES[bucket].

        @router.post("", dependencies=[Depends(rate_limit("feedback"))])
    """
    rule = RULES[bucket]

    async def _dependency(request: Request) -> None:
        db = get_database()
        if db is None:
            return
        try:
            n, retry = await _count(db, bucket, _hashed(client_ip(request)), rule.window)
        except Exception:
            logger.warning("Rate limit check failed for %s; allowing the request", bucket, exc_info=True)
            return
        if n > rule.limit:
            raise too_many(rule.what, retry)

    return _dependency


async def enforce(bucket: str, key: str, whose: str = "from your connection") -> None:
    """Count one request against RULES[bucket] for any key - a connection's
    address, or an account id / number for the per-account limits (pass `whose`
    so the message says what the limit is about). Raises 429 when over."""
    db = get_database()
    if db is None:
        return
    rule = RULES[bucket]
    try:
        n, retry = await _count(db, bucket, _hashed(key), rule.window)
    except Exception:
        logger.warning("Rate limit check failed for %s; allowing the request", bucket, exc_info=True)
        return
    if n > rule.limit:
        raise too_many(rule.what, retry, whose)


def limited(bucket: str):
    """The same, as a ready-made Depends, for a handler's own parameters - which
    is how a limit reaches routes that register an existing function (the legacy
    /api/vaccination-documents aliases re-use the health-vault handlers)."""
    return Depends(rate_limit(bucket))


# ----------------------------------------------------- failed sign-ins (by IP)

async def refuse_if_too_many_failures(request: Request) -> None:
    """Before checking a password: has this connection already failed too often?"""
    db = get_database()
    if db is None:
        return
    rule = RULES["login_failures"]
    try:
        n, retry = await _peek(db, "login_failures", _hashed(client_ip(request)), rule.window)
    except Exception:
        logger.warning("Sign-in failure check failed; allowing the attempt", exc_info=True)
        return
    if n >= rule.limit:
        raise too_many(rule.what, retry)


async def record_login_failure(request: Request) -> None:
    db = get_database()
    if db is None:
        return
    try:
        await _count(db, "login_failures", _hashed(client_ip(request)), RULES["login_failures"].window)
    except Exception:
        logger.warning("Could not record a failed sign-in", exc_info=True)


# --------------------------------------------- admin lockout (by account)

async def admin_lock_remaining(mobile: str) -> int:
    """Seconds this admin account stays locked, or 0. Keyed on the ACCOUNT, not
    the connection, so guessing from many addresses still hits the lock. A normal
    user's account is never looked up here."""
    db = get_database()
    if db is None:
        return 0
    try:
        lock = await db[COLLECTION].find_one({"_id": f"admin_lock:{_hashed(mobile)}"})
    except Exception:
        logger.warning("Admin lock check failed; allowing the attempt", exc_info=True)
        return 0
    if not lock:
        return 0
    until = lock["until"]
    if until.tzinfo is None:              # Mongo hands datetimes back naive (UTC)
        until = until.replace(tzinfo=timezone.utc)
    left = int((until - datetime.now(timezone.utc)).total_seconds())
    return max(0, left)


async def record_admin_failure(mobile: str) -> None:
    """One wrong admin password. The fifth within 15 minutes locks the account
    for ADMIN_LOCK_SECONDS - even the right password is refused until then."""
    db = get_database()
    if db is None:
        return
    key = _hashed(mobile)
    now = datetime.now(timezone.utc)
    try:
        doc = await db[COLLECTION].find_one_and_update(
            {"_id": f"admin_fail:{key}"},
            {"$inc": {"n": 1}, "$set": {"expires_at": now + timedelta(seconds=ADMIN_LOCK_SECONDS)}},
            upsert=True, return_document=ReturnDocument.AFTER)
        if doc["n"] >= ADMIN_LOCK_AFTER_FAILURES:
            until = now + timedelta(seconds=ADMIN_LOCK_SECONDS)
            await db[COLLECTION].update_one(
                {"_id": f"admin_lock:{key}"},
                {"$set": {"until": until, "expires_at": until}}, upsert=True)
            await db[COLLECTION].delete_one({"_id": f"admin_fail:{key}"})
            logger.warning("An admin account was locked for %d minutes after %d wrong passwords.",
                           ADMIN_LOCK_SECONDS // 60, ADMIN_LOCK_AFTER_FAILURES)
    except Exception:
        logger.warning("Could not record a failed admin sign-in", exc_info=True)


async def clear_admin_failures(mobile: str) -> None:
    """A correct password resets the count."""
    db = get_database()
    if db is None:
        return
    try:
        await db[COLLECTION].delete_one({"_id": f"admin_fail:{_hashed(mobile)}"})
    except Exception:
        logger.warning("Could not clear admin sign-in failures", exc_info=True)


def admin_locked_error(seconds: int) -> HTTPException:
    return HTTPException(
        status_code=429,
        detail=f"This admin account is locked after too many wrong passwords. "
               f"Try again in {_wait_words(seconds)}.",
        headers={"Retry-After": str(seconds)},
    )


# -------------------------------------------------- the AI's global daily cap

async def matchmaker_within_daily_cap() -> bool:
    """Count one paid AI call against today's budget (days start at midnight
    India time). False once MATCHMAKER_DAILY_CAP is used up: the route then
    answers with the empty fallback, and the browser's keyword parser takes over."""
    db = get_database()
    if db is None:
        return True
    try:
        n, _ = await _count(db, "matchmaker_day", "all", 24 * 3600, offset=IST_OFFSET_SECONDS)
    except Exception:
        logger.warning("Matchmaker daily cap check failed; allowing the call", exc_info=True)
        return True
    return n <= settings.MATCHMAKER_DAILY_CAP
