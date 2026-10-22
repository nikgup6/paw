import React, { useEffect, useRef } from 'react';
import { HandIcon, ArrowLeftIcon, ArrowRightIcon } from './swipeIcons';

/* Three-step coach overlay shown over the REAL first card. The card itself
   nudges / shows its stamps (BreedSwipe passes `demo` to SwipeCard); this
   component draws the scrim, the hand and the instruction panel.
   Edit the wording in STEPS below. */

const STEPS = [
  { title: 'Swipe right to shortlist', body: 'Drag the card to the right, or tap the heart.' },
  { title: 'Swipe left to pass', body: 'Drag the card to the left, or tap the X.' },
  { title: 'Tap a card for the full story', body: 'Costs, space, health and why it fits you are all inside.' },
];
const HONEST = {
  withAnswers: 'The % is how well a breed fits YOUR quiz answers. Not how cute it is.',
  noAnswers: 'Take the 2-minute quiz to see how well each breed fits you.',
};

export default function SwipeTutorial({ step, onStep, onClose, hasAnswers, reduced }) {
  const next = useRef(null);
  useEffect(() => { next.current?.focus({ preventScroll: true }); }, [step]);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="pbsw__tut" role="dialog" aria-modal="true" aria-label="How to use Breed Swipe">
      <button type="button" className="pbsw__tutskip" onClick={() => onClose()}>Skip</button>

      {step < 2 && (
        <div className={`pbsw__hand ${step === 0 ? 'is-right' : 'is-left'}${reduced ? ' is-static' : ''}`} aria-hidden="true">
          {reduced ? (step === 0 ? <ArrowRightIcon size={56} /> : <ArrowLeftIcon size={56} />) : <HandIcon size={56} />}
        </div>
      )}
      {step === 2 && (
        <div className="pbsw__peek" aria-hidden="true">
          <span className="pbsw__peekhandle" />
          <strong>Why it matches you</strong>
          <span>Costs, space, health and more</span>
        </div>
      )}

      <div className="pbsw__coach">
        <p className="pbsw__coachstep">Step {step + 1} of {STEPS.length}</p>
        <h2>{s.title}</h2>
        <p>{s.body}</p>
        {last && <p className="pbsw__honest">{hasAnswers ? HONEST.withAnswers : HONEST.noAnswers}</p>}
        <button type="button" className="pbsw__primary" ref={next} onClick={() => (last ? onClose() : onStep(step + 1))}>
          {last ? "Got it, let's go" : 'Next'}
        </button>
      </div>
    </div>
  );
}
