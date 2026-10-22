import React, { useEffect, useRef, useState } from 'react';
import DogArt from './DogArt';

/* A small cartoon dog that runs along the top of the quiz progress bar.
   Purely decorative (aria-hidden); the lane that holds it carries the
   progressbar role in QuizFlow.

   Props
     step       1..total, the current screen number
     total      number of screens (12)
     direction  'forward' | 'back'   (back = the dog faces left)
     celebrate  true only for the three "pop" moments (set by QuizFlow)
     mood       'run' (default) | 'tilt' | 'pant' | 'sit' | 'wag', see DogArt.jsx. QuizFlow sets it from the
                answer just given (DOG_REACTIONS in constants/quizSections.js)

   HOW TO EDIT
   - Dog colours and poses: DogArt.jsx.
   - Pop colours: HEARTS below. Pop moments: QuizFlow.jsx (CELEBRATE_AT).
   - Slide time: SLIDE_MS (keep in step with the CSS transition below). */

const HEARTS = [
  { kind: 'heart', colour: '#F5691A', x: -8, delay: 0 },
  { kind: 'paw', colour: '#011E4A', x: 2, delay: 90 },
  { kind: 'heart', colour: '#F5691A', x: 12, delay: 180 },
];
const SLIDE_MS = 500;
const DOG_W = 34;
const BONE_W = 18;

const Pop = ({ kind, colour }) => (
  <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
    {kind === 'heart' ? (
      <path d="M6 10.5S1.5 7.6 1.5 4.6A2.4 2.4 0 0 1 6 3.4a2.4 2.4 0 0 1 4.5 1.2C10.5 7.6 6 10.5 6 10.5z" fill={colour} />
    ) : (
      <g fill={colour}>
        <ellipse cx="6" cy="8" rx="2.6" ry="2.1" />
        <circle cx="2.6" cy="5.4" r="1" /><circle cx="4.8" cy="3" r="1" /><circle cx="7.2" cy="3" r="1" /><circle cx="9.4" cy="5.4" r="1" />
      </g>
    )}
  </svg>
);

const Bone = () => (
  <svg className="pbrd__bone" viewBox="0 0 18 10" width={BONE_W} height="10" aria-hidden="true" fill="#FFFFFF" stroke="#011E4A" strokeWidth="1.3" strokeLinejoin="round">
    <path d="M4.5 1.2a2.2 2.2 0 0 0-3 3.1A2.2 2.2 0 0 0 1.5 5.7 2.2 2.2 0 0 0 4.5 8.8c.4 0 .8-.1 1-.4h7c.2.3.6.4 1 .4a2.2 2.2 0 0 0 3-3.1 2.2 2.2 0 0 0 0-1.4 2.2 2.2 0 0 0-3-3.1c-.4 0-.8.1-1 .4h-7c-.2-.3-.6-.4-1-.4z" />
  </svg>
);

export default function RunningDog({ step, total, direction = 'forward', celebrate = false, mood = 'run' }) {
  const [running, setRunning] = useState(false);
  const first = useRef(true);
  const timer = useRef(null);
  const progress = total > 1 ? Math.min(1, Math.max(0, (step - 1) / (total - 1))) : 0;
  const room = DOG_W + BONE_W + 4;

  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    setRunning(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setRunning(false), SLIDE_MS + 80); // fallback if transitionend never fires
    return () => clearTimeout(timer.current);
  }, [step]);

  return (
    <div className="pbrd" aria-hidden="true">
      <style>{CSS}</style>
      <Bone />
      <div
        className={`pbrd__dog${running ? ' is-running' : ' is-idle'}${direction === 'back' ? ' is-back' : ''}`}
        style={{ left: `calc((100% - ${room}px) * ${progress})` }}
        onTransitionEnd={(e) => { if (e.propertyName === 'left') setRunning(false); }}
      >
        <DogArt mood={mood} running={running && mood !== 'sit'} idle={!running && mood === 'run'} width={DOG_W} />
        {celebrate && (
          <span className="pbrd__pops">
            {HEARTS.map((h, i) => (
              <i key={i} style={{ left: 12 + h.x, animationDelay: `${h.delay}ms` }}><Pop kind={h.kind} colour={h.colour} /></i>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

const CSS = `
.pbrd{position:relative;height:28px;width:100%;pointer-events:none;overflow:visible}
.pbrd__bone{position:absolute;right:0;bottom:2px}
.pbrd__dog{position:absolute;bottom:0;width:${DOG_W}px;height:26px;transition:left ${SLIDE_MS}ms cubic-bezier(.4,0,.2,1)}
.pbrd__dog .pbdog{transform-origin:50% 100%}
.pbrd__dog.is-back .pbdog{transform:scaleX(-1)}
.pbrd__pops{position:absolute;left:0;top:0;width:100%;height:100%}
.pbrd__pops i{position:absolute;top:2px;display:block;opacity:0;animation:pbrd-pop .7s ease-out both}
@keyframes pbrd-pop{0%{opacity:0;transform:translateY(2px) scale(.6)}25%{opacity:1}100%{opacity:0;transform:translateY(-10px) scale(1)}}
@media (max-width:339px){.pbrd__dog{transform:scale(.8);transform-origin:0 100%}}
@media (prefers-reduced-motion:reduce){
  .pbrd__dog{transition:none}
  .pbrd__pops{display:none}
}
`;
