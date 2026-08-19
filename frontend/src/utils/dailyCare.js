import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/* Today's routine wellness care.

   The server owns both the item list and the "today" boundary, so the card
   can't drift from it: a device with a wrong clock still ticks the server's
   day, and adding a fifth habit later needs no frontend change. */

export async function fetchDailyCare(dogId) {
  if (!dogId) return null;
  try {
    const { data } = await axios.get(`${API_URL}/api/daily-care/${dogId}`);
    return data;
  } catch {
    return null;   // the card hides rather than showing a broken shell
  }
}

export async function toggleDailyCare(dogId, item, done) {
  const { data } = await axios.patch(`${API_URL}/api/daily-care/${dogId}`, { item, done });
  return data;
}

/* Replace the whole list in one call.

   An existing item MUST send its `code` back — that is what keeps today's
   tick attached to it through a rename. A new item sends no code and the
   server assigns one. */
export async function saveCareItems(dogId, items) {
  const { data } = await axios.put(`${API_URL}/api/daily-care/${dogId}/items`, {
    items: items.map(({ code, label, icon }) => ({ code: code || undefined, label, icon })),
  });
  return data;   // the card's full refreshed state
}

/** A small, deliberately boring set — enough to tell habits apart at a glance. */
export const ICON_CHOICES = [
  '🍚', '💧', '🦮', '🧴', '💊', '🦷', '🎾', '🛁', '✂️', '🧠', '🐾', '❤️',
];

/** "Resets in 7 hours" / "Resets in 45 minutes" — the card's own countdown. */
export const resetLabel = (seconds) => {
  if (seconds == null) return '';
  const hours = Math.floor(seconds / 3600);
  if (hours >= 1) return `Resets in ${hours} hour${hours === 1 ? '' : 's'}`;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `Resets in ${minutes} minute${minutes === 1 ? '' : 's'}`;
};
