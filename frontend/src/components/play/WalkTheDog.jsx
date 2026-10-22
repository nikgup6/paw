import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { track } from '../../utils/analytics';
import { shareBase } from '../../constants/site';
import { ShareSheet, useShareFlow } from '../results/shareFlow';
import { addStreets } from '../../utils/barkUnlocks';
import { BARK_UNLOCK_ORDER } from '../../constants/quizAudio';
import { BEST_KEY, COPY, STREETS_PER_BARK, scoreBucket, shareLine } from '../../constants/playGame';
import { H, STATE, W, buildLayers, createGame, draw, pressJump, startGame, step } from './engine2d';

/* The "Walk the dog" screen: the canvas, the start / pause / game-over states, the best score, sharing.
   The rules and the drawing are in engine2d.js.
   This is the original 2D game. Since the 3D "Street Zoomies" game arrived it is the FALLBACK: /play shows it only when
   GAME_MODE (constants/playGame.js) is '2d', or when the 3D game cannot run (no WebGL, an error). See pages/Play.jsx.

   PRIVACY: nothing here is sent to a server except three analytics events (game_started, game_over with a
   score BUCKET, game_cta_clicked). The best score and the streets walked live in localStorage on this device,
   always inside try/catch, so the game also works when storage is blocked. */

const QUIZ_LINK = '/?quiz=1';

const readBest = () => {
  try {
    const n = parseInt(window.localStorage.getItem(BEST_KEY) || '0', 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch { return 0; }
};
const writeBest = (n) => { try { window.localStorage.setItem(BEST_KEY, String(n)); } catch { /* not remembered */ } };

const shareUrl = () => `${shareBase()}/play?utm_source=share&utm_medium=game&utm_campaign=walk_the_dog`;

export default function WalkTheDog({ reducedMotion = false, showSkip = true }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const gameRef = useRef(null);
  const ctxRef = useRef(null);
  const loopRef = useRef(null);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const phaseRef = useRef('ready');
  const lockRef = useRef(0);           // ignore taps for a moment after game over so a double tap doesn't restart
  const againRef = useRef(null);
  const shareBtnRef = useRef(null);

  const [phase, setPhaseState] = useState('ready');   // ready | running | paused | over
  const [result, setResult] = useState(null);
  const [optedIn, setOptedIn] = useState(false);       // reduced motion: "Play anyway"
  const [announce, setAnnounce] = useState('');

  const setPhase = (p) => { phaseRef.current = p; setPhaseState(p); };
  const still = reducedMotion && !optedIn;

  const flow = useShareFlow({
    withImage: false,
    getText: () => shareLine(result ? result.metres : 0),
    getUrl: shareUrl,
    fileName: 'paw-buddy-walk.jpg',
  });

  /** The dog hit something: work out the score, the best, any bark unlocked, and show the end panel. */
  const finish = (g) => {
    const metres = g.metres;
    const prevBest = readBest();
    const isBest = metres > prevBest;
    if (isBest) writeBest(metres);
    const best = Math.max(prevBest, metres);
    g.bestStr = best ? `Best ${best} m` : '';
    const { total, unlocked } = addStreets(g.streets);
    const allDone = BARK_UNLOCK_ORDER.length > 0 && unlocked.length === 0 && total >= STREETS_PER_BARK * BARK_UNLOCK_ORDER.length;
    track('game_over', { score_bucket: scoreBucket(metres) });
    lockRef.current = Date.now() + 700;
    setResult({
      metres,
      best,
      isBest,
      unlocked,
      toNext: allDone ? 0 : STREETS_PER_BARK - (total % STREETS_PER_BARK),
    });
    setPhase('over');
    setAnnounce(`Game over. You walked ${metres} metres.`);
    requestAnimationFrame(() => { try { againRef.current?.focus({ preventScroll: true }); } catch { /* ignore */ } });
  };

  // ── set up once: the game state, the canvas, the loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const g = createGame();
    gameRef.current = g;
    const best = readBest();
    g.bestStr = best ? `Best ${best} m` : '';
    const ctx = canvas.getContext('2d', { alpha: false });
    ctxRef.current = ctx;

    const paint = () => draw(ctx, g, g.state !== STATE.RUNNING);

    const fit = () => {
      const cssW = canvas.clientWidth || 360;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pw = Math.round(cssW * dpr);
      const ph = Math.round((pw * H) / W);
      if (canvas.width === pw && canvas.height === ph && g.layers) return;
      canvas.width = pw; canvas.height = ph;
      buildLayers(g, pw / W);
      paint();
    };
    fit();

    // The one loop function: made here, once, and reused for every frame.
    loopRef.current = (ts) => {
      const dt = lastRef.current ? Math.min(0.05, (ts - lastRef.current) / 1000) : 0;
      lastRef.current = ts;
      step(g, dt);
      draw(ctx, g, false);
      if (g.state === STATE.RUNNING) {
        rafRef.current = requestAnimationFrame(loopRef.current);
      } else if (g.state === STATE.OVER) {
        finish(g);
      }
    };

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(canvas);
    document.fonts?.ready?.then(() => { if (g.state !== STATE.RUNNING) paint(); }).catch(() => {});

    // Pause when the tab is hidden; it waits for a tap to carry on.
    const onVis = () => {
      if (document.hidden && phaseRef.current === 'running') {
        cancelAnimationFrame(rafRef.current);
        setPhase('paused');
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = () => {
    lastRef.current = 0;
    rafRef.current = requestAnimationFrame(loopRef.current);
  };

  const begin = () => {
    const g = gameRef.current;
    if (!g || phaseRef.current === 'running') return;
    startGame(g);
    setResult(null);
    setPhase('running');
    setAnnounce('');
    track('game_started');
    run();
    try { stageRef.current?.focus({ preventScroll: true }); } catch { /* ignore */ }
  };

  const resume = () => {
    setPhase('running');
    run();
  };

  const hop = () => {
    const g = gameRef.current;
    if (!g) return;
    const p = phaseRef.current;
    if (p === 'running') pressJump(g);
    else if (p === 'paused') resume();
    else if (p === 'ready' && !still) begin();
  };

  // Tap / click anywhere on the stage (but not on its buttons and links).
  const onPointerDown = (e) => {
    if (e.target.closest && e.target.closest('button, a')) return;
    hop();
  };

  // Space / Up arrow anywhere on the page, unless a button, link or field has the focus (so those keep working).
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
      const t = e.target;
      if (t && t.closest && t.closest('button, a, input, textarea, select, [contenteditable="true"]')) return;
      if (phaseRef.current === 'over') return;
      e.preventDefault();
      if (e.repeat) return;
      hop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still]);

  const again = () => {
    if (Date.now() < lockRef.current) return;
    begin();
  };

  const toQuiz = () => track('game_cta_clicked', { source: 'game_over' });

  return (
    <section className="pbpl" aria-labelledby="pbpl-title">
      <style>{CSS}</style>
      <h1 id="pbpl-title" className="pbpl__title">{COPY.title}</h1>
      <p className="pbpl__lede">{COPY.lede}</p>

      <div
        className="pbpl__stage"
        ref={stageRef}
        tabIndex={0}
        data-state={phase}
        data-score={result ? result.metres : undefined}
        onPointerDown={onPointerDown}
        aria-label={`${COPY.title} game. ${COPY.controls}`}
      >
        <canvas ref={canvasRef} className="pbpl__canvas" role="img" aria-label="An orange dog running down a busy street" />

        {phase === 'ready' && !still && (
          <div className="pbpl__veil">
            <button type="button" className="pbpl__big" onClick={begin}>{COPY.start}</button>
          </div>
        )}
        {phase === 'ready' && still && (
          <div className="pbpl__veil pbpl__veil--solid">
            <p className="pbpl__stilltitle">{COPY.stillTitle}</p>
            <p className="pbpl__tip">{COPY.stillBody}</p>
            <button type="button" className="pbpl__big" onClick={() => setOptedIn(true)}>{COPY.playAnyway}</button>
          </div>
        )}
        {phase === 'paused' && (
          <div className="pbpl__veil pbpl__veil--solid">
            <p className="pbpl__stilltitle">Paused</p>
            <button type="button" className="pbpl__big" onClick={resume}>Keep walking</button>
          </div>
        )}
      </div>

      {phase === 'over' && result && (
        <div className="pbpl__over">
          <p className="pbpl__score">You walked <strong>{result.metres} m</strong></p>
          <p className="pbpl__best">{result.isBest && result.metres > 0 ? 'New best!' : `Best: ${result.best} m`}</p>
          {result.unlocked.length > 0 && (
            <p className="pbpl__unlock">Bark unlocked: {result.unlocked.join(', ')}. Hear it on your results page.</p>
          )}
          {result.toNext > 0 && result.unlocked.length === 0 && (
            <p className="pbpl__next">{result.toNext} more {result.toNext === 1 ? 'street' : 'streets'} (100 m each) to unlock a new bark.</p>
          )}
          <p className="pbpl__find">{COPY.findLine}</p>
          <div className="pbpl__actions">
            <Link to={QUIZ_LINK} className="pbpl__cta" onClick={toQuiz}>{COPY.findDog}</Link>
            <button type="button" className="pbpl__sec" ref={againRef} onClick={again}>{COPY.again}</button>
            <button type="button" className="pbpl__sec" ref={shareBtnRef} onClick={flow.share} disabled={flow.busy}>{COPY.share}</button>
          </div>
        </div>
      )}

      <p className="pbpl__hint">{COPY.controls}</p>
      {showSkip && <Link to={QUIZ_LINK} className="pbpl__skip">{COPY.skip}</Link>}

      <p className="pbpl__sr" role="status" aria-live="polite">{announce}</p>
      <ShareSheet flow={flow} title="Share my walk" returnFocusRef={shareBtnRef} />
    </section>
  );
}

const CSS = `
.pbpl{box-sizing:border-box;width:100%;max-width:760px;margin:0 auto;padding:18px 16px 36px;color:#011E4A;font-family:'Satoshi',system-ui,sans-serif}
.pbpl__title{margin:4px 0 6px;font-family:'Fredoka',sans-serif;font-weight:700;font-size:clamp(28px,6vw,40px);line-height:1.1}
.pbpl__lede{margin:0 0 14px;font-size:15px;line-height:1.5;color:#4A5568}
.pbpl__stage{position:relative;border:2px solid #011E4A;border-radius:18px;overflow:hidden;background:#FFE9D8;touch-action:manipulation;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;cursor:pointer}
.pbpl__stage:focus-visible{outline:3px solid #F5691A;outline-offset:3px}
.pbpl__canvas{display:block;width:100%;aspect-ratio:16/9;background:#FFE9D8}
.pbpl__veil{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:12px;text-align:center;background:linear-gradient(180deg,rgba(255,246,236,.0) 30%,rgba(255,246,236,.55))}
.pbpl__veil--solid{background:rgba(251,248,244,.9)}
.pbpl__big{box-sizing:border-box;min-height:48px;padding:0 26px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;border:2px solid #F5691A;background:#F5691A;color:#011E4A;font:700 16px 'Satoshi',sans-serif;cursor:pointer}
.pbpl__tip{margin:0;font-size:13px;line-height:1.4;color:#011E4A;max-width:30em}
.pbpl__stilltitle{margin:0;font-family:'Fredoka',sans-serif;font-weight:700;font-size:19px}
.pbpl__over{margin-top:14px;padding:16px;border:2px solid #EAE4DE;border-radius:18px;background:#fff}
.pbpl__score{margin:0;font-size:16px}
.pbpl__score strong{font-family:'Fredoka',sans-serif;font-size:34px;color:#F5691A;margin-left:4px}
.pbpl__best{margin:2px 0 8px;font-weight:800;font-size:14px;color:#4A5568}
.pbpl__unlock{margin:0 0 8px;padding:8px 12px;border-radius:12px;background:#FFF1E3;font-weight:700;font-size:14px}
.pbpl__next{margin:0 0 8px;font-size:13px;color:#4A5568}
.pbpl__find{margin:10px 0 12px;font-family:'Fredoka',sans-serif;font-weight:600;font-size:19px}
.pbpl__actions{display:flex;flex-direction:column;gap:8px}
@media (min-width:520px){.pbpl__actions{flex-direction:row}.pbpl__actions>*{flex:1}}
.pbpl__cta,.pbpl__sec{box-sizing:border-box;min-height:48px;display:flex;align-items:center;justify-content:center;border-radius:999px;font:700 15px 'Satoshi',sans-serif;text-decoration:none;cursor:pointer}
.pbpl__cta{background:#F5691A;border:2px solid #F5691A;color:#011E4A}
.pbpl__sec{background:#fff;border:2px solid #011E4A;color:#011E4A}
.pbpl__sec:disabled{cursor:progress;opacity:.8}
.pbpl__big:focus-visible,.pbpl__cta:focus-visible,.pbpl__sec:focus-visible,.pbpl__skip:focus-visible{outline:3px solid #011E4A;outline-offset:2px}
.pbpl__hint{margin:12px 0 4px;font-size:13px;color:#6B7280;text-align:center}
.pbpl__skip{display:flex;align-items:center;justify-content:center;min-height:44px;color:#011E4A;font-weight:800;font-size:15px;text-decoration:underline;text-underline-offset:3px}
.pbpl__sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
`;
