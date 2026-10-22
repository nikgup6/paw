import { BARK_UNLOCK_ORDER } from '../constants/quizAudio';
import { STREETS_KEY, STREETS_PER_BARK } from '../constants/playGame';

/* Which breeds' bark buttons the "Walk the dog" game has unlocked.
   Stored as an array of breed names in localStorage (key pb_bark_unlocked), inside try/catch so a
   blocked storage just means "nothing remembered" and never crashes anything. */

const KEY = 'pb_bark_unlocked';
const EVENT = 'pb-bark-unlock';

export function getUnlocked() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Locked = a breed listed in BARK_UNLOCK_ORDER that is not unlocked yet (and not the matched #1 breed). */
export function isBarkLocked(breedName, alwaysUnlocked = null) {
  if (!BARK_UNLOCK_ORDER.includes(breedName)) return false;
  if (breedName === alwaysUnlocked) return false;
  return !getUnlocked().includes(breedName);
}

/** Unlocks the next `count` breeds in BARK_UNLOCK_ORDER. Returns the names just unlocked. */
export function unlockNext(count) {
  const have = new Set(getUnlocked());
  const added = [];
  for (const name of BARK_UNLOCK_ORDER) {
    if (added.length >= count) break;
    if (!have.has(name)) { have.add(name); added.push(name); }
  }
  if (added.length) {
    try { window.localStorage.setItem(KEY, JSON.stringify([...have])); } catch { /* not remembered */ }
    try { window.dispatchEvent(new Event(EVENT)); } catch { /* ignore */ }
  }
  return added;
}

/** Subscribe to unlock changes (so buttons can refresh). Returns the unsubscribe function. */
export function onBarkUnlock(fn) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

/** Total streets walked in the game on this device (0 if storage is blocked). */
export function getStreets() {
  try {
    const n = parseInt(window.localStorage.getItem(STREETS_KEY) || '0', 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Adds streets walked and unlocks one new bark for every STREETS_PER_BARK streets reached. Returns { total, unlocked }. */
export function addStreets(count) {
  const before = getStreets();
  const total = before + Math.max(0, count | 0);
  try { window.localStorage.setItem(STREETS_KEY, String(total)); } catch { /* not remembered */ }
  const crossed = Math.floor(total / STREETS_PER_BARK) - Math.floor(before / STREETS_PER_BARK);
  return { total, unlocked: crossed > 0 ? unlockNext(crossed) : [] };
}
