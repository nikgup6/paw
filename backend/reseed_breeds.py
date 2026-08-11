"""Reseed the `breeds` collection from breeds.json — breeds only.

Deliberately separate from seed_data.py, which also rewrites `questions` from a
stale backend/questions.json that predates the purchase-timeline question.
Running that would silently drop Q10 from the seeded copy, so breed reseeding
gets its own entry point.

The collection is the source of truth the API serves, and breeds.json is the
file that populates it. Idempotent: run it whenever the file changes.

    python reseed_breeds.py            # reseed
    python reseed_breeds.py --check    # report drift, write nothing
"""
import asyncio
import json
import logging
import sys
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient

from app.config.settings import settings

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

BREEDS_FILE = Path(__file__).resolve().parent / "breeds.json"

#: Fields the RIGHTBREED scoring engine reads. A breed missing any of these
#: doesn't score correctly — and the failure is silent, because the engine
#: falls back to a default rather than raising. Verified before writing.
REQUIRED = (
    "name", "purpose", "climate", "energy", "risk", "experienceLevel",
    "minApartmentSize", "house", "monthlyCostMin", "monthlyCostMax",
    "shedding", "hair", "cuteness", "img",
)


def load() -> list:
    with open(BREEDS_FILE, "r", encoding="utf-8") as fh:
        return json.load(fh)


def validate(breeds: list) -> list:
    """Refuse to seed data the engine can't score. Better an aborted reseed than
    a collection that returns 200 and produces meaningless recommendations."""
    problems = []
    for breed in breeds:
        missing = [f for f in REQUIRED if breed.get(f) in (None, "")]
        if missing:
            problems.append(f"  {breed.get('name', '<unnamed>')}: missing {', '.join(missing)}")
    return problems


async def main(check_only: bool) -> int:
    breeds = load()
    logger.info("breeds.json: %d breeds, %d fields each", len(breeds), len(breeds[0]))

    problems = validate(breeds)
    if problems:
        logger.error("Refusing to seed — %d breed(s) are missing engine fields:", len(problems))
        for line in problems:
            logger.error(line)
        return 1

    client = AsyncIOMotorClient(settings.MONGODB_URI)
    try:
        db = client.get_default_database()
    except Exception:
        db = client["paw_buddy"]

    existing = await db["breeds"].count_documents({})
    logger.info("Mongo `breeds` currently holds %d document(s)", existing)

    if check_only:
        stored = {b["name"]: b async for b in db["breeds"].find({}, {"_id": 0})}
        drift = [b["name"] for b in breeds
                 if b["name"] not in stored
                 or any(stored[b["name"]].get(f) != b.get(f) for f in REQUIRED)]
        logger.info("Drift vs breeds.json: %d breed(s)%s",
                    len(drift), (" — " + ", ".join(drift[:6])) if drift else "")
        client.close()
        return 0

    await db["breeds"].delete_many({})
    await db["breeds"].insert_many([dict(b) for b in breeds])
    seeded = await db["breeds"].count_documents({})
    logger.info("Seeded %d breeds (was %d).", seeded, existing)
    client.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main("--check" in sys.argv)))
