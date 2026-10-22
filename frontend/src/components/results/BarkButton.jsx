import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { isMuted, onMuteChange, playBreedBark, primeAudio } from '../../utils/sounds';
import { isBarkLocked, onBarkUnlock } from '../../utils/barkUnlocks';
import { track } from '../../utils/analytics';

/* "Hear it" button for a breed's bark.

   - Plays only after a tap (never autoplays), through the shared audio helper in utils/sounds.js.
   - If the site is muted it does nothing audible (and says so in its label).
   - A breed the game has not unlocked yet shows a lock and "Unlock in the game", linking to /play.
     The matched #1 breed on the results page passes `alwaysUnlocked` and is never locked.

   Props: breed ({ name, size }), source ('result' | 'carousel'), alwaysUnlocked (bool), tone ('light' | 'dark'). */

const SpeakerIcon = ({ off }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    {off ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />}
  </svg>
);
const LockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </svg>
);

export default function BarkButton({ breed, source = 'result', alwaysUnlocked = false, tone = 'light' }) {
  const [, force] = useState(0);
  const [muted, setMutedState] = useState(isMuted());
  useEffect(() => onBarkUnlock(() => force((n) => n + 1)), []);
  useEffect(() => onMuteChange(setMutedState), []);
  if (!breed) return null;

  const locked = isBarkLocked(breed.name, alwaysUnlocked ? breed.name : null);

  if (locked) {
    return (
      <>
        <style>{CSS}</style>
        <Link to="/play" className={`pbbk pbbk--${tone} is-locked`} data-html2canvas-ignore="true" aria-label={`Unlock the ${breed.name} bark in the game`} onClick={(e) => e.stopPropagation()}>
          <LockIcon /><span>Unlock in the game</span>
        </Link>
      </>
    );
  }

  const play = (e) => {
    e?.stopPropagation(); // the button often sits inside a clickable breed card: only the bark should happen
    primeAudio(); // the first tap lets the browser start sound
    if (playBreedBark({ breed: breed.name, size: breed.size })) track('bark_played', { breed: breed.name, source });
  };

  return (
    <>
      <style>{CSS}</style>
      <button
        type="button"
        className={`pbbk pbbk--${tone}`}
        data-html2canvas-ignore="true"
        aria-label={muted ? `Hear the ${breed.name} bark (sound is off)` : `Hear the ${breed.name} bark`}
        onClick={play}
      >
        <SpeakerIcon off={muted} /><span>Hear it</span>
      </button>
    </>
  );
}

const CSS = `
.pbbk{box-sizing:border-box;min-height:36px;padding:0 12px;display:inline-flex;align-items:center;gap:6px;border-radius:999px;font:700 13px 'Satoshi',system-ui,sans-serif;text-decoration:none;cursor:pointer;border:1.5px solid #011E4A;background:#fff;color:#011E4A;-webkit-tap-highlight-color:transparent}
.pbbk--dark{background:rgba(255,255,255,.16);color:#fff;border-color:rgba(255,255,255,.7)}
.pbbk.is-locked{border-style:dashed;opacity:.92}
.pbbk:active{transform:scale(.96)}
.pbbk:focus-visible{outline:3px solid #011E4A;outline-offset:2px}
.pbbk--dark:focus-visible{outline-color:#fff}
/* 36px is comfortable with a mouse; a fingertip needs 44. */
@media (pointer:coarse){.pbbk{min-height:44px;padding:0 14px}}
`;
