from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.models.breed import BreedResponse, BreedInDB
from app.database.connection import get_database

router = APIRouter()

@router.get("/", response_model=List[BreedResponse])
async def get_all_breeds():
    db = get_database()
    breeds_collection = db["breeds"]
    breeds = await breeds_collection.find().to_list(1000)
    return [BreedResponse(**b) for b in breeds]

@router.get("/{breed_id}", response_model=BreedResponse)
async def get_breed(breed_id: str):
    db = get_database()
    breeds_collection = db["breeds"]
    breed = await breeds_collection.find_one({"id": breed_id})
    if not breed:
        raise HTTPException(status_code=404, detail="Breed not found")
    return BreedResponse(**breed)
