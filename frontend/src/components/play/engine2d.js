import { DOG } from '../quiz/DogArt';
import { METRES_PER_STREET } from '../../constants/playGame';

/* "Walk the dog": the rules and the drawing. No React in here, no game library.

   Built to hold 60 fps on a mid-range phone:
   - everything lives in ONE state object made once (createGame) and changed in place
   - obstacles are a fixed pool of MAX_OB slots in typed arrays (nothing is created or thrown away mid-run)
   - the sky, far buildings and shop fronts are painted ONCE into off-screen canvases (buildLayers),
     so a frame is a handful of drawImage calls plus the dog and the obstacles
   - the only strings built while playing are the score text (when the metre number changes) and the street banner

   Units: the world is W x H "logical" pixels; the canvas is scaled to fit. Speeds are logical px per second.
   Every art piece below is original, drawn with canvas paths. To change a look, edit its draw function. */

export const W = 480;
export const H = 270;
export const GROUND = 226;           // y where the dog's feet and the wheels touch the road
export const DOG_X = 78;             // the dog stays at this x; the street scrolls past it
export const PX_PER_M = 24;          // 24 logical px = 1 metre
const DOG_S = 1.3;                   // the dog is drawn a little bigger than its 47 px sprite so it reads well on a phone

const GRAVITY = 2100;
const JUMP_V = -720;                 // about 123 px high, 0.69 s in the air
const START_SPEED = 250;
const MAX_SPEED = 560;
const SPEED_RAMP = 4.5;              // px/s gained every second: slow, so the first minute is fair
const BUFFER_S = 0.12;               // a tap just before landing still counts
const MAX_OB = 6;

// obstacle kinds: 0 puddle, 1 pothole, 2 cow, 3 auto-rickshaw. w/h are the drawn size; inset trims the hit box (forgiving)
const K_W = [54, 46, 62, 66];
const K_H = [8, 6, 44, 46];
const K_INSET = [5, 5, 9, 7];

const NAVY = DOG.line;
const ORANGE = DOG.body;

export const STATE = { READY: 0, RUNNING: 1, OVER: 2 };

export function createGame() {
  return {
    state: STATE.READY,
    dist: 0,              // logical px walked
    time: 0,              // seconds running
    speed: START_SPEED,
    dy: 0,                // dog height above the ground (negative = up)
    vy: 0,
    buffer: 0,            // seconds left on a buffered tap
    runT: 0,              // leg-swing phase
    metres: 0,
    streets: 0,
    scoreStr: '0 m',
    bestStr: '',
    toast: '',
    toastT: 0,
    nextAt: 420,          // distance at which the next obstacle appears
    ox: new Float32Array(MAX_OB),
    ok: new Uint8Array(MAX_OB),
    on: new Uint8Array(MAX_OB),
    layers: null,
    scale: 1,
  };
}

export function resetGame(g) {
  g.state = STATE.READY;
  g.dist = 0; g.time = 0; g.speed = START_SPEED;
  g.dy = 0; g.vy = 0; g.buffer = 0; g.runT = 0;
  g.metres = 0; g.streets = 0; g.scoreStr = '0 m';
  g.toast = ''; g.toastT = 0; g.nextAt = 420;
  for (let i = 0; i < MAX_OB; i++) g.on[i] = 0;
}

export function startGame(g) {
  resetGame(g);
  g.state = STATE.RUNNING;
}

/** A tap / Space / Up. Starting is the screen's job; this only hops (with the small forgiveness windows). */
export function pressJump(g) {
  if (g.state !== STATE.RUNNING) return;
  if (g.dy === 0) {
    g.vy = JUMP_V; g.dy = -0.01; g.buffer = 0;
  } else {
    g.buffer = BUFFER_S;
  }
}

function spawn(g) {
  for (let i = 0; i < MAX_OB; i++) {
    if (!g.on[i]) {
      const r = Math.random();
      g.ok[i] = r < 0.22 ? 0 : r < 0.44 ? 1 : r < 0.72 ? 2 : 3;
      g.ox[i] = W + 24;
      g.on[i] = 1;
      return;
    }
  }
}

/** Moves the world by dt seconds. Sets g.state to OVER on a hit (the screen notices after step()). */
export function step(g, dt) {
  if (g.state !== STATE.RUNNING) return;
  g.time += dt;
  g.speed = Math.min(MAX_SPEED, START_SPEED + SPEED_RAMP * g.time);
  const move = g.speed * dt;
  g.dist += move;
  g.runT += dt * (g.speed / 26);
  if (g.toastT > 0) g.toastT -= dt;

  // the dog
  if (g.dy < 0 || g.vy < 0) {
    g.vy += GRAVITY * dt;
    g.dy += g.vy * dt;
    if (g.dy >= 0) {
      g.dy = 0; g.vy = 0;
      if (g.buffer > 0) { g.vy = JUMP_V; g.dy = -0.01; g.buffer = 0; }
    } else if (g.buffer > 0) {
      g.buffer -= dt;
    }
  }

  // obstacles scroll left; spawn the next one once enough road has gone by
  if (g.dist >= g.nextAt) {
    spawn(g);
    // gap: always enough road to land and hop again, then some random room that shrinks a little as you speed up
    g.nextAt = g.dist + g.speed * 0.95 + 150 + Math.random() * (330 - (g.speed - START_SPEED) * 0.25);
  }

  const feet = GROUND + g.dy;
  const dl = DOG_X + 8 * DOG_S;        // hit box: the body, a little smaller than the drawing (forgiving)
  const dr = DOG_X + 36 * DOG_S;
  const dt0 = feet - 30 * DOG_S;
  for (let i = 0; i < MAX_OB; i++) {
    if (!g.on[i]) continue;
    const k = g.ok[i];
    g.ox[i] -= move;
    const x = g.ox[i];
    if (x + K_W[k] < -10) { g.on[i] = 0; continue; }
    // hit box: trimmed left/right, and as tall as the thing is
    if (dr > x + K_INSET[k] && dl < x + K_W[k] - K_INSET[k] && feet > GROUND - K_H[k] + 2 && dt0 < GROUND) {
      g.state = STATE.OVER;
      return;
    }
  }

  // score + streets
  const m = Math.floor(g.dist / PX_PER_M);
  if (m !== g.metres) {
    g.metres = m;
    g.scoreStr = `${m} m`;
    const s = Math.floor(m / METRES_PER_STREET);
    if (s > g.streets) {
      g.streets = s;
      g.toast = `Street ${s}`;
      g.toastT = 1.5;
    }
  }
}

/* ───────────────────────────── painting ───────────────────────────── */

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// tiny seeded random so the street looks the same every time (no Math.random in the art)
function seeded(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

/** Paints the static sky and the two scrolling backdrops once, at the canvas's real pixel size. */
export function buildLayers(g, scale) {
  g.scale = scale;
  const mk = (w, h, paint) => {
    const c = makeCanvas(w * scale, h * scale);
    const x = c.getContext('2d');
    x.setTransform(scale, 0, 0, scale, 0, 0);
    paint(x);
    return c;
  };

  const back = mk(W, H, (x) => {
    const sky = x.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, '#FFF6EC');
    sky.addColorStop(1, '#FFD9BD');
    x.fillStyle = sky;
    x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(245,105,26,.28)';
    x.beginPath(); x.arc(372, 70, 38, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(245,105,26,.16)';
    x.beginPath(); x.arc(372, 70, 56, 0, Math.PI * 2); x.fill();
  });

  const far = mk(W, 170, (x) => {
    const rnd = seeded(7);
    const cols = ['#F6DCCB', '#F0CDB8', '#EAC4AD', '#F8E4D6'];
    let px = 0;
    let i = 0;
    while (px < W) {
      const bw = Math.min(W - px, 38 + Math.floor(rnd() * 30));
      const bh = 70 + Math.floor(rnd() * 80);
      x.fillStyle = cols[i % cols.length];
      x.fillRect(px, 170 - bh, bw, bh);
      x.fillStyle = 'rgba(255,248,240,.85)';
      for (let wy = 170 - bh + 10; wy < 150; wy += 20) {
        for (let wx = px + 7; wx < px + bw - 9; wx += 14) x.fillRect(wx, wy, 6, 9);
      }
      px += bw; i++;
    }
  });

  const near = mk(W, 112, (x) => {
    const awn = [ORANGE, NAVY, '#FFB27D', '#3C7DD9', '#F7C325', '#2E9E7A'];
    for (let i = 0; i < 6; i++) {
      const sx = i * 80;
      x.fillStyle = i % 2 ? '#FFF1E3' : '#FFE6D2';
      x.fillRect(sx, 8, 80, 104);
      x.fillStyle = 'rgba(1,30,74,.14)';
      x.fillRect(sx, 8, 2, 104);
      // awning with stripes
      x.fillStyle = awn[i];
      x.fillRect(sx + 4, 30, 72, 16);
      x.fillStyle = 'rgba(255,255,255,.38)';
      for (let st = 0; st < 6; st++) x.fillRect(sx + 4 + st * 12 + 6, 30, 6, 16);
      x.fillStyle = awn[i];
      x.beginPath(); x.moveTo(sx + 4, 46); x.lineTo(sx + 76, 46); x.lineTo(sx + 70, 54); x.lineTo(sx + 10, 54); x.closePath(); x.fill();
      // sign board (no lettering: blocks of colour only)
      x.fillStyle = NAVY; x.fillRect(sx + 14, 14, 52, 11);
      x.fillStyle = '#FFD9BD'; x.fillRect(sx + 20, 17, 22, 5); x.fillRect(sx + 46, 17, 14, 5);
      // shop opening + things for sale
      x.fillStyle = '#7A4F37'; x.fillRect(sx + 12, 58, 56, 54);
      x.fillStyle = '#FFE0C2'; x.fillRect(sx + 16, 62, 48, 50);
      x.fillStyle = awn[(i + 2) % 6]; x.fillRect(sx + 20, 82, 14, 14); x.fillRect(sx + 38, 76, 18, 20);
      x.fillStyle = '#F5691A'; x.beginPath(); x.arc(sx + 28, 72, 5, 0, Math.PI * 2); x.fill();
    }
  });

  g.layers = { back, far, near };
}

function dog(ctx, x, feetY, g, standing) {
  const air = g.dy < -0.5;
  const ph = standing ? 0 : g.runT;
  const bob = air || standing ? 0 : -Math.abs(Math.sin(ph * 2)) * 1.6;
  const y = feetY + bob;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(DOG_S, DOG_S);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // tail (wags)
  const wag = standing ? 0 : Math.sin(ph * 2.4) * 3;
  ctx.strokeStyle = NAVY; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(5, -22); ctx.quadraticCurveTo(-4, -30 + wag, -7, -37 + wag); ctx.stroke();
  ctx.strokeStyle = ORANGE; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(5, -22); ctx.quadraticCurveTo(-4, -30 + wag, -7, -37 + wag); ctx.stroke();
  // legs: far pair then near pair, swinging opposite
  let a1 = 0, a2 = 0;
  if (air) { a1 = 9; a2 = -9; } else if (!standing) { a1 = Math.sin(ph) * 9; a2 = -a1; }
  ctx.strokeStyle = DOG.ear; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(10, -12); ctx.lineTo(10 - a1 * 0.9, -(air ? 5 : 0.5)); ctx.moveTo(30, -12); ctx.lineTo(30 + a2 * 0.9, -(air ? 5 : 0.5)); ctx.stroke();
  ctx.strokeStyle = NAVY; ctx.lineWidth = 6.5;
  ctx.beginPath(); ctx.moveTo(14, -12); ctx.lineTo(14 + a1, -(air ? 4 : 0.5)); ctx.moveTo(26, -12); ctx.lineTo(26 - a2, -(air ? 4 : 0.5)); ctx.stroke();
  ctx.strokeStyle = ORANGE; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(14, -12); ctx.lineTo(14 + a1, -(air ? 4 : 0.5)); ctx.moveTo(26, -12); ctx.lineTo(26 - a2, -(air ? 4 : 0.5)); ctx.stroke();
  // body
  ctx.fillStyle = ORANGE; ctx.strokeStyle = NAVY; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.ellipse(20, -18, 17, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = DOG.belly;
  ctx.beginPath(); ctx.ellipse(22, -13, 9, 4.6, 0, 0, Math.PI * 2); ctx.fill();
  // head
  ctx.fillStyle = ORANGE; ctx.strokeStyle = NAVY;
  ctx.beginPath(); ctx.arc(34, -27, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = DOG.belly;
  ctx.beginPath(); ctx.ellipse(41, -24, 5.4, 4.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = NAVY;
  ctx.beginPath(); ctx.arc(44.5, -25, 1.9, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(35, -29, 1.7, 0, Math.PI * 2); ctx.fill();
  // ear (flaps a little)
  ctx.fillStyle = DOG.ear; ctx.strokeStyle = NAVY; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.ellipse(29, -29 + (air ? -2 : 0), 3.8, 7, 0.35 + (standing ? 0 : Math.sin(ph * 2) * 0.12), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // tongue
  if (!standing) {
    ctx.fillStyle = DOG.tongue;
    ctx.beginPath(); ctx.ellipse(41, -19 + Math.sin(ph * 2) * 0.6, 1.9, 3.2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function puddle(ctx, x) {
  ctx.fillStyle = '#7FAEE3';
  ctx.beginPath(); ctx.ellipse(x + 27, GROUND - 1, 27, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#C6DDF6';
  ctx.beginPath(); ctx.ellipse(x + 21, GROUND - 2.5, 11, 1.8, 0, 0, Math.PI * 2); ctx.fill();
}

function pothole(ctx, x) {
  ctx.fillStyle = '#8B8794';
  ctx.beginPath(); ctx.ellipse(x + 23, GROUND, 23, 4.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2B2A33';
  ctx.beginPath(); ctx.ellipse(x + 23, GROUND + 0.8, 18, 3.2, 0, 0, Math.PI * 2); ctx.fill();
}

function cow(ctx, x, t) {
  const y = GROUND - 44;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // legs
  ctx.strokeStyle = NAVY; ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x + 22, y + 32); ctx.lineTo(x + 22, y + 43);
  ctx.moveTo(x + 30, y + 33); ctx.lineTo(x + 30, y + 43);
  ctx.moveTo(x + 46, y + 33); ctx.lineTo(x + 46, y + 43);
  ctx.moveTo(x + 54, y + 32); ctx.lineTo(x + 54, y + 43);
  ctx.stroke();
  // tail
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(x + 59, y + 14); ctx.quadraticCurveTo(x + 64, y + 22, x + 60, y + 32); ctx.stroke();
  ctx.fillStyle = NAVY; ctx.beginPath(); ctx.arc(x + 60, y + 33, 2.4, 0, Math.PI * 2); ctx.fill();
  // body
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = NAVY; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.ellipse(x + 38, y + 22, 22, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7A5640';
  ctx.beginPath(); ctx.ellipse(x + 33, y + 18, 7, 5, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 49, y + 27, 6, 4, 0.3, 0, Math.PI * 2); ctx.fill();
  // head (faces left, chewing)
  const chew = Math.sin(t * 5) * 0.8;
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = NAVY;
  ctx.beginPath(); ctx.ellipse(x + 12, y + 17, 11, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#F4B9A8';
  ctx.beginPath(); ctx.ellipse(x + 5, y + 21 + chew, 6.4, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // horns
  ctx.strokeStyle = '#E8D5A8'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x + 11, y + 9); ctx.quadraticCurveTo(x + 7, y + 2, x + 3, y + 3); ctx.moveTo(x + 18, y + 9); ctx.quadraticCurveTo(x + 22, y + 2, x + 26, y + 4); ctx.stroke();
  ctx.fillStyle = NAVY;
  ctx.beginPath(); ctx.arc(x + 11, y + 14, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7A5640';
  ctx.beginPath(); ctx.ellipse(x + 19, y + 15, 3, 5, 0.4, 0, Math.PI * 2); ctx.fill();
}

function rickshaw(ctx, x, roll) {
  const y = GROUND - 46;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // body: black lower, yellow cab, black roof (the classic "kaali-peeli")
  ctx.fillStyle = '#1D1D22'; ctx.strokeStyle = NAVY; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 12, y + 38); ctx.lineTo(x + 12, y + 24); ctx.lineTo(x + 64, y + 22); ctx.lineTo(x + 64, y + 38); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#F7C325';
  ctx.beginPath(); ctx.moveTo(x + 14, y + 24); ctx.lineTo(x + 22, y + 8); ctx.lineTo(x + 62, y + 6); ctx.lineTo(x + 64, y + 24); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1D1D22'; ctx.fillRect(x + 19, y + 2, 46, 6);
  ctx.fillStyle = '#BFE3F5';
  ctx.beginPath(); ctx.moveTo(x + 17, y + 23); ctx.lineTo(x + 24, y + 11); ctx.lineTo(x + 33, y + 11); ctx.lineTo(x + 33, y + 23); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8A5A33'; ctx.fillRect(x + 40, y + 12, 18, 10);
  ctx.fillStyle = '#FFF3B0'; ctx.beginPath(); ctx.arc(x + 12, y + 29, 2.6, 0, Math.PI * 2); ctx.fill();
  // wheels
  for (let i = 0; i < 2; i++) {
    const wx = i ? x + 52 : x + 10;
    const wy = GROUND - (i ? 8 : 7);
    const r = i ? 8 : 7;
    ctx.fillStyle = '#17171B'; ctx.beginPath(); ctx.arc(wx, wy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9A9AA5'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(wx + Math.cos(roll) * (r - 2), wy + Math.sin(roll) * (r - 2)); ctx.lineTo(wx - Math.cos(roll) * (r - 2), wy - Math.sin(roll) * (r - 2)); ctx.stroke();
  }
}

/** One frame. `standing` draws the still pose (used before the start and for reduced motion). */
export function draw(ctx, g, standing) {
  const s = g.scale;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  const L = g.layers;

  ctx.drawImage(L.back, 0, 0, W, H);

  // far buildings (slow) and shop fronts (medium): each is two copies side by side, so the street never ends
  const fo = (g.dist * 0.1) % W;
  ctx.drawImage(L.far, -fo, GROUND - 4 - 170 - 26, W, 170);
  ctx.drawImage(L.far, W - fo, GROUND - 4 - 170 - 26, W, 170);
  const no = (g.dist * 0.42) % W;
  ctx.drawImage(L.near, -no, GROUND - 4 - 104, W, 112);
  ctx.drawImage(L.near, W - no, GROUND - 4 - 104, W, 112);

  // road + pavement edge + moving dashes
  ctx.fillStyle = '#5B5B66'; ctx.fillRect(0, GROUND - 4, W, H - GROUND + 4);
  ctx.fillStyle = '#C9BFB4'; ctx.fillRect(0, GROUND - 4, W, 4);
  ctx.fillStyle = '#F1E7D8';
  const dash = (g.dist * 1) % 60;
  for (let x = -dash; x < W; x += 60) ctx.fillRect(x, GROUND + 26, 30, 4);

  // obstacles
  for (let i = 0; i < MAX_OB; i++) {
    if (!g.on[i]) continue;
    const k = g.ok[i];
    const x = g.ox[i];
    if (k === 0) puddle(ctx, x);
    else if (k === 1) pothole(ctx, x);
    else if (k === 2) cow(ctx, x, g.time);
    else rickshaw(ctx, x, g.dist * 0.18);
  }

  dog(ctx, DOG_X, GROUND + g.dy, g, standing);

  // score + street banner
  ctx.font = "700 20px 'Fredoka', sans-serif";
  ctx.textAlign = 'right'; ctx.textBaseline = 'top';
  ctx.fillStyle = NAVY;
  ctx.fillText(g.scoreStr, W - 14, 10);
  if (g.bestStr) {
    ctx.font = "600 12px 'Satoshi', sans-serif";
    ctx.fillStyle = 'rgba(1,30,74,.62)';
    ctx.fillText(g.bestStr, W - 14, 34);
  }
  if (g.toastT > 0) {
    ctx.font = "700 22px 'Fredoka', sans-serif";
    ctx.textAlign = 'center';
    ctx.globalAlpha = g.toastT > 0.4 ? 1 : g.toastT / 0.4;
    ctx.fillStyle = ORANGE;
    ctx.fillText(g.toast, W / 2, 46);
    ctx.globalAlpha = 1;
  }
}
