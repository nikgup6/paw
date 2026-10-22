import {
  BackSide, BufferAttribute, CircleGeometry, Color, DirectionalLight, DoubleSide, Fog,
  HemisphereLight, Mesh, MeshBasicMaterial, SphereGeometry,
} from 'three';
import { COLORS, LANES, WORLD } from './config.js';
import { GeoBuilder, getMaterial } from './models.js';

/* WORLD: the street, the sky and the lights.

   THE STREET IS MADE OF TILES. One tile is 24 m of road with the pavements, buildings, poles and wires on both
   sides. We build a handful of different-looking tile SHAPES once (each one a single glued geometry), then keep a
   small pool of tile meshes (7 of them). When the dog runs past a tile, that tile is picked up and set down at the
   far end with a different shape. So the street never ends, nothing is created while playing, and the graphics
   card only draws about 7 things for the whole street.

   QUALITY LEVELS (set by the quality manager in GameEngine.js, never shown to the player)
     0 full        1 lower resolution (handled by the engine)
     2 no fog, shorter view (fewer tiles drawn)        3 lite: simpler buildings, no poles or wires */

const L = WORLD.tileLength;
const ROAD_EDGE = WORLD.roadHalfWidth;
const FRONT = 5.6;            // where the building fronts start, measured from the street centre

/** A small repeatable random number generator, so every tile shape looks the same on every visit. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];

/** One building on one side of the street. side = -1 (left) or +1 (right). z0..z1 is the stretch of road it faces. */
function addBuilding(b, rnd, side, z0, z1, detail) {
  const depthZ = z1 - z0;
  const cz = (z0 + z1) / 2;
  const width = 4.5 + rnd() * 3;
  const floors = 2 + Math.floor(rnd() * 3);
  const height = 3.6 + floors * 2.7;
  const wall = pick(rnd, COLORS.buildings);
  const accent = pick(rnd, COLORS.awnings);
  const cx = side * (FRONT + width / 2);
  b.box(cx, height / 2, cz, width, height, depthZ, wall);
  b.box(cx, height + 0.2, cz, width + 0.3, 0.4, depthZ + 0.3, 0xe2c4ad);       // roof edge

  const face = (p) => side * (FRONT - p / 2);   // x centre of something that sticks out from the street-facing wall by p

  // shop front: dark opening with a stepped "arch" above it, and a striped awning
  b.box(face(0.06), 1.2, cz, 0.06, 2.4, Math.min(2.6, depthZ - 1), 0x3a2a24);
  b.box(face(0.06), 2.6, cz, 0.06, 0.8, Math.min(1.5, depthZ - 2), 0x3a2a24);
  if (detail) {
    const aw = Math.min(depthZ - 0.6, 4.2);
    b.box(face(1.3), 3.15, cz, 1.3, 0.14, aw, accent, 0, 0, side * 0.18);
    for (let i = 0; i < 4; i++) b.box(face(1.31), 3.17, cz - aw / 2 + (i + 0.5) * (aw / 4), 1.3, 0.15, aw / 8, 0xfff1e3, 0, 0, side * 0.18);
    // things for sale: small coloured crates in front of the shop
    b.box(face(0.5), 0.3, cz - 0.7, 0.5, 0.6, 0.7, pick(rnd, COLORS.awnings));
    b.box(face(0.5), 0.25, cz + 0.7, 0.5, 0.5, 0.6, pick(rnd, COLORS.awnings));
    // windows and little balconies on the floors above
    for (let f = 1; f < floors; f++) {
      const wy = 3.9 + f * 2.7 - 2.7 + 1.4;
      const count = Math.max(1, Math.floor(depthZ / 2.4));
      for (let i = 0; i < count; i++) {
        const wz = z0 + (i + 0.5) * (depthZ / count);
        b.box(face(0.08), wy, wz, 0.08, 1.25, 1.0, 0x5a6785);
        b.box(face(0.08), wy - 0.78, wz, 0.5, 0.1, 1.3, 0xefe2d3);      // balcony ledge
      }
    }
    // a little room on the roof
    b.box(cx + side * 0.6, height + 0.4 + 0.7, cz, 1.8, 1.4, 1.8, 0xd9b99f);
  } else {
    b.box(face(0.5), 3.1, cz, 0.5, 0.12, Math.min(depthZ - 0.6, 3.6), accent);
  }
}

/** A whole row of buildings along one side of the tile. */
function addStreetSide(b, rnd, side, detail) {
  let z = 0.3;
  while (z < L - 4) {
    const room = L - z;
    const depth = Math.min(room - 0.3, 6 + rnd() * 5);
    addBuilding(b, rnd, side, z, z + depth, detail);
    z += depth + 0.4 + rnd() * 0.8;
  }
}

function buildTile(seed, lite) {
  const b = new GeoBuilder();
  const rnd = seeded(seed * 9973 + 17);

  // the road, with kerbs and painted lane dashes
  b.box(0, -0.1, L / 2, ROAD_EDGE * 2, 0.2, L, COLORS.road);
  b.box(-ROAD_EDGE - 0.7, 0.09, L / 2, 1.4, 0.18, L, COLORS.kerb);
  b.box(ROAD_EDGE + 0.7, 0.09, L / 2, 1.4, 0.18, L, COLORS.kerb);
  b.box(-ROAD_EDGE + 0.05, 0.12, L / 2, 0.1, 0.1, L, 0x9b8f80);        // kerb edge
  b.box(ROAD_EDGE - 0.05, 0.12, L / 2, 0.1, 0.1, L, 0x9b8f80);
  const boundary = LANES.width / 2;                                    // lane lines sit between lanes
  for (let z = 3; z < L; z += 6) {
    b.box(-boundary, 0.012, z, 0.14, 0.02, 2.6, COLORS.roadDash);
    b.box(boundary, 0.012, z, 0.14, 0.02, 2.6, COLORS.roadDash);
  }
  b.box(-LANES.width * 1.5 - 0.05, 0.012, L / 2, 0.1, 0.02, L, 0xb8b0a3);   // edge lines
  b.box(LANES.width * 1.5 + 0.05, 0.012, L / 2, 0.1, 0.02, L, 0xb8b0a3);

  // buildings on both sides
  addStreetSide(b, rnd, -1, !lite);
  addStreetSide(b, rnd, 1, !lite);

  if (!lite) {
    // taller, plainer buildings behind them (the fog softens them into the distance)
    for (const side of [-1, 1]) {
      let z = 0;
      while (z < L - 3) {
        const depth = Math.min(L - z, 8 + rnd() * 6);
        const h = 12 + rnd() * 9;
        b.box(side * (FRONT + 12), h / 2, z + depth / 2, 8, h, depth, pick(rnd, COLORS.buildings));
        z += depth + 0.6;
      }
    }
    // electric poles with wires (the wires run the whole tile so they join up with the next one)
    for (const side of [-1, 1]) {
      for (const pz of [5, 17]) {
        b.box(side * (ROAD_EDGE + 0.5), 3.1, pz, 0.18, 6.2, 0.18, COLORS.pole);
        b.box(side * (ROAD_EDGE + 0.5), 5.8, pz, 1.7, 0.12, 0.12, COLORS.pole);
      }
      for (const dy of [5.7, 6.1]) {
        b.box(side * (ROAD_EDGE + 0.5), dy, L / 2, 0.035, 0.035, L, 0x2a2024);
      }
    }
    // some tiles get a string of little flags across the street
    if (rnd() < 0.6) {
      const fz = 6 + rnd() * 12;
      b.box(0, 5.6, fz, FRONT * 2, 0.04, 0.04, 0x2a2024);
      for (let i = 0; i < 11; i++) b.box(-FRONT + 0.5 + i * 1.02, 5.38, fz, 0.42, 0.42, 0.03, COLORS.awnings[i % COLORS.awnings.length], 0, 0, Math.PI / 4);
    }
  }
  return b.build();
}

/** The sky: a big upside-down sphere painted from pale gold at the horizon to dusky blue overhead (colours per vertex). */
function buildSky() {
  const g = new SphereGeometry(300, 16, 10);
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const low = new Color(COLORS.skyLow);
  const mid = new Color(COLORS.skyMid);
  const top = new Color(COLORS.skyTop);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i) / 300);
    if (t < 0.25) c.copy(low).lerp(mid, t / 0.25);
    else c.copy(mid).lerp(top, Math.min(1, (t - 0.25) / 0.6));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}

/**
 * Builds the world inside `scene`. `startLevel` 3 builds the simple "lite" tiles from the start.
 * Returns { update(camX, camZ), setLevel(n), dispose() }.
 */
export function createWorld(scene, startLevel = 0) {
  const fog = new Fog(COLORS.fog, WORLD.fogNear, WORLD.fogFar);
  scene.fog = fog;

  const hemi = new HemisphereLight(COLORS.hemiSky, COLORS.hemiGround, 1.6);
  const sun = new DirectionalLight(COLORS.sunLight, 1.9);
  sun.position.set(-7, 11, -9);          // from behind the dog, so the faces you see are the lit ones
  scene.add(hemi, sun);

  // sky dome and the big low sun (not affected by fog or lights)
  const skyGeo = buildSky();
  const skyMat = new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false });
  const sky = new Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -2;
  const sunGeo = new CircleGeometry(20, 24);
  const sunMat = new MeshBasicMaterial({ color: COLORS.sun, fog: false, depthWrite: false, side: DoubleSide });
  const sunDisc = new Mesh(sunGeo, sunMat);
  sunDisc.position.set(40, 34, 230);
  sunDisc.renderOrder = -1;
  const glowGeo = new CircleGeometry(44, 24);
  const glowMat = new MeshBasicMaterial({ color: COLORS.sun, fog: false, depthWrite: false, transparent: true, opacity: 0.28, side: DoubleSide });
  const glow = new Mesh(glowGeo, glowMat);
  glow.position.set(40, 34, 231);
  glow.renderOrder = -1;
  scene.add(sky, sunDisc, glow);

  // tile shapes (full and lite) and the pool of tile meshes
  const fullShapes = [1, 2, 3, 4].map((s) => buildTile(s, false));
  const liteShapes = [5, 6].map((s) => buildTile(s, true));
  const material = getMaterial();
  const tiles = [];
  for (let i = 0; i < WORLD.tilesFull; i++) {
    const mesh = new Mesh(fullShapes[0], material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    tiles.push({ mesh, index: -999 });
  }

  let level = 0;
  let shapes = fullShapes;
  let active = WORLD.tilesFull;

  function setLevel(n) {
    level = n;
    shapes = n >= 3 ? liteShapes : fullShapes;
    active = n >= 2 ? WORLD.tilesReduced : WORLD.tilesFull;
    scene.fog = n >= 2 ? null : fog;
    for (let i = 0; i < tiles.length; i++) tiles[i].index = -999;   // force every tile to pick its shape again
  }
  setLevel(startLevel);

  function update(camX, camZ) {
    sky.position.set(camX, 0, camZ);
    sunDisc.position.x = camX + 40; sunDisc.position.z = camZ + 230;
    glow.position.x = camX + 40; glow.position.z = camZ + 231;

    const first = Math.floor((camZ - 14) / L);
    const n = tiles.length;
    for (let k = 0; k < n; k++) {
      const idx = first + k;
      const slot = tiles[((idx % n) + n) % n];
      if (slot.index !== idx) {
        slot.index = idx;
        slot.mesh.position.z = idx * L;
        slot.mesh.geometry = shapes[((idx % shapes.length) + shapes.length) % shapes.length];
      }
      slot.mesh.visible = k < active;
    }
  }

  function dispose() {
    for (const g of fullShapes) g.dispose();
    for (const g of liteShapes) g.dispose();
    skyGeo.dispose(); skyMat.dispose();
    sunGeo.dispose(); sunMat.dispose();
    glowGeo.dispose(); glowMat.dispose();
    scene.remove(hemi, sun, sky, sunDisc, glow);
    for (const t of tiles) scene.remove(t.mesh);
    scene.fog = null;
  }

  return { update, setLevel, dispose, get level() { return level; } };
}
