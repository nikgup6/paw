/* Small, safe localStorage helpers for Breed Swipe.

   Every read and write is wrapped in try/catch: in a private window, or with
   site data blocked, storage can throw. We never let that crash the app; a
   blocked storage simply means "not remembered". */

const KEYS = {
  shortlist: 'pb_swipe_shortlist',          // array of breed ids (strings)
  tutorial: 'pb_swipe_tutorial_seen',       // '1' once the coach overlay has been shown
  newTag: 'pb_swipe_new_seen',              // '1' once the results "Tinder for dogs" button was used
};

const read = (key) => {
  try { return window.localStorage.getItem(key); } catch { return null; }
};
const write = (key, value) => {
  try { window.localStorage.setItem(key, value); } catch { /* storage blocked: not remembered */ }
};

export function getShortlist() {
  try {
    const parsed = JSON.parse(read(KEYS.shortlist) || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
export function setShortlist(ids) {
  write(KEYS.shortlist, JSON.stringify((ids || []).map(String)));
}

export const getTutorialSeen = () => read(KEYS.tutorial) === '1';
export const setTutorialSeen = () => write(KEYS.tutorial, '1');

export const getNewTagSeen = () => read(KEYS.newTag) === '1';
export const setNewTagSeen = () => write(KEYS.newTag, '1');
