import React, { useRef } from 'react';
import { noExcellentMatch } from '../../utils/breedUtils';
import { shareBase } from '../../constants/site';
import { track } from '../../utils/analytics';
import { ShareSheet, useShareFlow } from './shareFlow';

/* The one share entry point on the Top-5 results.

   It shares three things together: a card image listing ALL of your matches (#1 to #5),
   a short text listing them too, and a link. Nothing personal goes in any of them:
   no name, phone, city or quiz answers. Percentages are the engine's own.

   Order of attempts (each step falls back to the next, nothing ever throws):
     1. native share WITH the image   (Android Chrome and similar)
     2. native share, text + link only
     3. our own small share sheet: WhatsApp, Copy link, Download image

   HOW TO EDIT
   - Share wording: shareText() below.
   - Link + UTM tags: shareUrl() below.
   - Image quality and size limits: CARD_* constants below. */

const CARD_ID = 'rec-top-match';      // used only for the "no excellent match" case (see makeCard)
const SHARE_CARD_ID = 'pb-share-card'; // the list-of-all-matches card drawn off-screen for the image
const NO_MATCH_TEXT = 'I took the PAW BUDDY dog-match quiz. Find which dog fits your life:';

const shareUrl = () => `${shareBase()}/?utm_source=share&utm_medium=results&utm_campaign=top5_share`;

/** Plain text. If the engine says there is no excellent match we claim nothing and list no breeds. */
const shareText = (matches) => {
  try {
    if (noExcellentMatch(matches)) return NO_MATCH_TEXT;
    const list = matches.slice(0, 5)
      .map((b, i) => `${i + 1}. ${b.name} (${b.matchPercentage}%)`)
      .join(', ');
    return `My PAW BUDDY matches: ${list}. Find yours in 2 minutes:`;
  } catch {
    return NO_MATCH_TEXT;
  }
};

const ShareIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#011E4A" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M12 15V3.5M7.5 8L12 3.5 16.5 8" />
    <path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12" />
  </svg>
);


/* The picture that gets shared: every match from the results, #1 big, #2-#5 below it. Drawn off-screen
   (never visible on the page) only while the image is being made, then removed. Plain inline styles so
   html2canvas copies it faithfully. Edit the look here. */
const ShareCard = ({ matches }) => {
  const [first, ...rest] = matches.slice(0, 5);
  const host = (() => { try { return new URL(shareBase()).host; } catch { return ''; } })();
  const photo = (b, size, radius, border) => (
    <img
      src={`/${b.img}`}
      alt=""
      crossOrigin="anonymous"
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: radius, border, background: '#E3ECF7', flex: 'none', display: 'block' }}
    />
  );
  return (
    <div
      id={SHARE_CARD_ID}
      aria-hidden="true"
      style={{ position: 'fixed', left: -10000, top: 0, width: 1080, boxSizing: 'border-box', padding: '60px 56px 52px', background: '#FBF8F4', color: '#011E4A', fontFamily: "'Satoshi', 'Segoe UI', sans-serif" }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 50, letterSpacing: 1 }}>
          <span style={{ color: '#011E4A' }}>PAW </span><span style={{ color: '#F5691A' }}>BUDDY</span>
        </div>
        <div style={{ fontSize: 28, color: '#4A5568', fontWeight: 600 }}>Free 2-minute dog-match quiz</div>
      </div>
      <div style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 66, lineHeight: 1.1, margin: '10px 0 30px' }}>
        My top dog matches
      </div>

      {first && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 36, background: '#F5691A', borderRadius: 44, padding: 34, color: '#fff' }}>
          {photo(first, 300, 34, '8px solid #fff')}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'inline-block', background: '#011E4A', color: '#fff', borderRadius: 999, padding: '8px 22px', fontSize: 24, fontWeight: 800, letterSpacing: 2 }}>#1 MATCH</div>
            <div style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 68, lineHeight: 1.08, margin: '14px 0 4px' }}>{first.name}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
              <span style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 92, lineHeight: 1 }}>{first.matchPercentage}%</span>
              <span style={{ fontSize: 30, fontWeight: 700 }}>{first.label}</span>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 24 }}>
        {rest.map((b, i) => (
          <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 28, background: '#fff', border: '3px solid #EAE4DE', borderRadius: 32, padding: 20 }}>
            <div style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 40, color: '#B34A0E', width: 56, textAlign: 'center', flex: 'none' }}>#{i + 2}</div>
            {photo(b, 140, 24, '4px solid #FFD9BD')}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 46, lineHeight: 1.1 }}>{b.name}</div>
              <div style={{ fontSize: 26, color: '#4A5568', fontWeight: 600, marginTop: 4 }}>{b.label}</div>
            </div>
            <div style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 60, color: '#F5691A', flex: 'none' }}>{b.matchPercentage}%</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 34, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
        <div style={{ fontSize: 30, fontWeight: 700 }}>Find the dog that fits YOUR life.</div>
        {host && <div style={{ background: '#011E4A', color: '#fff', borderRadius: 999, padding: '12px 28px', fontSize: 28, fontWeight: 700 }}>{host}</div>}
      </div>
    </div>
  );
};

export default function ShareMatches({ matches, sheetOpen, onSheetOpenChange }) {
  const btnRef = useRef(null);

  // All the sharing logic (native share, fallback sheet, image making) is the shared system in shareFlow.jsx.
  const flow = useShareFlow({
    getText: () => shareText(matches),
    getUrl: shareUrl,
    fileName: 'paw-buddy-matches.jpg',
    cacheable: true,
    sheet: { open: sheetOpen, setOpen: onSheetOpenChange },
    prepare: async ({ setDrawCard, frames }) => {
      // With a real match we draw a card listing every match. In the "no excellent match" case we keep the
      // old single card (it carries the warning label) and make no claim about breeds.
      const composed = matches.length > 0 && !noExcellentMatch(matches);
      if (composed) { setDrawCard(true); await frames(); }
      const el = document.getElementById(composed ? SHARE_CARD_ID : CARD_ID);
      return el ? { el, maxScale: composed ? 1 : 2 } : null;
    },
    onEvent: (kind, payload) => {
      if (kind === 'clicked') track('share_clicked', payload);
      else if (kind === 'completed') track('share_completed', payload);
      else if (kind === 'failed') track('share_failed', payload);
      else if (kind === 'downloaded') track('share_completed', { method: 'sheet' });
    },
  });

  return (
    <>
      <style>{CSS}</style>
      {flow.drawCard && <ShareCard matches={matches} />}
      <button
        type="button"
        ref={btnRef}
        className="pbsh__btn"
        aria-label="Share my matches"
        title="Share my matches"
        aria-busy={flow.busy}
        disabled={flow.busy}
        onClick={flow.share}
      >
        {flow.busy ? <span className="pbsh__spin" aria-hidden="true" /> : <ShareIcon />}
        <span className="pbsh__label">{flow.busy ? 'Preparing your card...' : 'Share my matches'}</span>
      </button>
      <ShareSheet flow={flow} title="Share my matches" returnFocusRef={btnRef} />
    </>
  );
}

const CSS = `
.pbsh__btn{box-sizing:border-box;min-width:44px;height:40px;padding:0 11px;display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#FFFFFF;color:#011E4A;border:1.5px solid #011E4A;border-radius:50px;cursor:pointer;font:600 13px var(--font-display,'Satoshi',sans-serif)}
.pbsh__btn{position:relative}
.pbsh__btn::after{content:'';position:absolute;inset:-2px 0}/* hit area 44px tall while the button stays level with its 40px neighbours */
.pbsh__btn:disabled{cursor:progress;opacity:.85}
.pbsh__btn:focus-visible{outline:3px solid #011E4A;outline-offset:2px}
.pbsh__label{display:none;white-space:nowrap}
@media (min-width:480px){.pbsh__btn{padding:0 14px}.pbsh__label{display:inline}}
.pbsh__btn[aria-busy="true"] .pbsh__label{display:inline}
.pbsh__spin{width:16px;height:16px;border-radius:50%;border:2.5px solid #FFD9BD;border-top-color:#F5691A;animation:pbsh-spin .8s linear infinite}
@keyframes pbsh-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.pbsh__spin{animation-duration:2s}}
`;
