"""Dog Profile Service — the owner's dogs.

A dog profile is the anchor for everything medical: documents, vaccinations,
prescriptions and reminders all hang off its id, and the Health Records module
is only reachable once one exists. Keeping it in its own service means the
upload path can cheaply ask "does this dog exist?" without importing the vault.

Isolation is structural, not incidental. Every health collection stores
`dog_id`, every read filters on it, and deleting a dog removes exactly its own
rows — one owner's second dog can never surface the first dog's records.
"""
import logging

from app.models.dog_profile import DogProfile
from app.services import cloudinary_service
from app.services.ai_processing.validation import parse_iso_date
from app.services.health_status import today, utc_now

logger = logging.getLogger(__name__)

DOGS = "dog_profiles"

#: Every collection keyed by dog_id. Deleting a dog clears all of them, so no
#: orphaned medical data is left behind pointing at a dog that no longer exists.
DOG_SCOPED_COLLECTIONS = ("health_documents", "vaccinations", "prescriptions",
                          "dewormings", "reminders", "custom_reminders",
                          "schedule_dismissals")


def _clean(doc):
    if doc:
        doc.pop("_id", None)
    return doc


async def get(db, dog_id: str):
    return _clean(await db[DOGS].find_one({"id": dog_id}))


async def list_for_owner(db, owner_id: str) -> list:
    """An owner's dogs, oldest first so the list order is stable as more are added."""
    cursor = db[DOGS].find({"owner_id": owner_id}).sort("created_at", 1)
    return [_clean(dog) async for dog in cursor]


async def exists(db, dog_id: str) -> bool:
    return await db[DOGS].find_one({"id": dog_id}, {"_id": 1}) is not None


def validate(payload: dict) -> list:
    """Return a list of human-readable problems, empty when the profile is savable."""
    issues = []
    if not (payload.get("name") or "").strip():
        issues.append("a name")

    dob = parse_iso_date(payload.get("dob"))
    if dob is None:
        issues.append("a valid date of birth")
    elif dob > today():
        issues.append("a date of birth that isn't in the future")

    weight = payload.get("weight_kg")
    if weight is not None and (weight <= 0 or weight > 120):
        issues.append("a weight between 0 and 120 kg")
    return issues


async def create(db, owner_id: str, payload: dict) -> dict:
    """Create a dog and mint its id. Every later record is linked to that id."""
    dog = DogProfile(owner_id=owner_id, **_fields(payload))
    await db[DOGS].insert_one(dog.dict())
    logger.info("Created dog %s for owner %s", dog.id, owner_id)
    return dog.dict()


async def update(db, dog_id: str, payload: dict):
    """Update an existing dog in place, keeping its id, owner and created_at."""
    existing = await get(db, dog_id)
    if not existing:
        return None
    dog = DogProfile(
        id=dog_id,
        owner_id=existing["owner_id"],
        created_at=existing.get("created_at") or utc_now(),
        updated_at=utc_now(),
        **_fields(payload),
    )
    await db[DOGS].update_one({"id": dog_id}, {"$set": dog.dict()})
    return dog.dict()


def _fields(payload: dict) -> dict:
    return {
        "name": (payload.get("name") or "").strip(),
        "breed": (payload.get("breed") or None),
        "dob": (payload.get("dob") or "").strip(),
        "gender": (payload.get("gender") or None),
        "weight_kg": payload.get("weight_kg"),
        "city": (payload.get("city") or None),
        "photo_url": (payload.get("photo_url") or None),
        "photo_public_id": (payload.get("photo_public_id") or None),
        "health_complications": (payload.get("health_complications") or None),
    }


async def delete(db, dog_id: str) -> bool:
    """Remove a dog and every record that belongs to it, including the stored
    originals in Cloudinary. Nothing is left pointing at a deleted dog."""
    dog = await get(db, dog_id)
    if not dog:
        return False

    async for doc in db["health_documents"].find({"dog_id": dog_id}):
        await cloudinary_service.delete_document(
            doc.get("cloudinary_public_id"), doc.get("cloudinary_resource_type", "image"))
    if dog.get("photo_public_id"):
        await cloudinary_service.delete_document(dog["photo_public_id"], "image")

    for collection in DOG_SCOPED_COLLECTIONS:
        await db[collection].delete_many({"dog_id": dog_id})
    await db[DOGS].delete_one({"id": dog_id})
    logger.info("Deleted dog %s and all of its records", dog_id)
    return True


async def claim(db, dog_id: str, owner_id: str):
    """Attach a dog that predates owner ids to this owner.

    The first build stored a single dog against a per-device id with no owner.
    This lets the app adopt that dog on first load instead of stranding a real
    medical history behind the new multi-dog model."""
    dog = await get(db, dog_id)
    if not dog or dog.get("owner_id"):
        return None
    await db[DOGS].update_one({"id": dog_id},
                              {"$set": {"owner_id": owner_id, "updated_at": utc_now()}})
    return await get(db, dog_id)
