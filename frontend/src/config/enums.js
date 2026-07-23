/* ============================================================================
   RIGHTBREED v4 — Step 0 enum maps.

   SINGLE SOURCE OF TRUTH. Imported by both the runtime engine
   (src/utils/breedUtils.js) and the build-time validator
   (scripts/validate-data.mjs), so the two can never drift apart.

   Pure JS with no JSON imports on purpose: that keeps this file importable by
   plain Node (the validator) as well as Vite.
   ========================================================================= */

/** First token of a free-text DB cell, e.g. "High – 1–2 hrs vigorous" -> "High".
    Splits on newline and EN-DASH only, never the ASCII hyphen, so compound
    enums like "Low-Medium" survive intact. */
export const headToken = (s) => String(s ?? '').split(/[\n–]/)[0].trim();

/* -------------------------- breed DB enums -------------------------------- */
/** Breed energy collapses onto the same 3-band scale as the activity answer. */
export const ENERGY_BAND = { Low: 0, Medium: 1, High: 2, 'Very High': 2 };

export const SHED_BAND = {
  'Very Low': 0, Low: 0,
  'Low-Medium': 1, Medium: 1,
  'Medium-High': 2, High: 2, 'Very High': 2,
};

/** V4 ships a clean Low/Medium/High risk column — a direct 3-tier match to G2. */
export const RISK_TIER = { Low: 'LOW', Medium: 'MEDIUM', High: 'HIGH' };

export const HAIR_VALUES = { Short: 'Short', Medium: 'Medium', Long: 'Long' };

export const APT_FRIENDLY = { Yes: true, No: false };

export const MIN_APT_RANK = { '1BHK OK': 1, '2BHK min': 2, '3BHK min': 3, 'House only': 4 };

/** Real V4 column — three values, so G3 uses three tiers rather than
    collapsing the middle one into a full penalty. */
export const EXPERIENCE_LEVELS = {
  'First-timer OK': 'BEGINNER_FRIENDLY',
  'Some experience': 'SOME_EXPERIENCE',
  'Experienced only': 'DEMANDING',
};

/** G3 multipliers, applied only when the user is a first-time owner. */
export const EXPERIENCE_GATE = {
  BEGINNER_FRIENDLY: 1.0,
  SOME_EXPERIENCE: 0.8,
  DEMANDING: 0.6,
};

/* -------------------------- quiz answer enums ----------------------------- */
export const ACTIVITY_BAND = { relaxed: 0, moderate: 1, high: 2 };
export const SHED_PREF_BAND = { low: 0, moderate: 1, fine: 2 };
export const HAIR_PREF = { short: 'Short', medium: 'Medium', long: 'Long', any: 'ANY' };
export const HOME_APT_RANK = { 'apt-1bhk': 1, 'apt-2bhk': 2, 'apt-3bhk': 3 };
export const HOME_IS_HOUSE = { 'house-yard': true, 'house-no-yard': true };
export const BUDGET_CEILING = { under5k: 5000, '5k-10k': 10000, '10k-20k': 20000, above20k: Infinity };
export const FAMILY_HAS_VULNERABLE = { kids: true, seniors: true, both: true, adults: false };
export const EXPERIENCE_ANSWERS = { none: true, some: false, experienced: false };

export const PURPOSE = {
  family:  { primary: ['Family Dog'],          secondary: ['Companion', 'Therapy'] },
  guard:   { primary: ['Guard Dog'],           secondary: ['Watch Dog', 'Working', 'Protection', 'Police', 'Military', 'Livestock'] },
  active:  { primary: ['Sporting', 'Hunting'], secondary: ['Working', 'Scent Hound', 'Retriever', 'Herding', 'Active', 'Carriage'] },
  therapy: { primary: ['Therapy'],             secondary: ['Companion', 'Family Dog', 'Service', 'Guide'] },
  seniors: { primary: ['Toy'],                 secondary: ['Companion', 'Lap'] },
  breed:   { primary: [],                      secondary: [] }, // "I already love a breed" -> Explore; carries no lifestyle signal
};

/** Which quiz question feeds which answer map — used by the validator to walk
    every shipped option value through the same maps the engine uses. */
export const ANSWER_MAP_BY_QUESTION = {
  purpose: PURPOSE,
  activity: ACTIVITY_BAND,
  hair: HAIR_PREF,
  budget: BUDGET_CEILING,
  family: FAMILY_HAS_VULNERABLE,
  shedding: SHED_PREF_BAND,
  experience: EXPERIENCE_ANSWERS,
};
