"""Purchase readiness — the lead tier read off the last quiz question.

Deliberately separate from breed scoring. WHEN somebody plans to bring a dog
home has nothing to do with WHICH breed suits them; this classifies the lead,
it does not rank breeds.

`readiness_levels` is the single source of truth for what each code means, and
it is a real collection rather than a constant so the dashboard can join
against it. Labels live in exactly one place: change "Ready Now" here and it
changes everywhere, with no frontend deploy.

Mirrors paw_buddy_readiness_schema.sql. The Postgres schema enforces the four
codes with a CHECK constraint and fills the rank with a trigger; Mongo has
neither, so both are enforced here instead — `validate_code` is the check, and
`rank_for` is the trigger.
"""
import logging

logger = logging.getLogger(__name__)

LEVELS = "readiness_levels"

#: The four canonical codes, in rank order. Nothing else may ever be written to
#: quiz_progress.readiness_code.
READINESS_LEVELS = [
    {"code": "ready_now", "rank": 1, "label": "Ready Now",
     "description": "Bringing a dog home within a month"},
    {"code": "ready_soon", "rank": 2, "label": "Ready Soon",
     "description": "Bringing a dog home in 1-3 months"},
    {"code": "planning", "rank": 3, "label": "Planning Ahead",
     "description": "Bringing a dog home in 3-6 months"},
    {"code": "researching", "rank": 4, "label": "Just Researching",
     "description": "Still researching, no date yet"},
]

CODES = tuple(level["code"] for level in READINESS_LEVELS)
BY_CODE = {level["code"]: level for level in READINESS_LEVELS}

#: What an unreadable or missing answer becomes. The coldest tier on purpose —
#: a skipped question must never inflate lead quality into a breeder's inbox.
FALLBACK = "researching"

#: The old hot/warm/cool/cold tiering, mapped onto the codes that replaced it.
LEGACY_TIER_MAP = {
    "hot": "ready_now", "warm": "ready_soon", "cool": "planning", "cold": "researching",
}


def validate_code(code):
    """The CHECK constraint, in Python. None stays None — a session that hasn't
    reached the timeline question has no readiness, which is different from
    having the lowest one."""
    if code is None:
        return None
    return code if code in BY_CODE else FALLBACK


def rank_for(code):
    """The rank that goes with a code. The app only ever writes the code; rank
    is derived here so the two can't drift apart."""
    level = BY_CODE.get(code)
    return level["rank"] if level else None


def label_for(code):
    """Human-readable. Used anywhere a code would otherwise reach a screen."""
    level = BY_CODE.get(code)
    return level["label"] if level else "Unknown"


async def seed(db) -> None:
    """Upsert the four levels. Idempotent, and it updates labels in place, so
    editing a label here changes every screen on the next restart."""
    if db is None:
        return
    for level in READINESS_LEVELS:
        await db[LEVELS].update_one(
            {"code": level["code"]}, {"$set": level}, upsert=True)


async def list_levels(db) -> list:
    """All four, rank order. The dashboard reads labels from here rather than
    hardcoding them."""
    cursor = db[LEVELS].find({}, {"_id": 0}).sort("rank", 1)
    levels = [row async for row in cursor]
    return levels or list(READINESS_LEVELS)   # before the first seed runs


async def migrate_legacy_tiers(db) -> int:
    """Move rows written under the old hot/warm/cool/cold scheme onto codes.

    Idempotent and additive: it only touches rows that still carry `lead_tier`
    and don't yet have a `readiness_code`, so re-running it is a no-op and a
    row already migrated is never rewritten."""
    from app.services.funnel_service import PROGRESS

    migrated = 0
    cursor = db[PROGRESS].find({"lead_tier": {"$exists": True}, "readiness_code": None})
    async for row in cursor:
        code = LEGACY_TIER_MAP.get(row.get("lead_tier"))
        if not code:
            continue
        await db[PROGRESS].update_one(
            {"session_id": row["session_id"]},
            {"$set": {"readiness_code": code, "readiness_rank": rank_for(code)},
             "$unset": {"lead_tier": ""}},
        )
        migrated += 1
    if migrated:
        logger.info("Migrated %d quiz_progress row(s) from lead_tier to readiness_code", migrated)
    return migrated
