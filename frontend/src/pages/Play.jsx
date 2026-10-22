import React, { Suspense, lazy, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { track } from '../utils/analytics';
import { GAME_MODE } from '../constants/playGame';
import WalkTheDog from '../components/play/WalkTheDog';
import DogArt from '../components/quiz/DogArt';
import { ToySlots } from '../components/fun/SqueakyToy';

/* The public /play page. It is the lazy "shell": it decides WHICH game to show and keeps the page around it safe.

   - GAME_MODE (constants/playGame.js) '3d' = "Street Zoomies", the 3D runner (default); '2d' = the original 2D game.
   - The 3D game and the `three` library are in their OWN download, fetched only when the 3D game appears
     (ZoomiesGame.jsx brings the engine in with a dynamic import). This page never imports `three` itself.
   - If the 3D game cannot run (no WebGL, the download fails, an error while playing), we show the 2D game instead and
     send one `game_fallback_used` event with the reason. If even that breaks, a friendly card with a link to the quiz.
   - A visible "Skip to the quiz" link sits under the game all the time.
   - With "reduce motion" switched on, the 3D scene does NOT start by itself: a calm still picture and a "Play anyway"
     button are shown instead.
   - The game is its own page: it never appears inside the quiz, the results, or before the lead gate. */

const ZoomiesGame = lazy(() => import('../components/play/ZoomiesGame'));
const QUIZ_LINK = '/?quiz=1';

/** Catches an error thrown anywhere inside the game, so it can never white-screen the site. */
class GameBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) {
    if (import.meta.env.DEV) console.error('[play] the game crashed', error);
    this.props.onError('runtime_error');
  }
  render() { return this.state.failed ? null : this.props.children; }
}

const Loading = () => <p className="pbpg__note" role="status">Loading the street...</p>;

/** The calm still picture shown instead of the moving 3D scene when "reduce motion" is on. */
function StillScene({ onPlay }) {
  return (
    <div className="pbpg__still">
      <div className="pbpg__still-sun" />
      <div className="pbpg__still-shops" aria-hidden="true">
        {['#F5691A', '#011E4A', '#2E9E7A', '#F7C325', '#3C7DD9', '#D6457B'].map((c) => <i key={c} style={{ background: c }} />)}
      </div>
      <div className="pbpg__still-road" />
      <div className="pbpg__still-dog" aria-hidden="true"><DogArt mood="sit" width={110} /></div>
      <div className="pbpg__still-text">
        <h2>Street Zoomies</h2>
        <p>Motion is turned off on your device, so the game is paused. You can still play if you like.</p>
        <button type="button" className="pbpg__btn" onClick={onPlay}>Play anyway</button>
      </div>
    </div>
  );
}

/** Last resort: neither game could run. */
function FriendlyCard() {
  return (
    <div className="pbpg__card">
      <h2>Your browser can't run the game right now</h2>
      <p>No problem. The real dog is only 2 minutes away.</p>
      <Link to={QUIZ_LINK} className="pbpg__btn" onClick={() => track('game_cta_clicked', { source: 'fallback' })}>Find my dog</Link>
    </div>
  );
}

export default function Play() {
  const reduce = !!useReducedMotion();
  const [mode, setMode] = useState(GAME_MODE === '2d' ? '2d' : '3d');
  const [playAnyway, setPlayAnyway] = useState(false);
  const tracked = useRef({});

  // The 3D game (or the 2D one) could not run: tell analytics once per step, then move down one step.
  const fail = (reason) => {
    if (!tracked.current[mode]) {
      tracked.current[mode] = true;
      track('game_fallback_used', { reason: typeof reason === 'string' ? reason : 'runtime_error' });
    }
    setMode((m) => (m === '3d' ? '2d' : 'card'));
  };

  const still = reduce && !playAnyway && mode === '3d';

  return (
    <div className="pbpg">
      <style>{CSS}</style>
      {/* Squeaky toys on the page margins (never inside the game's picture) */}
      <ToySlots group="play" page="play" />
      <header className="pbpg__head">
        <Link to="/" aria-label="Paw Buddy home">
          <img src="/logo.png" alt="Paw Buddy" className="pbpg__logo" />
        </Link>
      </header>
      {mode !== '2d' && <h1 className="pbpg__sr">Street Zoomies, a running game</h1>}

      {mode === '3d' && (
        <div className="pbpg__game">
          {still ? <StillScene onPlay={() => setPlayAnyway(true)} /> : (
            <GameBoundary key="3d" onError={fail}>
              <Suspense fallback={<Loading />}>
                <ZoomiesGame onFallback={fail} />
              </Suspense>
            </GameBoundary>
          )}
        </div>
      )}

      {mode === '2d' && (
        <GameBoundary key="2d" onError={fail}>
          <WalkTheDog reducedMotion={reduce && !playAnyway} showSkip={false} />
        </GameBoundary>
      )}

      {mode === 'card' && <FriendlyCard />}

      <Link to={QUIZ_LINK} className="pbpg__skip">Skip to the quiz</Link>
      <p className="pbpg__line">Play while you wait. The real dog is 2 minutes away.</p>
    </div>
  );
}

const CSS = `
/* --pbpg-head is the header's own height. The logo is 376x298, so at 84px wide it is 67px tall; the
   header used to be 60px and the game area began right under it, which sliced the "PAW BUDDY" name off
   the bottom of the logo. The game height subtracts this variable, so the two can never disagree again.
   env(safe-area-inset-top) keeps the logo out from under a phone's status bar / notch (0 on phones without one). */
.pbpg{--pbpg-head:78px;position:relative;overflow-x:clip;background:#FBF8F4;min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;font-family:'Satoshi',system-ui,sans-serif;color:#011E4A}
.pbpg__head{box-sizing:border-box;height:calc(var(--pbpg-head) + env(safe-area-inset-top));max-width:1100px;width:100%;margin:0 auto;padding:calc(6px + env(safe-area-inset-top)) 16px 0}
.pbpg__logo{display:block;width:84px;height:auto;mix-blend-mode:multiply}
.pbpg__sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.pbpg__game{box-sizing:border-box;position:relative;width:100%;max-width:1100px;margin:0 auto;height:calc(100vh - var(--pbpg-head) - 64px);height:calc(100dvh - var(--pbpg-head) - 64px - env(safe-area-inset-top));min-height:340px;max-height:860px;background:#F8D9B5;overflow:hidden}
@media (min-width:700px){.pbpg__game{border-radius:22px;border:2px solid #011E4A;width:calc(100% - 32px)}}
/* a phone held sideways: squeeze the header so the game AND the skip link both fit without scrolling */
@media (max-height:520px){.pbpg{--pbpg-head:52px}.pbpg__head{padding-top:calc(4px + env(safe-area-inset-top))}.pbpg__logo{width:56px}.pbpg__game{height:calc(100vh - var(--pbpg-head) - 36px);height:calc(100dvh - var(--pbpg-head) - 36px - env(safe-area-inset-top));min-height:240px}.pbpg__skip{min-height:44px}.pbpg__line{padding-bottom:16px}}
.pbpg__note{margin:0;padding:24px;text-align:center;font-weight:700}
.pbpg__skip{display:flex;align-items:center;justify-content:center;min-height:52px;color:#011E4A;font-weight:800;font-size:16px;text-decoration:underline;text-underline-offset:3px}
.pbpg__skip:focus-visible,.pbpg__btn:focus-visible{outline:3px solid #F5691A;outline-offset:3px}
.pbpg__line{margin:0;padding:6px 16px 28px;text-align:center;font-size:14px;color:#4A5568}
.pbpg__card{box-sizing:border-box;max-width:460px;margin:24px auto;padding:22px 20px;border-radius:22px;border:2px solid #EAE4DE;background:#fff;text-align:center}
.pbpg__card h2,.pbpg__still-text h2{margin:0 0 6px;font-family:'Fredoka',sans-serif;font-weight:700;font-size:24px;line-height:1.15}
.pbpg__card p,.pbpg__still-text p{margin:0 0 14px;font-size:15px;line-height:1.45;color:#4A5568}
.pbpg__btn{box-sizing:border-box;min-height:50px;padding:0 28px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;border:2px solid #F5691A;background:#F5691A;color:#011E4A;font:800 16px 'Satoshi',sans-serif;text-decoration:none;cursor:pointer}
.pbpg__still{position:absolute;inset:0;background:linear-gradient(180deg,#FFF6EC 0%,#FFD9BD 55%,#F8D9B5 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.pbpg__still-sun{position:absolute;right:14%;top:12%;width:90px;height:90px;border-radius:50%;background:rgba(245,105,26,.3)}
.pbpg__still-shops{position:absolute;left:0;right:0;bottom:22%;height:26%;display:flex}
.pbpg__still-shops i{flex:1;opacity:.55;border-top:10px solid rgba(255,255,255,.4)}
.pbpg__still-road{position:absolute;left:0;right:0;bottom:0;height:22%;background:#4A4A58;border-top:6px solid #CBBFAF}
.pbpg__still-dog{position:absolute;left:50%;bottom:18%;transform:translateX(-50%)}
.pbpg__still-text{position:relative;z-index:1;max-width:380px;padding:18px 20px;margin-bottom:12%;border-radius:20px;background:rgba(251,248,244,.92)}
`;
