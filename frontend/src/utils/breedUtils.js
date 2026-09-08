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

import cityZonesCfg from '../config/cityZones.json';
import heatCfg from '../config/breedHeatClasses.json';
import {
  headToken,
  ENERGY_BAND, SHED_BAND, RISK_TIER, HAIR_VALUES, APT_FRIENDLY, MIN_APT_RANK, EXPERIENCE_LEVELS,
  ACTIVITY_BAND, SHED_PREF_BAND, HAIR_PREF, HOME_APT_RANK, HOME_IS_HOUSE,
  BUDGET_CEILING, FAMILY_HAS_VULNERABLE, EXPERIENCE_ANSWERS, PURPOSE, EXPERIENCE_GATE,
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

export function cityZone(answer) {
  if (typeof answer !== 'string' || !answer.trim()) fail(`Missing city answer: ${JSON.stringify(answer)}`);
  const v = answer.trim();
  if (v.startsWith('zone:')) {
    const z = v.slice(5);
    if (!cityZonesCfg.zones.includes(z)) fail(`Unknown zone literal: ${JSON.stringify(v)}`);
    return z;
  }
  if (Object.prototype.hasOwnProperty.call(cityZonesCfg.cities, v)) return cityZonesCfg.cities[v];
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
    shedBand: mustMap(SHED_BAND, String(b.shedding ?? '').trim(), `shedding for ${where}`),
    riskTier: mustMap(RISK_TIER, headToken(b.risk), `family risk for ${where}`),
    hair: mustMap(HAIR_VALUES, String(b.hair ?? '').trim(), `hair length for ${where}`),
    aptFriendly: mustMap(APT_FRIENDLY, String(b.apt ?? '').trim(), `apartment-friendly for ${where}`),
    aptRank: mustMap(MIN_APT_RANK, String(b.minApartmentSize ?? '').trim(), `minApartmentSize for ${where}`),
    experience: resolveExperience(b, where),
    heatClass: mustMap(heatCfg.breeds, String(b.name ?? '').trim(), `heat class for ${where}`),
    indiaScore,
    costMid: (min + max) / 2,
  };
}

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
    return picked == null || picked === '' ? fallbackValue : picked;
  };

  const purposes = toArray(answers.purpose).length ? toArray(answers.purpose) : ['family'];
  const activities = toArray(answers.activity).length ? toArray(answers.activity) : ['moderate'];
  const hairPrefs = toArray(answers.hair).length ? toArray(answers.hair) : ['any'];
  const home = one('home', 'apt-2bhk');
  const budget = one('budget', '5k-10k');
  const family = one('family', 'adults');
  const shedding = one('shedding', 'moderate');
  const experience = one('experience', 'none');

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
    zone: cityZone(one('city', 'moderate')),
    budgetCeiling: mustMap(BUDGET_CEILING, budget, 'budget answer'),
    hasVulnerable: mustMap(FAMILY_HAS_VULNERABLE, family, 'family answer'),
    isFirstTimer: mustMap(EXPERIENCE_ANSWERS, experience, 'experience answer'),
    raw: { home, budget, family, shedding, experience },
    shedPrefBand: mustMap(SHED_PREF_BAND, shedding, 'shedding answer'),
  };
}

/* ==================== STEP 1 — BASE SCORECARD (max 100) =================== */
/* B1 20 · B2 20 · B3 15 · B4 15 · B5 10 · B6 5 · B7 15  = 100              */

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

/** B2 Activity (20): exact energy band 20, one step off 10, two off 0. */
const scoreActivity = (activities, energyBand) =>
  best(activities, (a) => {
    const d = Math.abs(ACTIVITY_BAND[a] - energyBand);
    return d === 0 ? 20 : d === 1 ? 10 : 0;
  });

/** B3 Home fit (15): house = 15 flat. Apartment = YES 15 / CONDITIONAL 5 / NO 0.
    V4 has no CONDITIONAL column, so it is derived: an apartment-friendly breed
    that needs a BIGGER flat than the user has is CONDITIONAL, not a flat no. */
const scoreHome = (a, nb) => {
  if (a.isHouse) return 15;
  if (!nb.aptFriendly || nb.aptRank === 4) return 0;
  return nb.aptRank <= a.aptRank ? 15 : 5;
};

/** B4 Budget (15): compares the cost MIDPOINT, never the minimum. */
const scoreBudget = (ceiling, costMid) => {
  if (costMid <= ceiling) return { points: 15, flag: null };
  if (costMid <= ceiling * 1.2) return { points: 8, flag: 'BUDGET' };
  return { points: 0, flag: 'BUDGET' };
};

/** B5 Shedding (10): exact band 10, one step 5, two 0. */
const scoreShedding = (prefBand, shedBand) => {
  const d = Math.abs(prefBand - shedBand);
  return d === 0 ? 10 : d === 1 ? 5 : 0;
};

/** B6 Hair (5): a match, or "no preference", scores full. */
const scoreHair = (hairPrefs, breedHair) =>
  best(hairPrefs, (h) => (HAIR_PREF[h] === 'ANY' || HAIR_PREF[h] === breedHair ? 5 : 0));

/** B7 India suitability (15): the DB's own 1–5 score, x3. */
const scoreIndia = (indiaScore) => indiaScore * 3;

/* ======================= STEP 2 — RISK GATES ============================== */

/** G1 climate: user zone x breed heat class. Table lives in editable config. */
export const climateGate = (heatClass, zone) =>
  mustMap(mustMap(heatCfg.classes, heatClass, 'heat class'), zone, `zone for heat class ${heatClass}`);

/** G2 family safety: only bites when children/elderly actually live at home. */
const FAMILY_GATE = { LOW: 1.0, MEDIUM: 0.75, HIGH: 0.4 };
const familyGate = (hasVulnerable, riskTier) => (hasVulnerable ? FAMILY_GATE[riskTier] : 1.0);

/** G3 experience: only bites for a first-time owner. Three tiers, because the
    V4 experienceLevel column has three real values — "Some experience" is a
    partial penalty (0.80), not the full "Experienced only" one (0.60). */
const experienceGate = (isFirstTimer, tier) => (isFirstTimer ? EXPERIENCE_GATE[tier] : 1.0);

const experienceWarning = (tier) =>
  (tier === 'DEMANDING'
    ? 'Needs an experienced owner — not a first dog'
    : 'Best with some prior dog experience');

/* THE ONLY HARD ELIMINATOR. A "House only" breed in a 1BHK is physics, not
   preference. Everything else scores low and stays visible with a flag. */
const isEliminated = (a, breed) => a.home === 'apt-1bhk' && breed.minApartmentSize === 'House only';

/* Does this breed need more indoor space than they actually have?

   The sentence above promises that a breed which survives elimination "stays
   visible WITH A FLAG", and for space there was no such flag — a 2BHK-min
   breed shown to a 1BHK owner scored lower (scoreHome gives 5 instead of 15)
   but said nothing, while the copy layer cheerfully called it "Apartment
   Friendly" and the Full Profile said "needs at least a 2BHK". Same record,
   two opposite claims, and the honest one was the one the owner had to go
   looking for.

   Only applies to apartment dwellers: `aptRank` is null for a house, and a
   house is not short of room. */
const hasSpaceGap = (a, nb) =>
  !a.isHouse && a.aptRank != null && nb.aptRank > a.aptRank;

/** "Needs at least a 2BHK — you told us 1BHK apartment." Specific on both
    sides, because "needs more space" alone leaves them guessing how much. */
const spaceWarning = (a, breed) => {
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

const FLAG_TEXT = {
  HEAT: 'Serious heat risk in your city',
  SAFETY: 'Risky around young children or elderly family',
  EXPERIENCE: 'Demanding for a first-time owner',
  //: Generic wording for `flagLabel`; the per-result warning is built by
  //  spaceWarning(), which names the actual sizes on both sides.
  SPACE: 'Needs more indoor space than your home has',
  BUDGET: 'Costs more per month than your budget',
};
/* Most severe first — Prompt 5 shows the single worst flag as a warning bullet.
   SPACE sits above BUDGET: a flat too small for the dog is a daily welfare
   problem, where an over-budget month is a number the owner can plan around. */
const FLAG_SEVERITY = ['HEAT', 'SAFETY', 'EXPERIENCE', 'SPACE', 'BUDGET'];

export function computeMatches(answers, allBreeds) {
  if (!answers || !Array.isArray(allBreeds)) return [];
  const a = normaliseAnswers(answers);

  const scored = [];
  for (const breed of allBreeds) {
    if (isEliminated(a, breed)) continue; // the only outright exclusion
    const nb = normaliseBreed(breed);

    /* --- Step 1: base, max 100 --- */
    const budget = scoreBudget(a.budgetCeiling, nb.costMid);
    const factors = {
      purpose:  scorePurpose(a.purposes, breed.purpose || ''),
      activity: scoreActivity(a.activities, nb.energyBand),
      home:     scoreHome(a, nb),
      budget:   budget.points,
      shedding: scoreShedding(a.shedPrefBand, nb.shedBand),
      hair:     scoreHair(a.hairPrefs, nb.hair),
      india:    scoreIndia(nb.indiaScore),
    };
    const base = Object.values(factors).reduce((s, n) => s + n, 0);

    /* --- Step 2: gates --- */
    const g1 = climateGate(nb.heatClass, a.zone);
    const g2 = familyGate(a.hasVulnerable, nb.riskTier);
    const g3 = experienceGate(a.isFirstTimer, nb.experience);

    const flags = [];
    if (g1 <= heatCfg.heatFlagThreshold) flags.push('HEAT');
    if (g2 <= 0.4) flags.push('SAFETY');
    if (g3 < 1) flags.push('EXPERIENCE');
    if (hasSpaceGap(a, nb)) flags.push('SPACE');
    if (budget.flag) flags.push(budget.flag);
    flags.sort((x, y) => FLAG_SEVERITY.indexOf(x) - FLAG_SEVERITY.indexOf(y));

    /* --- Step 3: final --- */
    const finalScore = Math.round(base * g1 * g2 * g3);
    const worstGate = Math.min(g1, g2, g3);
    const label = worstGate <= 0.55
      ? (finalScore >= 50 ? FAIR_LABEL : labelFor(finalScore)) // a severe gate caps the label at Fair
      : labelFor(finalScore);

    scored.push({
      ...breed,
      base,
      factors,
      gates: { climate: g1, family: g2, experience: g3 },
      heatClass: nb.heatClass,
      flags,
      // kept: existing result UI reads .warnings
      warnings: flags.map((f) => {
        if (f === 'EXPERIENCE') return experienceWarning(nb.experience);
        if (f === 'SPACE') return spaceWarning(a, breed);
        return FLAG_TEXT[f];
      }),
      climateWarning: flags.includes('HEAT'),
      finalScore,
      label,
      score: finalScore,
      matchPercentage: finalScore, // the final score IS the displayed percentage
    });
  }

  return scored.sort((x, y) => (y.finalScore - x.finalScore) || x.name.localeCompare(y.name));
}

/** Banner rule: if even the best match is under 65, say so and show why. */
export function noExcellentMatch(results) {
  if (!results?.length) return null;
  const top = results[0];
  if (top.finalScore >= 65) return null;
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
export function generateProsCons(breed, answers = null) {
  const pros = [];
  const cons = [];

  const home = answers ? firstAnswer(answers, 'home', null) : null;
  const homeRank = home ? HOME_APT_RANK[home] : null;
  const needRank = MIN_APT_RANK[String(breed.minApartmentSize || '').trim()];
  // Only meaningful for an apartment: a house is not short of room.
  const knowsHome = homeRank != null && needRank != null;

  if (knowsHome && needRank > homeRank) {
    cons.push(`Needs at least a ${String(breed.minApartmentSize).replace(/\s*(min|OK)$/i, '')} — larger than the home you told us about.`);
  } else if (breed.minApartmentSize === '1BHK OK') {
    pros.push('Comfortable even in a 1BHK apartment.');
  } else if (breed.minApartmentSize === '2BHK min') {
    pros.push('Well suited to a typical 2BHK apartment.');
  }
  if (breed.experienceLevel === 'First-timer OK') pros.push('Easy to train and handle for first-time owners.');
  if (['Low', 'Low-Medium'].includes(breed.grooming)) pros.push('Low grooming and maintenance needs.');
  if ((breed.energy || '').startsWith('Low')) pros.push('Low exercise needs — workable for busy schedules.');
  if ((breed.risk || '').startsWith('Low')) pros.push('Gentle, low-aggression temperament.');
  if (['Very Low', 'Low'].includes(breed.shedding)) pros.push('Minimal shedding keeps the home cleaner.');
  if (breed.monthlyCostMax <= 8000) pros.push('Affordable to feed and maintain in India.');
  if ((breed.purpose || '').includes('Guard')) pros.push('Strong natural guarding instincts.');

  if (breed.minApartmentSize === 'House only') cons.push('Needs an independent house — not suitable for a 1BHK.');
  if (breed.minApartmentSize === '3BHK min')   cons.push('Best in a 3BHK or larger; workable in a smaller flat with committed daily walks.');
  if (breed.experienceLevel === 'Experienced only') cons.push('Not recommended for first-time owners.');
  if (['High', 'Very High'].includes(breed.grooming)) cons.push('Frequent brushing and professional grooming required.');
  if ((breed.energy || '').toLowerCase().startsWith('very high')) cons.push('Needs heavy daily exercise or becomes destructive.');
  if (['High', 'Very High'].includes(breed.shedding)) cons.push('Heavy shedder — expect frequent vacuuming.');
  if (breed.monthlyCostMin >= 12000) cons.push('High monthly maintenance cost.');
  if ((breed.health || '').split(',').length >= 3) cons.push('Prone to several health issues needing regular vet care.');

  if (pros.length === 0) pros.push('Loyal and adaptable companion.');
  if (cons.length === 0) cons.push('Requires standard dog care and attention.');

  return { pros, cons };
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

  const climateCopy = {
    HOT: 'Built for warm, humid Indian cities — Hyderabad, Chennai, Mumbai. Avoid peak afternoon sun.',
    'MEDIUM-HOT': 'Comfortable across most Indian metros year-round, including warm and mixed-season cities.',
    MEDIUM: 'Suits moderate cities like Bangalore, Pune and Chandigarh. Manages summer with shade and water.',
    'COLD-MEDIUM': 'Prefers mild to cool weather. Indian summers need indoor AC.',
    COLD: 'Suited to Shimla, Dehradun, Darjeeling or Srinagar. Not viable in hot Indian cities without full-time AC.',
  };
  items.push({ label: 'Climate', text: climateCopy[climateTag(b.climate)] || 'Adaptable to most Indian climates with seasonal care.' });

  items.push({ label: 'Daily Exercise', text: `Around ${b.time} of walks, play and mental stimulation each day.` });

  const groomCopy = {
    Low: 'Low maintenance. Occasional brushing and baths.',
    'Low-Medium': 'Regular brushing keeps the coat healthy.',
    Medium: 'Regular brushing plus occasional professional grooming.',
    'Medium-High': 'Frequent brushing and regular professional grooming.',
    High: 'Professional grooming every 4–6 weeks to prevent matting.',
    'Very High': 'Daily brushing and frequent professional grooming.',
  };
  items.push({ label: 'Grooming', text: groomCopy[b.grooming] || 'Standard grooming routine.' });

  items.push({ label: 'Nutrition', text: `${b.nutrition}. Keep fresh water available and portion by weight to prevent obesity.` });

  items.push({
    label: 'Cost in India',
    text: `Puppy: ${b.puppyPrice} one-time. Upkeep: ₹${b.monthlyCostMin.toLocaleString('en-IN')}–₹${b.monthlyCostMax.toLocaleString('en-IN')} per month.`,
  });

  let social = 'Thrives on company and should not be alone for long stretches. Socialise early, between 3 and 14 weeks.';
  if ((b.purpose || '').includes('Guard')) {
    social = 'Protective by instinct. Needs consistent early socialisation to tell a guest from a threat.';
  } else if ((b.risk || '').startsWith('Low')) {
    social = 'Very sociable and gentle with families, but prone to separation anxiety if left alone all day.';
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
  const zone = cityZone(firstAnswer(answers, 'city', 'moderate'));
  const purposes = toArray(answers.purpose);

  const homePhrase = ANSWER_PHRASES.home[home] || 'home';
  const activityPhrase = ANSWER_PHRASES.activity[activity] || 'lifestyle';

  // Only claim a purpose match if the breed actually fits the chosen role.
  const bp = breed.purpose || '';
  const matchedPurpose = purposes.find((p) => {
    const cfg = PURPOSE[p];
    return cfg && (cfg.primary.some((k) => bp.includes(k)) || cfg.secondary.some((k) => bp.includes(k)));
  });
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

  const lead = goal
    ? `You wanted ${goal}, and the ${breed.name} fits — a good match for your ${fitPhrase}.`
    : `For your ${fitPhrase}, the ${breed.name} is a strong lifestyle match.`;

  // One genuine supporting trait — each gated on the actual answer so nothing contradicts.
  const heatClass = heatCfg.breeds[breed.name];
  const rT = riskTag(breed.risk);
  const energy = (breed.energy || '').toLowerCase();
  const supports = [];
  if (heatClass && climateGate(heatClass, zone) >= 0.95)
    supports.push(`its coat handles your ${zoneLabel(zone)} comfortably`);
  if ((family === 'kids' || family === 'both') && rT === 'Low')
    supports.push('it is famously gentle with children');
  else if (family === 'seniors' && rT === 'Low')
    supports.push('it stays calm and easy around seniors');
  else if (family === 'adults' && (energy.startsWith('low') || rT === 'Low'))
    supports.push('its easygoing temperament suits an adults-only home');
  if (experience === 'none' && breed.experienceLevel === 'First-timer OK')
    supports.push('it forgives first-time-owner mistakes');

  return supports.length ? `${lead} A big plus: ${supports[0]}.` : lead;
}

/** Short pro/con chips tied to the user's own answers (Results page). */
export function generateMatchReasons(breed, answers) {
  if (!breed || !answers) return { pros: [], cons: [] };

  const home = firstAnswer(answers, 'home', 'apt-2bhk');
  const experience = firstAnswer(answers, 'experience', 'none');
  const budget = firstAnswer(answers, 'budget', '5k-10k');
  const family = firstAnswer(answers, 'family', 'adults');
  const zone = cityZone(firstAnswer(answers, 'city', 'moderate'));

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

  if (experience === 'none' && breed.experienceLevel === 'First-timer OK') pros.push('Beginner Friendly');
  if (experience === 'none' && breed.experienceLevel === 'Experienced only') cons.push('Requires Experienced Owner');

  const ceiling = BUDGET_CEILING[budget] ?? 10000;
  const mid = (Number(breed.monthlyCostMin) + Number(breed.monthlyCostMax)) / 2;
  if (mid <= ceiling) pros.push('Matches Your Budget');
  else cons.push('Higher Monthly Cost');

  const rT = riskTag(breed.risk);
  if ((family === 'kids' || family === 'both') && rT === 'Low') pros.push('Good with Children');
  if (family === 'seniors' && rT === 'Low') pros.push('Good with Seniors');
  if (family !== 'adults' && rT === 'High') cons.push('Not Ideal for Vulnerable Family Members');

  const heatClass = heatCfg.breeds[breed.name];
  if (heatClass) {
    const g1 = climateGate(heatClass, zone);
    if (g1 >= 0.95) pros.push('Climate Suitable');
    if (g1 <= heatCfg.heatFlagThreshold) cons.push('Struggles in Your Climate');
  }

  return { pros, cons };
}
