/* ============================================================================
   Verified breeder network — data access + WhatsApp hand-off.

   Source: PAW_BUDDY_Breeder_Database.xlsx (Google Places, July 2026).
   Only Tier 1 and Tier 2 breeders are shipped in breeders.json. Tier 3/4 carry
   documented welfare red flags (parvo cases, undisclosed congenital disease,
   fake-review patterns, mediators with no kennel) and are deliberately excluded
   — the site promises a *verified, ethical* network, so those sellers must not
   be surfaced. The internal red-flag notes are never shipped to the client.
   ========================================================================= */

import breeders from '../constants/breeders.json';
import cityCfg from '../config/breederCities.json';

/* Quiz city -> network lookups, built once from the editable config. */
const LOCAL_OF = new Map();     // "Bengaluru" -> "Bangalore" (their own city)
const NEAREST_OF = new Map();   // "Mysuru"    -> "Bangalore" (nearest, not local)

for (const [network, cities] of Object.entries(cityCfg.localCities || {})) {
  for (const c of cities) LOCAL_OF.set(c, network);
}
for (const [network, cities] of Object.entries(cityCfg.nearest || {})) {
  for (const c of cities) NEAREST_OF.set(c, network);
}

/** Which breeder network serves this user, and is it actually their own city? */
export function resolveBreederCity(userCity) {
  // Q3 may hand us a real city ("Chennai"), a zone literal ("zone:HOT_DRY"),
  // or a legacy climate band ("hot"). Only a real city can ever be a local match.
  const city = typeof userCity === 'string' ? userCity.trim() : '';
  const isRealCity = city && !city.startsWith('zone:') && !['hot', 'cold', 'mixed', 'moderate'].includes(city);
  if (!isRealCity) {
    return { city: cityCfg.defaultCity, isFallback: true, userCity: null };
  }

  // Their own city — the quiz name may differ from the sheet name
  // ("Bengaluru" -> "Bangalore"), so match through the alias table first.
  const local = LOCAL_OF.get(city) || (cityCfg.networks.includes(city) ? city : null);
  if (local) return { city: local, isFallback: false, userCity: city };

  return {
    city: NEAREST_OF.get(city) || cityCfg.defaultCity,
    isFallback: true,
    userCity: city,
  };
}

/** Every city we actually have a verified network in, in config order. */
export const NETWORK_CITIES = cityCfg.networks.filter(
  (city) => breeders.some((b) => b.city === city));

/* The owner's own choice of network, kept on the device.

   Q3 guesses a city from the quiz; that guess is right for most people and
   wrong for anyone shopping outside their own town — someone in Hyderabad
   buying from a Bangalore kennel, or a family about to move. Their correction
   has to outlive the modal, and it has to be the same correction in Explore
   Breeds and in the Top 5, so it lives here rather than in either screen. */
const CITY_KEY = 'pb_breeder_city';

export const readCityPreference = () => {
  try {
    const saved = localStorage.getItem(CITY_KEY);
    return NETWORK_CITIES.includes(saved) ? saved : null;
  } catch {
    return null;                       // private browsing, blocked storage
  }
};

export const writeCityPreference = (city) => {
  try {
    if (city) localStorage.setItem(CITY_KEY, city);
    else localStorage.removeItem(CITY_KEY);
  } catch { /* preference is a nicety, never a blocker */ }
};

export const getBreedersByCity = (city) => breeders.filter((b) => b.city === city);

/**
 * The real neighbourhood names a breeder sits in — people search "Kukatpally",
 * not "North West". A locality cell can name more than one area
 * ("Devarayamjal / Kompally", "Shivapuri Colony, LB Nagar"), so we split it and
 * expose every part. That also means picking "LB Nagar" finds all three
 * breeders in it, not just the one whose cell starts with it.
 */
export function areasOf(breeder) {
  return String(breeder?.locality || '')
    .split(/[/,]/)
    .map((s) => s.replace(/\([^)]*\)/g, '').trim())   // drop "(nearest to Madhapur)"
    .filter(Boolean);
}

/** Every area in a city that actually has a breeder, A–Z. */
export const getAreas = (city) =>
  [...new Set(getBreedersByCity(city).flatMap(areasOf))]
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

/** Does this breeder list the given breed? Tolerates DB naming variants. */
const carries = (breeder, breedName) => {
  if (!breedName) return false;
  const target = breedName.toLowerCase();
  return [...(breeder.breeds || []), ...(breeder.otherBreeds || [])].some((b) => {
    const x = b.toLowerCase();
    return x === target || x.includes(target) || target.includes(x);
  });
};

/**
 * Rank breeders against the user's Top 5 recommendations.
 * The breed they clicked ranks hardest, their other recommended breeds still
 * count, and nobody is filtered out — a user must never hit an empty screen.
 */
export function rankBreeders(list, { breedName, topBreeds = [] } = {}) {
  const others = topBreeds.filter((b) => b && b !== breedName);

  return list
    .map((b) => {
      const hasPicked = carries(b, breedName);
      const matched = others.filter((t) => carries(b, t));
      // clicked breed dominates; each other Top-5 breed adds a little
      const matchScore = (hasPicked ? 100 : 0) + matched.length * 10;
      return {
        ...b,
        hasPicked,
        matchedTopBreeds: matched,
        matchScore,
        matchLabel: hasPicked
          ? `Has ${breedName}`
          : matched.length
            ? `Has ${matched.slice(0, 2).join(', ')}`
            : null,
      };
    })
    .sort((x, y) =>
      (y.matchScore - x.matchScore) ||
      (x.tier - y.tier) ||
      ((y.confidence || 0) - (x.confidence || 0)) ||
      x.name.localeCompare(y.name));
}

/** wa.me needs a bare international number: "+91 80065 55444" -> 918006555444.
    Returns null for anything that isn't a dialable number — a few DB rows carry
    "Not listed" rather than a phone, and those must not produce dead links. */
const normalisePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;                       // bare local number
  if (digits.length === 12 && digits.startsWith('91')) return digits;   // already +91
  return null;
};

export const hasPhone = (phone) => normalisePhone(phone) !== null;

export const telHref = (phone) => {
  const n = normalisePhone(phone);
  return n ? `tel:+${n}` : null;
};

/**
 * Per-breeder WhatsApp link. The number is the breeder's own, and the message
 * names them and the breed the user is actually after.
 */
export function buildBreederWhatsAppLink(breeder, breedName) {
  const number = normalisePhone(breeder?.phone);
  if (!number) return null;
  const breed = breedName ? `a ${breedName}` : 'a puppy';
  const msg =
    `Hello ${breeder.name}, I found you through Paw Buddy. ` +
    `We are looking for ${breed} puppy — could you let me know if you have any available, ` +
    `and whether we can meet the parent dogs?`;
  return `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;
}
