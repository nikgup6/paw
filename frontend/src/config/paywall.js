/* Paywall switches you can change without touching the code that uses them.

   The MODE (off / fake_door / test / live) and the PRICE are NOT here: the server
   decides both (backend PAYWALL_MODE, PAYWALL_PRICE_PAISE) and the page asks
   GET /api/paywall/status. That way nobody can turn the paywall off, or change
   the price, by editing the browser's copy of this file. */

/* The quiz screens a visitor answers for free, by screen id from
   constants/quizSections.js. Today that is all of Part 1, "About you". The
   paywall appears after the LAST screen in this list. Keep it to screens at the
   start of the quiz: the gate is "everything up to here is free". */
export const FREE_SCREEN_IDS = ['city', 'home', 'family', 'experience'];

/* Where the paywall appears:
   'rough'     (default) after the free screens: a rough recommendation, then the
               unlock card; paying continues the quiz with the remaining screens.
   'questions' every question is free; no rough recommendation; the same sheet
               opens when they tap "Find my match", right before the full results. */
export const PAYWALL_AFTER = 'rough';

/* The short "Sniffing around..." beat before the rough recommendation appears. */
export const ROUGH_PAUSE_MS = 600;

/* How long the sheet waits for a payment to be confirmed before offering a
   "Check my payment" button instead of an endless spinner. */
export const PAYMENT_WAIT_MS = 30000;

/* Razorpay's checkout script, loaded only when the sheet opens in test/live. */
export const RAZORPAY_CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
