"""Today's routine wellness care — the item list, and the daily ticks.

Two collections:
  * `daily_care_items` — one document per dog: WHICH habits this owner tracks.
    Absent means "hasn't customised it", which reads as the four defaults, so
    no dog needs seeding and an existing dog gains the feature for free.
  * `daily_care` — one document per dog per DAY: which of those were done.

The date is part of the key rather than something a scheduled job clears, so
"resets at midnight" needs no cron and cannot half-fail: tomorrow reads a
different key and finds nothing ticked. History is kept for free.

The load-bearing rule: an item's `code` is what a tick is recorded against.
Renaming an item keeps its code, so today's ticks survive the rename. Deleting
an item leaves its historical ticks in place but stops showing it — the past
is not rewritten to match a present-day preference.
"""
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone

from app.models.daily_care import CARE_ICONS, CARE_ITEMS, CARE_LABELS
from app.services.health_status import today

logger = logging.getLogger(__name__)

DAILY_CARE = "daily_care"
DAILY_CARE_ITEMS = "daily_care_items"

MAX_ITEMS = 10          # a checklist longer than this stops being a glance
MAX_LABEL = 28

#: What a dog gets before its owner customises anything.
DEFAULT_ITEMS = [
    {"code": code, "label": CARE_LABELS[code], "icon": CARE_ICONS[code]}
    for code in CARE_ITEMS
]


def today_key() -> str:
    """The server's calendar day. Every due-date in the app is computed from
    the server's clock, so the reset boundary matches everything else."""
    return today().isoformat()


def seconds_until_reset() -> int:
    now = datetime.now(timezone.utc)
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return max(0, int((tomorrow - now).total_seconds()))


def _slug(label: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "_", str(label or "").strip().lower()).strip("_")
    return base or f"item_{uuid.uuid4().hex[:6]}"


async def get_items(db, dog_id: str) -> list:
    """This dog's habit list — its own if customised, otherwise the defaults."""
    row = await db[DAILY_CARE_ITEMS].find_one({"dog_id": dog_id})
    items = (row or {}).get("items")
    return [dict(i) for i in items] if items else [dict(i) for i in DEFAULT_ITEMS]


def validate_items(items: list) -> list:
    """Return a cleaned list, or raise ValueError. Codes are assigned here
    rather than trusted from the client for NEW items only — an item that
    already has a code keeps it, which is what makes renaming safe."""
    if not isinstance(items, list) or not items:
        raise ValueError("At least one routine item is required.")
    if len(items) > MAX_ITEMS:
        raise ValueError(f"Keep it to {MAX_ITEMS} items or fewer.")

    cleaned, seen = [], set()
    for raw in items:
        label = str((raw or {}).get("label") or "").strip()
        if not label:
            raise ValueError("Every item needs a name.")
        if len(label) > MAX_LABEL:
            raise ValueError(f"“{label[:18]}…” is too long — {MAX_LABEL} characters max.")

        code = str((raw or {}).get("code") or "").strip() or _slug(label)
        # A duplicate code would make two rows share one tick.
        while code in seen:
            code = f"{code}_{uuid.uuid4().hex[:4]}"
        seen.add(code)

        icon = str((raw or {}).get("icon") or "").strip() or "🐾"
        cleaned.append({"code": code, "label": label, "icon": icon[:4]})
    return cleaned


async def set_items(db, dog_id: str, items: list) -> list:
    cleaned = validate_items(items)
    await db[DAILY_CARE_ITEMS].update_one(
        {"dog_id": dog_id},
        {"$set": {"items": cleaned, "updated_at": datetime.now(timezone.utc)},
         "$setOnInsert": {"id": str(uuid.uuid4()), "dog_id": dog_id}},
        upsert=True,
    )
    logger.info("Routine care list updated for dog %s (%d items)", dog_id, len(cleaned))
    return cleaned


async def _shape(db, dog_id: str, day: str, done: dict) -> dict:
    """The card's whole state in one payload: the dog's items, their labels and
    icons, and whether each is ticked — so the client never keeps its own copy
    of the list and drifts from this one."""
    items = await get_items(db, dog_id)
    return {
        "dog_id": dog_id,
        "day": day,
        "items": [
            {
                "code": item["code"],
                "label": item["label"],
                "icon": item.get("icon") or "🐾",
                "done": item["code"] in done,
                "done_at": done.get(item["code"]).isoformat()
                if isinstance(done.get(item["code"]), datetime) else None,
            }
            for item in items
        ],
        "done_count": sum(1 for item in items if item["code"] in done),
        "total": len(items),
        "seconds_until_reset": seconds_until_reset(),
    }


async def get_day(db, dog_id: str, day: str = None) -> dict:
    day = day or today_key()
    row = await db[DAILY_CARE].find_one({"dog_id": dog_id, "day": day})
    return await _shape(db, dog_id, day, (row or {}).get("done") or {})


async def toggle(db, dog_id: str, item: str, done: bool, day: str = None) -> dict:
    """Tick or untick one item.

    Validated against THIS dog's list rather than the built-in defaults, so a
    custom habit can be ticked and a deleted one cannot."""
    codes = {i["code"] for i in await get_items(db, dog_id)}
    if item not in codes:
        raise ValueError(f"{item!r} is not one of this dog's routine items")
    day = day or today_key()
    now = datetime.now(timezone.utc)

    if done:
        update = {
            "$set": {f"done.{item}": now, "updated_at": now},
            "$setOnInsert": {"id": str(uuid.uuid4()), "dog_id": dog_id, "day": day},
        }
    else:
        update = {
            "$unset": {f"done.{item}": ""},
            "$set": {"updated_at": now},
            "$setOnInsert": {"id": str(uuid.uuid4()), "dog_id": dog_id, "day": day},
        }

    await db[DAILY_CARE].update_one({"dog_id": dog_id, "day": day}, update, upsert=True)
    return await get_day(db, dog_id, day)
