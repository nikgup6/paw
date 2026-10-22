import {
  InstancedMesh, Matrix4, Object3D, PerspectiveCamera, Scene, WebGLRenderer,
} from 'three';
import {
  CAMERA, COLORS, DOG_BOX, LANES, MOVES, OBSTACLES, QUALITY, RUN, SPAWN, TIMING,
} from './config.js';
import { Input } from './input.js';
import { BAR, COW, Spawner, selfCheck, speedAt } from './spawner.js';
import { createWorld } from './world.js';
import {
  animateDog, createDog, createObstacleMesh, disposeDog, disposeModels, getBoneGeometry, getMaterial,
} from './models.js';

/* GAME ENGINE: the renderer, the game loop, the rules, and the clean-up. Plain JavaScript, no React inside.

   HOW A FRAME WORKS
   1. The game LOGIC always moves forward in tiny fixed steps of 1/60 s (TIMING.step), however fast or slow the screen
      is drawing. That keeps the game speed the same on a 60 Hz phone, a 144 Hz laptop and a struggling old phone.
      A very long frame (you switched tabs) is cut short (TIMING.maxFrameDelta) so the dog never teleports.
   2. Then we DRAW once, blending between the last two logic steps so motion stays smooth on fast screens.
   3. The on-screen numbers (score, bones) are sent to React at most 10 times a second, not every frame.

   NOTHING IS CREATED WHILE PLAYING. Obstacles, bones and street tiles are made once at the start and recycled.
   `new Vector3`, `new Mesh` or fresh arrays inside the loop would make the browser stop to clean up (stutter).

   THE QUALITY MANAGER measures the frame rate and, if it is too low, quietly steps the picture down (see QUALITY in
   config.js). It never steps back up in the same run, and remembers the level for the next visit.

   PHASES: 'ready' (waiting to start), 'running', 'paused', 'over', 'lost' (the graphics context was taken away, e.g. the
   phone switched apps), 'resume' (it came back, waiting for a tap). The screen overlays (Hud.jsx) follow `onPhase`. */

const STEP = TIMING.step;
const GRAVITY = (8 * MOVES.jumpHeight) / (MOVES.jumpSeconds * MOVES.jumpSeconds);   // makes the jump exactly this high and long
const JUMP_SPEED = (4 * MOVES.jumpHeight) / MOVES.jumpSeconds;
const LANE_SPEED = LANES.width / (LANES.changeMs / 1000);                           // sideways speed during a lane change

const KIND = [null, OBSTACLES.auto, OBSTACLES.cow, OBSTACLES.puddle, OBSTACLES.pothole, OBSTACLES.bar];
const POOL_SIZE = [0, 12, 12, 12, 12, 10];
const MAX_OBSTACLES = 44;
const MAX_BONES = 160;
const OVER_LOCK_MS = 600;        // after game over, Space/Enter/tap are ignored this long so a panicked double press doesn't restart

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function readStoredLevel() {
  try {
    const n = parseInt(window.localStorage.getItem(QUALITY.storageKey) || '0', 10);
    return clamp(Number.isFinite(n) ? n : 0, 0, QUALITY.maxLevel);
  } catch { return 0; }
}
function writeLevel(n) {
  try { window.localStorage.setItem(QUALITY.storageKey, String(n)); } catch { /* not remembered */ }
}
/** Phones with little memory or very few cores start in "lite" straight away. */
function lowEndLevel() {
  const mem = navigator.deviceMemory;
  const cores = navigator.hardwareConcurrency;
  return (mem && mem <= QUALITY.liteStartMemoryGB) || (cores && cores <= QUALITY.liteStartCores) ? QUALITY.maxLevel : 0;
}
const isPhone = () => {
  try { return window.matchMedia('(pointer: coarse)').matches || Math.min(window.screen.width, window.screen.height) < 700; } catch { return false; }
};

let selfCheckDone = false;

export class GameEngine {
  /**
   * @param container  an element (it gets one <canvas> appended)
   * @param cb         { onPhase(phase), onHud(hud), onEvent(name), onOver(result), onError(reason, error) }
   * @param opts       { inputEl }: the element that listens for taps and swipes (default: `container`). The screen passes the
   *                   whole game box so the buttons and cards on top of the canvas still count as "the game area".
   * Throws an Error with `.reason` ('no_webgl' or 'context_failed') if the browser cannot make a 3D view.
   */
  constructor(container, cb, opts = {}) {
    this.container = container;
    this.cb = cb;
    this.disposed = false;
    this.phase = 'ready';
    this.level = Math.max(readStoredLevel(), lowEndLevel());
    this.phone = isPhone();

    // ---- the 3D view ----
    try {
      this.renderer = new WebGLRenderer({
        antialias: this.level < QUALITY.maxLevel,   // lite mode draws without antialiasing
        alpha: false,
        stencil: false,
        powerPreference: 'high-performance',
      });
    } catch (e) {
      const err = new Error(String(e && e.message ? e.message : e));
      err.reason = /webgl/i.test(err.message) ? 'no_webgl' : 'context_failed';
      throw err;
    }
    const canvas = this.renderer.domElement;
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Street Zoomies game: an orange dog running down a busy street');
    container.appendChild(canvas);
    this.canvas = canvas;
    this.renderer.setClearColor(COLORS.fog);

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(CAMERA.fov, 1, 0.1, 400);
    this.world = createWorld(this.scene, this.level);
    this.dog = createDog(this.level >= QUALITY.maxLevel);
    this.scene.add(this.dog.group);

    // ---- pools: made once, reused for the whole session ----
    this.obsPool = POOL_SIZE.map((n, kind) => {
      const list = [];
      for (let i = 0; i < n; i++) { const m = createObstacleMesh(kind); this.scene.add(m); list.push(m); }
      return list;
    });
    this.obsFree = POOL_SIZE.map((n) => { const a = new Int16Array(n); for (let i = 0; i < n; i++) a[i] = i; return a; });
    this.obsFreeCount = POOL_SIZE.slice();
    this.obs = [];
    for (let i = 0; i < MAX_OBSTACLES; i++) this.obs.push({ on: false, kind: 0, x: 0, z: 0, slot: 0 });

    this.boneMesh = new InstancedMesh(getBoneGeometry(), getMaterial(), MAX_BONES);
    this.boneMesh.frustumCulled = false;
    this.scene.add(this.boneMesh);
    this.boneOn = new Uint8Array(MAX_BONES);
    this.boneX = new Float32Array(MAX_BONES);
    this.boneY = new Float32Array(MAX_BONES);
    this.boneZ = new Float32Array(MAX_BONES);
    this.dummy = new Object3D();
    this.zero = new Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX_BONES; i++) this.boneMesh.setMatrixAt(i, this.zero);

    // ---- game state (one object, changed in place) ----
    this.s = {
      dist: 0, prevDist: 0, x: 0, prevX: 0, y: 0, prevY: 0, vy: 0, lane: 1,
      airborne: false, slideT: 0, jumpBuf: 0, slideBuf: 0,
      speed: RUN.startSpeed, runT: 0, idleT: 0, time: 0, fall: 0,
      bones: 0, metres: 0, score: 0, camX: 0, bobT: 0,
    };
    this.spawner = new Spawner();
    this.hud = { phase: 'ready', metres: 0, bones: 0, score: 0, speed: 0 };
    this.emitObstacle = this._emitObstacle.bind(this);   // bound once, so the loop never creates a function
    this.emitBone = this._emitBone.bind(this);
    this.god = false;                                    // dev only: ignore collisions (set from the console while testing)

    // ---- timing and quality ----
    this.raf = 0;
    this.last = 0;
    this.acc = 0;
    this.lastHud = 0;
    this.overAt = 0;
    this.q = { frames: 0, ms: 0, nextAt: 0 };
    this._frame = this._frame.bind(this);

    // ---- input and listeners (every one is removed again in dispose()) ----
    this.input = new Input({
      /* Why these look backwards: the camera sits BEHIND the dog and looks along +Z
         (position z - behind, lookAt z + ahead). A three.js camera looks down its own -Z,
         so with up = +Y the world's +X axis ends up on the LEFT of the screen. Lane x is
         (lane - 1) * width, so lane 2 draws on the left and lane 0 on the right. Pressing
         Right therefore has to DECREASE the lane index to move the dog right on screen.
         Obstacles and bones are placed by the same lane index, so the whole world stays
         consistent — only the player's sense of direction was wrong. */
      left: () => this._lane(1),
      right: () => this._lane(-1),
      jump: (code) => this._jump(code),
      slide: () => this._slide(),
      pause: () => this.togglePause(),
      confirm: () => this._confirm(),
      tap: () => this._tap(),
    });
    this.input.attach(opts.inputEl || container);
    this.onVisibility = () => { if (document.hidden) this._hidden(); else this._visible(); };
    this.onBlur = () => this._autoPause();
    this.onOrientation = () => this._resize();
    this.onContextLost = (e) => { e.preventDefault(); this._contextLost(); };
    this.onContextRestored = () => this._contextRestored();
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('orientationchange', this.onOrientation);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    this.resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this._resize()) : null;
    if (this.resizeObserver) this.resizeObserver.observe(container);
    else window.addEventListener('resize', this.onOrientation);

    this.reset();
    this._applyLevel(this.level, true);
    this._resize();

    if (import.meta.env.DEV) {
      // Development only: the fairness self-check from the brief, plus a handle for testing from the console.
      if (!selfCheckDone) {
        selfCheckDone = true;
        const r = selfCheck(10000);
        console.info('[zoomies] fairness self-check (10,000 rows):', r.ok ? 'PASSED' : 'FAILED', r);
        if (!r.ok) console.error('[zoomies] there is a row with no safe path', r.firstFailure);
      }
      window.__zoomies = this;
    }

    this._startLoop();
  }

  /* ───────────────────────── public controls ───────────────────────── */

  /** Start a run (from the start screen or after game over). */
  start() {
    if (this.disposed || this.phase === 'running') return;
    this.reset();
    this._setPhase('running');
    this.input.engage();
    this.q.frames = 0; this.q.ms = 0; this.q.nextAt = 0;
    this.cb.onEvent && this.cb.onEvent('start');
    this._startLoop();
  }

  restart() { this.start(); }

  pause() {
    if (this.phase !== 'running') return;
    this._setPhase('paused');
    this._stopLoop();
    this._emitHud(true);
  }

  resume() {
    if (this.phase !== 'paused' && this.phase !== 'resume') return;
    if (this.contextIsLost) return;
    this._setPhase('running');
    this.q.nextAt = 0;
    this._startLoop();
  }

  togglePause() {
    if (this.phase === 'running') this.pause();
    else if (this.phase === 'paused' || this.phase === 'resume') this.resume();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this._stopLoop();
    this.input.detach();
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('orientationchange', this.onOrientation);
    window.removeEventListener('resize', this.onOrientation);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    // free every piece of graphics-card memory we made
    this.world.dispose();
    this.boneMesh.dispose();
    disposeDog(this.dog);
    disposeModels();
    this.renderer.dispose();
    try { this.renderer.forceContextLoss(); } catch { /* already gone */ }
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.scene.clear();
    if (import.meta.env.DEV && window.__zoomies === this) delete window.__zoomies;
    this.cb = {};
  }

  /* ───────────────────────── setup helpers ───────────────────────── */

  reset() {
    const s = this.s;
    s.dist = s.prevDist = 0; s.x = s.prevX = 0; s.y = s.prevY = 0; s.vy = 0; s.lane = 1;
    s.airborne = false; s.slideT = 0; s.jumpBuf = 0; s.slideBuf = 0;
    s.speed = RUN.startSpeed; s.runT = 0; s.time = 0; s.fall = 0;
    s.bones = 0; s.metres = 0; s.score = 0; s.camX = 0;
    for (let i = 0; i < this.obs.length; i++) this._freeObstacle(this.obs[i]);
    for (let i = 0; i < MAX_BONES; i++) if (this.boneOn[i]) { this.boneOn[i] = 0; this.boneMesh.setMatrixAt(i, this.zero); }
    this.boneMesh.instanceMatrix.needsUpdate = true;
    this.spawner.reset(45);
    this.spawner.fill(0, this.emitObstacle, this.emitBone);
    this.acc = 0;
    this._emitHud(true);
  }

  _setPhase(p) {
    this.phase = p;
    this.hud.phase = p;
    if (this.cb.onPhase) this.cb.onPhase(p);
  }

  _resize() {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    const cap = this.phone ? QUALITY.pixelRatioPhone : QUALITY.pixelRatioDesktop;
    let pr = Math.min(window.devicePixelRatio || 1, cap);
    if (this.level >= 1) pr = Math.min(pr, QUALITY.stepDownPixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);                // false = keep the canvas sized by CSS (100% of its box)
    const aspect = w / h;
    this.camera.aspect = aspect;
    // On a tall, narrow phone screen the normal view would crop the side lanes, so widen it until all three fit.
    let fov = CAMERA.fov;
    if (aspect < 1) {
      const wide = (2 * Math.atan(Math.tan((CAMERA.minHorizontalFov * Math.PI) / 360) / aspect) * 180) / Math.PI;
      fov = Math.min(105, Math.max(fov, wide));
    }
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    if (this.phase !== 'running') this._renderOnce();
  }

  /** Steps the picture quality up to `n` (lower numbers are better looking). Never called with a smaller number than before. */
  _applyLevel(n, silent = false) {
    this.level = n;
    this.world.setLevel(n);
    if (n >= QUALITY.maxLevel && !this.dog.lite) {
      this.scene.remove(this.dog.group);
      disposeDog(this.dog);
      this.dog = createDog(true);
      this.scene.add(this.dog.group);
    }
    if (!silent) { writeLevel(n); this._resize(); }
  }

  /* ───────────────────────── the loop ───────────────────────── */

  _startLoop() {
    if (this.raf || this.disposed || this.contextIsLost || document.hidden) return;
    this.last = 0;
    this.raf = requestAnimationFrame(this._frame);
  }

  _stopLoop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  _frame(now) {
    this.raf = 0;
    if (this.disposed) return;
    try {
      let dt = this.last ? (now - this.last) / 1000 : 0;
      this.last = now;
      if (dt > TIMING.maxFrameDelta) dt = TIMING.maxFrameDelta;

      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < TIMING.maxStepsPerFrame) { this._step(STEP); this.acc -= STEP; steps++; }
      if (steps === TIMING.maxStepsPerFrame) this.acc = 0;     // we are far behind: drop the rest instead of spiralling

      this._render(this.acc / STEP, dt);

      if (this.phase === 'running') {
        this._measure(now, dt);
        if (now - this.lastHud >= TIMING.hudEveryMs) { this.lastHud = now; this._emitHud(false); }
      }
      // keep drawing while waiting / running / tumbling; stop once the tumble is over (nothing is moving)
      const settled = this.phase === 'over' && this.s.fall >= 1;
      if (!settled && (this.phase === 'running' || this.phase === 'ready' || this.phase === 'over')) {
        this.raf = requestAnimationFrame(this._frame);
      }
    } catch (err) {
      this._fail(err);
    }
  }

  _fail(err) {
    this._stopLoop();
    if (import.meta.env.DEV) console.error('[zoomies] runtime error', err);
    if (this.cb.onError) this.cb.onError('runtime_error', err);
  }

  _renderOnce() {
    if (this.disposed || this.contextIsLost) return;
    try { this._render(0, 0); } catch (err) { this._fail(err); }
  }

  /** The quality manager: average frame time over the first 2 s of a run, then every 5 s. */
  _measure(now, dt) {
    const q = this.q;
    if (dt <= 0 || dt > 0.25) return;                    // ignore the odd huge frame (a tab switch)
    if (!q.nextAt) { q.nextAt = now + QUALITY.firstCheckMs; q.frames = 0; q.ms = 0; return; }
    q.frames++; q.ms += dt * 1000;
    if (now < q.nextAt) return;
    const fps = q.frames ? 1000 / (q.ms / q.frames) : 60;
    q.nextAt = now + QUALITY.checkEveryMs;
    q.frames = 0; q.ms = 0;
    this.lastFps = fps;
    if (fps < QUALITY.fpsThreshold && this.level < QUALITY.maxLevel) this._applyLevel(this.level + 1);
  }

  /* ───────────────────────── the rules (one fixed step) ───────────────────────── */

  _step(dt) {
    const s = this.s;
    s.prevDist = s.dist; s.prevX = s.x; s.prevY = s.y;

    if (this.phase === 'over') { if (s.fall < 1) s.fall = Math.min(1, s.fall + dt / 0.45); return; }
    if (this.phase !== 'running') { s.idleT += dt; return; }

    s.time += dt;
    s.speed = speedAt(s.dist);
    s.dist += s.speed * dt;
    s.runT += dt * s.speed * 0.9;          // legs move faster the faster the dog runs

    // sideways: slide toward the lane we want, at a fixed speed (so a lane change takes about 135 ms)
    const targetX = (s.lane - 1) * LANES.width;
    const dx = targetX - s.x;
    const move = LANE_SPEED * dt;
    s.x += dx > move ? move : dx < -move ? -move : dx;

    // up and down
    if (s.airborne) {
      s.vy -= GRAVITY * dt;
      s.y += s.vy * dt;
      if (s.jumpBuf > 0) s.jumpBuf -= dt;
      if (s.y <= 0) {                       // landed
        s.y = 0; s.vy = 0; s.airborne = false;
        if (s.jumpBuf > 0) { s.jumpBuf = 0; this._startJump(); }
        else if (s.slideBuf > 0) { s.slideBuf = 0; s.slideT = MOVES.slideSeconds; }
      }
      if (s.slideBuf > 0) s.slideBuf -= dt;
    }
    if (s.slideT > 0) s.slideT -= dt;

    // the street ahead
    this.spawner.fill(s.dist, this.emitObstacle, this.emitBone);

    // obstacles: recycle the ones behind us, test the ones we are touching
    const standing = s.slideT > 0 ? DOG_BOX.slideHeight : DOG_BOX.standHeight;
    for (let i = 0; i < MAX_OBSTACLES; i++) {
      const o = this.obs[i];
      if (!o.on) continue;
      if (o.z < s.dist - 14) { this._freeObstacle(o); continue; }
      if (this.god) continue;
      const k = KIND[o.kind];
      const dz = o.z - s.dist;
      if (dz > k.halfDepth + DOG_BOX.halfDepth || dz < -(k.halfDepth + DOG_BOX.halfDepth)) continue;
      const ox = o.x - s.x;
      if (ox > k.halfWidth + DOG_BOX.halfWidth || ox < -(k.halfWidth + DOG_BOX.halfWidth)) continue;
      const feet = s.y;
      let hit;
      if (k.flat) hit = feet < OBSTACLES.flatHurtHeight;                 // puddle / pothole: only if the feet are on the road
      else if (o.kind === BAR) hit = feet + standing > k.y0 && feet < k.y1;
      else hit = feet < k.height;                                         // auto / cow: too tall to jump
      if (hit) { this._crash(); return; }
    }

    // bones
    for (let i = 0; i < MAX_BONES; i++) {
      if (!this.boneOn[i]) continue;
      const bz = this.boneZ[i];
      if (bz < s.dist - 12) { this._freeBone(i); continue; }
      const dz = bz - s.dist;
      if (dz > 0.7 || dz < -0.7) continue;
      const dx = this.boneX[i] - s.x;
      if (dx > 0.75 || dx < -0.75) continue;
      const dy = this.boneY[i] - (s.y + 0.5);
      if (dy > 0.8 || dy < -0.8) continue;
      this._freeBone(i);
      s.bones++;
      if (this.cb.onEvent) this.cb.onEvent('pickup');
    }

    s.metres = s.dist | 0;
    s.score = s.metres + s.bones * RUN.boneValue;
  }

  _crash() {
    const s = this.s;
    this.overAt = performance.now();
    s.metres = s.dist | 0;
    s.score = s.metres + s.bones * RUN.boneValue;
    this._setPhase('over');
    this._emitHud(true);
    if (this.cb.onEvent) this.cb.onEvent('crash');
    if (this.cb.onOver) this.cb.onOver({ metres: s.metres, bones: s.bones, score: s.score });
  }

  /* ───────────────────────── player actions ───────────────────────── */

  _lane(dir) {
    if (this.phase !== 'running') return;
    this.s.lane = clamp(this.s.lane + dir, 0, LANES.count - 1);
  }

  _startJump() {
    const s = this.s;
    s.airborne = true; s.vy = JUMP_SPEED; s.y = 0.001; s.slideT = 0;
    if (this.cb.onEvent) this.cb.onEvent('jump');
  }

  _jump(code) {
    const p = this.phase;
    if (p === 'ready') { this.start(); return; }
    if (p === 'over') { if (code === 'Space') this._confirm(); return; }
    if (p === 'paused' || p === 'resume') return;
    if (p !== 'running') return;
    const s = this.s;
    if (!s.airborne) this._startJump();
    else s.jumpBuf = MOVES.bufferSeconds;               // pressed a moment early: jump again as soon as we land
  }

  _slide() {
    if (this.phase !== 'running') return;
    const s = this.s;
    if (!s.airborne) { s.slideT = MOVES.slideSeconds; }
    else {
      s.vy = Math.min(s.vy, -MOVES.fastFall);          // drop quickly, then slide on landing
      s.slideBuf = MOVES.bufferSeconds + 0.2;
    }
  }

  _confirm() {
    const p = this.phase;
    if (p === 'ready') this.start();
    else if (p === 'over') { if (performance.now() - this.overAt > OVER_LOCK_MS) this.start(); }
    else if (p === 'paused' || p === 'resume') this.resume();
  }

  _tap() {
    const p = this.phase;
    if (p === 'ready' || p === 'paused' || p === 'resume') this._confirm();
  }

  /* ───────────────────────── pools ───────────────────────── */

  _emitObstacle(kind, lane, z) {
    let o = null;
    for (let i = 0; i < MAX_OBSTACLES; i++) if (!this.obs[i].on) { o = this.obs[i]; break; }
    if (!o || this.obsFreeCount[kind] === 0) return;              // pool full: skip (the street just gets a bit emptier)
    const slot = this.obsFree[kind][--this.obsFreeCount[kind]];
    o.on = true; o.kind = kind; o.slot = slot; o.z = z; o.x = (lane - 1) * LANES.width;
    const m = this.obsPool[kind][slot];
    m.position.set(o.x, 0, z);
    m.rotation.y = kind === COW && ((z * 7) | 0) % 2 ? Math.PI : 0;   // cows face either way
    m.visible = true;
  }

  _freeObstacle(o) {
    if (!o.on) return;
    o.on = false;
    this.obsPool[o.kind][o.slot].visible = false;
    this.obsFree[o.kind][this.obsFreeCount[o.kind]++] = o.slot;
  }

  _emitBone(lane, z, y) {
    for (let i = 0; i < MAX_BONES; i++) {
      if (this.boneOn[i]) continue;
      this.boneOn[i] = 1; this.boneX[i] = (lane - 1) * LANES.width; this.boneY[i] = y; this.boneZ[i] = z;
      return;
    }
  }

  _freeBone(i) {
    this.boneOn[i] = 0;
    this.boneMesh.setMatrixAt(i, this.zero);
  }

  /* ───────────────────────── drawing ───────────────────────── */

  _render(alpha, frameDt) {
    const s = this.s;
    const z = s.prevDist + (s.dist - s.prevDist) * alpha;
    const x = s.prevX + (s.x - s.prevX) * alpha;
    const y = s.prevY + (s.y - s.prevY) * alpha;
    const running = this.phase === 'running';

    // the dog
    const rig = this.dog;
    animateDog(rig, running ? s.runT : s.idleT * 0.7, s.airborne, s.slideT > 0 ? 1 : 0, s.fall, running);
    const g = rig.group;
    g.position.set(x, y + rig.offsetY, z);
    const lean = ((s.lane - 1) * LANES.width - x) * 0.3;          // the dog leans into a lane change
    g.rotation.y = lean > 0.35 ? 0.35 : lean < -0.35 ? -0.35 : lean;

    // bones spin and bob (only the ones in use are touched)
    const t = s.time * 3;
    const dm = this.dummy;
    for (let i = 0; i < MAX_BONES; i++) {
      if (!this.boneOn[i]) continue;
      dm.position.set(this.boneX[i], this.boneY[i] + Math.sin(t + i) * 0.06, this.boneZ[i]);
      dm.rotation.set(0, t * 1.4 + i, 0);
      dm.scale.setScalar(SPAWN.boneDrawScale);
      dm.updateMatrix();
      this.boneMesh.setMatrixAt(i, dm.matrix);
    }
    this.boneMesh.instanceMatrix.needsUpdate = true;

    // the camera: behind and above, following lane changes smoothly rather than instantly
    const k = frameDt > 0 ? 1 - Math.exp(-CAMERA.follow * frameDt) : 1;
    s.camX += (x * 0.7 - s.camX) * k;
    if (running) s.bobT += frameDt * s.speed * CAMERA.bobSpeed * 0.5;
    const bob = running ? Math.abs(Math.sin(s.bobT)) * CAMERA.bobHeight : 0;
    this.camera.position.set(s.camX, CAMERA.height + bob + y * 0.3, z - CAMERA.behind);
    this.camera.lookAt(s.camX * 0.5 + x * 0.3, CAMERA.lookHeight, z + CAMERA.lookAhead);

    this.world.update(s.camX, this.camera.position.z);
    this.renderer.render(this.scene, this.camera);
  }

  _emitHud(force) {
    const s = this.s;
    const h = this.hud;
    h.metres = s.metres; h.bones = s.bones; h.score = s.score;
    h.speed = (s.speed - RUN.startSpeed) / (RUN.maxSpeed - RUN.startSpeed);
    if (this.cb.onHud && (force || this.phase === 'running')) this.cb.onHud(h);
  }

  /* ───────────────────────── interruptions ───────────────────────── */

  _autoPause() { if (this.phase === 'running') this.pause(); }

  _hidden() {
    this._autoPause();
    this._stopLoop();                 // nothing is drawn while the tab is hidden
  }

  _visible() {
    if (this.phase === 'ready' || this.phase === 'over' || this.phase === 'running') this._startLoop();
    else this._renderOnce();
  }

  _contextLost() {
    this.contextIsLost = true;
    this._stopLoop();
    if (this.phase === 'running') this.phase = 'paused';
    this._setPhase('lost');
  }

  _contextRestored() {
    this.contextIsLost = false;
    this._setPhase('resume');         // the graphics are back; wait for a tap so the dog doesn't run off by itself
    this._renderOnce();
  }
}
