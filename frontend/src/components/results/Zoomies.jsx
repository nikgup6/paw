import React, { useEffect, useState } from 'react';
import { playZoomiesBark } from '../../utils/sounds';
import DogArt, { DOG_CSS } from '../quiz/DogArt';

/* "ZOOMIES": a short burst of dogs sprinting across the screen after the drumroll in the match reveal.

   What you see (about 2.5 seconds, then it is gone):
   - cartoon dogs of different colours sprinting across, some left to right, some right to left, at different speeds,
     bouncing as they run. One is bigger (the "hero" dog) and does a small loop-the-loop.
   - each dog leaves a few paw prints that fade in as it passes and fade out
   - a light pop of confetti from the top
   - a few barks (see startZoomBarks)

   It is a REWARD, never an obstacle: the layer ignores the mouse and fingers (pointer-events: none), is hidden from
   screen readers, and sits BEHIND the match card, so the card, Skip and "See my matches" stay clickable the whole time.

   HOW IT IS BUILT (plain language)
   - Everything is CSS animation (transform and opacity only). There is no JavaScript animation loop, nothing is created per
     frame, and the whole layer is removed from the page when it is over (or the moment the reveal is closed).
   - It is kept light on purpose: one path per paw print, one shared stylesheet for all the dogs, and no `will-change`, so the
     phone only builds a drawing layer for a piece when that piece actually starts moving (confetti starts at different times).
   - Every position, speed, delay and colour is a fixed number in the arrays below (no random numbers), so it looks the same
     every time and is easy to edit, like the BALLOONS array in MatchReveal.jsx.
   - The dogs are the same drawing as the quiz dog (components/quiz/DogArt.jsx), only the coat colour changes.

   HOW TO EDIT
   - Dogs ............. the ZOOMIES array
   - Confetti ......... the CONFETTI array
   - Paw prints ....... PRINT_AT (where along its run each dog leaves one)
   - Barks ............ ZOOM_BARKS (when, and how deep a voice)
   - How much for each result: LEVELS ("excellent" = full, "good" = smaller, "replay" = the small one for the sitting dog)
   - How long it lasts: ZOOMIES_MS in MatchReveal.jsx */

/* Starting ~90 animations in a single frame makes a slow phone stutter, so the layer starts in three small steps instead:
   the dogs first (right away), the paw prints STAGE_PRINTS_MS later, the confetti STAGE_CONFETTI_MS later. Their own delays are
   shortened by the same amount, so the timeline looks exactly the same: nobody can see the difference, a phone can feel it. */
const STAGE_PRINTS_MS = 50;
const STAGE_CONFETTI_MS = 100;

/* One dog per row.
     variant  coat colour (orange, navy, cream, brown)         size   width in px (the hero is the biggest)
     lane     how far down the screen it runs, in %            dir    'ltr' = left to right, 'rtl' = right to left
     dur      time to cross the screen (ms)                    delay  when it sets off (ms after the layer starts)
     loop     true = does a small loop-the-loop on the way     good   also used in the smaller "Good" version
   Every dog is off the screen again within 2.5 s: the latest finish is delay + dur. */
export const ZOOMIES = [
  { variant: 'orange', size: 104, lane: 70, dir: 'ltr', dur: 1800, delay: 0, loop: true, good: true },     // the hero
  { variant: 'navy', size: 66, lane: 54, dir: 'rtl', dur: 1400, delay: 120, loop: false, good: true },
  { variant: 'cream', size: 60, lane: 82, dir: 'ltr', dur: 2100, delay: 380, loop: false, good: false },
  { variant: 'brown', size: 76, lane: 62, dir: 'rtl', dur: 2200, delay: 250, loop: false, good: true },
  { variant: 'orange', size: 56, lane: 45, dir: 'ltr', dur: 1600, delay: 500, loop: false, good: false },
];

/* Where along its run a dog leaves a paw print: 0 = where it came in, 1 = where it leaves. 5 prints a dog. */
const PRINT_AT = [0.18, 0.32, 0.46, 0.6, 0.74];

/* One piece of confetti per row: [x in %, delay ms, fall time ms, width px, height px, round (1) or rectangle (0),
   colour (index into CONFETTI_COLOURS), sideways drift px, total spin in degrees]. */
const CONFETTI_COLOURS = ['#F5691A', '#FFD9BD', '#011E4A', '#E3ECF7', '#FFFFFF'];
const CONFETTI = [
  [2, 360, 1500, 7, 14, 0, 4, 10, 765], [3.7, 420, 1700, 6, 10, 0, 1, -45, 585], [7.9, 500, 1500, 6, 12, 0, 1, 55, -720], [8.4, 240, 1650, 7, 12, 0, 3, 50, -495],
  [11.3, 240, 1700, 7, 12, 0, 2, -60, -765], [13.5, 500, 1650, 7, 10, 0, 2, 30, 540], [15.9, 300, 1750, 9, 9, 1, 3, -70, 675], [19.8, 240, 1500, 7, 7, 1, 3, -45, 405],
  [22.0, 80, 1400, 8, 8, 1, 1, -65, 405], [24.9, 40, 1500, 7, 14, 0, 0, -55, -765], [26.0, 420, 1800, 6, 14, 0, 0, -40, -360], [29.1, 40, 1800, 7, 12, 0, 2, -35, 675],
  [31.1, 300, 1400, 7, 12, 0, 3, 20, 810], [32.9, 420, 1750, 6, 10, 0, 4, 15, -675], [36.7, 180, 1400, 6, 10, 0, 4, 15, 360], [38.3, 360, 1700, 6, 10, 0, 3, 30, 675],
  [42.1, 500, 1550, 6, 12, 0, 4, -15, 675], [43.8, 240, 1750, 7, 12, 0, 4, -50, 720], [46.2, 420, 1400, 7, 14, 0, 0, -70, 585], [48.0, 240, 1750, 8, 12, 0, 3, -15, -450],
  [51.9, 120, 1600, 6, 14, 0, 3, -5, 495], [53.3, 40, 1750, 8, 14, 0, 4, 0, 630], [56.6, 500, 1750, 8, 8, 1, 1, -5, -405], [59.2, 120, 1800, 8, 14, 0, 1, 55, -630],
  [61.3, 180, 1500, 7, 12, 0, 1, -5, 720], [62.8, 240, 1450, 8, 12, 0, 3, 0, -495], [65.7, 420, 1400, 7, 10, 0, 3, 0, 720], [67.5, 0, 1550, 8, 12, 0, 0, -5, -450],
  [70.0, 300, 1650, 6, 14, 0, 1, 15, 855], [72.6, 40, 1600, 7, 14, 0, 2, 60, 810], [75.6, 0, 1800, 8, 8, 1, 2, -5, -765], [78.0, 0, 1550, 8, 14, 0, 2, 65, 405],
  [79.5, 300, 1650, 9, 9, 1, 4, -35, 540], [82.1, 500, 1600, 7, 7, 1, 0, -5, -495], [84.6, 300, 1700, 7, 14, 0, 1, 45, 855], [88.2, 0, 1500, 7, 7, 1, 0, 20, 630],
  [89.6, 360, 1500, 7, 14, 0, 1, -20, 585], [92.1, 80, 1700, 7, 12, 0, 2, 40, -765], [94.3, 0, 1450, 9, 9, 1, 3, -65, -495], [98, 420, 1500, 7, 14, 0, 2, 60, -810],
];

/* How much of everything each kind of result gets. `dogs` and `confetti` pick from the arrays above. */
const LEVELS = {
  excellent: { dogs: () => true, confetti: () => true },                      // 5 dogs, 40 confetti, 3 barks
  good: { dogs: (d) => d.good, confetti: (_, i) => i % 2 === 0 },             // 3 dogs, 20 confetti, 2 barks
  replay: { dogs: (d) => d.good, confetti: (_, i) => i % 3 === 0 },           // 3 dogs, 14 confetti, no extra barks (tapping the dog already barks)
};

/* The barks. `at` = ms after the layer starts, `pitch` = voice (lower = bigger dog). Only the FIRST entry is
   used now: it plays the real 4-bark flurry recording once (see playZoomiesBark in utils/sounds.js), which
   respects the global mute and BARK_VOLUME. It starts after the drumroll's own bark has finished. */
const ZOOM_BARKS = {
  excellent: [{ at: 700, pitch: 0.8 }, { at: 1250, pitch: 1.15 }, { at: 1800, pitch: 0.95 }],
  good: [{ at: 700, pitch: 0.85 }, { at: 1500, pitch: 1.1 }],
  replay: [],
};

/** How many dogs, confetti pieces and barks a level has (used for the tracking event and the tests). */
export function zoomCounts(level) {
  const L = LEVELS[level] || LEVELS.good;
  // `barks` is what actually SOUNDS (one flurry recording), not how many rows the table has.
  return { dogs: ZOOMIES.filter(L.dogs).length, confetti: CONFETTI.filter(L.confetti).length, barks: Math.min(1, (ZOOM_BARKS[level] || []).length) };
}

/**
 * Schedules the zoomies barks. Returns ONE function that cancels everything: pending barks never play, and any bark that
 * has started is cut off. Call it when the reveal closes. Every sound call is wrapped so a blocked or missing audio
 * context can never break the reveal.
 */
export function startZoomBarks(level) {
  const timers = [];
  const stops = [];
  let stopped = false;
  /* ONE sound for the whole burst. The recording is already a flurry of four barks, so firing it once per
     dog would stack twelve barks on top of each other. The first entry below decides when it starts and
     in what voice; the rest of the table is kept because it still describes the intent. */
  (ZOOM_BARKS[level] || []).slice(0, 1).forEach((b) => {
    timers.push(setTimeout(() => {
      if (stopped) return;
      try {
        const stop = playZoomiesBark(b.pitch);
        if (stop) stops.push(stop);
      } catch { /* sound is a bonus, never a problem */ }
    }, b.at));
  });
  return () => {
    stopped = true;
    timers.forEach(clearTimeout);
    stops.forEach((s) => { try { s(); } catch { /* already finished */ } });
  };
}

/* One paw print = one tiny drawing made of ONE path (a pad and four toes). Few elements keeps the page light. */
const PAW_PATH = 'M6.4 16a5.6 4.6 0 1 0 11.2 0a5.6 4.6 0 1 0-11.2 0zM3.5 10.2a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0-4.6 0zM7.6 6.6a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0-4.8 0zM11.6 6.6a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0-4.8 0zM15.9 10.2a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0-4.6 0z';
const Paw = ({ className, style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
    <path d={PAW_PATH} fill="#011E4A" />
  </svg>
);

/* The dogs, paw prints and confetti. Wrapped in React.memo so React does NOT redo all ~200 elements when something unrelated
   changes (the "See my matches" button appearing, the percentage counting up, or the `go` switch below). */
const Pack = React.memo(function Pack({ level }) {
  const L = LEVELS[level] || LEVELS.good;
  const dogs = ZOOMIES.filter(L.dogs);
  const confetti = CONFETTI.filter(L.confetti);
  return (
    <>
      {confetti.map((c, i) => (
        <span
          key={`c${i}`}
          className="pbzr__conf"
          style={{
            left: `${c[0]}%`, width: c[3], height: c[4], background: CONFETTI_COLOURS[c[6]], borderRadius: c[5] ? '50%' : 2,
            '--d': `${Math.max(0, c[1] - STAGE_CONFETTI_MS)}ms`, '--t': `${c[2]}ms`, '--dx': `${c[7]}px`, '--rot': `${c[8]}deg`,
          }}
        />
      ))}

      {dogs.map((d, i) => {
        const feet = Math.round(d.size * (26 / 35) * 0.9);        // how far below the dog's top its feet are
        return (
          <React.Fragment key={`d${i}`}>
            {PRINT_AT.map((f, k) => (
              <Paw
                key={`p${i}-${k}`}
                className={`pbzr__print pbzr__print--${d.dir}`}
                style={{
                  '--f': f, '--w': `${d.size}px`, '--pd': `${Math.max(0, Math.round(d.delay + f * d.dur) - STAGE_PRINTS_MS)}ms`,
                  top: `calc(${d.lane}% + ${feet + (k % 2 ? 7 : -7)}px)`,     // left and right feet alternate, a little above and below the path
                }}
              />
            ))}
            <span className={`pbzr__dog pbzr__dog--${d.dir}`} style={{ top: `${d.lane}%`, '--w': `${d.size}px`, '--dur': `${d.dur}ms`, '--delay': `${d.delay}ms` }}>
              <span className={`pbzr__loop${d.loop ? ' is-looping' : ''}`}>
                <span className="pbzr__flip"><span className="pbzr__bounce"><DogArt mood="run" running noStyle width={d.size} variant={d.variant} /></span></span>
              </span>
            </span>
          </React.Fragment>
        );
      })}
    </>
  );
});

/**
 * The layer. Put it inside something that is position: fixed or absolute and as big as the screen.
 *   level   'excellent' | 'good' | 'replay'
 *   ms      how long the burst lasts      fadeMs   how long the final fade takes (the caller removes the layer after both)
 *   fixed   true when it is drawn straight onto the page (the replay), false inside the reveal
 *   go      false = the layer is built but every animation is PAUSED and nothing can be seen; true = they all start now.
 *           The reveal builds the layer during the drumroll (when the phone has nothing else to do) and flips `go` the moment
 *           the card appears, so showing the burst costs almost nothing at the busiest moment.
 */
function ZoomiesLayer({ level = 'excellent', ms = 2500, fadeMs = 400, fixed = false, go = true }) {
  // stage 1 = dogs (the moment `go` is true), 2 = + paw prints, 3 = + confetti (see STAGE_* above)
  const [late, setLate] = useState(0);
  useEffect(() => {
    if (!go) return undefined;
    const t2 = setTimeout(() => setLate(2), STAGE_PRINTS_MS);
    const t3 = setTimeout(() => setLate(3), STAGE_CONFETTI_MS);
    return () => { clearTimeout(t2); clearTimeout(t3); };
  }, [go]);
  const stage = go ? Math.max(1, late) : 0;
  const cls = `pbzr${fixed ? ' pbzr--fixed' : ''}${stage >= 1 ? ' is-go' : ''}${stage >= 2 ? ' is-go2' : ''}${stage >= 3 ? ' is-go3' : ''}`;
  return (
    <div className={cls} aria-hidden="true" style={{ '--ms': `${ms}ms`, '--fade': `${fadeMs}ms` }}>
      <style>{DOG_CSS + CSS}</style>
      <Pack level={level} />
    </div>
  );
}

export default React.memo(ZoomiesLayer);

const CSS = `
.pbzr{position:absolute;inset:0;z-index:2;overflow:hidden;pointer-events:none;animation:pbzr-out var(--fade) ease var(--ms) forwards}
.pbzr--fixed{position:fixed;z-index:1200}
/* built early and waiting for the card: everything is paused until its step starts (see the stages in the code above) */
.pbzr:not(.is-go),.pbzr:not(.is-go) .pbzr__dog,.pbzr:not(.is-go) .pbzr__loop,.pbzr:not(.is-go) .pbzr__bounce,.pbzr:not(.is-go) .pbdog *{animation-play-state:paused !important}
.pbzr:not(.is-go2) .pbzr__print{animation-play-state:paused !important}
.pbzr:not(.is-go3) .pbzr__conf{animation-play-state:paused !important}
@keyframes pbzr-out{to{opacity:0}}

.pbzr__dog{position:absolute;left:0;display:block;animation:pbzr-run var(--dur) linear var(--delay) both}
.pbzr__dog--rtl{animation-name:pbzr-run-rtl}
@keyframes pbzr-run{from{transform:translate3d(calc(var(--w) * -1),0,0)}to{transform:translate3d(100vw,0,0)}}
@keyframes pbzr-run-rtl{from{transform:translate3d(100vw,0,0)}to{transform:translate3d(calc(var(--w) * -1),0,0)}}
.pbzr__loop{display:block}
.pbzr__loop.is-looping{animation:pbzr-loop 900ms linear calc(var(--delay) + var(--dur) * 0.3) both}
@keyframes pbzr-loop{0%{transform:translate3d(0,0,0)}12.5%{transform:translate3d(24px,-10px,0)}25%{transform:translate3d(34px,-34px,0)}37.5%{transform:translate3d(24px,-58px,0)}50%{transform:translate3d(0,-68px,0)}62.5%{transform:translate3d(-24px,-58px,0)}75%{transform:translate3d(-34px,-34px,0)}87.5%{transform:translate3d(-24px,-10px,0)}100%{transform:translate3d(0,0,0)}}
.pbzr__dog--rtl .pbzr__flip{transform:scaleX(-1)}
.pbzr__flip{display:block}
.pbzr__bounce{display:block;animation:pbzr-bounce 220ms ease-in-out infinite alternate}
@keyframes pbzr-bounce{from{transform:translateY(0)}to{transform:translateY(-7px)}}

.pbzr__print{position:absolute;display:block;opacity:0;animation:pbzr-print 900ms ease-out var(--pd) both}
.pbzr__print--ltr{left:calc(var(--f) * (100vw + var(--w)) - var(--w) / 2 - 10px);transform:rotate(90deg)}
.pbzr__print--rtl{left:calc(100vw - var(--f) * (100vw + var(--w)) + var(--w) / 2 - 10px);transform:rotate(-90deg)}
@keyframes pbzr-print{0%{opacity:0}10%{opacity:.3}100%{opacity:0}}

.pbzr__conf{position:absolute;top:-18px;display:block;animation:pbzr-conf var(--t) cubic-bezier(.25,.6,.4,1) var(--d) forwards}
@keyframes pbzr-conf{0%{opacity:1;transform:translate3d(0,0,0) rotate(0)}75%{opacity:1}100%{opacity:0;transform:translate3d(var(--dx),calc(100vh + 30px),0) rotate(var(--rot))}}

@media (prefers-reduced-motion:reduce){.pbzr{display:none}}
`;
