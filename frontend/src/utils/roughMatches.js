import { computeMatches, selectTopMatches } from './breedUtils';
import { SECTIONS } from '../constants/quizSections';
import { FREE_SCREEN_IDS } from '../config/paywall';

/* The rough recommendation: a first guess from the free answers only.

   A THIN WRAPPER. The matching engine (computeMatches, selectTopMatches, the
   scoring, the breed data) is called exactly as the full quiz calls it and is
   not changed in any way.

   The missing answers: the engine already fills every unanswered question with a
   default inside normaliseAnswers (utils/breedUtils.js), so this wrapper fills
   nothing itself. For the 8 paid questions those defaults are:
     purpose family, activity moderate, coat any, budget 5k-10k,
     training moderate, schedule "someone's home most of the day",
     allergies none, timeline (not used for scoring).
   The schedule default is the most generous one, so a rough match leans
   optimistic about time alone - acceptable for something labelled a first guess.

   Only the free answers are passed in, even if the visitor has gone back and
   forth: the rough result must come from the free part and nothing else.

   Returns up to 3 breeds as { name, img, line } - deliberately WITHOUT the
   match %, label, warnings or anything else from the paid result. */

/* Screen positions, in the same order QuizFlow lays them out (SECTIONS, then
   each section's screens). The gate sits on the LAST free screen. */
const ALL_SCREENS = SECTIONS.flatMap((s) => s.screens);
export const TOTAL_SCREENS = ALL_SCREENS.length;
export const LAST_FREE_SCREEN_INDEX = Math.max(
  ...ALL_SCREENS.map((sc, i) => (FREE_SCREEN_IDS.includes(sc.id) ? i : -1)),
);
export const FREE_SCREEN_COUNT = LAST_FREE_SCREEN_INDEX + 1;

const FREE_QUESTION_IDS = new Set(
  SECTIONS.flatMap((s) => s.screens).filter((sc) => FREE_SCREEN_IDS.includes(sc.id)).flatMap((sc) => sc.ids),
);

export function freeAnswersOnly(answers = {}) {
  return Object.fromEntries(Object.entries(answers).filter(([id]) => FREE_QUESTION_IDS.has(id)));
}

export function computeRoughMatches(partialAnswers, breeds) {
  try {
    const scored = computeMatches(freeAnswersOnly(partialAnswers), breeds);
    const { matches } = selectTopMatches(scored, 3);
    return matches.map((b) => ({ name: b.name, img: b.img, line: b.purpose || '' }));
  } catch {
    // The engine refuses answers it cannot read (e.g. a stale saved quiz). The
    // card then shows its "we need a few more answers" version.
    return [];
  }
}
