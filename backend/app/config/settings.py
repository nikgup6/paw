"""Every setting the backend reads, and the rules it refuses to start without.

SECRETS HAVE NO DEFAULTS. MONGODB_URI and SECRET_KEY used to be written into
this file as default values. That meant the running app quietly used the copy
in the source code whenever backend/.env did not set them - and it did not:
every login token the app issued was signed with a key anyone holding the code
could read, which is enough to forge an admin token. Now a missing value stops
the app at startup with a message naming the variable, and the values live only
in environment variables:

  - on this machine: backend/.env (git-ignored; see backend/.env.example)
  - on Vercel:       Project -> Settings -> Environment Variables

ENV=production adds two more rules for SECRET_KEY: at least 32 characters, and
not something that looks like a placeholder. Generate one with:

    python scripts/gen_secret.py

Error messages from this module name the setting and the reason. They never
print a value - not even a rejected one.
"""
from datetime import date
from pathlib import Path
from typing import Literal, Optional

from pydantic import ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings

# backend/app/config/settings.py -> backend/
BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"

#: A production SECRET_KEY containing any of these was copied from an example or
#: typed by hand, not generated. Lower-case, matched anywhere in the key.
PLACEHOLDER_HINTS = (
    "change", "placeholder", "paste", "your", "example", "default", "secret",
    "password", "xxxx", "todo", "replace", "insert", "dummy", "sample",
)
MIN_PRODUCTION_KEY_LENGTH = 32


class ConfigError(RuntimeError):
    """The app cannot start with the configuration it was given."""


def looks_like_placeholder(value: str) -> bool:
    """True for keys a person typed or copied rather than generated.

    Also catches low-variety keys ("aaaa...", "12341234...") - a generated key of
    32+ characters uses dozens of distinct characters, so fewer than 10 is a
    pattern, not randomness."""
    v = (value or "").strip().lower()
    return any(h in v for h in PLACEHOLDER_HINTS) or len(set(v)) < 10


class Settings(BaseSettings):
    PROJECT_NAME: str = "Paw Buddy API"

    #: "dev" on a laptop, "production" on the live server. Production turns on the
    #: stricter checks below (and, in later steps, closes the API docs).
    ENV: Literal["dev", "production"] = "dev"

    # --- secrets: required, no defaults ------------------------------------------
    MONGODB_URI: str
    SECRET_KEY: str

    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    #: How long an ordinary visitor's token lasts. With no mobile sign-in, the
    #: token IS the account (it lives in that browser), so it is long. Admin
    #: tokens are capped at 2 hours regardless (routes/auth.py).
    USER_TOKEN_DAYS: int = 30

    #: Which websites may call this API from a browser, comma separated, exact
    #: origins only (scheme + host + port, no path, no trailing slash). A wildcard
    #: is refused. On the live server set it to the frontend's real address, e.g.
    #: CORS_ORIGINS=https://pawbuddy.in,https://www.pawbuddy.in
    CORS_ORIGINS: str = "http://localhost:5173"

    #: How many proxies sit in front of the app and append to X-Forwarded-For.
    #: 0 = none (a laptop): use the connection's own address. 1 = one proxy, which
    #: is what Vercel is. Wrong in either direction is bad: too low and every
    #: visitor looks like the proxy (all share one rate limit); too high and a
    #: visitor can fake their address. See app/security/rate_limit.py.
    TRUSTED_PROXY_COUNT: int = 0

    #: Paid AI matchmaker calls allowed per day (India time), across everyone.
    #: After that the route returns the empty fallback and the browser's own
    #: keyword parser takes over, so visitors still get matches.
    MATCHMAKER_DAILY_CAP: int = 300

    # --- Paywall (routes/paywall.py) ----------------------------------------------
    #: off       no paywall; everything works as before (the rollback switch)
    #: fake_door the pilot default: the sheet shows the price, "Pay" takes NO
    #:           money, records the intent and unlocks for free
    #: test      Razorpay TEST keys: the real flow with pretend money
    #: live      Razorpay LIVE keys. Set this by hand on the host, never in code.
    PAYWALL_MODE: Literal["off", "fake_door", "test", "live"] = "fake_door"
    PAYWALL_PRICE_PAISE: int = 9900          # Rs 99. Razorpay's minimum is 100 paise.
    PAYWALL_UNLOCK_DAYS: int = 30
    #: The key id is public (the browser needs it to open Checkout). The secret and
    #: the webhook secret never leave the server.
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    RAZORPAY_WEBHOOK_SECRET: Optional[str] = None

    # ---- Pilot dashboard (GET /api/funnel/pilot-report). Read-only: these only
    # decide what the admin page shows, never what a visitor sees.
    PILOT_START: str = "2026-10-20"              # ISO date, inclusive
    PILOT_END: str = "2026-11-09"                # ISO date, inclusive
    PILOT_TARGET_SIGNUPS: int = 150
    #: Blank means "not set": the dashboard tile then says "set a target".
    PILOT_TARGET_PAYERS: Optional[int] = None
    #: The pilot price, for "would-be revenue" in fake-door mode. Real revenue is
    #: always summed from the payments collection, never from this number.
    PILOT_PRICE_PAISE: int = 9900
    #: Your own and your team's mobile numbers, comma separated. Their sessions
    #: and payments are left out of the pilot numbers (a toggle brings them back).
    #: Numbers are unverified, so this is a filter, not proof of who someone is.
    INTERNAL_TEST_MOBILES: str = ""

    #: TEMPORARY (delete with the endpoint when OTP is live): 10-digit numbers that
    #: may use POST /api/auth/legacy-login, number-only sign-in for existing dog
    #: owners. Blank = nobody. Only the team's own numbers belong here.
    LEGACY_MOBILE_LOGIN_ALLOWLIST: str = ""

    # No longer read anywhere (admin sign-in is mobile-only, same as every
    # other account) - kept as a declared field only so an existing
    # backend/.env entry doesn't crash Settings() under extra_forbidden.
    ADMIN_PASSWORD: Optional[str] = None

    # Whether boot-time database setup (indexes, readiness seed, legacy-tier
    # migration) runs inside the app's startup event.
    #
    # Leave True for a long-lived server, where it runs once and costs nothing.
    # Set False on serverless - on Vercel every cold start is a fresh process,
    # so this work is redone before the first request can be served: ~51
    # create_index round trips to Atlas plus a seed and a migration, which is
    # seconds of latency charged to whichever user happened to arrive first.
    # With it False, run `python init_db.py` once per deploy instead; the
    # operations are idempotent, so running it more often is harmless.
    RUN_STARTUP_MIGRATIONS: bool = True

    ANTHROPIC_API_KEY: Optional[str] = None  # set in backend/.env for the AI Matchmaker

    # Cloudinary - stores uploaded vaccination documents. Set either the three
    # split vars, OR a single CLOUDINARY_URL, in backend/.env.
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None
    CLOUDINARY_URL: Optional[str] = None
    CLOUDINARY_UPLOAD_FOLDER: str = "paw_buddy/vaccination_records"

    # AI processing - provider-agnostic. AI_PROVIDER picks the backend used by the
    # Health Vault: "gemini" (default), "openai", or "anthropic". Business logic
    # never depends on which one is set.
    AI_PROVIDER: str = "gemini"
    # A record must reach this confidence AND pass validation to auto-create a
    # reminder; anything below is routed to Needs Review for user confirmation.
    AI_AUTO_REMINDER_THRESHOLD: float = 0.8

    # Google Gemini (default provider)
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # OpenAI (optional alternative provider)
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Anthropic / Claude (optional alternative provider; ANTHROPIC_API_KEY above)
    ANTHROPIC_MODEL: str = "claude-sonnet-4-5"

    # Weather integration - live weather for the Dashboard Care Tips card,
    # layered on top of the static zone_for_city() lookup. A blank key makes the
    # Dashboard tips behave exactly as before (silent fallback to the static
    # zone). Declared here so the .env entries load under the model's
    # extra=forbid policy. WEATHER_API_PROVIDER selects the backend behind the
    # single get_current_weather() function ("openweathermap" by default).
    WEATHER_API_KEY: Optional[str] = None
    WEATHER_API_PROVIDER: str = "openweathermap"

    class Config:
        # Absolute path: a bare ".env" resolves against the process working
        # directory, so starting uvicorn from anywhere other than backend/ would
        # silently load no config at all (uploads then fail with "storage is not
        # configured"). Anchoring to BACKEND_DIR makes it work from any CWD.
        env_file = str(ENV_FILE)

    @field_validator("PAYWALL_MODE", mode="before")
    @classmethod
    def _mode_lowercase(cls, v):
        return str(v).strip().lower() if v is not None else v

    @field_validator("PILOT_TARGET_PAYERS", mode="before")
    @classmethod
    def _blank_is_unset(cls, v):
        # "PILOT_TARGET_PAYERS=" in .env arrives as an empty string.
        return None if v is None or str(v).strip() == "" else v

    @field_validator("ENV", mode="before")
    @classmethod
    def _env_lowercase(cls, v):
        # "Production" and " production " are obviously meant as production.
        return str(v).strip().lower() if v is not None else v

    @property
    def legacy_login_allowlist(self) -> set:
        """LEGACY_MOBILE_LOGIN_ALLOWLIST as a set of 10-digit numbers."""
        return self._mobiles(self.LEGACY_MOBILE_LOGIN_ALLOWLIST)

    @property
    def internal_test_mobiles(self) -> set:
        """INTERNAL_TEST_MOBILES as a set of 10-digit numbers (+91 / 0 dropped)."""
        return self._mobiles(self.INTERNAL_TEST_MOBILES)

    @staticmethod
    def _mobiles(value: str) -> set:
        out = set()
        for raw in (value or "").split(","):
            digits = "".join(ch for ch in raw if ch.isdigit())
            if len(digits) == 12 and digits.startswith("91"):
                digits = digits[2:]
            elif len(digits) == 11 and digits.startswith("0"):
                digits = digits[1:]
            if len(digits) == 10:
                out.add(digits)
        return out

    @property
    def cors_origins(self) -> list:
        """CORS_ORIGINS as a list: trimmed, empties dropped, trailing '/' removed
        (a browser sends "https://pawbuddy.in", never "https://pawbuddy.in/", so
        the slash would make the entry silently never match)."""
        return [o.strip().rstrip("/") for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @model_validator(mode="after")
    def _refuse_unsafe(self):
        problems = []
        if any("*" in o for o in self.cors_origins):
            problems.append("CORS_ORIGINS must list exact origins - a wildcard (*) is not allowed")
        if not 0 <= self.TRUSTED_PROXY_COUNT <= 5:
            problems.append("TRUSTED_PROXY_COUNT must be between 0 and 5")
        if self.MATCHMAKER_DAILY_CAP < 0:
            problems.append("MATCHMAKER_DAILY_CAP cannot be negative")
        if self.USER_TOKEN_DAYS < 1:
            problems.append("USER_TOKEN_DAYS must be at least 1")
        if self.PAYWALL_PRICE_PAISE < 100:
            problems.append("PAYWALL_PRICE_PAISE must be at least 100 (Razorpay's minimum)")
        for name in ("PILOT_START", "PILOT_END"):
            try:
                date.fromisoformat(getattr(self, name))
            except ValueError:
                problems.append(f"{name} must be an ISO date like 2026-10-20")
        if self.PAYWALL_UNLOCK_DAYS < 1:
            problems.append("PAYWALL_UNLOCK_DAYS must be at least 1")
        if self.PAYWALL_MODE in ("test", "live"):
            if not (self.RAZORPAY_KEY_ID and self.RAZORPAY_KEY_SECRET):
                problems.append(f"PAYWALL_MODE={self.PAYWALL_MODE} needs RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET")
            elif not self.RAZORPAY_KEY_ID.startswith(f"rzp_{self.PAYWALL_MODE}_"):
                # A test key in live mode (or the reverse) would silently take no
                # money, or real money while you think you are testing.
                problems.append(f"PAYWALL_MODE={self.PAYWALL_MODE} needs a rzp_{self.PAYWALL_MODE}_ key id")
        if self.PAYWALL_MODE == "live" and not self.RAZORPAY_WEBHOOK_SECRET:
            problems.append("PAYWALL_MODE=live needs RAZORPAY_WEBHOOK_SECRET (payments made in a UPI app arrive by webhook)")
        if self.ENV == "production" and not self.cors_origins:
            problems.append("CORS_ORIGINS is empty, so the live frontend could not call the API")
        if not self.MONGODB_URI.strip():
            problems.append("MONGODB_URI is set but empty")
        if not self.SECRET_KEY.strip():
            problems.append("SECRET_KEY is set but empty")
        if self.ENV == "production" and self.SECRET_KEY.strip():
            if len(self.SECRET_KEY.strip()) < MIN_PRODUCTION_KEY_LENGTH:
                problems.append(
                    f"SECRET_KEY is shorter than {MIN_PRODUCTION_KEY_LENGTH} characters")
            if looks_like_placeholder(self.SECRET_KEY):
                problems.append("SECRET_KEY looks like a placeholder, not a generated key")
        if problems:
            raise ValueError("; ".join(problems))
        return self


def _load() -> Settings:
    """Build Settings, or stop with a message that names settings, never values.

    pydantic's own ValidationError text includes the rejected input
    ('input_value=...'), so it is caught and rewritten here, and re-raised with
    'from None' so the original - value and all - is not chained into the
    traceback either."""
    try:
        return Settings()
    except ValidationError as exc:
        reasons = []
        for err in exc.errors():
            field = ".".join(str(p) for p in err.get("loc", ())) or "configuration"
            kind = err.get("type", "")
            if kind == "missing":
                reasons.append(f"{field} is not set")
            elif kind == "extra_forbidden":
                reasons.append(f"{field} is not a setting this app knows (typo?)")
            else:
                # pydantic's 'msg' describes the rule, never the input value.
                msg = err.get("msg", "invalid").replace("Value error, ", "")
                # whole-model rules (the production checks) have no field of their own
                reasons.append(msg if field == "configuration" else f"{field}: {msg}")
        raise ConfigError(
            "The backend cannot start:\n  - " + "\n  - ".join(reasons) +
            f"\nSet these in {ENV_FILE} (copy backend/.env.example) or in the host's "
            "environment settings. Generate a SECRET_KEY with: python scripts/gen_secret.py"
        ) from None


settings = _load()
