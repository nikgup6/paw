/* STREET ZOOMIES: every number you may want to tune lives in this ONE file.
   Change a number, save, reload /play, and feel the difference. Nothing else needs editing.

   Units: distances are in "metres" of the game world, times in seconds, speeds in metres per second.
   The dog runs forward along the +z direction. Lane 0 is the left lane, 1 the middle, 2 the right. */

export const LANES = {
  count: 3,
  width: 2.2,               // distance between the centres of two neighbouring lanes
  changeMs: 135,            // how long a lane change takes (spec: 120-150 ms)
};

export const RUN = {
  startSpeed: 9,            // pace at the start (m/s), comfortable
  maxSpeed: 21,             // the fastest the dog ever runs (m/s)
  rampPerMetre: 0.0075,     // speed gained for every metre run; (21 - 9) / 0.0075 = 1600 m until the cap
  boneValue: 5,             // points per bone (score = metres + bones x this)
  // TODO: boss chase every 500 m          (not built in this version)
  // TODO: zoomies boost pickup            (not built in this version)
  // TODO: unlock bark on 10 streets       (not built in this version; the old 2D game did this, see playGame.js)
};

export const MOVES = {
  jumpHeight: 1.2,          // how high a jump goes (m). Cows (1.4) and autos (1.7) are taller on purpose
  jumpSeconds: 0.6,         // time in the air (about 0.6 s)
  slideSeconds: 0.5,        // how long a slide (duck) lasts
  fastFall: 9,              // pressing "slide" in the air pulls the dog down at this extra speed (m/s)
  bufferSeconds: 0.12,      // a jump or slide pressed this long BEFORE landing still counts (feels fair)
};

/* The dog's body for collisions (boxes only, no physics library). */
export const DOG_BOX = {
  halfWidth: 0.3,           // a little smaller than the drawing = forgiving
  halfDepth: 0.4,
  standHeight: 0.9,
  slideHeight: 0.4,
  drawScale: 1.3,           // the dog is DRAWN this much bigger than its hit box, so it reads well on a phone and hits stay forgiving
};

/* Obstacles. halfWidth/halfDepth are half the box size, height is how tall it is, y0/y1 is the vertical band
   that hurts. "flat" things (puddle, pothole) hurt only when the dog's feet are on the ground. */
export const OBSTACLES = {
  auto:    { halfWidth: 0.85, halfDepth: 1.2,  height: 1.7 },
  cow:     { halfWidth: 0.95, halfDepth: 0.55, height: 1.4 },
  puddle:  { halfWidth: 0.85, halfDepth: 0.85, flat: true },
  pothole: { halfWidth: 0.75, halfDepth: 0.6,  flat: true },
  bar:     { halfWidth: 1.05, halfDepth: 0.15, y0: 0.5, y1: 1.5 },   // hanging cloth line: slide under it
  flatHurtHeight: 0.2,      // feet higher than this clear a puddle or pothole
};

/* How obstacle rows are laid out (see spawner.js). */
export const SPAWN = {
  horizon: 90,              // rows are created this far ahead of the dog (m); fog hides the far end
  rowDepth: 2.5,            // length of one row (m), used for gap sums
  reactSeconds: 0.35,       // time a player needs to notice a row and start a lane change
  recoverSeconds: 0.95,     // after a jump or slide, the dog needs this long before it can do another (jump 0.6 + a margin)
  spreadSeconds: 0.9,       // extra random space between rows (seconds of running), shrinks as the run goes on
  hardAfterMetres: 1500,    // difficulty reaches its maximum at this distance
  boneSpacing: 1.8,         // distance between bones in a trail (m)
  boneHeight: 0.75,         // bones float this high (m)
  boneDrawScale: 1.4,       // bones are drawn this much bigger so they are easy to see and grab
  boneTrailChance: 0.7,     // chance a gap between rows gets a bone trail
  boneArcChance: 0.45,      // chance a jump obstacle gets an arc of bones over it
};

export const CAMERA = {
  fov: 60,                  // vertical field of view (degrees) on a wide screen
  minHorizontalFov: 78,     // on a narrow phone screen the view widens so all three lanes stay visible
  height: 3.5,              // how high behind the dog the camera sits (m)
  behind: 5.4,              // how far behind the dog (m)
  lookAhead: 7,             // the camera looks at a point this far in front of the dog (m)
  lookHeight: 0.6,          // ...and this high
  follow: 7,                // how quickly the camera follows lane changes (higher = snappier). Smooth, not instant
  bobHeight: 0.035,         // gentle up-and-down bob while running (m)
  bobSpeed: 2.2,            // bob steps per stride
};

export const WORLD = {
  tileLength: 24,           // one street tile is this long (m)
  tilesFull: 7,             // number of tiles kept alive (full quality)
  tilesReduced: 5,          // ...and when the quality manager has to shorten the view
  fogNear: 38,
  fogFar: 118,
  roadHalfWidth: 4.1,
};

export const TIMING = {
  step: 1 / 60,             // game logic always advances in steps of exactly this many seconds
  maxFrameDelta: 0.1,       // a frame longer than this (tab switch, long pause) is treated as only this long
  maxStepsPerFrame: 5,      // never run more than this many logic steps for one drawn frame
  hudEveryMs: 100,          // the on-screen numbers refresh at most 10 times a second (never every frame)
};

export const INPUT = {
  swipePx: 24,              // a finger must move about this far to count as a swipe
  tapMaxMovePx: 10,         // a touch that moves less than this and is quick is a tap
  tapMaxMs: 300,
};

/* The quality manager: if the game runs slower than the threshold it quietly steps down, one level at a time,
   and never steps back up during the same run. The level is remembered for the next visit. */
export const QUALITY = {
  fpsThreshold: 45,         // below this average frames per second we step down
  firstCheckMs: 2000,       // first measurement after 2 s of running...
  checkEveryMs: 5000,       // ...then every 5 s
  pixelRatioDesktop: 2,     // sharpness cap on laptops
  pixelRatioPhone: 1.5,     // sharpness cap on phones
  stepDownPixelRatio: 1,    // level 1 draws at this pixel ratio (or less if the cap is already lower)
  liteStartMemoryGB: 2,     // devices reporting this much memory or less start in "lite"
  liteStartCores: 2,        // ...or this many CPU cores or fewer
  maxLevel: 3,              // 0 = full, 1 = lower resolution, 2 = no fog + shorter view, 3 = lite
  storageKey: 'pb_play_quality',
};

export const STORAGE = {
  best: 'pb_play_best',     // best score on this device (same key the old 2D game used)
  howTo: 'pb_play_howto',   // "How to play" shown once
};

/* Brand colours (navy #011E4A, orange #F5691A) plus a warm golden-hour palette. */
export const COLORS = {
  navy: 0x011e4a,
  orange: 0xf5691a,
  darkOrange: 0xb4470b,
  cream: 0xffd9bd,
  boneCream: 0xfff1d6,
  road: 0x4a4a58,
  roadDash: 0xf1e7d8,
  kerb: 0xcbbfaf,
  pole: 0x5a4a45,
  skyTop: 0x6d7fb8,
  skyMid: 0xf6a96b,
  skyLow: 0xffe2b8,
  sun: 0xffd08a,
  fog: 0xf8d9b5,
  hemiSky: 0xffe6c8,
  hemiGround: 0x8a5a44,
  sunLight: 0xffc27a,
  buildings: [0xf6dccb, 0xf0cdb8, 0xf8e4d6, 0xeac4ad, 0xffd9bd, 0xe6b8a2, 0xf3d6a8, 0xd9c1d6],
  awnings: [0xf5691a, 0x011e4a, 0x2e9e7a, 0xf7c325, 0x3c7dd9, 0xd6457b],
};

/* How "I scored" is worded when sharing. */
export const SHARE = {
  campaign: 'street_zoomies',
  line: (score, metres, bones) => `I ran ${metres} m and grabbed ${bones} ${bones === 1 ? 'bone' : 'bones'} in Street Zoomies with my PAW BUDDY dog (score ${score}). Beat me:`,
};

/** The bucket sent with game_over. Never the exact score. */
export function scoreBucket(score) {
  if (score < 100) return '0-99';
  if (score < 300) return '100-299';
  if (score < 600) return '300-599';
  return '600+';
}
