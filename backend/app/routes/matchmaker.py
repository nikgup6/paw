"""AI Matchmaker: Claude parses a natural-language prompt into the same 9
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
- city refers to climate. Indian city hints: Mumbai/Chennai/Kolkata/Kochi/Goa/Hyderabad = hot; Bangalore/Pune/Chandigarh/Mysore = moderate; Delhi/Jaipur/Lucknow/Ahmedabad = mixed; hill stations (Shimla, Ooty, Darjeeling, Srinagar) = cold.
- budget is monthly care budget in INR.
- family describes who lives at home (kids / seniors / both / adults only).
- shedding: "low" means the user wants minimal shedding; "fine" means they explicitly don't mind hair.
- purpose may have several values; "therapy" covers emotional support and companionship for loneliness/stress."""

ANSWERS_SCHEMA = {
    "type": "object",
    "properties": {
        "purpose": {
            "type": "array",
            "items": {"type": "string", "enum": ["family", "guard", "active", "therapy", "seniors"]},
        },
        "home": {
            "type": "string",
            "enum": ["apt-1bhk", "apt-2bhk", "apt-3bhk", "house-no-yard", "house-yard", "unknown"],
        },
        "city": {"type": "string", "enum": ["hot", "moderate", "mixed", "cold", "unknown"]},
        "experience": {"type": "string", "enum": ["none", "some", "experienced", "unknown"]},
        "activity": {
            "type": "array",
            "items": {"type": "string", "enum": ["relaxed", "moderate", "high"]},
        },
        "budget": {"type": "string", "enum": ["under5k", "5k-10k", "10k-20k", "above20k", "unknown"]},
        "family": {"type": "string", "enum": ["kids", "seniors", "both", "adults", "unknown"]},
        "shedding": {"type": "string", "enum": ["fine", "moderate", "low", "unknown"]},
        "hair": {
            "type": "array",
            "items": {"type": "string", "enum": ["short", "medium", "long", "any"]},
        },
    },
    "required": ["purpose", "home", "city", "experience", "activity", "budget", "family", "shedding", "hair"],
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
