/* ============================================================================
   PAW BUDDY — RIGHTBREED matching engine  ·  v4
   Database: WAGGY Dog Database V4 (23 breeds)   ·   Questions: 9

   WHY v4: the old model was fully additive, so climate's worst penalty (-15)
   competed against a ~212pt ceiling of unrelated positives — a heat-dangerous
   breed only lost ~8% of max score and could still rank #1.

   The v4 rule:
     · factors describing a PREFERENCE  -> ADD points   (base, max 100)
     · factors describing a RISK        -> MULTIPLY down (gates G1/G2/G3)
   Preferences trade off against each other. Risks cannot be bought back by
   unrelated strengths.

     final = round(base x G1 x G2 x G3)      <- IS the displayed match %

   Nothing is capped or floored. A Pug in Chennai shows ~25%, and that is the
   entire point of this engine.

   Only ONE thing eliminates a breed outright: a "House only" breed in a 1BHK.
   Every other mismatch is a graded penalty plus a visible flag.

   Step 0 fails LOUD: any quiz answer or DB value that does not map to a known
   enum throws. scripts/validate-data.mjs runs the same maps at build time
   (npm run prebuild), so bad data breaks the build, never silently scores 0.
   ========================================================================= */

import cityZonesCfg from '../config/cityZones.json' with { type: 'json' };
import heatCfg from '../config/breedHeatClasses.json' with { type: 'json' };
import floorCfg from '../config/breedFlooringClasses.json' with { type: 'json' };
import trainCfg from '../config/breedTrainabilityClasses.json' with { type: 'json' };
import aloneCfg from '../config/breedAloneToleranceClasses.json' with { type: 'json' };
import {
  headToken,
  ENERGY_BAND, RISK_TIER, HAIR_VALUES, HAIR_BAND, APT_FRIENDLY, MIN_APT_RANK, HOUSE_NEED_BAND, SPACE_GENERAL_BREEDS, EXPERIENCE_LEVELS,
  ACTIVITY_BAND, HAIR_PREF, HOME_APT_RANK, HOME_IS_HOUSE, HOME_SHOWS_PG_DISCLAIMER, HOME_SHOWS_UNSURE_DISCLAIMER,
  BUDGET_CEILING, FAMILY_HAS_VULNERABLE, EXPERIENCE_ANSWERS, PURPOSE, EXPERIENCE_GATE,
  FLOORING_ANSWER, TRAINING_EFFORT_ANSWER, SCHEDULE_ANSWER, SCHEDULE_SHOWS_WELFARE_DISCLAIMER,
} from '../config/enums.js';

/* ========================= STEP 0 — NORMALISATION ========================= */

/** Thrown for any unmapped enum. Never caught inside the engine — a silent
    fallback to zero is exactly the bug v4 exists to kill. */
export class RightbreedDataError extends Error {
  constructor(message) {
    super(`[RIGHTBREED] ${message}`);
    this.name = 'RightbreedDataError';
  }
}
const fail = (msg) => { throw new RightbreedDataError(msg); };

/** Look up `key` in `map` or fail loudly. */
function mustMap(map, key, what) {
  if (key == null || !Object.prototype.hasOwnProperty.call(map, key)) {
    fail(`Unmapped ${what}: ${JSON.stringify(key)}. Add it to the enum map or fix the data.`);
  }
  return map[key];
}

const toArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

/* ---- city -> climate zone (editable config, see config/cityZones.json) ---- */
const LEGACY_BANDS = { ...cityZonesCfg.legacyBands };
delete LEGACY_BANDS._comment;

/* Case- and spacing-insensitive city lookup. Users type "hyderabad",
   "HYDERABAD " or "Navi  Mumbai"; adding every spelling as its own key in
   cityZones.json doesn't scale and silently misses the next one. Keys are
   normalised once at load. Two config keys that collapse to the same
   normalised form but disagree on zone is a data error, so it fails loud. */
const normCity = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
const CITY_LOOKUP = {};
for (const [name, zone] of Object.entries(cityZonesCfg.cities)) {
  const k = normCity(name);
  if (CITY_LOOKUP[k] && CITY_LOOKUP[k] !== zone) {
    throw new Error(`[RIGHTBREED] cityZones.json: "${name}" conflicts with another spelling (${CITY_LOOKUP[k]} vs ${zone}).`);
  }
  CITY_LOOKUP[k] = zone;
}

export function cityZone(answer) {
  if (typeof answer !== 'string' || !answer.trim()) fail(`Missing city answer: ${JSON.stringify(answer)}`);
  const v = answer.trim();
  if (v.startsWith('zone:')) {
    const z = v.slice(5);
    if (!cityZonesCfg.zones.includes(z)) fail(`Unknown zone literal: ${JSON.stringify(v)}`);
    return z;
  }
  if (Object.prototype.hasOwnProperty.call(CITY_LOOKUP, normCity(v))) return CITY_LOOKUP[normCity(v)];
  if (Object.prototype.hasOwnProperty.call(LEGACY_BANDS, v)) return LEGACY_BANDS[v];
  fail(`Unmapped city: ${JSON.stringify(v)}. Add it to config/cityZones.json.`);
}

export const zoneLabel = (zone) => mustMap(cityZonesCfg.zoneLabels, zone, 'climate zone');

/** Normalise one breed row into strict enums. Throws on anything unmapped. */
export function normaliseBreed(b) {
  const where = b?.name ? `breed "${b.name}"` : 'unnamed breed';
  const indiaScore = Number(b?.score);
  if (!Number.isFinite(indiaScore) || indiaScore < 1 || indiaScore > 5) {
    fail(`Invalid India suitability score for ${where}: ${JSON.stringify(b?.score)} (expected 1–5).`);
  }
  const min = Number(b?.monthlyCostMin);
  const max = Number(b?.monthlyCostMax);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) {
    fail(`Invalid monthly cost for ${where}: ${JSON.stringify(b?.monthlyCostMin)}–${JSON.stringify(b?.monthlyCostMax)}.`);
  }
  return {
    energyBand: mustMap(ENERGY_BAND, headToken(b.energy), `energy for ${where}`),
    riskTier: mustMap(RISK_TIER, headToken(b.risk), `family risk for ${where}`),
    hair: mustMap(HAIR_VALUES, String(b.hair ?? '').trim(), `hair length for ${where}`),
    hairBand: mustMap(HAIR_BAND, String(b.hair ?? '').trim(), `hair length for ${where}`),
    aptFriendly: mustMap(APT_FRIENDLY, String(b.apt ?? '').trim(), `apartment-friendly for ${where}`),
    aptRank: mustMap(MIN_APT_RANK, String(b.minApartmentSize ?? '').trim(), `minApartmentSize for ${where}`),
    houseNeedBand: mustMap(HOUSE_NEED_BAND, headToken(b.house), `house need for ${where}`),
    spaceGeneral: SPACE_GENERAL_BREEDS.has(String(b.name ?? '').trim()),
    experience: resolveExperience(b, where),
    heatClass: mustMap(heatCfg.breeds, String(b.name ?? '').trim(), `heat class for ${where}`),
    floorClass: mustMap(floorCfg.breeds, String(b.name ?? '').trim(), `flooring class for ${where}`),
    trainClass: mustMap(trainCfg.breeds, String(b.name ?? '').trim(), `trainability class for ${where}`),
    aloneClass: mustMap(aloneCfg.breeds, String(b.name ?? '').trim(), `alone-tolerance class for ${where}`),
    indiaScore,
    costMid: (min + max) / 2,
    sizeRank: mustMap(SIZE_RANK, sizeToken(b.size), `size for ${where}`),
  };
}

/** Size band from the DB `size` column ("L (25–36 kg, 55–62 cm)" -> "L").
    Used only by the senior-strength gate (G7). Unknown values fail loud. */
const SIZE_RANK = { XS: 0, 'XS–S': 0.5, S: 1, 'S–M': 1.5, M: 2, 'M–L': 2.5, L: 3, XL: 4 };
const sizeToken = (s) => String(s ?? '').trim().split(/[\s(]/)[0];

/** Owner-experience tier. Prefers the real V4 column; the derived proxy is a
    fallback ONLY when that column is missing/null, never when real data exists. */
function resolveExperience(b, where) {
  const raw = b?.experienceLevel == null ? '' : String(b.experienceLevel).trim();
  if (raw) return mustMap(EXPERIENCE_LEVELS, raw, `experienceLevel for ${where}`);

  const risk = mustMap(RISK_TIER, headToken(b.risk), `family risk for ${where}`);
  const energyBand = mustMap(ENERGY_BAND, headToken(b.energy), `energy for ${where}`);
  const grooming = headToken(b.grooming).split('(')[0].trim();
  const groomHeavy = ['High', 'Very High'].includes(grooming);
  return (risk === 'LOW' && energyBand <= 1 && !groomHeavy) ? 'BEGINNER_FRIENDLY' : 'DEMANDING';
}

/* ============================ READINESS GATE ============================== */
/* Purchase-timeline lead tier. This is deliberately SEPARATE from breed
   scoring — when a person plans to get a dog has nothing to do with WHICH
   breed suits them. It classifies the lead, it does not rank breeds.
   Mirror of the readiness_levels table in the schema; keep the two in sync so
   labels live in one place. */
export const READINESS_LEVELS = {
  ready_now:   { rank: 1, label: 'Ready Now',        description: 'Bringing a dog home within a month' },
  ready_soon:  { rank: 2, label: 'Ready Soon',       description: 'Bringing a dog home in 1-3 months' },
  planning:    { rank: 3, label: 'Planning Ahead',   description: 'Bringing a dog home in 3-6 months' },
  researching: { rank: 4, label: 'Just Researching', description: 'Still researching, no date yet' },
};

/**
 * Reads the Q10 timeline answer and returns the lead tier.
 * The answer value IS the readiness code (see questions.json), so no mapping
 * is needed. Falls back to 'researching' — the least aggressive tier — if the
 * question was skipped, so a missing answer never inflates lead quality.
 *
 * Write the returned `code` straight into quiz_progress.readiness_code.
 */
export function computeReadiness(answers) {
  const raw = answers && answers.timeline;
  const code = (Array.isArray(raw) ? raw[0] : raw);
  const valid = code && Object.prototype.hasOwnProperty.call(READINESS_LEVELS, code)
    ? code : 'researching';
  const { rank, label, description } = READINESS_LEVELS[valid];
  return { code: valid, rank, label, description };
}

/** Normalise the answer sheet into strict enums. Throws on anything unmapped. */
export function normaliseAnswers(answers) {
  if (!answers || typeof answers !== 'object') fail('Missing quiz answers.');
  const one = (id, fallbackValue) => {
    const v = answers[id];
    const picked = Array.isArray(v) ? v[0] : v;
    // Defensive, not a fix for a live bug: the one caller that can produce
    // a literal "unknown" (the AI Matchmaker's backend route) already
    // strips it before the frontend ever sees it — checked the actual
    // filtering code, confirmed. This guard just means a future caller
    // that isn't as careful can't reach the same crash this would
    // otherwise cause (every "unknown"-enum field maps to a real answer
    // value here, and none of those values is the string "unknown").
    return picked == null || picked === '' || picked === 'unknown' ? fallbackValue : picked;
  };

  const purposes = toArray(answers.purpose).length ? toArray(answers.purpose) : ['family'];
  const activities = toArray(answers.activity).length ? toArray(answers.activity) : ['moderate'];
  const hairPrefs = toArray(answers.hair).length ? toArray(answers.hair) : ['any'];
  const home = one('home', 'apt-2bhk');
  const budget = one('budget', '5k-10k');
  /* These three defaults are deliberately the CONSERVATIVE answer, not the
     convenient one. The live Quiz.jsx UI can't actually produce a missing
     value here — every question is required, Next stays disabled until
     answered — so these only matter on paths that bypass that quiz UI
     entirely: the AI Matchmaker (confirmed: its extraction schema has no
     flooring field at all, so every matchmaker-sourced result hit this
     default) and a returning user's stale localStorage saved before these
     questions existed. On both paths, assuming the SAFER situation (a
     vulnerable person present, hard flooring, a hot city) means a real risk
     stays visible instead of silently vanishing because the data was never
     collected. Assuming a hot city over 'moderate' also happens to be the
     demographically likely case — most Indian flats have tile or marble,
     and most of this product's pilot cities run hot. */
  // 'young-kids'/'older-kids' replace 'kids' after the question split.
  // 'kids' is kept as a legacy fallback for stale localStorage.
  const family = one('family', 'young-kids');
  const experience = one('experience', 'none');
  const flooring = one('flooring', 'hard');
  const trainingEffort = one('trainingEffort', 'moderate');
  const schedule = one('schedule', 'home');

  purposes.forEach((p) => mustMap(PURPOSE, p, 'purpose answer'));
  activities.forEach((a) => mustMap(ACTIVITY_BAND, a, 'activity answer'));
  hairPrefs.forEach((h) => mustMap(HAIR_PREF, h, 'hair answer'));
  if (!HOME_IS_HOUSE[home] && !Object.prototype.hasOwnProperty.call(HOME_APT_RANK, home)) {
    fail(`Unmapped home answer: ${JSON.stringify(home)}.`);
  }

  return {
    purposes,
    activities,
    hairPrefs,
    home,
    isHouse: Boolean(HOME_IS_HOUSE[home]),
    aptRank: HOME_IS_HOUSE[home] ? null : HOME_APT_RANK[home],
    zone: cityZone(one('city', 'hot')),
    budgetCeiling: mustMap(BUDGET_CEILING, budget, 'budget answer'),
    hasVulnerable: mustMap(FAMILY_HAS_VULNERABLE, family, 'family answer'),
    isFirstTimer: mustMap(EXPERIENCE_ANSWERS, experience, 'experience answer'),
    floorAnswer: mustMap(FLOORING_ANSWER, flooring, 'flooring answer'),
    trainAnswer: mustMap(TRAINING_EFFORT_ANSWER, trainingEffort, 'training-effort answer'),
    scheduleAnswer: mustMap(SCHEDULE_ANSWER, schedule, 'schedule answer'),
    showsScheduleDisclaimer: mustMap(SCHEDULE_SHOWS_WELFARE_DISCLAIMER, schedule, 'schedule answer'),
    showsPgDisclaimer: mustMap(HOME_SHOWS_PG_DISCLAIMER, home, 'home answer'),
    showsHomeUnsureDisclaimer: mustMap(HOME_SHOWS_UNSURE_DISCLAIMER, home, 'home answer'),
    experienceAnswer: experience,
    // Split out of hasVulnerable: the child-safety flag and the senior
    // fall-risk gate care about different people.
    // young-kids is the strictest category; older-kids and the legacy 'kids'
    // value both apply the standard children safety filter. 'both' means
    // children AND seniors present — already maps to hasVulnerable=true.
    hasKids: family === 'young-kids' || family === 'older-kids' || family === 'kids' || family === 'both',
    hasYoungKids: family === 'young-kids',  // used for extra-strict safety text
    hasSeniors: family === 'seniors' || family === 'both',
    raw: { home, budget, family, experience, flooring, trainingEffort, schedule },
  };
}

/* ==================== STEP 1 — BASE SCORECARD (max 100) =================== */
/* B1 20 · B2 20 · B3 15 · B4 15 · B6 15 · B7 15  = 100
   Shedding (formerly B5, 10pts) was dropped as a standalone question — Hair
   (B6) is the only surviving coat-preference question, so it inherits the
   full 15pts the two used to share (10+5), not just its old 5. It now uses
   the same graded-distance scoring Activity already uses, rather than a flat
   binary match — a factor worth 15pts shouldn't score all-or-nothing. */

/* Multi-select takes the BEST match — picking more options never costs points. */
const best = (list, fn) => (list.length ? Math.max(...list.map(fn)) : 0);

/** B1 Purpose (20): direct role match 20, adjacent 10, unrelated 0. */
const scorePurpose = (purposes, breedPurpose = '') => {
  const real = purposes.filter((p) => p !== 'breed');
  return best(real, (p) => {
    const { primary, secondary } = PURPOSE[p];
    if (primary.some((k) => breedPurpose.includes(k))) return 20;
    if (secondary.some((k) => breedPurpose.includes(k))) return 10;
    return 0;
  });
};

/** B2 Activity (20): exact band 20, one step 10, two off 0 — using <= bands
    rather than === so the fractional Low–Medium/Medium–High energy values
    (0.5/1.5) bucket sensibly instead of silently falling through to 0. A
    breed honestly documented as "Low–Medium" energy is a genuine match for
    either a relaxed or a moderate owner, not a mismatch for both. */
const scoreActivity = (activities, energyBand) =>
  best(activities, (a) => {
    const d = Math.abs(ACTIVITY_BAND[a] - energyBand);
    return d <= 0.5 ? 20 : d <= 1.5 ? 10 : 0;
  });

/** B3 Home fit (15): house-yard = 15 flat, any documented need is covered.
    house-no-yard grades by the breed's own house-need column, EXCEPT for
    the handful of breeds whose High rating is about total space rather than
    a yard specifically (SPACE_GENERAL_BREEDS — currently just Great Dane,
    the only breed whose text says "indoor/outdoor" rather than naming a
    yard). Those get Medium-tier treatment instead of the strict tier, since
    we have no question asking about indoor square footage and shouldn't
    assume a no-yard home lacks it. >= bands (not ===) so the fractional
    Low–Medium value (0.5) buckets with Medium's partial credit rather than
    falling through to a full-marks default. Apartment logic unchanged:
    YES 15 / CONDITIONAL 5 / NO 0, derived since V4 has no CONDITIONAL column. */
const scoreHome = (a, nb) => {
  if (a.home === 'house-yard') return 15;
  if (a.home === 'house-no-yard') {
    const band = (nb.houseNeedBand >= 1.5 && nb.spaceGeneral) ? 1 : nb.houseNeedBand;
    return band >= 1.5 ? 4 : band >= 0.5 ? 10 : 15;
  }
  if (!nb.aptFriendly || nb.aptRank === 4) return 0;
  // PG sits below the apartment ladder, not on a rung of it — the generic
  // `needRank <= homeRank` comparison would give every apartment-friendly
  // breed the same flat 5 here (nothing has needRank <= 0.5), losing exactly
  // the distinction that matters: a 1BHK-OK breed is genuinely more workable
  // in a single room than a breed that already wants a full 2BHK or 3BHK.
  if (a.home === 'pg') return nb.aptRank === 1 ? 10 : nb.aptRank === 2 ? 5 : 0;
  return nb.aptRank <= a.aptRank ? 15 : 5;
};

/** B4 Budget (15): compares the cost MIDPOINT, never the minimum. */
const scoreBudget = (ceiling, costMid) => {
  if (costMid <= ceiling) return { points: 15, flag: null };
  if (costMid <= ceiling * 1.2) return { points: 8, flag: 'BUDGET' };
  return { points: 0, flag: 'BUDGET' };
};

/** B6 Hair (15, boosted from 5 — see header note): "no preference" scores
    full; otherwise graded by ordinal distance on Short/Medium/Long, exact
    band 15, one step 7, two steps 0 — the same shape Activity already uses. */
const scoreHair = (hairPrefs, breedHairBand) =>
  best(hairPrefs, (h) => {
    if (HAIR_PREF[h] === 'ANY') return 15;
    const d = Math.abs(HAIR_BAND[HAIR_PREF[h]] - breedHairBand);
    return d === 0 ? 15 : d === 1 ? 7 : 0;
  });

/** B7 India suitability (15): the DB's own 1–5 score, x3. */
/* India suitability was x3 (15 pts). That 1–5 score already folds in heat
   tolerance, which G1 prices separately — so hot-climate breeds were paid
   twice (15 pts here AND no G1 cut), which is a large part of why two native
   breeds took #1 in ~58% of all answer combinations. Weight dropped to x1
   (5 pts). The base is then rescaled to 100 (see BASE_MAX) so the label
   thresholds 80/65/50 keep their meaning. Change INDIA_WEIGHT here only. */
const INDIA_WEIGHT = 1;
const scoreIndia = (indiaScore) => indiaScore * INDIA_WEIGHT;
const BASE_MAX = 20 + 20 + 15 + 15 + 15 + 5 * INDIA_WEIGHT; // purpose+activity+home+budget+hair+india

/* ======================= STEP 2 — RISK GATES ============================== */

/** G1 climate: user zone x breed heat class. Table lives in editable config. */
export const climateGate = (heatClass, zone) =>
  mustMap(mustMap(heatCfg.classes, heatClass, 'heat class'), zone, `zone for heat class ${heatClass}`);

/** G2 family safety: only bites when children/elderly actually live at home. */
/* LOW_MEDIUM and MEDIUM_HIGH are arithmetic midpoints of their neighbours
   (LOW+MEDIUM)/2 and (MEDIUM+HIGH)/2 — an honest interpolation, not a guess. */
/* G7 senior strength: G2 only measures temperament, so a "Low risk" 30 kg
   Labrador scored as perfectly safe for an elderly couple. Pet-related falls
   are a documented injury source for older adults (CDC MMWR 2009: highest
   fracture rates at 75+). Applies only when seniors live at home.
   "Strong" = L/XL, or M and up with High/Very High energy (pullers). */
const STRENGTH_GATE_VALUE = 0.85;
const isStrongDog = (nb) => nb.sizeRank >= 3 || (nb.sizeRank >= 2 && nb.energyBand >= 2);
const strengthGate = (hasSeniors, nb) => (hasSeniors && isStrongDog(nb) ? STRENGTH_GATE_VALUE : 1.0);

/* G8 space: a "House only" breed in ANY flat (2BHK/3BHK/still deciding).
   1BHK/PG is already a hard elimination. Before this, the only cost was 0/15
   home points, so Mudhol Hound still showed 82% and ranked #1 in a 2BHK.
   0.55 sits on the severe-gate line, so it also caps the label. */
const HOUSE_ONLY_IN_FLAT_GATE = 0.55;
const spaceGate = (a, breed) =>
  (!a.isHouse && String(breed.minApartmentSize ?? '').trim() === 'House only' ? HOUSE_ONLY_IN_FLAT_GATE : 1.0);

const FAMILY_GATE = { LOW: 1.0, LOW_MEDIUM: 0.88, MEDIUM: 0.75, MEDIUM_HIGH: 0.58, HIGH: 0.4 };
const familyGate = (hasVulnerable, riskTier) => (hasVulnerable ? FAMILY_GATE[riskTier] : 1.0);

/** G3 experience: only bites for a first-time owner. Three tiers, because the
    V4 experienceLevel column has three real values — "Some experience" is a
    partial penalty (0.80), not the full "Experienced only" one (0.60). */
/* "Some experience" used to gate exactly like "experienced" (1.0 always).
   Growing up with a family dog is not the same as handling a breed the DB
   marks "Experienced only" — so that one combination now takes a mild 0.85
   and raises the EXPERIENCE flag. Every other 'some' combination is 1.0. */
const SOME_EXPERIENCE_GATE = { BEGINNER_FRIENDLY: 1.0, SOME_EXPERIENCE: 1.0, DEMANDING: 0.85 };
const experienceGate = (experienceAnswer, tier) => {
  if (experienceAnswer === 'none') return EXPERIENCE_GATE[tier];
  if (experienceAnswer === 'some') return SOME_EXPERIENCE_GATE[tier];
  return 1.0;
};

const experienceWarning = (tier, experienceAnswer) =>
  (experienceAnswer === 'some'
    ? 'Needs an experienced handler — general past experience with dogs may not be enough'
    : tier === 'DEMANDING'
    ? 'Needs an experienced owner — not a first dog'
    : 'Best with some prior dog experience');

/** G4 flooring: user's floor type x breed's documented joint/spinal risk.
    Table lives in editable config (breedFlooringClasses.json), same pattern
    as G1. A LOW-concern breed is never gated regardless of floor type. */
const floorGate = (floorClass, floorAnswer) =>
  mustMap(mustMap(floorCfg.classes, floorClass, 'flooring class'), floorAnswer, `floor answer for class ${floorClass}`);

/** G5 training effort: user's committed effort x breed's Coren-bucketed
    trainability. Deliberately kept at FULL STRENGTH (mirrors G3's own
    1.0/0.8/0.6 scale) — this factor has real survey data behind it and was
    explicitly NOT softened the way the weaker-evidenced G6 was. NO_DATA
    breeds (never AKC/CKC obedience-evaluated) always gate at 1.0 — a
    literature gap is never a penalty. */
const trainGate = (trainClass, trainAnswer) =>
  mustMap(mustMap(trainCfg.classes, trainClass, 'trainability class'), trainAnswer, `training answer for class ${trainClass}`);

/** G6 daily schedule: user's hours-away x breed's alone-tolerance tier.
    Deliberately the SMALLEST possible bite of any gate (max 0.90, roughly
    half of G4/G5's worst case) — no peer-reviewed study validates breed-
    specific alone-time at all, so this stays a soft nudge, not a real gate.
    The universal 4-hour welfare-ceiling disclaimer (RSPCA/PDSA/Dogs Trust/
    Blue Cross) is separate from this gate and shown independent of breed —
    see showsScheduleDisclaimer in normaliseAnswers(). */
const scheduleGate = (aloneClass, scheduleAnswer) =>
  mustMap(mustMap(aloneCfg.classes, aloneClass, 'alone-tolerance class'), scheduleAnswer, `schedule answer for class ${aloneClass}`);

/* THE ONLY HARD ELIMINATOR. A "House only" breed in a 1BHK is physics, not
   preference. Everything else scores low and stays visible with a flag. */
/* PG is smaller than a 1BHK, so the same hard-elimination applies — a
   House-only breed makes no more sense in a shared room than in a flat.
   .trim() added: this is a bare === comparison with no defensive trimming,
   and it's the one true hard elimination in the whole engine — a single
   trailing space in the data (an Excel export, a hand edit) would silently
   let a House-only breed straight through to a 1BHK with no gate, no flag,
   nothing. Every other minApartmentSize comparison in this file has the
   same theoretical gap; this is the one where a silent miss actually
   matters, so it's the one fixed here. */
const isEliminated = (a, breed) =>
  (a.home === 'apt-1bhk' || a.home === 'pg') && String(breed.minApartmentSize ?? '').trim() === 'House only';

/* Does this breed need more room than the user actually has?

   Two real cases, both previously silent for one of them:
   - Apartment too small for the breed's minApartmentSize (existing).
   - "House, no yard" for a breed whose own house-need column says High —
     previously scored identically to "house, with yard" AND raised no
     warning, contradicting the DB's own "large open space essential" text
     for breeds like Mudhol Hound and Rajapalayam. */
const hasSpaceGap = (a, nb) => {
  if (a.home === 'house-no-yard') return nb.houseNeedBand >= 1.5 && !nb.spaceGeneral; // matches scoreHome's strict-tier cutoff
  if (!a.isHouse && a.aptRank != null) return nb.aptRank > a.aptRank;
  return false;
};

/** Specific on both sides, because "needs more space" alone leaves them
    guessing how much. */
const spaceWarning = (a, breed) => {
  if (a.home === 'house-no-yard') {
    return 'Needs a yard or large open space — you told us an independent house with no yard';
  }
  const needs = String(breed.minApartmentSize || '').trim();
  const home = ANSWER_PHRASES.home[a.home] || 'your home';
  if (needs === 'House only') return `Needs an independent house — you told us ${home}`;
  const size = needs.replace(/\s*(min|OK)$/i, '').trim();   // "2BHK min" -> "2BHK"
  return `Needs at least a ${size} — you told us ${home}`;
};

/* ==================== STEP 3 — FINAL SCORE + LABELS ====================== */

const LABELS = [
  { min: 80, label: 'Excellent Match' },
  { min: 65, label: 'Good Match' },
  { min: 50, label: 'Fair – check the warnings' },
  { min: -Infinity, label: 'Not recommended for your profile' },
];
const FAIR_LABEL = 'Fair – check the warnings';
const labelFor = (score) => LABELS.find((l) => score >= l.min).label;
const labelRank = (label) => LABELS.findIndex((l) => l.label === label);
export const NOT_RECOMMENDED_LABEL = LABELS[LABELS.length - 1].label;

/** Fix 7: what the results page shows. "Not recommended" breeds are hidden
    from the top list; if nothing else survives, the single best one is kept
    so the page is never empty (the UI already badges it "BEST AVAILABLE —
    NOT RECOMMENDED" and the noExcellentMatch banner explains why).
    Returns { matches, hiddenCount }. */
export function selectTopMatches(scored, n = 5) {
  if (!Array.isArray(scored) || !scored.length) return { matches: [], hiddenCount: 0 };
  const ok = scored.filter((b) => b.label !== NOT_RECOMMENDED_LABEL);
  const matches = ok.length ? ok.slice(0, n) : scored.slice(0, 1);
  const hiddenCount = Math.min(n, scored.length) - matches.length;
  return { matches, hiddenCount: Math.max(0, hiddenCount) };
}

const FLAG_TEXT = {
  HEAT: 'Serious heat risk in your city',
  SAFETY: 'Risky around young children or elderly family',
  FLOORING: 'Your flooring adds real joint/spine risk for this breed',
  STRENGTH: 'Large, strong dog — pulling and jumping raise fall risk for elderly family',
  EXPERIENCE: 'Needs more dog-handling experience than you have',
  TRAINING: 'Needs more training effort than you said you can give',
  //: Generic wording for `flagLabel`; the per-result warning is built by
  //  spaceWarning(), which names the actual sizes on both sides.
  SPACE: 'Needs more indoor space than your home has',
  BUDGET: 'Costs more per month than your budget',
  SCHEDULE: 'May struggle with your hours away, based on limited evidence',
};
/* Most severe first — Prompt 5 shows the single worst flag as a warning bullet.
   FLOORING sits with SAFETY: both are physical-welfare risks backed by real
   mechanism evidence (van Hagen et al. 2005), not aesthetic mismatches.
   TRAINING sits with EXPERIENCE: both are owner-capability mismatches, and
   TRAINING is intentionally kept at G3's full severity, not softened.
   SPACE sits above BUDGET: a flat too small for the dog is a daily welfare
   problem, where an over-budget month is a number the owner can plan around.
   SCHEDULE sits last: the weakest-evidenced gate in the engine, deliberately
   the smallest bite — see breedAloneToleranceClasses.json. */
const FLAG_SEVERITY = ['HEAT', 'SAFETY', 'STRENGTH', 'FLOORING', 'EXPERIENCE', 'TRAINING', 'SPACE', 'BUDGET', 'SCHEDULE'];

export function computeMatches(answers, allBreeds) {
  if (!answers || !Array.isArray(allBreeds)) return [];
  const a = normaliseAnswers(answers);

  const scored = [];
  for (const breed of allBreeds) {
    if (isEliminated(a, breed)) continue; // the only outright exclusion
    // One malformed breed record used to take down the ENTIRE results page
    // for every user — normaliseBreed()'s own fail() is intentionally
    // strict (it's what catches bad data at all), but that strictness
    // meant one bad row propagated all the way up through computeMatches()
    // and crashed the whole component tree, caught only by the app's
    // generic ErrorBoundary (a raw stack trace, no recovery, no results for
    // anyone). A single bad record should cost that one breed, not the
    // other 22 — skip it with a console.warn instead of failing the batch.
    try {
      scoreOneBreed(breed, a);
    } catch (err) {
      console.warn(`[RIGHTBREED] Skipping "${breed?.name ?? 'unknown breed'}" — ${err.message}`);
      continue;
    }
  }
  /* Label tier first, then score. A breed capped at "Fair" by a severe issue
     (SPACE, SAFETY, a gate <= 0.55) must never rank above an "Excellent" or
     "Good" one just because its raw number is higher. */
  return scored.sort((x, y) =>
    (labelRank(x.label) - labelRank(y.label))
    || (y.finalScore - x.finalScore) || (x.flags.length - y.flags.length) || x.name.localeCompare(y.name));

  /** Everything that used to be the loop body, factored out so it can be
      wrapped in the try/catch above without duplicating the whole thing. */
  function scoreOneBreed(breed, a) {
    const nb = normaliseBreed(breed);

    /* --- Step 1: base, max 100 --- */
    const budget = scoreBudget(a.budgetCeiling, nb.costMid);
    const factors = {
      purpose:  scorePurpose(a.purposes, breed.purpose || ''),
      activity: scoreActivity(a.activities, nb.energyBand),
      home:     scoreHome(a, nb),
      budget:   budget.points,
      hair:     scoreHair(a.hairPrefs, nb.hairBand),
      india:    scoreIndia(nb.indiaScore),
    };
    const rawBase = Object.values(factors).reduce((s, n) => s + n, 0);
    const base = Math.round((rawBase * 100 / BASE_MAX) * 10) / 10; // rescaled to 100

    /* --- Step 2: gates --- */
    const g1 = climateGate(nb.heatClass, a.zone);
    const g2 = familyGate(a.hasVulnerable, nb.riskTier);
    const g3 = experienceGate(a.experienceAnswer, nb.experience);
    const g4 = floorGate(nb.floorClass, a.floorAnswer);
    const g5 = trainGate(nb.trainClass, a.trainAnswer);
    const g6 = scheduleGate(nb.aloneClass, a.scheduleAnswer);
    const g7 = strengthGate(a.hasSeniors, nb);
    const g8 = spaceGate(a, breed);

    const flags = [];
    if (g1 <= heatCfg.heatFlagThreshold) flags.push('HEAT');
    // Was ≤0.4, which only ever catches the HIGH tier — Rottweiler alone.
    // MEDIUM_HIGH (0.58, e.g. Rajapalayam: "not recommended for families
    // with small children without...") never crossed it, so a breed the
    // database itself calls unsuitable for young children could reach a
    // kids-present household with no SAFETY flag at all. Plain MEDIUM
    // (0.75, e.g. Mudhol Hound) still doesn't flag — that boundary is
    // deliberate, not an oversight: 0.75 is a real but genuinely milder
    // reduction, and flagging it too would make SAFETY fire so often it
    // stops meaning anything. MEDIUM_HIGH is the one that was wrongly on
    // the safe side of the line.
    /* Kids at home: flag from MEDIUM (0.75) down. Mudhol Hound's own DB text
       says "not ideal for families with very young children", yet at 0.75
       it reached kids households as "Good Match" with no warning. Young
       children carry the highest bite risk, so the stricter line applies
       only when kids are present; seniors-only keeps the 0.6 line. */
    if (g2 <= (a.hasKids ? 0.75 : 0.6)) flags.push('SAFETY');
    if (g7 < 1) flags.push('STRENGTH');
    if (g4 <= floorCfg.floorFlagThreshold) flags.push('FLOORING');
    if (g3 < 1) flags.push('EXPERIENCE');
    if (g5 < 1) flags.push('TRAINING'); // mirrors G3's own "any bite flags" rule, on instruction to keep full strength
    if (hasSpaceGap(a, nb)) flags.push('SPACE');
    if (budget.flag) flags.push(budget.flag);
    if (g6 < 1) flags.push('SCHEDULE');
    flags.sort((x, y) => FLAG_SEVERITY.indexOf(x) - FLAG_SEVERITY.indexOf(y));

    /* --- Step 3: final --- */
    const finalScore = Math.round(base * g1 * g2 * g3 * g4 * g5 * g6 * g7 * g8);
    const worstGate = Math.min(g1, g2, g3, g4, g5, g6, g7, g8);
    /* A severe issue caps the label at Fair — this used to check worstGate
       alone, which only covers the six multiplicative GATES. Home fit is a
       BASE factor, not a gate, so a "House only" breed with 0/15 home points
       in a flat never tripped this: worstGate stayed 1.0 (every gate was
       fine) even though the breed was carrying the SPACE flag and had lost
       15 real points. Confirmed with a real run — Mudhol Hound and
       Rajapalayam, both 0/15 home fit with SPACE flagged, both still read
       "Excellent Match" in a 2BHK. Now any SPACE flag caps the label the
       same way a severe gate does, not just gate severity. */
    // Explicitly checks SAFETY too, not just the worstGate<=0.55 threshold —
    // MEDIUM_HIGH's 0.58 gate is real enough to flag (see the SAFETY
    // threshold change above) but doesn't cross 0.55 on its own, so without
    // this a flagged breed could still show "Good"/"Excellent". Same
    // reasoning as the SPACE check below it.
    const severeIssue = worstGate <= 0.55 || flags.includes('SPACE') || flags.includes('SAFETY');
    const label = severeIssue
      ? (finalScore >= 50 ? FAIR_LABEL : labelFor(finalScore))
      : labelFor(finalScore);

    scored.push({
      ...breed,
      base,
      factors,
      gates: { climate: g1, family: g2, experience: g3, flooring: g4, training: g5, schedule: g6, strength: g7, space: g8 },
      heatClass: nb.heatClass,
      flags,
      // kept: existing result UI reads .warnings
      warnings: flags.map((f) => {
        if (f === 'EXPERIENCE') return experienceWarning(nb.experience, a.experienceAnswer);
        if (f === 'SPACE') return spaceWarning(a, breed);
        return FLAG_TEXT[f];
      }),
      climateWarning: flags.includes('HEAT'),
      // Universal welfare disclaimer — independent of breed/gate, shown on
      // EVERY result when the user is away 8+ hrs, per RSPCA/PDSA/Dogs Trust/
      // Blue Cross convergence. Not a flag: it says nothing about THIS breed.
      showsScheduleDisclaimer: a.showsScheduleDisclaimer,
      showsPgDisclaimer: a.showsPgDisclaimer,
      showsHomeUnsureDisclaimer: a.showsHomeUnsureDisclaimer,
      finalScore,
      label,
      // `score` is deliberately NOT set here anymore. It used to be
      // overwritten with finalScore, silently replacing the breed's own
      // 1–5 India-suitability rating (`...breed` above already carries the
      // real one). generateProsCons() calls normaliseBreed() internally,
      // which validates score is 1–5 and throws otherwise — so every
      // recommended breed's Full Profile crashed, confirmed for all 5
      // Hyderabad top-5 breeds. matchPercentage below is the field every
      // UI component already reads for the displayed number; nothing in
      // the frontend reads `.score` expecting a match percentage — checked.
      matchPercentage: finalScore,
    });
  }
}


/** Banner rule: if even the best match is under 65, say so and show why. */
export function noExcellentMatch(results) {
  if (!results?.length) return null;
  const top = results[0];
  // Checks the LABEL, not the raw score — a breed can score 82 numerically
  // and still be labelled "Fair" because of a severe issue like the SPACE
  // flag (see the severeIssue logic above). Checking finalScore alone would
  // have missed exactly that case: a high raw number with a real problem
  // underneath it is precisely when this banner should fire.
  if (top.label.startsWith('Excellent') || top.label.startsWith('Good')) return null;
  const triggered = [...new Set(results.slice(0, 5).flatMap((r) => r.flags))]
    .sort((x, y) => FLAG_SEVERITY.indexOf(x) - FLAG_SEVERITY.indexOf(y));
  return {
    headline: "No excellent matches for this combination — here's why",
    flags: triggered,
    reasons: triggered.map((f) => FLAG_TEXT[f]),
  };
}

export const flagLabel = (flag) => FLAG_TEXT[flag] || flag;

/* ========================== RESULT COPY ================================== */
/* Presentation only — never changes ranking. Prompt 5 rewires these to read
   the score object directly. */

/** Legacy climate-band tag, still used for the Living Conditions copy. */
export function climateTag(s = '') {
  const t = String(s).toUpperCase();
  if (t.startsWith('COLD–MEDIUM') || t.startsWith('COLD-MEDIUM')) return 'COLD-MEDIUM';
  if (t.startsWith('MEDIUM–HOT') || t.startsWith('MEDIUM-HOT')) return 'MEDIUM-HOT';
  if (t.startsWith('COLD')) return 'COLD';
  if (t.startsWith('HOT')) return 'HOT';
  if (t.startsWith('MEDIUM')) return 'MEDIUM';
  return 'MEDIUM';
}
const riskTag = (s = '') => headToken(s);

/* `answers` is optional. With it, the space line is stated RELATIVE to the home
   they gave; without it (a generic breed profile, no quiz taken) the line stays
   absolute, which is still true of the breed. What it must never do again is
   claim a 2BHK-min breed as a plus to someone who told us they live in a
   1BHK — that is the sentence that contradicted the Full Profile. */
/** Returns FOUR buckets, not two — "matched" items are tied to an actual
    scored factor or gate for THIS user's answers (so they can never show
    something that didn't affect the score); "general" items are true breed
    facts shown for context, not personalization. The old version put
    everything under "Pros/Cons for you," which is what let "Cons for you"
    show real breed facts (shedding, health, cost) alongside genuinely
    answer-driven ones — impossible to tell which of the four "cons" was
    the reason a "top match" still had four red items against it. */
export function generateProsCons(breed, answers = null) {
  const matchedPros = [], matchedCons = [];
  const generalPros = [], generalCons = [];

  /* --- Matched: home fit — reuses the real scoreHome/hasSpaceGap logic. --- */
  if (answers) {
    const a = normaliseAnswers(answers);
    const nb = normaliseBreed(breed);

    if (hasSpaceGap(a, nb)) {
      matchedCons.push(spaceWarning(a, breed));
    } else if (scoreHome(a, nb) === 15) {
      if (a.isHouse) {
        if (nb.houseNeedBand >= 1.5) matchedPros.push('Well suited to your house — this breed genuinely benefits from the space.');
      } else if (breed.minApartmentSize === '1BHK OK') {
        matchedPros.push('Comfortable even in a 1BHK apartment.');
      } else if (breed.minApartmentSize === '2BHK min') {
        matchedPros.push('Well suited to a typical 2BHK apartment.');
      }
    }

    /* --- Matched: experience — tied to the real G3 gate. --- */
    // Was unconditionally "Easy to train and handle" off experienceLevel
    // alone — experienceLevel measures overall handling difficulty
    // (temperament, energy, grooming load), not obedience-training speed,
    // which is what trainClass (Coren-based) actually measures. Confirmed:
    // Pug, Shih Tzu and French Bulldog are all genuinely "First-timer OK"
    // (gentle, manageable) but genuinely HARD on the real trainability
    // classification — this claimed "easy to train" for all three when the
    // engine's own data says the opposite. Only claims trainability when
    // trainClass actually backs it.
    if (a.isFirstTimer && nb.experience === 'BEGINNER_FRIENDLY') {
      matchedPros.push(nb.trainClass === 'EASY'
        ? 'Easy to train and handle for a first-time owner like you.'
        : 'Gentle and manageable for a first-time owner like you, even though it can be slow or stubborn to formally train.');
    }
    if (a.isFirstTimer && nb.experience === 'DEMANDING') matchedCons.push('Not recommended for first-time owners — this breed needs real handling experience.');
    if (a.experienceAnswer === 'some' && nb.experience === 'DEMANDING') matchedCons.push('Needs an experienced handler — general past experience with dogs may not be enough.');
    /* Tied to G7 — only when seniors live at home. */
    if (strengthGate(a.hasSeniors, nb) < 1) matchedCons.push('Large, strong dog — pulling and jumping raise the fall risk for elderly family members.');

    /* --- Matched: budget — reuses the real scoreBudget comparison against
       the user's actual ceiling, not a fixed absolute number. The old
       version flagged "High monthly maintenance cost" for any breed whose
       minimum cost cleared ₹12,000, regardless of what the user said they
       could spend — confirmed with a real run: it still fired for a user
       who selected "Above ₹20,000." Fixed to check against their answer. */
    const budget = scoreBudget(a.budgetCeiling, nb.costMid);
    if (budget.points === 15) matchedPros.push('Comfortably within your stated budget.');
    else if (budget.flag) matchedCons.push(nb.costMid > a.budgetCeiling * 1.2
      ? 'Meaningfully above your stated monthly budget.'
      : 'A stretch above your stated monthly budget.');
  } else {
    // No answers context — nothing to match against, so this bucket stays empty
    // and the abstract facts below carry the whole profile, same as before.
  }

  /* --- General: true regardless of the user's answers. --- */
  // headToken(), not the raw field — breed.grooming is a full sentence
  // ("High – daily brushing required..."), and .includes() against the
  // whole string never matched anything. Confirmed: Shih Tzu and Poodle
  // (Standard), both genuinely High/Very High grooming, showed no grooming
  // warning anywhere, because this check has never actually fired for any
  // breed since it was written.
  const groomTier = headToken(breed.grooming);
  if (['Low', 'Low–Medium'].includes(groomTier)) generalPros.push('Low grooming and maintenance needs.');
  if ((breed.energy || '').startsWith('Low')) generalPros.push('Low exercise needs — workable for busy schedules.');
  if ((breed.risk || '').startsWith('Low')) generalPros.push('Gentle, low-aggression temperament.');
  if (['Very Low', 'Low'].includes(breed.shedding)) generalPros.push('Minimal shedding keeps the home cleaner.');
  if (breed.monthlyCostMax <= 8000) generalPros.push('Affordable to feed and maintain in India.');
  if ((breed.purpose || '').includes('Guard')) generalPros.push('Strong natural guarding instincts.');
  if (!answers && breed.experienceLevel === 'First-timer OK') {
    generalPros.push(trainCfg.breeds[breed.name] === 'EASY'
      ? 'Easy to train and handle for first-time owners.'
      : 'Gentle and manageable for first-time owners, even though it can be slow or stubborn to formally train.');
  }

  if (['High', 'Very High'].includes(groomTier)) generalCons.push('Frequent brushing and professional grooming required.');
  if ((breed.energy || '').toLowerCase().startsWith('very high')) generalCons.push('Needs heavy daily exercise or becomes destructive.');
  if (['High', 'Very High'].includes(breed.shedding)) generalCons.push('Heavy shedder — expect frequent vacuuming.');
  // Was >=3 commas, which 22 of 23 breeds cleared — citation sources
  // appended in parentheses add commas unrelated to how many real
  // conditions are listed, so this told the user nothing. Checked the
  // actual distribution: commas range from 1 (Pariah, Mudhol) up to 6
  // (Pug, Shih Tzu, Boxer, Great Dane, French Bulldog, Saint Bernard) —
  // >=6 actually separates the brachycephalic and giant breeds with
  // genuinely heavier documented health burdens from everyone else,
  // instead of catching almost the whole catalogue.
  if ((breed.health || '').split(',').length >= 6) generalCons.push('Prone to several health issues needing regular vet care.');
  if (!answers) {
    if (breed.experienceLevel === 'Experienced only') generalCons.push('Not recommended for first-time owners.');
    if (breed.monthlyCostMin >= 12000) generalCons.push('High monthly maintenance cost.');
    if (breed.minApartmentSize === '1BHK OK') generalPros.push('Comfortable even in a 1BHK apartment.');
    else if (breed.minApartmentSize === '2BHK min') generalPros.push('Well suited to a typical 2BHK apartment.');
    else if (breed.minApartmentSize === '3BHK min') generalCons.push('Best in a 3BHK or larger; workable in a smaller flat with committed daily walks.');
    else if (breed.minApartmentSize === 'House only') generalCons.push('Needs an independent house — not suitable for an apartment.');
  }

  if (matchedPros.length === 0 && generalPros.length === 0) generalPros.push('Loyal and adaptable companion.');
  if (matchedCons.length === 0 && generalCons.length === 0) generalCons.push('Requires standard dog care and attention.');

  // Back-compat: old callers reading `.pros`/`.cons` still get a sensible
  // combined list (matched first, since it's the stronger signal) so nothing
  // breaks before every consumer is updated to the four-bucket shape.
  return {
    matchedPros, matchedCons, generalPros, generalCons,
    pros: [...matchedPros, ...generalPros],
    cons: [...matchedCons, ...generalCons],
  };
}

export function buildLivingConditions(b) {
  const items = [];

  const spaceCopy = {
    '1BHK OK':    'Comfortable in a 1BHK apartment. Daily walks matter more than floor area.',
    '2BHK min':   'Needs at least a 2BHK apartment to move comfortably indoors.',
    '3BHK min':   'Best in a 3BHK or larger. Workable in a smaller flat only with a committed daily walking routine.',
    'House only': 'Needs an independent house. A 1BHK compromises this breed’s wellbeing.',
  };
  items.push({ label: 'Space', text: spaceCopy[b.minApartmentSize] || 'Adapts to most homes with adequate daily outdoor time.' });

  // Was keyed by climateTag(b.climate) — a raw, older 5-tier text field
  // (HOT/MEDIUM-HOT/MEDIUM/COLD-MEDIUM/COLD) completely disconnected from
  // heatCfg.breeds, which is what G1 actually scores against. Confirmed
  // concretely: Pug's raw climate field said "MEDIUM CLIMATE", mapping to
  // "Manages summer with shade and water" — while its real scoring class
  // is BRACHYCEPHALIC, worth 0.30 (a severe penalty) in a hot-humid city.
  // Pomeranian and French Bulldog both mapped to "Suited to Shimla..." off
  // a raw "COLD CLIMATE" tag, despite scoring HEAT_SENSITIVE and
  // BRACHYCEPHALIC respectively — neither is an arctic breed, and French
  // Bulldog's real problem (airway obstruction) has nothing to do with
  // needing a cold climate at all. Keyed to the real classes now.
  const climateCopy = {
    NATIVE_ADAPTED: 'Naturally well-adapted to Indian heat and humidity — thrives across hot and moderate cities alike with no special climate precautions.',
    HEAT_OK: 'Copes well with most Indian climates, including hot cities, with sensible care — shade, water, and avoiding peak-afternoon exercise.',
    HEAT_SENSITIVE: 'Genuinely struggles with Indian heat and humidity — needs consistent shade, air conditioning through peak summer, and exercise limited to early morning or evening in hot cities.',
    BRACHYCEPHALIC: 'Flat-faced and at real risk of heatstroke in Indian summers — needs full-time air conditioning in hot cities and should never be exercised in daytime heat. A genuine, documented health risk, not just a comfort preference.',
    ARCTIC_HEAVY_COAT: 'Bred for cold climates with a heavy double coat — struggles seriously with Indian heat outside genuinely cool hill-station cities (Shimla, Dehradun, Darjeeling, Srinagar), even with air conditioning.',
  };
  items.push({ label: 'Climate', text: climateCopy[heatCfg.breeds[b.name]] || 'Adaptable to most Indian climates with seasonal care.' });

  items.push({ label: 'Daily Exercise', text: `Around ${b.time} of walks, play and mental stimulation each day.` });

  // Same headToken() fix as generalPros/generalCons above, plus the
  // 'Low-Medium' key used a plain hyphen while the data uses an en-dash —
  // two separate reasons this always fell through to the generic fallback,
  // for every one of the 23 breeds.
  const groomCopy = {
    Low: 'Low maintenance. Occasional brushing and baths.',
    'Low–Medium': 'Regular brushing keeps the coat healthy.',
    Medium: 'Regular brushing plus occasional professional grooming.',
    'Medium–High': 'Frequent brushing and regular professional grooming.',
    High: 'Professional grooming every 4–6 weeks to prevent matting.',
    'Very High': 'Daily brushing and frequent professional grooming.',
  };
  items.push({ label: 'Grooming', text: groomCopy[headToken(b.grooming)] || 'Standard grooming routine.' });

  items.push({ label: 'Nutrition', text: `${b.nutrition}. Keep fresh water available and portion by weight to prevent obesity.` });

  items.push({
    label: 'Cost in India',
    text: `Puppy: ${b.puppyPrice} one-time. Upkeep: ₹${b.monthlyCostMin.toLocaleString('en-IN')}–₹${b.monthlyCostMax.toLocaleString('en-IN')} per month.`,
  });

  // Was a 3-branch heuristic using b.risk and b.purpose as proxies for
  // social behaviour — closest approximation available at the time, but
  // directly contradicted the real alone-tolerance classification for three
  // breeds. Indie Dog and Indian Spitz both have risk=Low (which
  // mapped to the "prone to separation anxiety" text) while being classified
  // INDEPENDENT in the alone-tolerance gate — the exact contradiction the
  // review flagged. Lhasa Apso hit the same conflict. Now reads from the
  // actual aloneClass that the engine already computes: INDEPENDENT/
  // AVERAGE/NEEDS_COMPANY are exactly the right distinctions to make here.
  const aloneClass = aloneCfg.breeds[b.name];
  let social;
  if ((b.purpose || '').includes('Guard') && aloneClass !== 'NEEDS_COMPANY') {
    social = 'Protective by instinct. Needs consistent early socialisation to tell a guest from a threat.';
  } else if (aloneClass === 'INDEPENDENT') {
    social = 'Naturally independent and generally manages time alone better than most. Still benefits from daily interaction, but doesn\'t typically fixate on their owners\' absence.';
  } else if (aloneClass === 'NEEDS_COMPANY') {
    social = 'A companion-oriented breed that does not do well when left alone for long stretches. Socialise early and plan for real company or enrichment if nobody is home during the day.';
  } else {
    social = 'Adaptable to the household\'s routine. Socialise early, between 3 and 14 weeks, and build up time alone gradually rather than leaving a young dog alone all at once.';
  }
  items.push({ label: 'Social Environment', text: social });

  return items;
}

/* ==================== PERSONALISED RESULT COPY =========================== */

const ANSWER_PHRASES = {
  home: {
    'apt-1bhk': '1BHK apartment', 'apt-2bhk': '2BHK apartment',
    'apt-3bhk': 'spacious 3BHK/4BHK apartment',
    'house-no-yard': 'independent house', 'house-yard': 'house with a yard',
  },
  activity: {
    relaxed: 'relaxed lifestyle', moderate: 'moderately active lifestyle',
    high: 'highly active lifestyle',
  },
  family: {
    kids: 'young children at home', seniors: 'senior family members at home',
    both: 'children and seniors at home', adults: 'adults-only household',
  },
  experience: {
    none: 'first dog', some: 'past experience with dogs',
    experienced: 'experience handling dogs',
  },
  budget: {
    under5k: 'under ₹5,000/month care budget', '5k-10k': '₹5,000–10,000/month care budget',
    '10k-20k': '₹10,000–20,000/month care budget', above20k: 'premium care budget',
  },
};

const firstAnswer = (answers, id, d) => {
  const v = answers?.[id];
  return (Array.isArray(v) ? v[0] : v) || d;
};

const PURPOSE_GOAL = {
  family: 'a family companion',
  guard: 'a home guardian',
  active: 'an exercise & adventure partner',
  therapy: 'emotional support & comfort',
  seniors: 'a calm companion for a quiet home',
};

/** A specific, answer-driven justification that never contradicts the user's
    inputs. Leads with the purpose match (when the breed actually fits it),
    then their home + lifestyle, then one genuine supporting trait. */
export function generatePersonalizedReason(breed, answers) {
  if (!breed) return '';
  if (!answers || !Object.keys(answers).length) {
    return `The ${breed.name} is a well-rounded companion for most Indian homes.`;
  }

  const home = firstAnswer(answers, 'home', 'apt-2bhk');
  const activity = firstAnswer(answers, 'activity', 'moderate');
  const family = firstAnswer(answers, 'family', 'adults');
  const experience = firstAnswer(answers, 'experience', 'none');
  const zone = cityZone(firstAnswer(answers, 'city', 'hot')); // same default as normaliseAnswers
  const purposes = toArray(answers.purpose);

  const homePhrase = ANSWER_PHRASES.home[home] || 'home';
  const activityPhrase = ANSWER_PHRASES.activity[activity] || 'lifestyle';

  // Pick whichever selected purpose scores HIGHEST for this breed — the same
  // selection scorePurpose() itself uses. The previous version used .find(),
  // which returns the first array match regardless of score: a breed whose
  // best purpose match was a 10-point secondary "guard" hit would show
  // "you wanted a home guardian" even when a later-listed purpose in the same
  // answer scored the same or higher, purely because of array position — not
  // because guard was actually the stronger or intended match. Confirmed via
  // a real repro: Indie Dog and Indian Spitz labelled "home guardian"
  // off a 10-point secondary match while Dachshund, right below them with an
  // equal 10-point match, correctly labelled "emotional support & comfort" —
  // same input, different label, purely from array order.
  const bp = breed.purpose || '';
  const real = purposes.filter((p) => p !== 'breed');
  let matchedPurpose = null;
  let bestPurposeScore = 0;
  for (const p of real) {
    const cfg = PURPOSE[p];
    if (!cfg) continue;
    const s = cfg.primary.some((k) => bp.includes(k)) ? 20
            : cfg.secondary.some((k) => bp.includes(k)) ? 10
            : 0;
    if (s > bestPurposeScore) { bestPurposeScore = s; matchedPurpose = p; }
  }
  const goal = matchedPurpose && PURPOSE_GOAL[matchedPurpose];

  /* Never claim the home is a good fit when the breed actually needs more room
     than the owner told us they have — that reads as a direct contradiction of
     the space-gap warning shown right beside this copy. In that case the lead
     drops the home reference and leans on lifestyle/purpose only, which stays
     honest without turning the positive summary into a caveat. */
  const isApt = String(home).startsWith('apt-');
  const homeRank = HOME_APT_RANK[home];
  const needRank = MIN_APT_RANK[String(breed.minApartmentSize || '').trim()];
  const tooBig = isApt && homeRank != null && needRank != null && needRank > homeRank;
  const fitPhrase = tooBig ? activityPhrase : `${homePhrase} and ${activityPhrase}`;

  /* Now checks breed.label before deciding how to talk about the match —
     the old version always said "fits — a good match" regardless of the
     engine's own verdict. Confirmed: a breed the engine itself labelled
     "Not recommended" (e.g. 40%) still got that exact sentence. The label
     is already computed by the time this runs (this function is only
     reached once `answers` is present, which means we're in a scored
     quiz-result context, not a bare breed-directory listing). */
  const label = breed.label || '';
  const isPoor = label.startsWith('Not recommended');
  const isFair = label.startsWith('Fair');

  // Build a contextual "big plus" that changes per profile — not the same
  // climate line for every breed. Picks the single most relevant positive
  // signal that's specific to THIS user's answers, in priority order.
  const budget = firstAnswer(answers, 'budget', '5k-10k');
  const schedule = firstAnswer(answers, 'schedule', 'home');
  const nb = (() => { try { return normaliseBreed(breed); } catch { return null; } })();
  const heatClass = nb?.heatClass;

  let contextBonus = null;

  // 1. If alone a long time and breed is INDEPENDENT — call that out
  if ((schedule === '8h-plus' || schedule === '4-8h') && nb?.aloneClass === 'INDEPENDENT') {
    contextBonus = 'handles time alone better than most breeds';
  }
  // 2. If toddler at home and breed is genuinely low-risk — reassure
  else if ((family === 'young-kids') && nb?.riskTier === 'LOW') {
    contextBonus = 'has a gentle, low-aggression temperament — good around young children';
  }
  // 3. If budget is tight and breed is affordable — name it
  else if ((budget === 'under5k' || budget === '5k-10k') && breed.monthlyCostMax <= 8000) {
    contextBonus = `monthly costs (₹${breed.monthlyCostMin?.toLocaleString('en-IN')}–₹${breed.monthlyCostMax?.toLocaleString('en-IN')}) fit comfortably within your budget`;
  }
  // 4. Climate compatibility when it's a genuine positive (not just neutral)
  else if (heatClass === 'NATIVE_ADAPTED' && (zone === 'HOT_HUMID' || zone === 'HOT_DRY' || zone === 'HOT_SEMIARID')) {
    contextBonus = 'naturally adapted to Indian heat — no special climate precautions needed';
  }
  else if (heatClass === 'HEAT_OK' && zone === 'MODERATE') {
    contextBonus = 'coat handles your moderate climate comfortably';
  }
  // 5. First-timer + beginner-friendly — lead with confidence not just fit
  else if (experience === 'none' && nb?.experience === 'BEGINNER_FRIENDLY') {
    contextBonus = 'forgiving for first-time owners — won\'t punish small handling mistakes';
  }

  let lead;
  if (isPoor) {
    const topWarning = (breed.warnings && breed.warnings[0]) || 'several real mismatches with what you told us';
    lead = `The ${breed.name} isn't a strong match here — ${topWarning.charAt(0).toLowerCase()}${topWarning.slice(1)}.`;
  } else if (isFair) {
    lead = goal
      ? `You wanted ${goal}, and the ${breed.name} is a possible fit for your ${fitPhrase} — but check the warnings below before deciding.`
      : `The ${breed.name} could work for your ${fitPhrase}, though there are real trade-offs worth checking first.`;
  } else {
    lead = goal
      ? `You wanted ${goal}, and the ${breed.name} fits — a good match for your ${fitPhrase}.`
      : `For your ${fitPhrase}, the ${breed.name} is a strong lifestyle match.`;
  }

  // Fallback supporting traits if contextBonus wasn't set above.
  const rT = riskTag(breed.risk);
  const energy = (breed.energy || '').toLowerCase();
  const supports = [];
  if (heatClass && climateGate(heatClass, zone) >= 0.95 && !contextBonus)
    supports.push(`its coat handles your ${zoneLabel(zone)} comfortably`);
  if ((family === 'young-kids' || family === 'older-kids' || family === 'kids' || family === 'both') && rT === 'Low')
    supports.push('it is famously gentle with children');
  else if (family === 'seniors' && rT === 'Low')
    supports.push('it stays calm and easy around seniors');
  else if (family === 'adults' && (energy.startsWith('low') || rT === 'Low'))
    supports.push('its easygoing temperament suits an adults-only home');
  if (experience === 'none' && breed.experienceLevel === 'First-timer OK')
    supports.push('it forgives first-time-owner mistakes');

  // contextBonus (computed above) takes priority over the generic supports[]
  // list — it's picked specifically for this user's answer combination, not
  // just the first trait that happens to be true about the breed. Falls back
  // to the first supports[] entry if contextBonus wasn't set. Neither fires
  // for a poor match — "Not recommended" + cheerful upside is a contradiction.
  const bonus = contextBonus || (supports.length ? supports[0] : null);
  return (bonus && !isPoor) ? `${lead} A big plus: ${bonus}.` : lead;
}

/** Short pro/con chips tied to the user's own answers (Results page). */
export function generateMatchReasons(breed, answers) {
  if (!breed || !answers) return { pros: [], cons: [] };

  const home = firstAnswer(answers, 'home', 'apt-2bhk');
  const experience = firstAnswer(answers, 'experience', 'none');
  const budget = firstAnswer(answers, 'budget', '5k-10k');
  const family = firstAnswer(answers, 'family', 'adults');
  const zone = cityZone(firstAnswer(answers, 'city', 'hot')); // same default as normaliseAnswers

  const pros = [];
  const cons = [];

  /* "Apartment Friendly" has to mean friendly to THEIR apartment. It used to
     fire for any 1BHK-OK or 2BHK-min breed regardless of the home answered,
     so a 2BHK-min breed was tagged apartment-friendly for a 1BHK owner — the
     same record the Full Profile describes as "needs at least a 2BHK". Now the
     breed's requirement is compared against the home they actually gave. */
  const isApt = String(home).startsWith('apt-');
  const homeRank = HOME_APT_RANK[home];
  const needRank = MIN_APT_RANK[String(breed.minApartmentSize || '').trim()];
  const fitsHome = isApt && homeRank != null && needRank != null && needRank <= homeRank;
  const tooBig = isApt && homeRank != null && needRank != null && needRank > homeRank;

  if (fitsHome) pros.push('Apartment Friendly');
  if (tooBig) {
    cons.push(breed.minApartmentSize === 'House only'
      ? 'Requires More Space'
      : `Needs a ${String(breed.minApartmentSize).replace(/\s*min$/i, '')} or larger`);
  }
  if (home === 'house-yard' && (breed.house || '').startsWith('High')) pros.push('Loves Having a Yard');
  if (home === 'house-no-yard' && (breed.house || '').startsWith('High')) cons.push('Needs a Yard or Large Open Space');

  // 'some' now has its own mild gate (see SOME_EXPERIENCE_GATE), so the chip follows it.
  if (experience === 'none' && breed.experienceLevel === 'First-timer OK') pros.push('Beginner Friendly');
  if (experience === 'none' && breed.experienceLevel === 'Experienced only') cons.push('Requires Experienced Owner');
  // 'some experience' was previously a blind spot — the gate now applies a
  // 0.85 penalty for "some" + Experienced-only, so the chip should match.
  if (experience === 'some' && breed.experienceLevel === 'Experienced only') cons.push('Better with an Experienced Owner');
  if (experience === 'some' && breed.experienceLevel === 'Experienced only') cons.push('Needs an Experienced Handler');

  // Was a flat binary — matches budget or doesn't, with no middle ground.
  // The real engine's own scoreBudget() has three tiers (full match, a
  // stretch up to 1.2x the ceiling, and beyond that), so a breed the
  // engine treats as "a real but modest stretch" showed the identical
  // "Higher Monthly Cost" tag as one wildly over budget — no differentiation.
  const ceiling = BUDGET_CEILING[budget] ?? 10000;
  const mid = (Number(breed.monthlyCostMin) + Number(breed.monthlyCostMax)) / 2;
  if (mid <= ceiling) pros.push('Matches Your Budget');
  else if (mid <= ceiling * 1.2) cons.push('Slight Stretch on Budget');
  else cons.push('Higher Monthly Cost');

  const rT = riskTag(breed.risk);
  if ((family === 'young-kids' || family === 'older-kids' || family === 'kids' || family === 'both') && rT === 'Low') pros.push('Good with Children');
  if (family === 'seniors' && rT === 'Low') pros.push('Good with Seniors');
  // Same lines as the engine's SAFETY flag: kids -> Medium and above; seniors only -> Medium–High and above.
  const hasKidsChip = family === 'young-kids' || family === 'older-kids' || family === 'kids' || family === 'both';
  if ((hasKidsChip && ['Medium', 'Medium–High', 'High'].includes(rT))
      || (family === 'seniors' && ['Medium–High', 'High'].includes(rT))) cons.push('Not Ideal for Vulnerable Family Members');
  if ((family === 'seniors' || family === 'both')) {
    const sr = SIZE_RANK[sizeToken(breed.size)];
    const eb = ENERGY_BAND[headToken(breed.energy)];
    if (sr != null && eb != null && (sr >= 3 || (sr >= 2 && eb >= 2))) cons.push('Strong Puller — Fall Risk for Seniors');
  }

  const heatClass = heatCfg.breeds[breed.name];
  if (heatClass) {
    const g1 = climateGate(heatClass, zone);
    if (g1 >= 0.95) pros.push('Climate Suitable');
    if (g1 <= heatCfg.heatFlagThreshold) cons.push('Struggles in Your Climate');
  }

  const flooring = firstAnswer(answers, 'flooring', null);
  const floorClass = floorCfg.breeds[breed.name];
  if (flooring && floorClass) {
    const g4 = floorGate(floorClass, FLOORING_ANSWER[flooring]);
    if (floorClass === 'LOW') pros.push('No Flooring-Related Joint Risk');
    if (g4 <= floorCfg.floorFlagThreshold) cons.push('Joint/Spine Risk on Your Flooring');
  }

  const trainingEffort = firstAnswer(answers, 'trainingEffort', null);
  const trainClass = trainCfg.breeds[breed.name];
  if (trainingEffort && trainClass) {
    const g5 = trainGate(trainClass, TRAINING_EFFORT_ANSWER[trainingEffort]);
    if (trainClass === 'EASY') pros.push('Easy to Train');
    if (g5 < 1) cons.push('Needs More Training Effort Than You Committed');
  }

  return { pros, cons };
}
