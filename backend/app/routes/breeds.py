"""Breed catalogue — the single source of truth the frontend scores against.

The response carries the full breed record, not a presentational subset,
because the consumer is the RIGHTBREED scoring engine and it reads 24 fields.
See models/breed.py for why.
"""
from typing import List

from fastapi import APIRouter, HTTPException

from app.database.connection import get_database
from app.models.breed import BreedResponse

router = APIRouter()

#: Mongo's own `_id` is an ObjectId and has no JSON representation. The model
#: allows extra fields (so a new column in breeds.json reaches the client
#: without a model change), which means `_id` would otherwise ride along and
#: fail serialisation for the whole list. Dropped at the query.
NO_MONGO_ID = {"_id": 0}


@router.get("/", response_model=List[BreedResponse])
async def get_all_breeds():
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    return await db["breeds"].find({}, NO_MONGO_ID).to_list(1000)


@router.get("/{breed_id}", response_model=BreedResponse)
async def get_breed(breed_id: str):
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    breed = await db["breeds"].find_one({"id": breed_id}, NO_MONGO_ID)
    if not breed:
        raise HTTPException(status_code=404, detail="Breed not found")
    return breed
