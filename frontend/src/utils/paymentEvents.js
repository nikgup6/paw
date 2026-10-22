import { track } from './analytics';

/* Paywall tracking. Props never carry a name, mobile, email or age: only the
   amount (in rupees), the paywall mode and, where useful, a source.

   payment_started and payment_success are written by the SERVER
   (backend/app/services/paywall_service.py) when it creates an order and when it
   confirms a payment: the server refuses them from a browser, because a browser
   could claim money that never arrived. The two helpers are kept so old imports
   still work, but calling them from the page records nothing. */

export const paywallViewed = ({ amount, plan, mode } = {}) => track('paywall_viewed', { amount, plan, mode });
export const paymentFailed = ({ amount, plan, mode } = {}) => track('payment_failed', { amount, plan, mode });
export const paymentDismissed = ({ amount, mode } = {}) => track('payment_dismissed', { amount, mode });

/** @deprecated server-only since the paywall (see above). */
export const paymentStarted = ({ amount, plan, mode } = {}) => track('payment_started', { amount, plan, mode });
/** @deprecated server-only since the paywall (see above). */
export const paymentSuccess = ({ amount, plan, mode } = {}) => track('payment_success', { amount, plan, mode });

// The journey around the paywall.
export const freePartCompleted = () => track('free_part_completed');
/* An event prop must be plain text, a number or true/false (backend rule), so
   the three breed names travel as one comma-separated text. */
export const roughRecViewed = (names = []) => track('rough_rec_viewed', { breeds: names.join(', ').slice(0, 200) });
export const paywallCtaClicked = (source) => track('paywall_cta_clicked', { source });
export const unlockContinued = (mode) => track('unlock_continued', { mode });
