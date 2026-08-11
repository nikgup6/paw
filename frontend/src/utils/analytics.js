import axios from 'axios';

/* Funnel tracking.

   Two calls, both fire-and-forget. `track` appends a fact to an immutable log;
   `saveProgress` rewrites this session's row in place. The split matters: the
   log answers "how many people reached question 5", the row answers "who is
   sitting on question 5 right now, and what have they told us so far".

   saveProgress runs on every single answer, not at the end. Someone who closes
   the tab at question 4 leaves four answers behind instead of nothing — which
   is the entire reason this exists.

   Nothing here is ever awaited by the UI and nothing here throws. Analytics
   sits on the critical path of the quiz, and a failed insert must never be
   able to stop somebody answering the next question. */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const BASE = `${API_URL}/api/funnel`;

const SID_KEY = 'pb_sid';

/* A stable id for this browser, minted once. crypto.randomUUID needs a secure
   context, which localhost and https both are — but a stray http:// origin
   would throw here and take the quiz page down with it, so it has a fallback. */
const newId = () => {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch { /* fall through */ }
  return `sid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const readSid = () => {
  try {
    const existing = localStorage.getItem(SID_KEY);
    if (existing) return existing;
    const fresh = newId();
    localStorage.setItem(SID_KEY, fresh);
    return fresh;
  } catch {
    // Private browsing with storage blocked: still track, just don't persist.
    return newId();
  }
};

export const sessionId = readSid();

/** Set once the user logs in, so later events can be tied to the account
    without rewriting the ones already logged under the anonymous session. */
let currentUserId = null;
export const identify = (userId) => { currentUserId = userId || null; };

export async function track(event_name, props = {}) {
  try {
    await axios.post(`${BASE}/events`, {
      session_id: sessionId,
      user_id: currentUserId,
      event_name,
      props,
    });
  } catch {
    // Best effort. A missing datapoint is not worth a broken quiz.
  }
}

export async function saveProgress(patch) {
  try {
    const { data } = await axios.post(`${BASE}/progress`, {
      session_id: sessionId,
      user_id: currentUserId,
      ...patch,
    });
    return data;
  } catch {
    return null;
  }
}

/* ------------------------------- readiness -------------------------------- */

/* The readiness code is decided in the quiz but needed later by screens that
   have no business reading the answer sheet — the login flow wants to label
   its events with it. Kept on the device so those screens can ask without
   importing the quiz's state. */
const READINESS_KEY = 'pb_readiness_code';

export const rememberReadiness = (code) => {
  try { localStorage.setItem(READINESS_KEY, code || ''); } catch { /* non-critical */ }
};

export const recallReadiness = () => {
  try { return localStorage.getItem(READINESS_KEY) || null; } catch { return null; }
};

/** Whether this level is offered a breeder connection at all.

    Only the two that named a month. "Planning Ahead" is three to six months
    out and gets the prep guide instead; "Just Researching" hasn't decided
    anything. Putting a breeder in front of either wastes the breeder's time
    and reads as a sales funnel rather than a recommendation. */
export const showsBreederCta = (code) => code === 'ready_now' || code === 'ready_soon';

/** Ready Soon gets the same CTA component as Ready Now, worded a shade
    softer — they're buying, just not this week. */
export const isSoftCta = (code) => code === 'ready_soon';

/** Levels that get the email capture rather than a breeder. */
export const showsPrepCapture = (code) => code === 'planning';
