import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { noExcellentMatch } from '../../utils/breedUtils';
import { track, trackOnce } from '../../utils/analytics';
import { playPortal, playRevealBark } from '../../utils/sounds';
import DogArt from '../quiz/DogArt';
import ZoomiesLayer, { startZoomBarks, zoomCounts } from './Zoomies';
import { BalloonArt, BALLOON_COLOURS, BALLOON_LAYOUT } from '../fun/Balloons';

/* "Portal, then balloons" reveal of the #1 match.

   It is only a layer on top of the results page: it reads `top` and `matches`
   and never changes them. The engine's own label decides how much we celebrate:
     - noExcellentMatch(matches) is truthy  -> a short, calm portal; weaker wording;
                                              no bark, no balloons, no zoomies
     - label starts with "Good"             -> full sequence, 5 balloons
     - label starts with "Excellent"        -> full sequence, 10 balloons
   Rendered through a portal so a transformed parent (the results page animates
   in) cannot break `position: fixed`.

   THE #1 CARD STAYS until the person presses the "See all results" button. Tapping the card, Enter, Space and the zoomies
   ending do nothing; the only other way out is Escape (a keyboard user's normal "close this dialog"). "Skip" exists only
   during the portal, where it still skips the whole reveal like before, and it is taken away once the card is up.

   HOW TO EDIT
   - Balloon colours / sizes / positions / timing: the BALLOONS array below.
   - Phase lengths: PORTAL_MS, CALM_PORTAL_MS, COUNT_MS, FADE_OUT_MS.
   - Copy: the COPY object.

   ZOOMIES: the moment the card appears (and the balloons start), a short burst of dogs sprints across the screen BEHIND the
   card (components/results/Zoomies.jsx). Excellent = 5 dogs, Good or weaker = 3. It lasts ZOOMIES_MS, can be tapped
   through, and is removed instantly if the reveal closes. Reduced motion: no layer at all, like everything else here. */

/* ── The portal (phase 1) ────────────────────────────────────────────────────────────
   WHERE TO EDIT
   - how long it runs ........ PORTAL_MS (strong result) / CALM_PORTAL_MS (weak one)
   - the three lines ......... PORTAL_LINES, and LINE_MS for how long each is up
   - the icons ............... PORTAL_ICONS: start angle, start distance, delay, duration
   - colours and size ........ the .pbrv__portal rules in the CSS block at the bottom */
const PORTAL_MS = 2400;          // strong result: rings + icons + three lines
const CALM_PORTAL_MS = 1200;     // weak result: rings only, one line, no icons, no bark
const SPEEDUP_MS = 150;          // the rings wind up for this long before they burst
const RIPPLE_MS = 400;           // ...then the burst outward
const LINE_MS = 800;             // how long each line of copy is up
const COUNT_MS = 900;
export const ZOOMIES_MS = 2500;        // how long the dogs sprint
export const ZOOMIES_FADE_MS = 400;    // ...then the layer fades out over this long and is taken off the page
const ZOOMIES_BUILD_AFTER_MS = 300;    // the layer is built this long after the portal starts (paused, invisible), see below
const CALM_FADE_MS = 900;
const FADE_OUT_MS = 300;

const PORTAL_LINES = [
  'Sniffing out your perfect match',
  'Checking your sofa, your schedule and your patience',
  'Asking the dogs. They have opinions',
];
const CALM_PORTAL_LINE = 'Looking for your closest match';

const COPY = {
  label: 'We found your match!',
  calmLabel: 'Your closest match',
  button: 'See all results',          // (was 'See my matches')
  skip: 'Skip',
};

const NAVY = '#011E4A';

/* The balloon drawing and its colours moved to components/fun/Balloons.jsx so the hero's
   dog badges can use the same one. Nothing about this file's balloons changed: same
   layout numbers, same class names, same CSS and the same animations further down. */
const BALLOONS = BALLOON_LAYOUT;

const Balloon = ({ b }) => (
  <span
    className="pbrv__balloon"
    aria-hidden="true"
    style={{ left: `${b.x}%`, width: b.size, animationDelay: `${b.delay}ms`, animationDuration: `${b.dur}ms` }}
  >
    <span className="pbrv__sway" style={{ animationDelay: `${b.delay}ms` }}>
      <BalloonArt size={b.size} colour={BALLOON_COLOURS[b.c]} />
    </span>
  </span>
);

/* The ten things the quiz asked about, flying home.

   Fixed numbers, never Math.random(): the same flight every time, so it can be looked at
   and judged rather than being different on each run.
     a    start angle in degrees (0 = straight up, clockwise)
     d    start distance from the centre, in vmin, so they begin just off the short edge
     t    when the flight starts, ms       dur  how long it takes, ms
   The spiral is two nested elements: the outer one ROTATES, the inner one slides inward.
   Rotating a translated child is what makes the path curve; translating alone is a
   straight line, which does not read as a portal pulling things in. */
const PORTAL_ICONS = [
  { icon: 'house',  a: 18,  d: 50, t: 0,    dur: 1050 },
  { icon: 'rug',    a: 72,  d: 56, t: 140,  dur: 1100 },
  { icon: 'yard',   a: 126, d: 48, t: 280,  dur: 980 },
  { icon: 'child',  a: 171, d: 54, t: 400,  dur: 1150 },
  { icon: 'senior', a: 215, d: 50, t: 540,  dur: 1000 },
  { icon: 'clock',  a: 260, d: 58, t: 660,  dur: 1120 },
  { icon: 'rupee',  a: 300, d: 46, t: 800,  dur: 950 },
  { icon: 'paw',    a: 338, d: 52, t: 920,  dur: 1080 },
  { icon: 'bolt',   a: 45,  d: 60, t: 1040, dur: 900 },
  { icon: 'leaf',   a: 240, d: 62, t: 1160, dur: 920 },
];
/* A phone that admits to four cores or fewer gets the first six only. Ten small SVGs
   spiralling at once is where a mid-range Android starts dropping frames. */
const ICONS_LOW_END = 6;

const ICON_ART = {
  house:  <><path d='M4 14 15 5l11 9' /><path d='M7 13v12h16V13' /><path d='M12.5 25v-6h5v6' /></>,
  rug:    <><rect x='4' y='10' width='22' height='11' rx='2.5' /><path d='M4 14h22M4 17.5h22' /><path d='M2 10v11M28 10v11' /></>,
  yard:   <><path d='M15 25V14' /><path d='M15 14c0-5 4-8 4-8s-1 7-4 8z' /><path d='M15 17c0-4-4-6-4-6s0 5 4 6z' /><path d='M6 25h18' /></>,
  child:  <><circle cx='15' cy='9' r='4' /><path d='M8 25c0-4.2 3.1-7 7-7s7 2.8 7 7' /><path d='M11 14.5 15 18l4-3.5' /></>,
  senior: <><circle cx='13' cy='8.5' r='3.6' /><path d='M8 25c0-4 2.4-6.6 5.5-6.6' /><path d='M19 12v13' /><path d='M19 12c2 0 3 1.4 3 3' /></>,
  clock:  <><circle cx='15' cy='15' r='10' /><path d='M15 8.5V15l4.5 3' /></>,
  rupee:  <><path d='M10 7h10' /><path d='M10 12h10' /><path d='M10 7c5 0 7 2 7 5s-2 5-7 5h-0.5L21 24' /></>,
  paw:    <><ellipse cx='15' cy='20' rx='5.2' ry='4.2' /><circle cx='7.6' cy='13.4' r='2.1' /><circle cx='12' cy='8.4' r='2.1' /><circle cx='18' cy='8.4' r='2.1' /><circle cx='22.4' cy='13.4' r='2.1' /></>,
  bolt:   <><path d='M17 4 8 17h6l-2 9 9-13h-6z' /></>,
  leaf:   <><path d='M24 6c0 10-6 16-13 16-2 0-4-.6-4-.6S8 9 24 6z' /><path d='M7 24c3-6 7-10 12-12' /></>,
};

/* One icon. Navy outline with a peach fill, so it reads on the cream layer. */
const PortalIcon = ({ spec }) => (
  <span
    className='pbrv__icon'
    style={{ '--a': `${spec.a}deg`, '--d': `${spec.d}vmin`, animationDelay: `${spec.t}ms`, animationDuration: `${spec.dur}ms` }}
  >
    <span className='pbrv__icon-in' style={{ animationDelay: `${spec.t}ms`, animationDuration: `${spec.dur}ms` }}>
      {/* Cancels the arc's rotation exactly, so the icon travels a curve but stays the
          right way up. Without it a house arrives upside down, which makes the ten
          things the quiz asked about unreadable - and being readable is their whole job. */}
      <span className='pbrv__icon-art' style={{ animationDelay: `${spec.t}ms`, animationDuration: `${spec.dur}ms` }}>
        <svg viewBox='0 0 30 30' width='40' height='40' fill='#FFD9BD' stroke={NAVY} strokeWidth='2.4' strokeLinecap='round' strokeLinejoin='round'>
          {ICON_ART[spec.icon]}
        </svg>
      </span>
    </span>
  </span>
);

/* The portal itself: five rings, a bright core, and the icons flying in.
   `fast` winds the rings up just before they burst; `withIcons` is false for a weak
   result, which gets the calmer rings-only version. */
const Portal = ({ fast, withIcons, iconCount }) => (
  <div className={`pbrv__portal${fast ? ' is-fast' : ''}`} aria-hidden='true'>
    <span className='pbrv__glow' />
    <span className='pbrv__ring pbrv__ring--1' />
    <span className='pbrv__ring pbrv__ring--2' />
    <span className='pbrv__ring pbrv__ring--3' />
    <span className='pbrv__ring pbrv__ring--4' />
    <span className='pbrv__ring pbrv__ring--5' />
    <span className='pbrv__core' />
    {withIcons && PORTAL_ICONS.slice(0, iconCount).map((spec) => <PortalIcon key={spec.icon} spec={spec} />)}
  </div>
);

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function MatchReveal({ top, matches, onDone }) {
  const [reduced] = useState(prefersReducedMotion);
  /* A weak result (the honesty gate) still gets a portal, but a calmer one: rings only,
     1.2s, one line, and then no bark, no balloons and no zoomies. Celebrating a match the
     engine itself would not recommend is the one thing this layer must never do. */
  const calm = !!noExcellentMatch(matches);
  const isGood = !calm && /^Good/.test(top?.label || '');
  const balloons = calm ? [] : isGood ? BALLOONS.filter((_, i) => i % 2 === 0) : BALLOONS;
  const zoomLevel = isGood ? 'good' : 'excellent';
  const portalMs = calm ? CALM_PORTAL_MS : PORTAL_MS;
  /* Ten spiralling SVGs is where a mid-range Android starts dropping frames. */
  const [iconCount] = useState(() => {
    try { return (navigator.hardwareConcurrency || 8) <= 4 ? ICONS_LOW_END : PORTAL_ICONS.length; }
    catch { return PORTAL_ICONS.length; }
  });

  const [phase, setPhase] = useState('portal');          // 'portal' | 'reveal'
  const [winding, setWinding] = useState(false);         // the rings speeding up just before they open
  const [rippling, setRippling] = useState(false);       // the burst outward + the flash behind the card
  const [line, setLine] = useState(0);                   // which line of copy is showing
  const [ready, setReady] = useState(false);
  const [closing, setClosing] = useState(false);
  const pctRef = useRef(null);
  const skipRef = useRef(null);
  const cardRef = useRef(null);
  const closedRef = useRef(false);
  const [zoomOn, setZoomOn] = useState(true);            // the zoomies layer; switched off by its own timer or when the reveal closes
  const [zoomBuilt, setZoomBuilt] = useState(false);     // the layer is built during the portal (paused, invisible) so the reveal itself stays light
  const zoomStop = useRef(null);                         // cancels the zoomies barks and timer
  const timers = useRef([]);
  const raf = useRef(0);

  const showId = useRef(Date.now());
  const stopSound = useRef(null);
  const stopPortal = useRef(null);   // the portal's swirl, cut the moment the layer closes

  const close = (how) => {
    if (closedRef.current) return;
    closedRef.current = true;
    try { stopSound.current?.(); } catch { /* ignore */ }
    try { stopPortal.current?.(); } catch { /* ignore */ }
    try { zoomStop.current?.(); } catch { /* ignore */ }   // no zoomies barks or timers survive closing
    if (how === 'skip') track('reveal_skipped', { label: top?.label });
    setClosing(true);
    timers.current.push(setTimeout(() => {
      onDone?.();
      // Hand focus to the top-match card on the results page underneath.
      requestAnimationFrame(() => {
        const el = document.getElementById('rec-top-match');
        if (el) { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }
      });
    }, FADE_OUT_MS));
  };

  // Reduced motion: no layer at all, show the results page straight away.
  useEffect(() => {
    if (reduced) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Page scroll lock, always restored.
  useEffect(() => {
    if (reduced) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // The quiz layer is still fading out underneath for half a second after results appear, so 'hidden' can be
    // what we read here even though the results page itself scrolls. Never put a stale 'hidden' back.
    return () => { document.body.style.overflow = prev === 'hidden' ? 'auto' : prev; };
  }, [reduced]);

  // Sequence timing.
  useEffect(() => {
    if (reduced) return undefined;
    skipRef.current?.focus({ preventScroll: true });
    trackOnce('reveal_shown', `${top?.name}:${showId.current}`, { label: top?.label });
    try { navigator.vibrate?.(20); } catch (e) { /* not supported */ }
    /* The portal has its own swirl (Vibhuvan's recording), trimmed to the length of this
       portal so it is never still playing over the bark. The bark that used to be the
       drumroll's tail now fires on its own when the portal opens, and only for a result
       worth barking about. */
    stopPortal.current = playPortal(portalMs / 1000);
    if (!calm) {
      PORTAL_LINES.forEach((_, i) => {
        if (i === 0) return;
        timers.current.push(setTimeout(() => setLine(i), i * LINE_MS));
      });
    }
    timers.current.push(setTimeout(() => setWinding(true), portalMs - SPEEDUP_MS));
    timers.current.push(setTimeout(() => {
      setPhase('reveal');
      setRippling(true);
      if (!calm) stopSound.current = playRevealBark();
      timers.current.push(setTimeout(() => setRippling(false), RIPPLE_MS));
    }, portalMs));
    return () => { timers.current.forEach(clearTimeout); cancelAnimationFrame(raf.current); try { stopSound.current?.(); } catch { /* ignore */ } try { stopPortal.current?.(); } catch { /* ignore */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Zoomies, step 1: build the (paused, invisible) layer a moment into the portal, while the phone is idle.
  useEffect(() => {
    if (reduced || calm) return undefined;
    const t = setTimeout(() => setZoomBuilt(true), ZOOMIES_BUILD_AFTER_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Zoomies, step 2: start the moment the card appears, end by themselves, and stop at once if the reveal closes.
  // (Not with reduced motion, and not if CELEBRATE_EVERY_RESULT is turned off.)
  useEffect(() => {
    if (reduced || calm || phase !== 'reveal') return undefined;
    trackOnce('zoomies_played', `${top?.name}:${showId.current}`, { dogs: zoomCounts(zoomLevel).dogs, label: top?.label });
    const stopBarks = startZoomBarks(zoomLevel);
    const off = setTimeout(() => setZoomOn(false), ZOOMIES_MS + ZOOMIES_FADE_MS);
    zoomStop.current = () => { clearTimeout(off); stopBarks(); };
    return () => { zoomStop.current?.(); zoomStop.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Count-up, starts when the result appears.
  useEffect(() => {
    if (reduced || calm || phase !== 'reveal') return undefined;
    const target = Number(top.matchPercentage) || 0;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      const eased = 1 - (1 - t) ** 3;
      if (pctRef.current) pctRef.current.textContent = `${t === 1 ? top.matchPercentage : Math.round(target * eased)}%`;
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else setReady(true);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // The card stays until the button is pressed. Escape is the only other way out (and only an on-purpose key press):
  // during the portal it counts as a skip, once the card is up it is just a close. Enter / Space are NOT global
  // shortcuts any more; they only press whichever button has the focus.
  useEffect(() => {
    if (reduced) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(phase === 'portal' ? 'skip' : undefined); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reduced]);

  // When the card appears the Skip button (which had the focus) is gone, so park the focus on the card itself. It is a
  // plain container, not a button: Tab goes on to "See all results" and a stray Enter / Space does nothing.
  useEffect(() => {
    if (reduced || phase !== 'reveal') return;
    cardRef.current?.focus({ preventScroll: true });
  }, [phase, reduced]);

  if (reduced || !top) return null;

  const showCard = phase === 'reveal';
  const announce = showCard
    ? (calm
      ? `Your closest match is ${top.name}, ${top.matchPercentage} percent, ${top.label}.`
      : `Your top match is ${top.name}, ${top.matchPercentage} percent, ${top.label}.`)
    : '';

  return createPortal(
    <div className={`pbrv${closing ? ' is-closing' : ''}`} role="dialog" aria-modal="true" aria-label="Your match is ready">
      <style>{CSS}</style>
      <span className="pbrv__deco pbrv__deco--a" aria-hidden="true" />
      <span className="pbrv__deco pbrv__deco--b" aria-hidden="true" />

      {phase === 'portal' && <button type="button" className="pbrv__skip" ref={skipRef} onClick={() => close('skip')}>{COPY.skip}</button>}
      <p className="pbrv__sr" aria-live="polite">{announce}</p>

      {phase === 'portal' && (
        <>
          {/* The same sitting dog the quiz showed while it was working, kept so there is no
              jump between the two screens. It sits above the portal now, and steps aside
              entirely on a short screen where the portal needs the room. */}
          <div className="pbrv__pdog" style={{ '--pbrv-out-at': `${portalMs - 260}ms` }} aria-hidden="true"><DogArt mood="sit" width={92} /></div>
          <div className="pbrv__portalwrap">
            <Portal fast={winding} withIcons={!calm} iconCount={iconCount} />
            {/* Fixed height, so swapping the line never moves the portal. The spoken
                announcement is the aria-live line above; these are decoration. */}
            <p className="pbrv__portaltext" aria-hidden="true" key={calm ? 'calm' : line}>
              {calm ? CALM_PORTAL_LINE : PORTAL_LINES[line]}
              <span className="pbrv__dots"><i /><i /><i /></span>
            </p>
          </div>
        </>
      )}

      {/* The portal bursting open: a ring of light racing outward, and a soft flash
          behind the card as it arrives. Both unmount as soon as they are done. */}
      {rippling && (
        <>
          <span className="pbrv__ripple" aria-hidden="true" />
          <span className="pbrv__flash" aria-hidden="true" />
        </>
      )}

      {showCard && !calm && (
        <div className="pbrv__balloons" aria-hidden="true">
          {balloons.map((b, i) => <Balloon key={i} b={b} />)}
        </div>
      )}

      {!calm && zoomBuilt && zoomOn && !closing && (
        <ZoomiesLayer level={zoomLevel} ms={ZOOMIES_MS} fadeMs={ZOOMIES_FADE_MS} go={showCard} />
      )}

      {showCard && (
        <div
          className={`pbrv__card${calm ? ' is-calm' : ''}`}
          ref={cardRef}
          tabIndex={-1}
        >
          <img className="pbrv__photo" src={`/${top.img}`} alt={top.name} />
          <p className="pbrv__eyebrow">{calm ? COPY.calmLabel : COPY.label}</p>
          <h2 className="pbrv__name">{top.name}</h2>
          {!calm && <p className="pbrv__pct" ref={pctRef}>0%</p>}
          {calm && <p className="pbrv__pct">{top.matchPercentage}%</p>}
          {top.label && <span className="pbrv__pill">{top.label}</span>}
          {ready && (
            <button type="button" className="pbrv__go" onClick={() => close()}>{COPY.button}</button>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}

const CSS = `
.pbrv{--pbrv-portal:min(70vw,320px);position:fixed;inset:0;z-index:3000;background:#FBF8F4;color:#011E4A;font-family:'Satoshi',system-ui,-apple-system,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;overflow:hidden;animation:pbrv-fade-in .2s ease both}
.pbrv *,.pbrv *::before,.pbrv *::after{box-sizing:border-box}
.pbrv.is-closing{animation:pbrv-out ${FADE_OUT_MS}ms ease forwards}
@keyframes pbrv-out{to{opacity:0}}
@keyframes pbrv-fade-in{from{opacity:0}to{opacity:1}}
.pbrv :focus-visible{outline:3px solid #011E4A;outline-offset:3px}
.pbrv__deco{position:absolute;border-radius:50%;pointer-events:none}
.pbrv__deco--a{width:280px;height:280px;background:#FFD9BD;opacity:.55;top:-100px;right:-90px}
.pbrv__deco--b{width:240px;height:240px;background:#E3ECF7;opacity:.85;bottom:-90px;left:-80px}
.pbrv__skip{position:absolute;top:10px;right:10px;z-index:5;min-width:44px;min-height:44px;padding:0 14px;background:none;border:0;font:700 15px 'Satoshi',sans-serif;color:#011E4A;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.pbrv__sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}

/* ── Phase 1: the portal ─────────────────────────────────────────────────────────────
   Only transform and opacity animate. The glow is a plain radial-gradient circle rather
   than filter:blur, which is what makes this affordable on a mid-range phone. */
.pbrv__pdog{position:fixed;left:50%;top:13%;transform:translate(-50%,-50%);z-index:3;animation:pbrv-dog-out 240ms ease forwards;animation-delay:var(--pbrv-out-at)}
@keyframes pbrv-dog-out{to{opacity:0}}
.pbrv__portalwrap{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:26px}

.pbrv__portal{position:relative;width:var(--pbrv-portal);height:var(--pbrv-portal);display:flex;align-items:center;justify-content:center;animation:pbrv-breathe 2.2s ease-in-out infinite alternate}
@keyframes pbrv-breathe{from{transform:scale(1)}to{transform:scale(1.06)}}
.pbrv__glow{position:absolute;left:50%;top:50%;width:150%;height:150%;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(245,105,26,.30) 0%,rgba(245,105,26,.13) 42%,rgba(245,105,26,0) 70%);pointer-events:none}

/* Each ring is a circle whose border is only partly coloured, so the spin is visible.
   Neighbouring rings turn opposite ways, which is what reads as a swirl. */
.pbrv__ring{position:absolute;border-radius:50%;border-style:solid;border-color:transparent;will-change:transform}
.pbrv__ring--1{width:100%;height:100%;border-width:7px;border-top-color:#F5691A;border-right-color:#FFD9BD;animation:pbrv-spin 3.4s linear infinite}
.pbrv__ring--2{width:82%;height:82%;border-width:6px;border-bottom-color:#011E4A;border-left-color:#E3ECF7;animation:pbrv-spin-r 4.6s linear infinite}
.pbrv__ring--3{width:64%;height:64%;border-width:6px;border-top-color:#FFD9BD;border-left-color:#F5691A;animation:pbrv-spin 3s linear infinite}
.pbrv__ring--4{width:47%;height:47%;border-width:5px;border-bottom-color:#F5691A;border-right-color:#011E4A;animation:pbrv-spin-r 5.6s linear infinite}
.pbrv__ring--5{width:31%;height:31%;border-width:4px;border-top-color:#011E4A;border-right-color:#FFD9BD;animation:pbrv-spin 2.6s linear infinite}
@keyframes pbrv-spin{to{transform:rotate(360deg)}}
@keyframes pbrv-spin-r{to{transform:rotate(-360deg)}}

.pbrv__core{position:absolute;width:20%;height:20%;border-radius:50%;background:radial-gradient(circle,#FFFFFF 0%,#FFF1E6 55%,#FFD9BD 100%);box-shadow:0 0 26px 10px rgba(255,241,230,.9);animation:pbrv-core 1.6s ease-in-out infinite alternate}
@keyframes pbrv-core{from{transform:scale(.88);opacity:.9}to{transform:scale(1.1);opacity:1}}

/* The wind-up: the last 150ms before it opens. */
.pbrv__portal.is-fast .pbrv__ring--1{animation-duration:.34s}
.pbrv__portal.is-fast .pbrv__ring--2{animation-duration:.46s}
.pbrv__portal.is-fast .pbrv__ring--3{animation-duration:.3s}
.pbrv__portal.is-fast .pbrv__ring--4{animation-duration:.56s}
.pbrv__portal.is-fast .pbrv__ring--5{animation-duration:.26s}

/* An icon is two nested elements: the outer one rotates around the portal centre, the
   inner one slides in from --d. Rotation + inward slide = a spiral. */
.pbrv__icon{position:absolute;left:50%;top:50%;width:0;height:0;transform:rotate(var(--a));animation-name:pbrv-icon-arc;animation-timing-function:cubic-bezier(.4,0,.5,1);animation-fill-mode:both;pointer-events:none}
@keyframes pbrv-icon-arc{to{transform:rotate(calc(var(--a) + 170deg))}}
.pbrv__icon-in{position:absolute;left:0;top:0;width:40px;height:40px;margin:-20px 0 0 -20px;display:flex;align-items:center;justify-content:center;transform:translateX(var(--d)) scale(1);opacity:0;animation-name:pbrv-icon-in;animation-timing-function:cubic-bezier(.4,0,.5,1);animation-fill-mode:both;will-change:transform,opacity}
/* Full size for most of the way in, then it shrinks into the core. A straight 1-to-0.2 ramp meant the icon was already a speck by the time it crossed the screen edge. */
.pbrv__icon-art{display:block;transform:rotate(calc(-1 * var(--a)));animation-name:pbrv-icon-upright;animation-timing-function:cubic-bezier(.4,0,.5,1);animation-fill-mode:both}
@keyframes pbrv-icon-upright{to{transform:rotate(calc(-1 * var(--a) - 170deg))}}
@keyframes pbrv-icon-in{0%{transform:translateX(var(--d)) scale(1);opacity:0}10%{opacity:1}60%{transform:translateX(calc(var(--d) * .42)) scale(.92);opacity:1}100%{transform:translateX(0) scale(.18);opacity:0}}

/* A plain centred block, not a flex row: the dots have to sit at the end of the LAST line of the sentence, and a flex row parks them beside the first one. The height is fixed for the tallest of the three lines so swapping never moves the portal. 24px is the desktop size; a phone steps down, or the longest line runs to four. */
.pbrv__portaltext{position:relative;z-index:2;margin:0;min-height:86px;max-width:min(90vw,460px);text-align:center;font-family:'Fredoka',sans-serif;font-weight:600;font-size:clamp(17px,4.8vw,24px);line-height:1.3;color:#011E4A;animation:pbrv-line-in 200ms ease both}
@keyframes pbrv-line-in{from{opacity:0}to{opacity:1}}

/* ── Phase 2: the portal opening ───────────────────────────────────────────────────── */
.pbrv__ripple{position:fixed;left:50%;top:50%;width:var(--pbrv-portal);height:var(--pbrv-portal);margin:calc(var(--pbrv-portal) / -2) 0 0 calc(var(--pbrv-portal) / -2);border-radius:50%;border:8px solid #F5691A;z-index:1;pointer-events:none;animation:pbrv-ripple ${RIPPLE_MS}ms cubic-bezier(.2,.7,.3,1) both}
@keyframes pbrv-ripple{from{transform:scale(1);opacity:.85}to{transform:scale(2.5);opacity:0}}
.pbrv__flash{position:fixed;left:50%;top:50%;width:140vmax;height:140vmax;margin:-70vmax 0 0 -70vmax;border-radius:50%;background:radial-gradient(circle,#FFF1E6 0%,rgba(255,241,230,0) 62%);z-index:1;pointer-events:none;animation:pbrv-flash 300ms ease both}
@keyframes pbrv-flash{0%{opacity:0}45%{opacity:.6}100%{opacity:0}}
.pbrv__dots{display:inline-flex;gap:5px;margin-left:5px;vertical-align:baseline}
.pbrv__dots i{width:6px;height:6px;align-self:flex-end;margin-bottom:.22em;border-radius:50%;background:#F5691A;opacity:.2;animation:pbrv-blink 1.2s infinite}
.pbrv__dots i:nth-child(2){animation-delay:.2s}.pbrv__dots i:nth-child(3){animation-delay:.4s}
@keyframes pbrv-blink{0%,60%,100%{opacity:.2}30%{opacity:1}}

.pbrv__balloons{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1}
.pbrv__balloon{position:absolute;bottom:-150px;display:block;will-change:transform;animation-name:pbrv-rise;animation-timing-function:cubic-bezier(.3,.1,.5,1);animation-fill-mode:both}
@keyframes pbrv-rise{from{transform:translateY(0)}to{transform:translateY(calc(-100vh - 320px))}}
.pbrv__sway{display:block;animation:pbrv-sway 1.6s ease-in-out infinite alternate;transform-origin:50% 100%;will-change:transform}
@keyframes pbrv-sway{from{transform:translateX(-8px) rotate(-5deg)}to{transform:translateX(8px) rotate(5deg)}}

.pbrv__card{position:relative;z-index:3;display:flex;flex-direction:column;align-items:center;text-align:center;padding:20px 20px 24px;max-height:100%;overflow-y:auto;outline:none;animation:pbrv-fade-in .34s ease both}
.pbrv__card.is-calm{animation:pbrv-fade-in ${CALM_FADE_MS}ms ease both}
/* The photo comes out of the portal's core: 0.2 to 1 with a small overshoot. The card
   around it only fades, so the two do not fight and the final layout is unchanged. */
@keyframes pbrv-emerge{from{opacity:0;transform:scale(.2)}to{opacity:1;transform:scale(1)}}
.pbrv__photo{animation:pbrv-emerge 500ms cubic-bezier(.2,1.4,.4,1) both;width:min(58vw,240px);aspect-ratio:1/1;object-fit:cover;border:5px solid #fff;border-radius:46% 54% 52% 48% / 52% 46% 54% 48%;box-shadow:0 0 0 8px #FFD9BD,0 14px 34px rgba(245,105,26,.28);background:#FFF1E6}
.pbrv__eyebrow{margin:24px 0 0;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#F5691A}
.pbrv__name{margin:4px 0 0;font-family:'Fredoka',sans-serif;font-weight:700;font-size:32px;line-height:1.15;color:#011E4A}
.pbrv__pct{margin:4px 0 0;font-family:'Fredoka',sans-serif;font-weight:600;font-size:22px;color:#F5691A;min-height:28px}
.pbrv__pill{margin-top:8px;display:inline-block;padding:5px 14px;border-radius:999px;background:#FFF1E6;border:1px solid #F3DCC8;font-size:13px;font-weight:700;color:#B34A0E}
.pbrv__go{margin-top:18px;min-height:52px;padding:0 34px;border:0;border-radius:999px;background:#F5691A;color:#011E4A;font:700 17px 'Satoshi',sans-serif;cursor:pointer;box-shadow:0 8px 22px rgba(245,105,26,.35);animation:pbrv-fade-in .3s ease both}
.pbrv__go:active{transform:scale(.97)}
@media (max-height:620px){.pbrv__photo{width:min(40vw,170px)}.pbrv__eyebrow{margin-top:14px}.pbrv__name{font-size:28px}}
/* Belt and braces: this layer is not even rendered under reduced motion (see the early
   return), but if that ever changes nothing here should move. */
@media (prefers-reduced-motion:reduce){.pbrv__pdog,.pbrv__portal,.pbrv__ring,.pbrv__core,.pbrv__icon,.pbrv__icon-in,.pbrv__portaltext,.pbrv__ripple,.pbrv__flash,.pbrv__photo{animation:none}.pbrv,.pbrv__balloon,.pbrv__sway,.pbrv__card,.pbrv__go,.pbrv__dots i{animation:none}}
`;
