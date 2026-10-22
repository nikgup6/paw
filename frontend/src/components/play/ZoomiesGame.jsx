import React, { useEffect, useRef, useState } from 'react';
import { track } from '../../utils/analytics';
import { shareBase } from '../../constants/site';
import { isMuted, playBark, primeAudio } from '../../utils/sounds';
import { ShareSheet, useShareFlow } from '../results/shareFlow';
import { SHARE, STORAGE, scoreBucket } from './engine/config';
import Hud from './Hud';

/* "Street Zoomies": the React side of the 3D game.

   React does only three jobs here:
     1. load the game engine (and the `three` library inside it) ONLY when this component appears, so the homepage and
        the quiz never download any 3D code (that is why the engine is brought in with a dynamic import() below);
     2. show the buttons and cards on top (Hud.jsx), refreshed at most 10 times a second from numbers the engine hands over;
     3. do the things around the game: best score, tracking, sound, sharing.
   The game itself (loop, drawing, collisions) is plain JavaScript in engine/, with no React inside its loop.

   PRIVACY: nothing here goes to a server except three analytics events (game_started, game_over with a score BUCKET,
   game_cta_clicked) and, if the 3D game cannot run, game_fallback_used. Best score and the "how to play" flag live in
   localStorage on this device, always inside try/catch, so the game also works when storage is blocked.

   If anything goes wrong while loading or running, `onFallback(reason)` tells the page to show the 2D game instead. */

const readBest = () => {
  try {
    const n = parseInt(window.localStorage.getItem(STORAGE.best) || '0', 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch { return 0; }
};
const writeBest = (n) => { try { window.localStorage.setItem(STORAGE.best, String(n)); } catch { /* not remembered */ } };
const readSeen = () => { try { return window.localStorage.getItem(STORAGE.howTo) === '1'; } catch { return false; } };
const writeSeen = () => { try { window.localStorage.setItem(STORAGE.howTo, '1'); } catch { /* shown again next time, fine */ } };
const isTouch = () => { try { return window.matchMedia('(pointer: coarse)').matches; } catch { return false; } };

/** A tiny "bling" for picking up a bone. Lives here (not in utils/sounds.js) so only the game download carries it.
    Short and quiet, uses the site's one shared audio context, and stays silent if the whole site is muted. */
function playPickup() {
  try {
    if (isMuted()) return;
    const c = primeAudio();
    if (!c) return;
    const t = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    g.connect(c.destination);
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(880, t);
    o.frequency.setValueAtTime(1320, t + 0.06);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.18);
  } catch { /* no sound is fine */ }
}

const shareUrl = () => `${shareBase()}/play?utm_source=share&utm_medium=game&utm_campaign=${SHARE.campaign}`;

export default function ZoomiesGame({ onFallback }) {
  const stageRef = useRef(null);      // the whole game box: listens for taps and swipes
  const boxRef = useRef(null);        // where the engine puts its <canvas>
  const engineRef = useRef(null);
  const shareBtnRef = useRef(null);
  const soundRef = useRef(false);
  const fallbackRef = useRef(onFallback);
  useEffect(() => { fallbackRef.current = onFallback; });   // always call the newest version

  const [phase, setPhase] = useState('loading');
  const [hud, setHud] = useState({ metres: 0, bones: 0, score: 0 });
  const [result, setResult] = useState(null);
  const [best, setBest] = useState(readBest);
  const [soundOn, setSoundOn] = useState(false);     // sound is OFF until the visitor taps the speaker button
  const [firstRun, setFirstRun] = useState(() => !readSeen());
  const [announce, setAnnounce] = useState('');
  const touch = isTouch();

  const flow = useShareFlow({
    withImage: false,
    getText: () => SHARE.line(result ? result.score : 0, result ? result.metres : 0, result ? result.bones : 0),
    getUrl: shareUrl,
    fileName: 'paw-buddy-zoomies.jpg',
  });

  useEffect(() => {
    let cancelled = false;
    let engine = null;
    (async () => {
      let mod;
      try {
        mod = await import('./engine/GameEngine');          // <- the 3D code is downloaded here, and only here
      } catch (e) {
        if (!cancelled) fallbackRef.current('load_failed', e);
        return;
      }
      if (cancelled) return;
      try {
        engine = new mod.GameEngine(boxRef.current, {
          onPhase: (p) => { if (!cancelled) setPhase(p); },
          onHud: (h) => { if (!cancelled) setHud({ metres: h.metres, bones: h.bones, score: h.score }); },
          onEvent: (name) => {
            if (name === 'start') track('game_started', { mode: '3d' });
            else if (name === 'pickup' && soundRef.current) playPickup();
            else if (name === 'crash' && soundRef.current) playBark();
          },
          onOver: (r) => {
            const prev = readBest();
            const isBest = r.score > prev;
            if (isBest) writeBest(r.score);
            const nb = Math.max(prev, r.score);
            setBest(nb);
            setResult({ ...r, best: nb, isBest });
            setAnnounce(`Game over. You scored ${r.score}: ${r.metres} metres and ${r.bones} bones.`);
            track('game_over', { score_bucket: scoreBucket(r.score), mode: '3d' });
          },
          onError: (reason, err) => { if (!cancelled) fallbackRef.current(reason, err); },
        }, { inputEl: stageRef.current });
      } catch (e) {
        if (!cancelled) fallbackRef.current(e.reason || 'context_failed', e);
        return;
      }
      engineRef.current = engine;
      setPhase(engine.phase);
    })();
    return () => {
      cancelled = true;
      if (engine) engine.dispose();         // frees the graphics memory and removes every listener
      engineRef.current = null;
    };
  }, []);

  const withEngine = (fn) => () => { const e = engineRef.current; if (e) fn(e); };
  const start = withEngine((e) => { if (firstRun) { writeSeen(); setFirstRun(false); } setAnnounce(''); setResult(null); e.start(); });
  const restart = withEngine((e) => { setAnnounce(''); setResult(null); e.start(); });
  const pause = withEngine((e) => e.pause());
  const resume = withEngine((e) => e.resume());

  const toggleSound = () => {
    const next = !soundOn;
    soundRef.current = next;
    setSoundOn(next);
    if (next) { primeAudio(); playPickup(); }           // the first tap lets the browser start sound; a little bling confirms it
  };

  return (
    <div
      className="pbzm"
      ref={stageRef}
      tabIndex={0}
      aria-label="Street Zoomies game. Arrow keys or swipe to dodge, up to jump, down to slide."
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#F8D9B5', touchAction: 'none', overscrollBehavior: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', WebkitTapHighlightColor: 'transparent', outline: 'none' }}
    >
      <div ref={boxRef} style={{ position: 'absolute', inset: 0 }} />
      <Hud
        phase={phase}
        hud={hud}
        result={result}
        touch={touch}
        firstRun={firstRun}
        soundOn={soundOn}
        best={best}
        shareBusy={flow.busy}
        shareRef={shareBtnRef}
        onStart={start}
        onPause={pause}
        onResume={resume}
        onRestart={restart}
        onSound={toggleSound}
        onShare={flow.share}
        onCta={() => track('game_cta_clicked', { source: 'game_over' })}
      />
      <p className="pbzm__sr" role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>{announce}</p>
      <ShareSheet flow={flow} title="Share my run" returnFocusRef={shareBtnRef} />
    </div>
  );
}
