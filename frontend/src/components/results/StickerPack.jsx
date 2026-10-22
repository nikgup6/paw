import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { STICKER_COUNT, STICKERS_LIVE } from '../../constants/stickers';
import { track, trackOnce } from '../../utils/analytics';

/* One breed's sticker pack: eight stickers, tap one to share or download it, or take the lot as a zip.

   THE HONEST LIMITATION, and why the help panel exists
   A web page cannot add stickers to WhatsApp. Tapping Share hands WhatsApp an IMAGE, which is sent as a
   photo, not as a sticker. A real sticker pack has to be imported by a sticker-maker app. The panel says
   exactly that — do not reword it into a promise we cannot keep.

   Nothing is uploaded. The files are static, served from public/stickers/<key>/, and the zip is
   pre-built (the browser never zips anything).

   HOW TO EDIT
   - Which packs exist, captions, file names: constants/stickers.js.
   - Grid size and look: the CSS at the bottom of this file. */

const SHARE_TEXT = 'Made on PAW BUDDY';

/** Fetch a PNG as a File so the share sheet can carry the actual image. Null if anything goes wrong. */
async function stickerFile(pack, i) {
  try {
    const res = await fetch(pack.png(i));
    if (!res.ok) return null;
    const blob = await res.blob();
    return new File([blob], `${pack.key}-${String(i + 1).padStart(2, '0')}.png`, { type: 'image/png' });
  } catch {
    return null;
  }
}

function Preview({ pack, index, onClose }) {
  const closeRef = useRef(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const saveAsFile = (file) => {
    const href = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = href;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
  };

  const onShare = async () => {
    if (busy) return;
    setBusy(true);
    setNote('');
    try {
      const file = await stickerFile(pack, index);
      if (!file) { setNote('Could not load that sticker. Try again.'); return; }
      // Only offer the share sheet when the browser will actually carry the file; otherwise save it.
      let canFiles = false;
      try { canFiles = !!navigator.canShare && navigator.canShare({ files: [file] }); } catch { canFiles = false; }
      if (canFiles) {
        try {
          await navigator.share({ files: [file], text: SHARE_TEXT });
          track('sticker_shared', { pack: pack.key, sticker: index + 1, method: 'share' });
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') return;      // the person closed the sheet: do nothing
        }
      }
      saveAsFile(file);
      track('sticker_shared', { pack: pack.key, sticker: index + 1, method: 'download' });
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async () => {
    if (busy) return;
    setBusy(true);
    setNote('');
    try {
      const file = await stickerFile(pack, index);
      if (!file) { setNote('Could not load that sticker. Try again.'); return; }
      saveAsFile(file);
      track('sticker_shared', { pack: pack.key, sticker: index + 1, method: 'download' });
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="pbst__wrap" onClick={onClose}>
      <div
        className="pbst__modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${pack.label} sticker: ${pack.captions[index]}`}
        onClick={(e) => e.stopPropagation()}
      >
        <img className="pbst__big" src={pack.webp(index)} alt={pack.captions[index]} width="240" height="240" />
        <p className="pbst__bigcap">{pack.captions[index]}</p>
        <div className="pbst__acts">
          <button type="button" className="pbst__act pbst__act--main" onClick={onShare} disabled={busy}>Share</button>
          <button type="button" className="pbst__act" onClick={onDownload} disabled={busy}>Download</button>
        </div>
        <p className="pbst__note" role="status" aria-live="polite">{note}</p>
        <button type="button" className="pbst__close" ref={closeRef} onClick={onClose}>Close</button>
      </div>
    </div>,
    document.body,
  );
}

export default function StickerPack({ pack, heading }) {
  const [open, setOpen] = useState(null);     // index of the sticker being previewed
  const [howOpen, setHowOpen] = useState(false);
  const sectionRef = useRef(null);

  // "Viewed" means it actually came on screen, not merely that it was rendered below the fold.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { trackOnce('sticker_pack_viewed', pack.key, { pack: pack.key }); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [pack.key]);

  if (!STICKERS_LIVE) return null;

  return (
    <section className="pbst" ref={sectionRef} aria-label={`${pack.label} sticker pack`}>
      <style>{CSS}</style>
      <h3 className="pbst__h">{heading || `${pack.label} sticker pack`}</h3>

      <ul className="pbst__grid">
        {Array.from({ length: STICKER_COUNT }, (_, i) => (
          <li key={i}>
            <button type="button" className="pbst__cell" onClick={() => setOpen(i)} aria-label={`${pack.captions[i]} — open`}>
              <img className="pbst__img" src={pack.webp(i)} alt="" loading="lazy" width="120" height="120" />
              <span className="pbst__cap">{pack.captions[i]}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="pbst__row">
        <a
          className="pbst__zip"
          href={pack.packZip}
          download
          onClick={() => track('sticker_pack_downloaded', { pack: pack.key })}
        >
          Download all {STICKER_COUNT} (zip)
        </a>
      </div>

      <div className="pbst__how">
        <button
          type="button"
          className="pbst__howbtn"
          aria-expanded={howOpen}
          aria-controls={`pbst-how-${pack.key}`}
          onClick={() => setHowOpen((o) => !o)}
        >
          How to add these to WhatsApp {howOpen ? '−' : '+'}
        </button>
        {howOpen && (
          <div className="pbst__howbody" id={`pbst-how-${pack.key}`}>
            <p className="pbst__limit">
              A website cannot add stickers to WhatsApp directly. Tapping Share sends the sticker as an
              image. To get a real sticker pack you need a sticker-maker app.
            </p>
            <ol className="pbst__steps">
              <li>Download the zip above and unzip it on your phone.</li>
              <li>Open any sticker-maker app (search &ldquo;sticker maker&rdquo; in your app store).</li>
              <li>Create a new pack, import the eight PNGs, then add it to WhatsApp from that app.</li>
            </ol>
          </div>
        )}
      </div>

      <p className="pbst__by">Made by PAW BUDDY</p>

      {open !== null && <Preview pack={pack} index={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

const CSS = `
.pbst{margin-top:28px;padding:20px;background:#FFFFFF;border:1.5px solid #E9E2DB;border-radius:18px;color:#011E4A;font-family:'Satoshi',system-ui,sans-serif}
.pbst *,.pbst *::before,.pbst *::after{box-sizing:border-box}
.pbst :focus-visible{outline:3px solid #011E4A;outline-offset:2px}
.pbst__h{margin:0 0 14px;font-family:'Fredoka',sans-serif;font-weight:600;font-size:19px}
.pbst__grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0;padding:0;list-style:none}
.pbst__cell{width:100%;min-height:44px;padding:6px 2px;border:1.5px solid #EFE6DC;border-radius:14px;background:#FBF8F4;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px}
.pbst__img{width:100%;height:auto;max-width:120px;display:block}
.pbst__cap{font-size:11.5px;font-weight:700;line-height:1.2;text-align:center;color:#4A5568}
.pbst__row{margin-top:14px}
.pbst__zip{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;border-radius:999px;background:#F5691A;color:#fff;font-weight:700;font-size:15px;text-decoration:none}
.pbst__how{margin-top:14px}
.pbst__howbtn{min-height:44px;padding:0;border:0;background:none;color:#B34A0E;font:700 14px 'Satoshi',sans-serif;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.pbst__howbody{margin-top:8px;padding:14px;background:#FBF8F4;border:1px solid #EFE6DC;border-radius:12px}
.pbst__limit{margin:0;font-size:13.5px;line-height:1.55;color:#4A5568}
.pbst__steps{margin:10px 0 0;padding-left:20px;font-size:13.5px;line-height:1.6;color:#4A5568}
.pbst__by{margin:14px 0 0;font-size:12px;color:#6B7686}

.pbst__wrap{position:fixed;inset:0;z-index:1700;background:rgba(1,30,74,.45);display:flex;align-items:center;justify-content:center;padding:16px;font-family:'Satoshi',system-ui,sans-serif}
.pbst__modal{box-sizing:border-box;width:100%;max-width:340px;padding:20px;background:#FBF8F4;border-radius:22px;color:#011E4A;text-align:center}
.pbst__big{width:240px;max-width:100%;height:auto;display:block;margin:0 auto}
.pbst__bigcap{margin:10px 0 0;font-family:'Fredoka',sans-serif;font-weight:600;font-size:20px}
.pbst__acts{margin-top:16px;display:flex;flex-direction:column;gap:8px}
.pbst__act{min-height:48px;padding:0 20px;border:1.5px solid #011E4A;border-radius:999px;background:#fff;color:#011E4A;font:700 15px 'Satoshi',sans-serif;cursor:pointer}
.pbst__act--main{background:#F5691A;border-color:#F5691A;color:#fff}
.pbst__act[disabled]{opacity:.65;cursor:default}
.pbst__note{margin:10px 0 0;min-height:18px;font-size:13px;color:#B23B3B}
.pbst__close{margin-top:10px;min-height:44px;padding:0 16px;border:0;background:none;color:#4A5568;font:700 14px 'Satoshi',sans-serif;text-decoration:underline;text-underline-offset:3px;cursor:pointer}

@media (min-width:760px){
  .pbst__grid{grid-template-columns:repeat(8,1fr)}
  .pbst__cap{font-size:11px}
}
@media (prefers-reduced-motion:reduce){.pbst *{animation:none!important;transition:none!important}}
`;
