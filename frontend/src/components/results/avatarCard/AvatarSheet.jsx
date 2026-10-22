import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { shareBase } from '../../../constants/site';
import { AVATAR_OPTIONS, DEFAULT_AVATAR, NAME_MAX, cleanName } from '../../../constants/avatarOptions';
import { track } from '../../../utils/analytics';
import { ShareSheet, useShareFlow } from '../shareFlow';
import AvatarCardArt, { Avatar, cardCaption } from './AvatarArt';

/* The "See us together" sheet: pick a name and an avatar, make the card, share or download it.
   Loaded only when the button is tapped (see AvatarCardButton.jsx), so it is not in the main bundle.
   Read the notes at the top of AvatarCardButton.jsx for privacy and events. */

const CARD_ID = 'pb-avatar-card';
const shareUrl = () => `${shareBase()}/?utm_source=share&utm_medium=avatar_card&utm_campaign=see_us_together`;
const hostOf = () => { try { return new URL(shareBase()).host; } catch { return ''; } };

/** Width of the preview box -> the scale to draw the 1080px card at. */
function useFit(ref, base) {
  const [scale, setScale] = useState(0.25);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => setScale((el.clientWidth || base / 4) / base);
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    window.addEventListener('resize', fit);
    return () => { ro?.disconnect(); window.removeEventListener('resize', fit); };
  }, [ref, base]);
  return scale;
}

function Swatches({ label, options, value, onChange }) {
  return (
    <div className="pbav__group" role="radiogroup" aria-label={label}>
      <div className="pbav__glabel">{label}</div>
      <div className="pbav__opts">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            aria-label={o.label}
            title={o.label}
            className={`pbav__sw${value === o.id ? ' is-on' : ''}`}
            onClick={() => onChange(o.id)}
          >
            <i style={{ background: o.color }} />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AvatarSheet({ top, onClose, returnFocusRef }) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR);
  const [step, setStep] = useState('edit'); // 'edit' -> 'done'
  const sheetRef = useRef(null);
  const closeRef = useRef(null);
  const fitRef = useRef(null);
  const shareBtnRef = useRef(null);
  const scale = useFit(fitRef, 1080);
  const host = hostOf();

  const flow = useShareFlow({
    getText: () => `${cardCaption(name, top)}. Find the dog that fits your life:`,
    getUrl: shareUrl,
    fileName: 'paw-buddy-us-together.jpg',
    cacheable: false,
    prepare: async ({ setDrawCard, frames }) => {
      setDrawCard(true);
      await frames();
      const el = document.getElementById(CARD_ID);
      return el ? { el, maxScale: 1 } : null;   // 1080px wide stays 1080px wide
    },
    onEvent: (kind, payload) => {
      if (kind === 'completed') track('avatar_card_shared', { method: payload?.method });
      else if (kind === 'downloaded') track('avatar_card_downloaded');
    },
  });

  const close = () => {
    onClose();
    requestAnimationFrame(() => { try { returnFocusRef?.current?.focus({ preventScroll: true }); } catch { /* gone */ } });
  };

  // Escape closes, Tab stays inside. While the share sheet is on top of this one, it handles the keys instead.
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (flow.sheetOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab' || !sheetRef.current) return;
      const f = [...sheetRef.current.querySelectorAll('button:not([disabled]), input, a[href]')];
      if (!f.length) return;
      const first = f[0]; const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.sheetOpen]);

  const make = () => {
    track('avatar_card_created', { breed: top.name });   // the breed only, never the name
    setStep('done');
    requestAnimationFrame(() => { try { shareBtnRef.current?.focus({ preventScroll: true }); } catch { /* ignore */ } });
  };

  const set = (key) => (id) => setAvatar((a) => ({ ...a, [key]: id }));

  return (
    <>
      {flow.drawCard && <AvatarCardArt id={CARD_ID} offscreen name={name} avatar={avatar} breed={top} host={host} />}
      {createPortal(
        <div className="pbav__wrap" onClick={close}>
          <style>{SHEET_CSS}</style>
          <div className="pbav__sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="pbav-title" onClick={(e) => e.stopPropagation()}>
            <div className="pbav__top">
              <h2 id="pbav-title" className="pbav__title">See us together</h2>
              <button type="button" className="pbav__x" ref={closeRef} onClick={close} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#011E4A" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" /></svg>
              </button>
            </div>

            <div className="pbav__body">
              <div className="pbav__preview">
                <div className="pbav__fit" ref={fitRef} role="img" aria-label={`Preview: ${cardCaption(name, top)}, ${top.matchPercentage}% match`}>
                  <div className="pbav__scaled" style={{ transform: `scale(${scale})` }} aria-hidden="true">
                    <AvatarCardArt name={name} avatar={avatar} breed={top} host={host} />
                  </div>
                </div>
              </div>

              {step === 'edit' ? (
                <div className="pbav__controls">
                  <label className="pbav__field">
                    <span className="pbav__glabel">Your name (optional)</span>
                    <input
                      className="pbav__input"
                      type="text"
                      value={name}
                      maxLength={NAME_MAX}
                      autoComplete="off"
                      autoCapitalize="words"
                      spellCheck={false}
                      placeholder="Type a name"
                      onChange={(e) => setName(cleanName(e.target.value))}
                      aria-describedby="pbav-name-note"
                    />
                    <span id="pbav-name-note" className="pbav__note">Up to {NAME_MAX} letters or numbers. Stays on your phone. We never save it.</span>
                  </label>

                  <Swatches label="Skin tone" options={AVATAR_OPTIONS.skins} value={avatar.skin} onChange={set('skin')} />

                  <div className="pbav__group" role="radiogroup" aria-label="Hair">
                    <div className="pbav__glabel">Hair</div>
                    <div className="pbav__opts">
                      {AVATAR_OPTIONS.hairs.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          role="radio"
                          aria-checked={avatar.hair === h.id}
                          aria-label={h.label}
                          title={h.label}
                          className={`pbav__sw pbav__sw--hair${avatar.hair === h.id ? ' is-on' : ''}`}
                          onClick={() => set('hair')(h.id)}
                        >
                          <Avatar skin={avatar.skin} hair={h.id} outfit={avatar.outfit} width={34} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <Swatches label="Top" options={AVATAR_OPTIONS.outfits} value={avatar.outfit} onChange={set('outfit')} />

                  <button type="button" className="pbav__primary" onClick={make}>Make my card</button>
                </div>
              ) : (
                <div className="pbav__controls">
                  <p className="pbav__made">{cardCaption(name, top)}</p>
                  <button
                    type="button"
                    ref={shareBtnRef}
                    className="pbav__primary"
                    onClick={flow.share}
                    disabled={flow.busy}
                    aria-busy={flow.busy}
                  >
                    {flow.busy ? 'Preparing your card...' : 'Share'}
                  </button>
                  <button type="button" className="pbav__secondary" onClick={flow.download} disabled={flow.busy}>Download image</button>
                  <p className="pbav__note" role="status" aria-live="polite">{flow.note}</p>
                  <button type="button" className="pbav__link" onClick={() => setStep('edit')}>Change how we look</button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
      <ShareSheet flow={flow} title="Share our card" returnFocusRef={shareBtnRef} zIndex={1700} />
    </>
  );
}

const SHEET_CSS = `
.pbav__wrap{position:fixed;inset:0;z-index:1500;background:rgba(1,30,74,.45);display:flex;align-items:flex-end;justify-content:center;font-family:'Satoshi',system-ui,sans-serif}
.pbav__sheet{box-sizing:border-box;width:100%;max-width:520px;max-height:94vh;max-height:94dvh;overflow-y:auto;overscroll-behavior:contain;padding:16px 16px calc(16px + env(safe-area-inset-bottom));background:#FBF8F4;border-radius:22px 22px 0 0;color:#011E4A;animation:pbav-up .2s ease both}
@keyframes pbav-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@media (min-width:640px){.pbav__wrap{align-items:center}.pbav__sheet{border-radius:22px;max-width:760px;padding:20px 22px 22px}}
.pbav__top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.pbav__title{margin:0;font-family:'Fredoka',sans-serif;font-weight:700;font-size:22px}
.pbav__x{width:44px;height:44px;margin-right:-8px;display:inline-flex;align-items:center;justify-content:center;background:none;border:0;border-radius:50%;cursor:pointer}
.pbav__body{display:flex;flex-direction:column;gap:14px}
@media (min-width:640px){.pbav__body{flex-direction:row;align-items:flex-start;gap:22px}.pbav__preview{flex:none;width:300px}.pbav__controls{flex:1;min-width:0}}
.pbav__preview{display:flex;justify-content:center}
.pbav__fit{position:relative;width:min(100%,250px);aspect-ratio:4/5;overflow:hidden;border-radius:14px;border:2px solid #EAE4DE;background:#FBF8F4}
@media (min-width:640px){.pbav__fit{width:100%}}
.pbav__scaled{position:absolute;left:0;top:0;width:1080px;height:1350px;transform-origin:0 0;pointer-events:none}
.pbav__controls{display:flex;flex-direction:column;gap:12px}
.pbav__field{display:flex;flex-direction:column;gap:6px}
.pbav__glabel{font-size:12px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#4A5568;margin-bottom:6px}
.pbav__field .pbav__glabel{margin-bottom:0}
.pbav__input{box-sizing:border-box;width:100%;min-height:46px;padding:0 14px;border:2px solid #011E4A;border-radius:14px;background:#fff;color:#011E4A;font:600 16px 'Satoshi',sans-serif}
.pbav__input:focus-visible{outline:3px solid #F5691A;outline-offset:2px}
.pbav__note{margin:0;font-size:12px;line-height:1.4;color:#6B7280;min-height:16px}
.pbav__opts{display:flex;gap:10px;flex-wrap:wrap}
.pbav__sw{box-sizing:border-box;width:46px;height:46px;padding:0;display:inline-flex;align-items:center;justify-content:center;background:#fff;border:2px solid #EAE4DE;border-radius:50%;cursor:pointer;overflow:hidden}
.pbav__sw i{display:block;width:30px;height:30px;border-radius:50%;border:2px solid rgba(1,30,74,.18)}
.pbav__sw--hair{border-radius:14px;width:52px;height:52px;align-items:flex-end}
.pbav__sw.is-on{border-color:#011E4A;box-shadow:0 0 0 2px #FFD9BD}
.pbav__sw:focus-visible,.pbav__x:focus-visible,.pbav__link:focus-visible,.pbav__primary:focus-visible,.pbav__secondary:focus-visible{outline:3px solid #011E4A;outline-offset:2px}
.pbav__primary,.pbav__secondary{box-sizing:border-box;min-height:48px;display:flex;align-items:center;justify-content:center;border-radius:999px;font:700 15px 'Satoshi',sans-serif;cursor:pointer}
.pbav__primary{background:#F5691A;border:2px solid #F5691A;color:#011E4A}
.pbav__secondary{background:#fff;border:2px solid #011E4A;color:#011E4A}
.pbav__primary:disabled,.pbav__secondary:disabled{cursor:progress;opacity:.8}
.pbav__made{margin:0;font-family:'Fredoka',sans-serif;font-weight:600;font-size:17px;line-height:1.35;overflow-wrap:anywhere}
.pbav__link{min-height:44px;background:none;border:0;color:#011E4A;font:700 14px 'Satoshi',sans-serif;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
@media (prefers-reduced-motion:reduce){.pbav__sheet{animation:none}}
`;
