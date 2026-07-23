from pydantic import BaseModel, Field
from typing import List, Optional

class BreedBase(BaseModel):
    name: str
    image: str
    shortDescription: str
    fullDescription: Optional[str] = None
    purpose: str
    climate: str
    exerciseNeeds: str
    monthlyCost: str
    idealCities: str
    bestLivingConditions: List[str]
    tags: List[str]

class BreedInDB(BreedBase):
    id: str

class BreedResponse(BreedBase):
    id: str
