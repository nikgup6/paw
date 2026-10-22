import axios from 'axios';
import { API_URL, sessionId } from './analytics';
import { getChannel } from './attribution';
import { RAZORPAY_CHECKOUT_SRC } from '../config/paywall';

/* Talking to /api/paywall. The sign-in token is attached by the axios hook in
   utils/apiAuth.js, so these calls carry it whenever someone is signed in. */

const BASE = `${API_URL}/api/paywall`;

/** { mode, price_rupees, unlock_days, signed_in, unlocked, unlocked_until } */
export const getPaywallStatus = () => axios.get(`${BASE}/status`).then((r) => r.data);

/** fake_door: { mode, unlocked: true }. test/live: { order_id, key_id, amount, currency }. */
export const createOrder = () =>
  axios.post(`${BASE}/order`, { session_id: sessionId, channel: getChannel() }).then((r) => r.data);

/** Hands Razorpay's three values to the server, which checks the signature. */
export const verifyPayment = ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) =>
  axios.post(`${BASE}/verify`, { razorpay_order_id, razorpay_payment_id, razorpay_signature }).then((r) => r.data);

/* Razorpay's checkout script, added to the page once, only when needed. Resolves
   with window.Razorpay, rejects if it cannot load (offline, blocked). */
let loading = null;
export function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = RAZORPAY_CHECKOUT_SRC;
    s.async = true;
    s.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Razorpay missing')));
    s.onerror = () => { loading = null; s.remove(); reject(new Error('Razorpay script failed')); };
    document.body.appendChild(s);
  });
  return loading;
}
