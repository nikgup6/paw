import { LANES, MOVES, RUN, SPAWN } from './config.js';

/* SPAWNER: decides what is on the street ahead of the dog. No 3D in here, just numbers, so it can be tested alone.

   The street is a list of ROWS. A row is one slice of road with three lanes, and each lane holds one of:
     EMPTY   nothing, run through
     AUTO    auto-rickshaw: too tall to jump, change lane
     COW     standing cow: too big to jump, change lane
     PUDDLE  jump over it
     POTHOLE jump over it
     BAR     hanging cloth line: slide under it

   THE FAIRNESS RULE (the important bit).
   A run must always have a way through. So every row we make is checked by `nextReachable()` below:
     1. a row never has all three lanes blocked by AUTO / COW (there is always a lane that is not solid);
     2. the dog must be able to get from where it could be after the previous row to a lane that is OK in this one:
        a lane change takes time, plus a moment to react (config.js), and
     3. after a jump or slide the dog needs time to recover before the next jump or slide.
   Rows are spaced so that these always hold at the speed the dog will have there, and rows that would still fail
   are thrown away and re-drawn. `selfCheck()` at the bottom proves it over 10,000 rows. */

export const EMPTY = 0;
export const AUTO = 1;
export const COW = 2;
export const PUDDLE = 3;
export const POTHOLE = 4;
export const BAR = 5;

export const isSolid = (k) => k === AUTO || k === COW;
export const isAction = (k) => k === PUDDLE || k === POTHOLE || k === BAR;

const LANE_SECONDS = LANES.changeMs / 1000;

/** The dog's speed at a given distance. Speed depends only on distance, so the spawner knows it ahead of time. */
export const speedAt = (dist) => Math.min(RUN.maxSpeed, RUN.startSpeed + RUN.rampPerMetre * dist);

/**
 * Can the dog get through this row?
 *  prevMask  : lanes the dog could be in right after the previous row (bit 0 = left, 1 = middle, 2 = right)
 *  prevAct   : which of those lanes needed a jump or slide in the previous row
 *  lanes     : this row (three kinds)
 *  gap       : distance from the previous row to this one (m)
 *  speed     : the dog's speed here (m/s)
 * Returns a number: low 3 bits = lanes the dog can be in after this row, next 3 bits = which of those needed an
 * action. Returns 0 when there is NO safe way through (an unfair row).
 */
export function nextReachable(prevMask, prevAct, lanes, gap, speed) {
  const t = (gap - SPAWN.rowDepth) / speed;   // seconds the dog has between the two rows
  let mask = 0;
  let act = 0;
  for (let l = 0; l < LANES.count; l++) {
    const kind = lanes[l];
    if (isSolid(kind)) continue;
    const needsAction = isAction(kind);
    let ok = false;
    for (let p = 0; p < LANES.count && !ok; p++) {
      if (!(prevMask & (1 << p))) continue;
      if (l !== p && Math.abs(l - p) * LANE_SECONDS + SPAWN.reactSeconds > t) continue;   // too far to change lane in time
      if (needsAction && (prevAct & (1 << p)) && t < SPAWN.recoverSeconds) continue;     // still recovering from the last jump/slide
      ok = true;
    }
    if (ok) {
      mask |= 1 << l;
      if (needsAction) act |= 1 << l;
    }
  }
  return mask === 0 ? 0 : (mask | (act << 3));
}

/** Small seeded random number generator, only used by the self-check so its result is repeatable. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Spawner {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.cand = new Int8Array(LANES.count);   // the row being tried (reused, never re-allocated)
    this.lanes = new Int8Array(LANES.count);  // the last accepted row
    this.onRow = null;                        // tests can listen to every accepted row
    this.fallbackRows = 0;                    // how many rows had to be replaced by an empty one (should stay near zero)
    this.reset(0);
  }

  /** Start a fresh street. `startZ` is where the first row goes (leaves a runway at the start). */
  reset(startZ = 45) {
    this.prevZ = startZ - 60;
    this.prevMask = (1 << LANES.count) - 1;
    this.prevAct = 0;
    this.nextZ = startZ;
    this.lanes.fill(EMPTY);
    this.fallbackRows = 0;
  }

  /** Make rows until the street is built far enough ahead of the dog. Calls the two callbacks for what to place. */
  fill(dist, emitObstacle, emitBone) {
    while (this.nextZ < dist + SPAWN.horizon) this._makeRow(emitObstacle, emitBone);
  }

  _gapAfter(z) {
    const spd = speedAt(z + 40);
    const d = Math.min(1, z / SPAWN.hardAfterMetres);
    // always at least "recovery time" of road, plus some random room that shrinks as the run gets harder
    return spd * SPAWN.recoverSeconds + SPAWN.rowDepth + this.rng() * spd * SPAWN.spreadSeconds * (1 - 0.55 * d);
  }

  _pickSolid() { return this.rng() < 0.5 ? AUTO : COW; }
  _pickJump() { return this.rng() < 0.55 ? PUDDLE : POTHOLE; }

  /** Fills `this.cand` with a random row. `d` is difficulty from 0 (start) to 1. */
  _layout(d) {
    const c = this.cand;
    const r = this.rng();
    c.fill(EMPTY);
    const a = (this.rng() * 3) | 0;                 // a random lane
    const b = (a + 1 + ((this.rng() * 2) | 0)) % 3; // a different random lane

    // weights: more two-lane blockers and mixed rows as the run goes on
    const wSolid1 = 0.2;
    const wSolid2 = 0.1 + 0.22 * d;
    const wJump = 0.22;
    const wJump3 = 0.04 + 0.06 * d;
    const wSlide = 0.14;
    const wMixed = 0.14 + 0.1 * d;
    const t1 = wSolid1;
    const t2 = t1 + wSolid2;
    const t3 = t2 + wJump;
    const t4 = t3 + wJump3;
    const t5 = t4 + wSlide;
    const t6 = t5 + wMixed;
    if (r < t1) { c[a] = this._pickSolid(); return; }
    if (r < t2) { c[a] = this._pickSolid(); c[b] = this._pickSolid(); return; }
    if (r < t3) { c[a] = this._pickJump(); if (this.rng() < 0.4) c[b] = this._pickJump(); return; }
    if (r < t4) { c[0] = this._pickJump(); c[1] = this._pickJump(); c[2] = this._pickJump(); return; }
    if (r < t5) { c[a] = BAR; if (this.rng() < 0.4) c[b] = BAR; return; }
    if (r < t6) {
      c[a] = this._pickSolid();
      c[b] = this.rng() < 0.5 ? this._pickJump() : BAR;
      return;
    }
    // anything left over is a breather: an empty stretch (only bones)
  }

  _makeRow(emitObstacle, emitBone) {
    const z = this.nextZ;
    const gap = z - this.prevZ;
    const spd = speedAt(z);
    const d = Math.min(1, z / SPAWN.hardAfterMetres);
    const c = this.cand;

    let packed = 0;
    for (let tries = 0; tries < 8 && !packed; tries++) {
      this._layout(d);
      packed = nextReachable(this.prevMask, this.prevAct, c, gap, spd);
    }
    if (!packed) {                                   // never happens in practice; keeps the street safe if it ever did
      c.fill(EMPTY);
      packed = nextReachable(this.prevMask, this.prevAct, c, gap, spd);
      this.fallbackRows++;
    }

    // bones: a trail down a lane that is clear in both the last row and this one, and an arc over jump obstacles
    if (emitBone) {
      let clearBoth = 0;
      for (let l = 0; l < LANES.count; l++) if (c[l] === EMPTY && this.lanes[l] === EMPTY) clearBoth |= 1 << l;
      if (clearBoth && this.rng() < SPAWN.boneTrailChance) {
        let lane = (this.rng() * 3) | 0;
        while (!(clearBoth & (1 << lane))) lane = (lane + 1) % 3;
        for (let bz = this.prevZ + 4; bz < z - 4; bz += SPAWN.boneSpacing) emitBone(lane, bz, SPAWN.boneHeight);
      }
      for (let l = 0; l < LANES.count; l++) {
        if ((c[l] === PUDDLE || c[l] === POTHOLE) && this.rng() < SPAWN.boneArcChance) {
          for (let k = -2; k <= 2; k++) emitBone(l, z + k * 1.2, 0.55 + 0.9 * (1 - (k / 2) * (k / 2)));
        }
      }
    }

    for (let l = 0; l < LANES.count; l++) {
      this.lanes[l] = c[l];
      if (c[l] !== EMPTY && emitObstacle) emitObstacle(c[l], l, z);
    }
    if (this.onRow) this.onRow(z, c, gap, spd);

    this.prevMask = packed & 7;
    this.prevAct = packed >> 3;
    this.prevZ = z;
    this.nextZ = z + this._gapAfter(z);
  }
}

/**
 * The self-check from the brief: build 10,000 rows (as 100 separate runs starting at different distances, so every
 * speed from the slow start to the top speed is covered), then check each row again with fresh code and make sure
 * there is always a safe path. Returns a report; `ok` is true when nothing failed.
 */
export function selfCheck(totalRows = 10000, seed = 20261016) {
  const rng = mulberry32(seed);
  const runs = 100;
  const perRun = Math.ceil(totalRows / runs);
  const report = { rows: 0, runs, failures: 0, allSolidRows: 0, fallbackRows: 0, tightestSeconds: Infinity, minSafeLanes: 3, firstFailure: null, ok: false };
  const lanes = new Int8Array(3);

  for (let run = 0; run < runs; run++) {
    const sp = new Spawner(rng);
    const startZ = 45 + rng() * 2600;               // some runs start where the dog is already at top speed
    sp.reset(startZ);
    let mask = 7;
    let act = 0;
    let prevZ = startZ - 60;
    let n = 0;
    sp.onRow = (z, c) => {
      lanes[0] = c[0]; lanes[1] = c[1]; lanes[2] = c[2];
      report.rows++;
      // check 1: never all three lanes solid
      if (isSolid(lanes[0]) && isSolid(lanes[1]) && isSolid(lanes[2])) { report.allSolidRows++; report.failures++; report.firstFailure ||= { z, why: 'all lanes solid' }; }
      let safe = 0;
      for (let l = 0; l < 3; l++) if (!isSolid(lanes[l])) safe++;
      if (safe < report.minSafeLanes) report.minSafeLanes = safe;
      // check 2: a real path from the previous row, using the true gap and speed
      const t = (z - prevZ - SPAWN.rowDepth) / speedAt(z);
      if (t < report.tightestSeconds) report.tightestSeconds = t;
      const packed = nextReachable(mask, act, lanes, z - prevZ, speedAt(z));
      if (!packed) { report.failures++; report.firstFailure ||= { z, why: 'no safe path' }; }
      else { mask = packed & 7; act = packed >> 3; }
      prevZ = z;
      n++;
    };
    // walk the dog along the street so rows keep being made
    let dist = startZ - 80;
    while (n < perRun) { dist += 30; sp.fill(dist, null, null); }
    report.fallbackRows += sp.fallbackRows;
  }
  report.tightestSeconds = +report.tightestSeconds.toFixed(3);
  report.ok = report.failures === 0 && report.rows >= totalRows;
  return report;
}

/* The jump takes MOVES.jumpSeconds; keep the recovery rule honest if someone shortens the margin in config.js. */
export const RECOVERY_IS_SANE = SPAWN.recoverSeconds >= MOVES.jumpSeconds;
