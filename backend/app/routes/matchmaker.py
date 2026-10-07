"""AI Matchmaker: Claude parses a natural-language prompt into the same
structured answers the lifestyle quiz produces. The frontend then runs the
RIGHTBREED scoring engine on those answers, so quiz and AI recommendations
share one code path.

The API key stays server-side (ANTHROPIC_API_KEY in backend/.env). When no
key is configured, the route answers with an empty payload and the frontend
falls back to its local keyword parser.
"""

from fastapi import APIRouter
from pydantic import BaseModel

from app.config.settings import settings

try:
    from anthropic import AsyncAnthropic
except ImportError:  # anthropic not installed yet — fallback mode
    AsyncAnthropic = None

router = APIRouter()

MODEL = "claude-haiku-4-5"

SYSTEM_PROMPT = """You extract structured dog-matchmaking preferences from a prospective Indian dog owner's message.

Map what the user says onto the answer values. Only commit to a value the message actually supports; use "unknown" (or an empty array) when the message says nothing about that dimension. Notes:
- city is a climate zone, using the SAME mapping as the quiz (frontend config/cityZones.json): "zone:HOT_HUMID" = humid coastal/eastern cities (Mumbai, Chennai, Kolkata, Kochi, Goa, Vizag, Bhubaneswar, Guwahati); "zone:HOT_DRY" = hot, drier inland cities (Hyderabad, Secunderabad, Delhi NCR, Jaipur, Lucknow, Ahmedabad, Nagpur, Warangal); "zone:MODERATE" = Bengaluru, Pune, Chandigarh, Mysuru, Coimbatore; "zone:COLD" = hill stations (Shimla, Ooty, Darjeeling, Srinagar, Dehradun). If they say "hot" without a city, use "zone:HOT_HUMID". Use "unknown" if climate is not mentioned.
- budget is monthly care budget in INR.
- family describes who lives at home (kids / seniors / both / adults only).
- purpose may have several values; "therapy" covers emotional support and companionship for loneliness/stress.
- flooring: "hard" for tile, marble, granite or stone — the Indian default, so prefer it unless carpet/rugs are actually mentioned; "carpeted" only if they describe carpet or rugs throughout; "mixed" if they mention both.
- schedule is how long the dog would typically be alone on a workday: "home" if someone's nearly always there (WFH, retired, stay-at-home parent); "8h-plus" for a standard full-time office job or long commute; "4-8h" for part-time, hybrid, or a shorter office day; "up-to-4h" only for brief outings, not a working day.
- trainingEffort is how much training time they're signalling, not how experienced they are: "minimal" if they want a low-maintenance, easy dog; "committed" if they mention training seriously, working with a trainer, or a demanding breed on purpose; "moderate" otherwise.
- home's "pg" is paying-guest or shared accommodation, not a small flat — don't conflate the two. Use "still-figuring-out" only if they explicitly say they haven't decided where they'll be living, not just because home type wasn't mentioned — that case is "unknown"."""

ANSWERS_SCHEMA = {
    "type": "object",
    "properties": {
        "purpose": {
            "type": "array",
            "items": {"type": "string", "enum": ["family", "guard", "active", "therapy", "seniors"]},
        },
        "home": {
            "type": "string",
            "enum": ["apt-1bhk", "apt-2bhk", "apt-3bhk", "house-no-yard", "house-yard", "pg", "still-figuring-out", "unknown"],
        },
        "city": {"type": "string", "enum": ["zone:HOT_HUMID", "zone:HOT_DRY", "zone:MODERATE", "zone:COLD", "unknown"]},
        "experience": {"type": "string", "enum": ["none", "some", "experienced", "unknown"]},
        "activity": {
            "type": "array",
            "items": {"type": "string", "enum": ["relaxed", "moderate", "high"]},
        },
        "budget": {"type": "string", "enum": ["under5k", "5k-10k", "10k-20k", "above20k", "unknown"]},
        "family": {"type": "string", "enum": ["kids", "seniors", "both", "adults", "unknown"]},
        "flooring": {"type": "string", "enum": ["hard", "mixed", "carpeted", "unknown"]},
        "schedule": {"type": "string", "enum": ["home", "up-to-4h", "4-8h", "8h-plus", "unknown"]},
        "trainingEffort": {"type": "string", "enum": ["minimal", "moderate", "committed", "unknown"]},
        "hair": {
            "type": "array",
            "items": {"type": "string", "enum": ["short", "medium", "long", "any"]},
        },
    },
    "required": ["purpose", "home", "city", "experience", "activity", "budget", "family", "flooring", "schedule", "trainingEffort", "hair"],
    "additionalProperties": False,
}


class MatchmakerRequest(BaseModel):
    prompt: str


@router.post("/parse")
async def parse_prompt(request: MatchmakerRequest):
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key or AsyncAnthropic is None:
        # No key configured — frontend uses its local parser
        return {"answers": {}, "source": "none"}

    try:
        client = AsyncAnthropic(api_key=api_key)
        response = await client.messages.create(
            model=MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": request.prompt[:2000]}],
            output_config={"format": {"type": "json_schema", "schema": ANSWERS_SCHEMA}},
        )

        import json

        text = next((b.text for b in response.content if b.type == "text"), "{}")
        raw = json.loads(text)

        # Drop unknowns and normalise everything to arrays (quiz answer shape)
        answers = {}
        for key, value in raw.items():
            if isinstance(value, list):
                if value:
                    answers[key] = value
            elif value and value != "unknown":
                answers[key] = [value]

        return {"answers": answers, "source": "ai"}
    except Exception as exc:  # any API failure → frontend local fallback
        print(f"Matchmaker parse failed: {exc}")
        return {"answers": {}, "source": "error"}
