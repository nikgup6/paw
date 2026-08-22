import { telHref } from './breeders';
import cityCfg from '../config/breederCities.json';

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

/* ------------------------- which city to open on ------------------------- */

/* One nearest-city table for every directory, reused from the breeder config
   rather than copied: a city is near Chennai whether you are looking for a
   breeder, a vet or a groomer, and two tables would drift.

   Coverage is checked per directory, which matters more than it looks — vets
   cover five cities but groomers currently cover only Hyderabad, so "nearest
   network" alone would hand a Nellore owner a Chennai groomer list that does
   not exist. Resolution therefore walks: their own city -> nearest network we
   cover -> the default -> whatever this directory actually has. */
const NEAREST_OF = new Map();
for (const [network, cities] of Object.entries(cityCfg.nearest || {})) {
  for (const c of cities) NEAREST_OF.set(c, network);
}

const isRealCity = (value) => {
  const city = typeof value === 'string' ? value.trim() : '';
  return Boolean(city)
    && !city.startsWith('zone:')
    && !['hot', 'cold', 'mixed', 'moderate'].includes(city.toLowerCase());
};

/**
 * Where a directory should open for this owner.
 *
 * `{ city, isFallback, userCity }` — `isFallback` true means we are showing
 * somewhere other than where they live, which the UI is expected to SAY rather
 * than quietly substitute. That silent substitution is the whole reason a
 * Nellore owner saw a Hyderabad list with no explanation.
 */
export function resolveDirectoryCity(userCity, coveredCities) {
  const covered = Array.isArray(coveredCities) ? coveredCities : [];
  const fallbackCity = covered.includes(cityCfg.defaultCity) ? cityCfg.defaultCity : covered[0] || null;

  if (!isRealCity(userCity)) {
    return { city: fallbackCity, isFallback: false, userCity: null };
  }
  const city = userCity.trim();

  // Their own city, if this directory has anything in it.
  if (covered.includes(city)) return { city, isFallback: false, userCity: city };

  // Otherwise the nearest network — but only if it is covered here too.
  const nearest = NEAREST_OF.get(city);
  if (nearest && covered.includes(nearest)) {
    return { city: nearest, isFallback: true, userCity: city };
  }

  return { city: fallbackCity, isFallback: Boolean(fallbackCity), userCity: city };
}

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
