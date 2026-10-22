import { INPUT } from './config.js';

/* INPUT: all keyboard and touch handling for the game, in one place.

   The game does not read keys itself; it gives this file a set of "actions" (left, right, jump, slide, pause, confirm,
   tap) and this file calls them. Everything it attaches is removed again by detach(), so leaving the page leaves nothing behind.

   KEYBOARD   Arrow Left/Right or A/D  = change lane      Arrow Up, W or Space = jump
              Arrow Down or S          = slide            P or Esc             = pause
              Enter                    = start / restart
   TOUCH      one-thumb swipes anywhere on the game area: left / right = lane, up = jump, down = slide.
              A swipe counts the moment the finger has moved ~24 px (config.js) in one direction, we do NOT wait for the
              finger to lift (waiting feels laggy). A quick touch that barely moves is a TAP (used to start).

   The page is only stopped from scrolling (Space and arrows) while the game "has focus": after you tapped or clicked
   inside the game area, or while the game area itself is focused. Clicking elsewhere gives the keys back to the page. */

const KEY_ACTIONS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  ArrowDown: 'slide', KeyS: 'slide',
  KeyP: 'pause', Escape: 'pause',
  Enter: 'confirm',
};
const SCROLL_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class Input {
  /** `actions` = { left, right, jump, slide, pause, confirm, tap }, each a function. */
  constructor(actions) {
    this.actions = actions;
    this.el = null;
    this.engaged = false;      // does the game "have focus"? (see the note at the top)
    this.pid = null;           // the finger / mouse button currently down
    this.ox = 0; this.oy = 0;  // where the current swipe started (moves forward each time a swipe fires)
    this.sx = 0; this.sy = 0;  // where the touch started (for tap detection)
    this.t0 = 0;
    this.acted = false;        // did this touch already fire a swipe?

    // One bound function per handler, created once, so removeEventListener can find them again.
    this.onKeyDown = this._onKeyDown.bind(this);
    this.onPointerDown = this._onPointerDown.bind(this);
    this.onPointerMove = this._onPointerMove.bind(this);
    this.onPointerUp = this._onPointerUp.bind(this);
    this.onPointerCancel = this._onPointerCancel.bind(this);
    this.onContextMenu = (e) => e.preventDefault();
    this.onWindowPointerDown = (e) => { if (this.el && !this.el.contains(e.target)) this.engaged = false; };
    this.onFocusIn = () => { this.engaged = true; };
  }

  attach(el) {
    this.el = el;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('pointerdown', this.onWindowPointerDown, true);
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerCancel);
    el.addEventListener('contextmenu', this.onContextMenu);
    el.addEventListener('focusin', this.onFocusIn);
  }

  detach() {
    const el = this.el;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('pointerdown', this.onWindowPointerDown, true);
    if (el) {
      el.removeEventListener('pointerdown', this.onPointerDown);
      el.removeEventListener('pointermove', this.onPointerMove);
      el.removeEventListener('pointerup', this.onPointerUp);
      el.removeEventListener('pointercancel', this.onPointerCancel);
      el.removeEventListener('contextmenu', this.onContextMenu);
      el.removeEventListener('focusin', this.onFocusIn);
    }
    this.el = null;
    this.actions = null;
  }

  /** The game calls this when it starts, so keys work straight away without a click first. */
  engage() { this.engaged = true; }

  _onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const action = KEY_ACTIONS[e.code];
    if (!action) return;
    const t = e.target;
    // a focused button / link / field keeps its own keys (Space on a button presses it)
    const onControl = t && t.closest && t.closest('button, a, input, textarea, select, [contenteditable="true"]');
    const focused = this.engaged || (this.el && (t === this.el || this.el.contains(t)));
    if (onControl && action !== 'pause') return;
    if (!focused && action !== 'pause') return;
    if (SCROLL_KEYS.has(e.code)) e.preventDefault();      // the page must not scroll while playing
    if (e.repeat) return;                                   // holding a key does one move, not a machine-gun
    const fn = this.actions && this.actions[action];
    if (fn) fn(e.code);                                      // the key's name is passed along (the game treats Space and Enter specially at game over)
  }

  _ignoreTarget(t) {
    return !!(t && t.closest && t.closest('button, a, [data-noswipe]'));   // buttons on top of the game are not swipes
  }

  _onPointerDown(e) {
    if (this._ignoreTarget(e.target)) return;
    this.engaged = true;
    if (this.pid !== null) return;                         // one finger at a time
    this.pid = e.pointerId;
    this.ox = this.sx = e.clientX;
    this.oy = this.sy = e.clientY;
    this.t0 = e.timeStamp;
    this.acted = false;
    try { this.el.setPointerCapture(e.pointerId); } catch { /* not supported */ }
  }

  _onPointerMove(e) {
    if (e.pointerId !== this.pid) return;
    const dx = e.clientX - this.ox;
    const dy = e.clientY - this.oy;
    const ax = dx < 0 ? -dx : dx;
    const ay = dy < 0 ? -dy : dy;
    if (ax < INPUT.swipePx && ay < INPUT.swipePx) return;
    // the first time a direction crosses the threshold, act immediately, then start measuring again from here
    const a = this.actions;
    if (a) {
      if (ax >= ay) (dx < 0 ? a.left : a.right)?.();
      else (dy < 0 ? a.jump : a.slide)?.();
    }
    this.acted = true;
    this.ox = e.clientX;
    this.oy = e.clientY;
  }

  _onPointerUp(e) {
    if (e.pointerId !== this.pid) return;
    this.pid = null;
    try { this.el.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (this.acted) return;
    const dx = e.clientX - this.sx;
    const dy = e.clientY - this.sy;
    const moved = Math.sqrt(dx * dx + dy * dy);
    if (moved <= INPUT.tapMaxMovePx && e.timeStamp - this.t0 <= INPUT.tapMaxMs) this.actions && this.actions.tap?.();
  }

  _onPointerCancel(e) {
    if (e.pointerId !== this.pid) return;
    this.pid = null;
  }
}
