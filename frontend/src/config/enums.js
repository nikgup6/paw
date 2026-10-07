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
/** Takes the label before the explanatory text. Two different dash uses in
    the DB text look identical unless you check spacing: a BARE en-dash with
    no surrounding space is part of a compound label ("Low–Medium"); an
    en-dash WITH surrounding spaces (" – ") is the separator before the
    explanation. Splitting on every en-dash (the old behaviour) silently
    truncated every compound label to its first half — "Low–Medium" read as
    just "Low", losing the real caveat attached to it. Confirmed against the
    live data: 7 of 23 breeds carried a compound risk, energy or house label
    that this was quietly discarding — including the exact "may snap if
    handled roughly" risk nuance on Dachshund that a first pass at this fix
    missed entirely, because checking that parsing SUCCEEDED isn't the same
    as checking it extracted the CORRECT value. */
export const headToken = (s) => String(s ?? '').split(/\n| – /)[0].trim();

/* -------------------------- breed DB enums -------------------------------- */
/** Breed energy collapses onto the same 3-band scale as the activity answer. */
export const ENERGY_BAND = { Low: 0, 'Low–Medium': 0.5, Medium: 1, 'Medium–High': 1.5, High: 2, 'Very High': 2 };

/** V4 ships a clean Low/Medium/High risk column — a direct 3-tier match to G2. */
/** The two compound values (LOW_MEDIUM, MEDIUM_HIGH) are genuine, honestly-
    placed tiers, not aliases — collapsing them into a neighbour would throw
    away exactly the nuance a compound DB label ("Low–Medium") was written to
    convey. FAMILY_GATE below interpolates between the tiers they sit
    between, not an arbitrary number. */
export const RISK_TIER = { Low: 'LOW', 'Low–Medium': 'LOW_MEDIUM', Medium: 'MEDIUM', 'Medium–High': 'MEDIUM_HIGH', High: 'HIGH' };

export const HAIR_VALUES = { Short: 'Short', Medium: 'Medium', Long: 'Long' };

/** Ordinal band for graded hair-length scoring — same shape the old shedding
    factor used (d=0 full points, d=1 half, d=2 zero). Hair now carries the
    weight both factors used to share (15pts total), so it earns the same
    graded-distance treatment Activity already gets, not a flat binary match. */
export const HAIR_BAND = { Short: 0, Medium: 1, Long: 2 };

export const APT_FRIENDLY = { Yes: true, No: false };

export const MIN_APT_RANK = { '1BHK OK': 1, '2BHK min': 2, '3BHK min': 3, 'House only': 4 };

/** Breed's own documented yard/open-space need, from the `house` DB column.
    Feeds the house-no-yard branch of scoreHome()/hasSpaceGap() — a High-need
    breed shown "house, no yard" was previously scored identically to one
    shown "house, with yard", which contradicted the DB's own text (e.g.
    Mudhol Hound: "large open space essential"). */
/** Breeds whose High house-need is about total SPACE, not a yard specifically
    — re-checked against the DB's own house-field wording (see breedUtils.js
    scoreHome comment for the audit). Only Great Dane's text says "indoor/
    outdoor space", meaning large indoor space alone can satisfy it. Every
    other High-tier breed's text explicitly names a yard or open land, so
    stays at the strict tier — including Saint Bernard, whose text wants
    BOTH indoor space AND a yard, not indoor space as a substitute. */
export const HOUSE_NEED_BAND = { Low: 0, 'Low–Medium': 0.5, Medium: 1, 'Medium–High': 1.5, High: 2 };

/** Breeds whose High house-need is about total SPACE, not a yard specifically
    — re-checked against the DB's own house-field wording (see breedUtils.js
    scoreHome comment for the audit). Only Great Dane's text says "indoor/
    outdoor space", meaning large indoor space alone can satisfy it. Every
    other High-tier breed's text explicitly names a yard or open land, so
    stays at the strict tier — including Saint Bernard, whose text wants
    BOTH indoor space AND a yard, not indoor space as a substitute. */
export const SPACE_GENERAL_BREEDS = new Set(['Great Dane']);

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
export const HAIR_PREF = { short: 'Short', medium: 'Medium', long: 'Long', any: 'ANY' };
/** PG (0.5) sits below even 1BHK — a single room in a shared building is
    tighter than a self-contained flat, and PG landlords are typically
    stricter about pets than a lease. "still-figuring-out" (2) uses a
    neutral 2BHK-equivalent baseline rather than presuming either a cramped
    or spacious home — deliberately not the most generous or strictest
    option, since we genuinely don't know yet. Both get a disclaimer, not a
    silent guess — see showsPgDisclaimer / showsHomeUnsureDisclaimer. */
export const HOME_APT_RANK = { 'apt-1bhk': 1, 'apt-2bhk': 2, 'apt-3bhk': 3, 'pg': 0.5, 'still-figuring-out': 2 };
export const HOME_IS_HOUSE = { 'house-yard': true, 'house-no-yard': true };
export const HOME_SHOWS_PG_DISCLAIMER = {
  'apt-1bhk': false, 'apt-2bhk': false, 'apt-3bhk': false,
  'house-yard': false, 'house-no-yard': false,
  pg: true, 'still-figuring-out': false,
};
export const HOME_SHOWS_UNSURE_DISCLAIMER = {
  'apt-1bhk': false, 'apt-2bhk': false, 'apt-3bhk': false,
  'house-yard': false, 'house-no-yard': false,
  pg: false, 'still-figuring-out': true,
};
export const BUDGET_CEILING = { under5k: 5000, '5k-10k': 10000, '10k-20k': 20000, above20k: Infinity };
export const FAMILY_HAS_VULNERABLE = {
  'young-kids': true,   // toddlers / under-5 — strictest safety filter
  'older-kids': true,   // 5–17 — standard kids filter
  kids: true,           // legacy value from before the split — keep for stale localStorage
  seniors: true,
  both: true,
  adults: false,
};
export const EXPERIENCE_ANSWERS = { none: true, some: false, experienced: false };

/* ---- G4/G5/G6 answer enums — the axis each new gate's config table indexes on ---- */
export const FLOORING_ANSWER = { hard: 'HARD', mixed: 'MIXED', carpeted: 'CARPETED' };
export const TRAINING_EFFORT_ANSWER = { minimal: 'MINIMAL', moderate: 'MODERATE', committed: 'COMMITTED' };
export const SCHEDULE_ANSWER = { home: 'HOME', 'up-to-4h': 'UP_TO_4H', '4-8h': '4_TO_8H', '8h-plus': '8H_PLUS' };
/** Shows the universal (non-breed-specific) 4-hour welfare disclaimer, per the
    RSPCA/PDSA/Dogs Trust/Blue Cross convergence — independent of breed tier. */
export const SCHEDULE_SHOWS_WELFARE_DISCLAIMER = { home: false, 'up-to-4h': false, '4-8h': false, '8h-plus': true };

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
  experience: EXPERIENCE_ANSWERS,
  flooring: FLOORING_ANSWER,
  trainingEffort: TRAINING_EFFORT_ANSWER,
  schedule: SCHEDULE_ANSWER,
  // 'allergies' intentionally absent: unscored, never touches the engine —
  // the frontend reads the raw answer only to decide whether to show its own
  // disclaimer copy. Including it here would make the validator require it
  // to map to a scoring enum it will never have.
};
