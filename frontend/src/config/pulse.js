/* The "Was this useful?" pop-up (components/results/ResultsPulse.jsx): its
   questions, answer codes and timing, in one place.

   CHANGING A QUESTION: edit it here AND the matching codes in
   backend/app/models/pulse.py in the same commit (the server refuses any code
   it does not know). Then bump PULSE_VERSION in both files, so people who
   answered the old questions can be asked the new ones.

   Wording rules from the brief: neutral questions that do not push the answer,
   and never a reward for answering. */

export const PULSE_VERSION = 1;

/* "Was this recommendation useful to you?" */
export const USEFUL = {
  question: 'Was this recommendation useful to you?',
  options: [
    ['yes', 'Yes, very'],
    ['some', 'A bit'],
    ['no', 'Not really'],
  ],
  commentLabel: 'Anything we should fix?',
  commentMax: 200,
  note: 'Takes 10 seconds. Your answers help us improve.',
};

/* The screener questions, by the key the server stores them under. The price
   question uses the real price from the paywall status: {price} is replaced. */
export const SCREENERS = {
  breed_known: {
    question: 'Before today, did you already know which breed you wanted?',
    options: [
      ['known', 'Yes, a breed was already chosen'],
      ['shortlist', 'I had a shortlist'],
      ['none', 'No idea'],
    ],
  },
  price_fair: {
    question: 'Was {price} a fair price for this?',
    /* For people who unlocked through the fake door: no money moved, so the
       question is hypothetical. Same answer codes; stored with paywall_state "fake_door". */
    questionFakeDoor: 'If this had cost {price}, would that have felt fair?',
    options: [
      ['cheap', 'Too cheap'],
      ['fair', 'Fair'],
      ['high', 'A bit high'],
      ['too_high', 'Too expensive'],
    ],
  },
  not_paid_reason: {
    question: 'What held you back from unlocking the full result?',
    options: [
      ['price', 'Price'],
      ['trust', 'Not sure it is accurate'],
      ['enough', 'Rough result was enough'],
      ['exploring', 'Just exploring'],
      ['payment', 'Payment problem'],
      ['other', 'Other'],
    ],
  },
};

/* Which third question each kind of person gets (none for 'none': the paywall is off). */
/* 'dismissed' asks no third question here: "what stopped you" is asked the moment the
   paywall closes (components/paywall/NotUnlockedCard.jsx). */
export const THIRD_STEP = { paid: 'price_fair', fake_door: 'price_fair', dismissed: null, none: null };

/* Timing. */
export const SHOW_AFTER_MS = 8000;      // results on screen, and the person has scrolled or tapped
export const AFTER_OVERLAY_MS = 5000;   // after a modal, sheet or the paywall closes
export const THANKS_MS = 1500;          // "Thank you." then it goes
