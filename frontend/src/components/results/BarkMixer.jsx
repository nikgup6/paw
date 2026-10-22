import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isMuted, onMuteChange, playBreedBark, primeAudio, setMuted } from '../../utils/sounds';
import { track } from '../../utils/analytics';

/* "Remix the bark": two sliders (pitch, tempo) and a Play button for the matched breed.
   Everything runs in the browser with Web Audio: no server call, no microphone.
   The sound is capped (length and volume) in utils/sounds.js, and rapid taps cannot stack sounds.
   There is no "save" in version one (so `bark_remix_saved` is never fired).

   Props: open, onClose, breed ({ name, size }), returnFocusRef (the button that opened this). */

export default function BarkMixer({ open, onClose, breed, returnFocusRef }) {
  const [pitch, setPitch] = useState(1);
  const [tempo, setTempo] = useState(1);
  const [muted, setMutedState] = useState(isMuted());
  const closeRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => onMuteChange(setMutedState), []);

  useEffect(() => {
    if (!open) return undefined;
    track('bark_remix_opened');
    closeRef.current?.focus({ preventScroll: true });
    const prev = document.body.style.overflow;
    const returnEl = returnFocusRef?.current;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const f = [...panelRef.current.querySelectorAll('button:not([disabled]), input')];
      if (!f.length) return;
      const first = f[0]; const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      try { returnEl?.focus({ preventScroll: true }); } catch { /* element gone */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !breed) return null;

  const play = () => {
    primeAudio();
    playBreedBark({ breed: breed.name, size: breed.size, pitch, tempo });
  };

  return createPortal(
    <div className="pbmx__wrap" onClick={onClose}>
      <style>{CSS}</style>
      <div className="pbmx__panel" ref={panelRef} role="dialog" aria-modal="true" aria-label={`Remix the ${breed.name} bark`} onClick={(e) => e.stopPropagation()}>
        <h2 className="pbmx__title">Remix the bark</h2>
        <p className="pbmx__sub">{breed.name}. Slide, then tap Play.</p>

        <label className="pbmx__row">
          <span>Pitch <b>{pitch.toFixed(2)}x</b></span>
          <input type="range" min="0.5" max="1.8" step="0.05" value={pitch} onChange={(e) => setPitch(Number(e.target.value))} />
          <small><span>Deeper</span><span>Squeakier</span></small>
        </label>
        <label className="pbmx__row">
          <span>Tempo <b>{tempo.toFixed(2)}x</b></span>
          <input type="range" min="0.6" max="1.6" step="0.05" value={tempo} onChange={(e) => setTempo(Number(e.target.value))} />
          <small><span>Slower</span><span>Quicker</span></small>
        </label>

        <button type="button" className="pbmx__play" onClick={play}>{muted ? 'Play (sound is off)' : 'Play'}</button>
        <button type="button" className="pbmx__mute" aria-pressed={muted} onClick={() => setMuted(!muted)}>
          {muted ? 'Sound is off. Tap to turn on' : 'Sound is on. Tap to mute'}
        </button>
        <button type="button" className="pbmx__close" ref={closeRef} onClick={onClose}>Close</button>
      </div>
    </div>,
    document.body,
  );
}

const CSS = `
.pbmx__wrap{position:fixed;inset:0;z-index:1600;background:rgba(1,30,74,.45);display:flex;align-items:flex-end;justify-content:center;font-family:'Satoshi',system-ui,sans-serif}
.pbmx__panel{box-sizing:border-box;width:100%;max-width:460px;padding:20px 18px calc(18px + env(safe-area-inset-bottom));background:#FBF8F4;border-radius:22px 22px 0 0;color:#011E4A;animation:pbmx-up .2s ease both}
@keyframes pbmx-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@media (min-width:520px){.pbmx__wrap{align-items:center}.pbmx__panel{border-radius:22px}}
.pbmx__title{margin:0 0 2px;font-family:'Fredoka',sans-serif;font-weight:700;font-size:22px}
.pbmx__sub{margin:0 0 14px;font-size:14px;color:#4A5568}
.pbmx__row{display:flex;flex-direction:column;gap:6px;margin-bottom:14px;font-size:14px;font-weight:700}
.pbmx__row b{color:#F5691A}
.pbmx__row input{width:100%;height:32px;accent-color:#F5691A}
.pbmx__row small{display:flex;justify-content:space-between;font-size:12px;font-weight:600;color:#6B7280}
.pbmx__play{width:100%;min-height:52px;border:0;border-radius:999px;background:#F5691A;color:#011E4A;font:700 17px 'Satoshi',sans-serif;cursor:pointer;box-shadow:0 8px 20px rgba(245,105,26,.3)}
.pbmx__mute,.pbmx__close{display:block;margin:8px auto 0;min-height:44px;padding:0 12px;background:none;border:0;color:#011E4A;font:700 14px 'Satoshi',sans-serif;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.pbmx__panel :focus-visible{outline:3px solid #011E4A;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.pbmx__panel{animation:none}}
`;
