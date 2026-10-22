import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';

/* THE share system, used by both "Share my matches" (ShareMatches.jsx) and the "See us together"
   avatar card (avatarCard/AvatarCardSheet.jsx). One implementation, so both behave the same.

   Order of attempts (each step falls back to the next, nothing ever throws):
     1. native share WITH the image   (Android Chrome and similar)
     2. native share, text + link only
     3. our own small sheet: WhatsApp, Copy link, Download image

   useShareFlow({ ... })
     getText()       the share text
     getUrl()        the link (with its UTM tags)
     fileName        name of the downloaded / shared image file
     prepare(api)    async. Gets the element to turn into an image: it may call api.setDrawCard(true) to mount an
                     off-screen card first (and api.frames() to wait for it to paint), then returns
                     { el, maxScale } or null. maxScale caps html2canvas's scale (1 = a 1080px-wide card stays 1080).
     cacheable       reuse the generated image (true for a card that never changes)
     withImage       false = share text + link only (no image step, no Download button)
     onEvent(kind, payload)   'clicked' {method}, 'completed' {method}, 'failed' {reason}, 'downloaded'
     sheet           optional { open, setOpen } to control the fallback sheet from outside */

const CARD_TIMEOUT_MS = 4000;       // if the card takes longer than this, share without it
const CARD_MAX_BYTES = 1.5 * 1024 * 1024;

export function useShareFlow({ getText, getUrl, fileName, prepare, cacheable = false, withImage = true, onEvent, sheet }) {
  const [busy, setBusy] = useState(false);
  const [drawCard, setDrawCard] = useState(false);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState('');
  const [innerOpen, setInnerOpen] = useState(false);
  const cardRef = useRef(null);
  const copyTimer = useRef(null);
  const sheetOpen = sheet ? sheet.open : innerOpen;
  const setSheetOpen = sheet ? sheet.setOpen : setInnerOpen;
  const emit = (kind, payload) => { try { onEvent?.(kind, payload); } catch { /* tracking never breaks sharing */ } };

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  /** The card image. Fonts and photos are awaited first, JPEG at scale 2 stepping down to stay near 1.5 MB.
      Returns null (never throws) on failure or after 4 seconds. */
  const makeBlob = async () => {
    if (cacheable && cardRef.current) return cardRef.current;
    try {
      const target = await prepare({
        setDrawCard,
        frames: () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))),
      });
      if (!target || !target.el) { setDrawCard(false); return null; }
      const { el, maxScale = 2 } = target;
      try { await document.fonts?.ready; } catch { /* old browser */ }
      try { await Promise.all([...el.querySelectorAll('img')].map((i) => (i.decode ? i.decode().catch(() => {}) : null))); } catch { /* ignore */ }
      const work = (async () => {
        for (const scale of [2, 1.5, 1]) {
          const canvas = await html2canvas(el, { scale: Math.min(scale, maxScale), backgroundColor: '#FBF8F4', useCORS: true, logging: false });
          const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
          if (blob && (blob.size <= CARD_MAX_BYTES || scale === 1)) return blob;
        }
        return null;
      })();
      const timeout = new Promise((res) => setTimeout(() => res(null), CARD_TIMEOUT_MS));
      const blob = await Promise.race([work, timeout]);
      if (cacheable && blob) cardRef.current = blob;
      setDrawCard(false);
      return blob;
    } catch {
      setDrawCard(false);
      return null;
    }
  };

  const asFile = (blob) => new File([blob], fileName, { type: 'image/jpeg' });

  const nativeMethod = () => {
    try {
      if (withImage && navigator.canShare && navigator.canShare({ files: [new File([''], 'x.jpg', { type: 'image/jpeg' })] })) return 'native_files';
      if (navigator.share) return 'native_text';
    } catch { /* fall through */ }
    return 'sheet';
  };

  const openSheet = () => { setNote(''); setSheetOpen(true); };

  const share = async () => {
    if (busy) return;
    const method = nativeMethod();
    emit('clicked', { method });
    if (method === 'sheet') { openSheet(); return; }

    setBusy(true);
    const text = getText();
    const url = getUrl();
    try {
      if (method === 'native_files') {
        const blob = await makeBlob();
        if (blob) {
          try {
            await navigator.share({ files: [asFile(blob)], text, url });
            emit('completed', { method });
            return;
          } catch (e) {
            if (e && e.name === 'AbortError') return;                        // cancelled: do nothing
            emit('failed', { reason: 'native_files_error' });                // otherwise try text only
          }
        } else {
          emit('failed', { reason: 'image_failed' });
        }
      }
      try {
        await navigator.share({ text, url });
        emit('completed', { method: method === 'native_files' ? 'native_text' : method });
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        emit('failed', { reason: 'native_text_error' });
        openSheet();
      }
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    const url = getUrl();
    let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch { /* use the fallback */ }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = url; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch { ok = false; }
    }
    if (ok) {
      emit('completed', { method: 'sheet' });
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } else {
      emit('failed', { reason: 'copy_failed' });
      setNote('Could not copy. Long-press the link above to copy it.');
    }
  };

  const download = async () => {
    setNote('');
    const blob = await makeBlob();
    if (!blob) {
      emit('failed', { reason: 'image_failed' });
      setNote('Could not make the image. You can still share the link.');
      return;
    }
    try {
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href; a.download = fileName; a.click();
      setTimeout(() => URL.revokeObjectURL(href), 4000);
      emit('downloaded');
    } catch {
      emit('failed', { reason: 'download_failed' });
      setNote('Could not download the image.');
    }
  };

  const whatsAppTapped = () => emit('completed', { method: 'sheet' });

  return { busy, drawCard, withImage, copied, note, sheetOpen, setSheetOpen, share, copyLink, download, whatsAppTapped, text: getText(), url: getUrl() };
}

/** The fallback share sheet: WhatsApp, Copy link, Download image. Focus-trapped, Escape and outside tap close it. */
export function ShareSheet({ flow, title = 'Share my matches', returnFocusRef, zIndex = 1600 }) {
  const sheetRef = useRef(null);
  const closeRef = useRef(null);
  const { sheetOpen, setSheetOpen, text, url, copied, note, copyLink, download, whatsAppTapped, withImage } = flow;

  const close = () => {
    setSheetOpen(false);
    requestAnimationFrame(() => { try { returnFocusRef?.current?.focus({ preventScroll: true }); } catch { /* gone */ } });
  };

  useEffect(() => {
    if (!sheetOpen) return undefined;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab' || !sheetRef.current) return;
      const f = [...sheetRef.current.querySelectorAll('button:not([disabled]), a[href]')];
      if (!f.length) return;
      const first = f[0]; const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen]);

  if (!sheetOpen) return null;
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;

  return createPortal(
    <div className="pbsh__wrap" style={{ zIndex }} onClick={close}>
      <style>{SHEET_CSS}</style>
      <div className="pbsh__sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2 className="pbsh__title">{title}</h2>
        <p className="pbsh__msg">{text}</p>
        <p className="pbsh__link">{url}</p>
        <div className="pbsh__actions">
          <a className="pbsh__act pbsh__act--main" href={waHref} target="_blank" rel="noopener noreferrer" onClick={whatsAppTapped}>WhatsApp</a>
          <button type="button" className="pbsh__act" onClick={copyLink}>{copied ? 'Copied' : 'Copy link'}</button>
          {withImage && <button type="button" className="pbsh__act" onClick={download}>Download image</button>}
        </div>
        <p className="pbsh__note" role="status" aria-live="polite">{note}</p>
        <button type="button" className="pbsh__close" ref={closeRef} onClick={close}>Close</button>
      </div>
    </div>,
    document.body,
  );
}

export const SHEET_CSS = `
.pbsh__wrap{position:fixed;inset:0;background:rgba(1,30,74,.45);display:flex;align-items:flex-end;justify-content:center;font-family:'Satoshi',system-ui,sans-serif}
.pbsh__sheet{box-sizing:border-box;width:100%;max-width:480px;padding:20px 18px calc(18px + env(safe-area-inset-bottom));background:#FBF8F4;border-radius:22px 22px 0 0;color:#011E4A;animation:pbsh-up .2s ease both}
@keyframes pbsh-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@media (min-width:520px){.pbsh__wrap{align-items:center}.pbsh__sheet{border-radius:22px}}
.pbsh__title{margin:0 0 8px;font-family:'Fredoka',sans-serif;font-weight:700;font-size:22px}
.pbsh__msg{margin:0 0 4px;font-size:14px;line-height:1.5;color:#4A5568}
.pbsh__link{margin:0 0 14px;font-size:12px;color:#6B7280;overflow-wrap:anywhere}
.pbsh__actions{display:flex;flex-direction:column;gap:8px}
.pbsh__act{box-sizing:border-box;min-height:48px;display:flex;align-items:center;justify-content:center;border-radius:999px;border:2px solid #011E4A;background:#fff;color:#011E4A;font:700 15px 'Satoshi',sans-serif;text-decoration:none;cursor:pointer}
.pbsh__act--main{background:#F5691A;border-color:#F5691A;color:#011E4A}
.pbsh__note{min-height:18px;margin:10px 0 0;font-size:13px;color:#A5352C}
.pbsh__close{min-height:44px;margin:2px auto 0;display:block;background:none;border:0;color:#011E4A;font:700 14px 'Satoshi',sans-serif;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.pbsh__act:focus-visible,.pbsh__close:focus-visible{outline:3px solid #011E4A;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.pbsh__sheet{animation:none}}
`;
