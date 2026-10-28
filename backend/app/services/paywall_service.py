"""The paywall's business logic: orders, signature checks, unlocking.

HOW A REAL PAYMENT WORKS (test and live modes)
  1. The browser asks us for an order. WE decide the amount (PAYWALL_PRICE_PAISE)
     and ask Razorpay to create the order; Razorpay returns an order id.
  2. The browser opens Razorpay Checkout with that order id. The visitor pays
     on Razorpay's own screens - card numbers and UPI never touch our server.
  3. Razorpay gives the browser three values: order id, payment id, signature.
     The signature is HMAC-SHA256 of "order_id|payment_id" made with our
     KEY SECRET, which only Razorpay and our server know. If our own
     calculation matches, Razorpay really did confirm that payment for that
     order - the browser cannot fake it.
  4. Separately, Razorpay calls our webhook. That covers the visitor who pays in
     their UPI app and never comes back to the tab: the webhook unlocks them
     anyway. It is signed too, over the raw request body, with a different
     secret (the webhook secret).

Steps 3 and 4 both end in mark_paid(), which is IDEMPOTENT: whichever arrives
second finds the order already paid and changes nothing - one "paid" row, one
payment_success event, however many times either is repeated.

FAKE-DOOR MODE takes no money: "Pay" records the intent and unlocks for free.

ADMIN DEMOS: with PAYWALL_MODE=live and RAZORPAY_TEST_KEY_* set, an ADMIN
account's orders go through the Razorpay TEST keys (mode "test" on the row), so
a demo runs the real Checkout with pretend money. Everyone else pays live. The
role comes from the signed token, so nobody can ask their way into test mode.
A demo payment unlocks for ADMIN_DEMO_UNLOCK_DAYS only, and cancel_access()
(the admin panel's "Cancel subscription") ends it at once for the next demo.

The HTTP call to Razorpay uses httpx (already installed for Cloudinary) and the
standard library's hmac, rather than the `razorpay` package: one REST call and
one HMAC are all this needs, and it keeps the dependency list as it was.
"""
import hashlib
import hmac
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from pymongo import ReturnDocument

from app.auth.dependencies import ADMIN_ROLE
from app.config.settings import settings
from app.models.funnel import safe_id
from app.models.payment import STATUS_CREATED, STATUS_FAILED, STATUS_FAKE_DOOR, STATUS_PAID
from app.services import funnel_service

logger = logging.getLogger(__name__)

PAYMENTS = "payments"
USERS = "users"
RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders"
RAZORPAY_TIMEOUT_SECONDS = 15


class PaymentsUnavailable(Exception):
    """Razorpay could not be reached, or refused our keys. Shown to the visitor
    as "payments aren't available right now"; the real reason goes to the log."""


def now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is not None and dt.tzinfo is None:          # Mongo hands back naive UTC
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def price_rupees() -> int:
    return settings.PAYWALL_PRICE_PAISE // 100


# ------------------------------------------------------------------ mode and keys

def _admin_test_keys() -> bool:
    return bool(settings.RAZORPAY_TEST_KEY_ID and settings.RAZORPAY_TEST_KEY_SECRET)


def mode_for(claims: Optional[dict]) -> str:
    """The paywall mode for THIS account: PAYWALL_MODE, except that in live mode
    an ADMIN account pays with the test keys (when they are set)."""
    mode = settings.PAYWALL_MODE
    if mode == "live" and claims and claims.get("role") == ADMIN_ROLE and _admin_test_keys():
        return "test"
    return mode


def _is_admin_demo(mode: Optional[str]) -> bool:
    """A "test" order while the app is live can only be an admin demo."""
    return mode == "test" and settings.PAYWALL_MODE == "live"


def unlock_days(mode: Optional[str]) -> int:
    """Days a payment in this mode unlocks for: one day for an admin demo."""
    return settings.ADMIN_DEMO_UNLOCK_DAYS if _is_admin_demo(mode) else settings.PAYWALL_UNLOCK_DAYS


def _keys(mode: Optional[str]) -> tuple:
    """(key id, key secret) for an order of this mode. A "test" order while the
    app is live is an admin demo, so it uses the admin test keys."""
    if _is_admin_demo(mode):
        return settings.RAZORPAY_TEST_KEY_ID, settings.RAZORPAY_TEST_KEY_SECRET
    return settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET


# ------------------------------------------------------------------ entitlement

async def has_real_payment(db, user_id: str) -> bool:
    """A payment where money moved (Razorpay test or live), not a fake-door tap."""
    return bool(await db[PAYMENTS].find_one({"user_id": user_id, "status": STATUS_PAID,
                                             "mode": {"$in": ["test", "live"]}}))


async def unlock_kind(db, user_id: str) -> Optional[str]:
    """How this account has access now: "paid" (real money), "fake_door" (tapped
    Pay, nothing charged), or None when it has no access."""
    if not await unlocked_until(db, user_id):
        return None
    return "paid" if await has_real_payment(db, user_id) else "fake_door"


async def unlocked_until(db, user_id: str) -> Optional[datetime]:
    """When this account's full-match access ends, or None if it has none now."""
    user = await db[USERS].find_one({"id": user_id}, {"full_match_until": 1})
    until = _aware((user or {}).get("full_match_until"))
    return until if until and until > now() else None


async def grant(db, user_id: str, days: Optional[int] = None) -> datetime:
    """Give `days` (default PAYWALL_UNLOCK_DAYS) from now. Never shortens existing
    access, and a repeated grant does not stack days on top of days."""
    current = await unlocked_until(db, user_id)
    target = now() + timedelta(days=days or settings.PAYWALL_UNLOCK_DAYS)
    until = max(current, target) if current else target
    await db[USERS].update_one({"id": user_id}, {"$set": {"full_match_until": until}})
    return until


async def cancel_access(db, user_id: str) -> None:
    """End this account's access now, so the paywall shows again. Used by the
    admin panel on the admin's OWN account to rerun a demo; payment rows are
    kept as the record of what happened."""
    await db[USERS].update_one({"id": user_id}, {"$unset": {"full_match_until": ""}})


# ------------------------------------------------------------------ server events

async def _server_event(db, name: str, row: dict) -> None:
    """Money events are written by the server only (models/funnel.py,
    SERVER_ONLY_EVENTS). Best effort: tracking never blocks a payment."""
    sid = row.get("session_id")
    try:
        await funnel_service.record_event(db, {
            "session_id": sid if safe_id(sid) else f"server-{row['order_id'][-20:]}",
            "user_id": row.get("user_id"),
            "event_name": name,
            "props": {"amount": row["amount_paise"] // 100, "mode": row.get("mode"),
                      "channel": row.get("channel") or "unknown"},
            "created_at": now(),
        }, trusted=True)
    except Exception:  # noqa: BLE001
        logger.warning("Could not record %s for an order", name, exc_info=True)


# ------------------------------------------------------------------ orders

def _row(user_id, order_id, status, session_id, channel, mode) -> dict:
    return {
        "user_id": user_id,
        "session_id": session_id if safe_id(session_id) else None,
        "order_id": order_id,
        "amount_paise": settings.PAYWALL_PRICE_PAISE,
        "currency": "INR",
        "status": status,
        "mode": mode,
        "channel": (channel or "")[:32] or None,
        "created_at": now(),
        "paid_at": None,
    }


async def fake_door(db, user_id: str, session_id: Optional[str], channel: Optional[str]) -> datetime:
    """The pilot's 'Pay': records the intent, takes nothing, unlocks for free."""
    row = _row(user_id, f"fake_{uuid.uuid4().hex}", STATUS_FAKE_DOOR, session_id, channel, "fake_door")
    await db[PAYMENTS].insert_one(dict(row))
    await _server_event(db, "payment_started", row)
    return await grant(db, user_id)


async def create_order(db, user_id: str, session_id: Optional[str], channel: Optional[str],
                       mode: str) -> dict:
    """Ask Razorpay for an order for OUR price, with the keys for `mode` (see
    mode_for). Notes carry ids only - never a name, mobile or email."""
    key_id, key_secret = _keys(mode)
    receipt = f"pb_{uuid.uuid4().hex[:16]}"
    body = {
        "amount": settings.PAYWALL_PRICE_PAISE,
        "currency": "INR",
        "receipt": receipt,
        "notes": {"user_id": user_id, "session_id": session_id if safe_id(session_id) else ""},
    }
    try:
        async with httpx.AsyncClient(timeout=RAZORPAY_TIMEOUT_SECONDS) as client:
            res = await client.post(RAZORPAY_ORDERS_URL, json=body,
                                    auth=(key_id, key_secret))
    except httpx.HTTPError as exc:
        logger.error("Razorpay order request failed: %s", type(exc).__name__)
        raise PaymentsUnavailable() from None
    if res.status_code == 401:
        logger.error("Razorpay refused our %s keys (401). Check the RAZORPAY_*KEY_ID / *KEY_SECRET values.", mode)
        raise PaymentsUnavailable()
    if res.status_code >= 400:
        # Razorpay's error body describes the request, not our secret; still, log the code only.
        logger.error("Razorpay order creation failed with HTTP %s", res.status_code)
        raise PaymentsUnavailable()
    order = res.json()
    if order.get("amount") != settings.PAYWALL_PRICE_PAISE or not str(order.get("id", "")).startswith("order_"):
        logger.error("Razorpay returned an unexpected order; not using it")
        raise PaymentsUnavailable()

    row = _row(user_id, order["id"], STATUS_CREATED, session_id, channel, mode)
    await db[PAYMENTS].insert_one(dict(row))
    await _server_event(db, "payment_started", row)
    return {"order_id": order["id"], "key_id": key_id,
            "amount": settings.PAYWALL_PRICE_PAISE, "currency": "INR"}


# ------------------------------------------------------------------ signatures

def _hmac_hex(secret: str, message: bytes) -> str:
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def checkout_signature_ok(order_id: str, payment_id: str, signature: str, mode: Optional[str]) -> bool:
    """Razorpay's checkout signature: HMAC-SHA256("order_id|payment_id", key secret),
    with the secret of the keys the order was made with (its row's mode).
    compare_digest takes the same time whether the first or the last character
    differs, so the comparison itself gives an attacker no hints."""
    secret = _keys(mode)[1]
    if not (secret and order_id and payment_id and signature):
        return False
    expected = _hmac_hex(secret, f"{order_id}|{payment_id}".encode())
    return hmac.compare_digest(expected, signature)


def webhook_signer(raw_body: bytes, signature: Optional[str]) -> Optional[str]:
    """Which webhook secret signed this body: "main" (RAZORPAY_WEBHOOK_SECRET),
    "admin_test" (RAZORPAY_TEST_WEBHOOK_SECRET), or None for a bad signature.
    HMAC-SHA256 of the RAW body bytes: re-serialising parsed JSON changes
    spacing and key order, and the signature would never match."""
    if not signature:
        return None
    for name, secret in (("main", settings.RAZORPAY_WEBHOOK_SECRET),
                         ("admin_test", settings.RAZORPAY_TEST_WEBHOOK_SECRET)):
        if secret and hmac.compare_digest(_hmac_hex(secret, raw_body), signature):
            return name
    return None


# ------------------------------------------------------------------ marking orders

async def find_order(db, order_id: str) -> Optional[dict]:
    return await db[PAYMENTS].find_one({"order_id": order_id}) if order_id else None


async def mark_paid(db, order_id: str, payment_id: str) -> Optional[datetime]:
    """created/failed -> paid, exactly once. Returns the access end date.

    The update only matches an order that is NOT yet paid, so when the browser's
    verify and Razorpay's webhook both arrive (or either is repeated), only the
    first one changes anything and fires payment_success."""
    row = await db[PAYMENTS].find_one_and_update(
        {"order_id": order_id, "status": {"$in": [STATUS_CREATED, STATUS_FAILED]}},
        {"$set": {"status": STATUS_PAID, "paid_at": now(), **({"payment_id": payment_id} if payment_id else {})}},
        return_document=ReturnDocument.AFTER,
    )
    if row:
        until = await grant(db, row["user_id"], unlock_days(row.get("mode")))
        await _server_event(db, "payment_success", row)
        logger.info("Order marked paid (%s mode).", row.get("mode"))
        return until
    existing = await find_order(db, order_id)
    if existing and existing.get("status") == STATUS_PAID:
        return await unlocked_until(db, existing["user_id"])
    return None


async def mark_failed(db, order_id: str) -> None:
    """created -> failed. A paid order is never moved back."""
    await db[PAYMENTS].update_one({"order_id": order_id, "status": STATUS_CREATED},
                                  {"$set": {"status": STATUS_FAILED}})
