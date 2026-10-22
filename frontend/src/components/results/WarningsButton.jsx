import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/* One "Warnings" button for the top of the Top-5 results, instead of several boxes
   stacked above the first card.

   `items` is a list of { id, tone: 'warn' | 'note', node } where `node` is the
   box to show inside the panel. The button blinks softly while there is at least
   one warning (it stays still under reduced motion), and carries a count so
   nobody misses that something needs reading. Nothing is hidden for good:
   every message is one tap away, and the panel opens on the same page.

   HOW TO EDIT
   - Button wording: BUTTON_LABEL / NOTES_LABEL below.
   - Blink speed: the `pbwn-blink` keyframes in CSS (1.6s). */

const BUTTON_LABEL = 'Warnings';
const NOTES_LABEL = 'Good to know';

const AlertIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M12 3.5L21 19H3z" /><path d="M12 10v4M12 16.8v.01" />
  </svg>
);

export default function WarningsButton({ items }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  const warnCount = items.filter((i) => i.tone === 'warn').length;

  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => { try { btnRef.current?.focus({ preventScroll: true }); } catch { /* gone */ } });
  };

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const f = [...panelRef.current.querySelectorAll('button:not([disabled]), a[href]')];
      if (!f.length) return;
      const first = f[0]; const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!items.length) return null;

  return (
    <>
      <style>{CSS}</style>
      <div className="pbwn__row">
        <button
          type="button"
          ref={btnRef}
          className={`pbwn__btn${warnCount ? ' is-warn' : ''}`}
          aria-haspopup="dialog"
          aria-label={warnCount ? `${BUTTON_LABEL}: ${warnCount} to read` : NOTES_LABEL}
          onClick={() => setOpen(true)}
        >
          <AlertIcon />
          <span>{warnCount ? BUTTON_LABEL : NOTES_LABEL}</span>
          {warnCount > 0 && <b className="pbwn__count">{warnCount}</b>}
        </button>
      </div>

      {open && createPortal(
        <div className="pbwn__wrap" onClick={close}>
          <div className="pbwn__panel" ref={panelRef} role="dialog" aria-modal="true" aria-label={warnCount ? BUTTON_LABEL : NOTES_LABEL} onClick={(e) => e.stopPropagation()}>
            <h2 className="pbwn__title">{warnCount ? 'Before you decide' : NOTES_LABEL}</h2>
            <div className="pbwn__list">
              {items.map((i) => <div key={i.id}>{i.node}</div>)}
            </div>
            <button type="button" className="pbwn__close" ref={closeRef} onClick={close}>Got it</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

const CSS = `
.pbwn__row{display:flex;justify-content:center;margin:0 0 18px}
.pbwn__btn{box-sizing:border-box;min-height:44px;padding:0 18px;display:inline-flex;align-items:center;gap:8px;border-radius:50px;border:1.5px solid #E0A93B;background:#FFF4E5;color:#8A5A12;font:700 14px var(--font-display,'Satoshi',sans-serif);cursor:pointer}
.pbwn__btn.is-warn{animation:pbwn-blink 1.6s ease-in-out infinite}
.pbwn__btn:focus-visible,.pbwn__close:focus-visible{outline:3px solid #011E4A;outline-offset:2px}
.pbwn__count{min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#F5691A;color:#fff;font-size:12px;line-height:22px;text-align:center}
@keyframes pbwn-blink{0%,100%{box-shadow:0 0 0 0 rgba(224,169,59,.55);background:#FFF4E5}50%{box-shadow:0 0 0 7px rgba(224,169,59,0);background:#FFE3B3}}
.pbwn__wrap{position:fixed;inset:0;z-index:1600;background:rgba(1,30,74,.45);display:flex;align-items:flex-end;justify-content:center;font-family:'Satoshi',system-ui,sans-serif}
.pbwn__panel{box-sizing:border-box;width:100%;max-width:560px;max-height:88dvh;overflow-y:auto;padding:20px 16px calc(16px + env(safe-area-inset-bottom));background:#FBF8F4;border-radius:22px 22px 0 0;color:#011E4A;animation:pbwn-up .2s ease both}
@keyframes pbwn-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@media (min-width:600px){.pbwn__wrap{align-items:center}.pbwn__panel{border-radius:22px}}
.pbwn__title{margin:0 0 12px;font-family:'Fredoka',sans-serif;font-weight:700;font-size:22px}
.pbwn__list{display:flex;flex-direction:column;gap:10px}
.pbwn__close{min-height:48px;margin:14px auto 0;display:block;padding:0 28px;border:0;border-radius:999px;background:#F5691A;color:#011E4A;font:700 16px 'Satoshi',sans-serif;cursor:pointer}
@media (prefers-reduced-motion:reduce){.pbwn__btn.is-warn{animation:none}.pbwn__panel{animation:none}}
`;
