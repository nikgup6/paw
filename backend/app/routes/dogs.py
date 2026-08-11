"""Dog routes (`/api/dogs`).

Thin controllers, same as the Health Vault router: every handler delegates to
dog_profile_service. Dogs are scoped to an owner, and every dog owns a
completely separate set of health records.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Query

from app.models.dog_profile import DogProfileIn
from app.services import cloudinary_service, dog_profile_service
from app.database.connection import get_database

router = APIRouter()

ALLOWED_PHOTO_MIME = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_PHOTO_BYTES = 5 * 1024 * 1024


def _require_db():
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database is unavailable. Please try again later.")
    return db


@router.get("")
async def list_dogs(owner_id: str = Query(...)):
    """Every dog this owner has. An empty list is the signal the app uses to
    show "add your first dog" instead of the dashboard."""
    db = _require_db()
    return await dog_profile_service.list_for_owner(db, owner_id)


@router.post("")
async def create_dog(payload: DogProfileIn, owner_id: str = Query(...)):
    """Create a dog and mint its id — saving this is what unlocks Health Records."""
    if not owner_id.strip():
        raise HTTPException(status_code=400, detail="An owner id is required.")
    data = payload.dict()
    issues = dog_profile_service.validate(data)
    if issues:
        raise HTTPException(status_code=422, detail=f"Please provide {', '.join(issues)}.")

    db = _require_db()
    return await dog_profile_service.create(db, owner_id.strip(), data)


@router.post("/photo")
async def upload_photo(file: UploadFile = File(...)):
    """Store a dog's photo and hand back its URL, which the profile then saves.

    Kept separate from the profile write so a photo can be changed on its own,
    and so a failed image upload never costs the owner the rest of the form."""
    if file.content_type not in ALLOWED_PHOTO_MIME:
        raise HTTPException(status_code=415, detail="Photos must be JPG, PNG or WebP.")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="The photo is empty.")
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="Photos must be under 5MB.")
    if not cloudinary_service.is_configured():
        raise HTTPException(status_code=503, detail="File storage is not configured on the server.")

    uploaded = await cloudinary_service.upload_photo(data, file.filename or "dog")
    return {"photo_url": uploaded["secure_url"], "photo_public_id": uploaded["public_id"]}


@router.get("/{dog_id}")
async def get_dog(dog_id: str):
    db = _require_db()
    dog = await dog_profile_service.get(db, dog_id)
    if not dog:
        raise HTTPException(status_code=404, detail="Dog not found.")
    return dog


@router.put("/{dog_id}")
async def update_dog(dog_id: str, payload: DogProfileIn):
    data = payload.dict()
    issues = dog_profile_service.validate(data)
    if issues:
        raise HTTPException(status_code=422, detail=f"Please provide {', '.join(issues)}.")

    db = _require_db()
    updated = await dog_profile_service.update(db, dog_id, data)
    if updated is None:
        raise HTTPException(status_code=404, detail="Dog not found.")
    return updated


@router.post("/{dog_id}/claim")
async def claim_dog(dog_id: str, owner_id: str = Query(...)):
    """Adopt a pre-multi-dog profile into this owner's list (see service docstring)."""
    db = _require_db()
    claimed = await dog_profile_service.claim(db, dog_id, owner_id)
    if claimed is None:
        raise HTTPException(status_code=404, detail="No unclaimed dog with that id.")
    return claimed


@router.delete("/{dog_id}")
async def delete_dog(dog_id: str):
    """Delete a dog and every record belonging to it."""
    db = _require_db()
    ok = await dog_profile_service.delete(db, dog_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Dog not found.")
    return {"status": "success"}
