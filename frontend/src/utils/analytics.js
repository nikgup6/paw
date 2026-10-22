import axios from 'axios';
import { getCampaign, getChannel, getContent, getDevice } from './attribution';

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

/* ONE API base for every tracking call (events, progress, the legacy visit
   ping in App.jsx). In production set VITE_API_URL on the host; without it
   everything falls back to localhost, the same way for all of them. */
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const BASE = `${API_URL}/api/funnel`;
const DEV = !!import.meta.env.DEV;

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

/* Every event carries the first-touch traffic source, campaign, content (the
   single reel) and device, so any event can be grouped by them later with no
   joins. The caller's own props win. */
const withContext = (props) => ({
  channel: getChannel(), campaign: getCampaign(), content: getContent(), device: getDevice(), ...props,
});

export async function track(event_name, props = {}) {
  try {
    const full = withContext(props);
    if (DEV) console.debug('[track]', event_name, full);
    const { data } = await axios.post(`${BASE}/events`, {
      session_id: sessionId,
      user_id: currentUserId,
      event_name,
      props: full,
    });
    // The server stores nothing for a name it does not know. Say so loudly in dev.
    if (DEV && data?.status === 'ignored') console.warn('[track] server IGNORED unknown event:', event_name);
  } catch {
    // Best effort. A missing datapoint is not worth a broken quiz.
  }
}

/* Fire once per `key`, however many times React re-renders or StrictMode runs an
   effect twice. Keys ending in "_session" are remembered in sessionStorage too,
   so they stay once-only across a page reload within the same browser session. */
const onceKeys = new Set();
export function trackOnce(event_name, key, props = {}) {
  try {
    const id = `${event_name}:${key}`;
    if (onceKeys.has(id)) return;
    onceKeys.add(id);
    if (String(key).endsWith('_session')) {
      try {
        if (window.sessionStorage.getItem(`pb_once_${id}`)) return;
        window.sessionStorage.setItem(`pb_once_${id}`, '1');
      } catch { /* storage blocked: the in-memory Set still guards this page load */ }
    }
    track(event_name, props);
  } catch { /* never break the UI */ }
}

/* For exit events: a normal request can be cancelled when the tab closes.
   fetch with keepalive survives it. (navigator.sendBeacon with JSON would fail
   the CORS preflight, so it is not used.) */
/* For a page that is being hidden or closed: navigator.sendBeacon is the one
   request a browser promises to finish after the page is gone. It sends the
   JSON as text/plain (no CORS preflight); the server reads that the same way
   and applies the same checks. Falls back to the keepalive fetch below. */
export const sendBeaconEvent = (event_name, props = {}) => {
  try {
    const body = JSON.stringify({ session_id: sessionId, user_id: currentUserId, event_name, props: withContext(props) });
    if (DEV) console.debug('[track]', event_name, props, '(sendBeacon)');
    if (navigator.sendBeacon && navigator.sendBeacon(`${BASE}/events`, body)) return;
  } catch { /* fall through */ }
  trackBeacon(event_name, props);
};

export const trackBeacon = (event_name, props = {}) => {
  try {
    const full = withContext(props);
    if (DEV) console.debug('[track]', event_name, full, '(beacon)');
    fetch(`${BASE}/events`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, user_id: currentUserId, event_name, props: full }),
    }).catch(() => { /* best effort */ });
  } catch { /* never break the UI */ }
};

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

/** Levels that get the prep-guide panel rather than a breeder. */
export const showsPrepCapture = (code) => code === 'planning';
