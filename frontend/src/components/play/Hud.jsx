import React from 'react';
import { Link } from 'react-router-dom';

/* HUD: everything drawn ON TOP of the 3D view with normal web elements (not inside the 3D scene):
   the score bar, the pause and sound buttons, the start / pause / resume screens and the game-over card.

   It only shows what it is given. The numbers come from ZoomiesGame.jsx, which gets them from the engine at most
   10 times a second, so this never slows the game down. All the words are in COPY below. */

export const COPY = {
  title: 'Street Zoomies',
  tagline: 'Run down the street, dodge the traffic, grab the bones.',
  start: 'Start running',
  tapStart: 'Tap, or press Space, to start',
  touchHow: [
    ['Swipe left or right', 'change lane'],
    ['Swipe up', 'jump over puddles and potholes'],
    ['Swipe down', 'slide under cloth lines'],
  ],
  keysHow: [
    ['← → or A D', 'change lane'],
    ['↑, W or Space', 'jump over puddles and potholes'],
    ['↓ or S', 'slide under cloth lines'],
    ['P or Esc', 'pause'],
  ],
  autoNote: 'Autos and cows are too big to jump: change lane!',
  paused: 'Paused',
  resume: 'Keep running',
  lost: 'Getting the picture back...',
  resumeAfterLost: 'The picture is back',
  tapResume: 'Tap to resume',
  loading: 'Loading the street...',
  again: 'Play again',
  findLine: 'Now find the real dog that fits you.',
  findDog: 'Find my dog',
  share: 'Share',
  skip: 'Skip to the quiz',
};

const SpeakerIcon = ({ on }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    {on ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
  </svg>
);
const PauseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><rect x="6" y="5" width="4.2" height="14" rx="1.2" /><rect x="13.8" y="5" width="4.2" height="14" rx="1.2" /></svg>
);
const BoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M7 5.2a2.6 2.6 0 0 0-4.4 1.9c0 1.1.6 2 1.5 2.4l3 3-3 3c-.9.4-1.5 1.3-1.5 2.4A2.6 2.6 0 0 0 7 18.8l2.2 2.2a2.6 2.6 0 0 0 3.7 0l.1-.1 8-8a2.6 2.6 0 0 0 0-3.7L14.6 3.2a2.6 2.6 0 0 0-3.7 0z" transform="scale(.9) translate(1.4 1.2) rotate(-30 12 12)" /></svg>
);

/** The how-to list, for phones or keyboards. */
function HowTo({ touch }) {
  const rows = touch ? COPY.touchHow : COPY.keysHow;
  return (
    <ul className="pbzm__how">
      {rows.map(([k, v]) => (
        <li key={k}><b>{k}</b><span>{v}</span></li>
      ))}
      <li className="pbzm__how-note">{COPY.autoNote}</li>
    </ul>
  );
}

/**
 * props
 *   phase     'loading' | 'ready' | 'running' | 'paused' | 'over' | 'lost' | 'resume'
 *   hud       { metres, bones, score }          result  { metres, bones, score, best, isBest } (at game over)
 *   touch     true on a phone (shows swipe hints)    firstRun  true until the how-to has been shown once
 *   soundOn   whether sound is on                    best  best score so far on this device
 *   onStart / onPause / onResume / onRestart / onSound / onShare / onCta     button handlers
 */
export default function Hud({ phase, hud, result, touch, firstRun, soundOn, best, shareBusy, onStart, onPause, onResume, onRestart, onSound, onShare, onCta, shareRef }) {
  const playing = phase === 'running' || phase === 'paused';
  return (
    <>
      <style>{CSS}</style>

      {(playing || phase === 'ready') && (
        <div className="pbzm__bar" data-noswipe>
          <div className="pbzm__score" aria-hidden="true">
            <span className="pbzm__big">{hud.score}</span>
            <span className="pbzm__small">{hud.metres} m</span>
            <span className="pbzm__bones"><BoneIcon /> {hud.bones}</span>
            {best > 0 && <span className="pbzm__best">Best {best}</span>}
          </div>
          <div className="pbzm__btns">
            <button type="button" className="pbzm__ic" onClick={onSound} aria-pressed={soundOn} aria-label={soundOn ? 'Sound on. Tap to turn off' : 'Sound off. Tap to turn on'}>
              <SpeakerIcon on={soundOn} />
            </button>
            {phase === 'running' && (
              <button type="button" className="pbzm__ic" onClick={onPause} aria-label="Pause">
                <PauseIcon />
              </button>
            )}
          </div>
        </div>
      )}

      {phase === 'loading' && (
        <div className="pbzm__veil" role="status"><p className="pbzm__loading">{COPY.loading}</p></div>
      )}

      {phase === 'ready' && (
        <div className="pbzm__veil">
          <div className="pbzm__card">
            <h2 className="pbzm__title">{COPY.title}</h2>
            <p className="pbzm__tag">{COPY.tagline}</p>
            {firstRun && <HowTo touch={touch} />}
            <button type="button" className="pbzm__primary" onClick={onStart} autoFocus={!touch}>{COPY.start}</button>
            {!firstRun && <p className="pbzm__hint">{touch ? 'Swipe to dodge. Tap to start.' : 'Space or tap to start.'}</p>}
          </div>
        </div>
      )}

      {phase === 'paused' && (
        <div className="pbzm__veil">
          <div className="pbzm__card">
            <h2 className="pbzm__title">{COPY.paused}</h2>
            <button type="button" className="pbzm__primary" onClick={onResume} autoFocus>{COPY.resume}</button>
            {!touch && <p className="pbzm__hint">P or Esc also resumes</p>}
          </div>
        </div>
      )}

      {phase === 'lost' && (
        <div className="pbzm__veil" role="status"><p className="pbzm__loading">{COPY.lost}</p></div>
      )}

      {phase === 'resume' && (
        <div className="pbzm__veil">
          <div className="pbzm__card">
            <h2 className="pbzm__title">{COPY.resumeAfterLost}</h2>
            <button type="button" className="pbzm__primary" onClick={onResume} autoFocus>{COPY.tapResume}</button>
          </div>
        </div>
      )}

      {phase === 'over' && result && (
        <div className="pbzm__veil pbzm__veil--over">
          <div className="pbzm__card pbzm__card--over" role="dialog" aria-label="Game over">
            <p className="pbzm__over-label">Game over</p>
            <p className="pbzm__over-score">{result.score}</p>
            <p className="pbzm__over-line">{result.metres} m run, {result.bones} {result.bones === 1 ? 'bone' : 'bones'}</p>
            <p className="pbzm__over-best">{result.isBest && result.score > 0 ? 'New best!' : `Best: ${result.best}`}</p>
            <button type="button" className="pbzm__primary" onClick={onRestart} autoFocus>{COPY.again}</button>
            <p className="pbzm__find">{COPY.findLine}</p>
            <div className="pbzm__row">
              <Link to="/?quiz=1" className="pbzm__cta" onClick={onCta}>{COPY.findDog}</Link>
              <button type="button" className="pbzm__sec" ref={shareRef} onClick={onShare} disabled={shareBusy}>{COPY.share}</button>
            </div>
            <p className="pbzm__hint">{touch ? '' : 'Enter or Space plays again'}</p>
          </div>
        </div>
      )}
    </>
  );
}

const CSS = `
/* above the veil (z 6): the sound button is shown while the start card is up, so it has to be tappable there too */
.pbzm__bar{position:absolute;left:0;right:0;top:0;z-index:7;display:flex;align-items:flex-start;justify-content:space-between;padding:calc(10px + env(safe-area-inset-top)) 12px 0;pointer-events:none;font-family:'Satoshi',system-ui,sans-serif;color:#011E4A}
.pbzm__score{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding:6px 14px;border-radius:16px;background:rgba(255,247,238,.82);box-shadow:0 2px 10px rgba(1,30,74,.12)}
.pbzm__big{font-family:'Fredoka',sans-serif;font-weight:700;font-size:28px;line-height:1}
.pbzm__small{font-weight:700;font-size:13px}
.pbzm__bones{display:inline-flex;align-items:center;gap:4px;font-weight:800;font-size:14px;color:#B4470B}
.pbzm__best{font-weight:700;font-size:12px;color:#4A5568}
.pbzm__btns{display:flex;gap:8px;pointer-events:auto}
.pbzm__ic{box-sizing:border-box;width:46px;height:46px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;border:2px solid #011E4A;background:rgba(255,247,238,.92);color:#011E4A;cursor:pointer}
.pbzm__ic:focus-visible,.pbzm__primary:focus-visible,.pbzm__sec:focus-visible,.pbzm__cta:focus-visible{outline:3px solid #F5691A;outline-offset:2px}
.pbzm__veil{position:absolute;inset:0;z-index:6;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(1,30,74,.28);overflow-y:auto;font-family:'Satoshi',system-ui,sans-serif;color:#011E4A}
.pbzm__veil--over{background:rgba(1,30,74,.45)}
.pbzm__loading{margin:0;padding:10px 18px;border-radius:999px;background:rgba(255,247,238,.92);font-weight:800;font-size:15px}
.pbzm__card{box-sizing:border-box;width:100%;max-width:420px;max-height:100%;overflow-y:auto;padding:18px 18px 16px;border-radius:22px;background:#FBF8F4;box-shadow:0 14px 40px rgba(1,30,74,.3);text-align:center}
.pbzm__title{margin:0 0 4px;font-family:'Fredoka',sans-serif;font-weight:700;font-size:28px;line-height:1.1}
.pbzm__tag{margin:0 0 12px;font-size:14px;line-height:1.4;color:#4A5568}
.pbzm__how{list-style:none;margin:0 0 14px;padding:0;text-align:left;font-size:14px;line-height:1.35}
.pbzm__how li{display:flex;gap:10px;align-items:baseline;padding:5px 0;border-bottom:1px solid #EAE4DE}
.pbzm__how b{flex:none;min-width:8.6em;font-weight:800}
.pbzm__how span{color:#4A5568}
.pbzm__how .pbzm__how-note{display:block;border:0;color:#B4470B;font-weight:700}
.pbzm__primary{box-sizing:border-box;width:100%;min-height:52px;border-radius:999px;border:2px solid #F5691A;background:#F5691A;color:#011E4A;font:800 17px 'Satoshi',sans-serif;cursor:pointer}
.pbzm__hint{margin:8px 0 0;font-size:12px;color:#6B7280;min-height:14px}
.pbzm__card--over{padding-top:14px}
.pbzm__over-label{margin:0;font-weight:800;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#6B7280}
.pbzm__over-score{margin:0;font-family:'Fredoka',sans-serif;font-weight:700;font-size:56px;line-height:1.05;color:#F5691A}
.pbzm__over-line{margin:0;font-size:14px;font-weight:700}
.pbzm__over-best{margin:2px 0 12px;font-size:14px;font-weight:800;color:#4A5568}
.pbzm__find{margin:14px 0 8px;font-family:'Fredoka',sans-serif;font-weight:600;font-size:18px}
.pbzm__row{display:flex;gap:8px}
.pbzm__row>*{flex:1}
.pbzm__cta,.pbzm__sec{box-sizing:border-box;min-height:48px;display:flex;align-items:center;justify-content:center;border-radius:999px;font:800 15px 'Satoshi',sans-serif;text-decoration:none;cursor:pointer}
.pbzm__cta{background:#011E4A;border:2px solid #011E4A;color:#fff}
.pbzm__sec{background:#fff;border:2px solid #011E4A;color:#011E4A}
.pbzm__sec:disabled{cursor:progress;opacity:.8}
@media (max-height:520px){.pbzm__title{font-size:22px}.pbzm__tag{display:none}.pbzm__over-score{font-size:38px}.pbzm__card{padding:12px}.pbzm__how{margin-bottom:8px}.pbzm__how li{padding:3px 0}.pbzm__big{font-size:22px}}
@media (max-height:380px){.pbzm__how{display:none}.pbzm__find{margin:8px 0 6px;font-size:15px}.pbzm__ic{width:40px;height:40px}}
`;
