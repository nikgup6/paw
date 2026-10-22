"""Dog routes (`/api/dogs`).

Thin controllers, same as the Health Vault router: every handler delegates to
dog_profile_service. Dogs are scoped to an owner, and every dog owns a
completely separate set of health records.

Every route needs a signed-in account. The owner is the account in the token,
never an owner_id from the URL (see app/auth/dog_access.py). Someone else's
dog answers 404, the same as a dog that does not exist.
"""
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, UploadFile, File, Query

from app.auth.dependencies import require_admin, require_user
from app.auth.dog_access import owned_dog
from app.models.dog_profile import DogProfileIn
from app.security import rate_limit as rl
from app.security import uploads
from app.services import cloudinary_service, dog_profile_service
from app.database.connection import get_database
from app.security.rate_limit import rate_limit

router = APIRouter()

MAX_PHOTO_BYTES = 5 * 1024 * 1024


def _require_db():
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database is unavailable. Please try again later.")
    return db


@router.get("")
async def list_dogs(owner_id: Optional[str] = Query(None, description="Ignored: the owner is the signed-in account"),
                    claims: dict = Depends(require_user)):
    """Every dog this account has. An empty list is the signal the app uses to
    show "add your first dog" instead of the dashboard."""
    db = _require_db()
    return await dog_profile_service.list_for_owner(db, claims["sub"])


@router.post("")
async def create_dog(payload: DogProfileIn,
                     owner_id: Optional[str] = Query(None, description="Ignored: the owner is the signed-in account"),
                     claims: dict = Depends(require_user)):
    """Create a dog and mint its id — saving this is what unlocks Health Records."""
    data = payload.dict()
    issues = dog_profile_service.validate(data)
    if issues:
        raise HTTPException(status_code=422, detail=f"Please provide {', '.join(issues)}.")

    db = _require_db()
    return await dog_profile_service.create(db, claims["sub"], data)


@router.post("/adopt-browser")
async def adopt_browser_dogs(browser_owner_id: str = Body(..., embed=True, min_length=8, max_length=80),
                             claims: dict = Depends(require_user)):
    """Move this browser's dogs (made before sign-in existed, owned by the
    browser's random id) to the signed-in account. The app sends the id once,
    from the browser that holds it. An id that belongs to an account is never
    accepted, so this cannot pull dogs out of someone else's account."""
    await rl.enforce("dogs_adopt", claims["sub"], whose="on your account")
    db = _require_db()
    if browser_owner_id == claims["sub"] or await db["users"].find_one({"id": browser_owner_id}):
        return {"moved": 0}
    return {"moved": await dog_profile_service.adopt_browser_dogs(db, browser_owner_id, claims["sub"])}


@router.post("/photo", dependencies=[Depends(rate_limit("uploads"))])
async def upload_photo(file: UploadFile = File(...), claims: dict = Depends(require_user)):
    """Store a dog's photo and hand back its URL, which the profile then saves.

    Kept separate from the profile write so a photo can be changed on its own,
    and so a failed image upload never costs the owner the rest of the form."""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="The photo is empty.")
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="Photos must be under 5MB.")

    # The type comes from the file's own bytes, not the browser's label or the
    # name (see security/uploads.py). Then it is re-saved without its metadata:
    # a phone photo usually carries the GPS position it was taken at.
    kind = uploads.sniff(data)
    if kind not in uploads.PHOTO_KINDS:
        raise HTTPException(status_code=415, detail="Photos must be JPG, PNG or WebP.")
    try:
        data = uploads.clean_image(data, kind)
    except uploads.UploadRejected:
        raise HTTPException(status_code=415, detail="That photo couldn't be read. Please try another JPG or PNG.")

    if not cloudinary_service.is_configured():
        raise HTTPException(status_code=503, detail="File storage is not configured on the server.")

    uploaded = await cloudinary_service.upload_photo(data)
    return {"photo_url": uploaded["secure_url"], "photo_public_id": uploaded["public_id"]}


@router.get("/{dog_id}")
async def get_dog(dog_id: str, claims: dict = Depends(require_user)):
    db = _require_db()
    await owned_dog(db, dog_id, claims)
    return await dog_profile_service.get(db, dog_id)


@router.put("/{dog_id}")
async def update_dog(dog_id: str, payload: DogProfileIn, claims: dict = Depends(require_user)):
    await owned_dog(_require_db(), dog_id, claims)
    data = payload.dict()
    issues = dog_profile_service.validate(data)
    if issues:
        raise HTTPException(status_code=422, detail=f"Please provide {', '.join(issues)}.")

    db = _require_db()
    updated = await dog_profile_service.update(db, dog_id, data)
    if updated is None:
        raise HTTPException(status_code=404, detail="Dog not found.")
    return updated


@router.post("/{dog_id}/claim", dependencies=[Depends(require_admin)])
async def claim_dog(dog_id: str, owner_id: str = Query(...)):
    """ADMIN ONLY. Attach a pre-multi-dog profile (no owner at all) to an owner.
    It was public and took the owner from the URL; owners now get their dogs
    through /adopt-browser on their own browser."""
    db = _require_db()
    claimed = await dog_profile_service.claim(db, dog_id, owner_id)
    if claimed is None:
        raise HTTPException(status_code=404, detail="No unclaimed dog with that id.")
    return claimed


@router.delete("/{dog_id}")
async def delete_dog(dog_id: str, claims: dict = Depends(require_user)):
    """Delete a dog and every record belonging to it."""
    db = _require_db()
    await owned_dog(db, dog_id, claims)
    ok = await dog_profile_service.delete(db, dog_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Dog not found.")
    return {"status": "success"}
