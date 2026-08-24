"""Provider-agnostic AI access.

Business logic (the document processors) NEVER imports a vendor SDK — it only
calls `generate_structured_json()`. The concrete provider (Gemini / OpenAI /
Anthropic-Claude) is chosen by `settings.AI_PROVIDER`, so swapping providers
never touches processor or service logic.

Each vendor SDK is imported lazily inside its own function so a missing optional
SDK (e.g. openai) never breaks the others. Blocking SDK calls run in a threadpool.
"""
import base64
import json
import logging
import re

from starlette.concurrency import run_in_threadpool

from app.config.settings import settings

logger = logging.getLogger(__name__)

_gemini_client = None
_anthropic_client = None
_openai_client = None


def _provider_name() -> str:
    return (settings.AI_PROVIDER or "gemini").strip().lower()


def _model_name() -> str:
    p = _provider_name()
    return {
        "gemini": settings.GEMINI_MODEL,
        "openai": settings.OPENAI_MODEL,
        "anthropic": settings.ANTHROPIC_MODEL,
        "claude": settings.ANTHROPIC_MODEL,
    }.get(p, "unknown")


def is_configured() -> bool:
    p = _provider_name()
    if p == "gemini":
        return bool(settings.GEMINI_API_KEY)
    if p == "openai":
        return bool(settings.OPENAI_API_KEY)
    if p in ("anthropic", "claude"):
        return bool(settings.ANTHROPIC_API_KEY)
    return False


def _sdk_version(provider: str) -> str:
    try:
        if provider == "gemini":
            import google.genai as g
            return getattr(g, "__version__", "unknown")
        if provider == "openai":
            import openai
            return getattr(openai, "__version__", "unknown")
        if provider in ("anthropic", "claude"):
            import anthropic
            return getattr(anthropic, "__version__", "unknown")
    except Exception:
        pass
    return "unknown"


def provider_meta() -> dict:
    """Provenance for `ai_metadata` on the document."""
    p = _provider_name()
    return {"ai_provider": p, "ai_model": _model_name(), "ai_version": _sdk_version(p)}


async def generate_structured_json(prompt: str, file_bytes: bytes, mime_type: str):
    """Send a document + prompt to the configured provider and return parsed JSON.
    Raises on any failure so the caller can mark the document Failed."""
    if not is_configured():
        raise RuntimeError(f"AI provider '{_provider_name()}' is not configured (missing API key).")
    p = _provider_name()
    if p == "gemini":
        raw = await run_in_threadpool(_gemini_call, prompt, file_bytes, mime_type)
    elif p == "openai":
        raw = await run_in_threadpool(_openai_call, prompt, file_bytes, mime_type)
    elif p in ("anthropic", "claude"):
        raw = await run_in_threadpool(_anthropic_call, prompt, file_bytes, mime_type)
    else:
        raise RuntimeError(f"Unknown AI_PROVIDER: {p}")
    return json.loads(_strip_fences(raw))


def _strip_fences(text: str) -> str:
    """Remove ```json ... ``` fences some models add around JSON."""
    t = (text or "").strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*\s*", "", t)
        t = re.sub(r"\s*```$", "", t)
    return t.strip()


# ------------------------------- Gemini ------------------------------------- #
def _gemini_call(prompt: str, file_bytes: bytes, mime_type: str) -> str:
    global _gemini_client
    from google import genai
    from google.genai import types
    if _gemini_client is None:
        _gemini_client = genai.Client(
            api_key=settings.GEMINI_API_KEY,
            http_options=types.HttpOptions(timeout=60_000),
        )

    # Retry with exponential backoff for transient 503s. Gemini's "model is
    # currently experiencing high demand" is a capacity signal, not a permanent
    # failure — waiting a few seconds and retrying often succeeds. Three
    # attempts with 2s/4s/8s delays, then give up and let the document stay
    # Pending for a manual Reprocess.
    last_exc = None
    for attempt in range(3):
        try:
            response = _gemini_client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=[types.Part.from_bytes(data=file_bytes, mime_type=mime_type), prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json"),
            )
            return response.text
        except Exception as exc:
            last_exc = exc
            msg = str(exc).lower()
            # Only retry on overload / transient errors, not on auth or quota.
            if any(kw in msg for kw in ("503", "overloaded", "high demand", "unavailable", "429", "resource exhausted", "rate limit")):
                if attempt < 2:
                    delay = 2 ** (attempt + 1)  # 2, 4 seconds
                    logger.warning("Gemini transient error (attempt %d/3), retrying in %ds: %s", attempt + 1, delay, exc)
                    import time
                    time.sleep(delay)
                    continue
            raise
    raise last_exc


# ------------------------------ Anthropic ----------------------------------- #
def _anthropic_call(prompt: str, file_bytes: bytes, mime_type: str) -> str:
    global _anthropic_client
    import anthropic
    if _anthropic_client is None:
        _anthropic_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    b64 = base64.standard_b64encode(file_bytes).decode()
    if mime_type == "application/pdf":
        media = {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": b64}}
    else:
        media = {"type": "image", "source": {"type": "base64", "media_type": mime_type, "data": b64}}
    message = _anthropic_client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=1500,
        messages=[{"role": "user", "content": [media, {"type": "text", "text": prompt + "\n\nReturn ONLY valid JSON."}]}],
    )
    return "".join(getattr(b, "text", "") for b in message.content if getattr(b, "type", None) == "text")


# -------------------------------- OpenAI ------------------------------------ #
def _openai_call(prompt: str, file_bytes: bytes, mime_type: str) -> str:
    # Note: OpenAI vision takes images via data URL. PDF input needs the Files API
    # and is left for when OpenAI is actually enabled; Gemini (default) handles PDFs.
    global _openai_client
    from openai import OpenAI
    if _openai_client is None:
        _openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
    b64 = base64.standard_b64encode(file_bytes).decode()
    data_url = f"data:{mime_type};base64,{b64}"
    response = _openai_client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": data_url}},
        ]}],
    )
    return response.choices[0].message.content
