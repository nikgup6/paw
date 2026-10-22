import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FOOTER_TOY_PATHS, PINNED_TOYS, TOYS, TOY_GROUP_BOX, TOY_PLACEMENTS, shuffledToyKeys, toyForIndex } from '../../constants/toys';
import { playBark, playToy } from '../../utils/sounds';
import { track, trackOnce } from '../../utils/analytics';
import { useToys, usePhone, useViewportWidth } from './ToyContext';

/* SQUEAKY TOYS: little illustrated dog toys that squish and squeak when you tap them. Pure decoration.

   <SqueakyToy>   one toy: a real <button> (tap, click, Enter or Space) that squashes for 250 ms and plays the squeak.
   <ToySlots>     puts all the toys of one group (see TOY_PLACEMENTS in constants/toys.js) on a page.
   <ToyPlain>     a toy picture that is not clickable (the loading screen).

   RULES IT KEEPS
   - It never covers or blocks anything: every layer ignores the mouse and fingers (pointer-events: none) EXCEPT the toy
     button itself, and toys sit in margins and edges. No toy is needed for anything.
   - Sound only after a direct tap (never on page load), through utils/sounds.js: the site's one audio context, the
     global mute, at most 3 squeaks at once. With the sound off or blocked the toy still squishes, silently.
   - Motion is transform and opacity only, with CSS keyframes (no JavaScript loop). With "reduce motion" there is no
     wobble and no squash. The wobble also pauses while the tab is hidden.
   - The picture has fixed width and height, is lazy-loaded, and cannot be dragged or long-pressed.

   EASTER EGG: after 8 squeaks in one visit (counted in memory only) the toy you just squeezed barks once and shows a
   "Good boy!" bubble for 1.5 seconds. Once per visit. */

const SQUISH_MS = 250;
const EGG_AFTER = 8;
let squeakCount = 0;        // squeaks so far this visit (memory only)
let eggDone = false;

/* The wobble pauses while the tab is hidden: one shared listener, there only while a toy is on the page. */
let hiddenUsers = 0;
const onVisibility = () => document.documentElement.classList.toggle('pb-tab-hidden', document.hidden);
function useTabHiddenFlag() {
  useEffect(() => {
    if (hiddenUsers++ === 0) document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (--hiddenUsers === 0) { document.removeEventListener('visibilitychange', onVisibility); document.documentElement.classList.remove('pb-tab-hidden'); }
    };
  }, []);
}

/** A small number from the toy's name, so each toy wobbles at its own pace and out of step with the others. */
const hashOf = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

/* `event` (optional): an extra tracking name fired on EVERY tap, alongside the usual
   once-per-session `toy_squeaked`. The hero uses it so repeat squeezes are counted there. */
export default function SqueakyToy({ toy, size = 100, rotate = 0, style, className = '', page = 'unknown', event = null }) {
  const t = TOYS[toy];
  const [squish, setSquish] = useState(false);
  const [bubble, setBubble] = useState(false);
  const busy = useRef(false);
  const timers = useRef([]);
  useTabHiddenFlag();
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  if (!t) return null;

  const h = hashOf(toy);
  const height = Math.round((size * t.h) / t.w);

  const squeeze = () => {
    if (busy.current) return;                     // ignore taps during the toy's own squish
    busy.current = true;
    setSquish(true);
    timers.current.push(setTimeout(() => { busy.current = false; setSquish(false); }, SQUISH_MS));
    try { playToy(toy); } catch { /* the toy just stays silent */ }
    try { trackOnce('toy_squeaked', `${toy}:${page}`, { toy, page }); } catch { /* tracking never matters here */ }
    if (event) { try { track(event, { toy }); } catch { /* same */ } }
    squeakCount += 1;
    if (squeakCount === EGG_AFTER && !eggDone) {
      eggDone = true;
      timers.current.push(setTimeout(() => {         // after the squeak has finished
        try { playBark(); } catch { /* silent is fine */ }
        setBubble(true);
        timers.current.push(setTimeout(() => setBubble(false), 1500));
      }, 480));
    }
  };

  return (
    <span className={`pbtoy ${className}`} style={{ width: size, height, ...style }}>
      <span className="pbtoy__rot" style={{ transform: `rotate(${rotate}deg)` }}>
        <button
          type="button"
          className={`pbtoy__btn${squish ? ' is-squish' : ''}`}
          aria-label={`Squeeze the ${t.name}`}
          onClick={squeeze}
          onContextMenu={(e) => e.preventDefault()}
        >
          <img
            className="pbtoy__img"
            src={t.small}
            alt=""
            width={size}
            height={height}
            loading="lazy"
            decoding="async"
            draggable={false}
            style={{ '--wd': `${4 + (h % 3)}s`, '--wdelay': `-${(h % 7) * 0.8}s` }}
          />
        </button>
      </span>
      {bubble && <span className="pbtoy__bubble" role="status">Good boy!</span>}
    </span>
  );
}

/** A toy picture you cannot tap (the loading screen). It bounces gently. */
export function ToyPlain({ toy, size = 96, className = '', style }) {
  const t = TOYS[toy];
  if (!t) return null;
  return (
    <span className={`pbtoy pbtoy--plain ${className}`} style={{ width: size, height: Math.round((size * t.h) / t.w), ...style }} aria-hidden="true">
      <style>{CSS}</style>
      <img className="pbtoy__bounce" src={t.small} alt="" width={size} height={Math.round((size * t.h) / t.w)} loading="lazy" decoding="async" draggable={false} />
    </span>
  );
}

/**
 * All the toys of one group, in a box that fills its parent (the parent must be position: relative). The box crops
 * anything that sticks out (so an edge toy can never cause sideways scrolling) and ignores the mouse and fingers.
 *   group   a key of TOY_PLACEMENTS         page   the name used in tracking ('home', 'results', 'play', 'footer')
 *   z       stacking order of the box. Default 2: just above ordinary page content (so a toy can always be pressed, even
 *           where an invisible content box spans its corner) and below every header (10), menu (40-50), sticky bar (900)
 *           and dialog, so no toy can ever hide or block those. Toys sit in margins, so they never cover content either.
 */
export function ToySlots({ group, page, z = 2, className = '', style }) {
  const { seed, enabled } = useToys();
  const phone = usePhone();
  const vw = useViewportWidth();
  /* A spot may pin its toy by name (see `toy` in TOY_PLACEMENTS). Every unpinned spot draws
     from the toys that are NOT pinned anywhere, so the hero's five never turn up again a
     screen later — including the footer pile, whose negative indices count from the end of
     this same pool. There are nine toys and, on a desktop home page, ten spots, so the pool
     wraps and one picture repeats; it lands in the footer pile, furthest from the hero. */
  const order = useMemo(() => {
    const free = shuffledToyKeys(seed).filter((k) => !PINNED_TOYS.has(k));
    return free.length ? free : shuffledToyKeys(seed);
  }, [seed]);
  if (!enabled) return null;
  const list = (TOY_PLACEMENTS[group] || [])
    .filter((p) => p.show === 'all' || (phone ? p.show === 'phone' : p.show === 'desktop'))
    // optional per-spot width window, for a group whose layout breaks somewhere other than 700px
    .filter((p) => (p.minW == null || vw >= p.minW) && (p.maxW == null || vw <= p.maxW));
  if (!list.length) return null;
  return (
    <div className={`pbtoys ${className}`} style={{ zIndex: z, ...TOY_GROUP_BOX[group], ...style }}>
      <style>{CSS}</style>
      {list.map((p) => (
        <SqueakyToy
          key={p.id}
          toy={p.toy || toyForIndex(order, p.index)}
          size={p.size}
          rotate={p.rotate}
          page={page || group}
          /* the hero reports every squeeze, not just the first one per session */
          event={group === 'homeHero' ? 'hero_toy_tap' : null}
          style={p.pos}
        />
      ))}
    </div>
  );
}

/** The toy for one spot of a group (used by the loading screen, which draws it without the box). */
export function useToyFor(group, id) {
  const { seed } = useToys();
  const order = useMemo(() => shuffledToyKeys(seed), [seed]);
  const p = (TOY_PLACEMENTS[group] || []).find((x) => x.id === id);
  return p ? { toy: toyForIndex(order, p.index), placement: p } : null;
}

export const footerToysAllowed = (pathname) => FOOTER_TOY_PATHS.includes(pathname);

const CSS = `
.pbtoys{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.pbtoy{position:absolute;display:block;pointer-events:none;line-height:0}
.pbtoy__rot{display:block;width:100%;height:100%}
.pbtoy__btn{box-sizing:border-box;display:block;width:100%;height:100%;margin:0;padding:0;border:0;background:none;border-radius:14px;cursor:pointer;pointer-events:auto;transform-origin:50% 100%;touch-action:manipulation;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.pbtoy__btn:focus-visible{outline:3px solid #011E4A;outline-offset:3px}
.pbtoy__img{display:block;width:100%;height:100%;pointer-events:none;-webkit-user-drag:none;user-select:none;-webkit-user-select:none;animation:pbtoy-wobble var(--wd,5s) ease-in-out var(--wdelay,0s) infinite alternate}
@keyframes pbtoy-wobble{from{transform:rotate(-1.5deg)}to{transform:rotate(1.5deg)}}
.pbtoy__btn.is-squish{animation:pbtoy-squish ${SQUISH_MS}ms cubic-bezier(.3,1.5,.5,1) both}
@keyframes pbtoy-squish{0%{transform:scale(1,1)}28%{transform:scale(1.15,.8)}62%{transform:scale(.96,1.07)}100%{transform:scale(1,1)}}
html.pb-tab-hidden .pbtoy__img{animation-play-state:paused}
.pbtoy__bubble{position:absolute;left:50%;bottom:100%;margin-bottom:4px;padding:5px 12px;border-radius:14px;background:#fff;border:2px solid #011E4A;color:#011E4A;font:800 13px 'Satoshi',system-ui,sans-serif;line-height:1.2;white-space:nowrap;pointer-events:none;transform:translateX(-50%);animation:pbtoy-bubble 1.5s ease both}
@keyframes pbtoy-bubble{0%{opacity:0;transform:translateX(-50%) translateY(6px) scale(.9)}14%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}84%{opacity:1}100%{opacity:0}}
.pbtoy__bounce{display:block;width:100%;height:100%;animation:pbtoy-bounce 1.1s ease-in-out infinite alternate}
@keyframes pbtoy-bounce{from{transform:translateY(0)}to{transform:translateY(-14px)}}
@media (prefers-reduced-motion:reduce){.pbtoy__img,.pbtoy__bounce{animation:none}.pbtoy__btn.is-squish{animation:none}.pbtoy__bubble{animation:none;opacity:1}}
`;
