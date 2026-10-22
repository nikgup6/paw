import {
  BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshLambertMaterial,
} from 'three';
import { COLORS, DOG_BOX } from './config.js';

/* MODELS: every 3D thing in the game is built here from simple boxes and flat discs, in code. No image files, no textures.

   HOW IT WORKS (plain language)
   - A "box" is a cuboid with a colour. We write boxes into a list, then `build()` glues the whole list into ONE
     BufferGeometry with a colour on every corner (vertex colours). One glued shape = one draw call for the graphics card,
     which is what keeps this fast on phones.
   - Each kind of thing (auto, cow, puddle...) is glued ONCE and the geometry is shared by every copy on the street.
   - All shapes share ONE material, so the graphics card never has to switch.

   Everything below that makes a geometry is called only when the game starts, never while it runs. */

const color = new Color();   // scratch colour, reused

/* ----------------------------- the glue: boxes and discs -> one geometry ----------------------------- */

// the six sides of a cube: the way the side faces (n) and two directions across it (u, v), arranged so triangles face outward
const FACES = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];   // which corners of a face, in order
const TRI = [0, 1, 2, 0, 2, 3];

function rotate(v, rx, ry, rz) {
  let [x, y, z] = v;
  if (rx) { const c = Math.cos(rx); const s = Math.sin(rx); [y, z] = [y * c - z * s, y * s + z * c]; }
  if (ry) { const c = Math.cos(ry); const s = Math.sin(ry); [x, z] = [x * c + z * s, -x * s + z * c]; }
  if (rz) { const c = Math.cos(rz); const s = Math.sin(rz); [x, y] = [x * c - y * s, x * s + y * c]; }
  return [x, y, z];
}

export class GeoBuilder {
  constructor() { this.pos = []; this.nrm = []; this.col = []; }

  _vertex(p, n, c) {
    this.pos.push(p[0], p[1], p[2]);
    this.nrm.push(n[0], n[1], n[2]);
    this.col.push(c.r, c.g, c.b);
  }

  /** A box centred at (x, y, z), size w x h x d, colour hex. rx/ry/rz tilt it (radians). */
  box(x, y, z, w, h, d, hex, rx = 0, ry = 0, rz = 0) {
    color.set(hex);
    const half = [w / 2, h / 2, d / 2];
    for (const f of FACES) {
      const n = rotate(f.n, rx, ry, rz);
      for (const i of TRI) {
        const [cu, cv] = CORNERS[i];
        const local = [
          f.n[0] * half[0] + f.u[0] * cu * half[0] + f.v[0] * cv * half[0],
          f.n[1] * half[1] + f.u[1] * cu * half[1] + f.v[1] * cv * half[1],
          f.n[2] * half[2] + f.u[2] * cu * half[2] + f.v[2] * cv * half[2],
        ];
        const r = rotate(local, rx, ry, rz);
        this._vertex([r[0] + x, r[1] + y, r[2] + z], n, color);
      }
    }
    return this;
  }

  /** A flat many-sided disc lying on the ground (a puddle, a pothole). Faces up. */
  disc(x, y, z, rx, rz, hex, segs = 9) {
    color.set(hex);
    const n = [0, 1, 0];
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      this._vertex([x, y, z], n, color);
      this._vertex([x + Math.cos(a0) * rx, y, z - Math.sin(a0) * rz], n, color);
      this._vertex([x + Math.cos(a1) * rx, y, z - Math.sin(a1) * rz], n, color);
    }
    return this;
  }

  build() {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nrm), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    g.computeBoundingSphere();
    return g;
  }
}

/* ----------------------------- one shared material ----------------------------- */

let sharedMaterial = null;
/** The one material every box-built thing uses: colours come from the vertices, lit by the scene lights. */
export function getMaterial() {
  if (!sharedMaterial) sharedMaterial = new MeshLambertMaterial({ vertexColors: true });
  return sharedMaterial;
}

/* ----------------------------- obstacle kinds (match spawner.js numbers) ----------------------------- */

const DARK = 0x17171b;
const WHITE = 0xf4efe8;

function buildAuto() {
  const b = new GeoBuilder();
  // wheels: one at the front (toward the dog, -z), two at the back
  b.box(0, 0.25, -0.85, 0.26, 0.5, 0.5, DARK);
  b.box(-0.72, 0.28, 0.65, 0.24, 0.56, 0.56, DARK);
  b.box(0.72, 0.28, 0.65, 0.24, 0.56, 0.56, DARK);
  // black lower body, yellow hood and cab, black roof (the classic black-and-yellow auto)
  b.box(0, 0.57, 0.1, 1.5, 0.5, 2.2, 0x1d1d22);
  b.box(0, 0.98, -0.78, 0.95, 0.34, 0.7, 0xf7c325);
  b.box(0, 1.21, 0.38, 1.4, 0.78, 1.4, 0xf7c325);
  b.box(0, 1.66, 0.38, 1.5, 0.12, 1.7, 0x1d1d22);
  // windscreen, headlight, side windows
  b.box(0, 1.25, -0.33, 1.1, 0.46, 0.04, 0xbfe3f5);
  b.box(0, 0.76, -1.12, 0.2, 0.14, 0.06, 0xfff3b0);
  b.box(-0.71, 1.25, 0.4, 0.04, 0.4, 0.9, 0x8fb7c8);
  b.box(0.71, 1.25, 0.4, 0.04, 0.4, 0.9, 0x8fb7c8);
  return b.build();
}

function buildCow() {
  const b = new GeoBuilder();
  // standing sideways across the lane, head toward -x (the mesh is flipped at random when placed)
  for (const [x, z] of [[-0.55, -0.22], [-0.55, 0.22], [0.55, -0.22], [0.55, 0.22]]) {
    b.box(x, 0.3, z, 0.16, 0.6, 0.16, WHITE);
    b.box(x, 0.04, z, 0.18, 0.08, 0.18, DARK);       // hooves
  }
  b.box(0, 0.98, 0, 1.5, 0.76, 0.76, WHITE);          // body
  b.box(0.22, 1.12, 0, 0.5, 0.42, 0.79, 0x7a5640);    // patches
  b.box(-0.35, 0.82, 0, 0.4, 0.3, 0.79, 0x7a5640);
  b.box(0.45, 1.34, 0, 0.45, 0.14, 0.4, 0xe9e1d6);    // shoulder hump
  b.box(-0.92, 1.2, 0, 0.42, 0.4, 0.42, WHITE);       // head
  b.box(-1.18, 1.06, 0, 0.2, 0.24, 0.3, 0xf4b9a8);    // muzzle
  b.box(-0.9, 1.5, -0.15, 0.07, 0.22, 0.07, 0xe8d5a8, 0, 0, 0.35);   // horns
  b.box(-0.9, 1.5, 0.15, 0.07, 0.22, 0.07, 0xe8d5a8, 0, 0, 0.35);
  b.box(-1.0, 1.28, -0.22, 0.06, 0.06, 0.04, DARK);   // eyes
  b.box(-1.0, 1.28, 0.22, 0.06, 0.06, 0.04, DARK);
  b.box(-0.78, 1.22, -0.27, 0.2, 0.1, 0.12, 0x7a5640);// ears
  b.box(-0.78, 1.22, 0.27, 0.2, 0.1, 0.12, 0x7a5640);
  b.box(0.8, 0.95, 0, 0.06, 0.55, 0.06, WHITE);       // tail
  b.box(0.8, 0.64, 0, 0.1, 0.12, 0.1, 0x3a2a24);
  return b.build();
}

function buildPuddle() {
  const b = new GeoBuilder();
  b.disc(0, 0.02, 0, 0.88, 0.8, 0x6f8faf, 9);
  b.disc(-0.18, 0.035, 0.1, 0.45, 0.26, 0xa9c4dc, 7);
  return b.build();
}

function buildPothole() {
  const b = new GeoBuilder();
  b.disc(0, 0.02, 0, 0.78, 0.62, 0x7a7a86, 9);
  b.disc(0, 0.035, 0, 0.6, 0.45, 0x23232b, 9);
  return b.build();
}

function buildBar() {
  // hanging cloth line: two poles, a line, and strips of coloured cloth hanging low enough that you must slide under
  const b = new GeoBuilder();
  b.box(-1.05, 0.95, 0, 0.1, 1.9, 0.1, COLORS.pole);
  b.box(1.05, 0.95, 0, 0.1, 1.9, 0.1, COLORS.pole);
  b.box(0, 1.5, 0, 2.15, 0.05, 0.05, 0x2a2024);
  for (let i = 0; i < 6; i++) {
    b.box(-0.84 + i * 0.336, 1.04, 0, 0.3, 0.9, 0.04, COLORS.awnings[i % COLORS.awnings.length]);
  }
  return b.build();
}

function buildBone() {
  const b = new GeoBuilder();
  b.box(0, 0, 0, 0.5, 0.12, 0.12, 0xfff7e3);
  for (const x of [-0.27, 0.27]) for (const y of [-0.07, 0.07]) b.box(x, y, 0, 0.15, 0.15, 0.13, 0xfff7e3);
  return b.build();
}

const KIND_BUILDERS = [null, buildAuto, buildCow, buildPuddle, buildPothole, buildBar];
const geometryCache = new Map();

/** The shared geometry for an obstacle kind (1 = auto ... 5 = bar). Built once. */
export function getObstacleGeometry(kind) {
  if (!geometryCache.has(kind)) geometryCache.set(kind, KIND_BUILDERS[kind]());
  return geometryCache.get(kind);
}

export function getBoneGeometry() {
  if (!geometryCache.has('bone')) geometryCache.set('bone', buildBone());
  return geometryCache.get('bone');
}

/** A new mesh for an obstacle kind, sharing the geometry and material. Used to fill the pool at start. */
export function createObstacleMesh(kind) {
  const m = new Mesh(getObstacleGeometry(kind), getMaterial());
  m.visible = false;
  return m;
}

/* ----------------------------- the dog ----------------------------- */

const ORANGE = COLORS.orange;
const NAVY = COLORS.navy;
const BELLY = COLORS.cream;
const EAR = COLORS.darkOrange;

/** Parts of the dog that never move relative to each other: body, belly, head, snout, nose, eyes, collar. */
function dogStatic(b) {
  b.box(0, 0.56, 0, 0.5, 0.44, 0.86, ORANGE);          // torso
  b.box(0, 0.37, 0.04, 0.46, 0.12, 0.6, BELLY);        // cream belly
  b.box(0, 0.74, 0.34, 0.5, 0.1, 0.14, NAVY);          // navy collar
  b.box(0, 0.88, 0.52, 0.42, 0.4, 0.42, ORANGE);       // head
  b.box(0, 0.8, 0.8, 0.24, 0.18, 0.24, BELLY);         // snout
  b.box(0, 0.85, 0.93, 0.09, 0.08, 0.06, NAVY);        // nose
  b.box(-0.13, 0.94, 0.73, 0.06, 0.07, 0.05, NAVY);    // eyes
  b.box(0.13, 0.94, 0.73, 0.06, 0.07, 0.05, NAVY);
}

/** A leg is built hanging DOWN from its hip, so rotating the leg's group swings it from the hip. */
function legGeometry() {
  const b = new GeoBuilder();
  b.box(0, -0.18, 0, 0.14, 0.36, 0.14, ORANGE);
  b.box(0, -0.4, 0.03, 0.16, 0.08, 0.2, NAVY);         // navy paw
  return b.build();
}

/**
 * Builds the dog. `lite` = one single mesh, no moving parts (for slow phones).
 * Returns { group, legs[4], tail, earL, earR, offsetY } for animateDog().
 */
export function createDog(lite = false) {
  const mat = getMaterial();
  const group = new Group();
  const rig = { group, legs: [], tail: null, earL: null, earR: null, body: null, lite, offsetY: 0, base: DOG_BOX.drawScale };
  group.scale.setScalar(rig.base);

  const sb = new GeoBuilder();
  dogStatic(sb);
  if (lite) {
    // legs fixed in a neutral pose, tail and ears merged in
    for (const [x, z] of [[-0.17, 0.3], [0.17, 0.3], [-0.17, -0.3], [0.17, -0.3]]) {
      sb.box(x, 0.2, z, 0.14, 0.36, 0.14, ORANGE);
      sb.box(x, 0.04, z + 0.03, 0.16, 0.08, 0.2, NAVY);
    }
    sb.box(0, 0.78, -0.55, 0.1, 0.1, 0.4, ORANGE, -0.5);
    sb.box(-0.2, 1.05, 0.45, 0.12, 0.28, 0.1, EAR);
    sb.box(0.2, 1.05, 0.45, 0.12, 0.28, 0.1, EAR);
    rig.body = new Mesh(sb.build(), mat);
    group.add(rig.body);
    return rig;
  }

  rig.body = new Mesh(sb.build(), mat);
  group.add(rig.body);

  const legGeo = legGeometry();
  for (const [x, z] of [[-0.17, 0.3], [0.17, 0.3], [-0.17, -0.3], [0.17, -0.3]]) {
    const pivot = new Group();
    pivot.position.set(x, 0.4, z);
    pivot.add(new Mesh(legGeo, mat));
    group.add(pivot);
    rig.legs.push(pivot);
  }

  const tailGeo = new GeoBuilder().box(0, 0, -0.2, 0.1, 0.1, 0.4, ORANGE).box(0, 0, -0.42, 0.11, 0.11, 0.08, NAVY).build();
  rig.tail = new Group();
  rig.tail.position.set(0, 0.74, -0.42);
  rig.tail.add(new Mesh(tailGeo, mat));
  group.add(rig.tail);

  const earGeo = new GeoBuilder().box(0, -0.12, 0, 0.12, 0.28, 0.1, EAR).build();
  rig.earL = new Group();
  rig.earL.position.set(-0.2, 1.12, 0.45);
  rig.earL.add(new Mesh(earGeo, mat));
  rig.earR = new Group();
  rig.earR.position.set(0.2, 1.12, 0.45);
  rig.earR.add(new Mesh(earGeo, mat));
  group.add(rig.earL, rig.earR);
  return rig;
}

/**
 * Poses the dog for this moment. No allocation: only numbers are changed.
 *   t       running clock (advances with speed)      air  true while jumping
 *   slide   0..1 how far into a slide                 fall 0..1 how far into the game-over tumble
 *   moving  false = standing still (waiting to start): legs rest, only the tail and ears move
 */
export function animateDog(rig, t, air, slide, fall, moving = true) {
  const g = rig.group;
  // the engine adds `offsetY` to the dog's height (running bounce, and a little lift while tumbling)
  rig.offsetY = ((air || fall > 0 || !moving ? 0 : Math.abs(Math.sin(t * 2)) * 0.07) + fall * 0.25) * rig.base;

  if (!rig.lite) {
    const swing = air || !moving ? 0 : Math.sin(t * 2) * 0.95;
    const L = rig.legs;
    L[0].rotation.x = air ? -0.7 : swing;      // front pair reach forward in the air
    L[1].rotation.x = air ? -0.7 : -swing;
    L[2].rotation.x = air ? 0.7 : -swing;      // back pair kick behind
    L[3].rotation.x = air ? 0.7 : swing;
    rig.tail.rotation.y = Math.sin(t * 3.1) * 0.6;
    rig.tail.rotation.x = -0.4;
    rig.earL.rotation.z = 0.15 + Math.sin(t * 2 + 1) * 0.35;
    rig.earR.rotation.z = -0.15 - Math.sin(t * 2 + 1) * 0.35;
  }

  // slide: lower and longer; game over: tip onto one side
  g.scale.y = rig.base * (1 - 0.42 * slide);
  g.rotation.x = slide * 0.12;
  g.rotation.z = fall * 1.3;
}

/** Frees the graphics memory of one dog (used when the quality manager swaps in the simple dog, and at the end). */
export function disposeDog(rig) {
  rig.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}

export function disposeModels() {
  for (const g of geometryCache.values()) g.dispose();
  geometryCache.clear();
  if (sharedMaterial) { sharedMaterial.dispose(); sharedMaterial = null; }
}
