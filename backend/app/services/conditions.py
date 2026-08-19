"""What the weather is doing where this dog lives.

THE SWAP POINT. `conditions_for()` is the only function that decides what the
weather is; everything else consumes its output. Today it derives conditions
from the city's climate zone plus the server's month — no API key, no network
call, no cost, and it still works offline. Swapping in a live provider means
rewriting this one function to fetch and return the same shape, and nothing
upstream changes.

What is deliberately NOT done here: this does not write to, read from, or
substitute for the `city_season_calendar` table. That table is the owner's to
fill in, and its rows drive which season-tagged Care Tips are eligible. This
module only produces the advisory line the dashboard shows. Keeping them
separate means a derived guess can never masquerade as reviewed data.

`source` is part of the payload precisely so the UI can be honest about
whether a reading was measured or inferred.
"""
import json
import logging
from datetime import datetime, timezone
from functools import lru_cache

from app.config.settings import BACKEND_DIR

logger = logging.getLogger(__name__)

#: Broad season buckets by month, per climate zone. These are the coarse,
#: uncontroversial patterns of the Indian year (SW monsoon roughly Jun-Sep,
#: cool season Dec-Feb, hot build-up Mar-May), not a precise forecast.
_ZONE_MONTHS = {
    "HOT_HUMID": {
        (3, 4, 5): ("Hot", "hot and building humidity"),
        (6, 7, 8, 9): ("Warm", "warm, humid and wet"),
        (10, 11): ("Warm", "warm and drying out"),
        (12, 1, 2): ("Mild", "mild and pleasant"),
    },
    "HOT_DRY": {
        (3, 4, 5): ("Hot", "very hot and dry"),
        (6, 7, 8, 9): ("Warm", "warm with monsoon spells"),
        (10, 11): ("Mild", "mild and dry"),
        (12, 1, 2): ("Cool", "cool, dry and dusty"),
    },
    "MODERATE": {
        (3, 4, 5): ("Warm", "warm but not extreme"),
        (6, 7, 8, 9): ("Mild", "wet and mild"),
        (10, 11): ("Mild", "mild and dry"),
        (12, 1, 2): ("Cool", "cool mornings and evenings"),
    },
    "COLD": {
        (3, 4, 5): ("Mild", "mild spring"),
        (6, 7, 8, 9): ("Mild", "mild with rain"),
        (10, 11): ("Cool", "cold and clear"),
        (12, 1, 2): ("Cool", "genuinely cold"),
    },
}

#: Advisory shown alongside the tips. Written to be true of the whole bucket
#: rather than of a specific temperature, because no temperature is measured.
_ADVISORY = {
    ("HOT_HUMID", "Hot"): "Walk before sunrise or after dark, and keep shade and cool water available all day.",
    ("HOT_HUMID", "Warm"): "Humidity makes panting less effective — keep walks short and dry the coat properly after rain.",
    ("HOT_HUMID", "Mild"): "The easiest stretch of the year here. Good window for longer walks and grooming catch-up.",
    ("HOT_DRY", "Hot"): "Avoid midday entirely — pavement burns paws. Walk early, and watch for heavy panting.",
    ("HOT_DRY", "Warm"): "Warm with sudden downpours. Keep water topped up and dry the paws after wet walks.",
    ("HOT_DRY", "Mild"): "Comfortable conditions. A good time for longer outdoor activity.",
    ("HOT_DRY", "Cool"): "Cool and dusty — short-coated dogs may want a layer on early-morning walks.",
    ("MODERATE", "Warm"): "Warm but manageable. Still avoid the hottest part of the afternoon.",
    ("MODERATE", "Mild"): "Mild and wet — dry the coat and check between the toes after walks.",
    ("MODERATE", "Cool"): "Cool mornings. Older dogs may be stiffer first thing; give them a slower start.",
    ("COLD", "Cool"): "Cold — short-coated and senior dogs need a coat, and paws want checking after walks.",
    ("COLD", "Mild"): "Mild for the region. Comfortable for most outdoor activity.",
}


@lru_cache(maxsize=1)
def _city_zones() -> dict:
    """City -> climate zone, from the same cityZones.json the quiz uses."""
    try:
        with open(BACKEND_DIR / "cityZones.json", encoding="utf-8") as fh:
            return json.load(fh).get("cities", {})
    except Exception:
        logger.warning("cityZones.json unavailable; conditions will be generic", exc_info=True)
        return {}


def zone_for(city: str):
    if not city:
        return None
    if str(city).startswith("zone:"):
        return str(city)[5:]
    return _city_zones().get(city)


def conditions_for(city: str, month: int = None) -> dict:
    """Current conditions where this dog lives.

    Returns `season` (a Warm/Mild/Cool/Hot bucket), a short human `summary`,
    an `advisory` line, and `source` — currently always "derived", meaning
    inferred from climate zone and month rather than measured. A live weather
    integration replaces the body of this function and sets source="observed"
    plus a real `temp_c`; every caller keeps working unchanged.
    """
    month = month or datetime.now(timezone.utc).month
    zone = zone_for(city)

    if zone not in _ZONE_MONTHS:
        return {
            "city": city, "zone": zone, "season": None, "summary": None,
            "advisory": None, "temp_c": None, "source": "derived", "month": month,
        }

    season, summary = next(
        (value for months, value in _ZONE_MONTHS[zone].items() if month in months),
        ("Mild", "typical for the season"),
    )
    return {
        "city": city,
        "zone": zone,
        "season": season,
        "summary": summary,
        "advisory": _ADVISORY.get((zone, season)),
        # No temperature is measured today. Left null rather than estimated —
        # a made-up "28°C" would read as a reading.
        "temp_c": None,
        "source": "derived",
        "month": month,
    }
