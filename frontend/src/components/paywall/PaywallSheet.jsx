import { useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { createOrder, getPaywallStatus, loadRazorpayCheckout, verifyPayment } from '../../utils/paywall';
import { paymentDismissed, paymentFailed, paywallViewed } from '../../utils/paymentEvents';
import { PAYMENT_WAIT_MS } from '../../config/paywall';
import { sendBeaconEvent, track } from '../../utils/analytics';

/* The paywall sheet: a bottom sheet on phones, a centred dialog on desktop.

   The MODE comes from the server (status.mode), never from this file:
     fake_door  "Pay" takes NO money. The server records the intent and unlocks
                for free; the visitor is told so, plainly.
     test/live  Razorpay Checkout. Unlocking happens only when OUR server has
                checked Razorpay's signature (POST /api/paywall/verify) - the page
                never decides on its own that a payment worked.

   States: idle -> starting (asking for an order) -> checkout (Razorpay open)
           -> verifying -> done,  or  -> failed / error,  or  -> waiting (30s
           passed with no answer: "Check my payment" asks the server instead of
           leaving a spinner forever). fake_door: idle -> starting -> thanks.

   Accessibility: role="dialog", focus kept inside, Escape and a visible Close
   button (both off while a payment is being checked, so it cannot be lost
   half-way). While Razorpay's own window is open this sheet steps back and
   does not fight it for focus. */

const POLICY_LINKS = [
  ['/terms', 'Terms'],
  ['/privacy', 'Privacy'],
  ['/refunds', 'Refund policy'],
];

const FAILED_COPY = 'The payment did not go through. You have not been charged. Try again or use another method.';
const FAKE_DOOR_COPY = "Payments open in a few days. You're on the early list. Here's your full match free, as a thank-you.";

export default function PaywallSheet({ open, status, onClose, onUnlocked }) {
  const { user, logout } = useContext(AuthContext);
  const [state, setState] = useState('idle');
  const [message, setMessage] = useState('');
  const panelRef = useRef(null);
  const payRef = useRef(null);
  const waitTimer = useRef(null);
  const failedOrders = useRef(new Set());
  const viewed = useRef(false);   // one paywall_viewed per opening, even when React runs effects twice
  const tappedPay = useRef(false); // someone who tapped Pay is never asked why they did not unlock

  /* Closing WITHOUT paying: paywall_dismissed {how}. The parent hears how, and
     whether Pay was tapped (then nobody asks "what stopped you"). */
  const close = (how) => {
    if (!tappedPay.current) track('paywall_dismissed', { how });
    if (how !== 'back' && window.history.state?.pbpw) window.history.back();   // drop our back-button entry
    onClose({ how, tappedPay: tappedPay.current });
  };
  const closeRef = useRef(close);
  const busyRef = useRef(false);

  /* The phone's back button closes the sheet instead of leaving the page. */
  useEffect(() => {
    if (!open) return undefined;
    // One entry, even when React runs this effect twice in development.
    if (!window.history.state?.pbpw) window.history.pushState({ ...(window.history.state || {}), pbpw: 1 }, '');
    const onPop = () => { if (!busyRef.current) closeRef.current('back'); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [open]);

  /* Left with the sheet open (tab closed, app switched): no page can ask a
     question then, so it is recorded with a beacon, once per session, and the
     next visit from this browser asks once (pages/Home.jsx). */
  useEffect(() => {
    if (!open) return undefined;
    const left = () => {
      if (tappedPay.current) return;
      try {
        if (sessionStorage.getItem('pb_paywall_abandoned')) return;
        sessionStorage.setItem('pb_paywall_abandoned', '1');
      } catch { /* storage blocked: may send twice, harmless */ }
      try { localStorage.setItem('pb_paywall_left_open', '1'); } catch { /* no next-visit question */ }
      sendBeaconEvent('paywall_abandoned');
    };
    const onVis = () => { if (document.visibilityState === 'hidden') left(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', left);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', left); };
  }, [open]);

  const mode = status?.mode;
  const price = status?.price_rupees;
  const days = status?.unlock_days;
  const real = mode === 'test' || mode === 'live';
  const busy = state === 'starting' || state === 'checkout' || state === 'verifying';
  useEffect(() => { closeRef.current = close; busyRef.current = busy; });

  // Opening: one paywall_viewed, preload Razorpay's script for real modes, focus Pay.
  // (UnlockFlow mounts this sheet fresh on every opening, so state starts clean.)
  useEffect(() => {
    if (!open) return undefined;
    if (!viewed.current) { viewed.current = true; paywallViewed({ amount: price, mode }); }
    if (real) loadRazorpayCheckout().catch(() => { /* reported when they tap Pay */ });
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => payRef.current?.focus(), 30);
    return () => { clearTimeout(t); clearTimeout(waitTimer.current); document.body.style.overflow = prev; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape + focus trap - but never while Razorpay's window is up, or mid-check.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (state === 'checkout') return;
      if (e.key === 'Escape' && !busy) { e.preventDefault(); close('esc'); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = panelRef.current.querySelectorAll('button:not([disabled]), a[href]');
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!panelRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, state, busy, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !status) return null;

  const fail = (orderId) => {
    clearTimeout(waitTimer.current);
    setState('failed');
    setMessage(FAILED_COPY);
    if (orderId && failedOrders.current.has(orderId)) return;   // one event per order
    if (orderId) failedOrders.current.add(orderId);
    paymentFailed({ amount: price, mode });
  };

  const explain = (err) => {
    if (err?.response?.status === 401) {
      // The sign-in expired (tokens last 30 minutes). Signing out makes the next
      // Unlock tap ask again instead of failing quietly.
      logout();
      return 'Your sign-in has expired. Close this and tap Unlock again to sign back in.';
    }
    return err?.response?.data?.detail || "Something went wrong and you haven't been charged. Please try again.";
  };

  const checkPayment = async () => {
    setState('verifying');
    try {
      const s = await getPaywallStatus();
      if (s.unlocked) { setState('done'); onUnlocked(); return; }
      setState('waiting');
      setMessage("We haven't received a confirmation yet. If money left your account, it will unlock you shortly or be refunded.");
    } catch (err) {
      setState('waiting');
      setMessage(explain(err));
    }
  };

  const verify = async (response) => {
    setState('verifying');
    clearTimeout(waitTimer.current);
    waitTimer.current = setTimeout(() => {
      setState((s) => (s === 'verifying' ? 'waiting' : s));
      setMessage('This is taking longer than usual. Your payment may still be on its way.');
    }, PAYMENT_WAIT_MS);
    try {
      const result = await verifyPayment(response);
      clearTimeout(waitTimer.current);
      if (result.unlocked) { setState('done'); onUnlocked(); return; }
      fail(response.razorpay_order_id);
    } catch (err) {
      clearTimeout(waitTimer.current);
      // A refused signature is not a failed charge we can promise anything about;
      // let the server's own words explain, and offer the status check.
      setState('waiting');
      setMessage(explain(err));
    }
  };

  const pay = async () => {
    tappedPay.current = true;
    setState('starting');
    setMessage('');
    let order;
    try {
      order = await createOrder();
    } catch (err) {
      setState('error');
      setMessage(explain(err));
      return;
    }
    if (order.unlocked) {
      // fake_door: nothing was charged. Or: this account already had access.
      if (order.mode === 'fake_door') { setState('thanks'); return; }
      setState('done');
      onUnlocked();
      return;
    }

    let Razorpay;
    try {
      Razorpay = await loadRazorpayCheckout();
    } catch {
      setState('error');
      setMessage("The payment window couldn't load. Check your connection and try again. You haven't been charged.");
      return;
    }

    const rzp = new Razorpay({
      key: order.key_id,                // the PUBLIC key id; the secret never leaves the server
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      name: 'PAW BUDDY',
      description: `Full match for ${days} days`,
      // Prefill only. The mobile goes to Razorpay's form, never into an event or a URL.
      prefill: { name: user?.name || '', contact: user?.mobile || '' },
      theme: { color: '#F5691A' },
      handler: verify,
      modal: {
        ondismiss: () => {
          setState((s) => (s === 'checkout' ? 'idle' : s));
          paymentDismissed({ amount: price, mode });
        },
      },
    });
    rzp.on('payment.failed', () => fail(order.order_id));
    setState('checkout');
    rzp.open();
  };

  const payLabel = state === 'starting' ? 'One moment...' : `Pay ₹${price}`;

  return (
    <div className="pbpw" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) close('outside'); }}>
      <style>{CSS}</style>
      <div
        ref={panelRef}
        className={`pbpw__panel${state === 'checkout' ? ' is-behind' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pbpw-title"
        aria-describedby="pbpw-note"
      >
        <button type="button" className="pbpw__close" onClick={() => close('x')} disabled={busy} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>

        {state === 'thanks' ? (
          <div className="pbpw__thanks" role="status">
            <h2 id="pbpw-title" className="pbpw__title">You're on the early list</h2>
            <p className="pbpw__thanks-copy">{FAKE_DOOR_COPY}</p>
            <button type="button" ref={payRef} className="pbpw__pay" onClick={() => onUnlocked()}>Continue to my full match</button>
          </div>
        ) : (
          <>
            <h2 id="pbpw-title" className="pbpw__title">Unlock your full match</h2>
            <ul className="pbpw__list">
              <li>All 12 of your answers used</li>
              <li>Your top 5 breeds with match %</li>
              <li>Warnings in plain words</li>
              <li>City care guide and a day with your dog</li>
            </ul>
            <p className="pbpw__price"><span className="pbpw__rupee">{'₹'}</span>{price}</p>
            <p id="pbpw-note" className="pbpw__note">
              One payment unlocks full matches for {days} days. If your results do not load, we refund you.
            </p>

            {message && (
              <p className={`pbpw__msg${state === 'failed' || state === 'error' ? ' is-bad' : ''}`} role="alert">{message}</p>
            )}

            {state === 'waiting' ? (
              <button type="button" ref={payRef} className="pbpw__pay" onClick={checkPayment}>Check my payment</button>
            ) : state === 'verifying' ? (
              <button type="button" className="pbpw__pay" disabled aria-live="polite">Confirming your payment...</button>
            ) : (
              <button type="button" ref={payRef} className="pbpw__pay" onClick={pay} disabled={busy}>
                {state === 'failed' ? `Try again, ₹${price}` : payLabel}
              </button>
            )}

            <nav className="pbpw__links" aria-label="Policies">
              {POLICY_LINKS.map(([href, label]) => (
                // A new tab, so reading the policy never throws away the quiz in progress.
                <a key={href} href={href} target="_blank" rel="noopener noreferrer">{label}</a>
              ))}
            </nav>
          </>
        )}
      </div>
    </div>
  );
}

const CSS = `
.pbpw{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(1,30,74,.45)}
.pbpw__panel{position:relative;box-sizing:border-box;width:100%;max-width:440px;max-height:calc(100dvh - 32px);overflow:auto;
  background:#FFF6EC;border:2px solid #011E4A;border-radius:28px;padding:28px 24px 20px;color:#011E4A;
  font-family:'Figtree',system-ui,sans-serif;box-shadow:0 24px 60px rgba(1,30,74,.28);animation:pbpw-in .28s ease-out both}
.pbpw__panel.is-behind{visibility:hidden}
@keyframes pbpw-in{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.pbpw__close{position:absolute;top:10px;right:10px;width:44px;height:44px;border:0;border-radius:50%;background:transparent;color:#011E4A;cursor:pointer;display:flex;align-items:center;justify-content:center}
.pbpw__close:hover:not(:disabled){background:#FFD9BD}
.pbpw__close:disabled{opacity:.35;cursor:not-allowed}
.pbpw__title{margin:4px 44px 14px 0;font-family:'Gabarito',system-ui,sans-serif;font-weight:800;font-size:26px;line-height:1.15;letter-spacing:-.01em}
.pbpw__list{list-style:none;margin:0 0 16px;padding:0;display:grid;gap:8px}
.pbpw__list li{position:relative;padding-left:28px;font-size:15px;line-height:1.4}
.pbpw__list li::before{content:"";position:absolute;left:2px;top:3px;width:16px;height:16px;border-radius:50%;background:#F5691A}
.pbpw__list li::after{content:"";position:absolute;left:7px;top:6px;width:4px;height:8px;border:solid #FFF6EC;border-width:0 2px 2px 0;transform:rotate(45deg)}
.pbpw__price{margin:0;font-family:'Gabarito',system-ui,sans-serif;font-weight:800;font-size:56px;line-height:1;letter-spacing:-.02em}
.pbpw__rupee{font-size:34px;margin-right:2px;vertical-align:.32em}
.pbpw__note{margin:8px 0 16px;font-size:13.5px;line-height:1.45;color:#3C4F6B}
.pbpw__msg{margin:0 0 14px;padding:10px 12px;border-radius:12px;background:#FFE9D6;font-size:14px;line-height:1.45}
.pbpw__msg.is-bad{background:#FFE9B8;color:#5C3D00}
.pbpw__pay{display:block;width:100%;min-height:52px;border:0;border-radius:999px;background:#F5691A;color:#011E4A;cursor:pointer;
  font:800 17px 'Figtree',system-ui,sans-serif;transition:transform .15s ease}
.pbpw__pay:hover:not(:disabled){transform:translateY(-1px)}
.pbpw__pay:disabled{opacity:.7;cursor:progress}
.pbpw__links{display:flex;justify-content:center;gap:4px 18px;flex-wrap:wrap;margin-top:12px}
.pbpw__links a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;padding:0 4px;color:#C84B0A;font-size:13.5px;font-weight:700;text-decoration:underline;text-underline-offset:2px}
.pbpw__thanks-copy{margin:0 0 20px;font-size:16px;line-height:1.5}
.pbpw :focus-visible{outline:3px solid #F5691A;outline-offset:2px}
@media (max-width:599px){
  .pbpw{align-items:flex-end;padding:0}
  .pbpw__panel{max-width:none;border-radius:24px 24px 0 0;border-bottom:0;padding:24px 16px calc(16px + env(safe-area-inset-bottom));max-height:92dvh;animation-name:pbpw-up}
  .pbpw__price{font-size:48px}
  @keyframes pbpw-up{from{transform:translateY(100%)}to{transform:none}}
}
@media (prefers-reduced-motion:reduce){.pbpw__panel{animation:none}.pbpw__pay{transition:none}}
`;
