"""Paywall routes (`/api/paywall`). The logic is in services/paywall_service.py.

    GET  /status   mode + price for everyone; "unlocked" for a signed-in account
    POST /order    sign-in needed. fake_door: unlock free. test/live: a Razorpay order
    POST /verify   sign-in needed. Checks Razorpay's signature, then unlocks
    POST /webhook  Razorpay calls this. No sign-in; the signature is the proof
    POST /cancel   admin only. Ends the admin's OWN access, to rerun a demo

The MODE is decided here, on the server, from PAYWALL_MODE (and the account's
role: in live mode an ADMIN pays with the test keys, see pay.mode_for). The
browser only ever asks. Access belongs to the account id inside the signed-in token - never
to a mobile number, which nobody has verified yet.
"""
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth.dependencies import optional_user, require_admin, require_user
from app.config.settings import settings
from app.database.connection import get_database
from app.models.payment import OrderIn, VerifyIn, STATUS_PAID
from app.security import rate_limit as rl
from app.services import paywall_service as pay

logger = logging.getLogger(__name__)
router = APIRouter()

NOT_CONFIRMED = "We couldn't confirm this payment. If money left your account, it will be refunded."


def _db():
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    return db


def _iso(dt):
    return dt.isoformat() if dt else None


@router.get("/status")
async def status(request: Request, claims: Optional[dict] = Depends(optional_user)):
    """Public on purpose: the quiz needs the mode and price before anyone signs
    in. "unlocked" is only ever true for a signed-in account that has access
    (or for everyone when the paywall is off)."""
    await rl.enforce("paywall_status", rl.client_ip(request))
    mode = pay.mode_for(claims)
    until = await pay.unlocked_until(_db(), claims["sub"]) if (claims and mode != "off") else None
    return {
        "mode": mode,
        "price_rupees": pay.price_rupees(),
        "unlock_days": pay.unlock_days(mode),
        "signed_in": bool(claims),
        "unlocked": mode == "off" or until is not None,
        "unlocked_until": _iso(until),
        # How: "paid" (real money) or "fake_door" (tapped Pay, nothing charged).
        # The feedback card uses it to pick the price question's wording.
        "unlocked_via": (await pay.unlock_kind(_db(), claims["sub"])) if until else None,
    }


@router.post("/order")
async def order(payload: OrderIn, request: Request, claims: dict = Depends(require_user)):
    user_id = claims["sub"]
    await rl.enforce("paywall_order_user", user_id, whose="on your account")
    await rl.enforce("paywall_order_ip", rl.client_ip(request))
    db = _db()
    mode = pay.mode_for(claims)

    if mode == "off":
        raise HTTPException(status_code=400, detail="There is nothing to pay for right now.")
    already = await pay.unlocked_until(db, user_id)
    if already:
        # Never take money twice for access the account already has.
        return {"mode": mode, "unlocked": True, "unlocked_until": _iso(already)}
    if mode == "fake_door":
        until = await pay.fake_door(db, user_id, payload.session_id, payload.channel)
        return {"mode": mode, "unlocked": True, "unlocked_until": _iso(until)}
    try:
        created = await pay.create_order(db, user_id, payload.session_id, payload.channel, mode)
    except pay.PaymentsUnavailable:
        # Deliberately not 401: to the frontend a 401 means "you are not signed in".
        raise HTTPException(status_code=503, detail="Payments aren't available right now. Please try again in a few minutes.")
    return {"mode": mode, "unlocked": False, **created}


@router.post("/verify")
async def verify(payload: VerifyIn, claims: dict = Depends(require_user)):
    user_id = claims["sub"]
    await rl.enforce("paywall_verify_user", user_id, whose="on your account")
    if settings.PAYWALL_MODE not in ("test", "live"):
        raise HTTPException(status_code=400, detail="There is no payment to check in this mode.")
    order_id, payment_id, signature = (payload.razorpay_order_id, payload.razorpay_payment_id,
                                       payload.razorpay_signature)
    if not (order_id and payment_id and signature):
        raise HTTPException(status_code=400, detail="Some payment details are missing.")

    # The row first: its mode says which key secret signed the checkout.
    db = _db()
    row = await pay.find_order(db, order_id)
    if not row or row.get("user_id") != user_id:
        # Same answer whether the order is unknown or someone else's.
        logger.warning("Verify for an order that is not this account's.")
        raise HTTPException(status_code=400, detail=NOT_CONFIRMED)
    if not pay.checkout_signature_ok(order_id, payment_id, signature, row.get("mode")):
        logger.warning("Checkout signature mismatch on verify.")
        raise HTTPException(status_code=400, detail=NOT_CONFIRMED)
    until = await pay.mark_paid(db, order_id, payment_id)
    if not until:
        raise HTTPException(status_code=400, detail=NOT_CONFIRMED)
    return {"unlocked": True, "unlocked_until": _iso(until)}


@router.post("/cancel")
async def cancel(claims: dict = Depends(require_admin)):
    """The admin panel's "Cancel subscription": the paywall shows again on this
    admin account, so the payment demo can be run again. Only ever touches the
    caller's own account (the id in the token), never anyone else's."""
    await pay.cancel_access(_db(), claims["sub"])
    logger.info("Admin cancelled their own access for a demo.")
    return {"unlocked": False, "unlocked_until": None}


@router.post("/webhook")
async def webhook(request: Request):
    """Razorpay -> us. Read the RAW bytes first: the signature covers exactly
    those bytes, and parsing then re-serialising the JSON would change them.
    Not rate-limited (Razorpay retries must always get through); the signature
    is the gate. 200 quickly after a valid signature, 400 on a bad one."""
    raw = await request.body()
    if not (settings.RAZORPAY_WEBHOOK_SECRET or settings.RAZORPAY_TEST_WEBHOOK_SECRET):
        logger.error("Webhook received but RAZORPAY_WEBHOOK_SECRET is not set; Razorpay will retry.")
        raise HTTPException(status_code=503, detail="Not configured.")
    signer = pay.webhook_signer(raw, request.headers.get("x-razorpay-signature"))
    if not signer:
        logger.warning("Webhook with a bad or missing signature refused.")
        raise HTTPException(status_code=400, detail="Bad signature.")

    try:
        event = json.loads(raw)
    except ValueError:
        raise HTTPException(status_code=400, detail="Bad body.")
    name = event.get("event")
    payload = event.get("payload") or {}
    payment = (payload.get("payment") or {}).get("entity") or {}
    order_entity = (payload.get("order") or {}).get("entity") or {}
    order_id = order_entity.get("id") or payment.get("order_id")

    db = _db()
    row = await pay.find_order(db, order_id)
    if not row:
        logger.info("Webhook %s for an order we did not create; ignored.", name)
        return {"status": "ignored"}
    if signer == "admin_test" and row.get("mode") != "test":
        # The admin test webhook may only settle admin test orders, never a live one.
        logger.warning("Test-mode webhook for a non-test order; ignored.")
        return {"status": "ignored"}

    if name in ("payment.captured", "order.paid"):
        # The amount and the account come from OUR row. The webhook body is only
        # checked against it, never believed on its own.
        paid_amount = payment.get("amount") or order_entity.get("amount_paid")
        if paid_amount != row["amount_paise"]:
            logger.error("Webhook amount does not match our order; not unlocking.")
            return {"status": "amount_mismatch"}
        if row.get("status") != STATUS_PAID:
            await pay.mark_paid(db, order_id, payment.get("id"))
        return {"status": "ok"}
    if name == "payment.failed":
        await pay.mark_failed(db, order_id)
        return {"status": "ok"}
    return {"status": "ignored"}
