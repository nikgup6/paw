import { BARK_COUNT, BARK_DEFAULT_FILE, BARK_FILE, BARK_FILES, BARK_MAX_SECONDS, BARK_REVEAL_FILE, BARK_REVEAL_MAX_SECONDS, BARK_VOLUME, BARK_ZOOMIES_FILE, DRUMROLL_FILE, DRUMROLL_VOLUME, PORTAL_FILE, PORTAL_VOLUME, TOY_VOLUME } from '../constants/quizAudio';
import { TOYS } from '../constants/toys';

/* Small sound helpers. Browsers only allow sound after a person has tapped
   something, so `primeAudio()` is called from a tap (the "Find my match" button)
   and the drumroll plays a couple of seconds later when the reveal opens.
   Everything is wrapped in try/catch: no sound is always an acceptable result. */

let ctx = null; // ONE shared AudioContext for the whole site

/* ---------- global mute (remembered; never throws if storage is blocked) ---------- */
const MUTE_KEY = 'pb_muted';
let muted = (() => { try { return window.localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();
const muteListeners = new Set();
export const isMuted = () => muted;
export function setMuted(value) {
  muted = !!value;
  try { window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* not remembered */ }
  muteListeners.forEach((fn) => { try { fn(muted); } catch { /* ignore */ } });
}
export const onMuteChange = (fn) => { muteListeners.add(fn); return () => muteListeners.delete(fn); };

export function primeAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Plays the drumroll. Returns a function that stops it early (Skip), or null if nothing played. */
export function playDrumroll(durationMs = 1400) {
  try {
    if (muted) return null;
    if (DRUMROLL_FILE) {
      const a = new Audio(DRUMROLL_FILE);
      a.volume = DRUMROLL_VOLUME;
      a.play().catch(() => {});
      const barkTimer = setTimeout(() => playBark(), durationMs + 150);
      return () => { clearTimeout(barkTimer); try { a.pause(); } catch { /* ignore */ } };
    }

    const c = primeAudio();
    if (!c) return null;
    const t0 = c.currentTime + 0.03;
    const dur = durationMs / 1000;
    const master = c.createGain();
    master.gain.value = DRUMROLL_VOLUME;
    master.connect(c.destination);

    // One short burst of noise, reused for every stick hit.
    const len = Math.floor(c.sampleRate * 0.12);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const hit = (when, level) => {
      const src = c.createBufferSource();
      src.buffer = buf;
      const band = c.createBiquadFilter();
      band.type = 'bandpass'; band.frequency.value = 1900; band.Q.value = 0.9;
      const g = c.createGain();
      g.gain.setValueAtTime(level, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.07);
      src.connect(band); band.connect(g); g.connect(master);
      src.start(when); src.stop(when + 0.1);
    };

    // The roll: hits get closer together and louder, like a real drumroll building up.
    let t = 0;
    while (t < dur - 0.12) {
      const progress = t / dur;
      hit(t0 + t, 0.18 + 0.55 * progress);
      t += 0.13 - 0.085 * progress;
    }

    // A low tom under the roll, and a final crash when the result appears.
    const tom = c.createOscillator();
    const tg = c.createGain();
    tom.type = 'sine';
    tom.frequency.setValueAtTime(130, t0);
    tom.frequency.exponentialRampToValueAtTime(70, t0 + dur);
    tg.gain.setValueAtTime(0.0001, t0);
    tg.gain.linearRampToValueAtTime(0.35, t0 + dur - 0.05);
    tg.gain.exponentialRampToValueAtTime(0.001, t0 + dur + 0.25);
    tom.connect(tg); tg.connect(master);
    tom.start(t0); tom.stop(t0 + dur + 0.3);

    const crash = c.createBufferSource();
    const cbuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.9), c.sampleRate);
    const cd = cbuf.getChannelData(0);
    for (let i = 0; i < cd.length; i++) cd[i] = Math.random() * 2 - 1;
    crash.buffer = cbuf;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5200;
    const cg = c.createGain();
    cg.gain.setValueAtTime(0.5, t0 + dur);
    cg.gain.exponentialRampToValueAtTime(0.001, t0 + dur + 0.9);
    crash.connect(hp); hp.connect(cg); cg.connect(master);
    crash.start(t0 + dur); crash.stop(t0 + dur + 0.95);

    /* The bark comes right after the roll ends. This is the big one: the real 5-bark volley, cut to its
       first BARK_REVEAL_MAX_SECONDS. If the recording cannot be played we fall back to the built-in woofs,
       so the reveal is never silent. */
    let stopBark = null;
    {
      let clipStop = null;
      const barkTimer = setTimeout(() => {
        clipStop = playClip(BARK_REVEAL_FILE, { seconds: BARK_REVEAL_MAX_SECONDS });
        if (!clipStop && !muted) clipStop = playBark();
      }, durationMs + 150);
      stopBark = () => { clearTimeout(barkTimer); try { clipStop?.(); } catch { /* ignore */ } };
    }

    return () => {
      try { stopBark?.(); } catch { /* ignore */ }
      try {
        master.gain.cancelScheduledValues(c.currentTime);
        master.gain.setValueAtTime(master.gain.value, c.currentTime);
        master.gain.linearRampToValueAtTime(0, c.currentTime + 0.05);
      } catch { /* ignore */ }
    };
  } catch {
    return null;
  }
}

/* One "woof": a short buzzy tone that drops in pitch, shaped by two vowel-like filters, plus a
   little breath noise. `pitch` scales the voice (1 = normal, lower = deeper). */
function synthBark(c, out, when, pitch = 1, tempo = 1) {
  const len1 = 0.2 / tempo; // how long one "woof" lasts
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(BARK_VOLUME, when + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, when + len1);
  g.connect(out);

  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(430 * pitch, when);
  osc.frequency.exponentialRampToValueAtTime(240 * pitch, when + 0.16 / tempo);
  [[750 * pitch, 5], [1500 * pitch, 4]].forEach(([freq, q]) => {
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    osc.connect(f); f.connect(g);
  });
  osc.start(when); osc.stop(when + len1 + 0.02);

  const len = Math.floor(c.sampleRate * 0.12);
  const nb = c.createBuffer(1, len, c.sampleRate);
  const nd = nb.getChannelData(0);
  for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
  const ns = c.createBufferSource(); ns.buffer = nb;
  const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1100 * pitch; nf.Q.value = 0.8;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.35, when);
  ng.gain.exponentialRampToValueAtTime(0.001, when + 0.1 / tempo);
  ns.connect(nf); nf.connect(ng); ng.connect(out);
  ns.start(when); ns.stop(when + 0.12);
}

/** Plays the bark on its own (file if set, otherwise the built-in one). Returns a stop function.
    Both arguments are optional and the defaults are the old behaviour. `count` = how many woofs the built-in bark makes
    (BARK_COUNT normally; the match reveal's "zoomies" asks for a single woof at a time) and `pitch` = voice (1 = normal,
    lower = deeper). A recording in BARK_FILE just plays as it is. */
export function playBark(count = BARK_COUNT, pitch = 1) {
  try {
    if (muted) return null;
    if (BARK_FILE) {
      const a = new Audio(BARK_FILE);
      a.volume = BARK_VOLUME;
      a.play().catch(() => {});
      return () => { try { a.pause(); } catch { /* ignore */ } };
    }
    const c = primeAudio();
    if (!c) return null;
    const master = c.createGain();
    master.gain.value = 1;
    master.connect(c.destination);
    const t = c.currentTime + 0.02;
    for (let i = 0; i < count; i++) synthBark(c, master, t + i * 0.3, (i === 0 ? 1 : 0.88) * pitch);
    return () => { try { master.gain.setValueAtTime(0, c.currentTime); } catch { /* ignore */ } };
  } catch {
    return null;
  }
}


/* ---------------------------------------------------------------------------------------------
   Per-breed bark for the "Hear it" buttons and the Bark Mixer.

   - Plays only after a tap (callers are button handlers) and only if the site is not muted.
   - One sound at a time: a new bark stops the previous one, and taps closer than 300 ms are ignored,
     so rapid tapping can never stack sounds.
   - Never longer than BARK_MAX_SECONDS, never louder than BARK_VOLUME.
   - A breed with a recording in BARK_FILES plays it through Web Audio (`playbackRate` = pitch x tempo;
     a recording's pitch and speed are tied together). Every other breed gets the built-in bark.
*/

/** Voice for a breed's size: small = higher and quicker, large = lower and slower.

    "XS" has to be tested BEFORE falling back to the first letter. Taking only the first
    character read "XS" as "X", so the two smallest breeds in the database - the Pomeranian
    ("XS") and the Shih Tzu ("XS-S") - barked in the Great Dane's voice. "XL" is genuinely
    giant, so that one was right either way. */
export const barkVoiceForSize = (size = 'M') => {
  const s = String(size).trim().toUpperCase();
  const tier = s.startsWith('XS') ? 'S' : s[0];
  return (
    { S: { pitch: 1.35, tempo: 1.2 }, M: { pitch: 1, tempo: 1 }, L: { pitch: 0.78, tempo: 0.9 }, X: { pitch: 0.62, tempo: 0.8 } }[tier]
    || { pitch: 1, tempo: 1 }
  );
};

const bufferCache = new Map();
async function loadBuffer(c, url) {
  if (bufferCache.has(url)) return bufferCache.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error('bark file missing');
  const buf = await c.decodeAudioData(await res.arrayBuffer());
  bufferCache.set(url, buf);
  return buf;
}

/* Play a recording once. `seconds` cuts it short IN FILE TIME (so "the first 3 seconds" means exactly
   that, whatever pitch it is played at) and fades the last moment out, so a cut never clicks. Returns a
   stop function, or null when muted / unavailable. The file is decoded once and kept (loadBuffer). */
function playClip(url, { pitch = 1, seconds = 0, volume = BARK_VOLUME, fadeMs = 160 } = {}) {
  try {
    if (muted || !url) return null;
    const c = primeAudio();
    if (!c) return null;
    let src = null;
    let cancelled = false;
    const g = c.createGain();
    g.gain.value = volume;
    g.connect(c.destination);

    loadBuffer(c, url).then((buf) => {
      if (cancelled) return;
      const clipLen = seconds > 0 ? Math.min(seconds, buf.duration) : buf.duration;
      const rate = Math.min(2, Math.max(0.4, pitch));
      src = c.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      src.connect(g);
      const start = c.currentTime + 0.01;
      const wall = clipLen / rate;                       // how long it actually sounds for
      src.start(start, 0, clipLen);
      if (clipLen < buf.duration - 0.01) {               // cut short: fade the tail
        const fade = Math.min(fadeMs / 1000, wall * 0.4);
        g.gain.setValueAtTime(volume, start + wall - fade);
        g.gain.linearRampToValueAtTime(0.0001, start + wall);
      }
    }).catch(() => { /* missing or unreadable: the caller decides whether to fall back */ });

    return () => {
      cancelled = true;
      try {
        g.gain.cancelScheduledValues(c.currentTime);
        g.gain.setValueAtTime(g.gain.value, c.currentTime);
        g.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.05);
        src?.stop(c.currentTime + 0.06);
      } catch { /* already finished */ }
    };
  } catch {
    return null;
  }
}

/** The zoomies bark: the 4-bark flurry recording, played once for the whole burst. */
/* The portal's swirl (match reveal, phase 1).

   Plays Vibhuvan's recording for at most `seconds`, so whatever is left when the portal
   opens is cut with playClip's own short fade rather than talking over the bark. Returns
   a stop function, or null when muted or when no file is set - either way the portal
   itself carries on, because the picture is the point and the sound is the garnish. */
export function playPortal(seconds) {
  try {
    if (muted || !PORTAL_FILE) return null;
    return playClip(PORTAL_FILE, { seconds, volume: PORTAL_VOLUME });
  } catch {
    return null;
  }
}

/* The reveal's big bark, on its own.

   This is the same sound the drumroll used to play at its tail: the real 5-bark volley,
   cut to its first BARK_REVEAL_MAX_SECONDS, falling back to the built-in woofs if the
   recording cannot be played so the reveal is never silent. It was pulled out of
   playDrumroll when the portal replaced the drumroll and the bark had to fire on its own,
   at the moment the portal opens. Returns a stop function, or null while muted.

   Both callers want exactly this sound, so it lives here rather than being written twice. */
export function playRevealBark() {
  try {
    if (muted) return null;
    const stop = playClip(BARK_REVEAL_FILE, { seconds: BARK_REVEAL_MAX_SECONDS });
    return stop || playBark();
  } catch {
    return null;
  }
}

export function playZoomiesBark(pitch = 1) {
  const stop = playClip(BARK_ZOOMIES_FILE, { pitch });
  if (stop) return stop;
  return playBark(1, pitch);                             // muted, or no recording: the built-in woof
}

let lastBarkAt = 0;
let stopCurrentBark = null;

/** `pitch` and `tempo` are the Mixer's multipliers (1 = the breed's own voice). Returns true if a sound started. */
export function playBreedBark({ breed, size, pitch = 1, tempo = 1 } = {}) {
  try {
    if (muted) return false;
    const now = performance.now();
    if (now - lastBarkAt < 300) return false; // debounce rapid taps
    lastBarkAt = now;
    const c = primeAudio();
    if (!c) return false;
    try { stopCurrentBark?.(); } catch { /* ignore */ }

    const voice = barkVoiceForSize(size);
    const p = Math.min(2, Math.max(0.4, voice.pitch * pitch));
    const t = Math.min(2, Math.max(0.5, voice.tempo * tempo));
    const master = c.createGain();
    master.gain.value = 1;
    master.connect(c.destination);
    const start = c.currentTime + 0.02;
    const sources = [];

    const stop = () => {
      try {
        master.gain.cancelScheduledValues(c.currentTime);
        master.gain.setValueAtTime(master.gain.value, c.currentTime);
        master.gain.linearRampToValueAtTime(0, c.currentTime + 0.04);
        sources.forEach((s) => { try { s.stop(c.currentTime + 0.05); } catch { /* already stopped */ } });
      } catch { /* ignore */ }
    };
    stopCurrentBark = stop;
    // hard length cap, whatever the sliders say
    master.gain.setValueAtTime(1, start + BARK_MAX_SECONDS - 0.05);
    master.gain.linearRampToValueAtTime(0, start + BARK_MAX_SECONDS);

    const file = BARK_FILES[breed] || BARK_DEFAULT_FILE;   // the short double woof, pitched by breed size
    if (file) {
      loadBuffer(c, file).then((buf) => {
        const src = c.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = p * t;
        const g = c.createGain();
        g.gain.value = BARK_VOLUME;
        src.connect(g); g.connect(master);
        sources.push(src);
        src.start(c.currentTime + 0.01);
        src.stop(start + BARK_MAX_SECONDS);
      }).catch(() => {
        // recording missing or unreadable: use the built-in bark instead
        for (let i = 0; i < BARK_COUNT; i++) synthBark(c, master, c.currentTime + 0.02 + (i * 0.3) / t, i === 0 ? p : p * 0.88, t);
      });
    } else {
      for (let i = 0; i < BARK_COUNT; i++) synthBark(c, master, start + (i * 0.3) / t, i === 0 ? p : p * 0.88, t);
    }
    return true;
  } catch {
    return false;
  }
}


/* ---------------------------------------------------------------------------------------------
   Squeaky toys: ONE real squeak recording (public/audio/toy-squeak.ogg, or .mp3 on browsers that cannot play Ogg Opus),
   played as it is. Nothing is made in code for the toys.

   - The file is fetched and decoded the FIRST time a toy is tapped (never on page load), with the site's one shared
     audio context, then kept in memory and never loaded again.
   - Each tap plays the WHOLE file once (never looped, never cut short) with a tiny random pitch change (+/- 5 %) around
     the toy's own `rate` (constants/toys.js), so it never sounds identical twice.
   - At most 3 squeaks sound at once; a source node is stopped and disconnected as soon as it ends.
   - Silent when the site is muted. If the file cannot be loaded (offline, blocked) the toys simply stay silent:
     there is no fallback sound, and nothing ever throws. */

const TOY_MAX_VOICES = 3;
const TOY_RATE_MIN = 0.7;
const TOY_RATE_MAX = 1.15;
let toyBuffer = null;       // the decoded squeak, kept once loaded
let toyLoading = null;      // the load in progress (so quick taps do not load it twice)
let toyFailedAt = 0;        // when a load last failed (we try again after 15 s, not on every tap)
let toyVoices = 0;          // how many squeaks are sounding right now

async function loadToyBuffer(c) {
  if (toyBuffer) return toyBuffer;
  if (toyLoading) return toyLoading;
  if (toyFailedAt && Date.now() - toyFailedAt < 15000) return null;
  toyLoading = (async () => {
    let ogg = false;
    try { ogg = !!new Audio().canPlayType('audio/ogg; codecs=opus'); } catch { ogg = false; }
    const res = await fetch(ogg ? '/audio/toy-squeak.ogg' : '/audio/toy-squeak.mp3');
    if (!res.ok) throw new Error('toy squeak missing');
    const bytes = await res.arrayBuffer();
    return new Promise((resolve, reject) => { c.decodeAudioData(bytes, resolve, reject); });
  })()
    .then((b) => { toyBuffer = b; return b; })
    .catch(() => { toyFailedAt = Date.now(); return null; })
    .finally(() => { toyLoading = null; });
  return toyLoading;
}

/** Plays a toy's squeak. Resolves true if a sound started. Call it from a tap or click (the browser needs that to allow sound). */
export async function playToy(toyKey) {
  try {
    if (muted || toyVoices >= TOY_MAX_VOICES) return false;
    const c = primeAudio();
    if (!c) return false;
    const buf = await loadToyBuffer(c);
    if (!buf || muted || toyVoices >= TOY_MAX_VOICES) return false;
    if (c.state === 'suspended') { try { await c.resume(); } catch { /* still blocked: stay silent */ } }
    const base = (TOYS[toyKey] && TOYS[toyKey].rate) || 1;
    const rate = Math.min(TOY_RATE_MAX, Math.max(TOY_RATE_MIN, base * (0.95 + Math.random() * 0.1)));
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const gain = c.createGain();
    gain.gain.value = TOY_VOLUME;
    src.connect(gain);
    gain.connect(c.destination);
    toyVoices++;
    src.onended = () => {
      toyVoices = Math.max(0, toyVoices - 1);
      try { src.disconnect(); gain.disconnect(); } catch { /* already gone */ }
    };
    try { src.start(0); } catch { toyVoices = Math.max(0, toyVoices - 1); return false; }
    return true;
  } catch {
    return false;
  }
}

