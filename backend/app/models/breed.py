from pydantic import BaseModel
from typing import List, Optional


class BreedBase(BaseModel):
    """One breed, as the RIGHTBREED engine needs it.

    The shape is the breeds.json record verbatim, because the scoring engine in
    breedUtils.js reads 24 of these fields directly. An earlier version of this
    model exposed a dozen presentational fields instead (image, shortDescription,
    exerciseNeeds…), which meant the API physically could not feed the engine:
    `minApartmentSize` was absent, so the only hard filter never fired, and
    `monthlyCostMin/Max` were absent, so every breed scored -24 on budget. The
    response has to carry what the consumer actually consumes.

    Everything except `name` is optional. A field the data happens to be
    missing is a gap to notice, not a reason to answer 500 for the whole list —
    which is exactly what strict typing did here.
    """

    # --- identity -----------------------------------------------------------
    name: str
    img: Optional[str] = None
    size: Optional[str] = None
    tags: List[str] = []

    # --- scored by the engine (breedUtils.computeMatches) --------------------
    purpose: Optional[str] = None
    climate: Optional[str] = None
    energy: Optional[str] = None
    risk: Optional[str] = None
    experienceLevel: Optional[str] = None
    minApartmentSize: Optional[str] = None
    house: Optional[str] = None
    monthlyCostMin: Optional[float] = None
    monthlyCostMax: Optional[float] = None
    shedding: Optional[str] = None
    hair: Optional[str] = None
    cuteness: Optional[str] = None
    #: India-suitability weighting; multiplied by 4 in the final score.
    score: Optional[float] = None

    # --- shown in the result copy (generateProsCons / buildLivingConditions) --
    grooming: Optional[str] = None
    time: Optional[str] = None
    nutrition: Optional[str] = None
    health: Optional[str] = None
    idealCities: Optional[str] = None
    apt: Optional[str] = None
    cost: Optional[str] = None
    puppyPrice: Optional[str] = None
    puppyPriceMin: Optional[float] = None
    puppyPriceMax: Optional[float] = None

    class Config:
        # Anything added to breeds.json later reaches the client without a model
        # change. The point of this endpoint is to BE the source of truth; a
        # model that silently drops new fields would recreate the drift it
        # exists to remove.
        extra = "allow"


class BreedInDB(BreedBase):
    id: Optional[str] = None


class BreedResponse(BreedBase):
    id: Optional[str] = None
