import React, { Suspense, lazy, useRef, useState } from 'react';
import { noExcellentMatch } from '../../../utils/breedUtils';
import { track } from '../../../utils/analytics';

// The sheet (avatar art, html2canvas card, share logic) is code-split: it downloads when the button is first used.
const loadSheet = () => import('./AvatarSheet');
const AvatarSheet = lazy(loadSheet);

/* "See us together" on the Top-5 results: a share card with the user's illustrated avatar on a sofa next to
   their #1 matched dog. Version one is all in the browser:
     - the avatar is drawn in code from constants/avatarOptions.js (no selfie, no AI, no server)
     - the dog is the breed's existing photo from public/assets (a drawn dog if a photo is missing)
     - sharing and the image export are the SAME system "Share my matches" uses (shareFlow.jsx)

   PRIVACY: the name lives in this component's state only. It is never stored, logged or put in an event.
   The only things sent anywhere are the analytics events below, which carry the breed and share method.

   Events: avatar_card_opened, avatar_card_created {breed}, avatar_card_shared {method}, avatar_card_downloaded. */

const PairIcon = () => (
  <svg width="22" height="20" viewBox="0 0 26 22" fill="none" stroke="#011E4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <circle cx="8" cy="7" r="3.4" />
    <path d="M2 19c.6-4 3-6 6-6s5.4 2 6 6" />
    <path d="M16.5 10.5c2.2-2 5.4-1.2 6 1.4.4 1.7-.6 3.2-2.2 4.1L16.5 18l-3.6-2c-1.6-.9-2.6-2.4-2.2-4.1.6-2.6 3.8-3.4 5.8-1.4z" transform="translate(1.6 -2.4) scale(.8)" />
  </svg>
);

export default function AvatarCardButton({ matches }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const top = matches && matches[0];

  // With no excellent match we claim no breed, so there is no "us together" card to make.
  if (!top || noExcellentMatch(matches)) return null;

  const openSheet = () => { track('avatar_card_opened'); setOpen(true); };

  return (
    <>
      <style>{BTN_CSS}</style>
      <button type="button" ref={btnRef} className="pbav__btn" aria-label="See us together" title="See us together" onClick={openSheet} onPointerEnter={loadSheet} onFocus={loadSheet}>
        <PairIcon />
        <span className="pbav__label">See us together</span>
      </button>
      {open && (
        <Suspense fallback={null}>
          <AvatarSheet top={top} onClose={() => setOpen(false)} returnFocusRef={btnRef} />
        </Suspense>
      )}
    </>
  );
}

const BTN_CSS = `
.pbav__btn{position:relative;box-sizing:border-box;min-width:44px;height:40px;padding:0 11px;display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#FFFFFF;color:#011E4A;border:1.5px solid #011E4A;border-radius:50px;cursor:pointer;font:600 13px var(--font-display,'Satoshi',sans-serif)}
.pbav__btn::after{content:'';position:absolute;inset:-2px 0}
.pbav__btn:focus-visible{outline:3px solid #011E4A;outline-offset:2px}
.pbav__label{display:none;white-space:nowrap}
@media (min-width:480px){.pbav__btn{padding:0 14px}.pbav__label{display:inline}}
`;

