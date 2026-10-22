import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DogArt from '../quiz/DogArt';

/* The "Hiii!" dog: when the website opens, the PAW BUDDY dog runs up into the bottom-left corner, hops, wags and says
   "Hiii!" in a speech bubble for a few seconds, then trots off again. It is only a greeting and it NEVER blocks the page:
   taps and clicks go straight through it to whatever is underneath (the breed thumbnails, a squeaky toy, the buttons).

   WHEN IT SHOWS
   - Home mounts it on the landing page, after the loading screen has gone. Quiz, results, lead forms never get it.
   - Once per page load (reload the page and it greets you again). A module variable remembers it, nothing is stored.
   - It waits for the tab to be visible, so a site opened in a background tab is not greeted to nobody.
   - Reduced motion: no sliding, hopping or wagging, the dog and bubble just appear and disappear.

   HOW TO EDIT
   - The word in the bubble ... COPY.hi.   - How long it stays ... HOLD_MS.   - Corner / size ... the CSS at the bottom.

   (This replaces the old corner mascot, PawBuddyMascot.jsx, which was taken off the landing page and still points at a
   mascot.png that was never added. That file is left alone.) */

const COPY = { hi: 'Hiii!', sr: 'Hi! Welcome to Paw Buddy.' };
const WAIT_MS = 700;      // after the loading screen: let the landing page finish fading in first
const HOLD_MS = 5200;     // how long the dog stays once it has arrived
const SLIDE_MS = 480;     // run in / trot off

let greetedThisLoad = false;   // one greeting per page load, even if the landing page is left and come back to

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function HiDog() {
  const [stage, setStage] = useState(greetedThisLoad ? 'gone' : 'wait');   // 'wait' | 'in' | 'out' | 'gone'
  const [reduced] = useState(prefersReducedMotion);
  const timers = useRef([]);

  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };

  useEffect(() => {
    if (greetedThisLoad) return undefined;
    let cancelled = false;
    const run = () => {
      if (cancelled || greetedThisLoad) return;
      greetedThisLoad = true;
      setStage('in');
      later(() => setStage('out'), SLIDE_MS + HOLD_MS);
      later(() => setStage('gone'), SLIDE_MS + HOLD_MS + SLIDE_MS);
    };
    let onVisible = null;
    later(() => {
      if (typeof document !== 'undefined' && document.hidden) {
        onVisible = () => { if (!document.hidden) { document.removeEventListener('visibilitychange', onVisible); run(); } };
        document.addEventListener('visibilitychange', onVisible);
      } else run();
    }, WAIT_MS);
    return () => {
      cancelled = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      if (onVisible) document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  /* Once the page is moving the greeting has done its job, so the dog trots off early instead of riding along the
     corner over the sections below (on a phone that corner is busy: the sticky "Find my dog" bar lives there). */
  useEffect(() => {
    if (stage !== 'in') return undefined;
    const from = window.scrollY;
    const onScroll = () => {
      if (Math.abs(window.scrollY - from) < 40) return;
      window.removeEventListener('scroll', onScroll);
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setStage('out');
      later(() => setStage('gone'), SLIDE_MS);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [stage]);

  if (stage === 'wait' || stage === 'gone') return null;

  return createPortal(
    <div className={`pbhi pbhi--${stage}${reduced ? ' is-still' : ''}`} role="status">
      <style>{CSS}</style>
      <span className="pbhi__sr">{COPY.sr}</span>
      <div className="pbhi__art" aria-hidden="true">
        <span className="pbhi__bubble">{COPY.hi}</span>
        <span className="pbhi__dog"><DogArt mood="wag" width={92} /></span>
      </div>
    </div>,
    document.body,
  );
}

const CSS = `
.pbhi{position:fixed;left:max(10px,env(safe-area-inset-left));bottom:max(14px,env(safe-area-inset-bottom));z-index:60;pointer-events:none;
  transition:transform ${SLIDE_MS}ms cubic-bezier(.3,1.35,.5,1),opacity ${SLIDE_MS}ms ease}
.pbhi--in{transform:translateX(0);opacity:1;animation:pbhi-run-in ${SLIDE_MS}ms cubic-bezier(.3,1.2,.5,1) both}
.pbhi--out{transform:translateX(-140%);opacity:0}
@keyframes pbhi-run-in{from{transform:translateX(-140%);opacity:0}to{transform:translateX(0);opacity:1}}
.pbhi__sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.pbhi__art{position:relative;display:block}
.pbhi__dog{display:block;animation:pbhi-hop .5s ease-in-out ${SLIDE_MS}ms 3}
@keyframes pbhi-hop{0%,100%{transform:translateY(0)}40%{transform:translateY(-12px)}}
.pbhi__bubble{position:absolute;left:46px;bottom:100%;margin-bottom:4px;padding:6px 14px 7px;border-radius:18px;background:#fff;border:2.5px solid #011E4A;
  box-shadow:0 6px 16px rgba(1,30,74,.16);font:700 22px/1.1 'Fredoka','Satoshi',sans-serif;color:#011E4A;white-space:nowrap;
  transform-origin:12% 100%;animation:pbhi-pop .42s cubic-bezier(.3,1.5,.5,1) ${SLIDE_MS + 120}ms both}
.pbhi__bubble::after{content:'';position:absolute;left:14px;top:100%;width:14px;height:14px;margin-top:-9px;background:#fff;border-right:2.5px solid #011E4A;border-bottom:2.5px solid #011E4A;transform:skewX(-20deg) rotate(45deg)}
@keyframes pbhi-pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
@media (min-width:768px){.pbhi{left:max(22px,env(safe-area-inset-left));bottom:max(22px,env(safe-area-inset-bottom))}.pbhi__bubble{font-size:26px;left:54px}.pbhi__dog svg{width:112px;height:auto}}
/* Phones: sit in the very corner. It used to be lifted 76px to clear the sticky "Find my dog" bar, but
   the hero now fits on one screen, so that bar only appears once the page is scrolled — and this dog
   leaves as soon as it is. Lifting it any higher would park it on the main button instead. */
/* On a phone the hero now fills the screen exactly, so the bottom corner belongs to the trust row.
   Dropping the greeting below the hero's own text (which sits at z-index 1) lets the dog trot in
   BEHIND the words: nothing is covered, and it still reads as a dog arriving. */
@media (max-width:767px){.pbhi{left:4px;bottom:max(6px,env(safe-area-inset-bottom));z-index:0}.pbhi__dog svg{width:58px;height:auto}.pbhi__bubble{left:24px;font-size:16px;padding:4px 10px 5px}}
/* short phones: smaller again, so it stays in the gutter beside the trust row */
@media (max-width:767px) and (max-height:680px){.pbhi{left:4px}.pbhi__dog svg{width:50px}.pbhi__bubble{left:22px;font-size:15px;padding:3px 9px 4px}}
@media (prefers-reduced-motion:reduce){.pbhi,.pbhi--in,.pbhi--out{animation:none;transition:none;transform:none}.pbhi--out{opacity:0}.pbhi__dog,.pbhi__bubble{animation:none}}
`;
