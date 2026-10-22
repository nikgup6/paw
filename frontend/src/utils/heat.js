import { HEAT } from '../constants/heatData';

/* "Will it survive?" — the Indian heat check.

   One pure lookup, no network, no AI: the answer comes entirely from constants/heatData.js.
   That file is the single source of truth and is NOT edited here. If a number in it looks wrong,
   say so — do not patch it in this file.

   THE RULE (exactly as specified, do not "improve" it)
     tier  = how badly the breed copes with heat           0 (native) .. 5 (worst)
     load  = how hard that city pushes in that month       0 (cool)   .. 5 (peak)
     score = tier * 2 + load
     A month with load 0 is a cool month and is almost always fine: only the very worst
     breeds (tier 5) get a warning there.

   HOW TO EDIT
   - Verdict wording and advice: HEAT.VERDICTS / HEAT.ADVICE in constants/heatData.js.
   - Colours for the five levels: HEAT_COLOURS below. Every level also carries a short
     label, so colour is never the only thing telling the person the answer. */

/** The five levels, darkest-to-lightest meaning: 0 fine -> 4 not advised. */
export const HEAT_COLOURS = ['#2E9E5B', '#9CBF2B', '#F5A524', '#F5691A', '#C8321E'];

/* The breed database and the heat data were written at different times, so a few names differ.
   Keys are what the quiz/breeds.json calls a breed; values are the key inside HEAT.BREEDS.
   Checked against all 23 breeds in breeds.json: "Indie Dog" is the only one that differs. */
export const BREED_ALIASES = {
  'Indie Dog': 'Indian Pariah Dog',
};

/** The HEAT.BREEDS key for an app breed name, or null when that breed has no heat data. */
export function heatKeyFor(breedName) {
  if (!breedName) return null;
  const direct = HEAT.BREEDS[breedName] ? breedName : null;
  const alias = BREED_ALIASES[breedName];
  return direct || (alias && HEAT.BREEDS[alias] ? alias : null);
}

/** true when this breed can be looked up at all (used to hide the results-page link). */
export const hasHeatData = (breedName) => !!heatKeyFor(breedName);

/**
 * The verdict for one breed, city and month.
 * @param {string} breed  a breeds.json name or a HEAT.BREEDS key
 * @param {string} city   one of HEAT.CITIES
 * @param {number} m      month index, 0 = January
 * @returns {{index:number,label:string,colour:string,advice:object,tier:number,load:number,score:number,reason:string}|null}
 *          null when the breed or city is not in the data (the page then says so rather than guessing).
 */
export function getHeatVerdict(breed, city, m) {
  const key = heatKeyFor(breed);
  const loads = HEAT.CITY_LOAD[city];
  if (!key || !loads) return null;
  const month = Number(m);
  if (!Number.isInteger(month) || month < 0 || month > 11) return null;

  const tier = HEAT.BREEDS[key].tier;
  const load = loads[month];
  const score = tier * 2 + load;

  let index;
  if (load === 0) index = tier <= 4 ? 0 : 1;        // cool month: almost always fine
  else if (score <= 3) index = 0;
  else if (score <= 6) index = 1;
  else if (score <= 9) index = 2;
  else if (score <= 12) index = 3;
  else index = 4;

  return {
    index,
    label: HEAT.VERDICTS[index],
    colour: HEAT_COLOURS[index],
    advice: HEAT.ADVICE[String(index)],
    reason: HEAT.BREEDS[key].reason,
    tier,
    load,
    score,
    breedKey: key,
  };
}

/** All twelve months for one breed and city — the strip under the result card. */
export function getYear(breed, city) {
  return HEAT.MONTHS.map((_, m) => getHeatVerdict(breed, city, m));
}
