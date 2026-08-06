#!/usr/bin/env node
/* ============================================================================
   RIGHTBREED v4 — build-time data validation.  FAIL LOUD.

   Wired to `npm run prebuild`, so `npm run build` cannot succeed while any
   breed row, quiz option, city or heat class fails to map to a known enum.
   This is the check that would have caught the original live bug: a value the
   scorer silently read as zero.

   Run directly for a report:  node scripts/validate-data.mjs
   ========================================================================= */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  headToken,
  ENERGY_BAND, SHED_BAND, RISK_TIER, HAIR_VALUES, APT_FRIENDLY, MIN_APT_RANK, EXPERIENCE_LEVELS,
  ANSWER_MAP_BY_QUESTION, HOME_APT_RANK, HOME_IS_HOUSE,
} from '../src/config/enums.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const readJSON = (rel) => JSON.parse(readFileSync(resolve(HERE, '..', rel), 'utf8'));

const breeds = readJSON('src/constants/breeds.json');
const questions = readJSON('src/constants/questions.json');
const cityZones = readJSON('src/config/cityZones.json');
const heat = readJSON('src/config/breedHeatClasses.json');

const errors = [];
const err = (msg) => errors.push(msg);
const has = (map, key) => Object.prototype.hasOwnProperty.call(map, key);

/** Assert a value maps, else record a precise, actionable error. */
function check(map, rawValue, what, { parse = false } = {}) {
  const key = parse ? headToken(rawValue) : String(rawValue ?? '').trim();
  if (!has(map, key)) {
    err(`${what}: ${JSON.stringify(rawValue)} -> normalises to ${JSON.stringify(key)}, which is not a known enum. ` +
        `Allowed: ${Object.keys(map).join(' | ')}`);
    return false;
  }
  return true;
}

/* ------------------------- 1. every breed row ----------------------------- */
console.log(`Validating ${breeds.length} breeds...`);
const seenNames = new Set();
for (const b of breeds) {
  const name = String(b?.name ?? '').trim();
  const at = `breed "${name || '(unnamed)'}"`;
  if (!name) { err(`${at}: missing name`); continue; }
  if (seenNames.has(name)) err(`${at}: duplicate breed name`);
  seenNames.add(name);

  check(ENERGY_BAND, b.energy, `${at} energy`, { parse: true });
  check(RISK_TIER, b.risk, `${at} risk`, { parse: true });
  check(SHED_BAND, b.shedding, `${at} shedding`);
  check(HAIR_VALUES, b.hair, `${at} hair`);
  check(APT_FRIENDLY, b.apt, `${at} apt`);
  check(MIN_APT_RANK, b.minApartmentSize, `${at} minApartmentSize`);

  // experienceLevel may legitimately be blank (the derived proxy covers it),
  // but if present it MUST map.
  if (b.experienceLevel != null && String(b.experienceLevel).trim() !== '') {
    check(EXPERIENCE_LEVELS, b.experienceLevel, `${at} experienceLevel`);
  }

  // Heat class is mandatory — G1 has no default.
  if (!has(heat.breeds, name)) {
    err(`${at}: no heat classification. Add it to src/config/breedHeatClasses.json ` +
        `(one of: ${Object.keys(heat.classes).join(' | ')}).`);
  }

  const score = Number(b.score);
  if (!Number.isFinite(score) || score < 1 || score > 5) {
    err(`${at} score: ${JSON.stringify(b.score)} is not a number in 1–5.`);
  }
  const min = Number(b.monthlyCostMin);
  const max = Number(b.monthlyCostMax);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) {
    err(`${at} monthly cost: ${JSON.stringify(b.monthlyCostMin)}–${JSON.stringify(b.monthlyCostMax)} is not a valid range.`);
  }

  // Internal consistency: apartment-friendly must not contradict the size need.
  const aptYes = String(b.apt ?? '').trim() === 'Yes';
  if (aptYes && String(b.minApartmentSize ?? '').trim() === 'House only') {
    err(`${at}: apt="Yes" contradicts minApartmentSize="House only".`);
  }
  if (!aptYes && String(b.minApartmentSize ?? '').trim() === '1BHK OK') {
    err(`${at}: apt="No" contradicts minApartmentSize="1BHK OK".`);
  }
}

/* ---------------- 2. heat config points only at real breeds --------------- */
for (const [name, cls] of Object.entries(heat.breeds)) {
  if (!seenNames.has(name)) err(`heat config lists "${name}", which is not in breeds.json.`);
  if (!has(heat.classes, cls)) err(`heat config: "${name}" has unknown class ${JSON.stringify(cls)}.`);
}
for (const [cls, row] of Object.entries(heat.classes)) {
  for (const zone of cityZones.zones) {
    const v = row[zone];
    if (typeof v !== 'number' || v <= 0 || v > 1) {
      err(`heat class "${cls}" zone "${zone}": ${JSON.stringify(v)} is not a multiplier in (0, 1].`);
    }
  }
}

/* ---------------------- 3. every city maps to a zone ---------------------- */
const zoneSet = new Set(cityZones.zones);
for (const [city, zone] of Object.entries(cityZones.cities)) {
  if (!zoneSet.has(zone)) err(`city "${city}" -> unknown zone ${JSON.stringify(zone)}.`);
}
for (const [band, zone] of Object.entries(cityZones.legacyBands)) {
  if (band === '_comment') continue;
  if (!zoneSet.has(zone)) err(`legacy band "${band}" -> unknown zone ${JSON.stringify(zone)}.`);
}
for (const zone of cityZones.zones) {
  if (!cityZones.zoneLabels?.[zone]) err(`zone "${zone}" has no label in zoneLabels.`);
}

/* -------------- 4. every shipped quiz option maps to an enum -------------- */
console.log(`Validating ${questions.length} questions...`);
for (const q of questions) {
  const opts = q.options ?? [];
  if (q.id === 'city') {
    // City options are generated from cityZones.json at render time; any
    // hard-coded ones must still resolve.
    for (const o of opts) {
      const v = String(o.val ?? '');
      const ok = v.startsWith('zone:')
        ? zoneSet.has(v.slice(5))
        : has(cityZones.cities, v) || has(cityZones.legacyBands, v);
      if (!ok) err(`question "city" option ${JSON.stringify(v)} does not resolve to a zone.`);
    }
    continue;
  }
  if (q.id === 'home') {
    for (const o of opts) {
      const v = String(o.val ?? '');
      if (!has(HOME_APT_RANK, v) && !has(HOME_IS_HOUSE, v)) {
        err(`question "home" option ${JSON.stringify(v)} is neither a known apartment nor house value.`);
      }
    }
    continue;
  }
  const map = ANSWER_MAP_BY_QUESTION[q.id];
  if (!map) continue; // free-text questions carry no enum
  for (const o of opts) check(map, o.val, `question "${q.id}" option`);
}

/* ------------------------------- report ----------------------------------- */
if (errors.length) {
  console.error(`\n✗ RIGHTBREED data validation FAILED — ${errors.length} problem(s):\n`);
  errors.forEach((e, i) => console.error(`  ${i + 1}. ${e}`));
  console.error('\nBuild aborted. Fix the data (or add the value to src/config/enums.js) and retry.\n');
  process.exit(1);
}

console.log(`✓ RIGHTBREED data validation passed — ${breeds.length} breeds, ` +
            `${Object.keys(cityZones.cities).length} cities, ${questions.length} questions, no unmapped values.`);
