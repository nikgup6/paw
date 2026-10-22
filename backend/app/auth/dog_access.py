"""Who may touch a dog profile and its records.

Every dog-scoped route (dogs, daily care, health vault, the legacy
vaccination-documents alias, care tips for a dog) needs a signed-in account,
and the owner is ALWAYS the account in the token (`sub`) - never an owner_id
sent in the URL or the body.

A dog that is not yours answers exactly like a dog that does not exist: 404.
A 403 would confirm the id is real, which lets someone probe for ids.
Admins may open any dog.
"""
from typing import Optional

from fastapi import HTTPException

DOGS = "dog_profiles"


def is_admin(claims: Optional[dict]) -> bool:
    return bool(claims) and claims.get("role") == "ADMIN"


async def owned_dog(db, dog_id: str, claims: dict, detail: str = "Dog not found.") -> dict:
    """The dog, if this account owns it (or is an admin). Otherwise 404."""
    dog = await db[DOGS].find_one({"id": dog_id}) if dog_id else None
    if not dog or (dog.get("owner_id") != claims.get("sub") and not is_admin(claims)):
        raise HTTPException(status_code=404, detail=detail)
    return dog


async def owned_record(db, collection: str, record_id: str, claims: dict, what: str) -> dict:
    """A record that belongs to a dog (a document, a shot, a prescription, a
    reminder): checked through its dog. Same 404 whether the record is missing
    or simply not yours."""
    detail = f"{what} not found."
    row = await db[collection].find_one({"id": record_id}) if record_id else None
    if not row:
        raise HTTPException(status_code=404, detail=detail)
    await owned_dog(db, row.get("dog_id"), claims, detail=detail)
    return row
