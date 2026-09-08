import React, { useState } from 'react';

/* Five paws, cumulative fill — Q6 of the owner survey.

   A paw rather than a star because the rest of the product is paw-shaped, and
   there was no paw in the design system to reuse (only the hero's PNG art), so
   this is a flat inline SVG.

   Deliberately not a 1-10 scale: five options is the range people can hold in
   their head at a glance, and the fill pattern reads as a rating without a
   legend. Tap targets are 48px and nothing depends on hover, because this form
   is mostly going to be filled on a phone. */

const PawIcon = ({ filled, size = 30 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
    {/* four toes + pad; one path set, filled or outlined by state */}
    <g
      fill={filled ? 'var(--orange)' : 'none'}
      stroke={filled ? 'var(--orange)' : '#C9BCB0'}
      strokeWidth="1.4"
    >
      <ellipse cx="6.5" cy="8.5" rx="2.4" ry="3.1" />
      <ellipse cx="11" cy="5.6" rx="2.5" ry="3.3" />
      <ellipse cx="16.2" cy="6.4" rx="2.4" ry="3.1" />
      <ellipse cx="20" cy="10.6" rx="2.1" ry="2.7" />
      <path d="M12.4 12.2c3.1 0 5.9 2.3 5.9 5.1 0 2.2-1.9 3.4-4 3.4-1.2 0-1.6-.4-2.6-.4s-1.4.4-2.6.4c-2.1 0-4-1.2-4-3.4 0-2.8 2.8-5.1 5.9-5.1Z" />
    </g>
  </svg>
);

const LABELS = ['Not at all', 'Not really', 'It’s okay', 'Happy', 'Perfect fit'];

/* `label` names THIS rating for a screen reader. It defaults to the owner
   survey's original wording so that call site is unchanged, but it has to be
   settable: the feedback modal renders five of these at once, and five
   radiogroups all announcing "Satisfaction with this breed" is unusable. */
const PawRating = ({ value, onChange, label = 'Satisfaction with this breed', readOnly = false, size }) => {
  //: Which paw just got tapped — drives the one-shot pop + emoji, then clears
  //  itself so the animation can replay on the next tap. (Declared before the
  //  read-only early return so the hook order is stable per the Rules of Hooks.)
  const [burst, setBurst] = useState(null);

  /* Read-only display mode: the same five paws, filled to `value`, but not a
     control — no buttons, no tap targets, no burst, no "Tap to rate" label.
     Used to show a fixed breed rating (e.g. the "ideal conditions" step on the
     Results page). Deliberately a separate render path so the interactive
     survey/feedback callers are untouched. */
  if (readOnly) {
    const px = size || 22;
    const v = Number(value) || 0;
    return (
      <span className="pawrate-ro" role="img" aria-label={`${v} out of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <PawIcon key={n} filled={v >= n} size={px} />
        ))}
        <style>{`
          .pawrate-ro { display: inline-flex; align-items: center; gap: 2px; line-height: 0; }
        `}</style>
      </span>
    );
  }

  const pick = (rating) => {
    onChange(rating);
    setBurst(rating);
    window.setTimeout(() => setBurst((b) => (b === rating ? null : b)), 700);
  };

  return (
    <div className="pawrate">
      <div className="pawrate__row" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} out of 5 — ${LABELS[n - 1]}`}
            className={`pawrate__paw ${value >= n ? 'is-on' : ''} ${burst === n ? 'is-burst' : ''}`}
            onClick={() => pick(n)}
          >
            <PawIcon filled={value >= n} />
            {burst === n && <span className="pawrate__pop" aria-hidden="true">🐶</span>}
          </button>
        ))}
      </div>

      {/* Reserves its own line so picking a rating never shifts the layout. */}
      <p className="pawrate__label">{value ? LABELS[value - 1] : 'Tap to rate'}</p>

      <style>{`
        .pawrate { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
        .pawrate__row { display: flex; gap: 4px; }
        .pawrate__paw {
          position: relative;
          /* 48px keeps every paw a comfortable thumb target on a phone; the
             icon inside is 30px and the rest is padding. */
          width: 48px; height: 48px;
          display: flex; align-items: center; justify-content: center;
          border: none; background: none; padding: 0; cursor: pointer;
          border-radius: 12px;
          transition: transform .18s cubic-bezier(.16,1,.3,1), background-color .18s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .pawrate__paw:active { transform: scale(.9); }
        .pawrate__paw:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }

        /* Hover is a bonus, never the mechanism — touch devices get nothing
           from it and must not need it. */
        @media (hover: hover) {
          .pawrate__paw:hover { background: var(--orange-pale, #FDF1E8); }
        }

        .pawrate__paw.is-burst { animation: pawPop .45s cubic-bezier(.16,1,.3,1); }
        @keyframes pawPop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.32); }
          70%  { transform: scale(.94); }
          100% { transform: scale(1); }
        }

        .pawrate__pop {
          position: absolute; top: -14px; left: 50%;
          font-size: 20px; pointer-events: none;
          animation: pawEmoji .7s ease-out forwards;
        }
        @keyframes pawEmoji {
          0%   { opacity: 0; transform: translate(-50%, 4px) scale(.6); }
          30%  { opacity: 1; transform: translate(-50%, -8px) scale(1.1); }
          100% { opacity: 0; transform: translate(-50%, -26px) scale(1); }
        }

        .pawrate__label {
          margin: 0; padding-left: 4px; min-height: 18px;
          font-family: var(--font-body-family); font-size: 13px; font-weight: var(--weight-regular);
          color: ${'' /* muted until they choose, so it reads as a prompt */}
            var(--text-soft);
        }

        @media (prefers-reduced-motion: reduce) {
          .pawrate__paw, .pawrate__paw.is-burst { animation: none; transition: none; }
          .pawrate__pop { animation: none; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default PawRating;
