/* Where did this visitor come from?  (first touch, stored once)

   UTM NAMING: every link we share must carry ?utm_source=...&utm_medium=...&utm_campaign=...
   (full table and the privacy note live in docs/TRACKING.md)

     Channel                    utm_source  utm_medium     Example
     Instagram reel or bio      instagram   reel / bio     ?utm_source=instagram&utm_medium=reel&utm_campaign=hyd_summer
     Meta ads                   meta        paid           ?utm_source=meta&utm_medium=paid&utm_campaign=test1
     Breeder share              breeder     link           ?utm_source=breeder&utm_medium=link&ref=br_12
     Gated community WhatsApp   gated       whatsapp       ?utm_source=gated&utm_medium=whatsapp&utm_campaign=gachibowli
     Vet clinic QR              vet         qr             ?utm_source=vet&utm_medium=qr&ref=vt_3
     Posters                    poster      qr             ?utm_source=poster&utm_medium=qr&utm_campaign=campus

   WHAT IS KEPT: only utm_* / ref, the referrer's hostname (never the full URL),
   the landing path, a device bucket from window width and the browser language.
   Nothing that identifies a person: no name, phone, email or IP.

   Every storage call is in try/catch. If storage is blocked the site still
   works; the channel just falls back to 'direct' and the device to 'unknown'. */

const FIRST_TOUCH_KEY = 'pb_attr';       // localStorage: written once, never overwritten
const SESSION_DONE_KEY = 'pb_attr_done'; // sessionStorage: capture runs once per session

let memo = null; // in-memory copy, so blocked storage still gives this page load a channel

const readLocal = (k) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const writeLocal = (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* blocked */ } };
const readSession = (k) => { try { return window.sessionStorage.getItem(k); } catch { return null; } };
const writeSession = (k, v) => { try { window.sessionStorage.setItem(k, v); } catch { /* blocked */ } };

const deviceBucket = () => {
  const w = window.innerWidth || 0;
  if (w < 768) return 'mobile';
  if (w < 1100) return 'tablet';
  return 'desktop';
};

const referrerHost = () => {
  try {
    if (!document.referrer) return '';
    const host = new URL(document.referrer).hostname.replace(/^www\./, '');
    return host === window.location.hostname.replace(/^www\./, '') ? '' : host;
  } catch { return ''; }
};

const channelFromReferrer = (host) => {
  if (!host) return '';
  if (host === 'instagram.com' || host === 'l.instagram.com') return 'instagram';
  if (/^google\./.test(host) || host.includes('.google.')) return 'google';
  if (host === 'wa.me' || host.includes('whatsapp')) return 'whatsapp';
  return host;
};

/** Priority: utm_source, then ref:<code>, then the referrer, then direct. */
const pickChannel = ({ utm_source, ref, referrer }) => {
  if (utm_source) return utm_source;
  if (ref) return `ref:${ref}`;
  return channelFromReferrer(referrer) || 'direct';
};

const build = () => {
  const q = new URLSearchParams(window.location.search);
  const get = (k) => (q.get(k) || '').slice(0, 80);
  const touch = {
    utm_source: get('utm_source'),
    utm_medium: get('utm_medium'),
    utm_campaign: get('utm_campaign'),
    utm_content: get('utm_content'),
    ref: get('ref'),
    referrer: referrerHost(),
    landing_path: window.location.pathname,
    device: deviceBucket(),
    language: (navigator.language || '').slice(0, 20),
  };
  touch.channel = pickChannel(touch);
  return touch;
};

/** The saved first-touch object, or null if nothing has been captured. */
export function getAttribution() {
  if (memo) return memo;
  try {
    const raw = readLocal(FIRST_TOUCH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Runs once per browser session. The FIRST visit's values win forever. */
export function captureAttribution() {
  try {
    const existing = getAttribution();
    if (readSession(SESSION_DONE_KEY) && existing) return existing;
    const first = existing || build();
    if (!existing) writeLocal(FIRST_TOUCH_KEY, JSON.stringify(first));
    memo = first;
    writeSession(SESSION_DONE_KEY, '1');
    return first;
  } catch {
    return memo;
  }
}

export const getChannel = () => getAttribution()?.channel || 'direct';
export const getDevice = () => getAttribution()?.device || 'unknown';
/* Marketing labels from the first-touch link (utm_campaign, utm_content: which
   campaign, which single reel). Not personal data. '' when the link had none. */
export const getCampaign = () => (getAttribution()?.utm_campaign || '').slice(0, 80);
export const getContent = () => (getAttribution()?.utm_content || '').slice(0, 80);
