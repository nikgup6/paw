import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { flagLabel, NOT_RECOMMENDED_LABEL } from '../../utils/breedUtils';
import { cardLine, factChips, ringColour } from '../../utils/swipeFacts';
import { HeartIcon, XIcon, InfoIcon, AlertIcon } from './swipeIcons';

/* One breed card. Two exports:
   - default SwipeCard: the draggable top card
   - BehindCard: the next card, slightly smaller, growing as the top one leaves.

   The % and label are the engine's own (computeMatches). With no quiz answers
   there is no number at all, only a chip that sends people to the quiz. */

/** The match ring (or the "take the quiz" chip). Also used in the info sheet header. */
export function MatchBadge({ breed, hasAnswers, onTakeQuiz }) {
  if (!hasAnswers) {
    return (
      <button type="button" className="pbsw__quizchip" onClick={(e) => { e.stopPropagation(); onTakeQuiz?.(); }}>
        Take the 2-min quiz to see your match %
      </button>
    );
  }
  const colour = ringColour(breed.label);
  return (
    <div className="pbsw__ringwrap">
      <div className="pbsw__ring" style={{ borderColor: colour }}>
        <span>{breed.matchPercentage}%</span>
      </div>
      <span className="pbsw__ringlabel" style={{ background: colour }}>{breed.label}</span>
    </div>
  );
}

function CardFace({ breed, hasAnswers, eager, onInfo, onTakeQuiz, demo, children }) {
  const notRecommended = hasAnswers && breed.label === NOT_RECOMMENDED_LABEL;
  const flag = hasAnswers && breed.flags && breed.flags[0];
  return (
    <div className={`pbsw__face${demo ? ` is-demo-${demo}` : ''}`}>
      <img
        className="pbsw__photo"
        src={`/${breed.img}`}
        alt={breed.name}
        width="600"
        height="800"
        loading={eager ? 'eager' : 'lazy'}
        draggable={false}
      />
      <div className="pbsw__shade" aria-hidden="true" />

      <div className="pbsw__tags">
        {notRecommended && <span className="pbsw__tag pbsw__tag--red"><AlertIcon size={14} /> Not a good fit for you</span>}
        {flag && <span className="pbsw__tag pbsw__tag--amber">{flagLabel(flag)}</span>}
      </div>

      <div className="pbsw__badge"><MatchBadge breed={breed} hasAnswers={hasAnswers} onTakeQuiz={onTakeQuiz} /></div>

      <div className="pbsw__info">
        <h2 className="pbsw__name">{breed.name}</h2>
        <p className="pbsw__line">{cardLine(breed)}</p>
        <ul className="pbsw__facts">
          {factChips(breed).map((f) => <li key={f}>{f}</li>)}
        </ul>
      </div>

      <button type="button" className="pbsw__ibtn" aria-label={`More about ${breed.name}`} onClick={(e) => { e.stopPropagation(); onInfo(); }}>
        <InfoIcon size={22} />
      </button>
      {children}
    </div>
  );
}

export function BehindCard({ breed, hasAnswers, scale, onTakeQuiz }) {
  return (
    <motion.div className="pbsw__card pbsw__card--behind" style={{ scale }} aria-hidden="true" inert>
      <CardFace breed={breed} hasAnswers={hasAnswers} eager={false} onInfo={() => {}} onTakeQuiz={onTakeQuiz} />
    </motion.div>
  );
}

export default function SwipeCard({ breed, hasAnswers, x, command, onCommit, onInfo, onTakeQuiz, reduced, demo }) {
  const busy = useRef(false);
  const dragged = useRef(false);        // true once the finger/mouse has really moved
  const mountedAt = useRef(Date.now()); // a card that has just appeared must not take the old card's tap
  const opacity = useMotionValue(1);
  const rotate = useTransform(x, [-220, 0, 220], [-12, 0, 12]);
  const yes = useTransform(x, [20, 110], [0, 1]);
  const no = useTransform(x, [-110, -20], [1, 0]);

  const fly = (dir) => {
    if (busy.current) return;
    busy.current = true;
    if (reduced) {
      animate(opacity, 0, { duration: 0.15, onComplete: () => onCommit(dir) });
    } else {
      animate(x, dir * (window.innerWidth + 240), { duration: 0.25, ease: 'easeIn', onComplete: () => onCommit(dir) });
    }
  };

  // Button / keyboard swipes arrive as a command with a fresh id.
  useEffect(() => {
    if (command) fly(command.dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.id]);

  const onDragEnd = (_, info) => {
    const { offset, velocity } = info;
    if (Math.abs(offset.x) > 110) fly(offset.x > 0 ? 1 : -1);
    else if (Math.abs(velocity.x) > 500) fly(velocity.x > 0 ? 1 : -1);
    else animate(x, 0, { type: 'spring', stiffness: 420, damping: 32 });
  };

  return (
    <motion.div
      className="pbsw__card pbsw__card--top"
      style={{ x, rotate: reduced ? 0 : rotate, opacity, touchAction: 'pan-y' }}
      drag="x"
      dragMomentum={false}
      dragElastic={0.9}
      onDragStart={() => { dragged.current = true; }}
      onDragEnd={onDragEnd}
      onPointerDownCapture={() => { dragged.current = false; }}
      onTap={(e) => {
        // Only a real tap opens the profile. A swipe (even a short or failed one) never does.
        if (dragged.current || Date.now() - mountedAt.current < 450) return;
        if (!(e.target && e.target.closest && e.target.closest('button'))) onInfo();
      }}
    >
      <CardFace breed={breed} hasAnswers={hasAnswers} eager onInfo={onInfo} onTakeQuiz={onTakeQuiz} demo={demo}>
        <motion.span className="pbsw__stamp pbsw__stamp--yes" style={{ opacity: yes }} aria-hidden="true">
          <HeartIcon size={22} filled /> SHORTLIST
        </motion.span>
        <motion.span className="pbsw__stamp pbsw__stamp--no" style={{ opacity: no }} aria-hidden="true">
          <XIcon size={22} /> PASS
        </motion.span>
      </CardFace>
    </motion.div>
  );
}
