"""The two shapes behind the acquisition funnel.

`Event` is an append-only fact: something happened, at a time, in a session.
Nothing ever updates one. `QuizProgress` is the opposite — one mutable row per
session, rewritten on every answer, so a quiz abandoned at question 4 still
leaves four answers on file instead of nothing at all.

Keeping them apart is the point. Counts and drop-off come from the log, which
can't be rewritten after the fact; "who is mid-quiz right now" comes from the
row, which is always current. One collection could not honestly do both.
"""
import re
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from app.models.vaccination import utc_now

from app.services.readiness import CODES as READINESS_CODES  # noqa: F401  (re-export)

#: The funnel, in order. Every dashboard number is derived from these six.
#: `site_visit` is first: it is the "Visited" step that everything else is
#: measured against. Older dates have no site_visit rows; the report copes.
FUNNEL_EVENTS = (
    "site_visit",
    "quiz_started",
    "quiz_completed",
    "results_viewed",
    "breeder_cta_clicked",
    "contact_submitted",
)

#: Everything the client is allowed to write. An unknown event name is rejected
#: rather than stored: the log is only useful if a typo in one deploy can't
#: quietly create a second, near-identical event that splits a funnel step.
KNOWN_EVENTS = FUNNEL_EVENTS + (
    "question_viewed",
    "question_answered",
    "timeline_selected",
    "login_started",
    "login_completed",
    # Reserved for when real OTP sign-in exists; nothing fires it yet. The pilot
    # dashboard shows it as "not live yet" until it does.
    # KEEP THIS: OTP is coming later; do not delete it as "unused".
    "otp_verified",
    # --- added with the real-journey tracking (Home.jsx, not the old /quiz page) ---
    "cta_click",  # homepage hero / sticky bar button, props.source says which
    "hero_cta_clicked", "journey_selected", "section_completed", "quiz_exit",
    "reveal_shown", "reveal_skipped",
    "breed_opened", "breeder_whatsapp_opened", "breeder_call_clicked", "share_clicked", "compare_opened",
    "retake_clicked", "explore_opened",
    "swipe_open", "swipe_shortlist", "swipe_pass", "swipe_undo", "swipe_find_breeders",
    "share_completed", "share_failed",  # share_clicked already exists; these close the share flow
    "stickers_open", "stickers_save", "stickers_send", "stickers_download_all",
    # Fun features: quiz dog, avatar card, walk-the-dog game, bark mixer
    "dog_react",
    "avatar_card_opened", "avatar_card_created", "avatar_card_shared", "avatar_card_downloaded",
    "game_started", "game_over", "game_cta_clicked",
    "game_fallback_used",  # the 3D game could not run, so the 2D one was shown (props.reason)
    "toy_squeaked",  # a squeaky toy was tapped (props: toy, page; at most once per toy per page per session)
    "zoomies_played",  # the dog-sprint burst after the drumroll in the match reveal (props: dogs, label)
    "bark_played", "bark_remix_opened", "bark_remix_saved",
    # Lead gate (not fired yet; the UI-fixes work will fire them)
    "gate_viewed", "gate_submitted", "gate_skipped",
    # Heat check (/heat-check): the "will this breed survive my city" lookup.
    "heat_check_viewed", "heat_check_result", "heat_check_shared",
    # Sticker packs: per-breed WhatsApp-style stickers on the results page and /stickers.
    "sticker_pack_viewed", "sticker_shared", "sticker_pack_downloaded",
    # "A day with your dog": the puppy-day story opened from a Top-5 match card.
    # Breed name only — never any quiz answer, and never the city.
    "day_opened", "day_scene_viewed", "day_completed", "day_closed",
    # Home hero. The hero's own CTA keeps firing "cta_click" with props.source
    # ('hero' / 'sticky_bar'), so there is no hero_cta_click: these are only the
    # things the hero did not report before. (A third, hero_badge_tap, went with the
    # dog badges when they were removed on 2026-10-20.)
    "hero_toy_tap",     # a hero toy was squeezed (props: toy)
    "hero_breed_tap",   # a breed thumbnail was tapped (props: breed)
    # Paywall (prompt 1). paywall_viewed, payment_dismissed and payment_failed come
    # from the browser; payment_started and payment_success are written by the
    # server only - see SERVER_ONLY_EVENTS below.
    "paywall_viewed", "payment_started", "payment_success", "payment_failed",
    "free_part_completed",   # the last free quiz screen was answered
    "rough_rec_viewed",      # the rough recommendation was shown (props: breeds, as one text)
    "paywall_cta_clicked",   # "Unlock my full match" on the rough card (props: source)
    "payment_dismissed",     # Razorpay Checkout closed without paying
    "unlock_continued",      # the quiz resumed with Part 2 after unlocking
    # "Was this useful?" pop-up (components/results/ResultsPulse.jsx). Codes only:
    # never the comment, never a name, number or email.
    "pulse_shown",           # the card appeared (props: kind = paid|dismissed|none, version)
    "pulse_answered",        # props: useful = yes|some|no
    "pulse_dismissed",       # closed or skipped (props: step = useful|breed_known|price_fair|not_paid_reason)
    "screener_answered",     # props: key, answer (codes)
    # Anonymous entry funnel (Pilot tab, "Entry funnel"): session id only, codes only.
    "find_dog_clicked",      # any button that starts the quiz (props: source, has_account)
    "contact_form_viewed",   # the contact form appeared (once per session)
    "contact_form_started",  # first tap or keystroke in it (once per session)
    "contact_form_error",    # submit blocked (props: field = name|mobile|email, or reason = rate_limited|network)
    "contact_form_closed",   # left the form without an account being created (once per session)
    # The paywall sheet closed WITHOUT paying (payment_dismissed keeps its own
    # meaning: Razorpay's checkout window closed).
    "paywall_dismissed",     # props: how = x | outside | esc | back
    "paywall_abandoned",     # page hidden or closed with the sheet open (beacon, once per session)
    "not_unlocked_asked",    # the "What stopped you from unlocking?" card appeared (props: moment = dismissed | next_visit)
)

#: Known names that only server code may write. A browser could otherwise post
#: "payment_success" and make the dashboard count money that never arrived.
#: services/paywall_service.py writes both with record_event(..., trusted=True):
#: payment_started when an order is created (that IS the Pay tap), payment_success
#: only after Razorpay's signature checks out. payment_failed is allowed from the
#: browser: it says "not charged", it claims no money.
SERVER_ONLY_EVENTS = frozenset({"payment_started", "payment_success"})

#: Shape rules for events and progress coming from the browser. Every event the
#: site sends today fits easily: the largest has about 6 props, all short text,
#: numbers or true/false.
MAX_PROPS = 20
MAX_PROP_CHARS = 200
#: session_id / user_id / visitor_id: a browser UUID (36 chars) or the fallback
#: "sid-<time>-<random>" - letters, digits, - and _ only, 8 to 64 long.
SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
#: prop names: plain identifiers, so nothing like "$where" or "a.b" reaches Mongo.
SAFE_KEY = re.compile(r"^[A-Za-z0-9_]{1,40}$")


def safe_id(value) -> bool:
    return isinstance(value, str) and bool(SAFE_ID.match(value))


def public_event_problem(event: dict) -> Optional[str]:
    """Why a browser-sent event must be refused, or None if it is fine.

    Returns a short reason (stored on the rejected-events counter), never raises."""
    if event.get("event_name") in SERVER_ONLY_EVENTS:
        return "server-only event"
    if not safe_id(event.get("session_id")):
        return "bad session_id"
    if event.get("user_id") is not None and not safe_id(event.get("user_id")):
        return "bad user_id"
    props = event.get("props") or {}
    if not isinstance(props, dict):
        return "props is not an object"
    if len(props) > MAX_PROPS:
        return "too many props"
    for key, value in props.items():
        if not isinstance(key, str) or not SAFE_KEY.match(key):
            return "bad prop name"
        if value is None or isinstance(value, (bool, int, float)):
            continue
        if isinstance(value, str):
            if len(value) > MAX_PROP_CHARS:
                return "prop text too long"
            continue
        return "prop is not plain text, a number or true/false"
    return None


class EventIn(BaseModel):
    session_id: str
    user_id: Optional[str] = None
    event_name: str
    props: Dict[str, Any] = Field(default_factory=dict)


class Event(EventIn):
    created_at: datetime = Field(default_factory=utc_now)


class ProgressIn(BaseModel):
    """A partial update. Every field but the session is optional because this is
    upserted after each answer, and an answer only knows about its own field."""
    session_id: str
    user_id: Optional[str] = None
    answers: Optional[Dict[str, Any]] = None
    current_question: Optional[int] = None
    #: The option's own wording ("Within the next month") — kept verbatim so an
    #: admin reading the table sees what the person actually picked.
    purchase_timeline: Optional[str] = None
    #: One of the four canonical codes. The rank is NOT accepted from the
    #: client: it is derived from the code server-side, so the two can never
    #: disagree no matter what a stale build sends.
    readiness_code: Optional[str] = None
    #: MUST be the exact "Breed Name" string from the breed database, so lead
    #: data can be joined to breed data later without fuzzy matching.
    top_breed: Optional[str] = None
    city: Optional[str] = None
    status: Optional[str] = None
    #: First-touch traffic source (utm, channel, device, landing page...). The
    #: service only ever writes it once per session; see upsert_progress.
    attribution: Optional[Dict[str, Any]] = None
