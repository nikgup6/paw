import { telHref } from './breeders';

/* Shared helpers for any "local business directory" list — vets and
   groomers today, both generated from a workbook by the same extractor
   shape (scripts/extract_vets.py / extract_groomers.py) into the same
   field names: name, rating, reviews, phone, mapsUrl, locality, address,
   services, city, id. Kept here once instead of duplicated per directory
   so a formatting change (e.g. the rating display) never drifts between
   the two lists. */

export { telHref };

/** "4.9 / 5" plus a thousands-separated review count, or null when unrated. */
export const ratingLabel = (item) => (
  item.rating != null ? `${item.rating.toFixed(1)} / 5` : null
);

/* Parenthesised so "4.9 / 5" and the count can't read as one number
   ("4.9 / 5  2,306" scans as 52,306 at a glance). */
export const reviewLabel = (item) => (
  item.reviews != null ? `(${item.reviews.toLocaleString('en-IN')} Google reviews)` : null
);

/**
 * The real neighbourhood names a business sits in. A locality cell can name
 * more than one area ("Sector 17, Airoli"), so every part is exposed rather
 * than just the first.
 */
export function areasOf(item) {
  return String(item?.locality || '')
    .split(/[/,]/)
    .map((s) => s.replace(/\([^)]*\)/g, '').trim())
    .filter(Boolean);
}

/** Every area in a city that actually has an entry, A–Z. */
export const areasForCity = (items, city) =>
  [...new Set(items.filter((i) => i.city === city).flatMap(areasOf))]
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

/** The card shows one short line of services; the profile shows the full text. */
export const shortServices = (text, max = 68) => {
  const value = String(text || '').trim();
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(';'), cut.lastIndexOf(','), cut.lastIndexOf(' '));
  return `${cut.slice(0, stop > 30 ? stop : max).trim()}…`;
};

/** Remembered city choice for a given directory, so it opens where they left it. */
export const readCityPreference = (key, cities) => {
  try {
    const saved = window.localStorage.getItem(key);
    return cities.includes(saved) ? saved : null;
  } catch {
    return null;
  }
};

export const writeCityPreference = (key, city) => {
  try {
    if (city) window.localStorage.setItem(key, city);
    else window.localStorage.removeItem(key);
  } catch {
    /* private mode — the directory still works, it just won't remember */
  }
};
