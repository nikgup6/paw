import React, { useEffect, useRef, useState } from 'react';

/* The round PAW BUDDY button that sits in the bottom corner of the results and fans out the three
   places people want next: Retake quiz, Compare breeds, Tinder.

   It replaces the old floating "Retake Quiz" pill, which could only do one thing and was wide enough to
   sit on top of the cards' own buttons on a narrow phone.

   HOW IT BEHAVES
   - Tap the paw to open, tap it again (or Escape, or anywhere outside) to close.
   - The shortcuts come in as a short stagger, bottom-up, so it reads as a fan opening. Under
     prefers-reduced-motion they simply appear.
   - `tucked` hides the whole thing — the results page passes true once the end-of-page card with the
     same buttons is on screen, so this never covers the footer.

   HOW TO EDIT
   - The shortcuts: the `items` prop from RecommendationResults ([{ key, label, onClick }], top to bottom).
   - Size / position / colours: the CSS at the bottom of this file. */

const PawIcon = () => (
  <svg viewBox="0 0 30 30" width="26" height="26" aria-hidden="true" fill="currentColor">
    <ellipse cx="6" cy="10" rx="3.2" ry="4.1" />
    <ellipse cx="11.5" cy="4.6" rx="3.3" ry="4.3" />
    <ellipse cx="18.5" cy="4.6" rx="3.3" ry="4.3" />
    <ellipse cx="24" cy="10" rx="3.2" ry="4.1" />
    <path d="M15 13.5c-4.6 0-8.5 4.4-8.5 8.3 0 2.6 2 3.9 4.4 3.9 1.7 0 2.5-.8 4.1-.8s2.4.8 4.1.8c2.4 0 4.4-1.3 4.4-3.9 0-3.9-3.9-8.3-8.5-8.3Z" />
  </svg>
);

export default function InfoFan({ items = [], tucked = false, label = 'More things to try' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);

  /* While it is tucked away the menu counts as closed, so its buttons leave the DOM entirely and
     cannot be reached by Tab behind the card that replaced it. Derived rather than stored, so there is
     no second copy of the truth to keep in step. */
  const isOpen = open && !tucked;

  // Escape closes and hands focus back to the paw; a tap anywhere else just closes.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setOpen(false);
      requestAnimationFrame(() => btnRef.current?.focus({ preventScroll: true }));
    };
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [isOpen]);

  if (!items.length) return null;

  return (
    <div
      className={`pbfan${tucked ? ' is-tucked' : ''}${isOpen ? ' is-open' : ''}`}
      ref={wrapRef}
      data-html2canvas-ignore="true"
    >
      <style>{CSS}</style>

      {isOpen && (
        <ul className="pbfan__list" role="menu" aria-label={label}>
          {items.map((it, i) => (
            <li key={it.key} style={{ '--i': items.length - 1 - i }}>
              <button
                type="button"
                role="menuitem"
                className="pbfan__item"
                onClick={() => { setOpen(false); it.onClick(); }}
              >
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        ref={btnRef}
        className="pbfan__paw"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={isOpen ? 'Close' : label}
        tabIndex={tucked ? -1 : 0}
        onClick={() => setOpen((o) => !o)}
      >
        <PawIcon />
      </button>
    </div>
  );
}

const CSS = `
.pbfan{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:1400;display:flex;flex-direction:column;align-items:flex-end;gap:10px;font-family:'Satoshi',system-ui,sans-serif;transition:opacity .25s ease,transform .25s ease}
.pbfan.is-tucked{opacity:0;pointer-events:none;transform:translateY(12px) scale(.96)}
.pbfan *,.pbfan *::before,.pbfan *::after{box-sizing:border-box}
.pbfan__paw{width:58px;height:58px;border:0;border-radius:50%;background:#F5691A;color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 10px 28px rgba(208,92,25,.42);transition:transform .2s ease}
.pbfan__paw:active{transform:scale(.95)}
.pbfan.is-open .pbfan__paw{transform:rotate(45deg)}
.pbfan__paw:focus-visible{outline:3px solid #011E4A;outline-offset:3px}
.pbfan__list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;align-items:flex-end;gap:8px}
.pbfan__item{min-height:44px;padding:0 18px;border:1.5px solid #011E4A;border-radius:999px;background:#fff;color:#011E4A;font:700 14px 'Satoshi',sans-serif;white-space:nowrap;cursor:pointer;box-shadow:0 6px 18px rgba(1,30,74,.16);animation:pbfan-in .22s cubic-bezier(.3,1.3,.5,1) both;animation-delay:calc(var(--i) * 45ms)}
.pbfan__item:active{transform:scale(.97)}
.pbfan__item:focus-visible{outline:3px solid #011E4A;outline-offset:2px}
@keyframes pbfan-in{from{opacity:0;transform:translateY(10px) scale(.92)}to{opacity:1;transform:none}}
@media (min-width:768px){.pbfan{right:24px;bottom:calc(24px + env(safe-area-inset-bottom))}}
@media (prefers-reduced-motion:reduce){
  .pbfan,.pbfan__paw,.pbfan__item{transition:none;animation:none}
  .pbfan.is-tucked{transform:none}
  .pbfan.is-open .pbfan__paw{transform:none}
}
`;
