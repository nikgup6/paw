"""Shapes for the paywall (routes/paywall.py, services/paywall_service.py).

One row in the `payments` collection per order:

    user_id       the signed-in account that asked for it (from the token)
    session_id    the browser's tracking session, so the funnel can join it
    order_id      Razorpay's order id ("order_..."), or "fake_..." in fake-door mode. Unique.
    payment_id    Razorpay's payment id once paid. Unique when present.
    amount_paise  what WE asked Razorpay to charge (the only amount ever trusted)
    currency      "INR"
    status        created | paid | failed | fake_door
    mode          fake_door | test | live
    channel       first-touch traffic channel, for the dashboard
    created_at, paid_at

No name, mobile or email is stored here or sent to Razorpay in the order notes.
"""
from typing import Optional

from pydantic import BaseModel

STATUS_CREATED = "created"
STATUS_PAID = "paid"
STATUS_FAILED = "failed"
STATUS_FAKE_DOOR = "fake_door"

MODES = ("off", "fake_door", "test", "live")


class OrderIn(BaseModel):
    """What the browser sends with "Pay". Both optional: they only label the row."""
    session_id: Optional[str] = None
    channel: Optional[str] = None


class VerifyIn(BaseModel):
    """What Razorpay Checkout hands the browser on success. All three are needed;
    they are Optional here only so a missing one gets our plain 400 instead of a
    framework 422."""
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
