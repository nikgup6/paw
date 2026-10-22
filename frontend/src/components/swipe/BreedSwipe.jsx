import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMotionValue, useTransform, useReducedMotion } from 'framer-motion';
import { computeMatches, flagLabel, generateProsCons, NOT_RECOMMENDED_LABEL } from '../../utils/breedUtils';
import { track } from '../../utils/analytics';
import { getShortlist, setShortlist, getTutorialSeen, setTutorialSeen } from '../../utils/swipeState';
import SwipeCard, { BehindCard } from './SwipeCard';
import BreedInfoSheet from './BreedInfoSheet';
import SwipeTutorial from './SwipeTutorial';
import SwipeSummary from './SwipeSummary';
import { HeartIcon, XIcon, UndoIcon, InfoIcon, HelpIcon } from './swipeIcons';

/* Breed Swipe: a Tinder-style deck of breeds.

   It only READS the engine (computeMatches) and never changes matching, saving
   or the breed data. Honest by design:
   - with quiz answers: every card shows the engine's real % and label, best
     fit first, and "Not recommended" breeds go last but are still shown;
   - without answers: no percentages at all, just a "take the quiz" chip;
   - breeds are never ordered or highlighted by looks.

   Props
     breeds        all breeds
     answers       quiz answers, or null
     excludeNames  names to leave out (the Top 5 already shown)
     source        'explore' | 'results'
     onClose, onSliderView, onBuy, onFullProfile, onCompare, onTakeQuiz */

const TOAST_MS = 5000;
const NONE = [];

const usable = (a) => !!a && typeof a === 'object' && Object.keys(a).length > 0;

export default function BreedSwipe({ breeds, answers, excludeNames = NONE, source = 'explore', onClose, onSliderView, onBuy, onFullProfile, onCompare, onTakeQuiz }) {
  const reduced = !!useReducedMotion();

  /* ---- the deck ---- */
  const { all, deck, hasAnswers } = useMemo(() => {
    const skip = new Set(excludeNames);
    if (usable(answers)) {
      try {
        const scored = computeMatches(answers, breeds);
        const byScore = (a, b) => b.matchPercentage - a.matchPercentage;
        const fits = scored.filter((b) => b.label !== NOT_RECOMMENDED_LABEL && !skip.has(b.name)).sort(byScore);
        const misfits = scored.filter((b) => b.label === NOT_RECOMMENDED_LABEL && !skip.has(b.name)).sort(byScore);
        return { all: scored, deck: [...fits, ...misfits], hasAnswers: true };
      } catch (e) {
        // Answers the engine cannot read: fall back to the honest no-score deck.
      }
    }
    return { all: breeds, deck: breeds.filter((b) => !skip.has(b.name)), hasAnswers: false };
  }, [breeds, answers, excludeNames]);

  /* ---- state ---- */
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState([]);           // { id, dir, added }
  const [ids, setIds] = useState(getShortlist);         // shortlisted breed ids
  const [command, setCommand] = useState(null);         // button / key swipes
  const [sheet, setSheet] = useState(null);
  const [tutorial, setTutorial] = useState(() => (getTutorialSeen() ? null : 0));
  const [toast, setToast] = useState(null);             // { text }
  const [live, setLive] = useState('');

  const x = useMotionValue(0);
  const behindScale = useTransform(x, [-150, 0, 150], [1, 0.95, 1]);
  const rootRef = useRef(null);
  const toastTimer = useRef(null);
  const lastFocus = useRef(null);
  const latest = useRef({});
  latest.current = { index, deck, ids, history, sheet, tutorial, command };

  const finished = index >= deck.length;
  const remaining = Math.max(0, deck.length - index);
  const top = deck[index];
  const behind = deck[index + 1];
  const analyticsProps = { source, hasAnswers };

  /* ---- mount: focus, scroll lock, analytics, restore focus ---- */
  useEffect(() => {
    lastFocus.current = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    rootRef.current?.focus({ preventScroll: true });
    track('swipe_open', analyticsProps);
    return () => {
      document.body.style.overflow = prev;
      clearTimeout(toastTimer.current);
      try { lastFocus.current?.focus?.({ preventScroll: true }); } catch (e) { /* element gone */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preload the next two images.
  useEffect(() => {
    const imgs = [1, 2].map((k) => deck[index + k]).filter(Boolean).map((b) => { const im = new Image(); im.src = `/${b.img}`; return im; });
    return () => { imgs.length = 0; };
  }, [index, deck]);

  /* ---- helpers ---- */
  const announce = (text) => setLive(text);
  const showToast = (text) => {
    setToast({ text });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };
  const saveIds = (next) => { setIds(next); setShortlist(next); };

  const commit = (dir) => {
    const { index: i, deck: d, ids: current } = latest.current;
    const breed = d[i];
    setCommand(null);
    if (!breed) return;
    const id = String(breed.id);
    let added = false;
    if (dir === 1) {
      if (!current.includes(id)) { added = true; saveIds([...current, id]); }
      track('swipe_shortlist', analyticsProps);
      announce(`Shortlisted ${breed.name}`);
      if (hasAnswers && breed.label === NOT_RECOMMENDED_LABEL) {
        const why = (breed.warnings && breed.warnings[0]) || (breed.flags && breed.flags[0] && flagLabel(breed.flags[0])) || (generateProsCons(breed, answers).matchedCons || [])[0] || '';
        showToast(`Heads up: ${breed.name} scored 'Not recommended' for your answers. ${why}`.trim());
      }
    } else {
      track('swipe_pass', analyticsProps);
      announce(`Passed ${breed.name}`);
    }
    try { navigator.vibrate?.(10); } catch (e) { /* not supported */ }
    setHistory((h) => [...h, { id, dir, added, name: breed.name }]);
    setIndex(i + 1);
    x.set(0);
  };

  const undo = () => {
    const { history: h, ids: current } = latest.current;
    const last = h[h.length - 1];
    if (!last) return;
    clearTimeout(toastTimer.current);
    setToast(null);
    setHistory(h.slice(0, -1));
    if (last.added) saveIds(current.filter((v) => v !== last.id));
    setIndex((i) => Math.max(0, i - 1));
    x.set(0);
    track('swipe_undo', analyticsProps);
    announce(`Undid ${last.dir === 1 ? 'shortlist' : 'pass'} for ${last.name}`);
  };

  const requestSwipe = (dir) => {
    const { index: i, deck: d, sheet: s, tutorial: t } = latest.current;
    if (s || t !== null || i >= d.length) return;
    setCommand({ dir, id: `${Date.now()}-${dir}` });
  };

  const openSheet = (breed) => {
    if (latest.current.tutorial !== null) return;
    lastFocus.current = document.activeElement;
    setSheet(breed);
  };
  const closeSheet = () => {
    setSheet(null);
    requestAnimationFrame(() => { try { lastFocus.current?.focus?.({ preventScroll: true }); } catch (e) { /* */ } });
  };

  const toggleShortlist = (breed) => {
    const id = String(breed.id);
    const on = latest.current.ids.includes(id);
    saveIds(on ? latest.current.ids.filter((v) => v !== id) : [...latest.current.ids, id]);
    if (!on) track('swipe_shortlist', analyticsProps);
    announce(`${on ? 'Removed' : 'Shortlisted'} ${breed.name}`);
  };

  const findBreeders = (breed) => { track('swipe_find_breeders', analyticsProps); onBuy(breed); };
  const closeTutorial = () => { setTutorialSeen(); setTutorial(null); rootRef.current?.focus({ preventScroll: true }); };

  const startOver = () => { setIndex(0); setHistory([]); setToast(null); x.set(0); announce('Starting over'); };

  const shortlistBreeds = ids.map((id) => all.find((b) => String(b.id) === id)).filter(Boolean);
  const compareTop = () => {
    if (!shortlistBreeds.length) return;
    const best = hasAnswers
      ? [...shortlistBreeds].sort((a, b) => b.matchPercentage - a.matchPercentage)[0]
      : shortlistBreeds[0];
    onCompare(best);
  };

  /* ---- keyboard ---- */
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const { sheet: s, tutorial: t, index: i, deck: d } = latest.current;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (t !== null) closeTutorial();
        else if (s) closeSheet();
        else onClose();
        return;
      }
      if (t !== null || s) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); requestSwipe(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); requestSwipe(1); }
      else if (e.key === 'i' || e.key === 'I') { if (i < d.length) { e.preventDefault(); openSheet(d[i]); } }
      else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const demo = tutorial === 0 ? 'right' : tutorial === 1 ? 'left' : tutorial === 2 ? 'tap' : null;

  return createPortal(
    <div className="pbsw" ref={rootRef} tabIndex={-1} role="dialog" aria-label="Breed swipe">
      <style>{CSS}</style>
      <p className="pbsw__sr" aria-live="polite">{live}</p>

      <header className="pbsw__header">
        <button type="button" className="pbsw__iconbtn" aria-label="Close breed swipe" onClick={onClose}><XIcon size={20} /></button>
        <div className="pbsw__title">
          <strong>{finished ? 'All done' : `${remaining} ${remaining === 1 ? 'breed' : 'breeds'} to go`}</strong>
          {source === 'explore' && onSliderView && (
            <button type="button" className="pbsw__link" onClick={onSliderView}>Slider view</button>
          )}
        </div>
        <button type="button" className="pbsw__iconbtn" aria-label="How Breed Swipe works" onClick={() => setTutorial(0)}><HelpIcon size={22} /></button>
        <span className="pbsw__shortcount" role="img" aria-label={`${ids.length} shortlisted`}>
          <HeartIcon size={22} filled={ids.length > 0} />
          {ids.length > 0 && <b>{ids.length}</b>}
        </span>
      </header>

      {finished ? (
        <SwipeSummary
          total={deck.length}
          partial={excludeNames.length > 0}
          shortlist={shortlistBreeds}
          hasAnswers={hasAnswers}
          source={source}
          onOpen={openSheet}
          onFindBreeders={findBreeders}
          onCompareTop={compareTop}
          onStartOver={startOver}
          onBack={onClose}
          onTakeQuiz={onTakeQuiz}
        />
      ) : (
        <>
          <div className="pbsw__stage">
            <div className="pbsw__stack">
              {behind && <BehindCard key={behind.id} breed={behind} hasAnswers={hasAnswers} scale={behindScale} onTakeQuiz={onTakeQuiz} />}
              <SwipeCard
                key={top.id}
                breed={top}
                hasAnswers={hasAnswers}
                x={x}
                command={command}
                onCommit={commit}
                onInfo={() => openSheet(top)}
                onTakeQuiz={onTakeQuiz}
                reduced={reduced}
                demo={demo}
              />
            </div>
          </div>

          <div className="pbsw__btns">
            <button type="button" className="pbsw__round pbsw__round--pass" aria-label="Pass" onClick={() => requestSwipe(-1)}><XIcon size={26} /></button>
            <button type="button" className="pbsw__round" aria-label="Undo last swipe" disabled={history.length === 0} onClick={undo}><UndoIcon size={24} /></button>
            <button type="button" className="pbsw__round pbsw__round--yes" aria-label="Shortlist" onClick={() => requestSwipe(1)}><HeartIcon size={26} filled /></button>
            <button type="button" className="pbsw__round" aria-label="More info" onClick={() => openSheet(top)}><InfoIcon size={24} /></button>
          </div>
        </>
      )}

      {toast && (
        <div className="pbsw__toast" role="status">
          <span>{toast.text}</span>
          <button type="button" onClick={undo}>Undo</button>
        </div>
      )}

      {sheet && (
        <BreedInfoSheet
          breed={sheet}
          answers={answers}
          hasAnswers={hasAnswers}
          shortlisted={ids.includes(String(sheet.id))}
          onToggleShortlist={toggleShortlist}
          onClose={closeSheet}
          onBuy={findBreeders}
          onFullProfile={onFullProfile}
          onCompare={onCompare}
          onTakeQuiz={onTakeQuiz}
        />
      )}

      {tutorial !== null && (
        <SwipeTutorial step={tutorial} onStep={setTutorial} onClose={closeTutorial} hasAnswers={hasAnswers} reduced={reduced} />
      )}
    </div>,
    document.body,
  );
}

const CSS = `
.pbsw{position:fixed;inset:0;z-index:999;display:flex;flex-direction:column;background:#FBF8F4;color:#011E4A;font-family:'Satoshi',system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;overflow:hidden;outline:none}
.pbsw *,.pbsw *::before,.pbsw *::after{box-sizing:border-box}
.pbsw button{font-family:inherit;cursor:pointer}
.pbsw :focus-visible{outline:3px solid #011E4A;outline-offset:2px}
.pbsw__sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}

.pbsw__header{flex:none;display:flex;align-items:center;gap:6px;padding:8px 10px 4px;max-width:560px;width:100%;margin:0 auto}
.pbsw__iconbtn{width:44px;height:44px;border-radius:50%;border:1px solid #EAE4DE;background:#fff;color:#011E4A;display:inline-flex;align-items:center;justify-content:center}
.pbsw__title{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;text-align:center;font-family:'Fredoka',sans-serif;font-size:18px}
.pbsw__link{background:none;border:0;padding:2px 8px;min-height:28px;font-size:13px;font-weight:700;color:#B34A0E;text-decoration:underline;text-underline-offset:3px}
.pbsw__shortcount{position:relative;width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;color:#F5691A}
.pbsw__shortcount b{position:absolute;top:2px;right:0;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#011E4A;color:#fff;font-size:12px;line-height:20px;text-align:center}

.pbsw__stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:6px 16px}
.pbsw__stack{position:relative;width:min(380px,100%,calc((100dvh - 250px) * .75));aspect-ratio:3/4}
.pbsw__card{position:absolute;inset:0;border-radius:24px;touch-action:pan-y;will-change:transform}
.pbsw__card--top{cursor:grab;z-index:2}
.pbsw__card--top:active{cursor:grabbing}
.pbsw__card--behind{z-index:1;pointer-events:none}
.pbsw__face{position:relative;width:100%;height:100%;border-radius:24px;overflow:hidden;background:#E3ECF7;box-shadow:0 12px 32px rgba(1,30,74,.18);user-select:none;-webkit-user-select:none}
.pbsw__photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}
.pbsw__shade{position:absolute;left:0;right:0;bottom:0;height:62%;background:linear-gradient(to top,rgba(1,30,74,.95) 0%,rgba(1,30,74,.7) 42%,rgba(1,30,74,0) 100%);pointer-events:none}
.pbsw__tags{position:absolute;top:12px;left:12px;max-width:calc(100% - 150px);display:flex;flex-direction:column;align-items:flex-start;gap:6px}
.pbsw__tag{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:10px;font-size:12px;font-weight:700;line-height:1.25}
.pbsw__tag--red{background:#fff;color:#A5352C;border:1.5px solid #C0463C}
.pbsw__tag--amber{background:#fff;color:#8A5A12;border:1.5px solid #E8A33D}
.pbsw__badge{position:absolute;top:12px;right:12px;max-width:150px;display:flex;flex-direction:column;align-items:flex-end}
.pbsw__ringwrap{display:flex;flex-direction:column;align-items:center;gap:4px;max-width:120px}
.pbsw__ring{width:56px;height:56px;border-radius:50%;background:#fff;border:4px solid #F5691A;display:flex;align-items:center;justify-content:center;font-family:'Fredoka',sans-serif;font-weight:700;font-size:16px;color:#011E4A}
.pbsw__ringlabel{padding:2px 7px;border-radius:8px;color:#fff;font-size:11px;font-weight:700;line-height:1.25;text-align:center}
.pbsw__quizchip{min-height:44px;max-width:150px;padding:8px 10px;border:0;border-radius:14px;background:#E3ECF7;color:#011E4A;font-size:12px;font-weight:700;line-height:1.3;text-align:left}
.pbsw__info{position:absolute;left:16px;right:70px;bottom:16px;color:#fff}
.pbsw__name{margin:0;font-family:'Fredoka',sans-serif;font-weight:700;font-size:28px;line-height:1.1;color:#fff}
.pbsw__line{margin:4px 0 8px;font-size:14px;color:rgba(255,255,255,.92)}
.pbsw__facts{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.pbsw__facts li{padding:4px 9px;border-radius:999px;background:rgba(1,30,74,.7);border:1px solid rgba(255,255,255,.25);font-size:12px;font-weight:600;color:#fff}
.pbsw__ibtn{position:absolute;right:12px;bottom:12px;width:44px;height:44px;border-radius:50%;border:0;background:#fff;color:#011E4A;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(1,30,74,.25)}
.pbsw__stamp{position:absolute;top:64px;display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:12px;background:rgba(255,255,255,.92);font-family:'Fredoka',sans-serif;font-weight:700;font-size:22px;letter-spacing:.04em;opacity:0;pointer-events:none}
.pbsw__stamp--yes{left:16px;color:#1E8A4C;border:3px solid #1E8A4C;transform:rotate(-14deg)}
.pbsw__stamp--no{right:16px;color:#5B6472;border:3px solid #5B6472;transform:rotate(14deg)}

.pbsw__btns{flex:none;display:flex;justify-content:center;gap:14px;padding:8px 10px calc(14px + env(safe-area-inset-bottom))}
.pbsw__round{width:56px;height:56px;border-radius:50%;border:2px solid #EAE4DE;background:#fff;color:#011E4A;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(1,30,74,.1);transition:transform .15s}
.pbsw__round:active:not(:disabled){transform:scale(.94)}
.pbsw__round:disabled{opacity:.4;cursor:not-allowed}
.pbsw__round--pass{color:#5B6472}
.pbsw__round--yes{background:#F5691A;border-color:#F5691A;color:#fff}

.pbsw__toast{position:absolute;left:12px;right:12px;bottom:92px;max-width:520px;margin:0 auto;z-index:15;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:#011E4A;color:#fff;font-size:14px;line-height:1.35;box-shadow:0 8px 24px rgba(1,30,74,.35)}
.pbsw__toast span{flex:1}
.pbsw__toast button{flex:none;min-width:44px;min-height:44px;padding:0 10px;background:none;border:0;color:#FFD9BD;font-weight:800;font-size:14px;text-decoration:underline}
.pbsw__toast :focus-visible{outline-color:#fff}

/* primary / secondary / text buttons (sheet, summary, tutorial) */
.pbsw__primary{min-height:48px;padding:0 22px;border:0;border-radius:999px;background:#F5691A;color:#011E4A;font-size:16px;font-weight:700;box-shadow:0 6px 16px rgba(245,105,26,.28)}
.pbsw__secondary{min-height:48px;padding:0 20px;border:2px solid #011E4A;border-radius:999px;background:#fff;color:#011E4A;font-size:15px;font-weight:700}
.pbsw__textbtn{min-height:44px;padding:0 12px;border:0;background:none;color:#011E4A;font-size:15px;font-weight:700;text-decoration:underline;text-underline-offset:3px}

/* info sheet */
.pbsw__sheetwrap{position:absolute;inset:0;z-index:20;background:rgba(1,30,74,.45);display:flex;align-items:flex-end;justify-content:center}
.pbsw__sheet{position:relative;width:100%;max-width:560px;height:82%;display:flex;flex-direction:column;background:#fff;border-radius:24px 24px 0 0;box-shadow:0 -10px 30px rgba(1,30,74,.2);animation:pbsw-up .28s ease both;outline:none}
@keyframes pbsw-up{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
.pbsw__handle{flex:none;width:100%;height:30px;border:0;background:none;display:flex;align-items:center;justify-content:center}
.pbsw__handle span{width:44px;height:5px;border-radius:5px;background:#D8D2CB}
.pbsw__sheetx{position:absolute;top:2px;right:6px;width:44px;height:44px;border:0;border-radius:50%;background:none;color:#011E4A;display:inline-flex;align-items:center;justify-content:center}
.pbsw__sheetbody{flex:1;min-height:0;overflow-y:auto;padding:0 16px 12px;-webkit-overflow-scrolling:touch}
.pbsw__sheethead{display:flex;align-items:flex-start;gap:12px;margin-bottom:6px;padding-right:34px}
.pbsw__sheethead img{width:72px;height:72px;border-radius:16px;object-fit:cover;flex:none}
.pbsw__sheethead > div:first-of-type{flex:1;min-width:0}
.pbsw__sheethead h2{margin:0;font-family:'Fredoka',sans-serif;font-weight:700;font-size:22px;line-height:1.15}
.pbsw__sheethead p{margin:2px 0 0;font-size:14px;color:#4A5568}
.pbsw__sheethead .pbsw__ringwrap,.pbsw__sheethead .pbsw__quizchip{flex:none}
.pbsw__sheethead .pbsw__ring{width:52px;height:52px;font-size:15px}
.pbsw__sec{padding:14px 0;border-top:1px solid #F0EBE5}
.pbsw__sec h3{margin:0 0 8px;font-family:'Fredoka',sans-serif;font-weight:600;font-size:17px;color:#011E4A}
.pbsw__list{list-style:none;margin:0 0 8px;padding:0;display:flex;flex-direction:column;gap:7px}
.pbsw__list li{display:flex;gap:8px;align-items:flex-start;font-size:14px;line-height:1.4}
.pbsw__list.is-good li svg{color:#1E8A4C;flex:none;margin-top:1px}
.pbsw__list.is-warn li svg{color:#C27A12;flex:none;margin-top:1px}
.pbsw__two{display:grid;grid-template-columns:1fr;gap:4px}
.pbsw__facts2{margin:0;display:grid;grid-template-columns:repeat(2,1fr);gap:12px 14px}
.pbsw__fact dt{font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#6B7280}
.pbsw__fact dd{margin:2px 0 0;font-size:14px;font-weight:700;color:#011E4A;overflow-wrap:anywhere}
.pbsw__fact dd span{display:block;margin-top:2px;font-size:14px;font-weight:400;color:#4A5568;line-height:1.35}
.pbsw__chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.pbsw__chips span{padding:5px 11px;border-radius:999px;background:#FFF1E6;border:1px solid #F3DCC8;font-size:13px;font-weight:700;color:#B34A0E}
.pbsw__p{margin:0;font-size:14px;line-height:1.5;color:#4A5568}
.pbsw__small{margin:6px 0 0;font-size:13px;color:#4A5568}
.pbsw__bullets{margin:6px 0 0;padding-left:20px;font-size:14px;line-height:1.5}
.pbsw__actions2{flex:none;display:flex;flex-wrap:wrap;gap:8px;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid #F0EBE5}
.pbsw__actions2 .pbsw__primary{order:1;flex:2 1 150px}
.pbsw__actions2 .pbsw__secondary{order:2;flex:1 1 110px}
.pbsw__heart{order:3;min-height:44px;padding:0 14px;display:inline-flex;align-items:center;gap:6px;border:2px solid #EAE4DE;border-radius:999px;background:#fff;color:#011E4A;font-size:14px;font-weight:700}
.pbsw__heart.is-on{border-color:#F5691A;background:#FFF1E6;color:#B34A0E}
.pbsw__heart svg{color:#F5691A}
.pbsw__actions2 .pbsw__textbtn{order:4}

/* tutorial */
.pbsw__tut{position:absolute;inset:0;z-index:30;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(1,30,74,.42)}
.pbsw__tutskip{position:absolute;top:10px;right:10px;min-width:44px;min-height:44px;padding:0 14px;border:0;background:none;color:#fff;font-size:15px;font-weight:700;text-decoration:underline}
.pbsw__tut :focus-visible{outline-color:#fff}
.pbsw__tut .pbsw__coach :focus-visible{outline-color:#011E4A}
.pbsw__coach{margin:0 12px calc(12px + env(safe-area-inset-bottom));max-width:536px;align-self:center;width:calc(100% - 24px);padding:16px;border-radius:20px;background:#FBF8F4;text-align:center}
.pbsw__coachstep{margin:0;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#B34A0E}
.pbsw__coach h2{margin:4px 0 4px;font-family:'Fredoka',sans-serif;font-weight:700;font-size:22px}
.pbsw__coach p{margin:0 0 8px;font-size:14px;line-height:1.45;color:#4A5568}
.pbsw__coach .pbsw__honest{padding:8px 10px;border-radius:12px;background:#E3ECF7;color:#011E4A;font-weight:600}
.pbsw__hand{position:absolute;top:44%;left:50%;margin-left:-28px;pointer-events:none;animation:pbsw-hand-r 1.8s ease-in-out infinite;color:#fff}
.pbsw__hand.is-left{animation-name:pbsw-hand-l}
.pbsw__hand.is-static{animation:none;filter:drop-shadow(0 2px 6px rgba(1,30,74,.5))}
@keyframes pbsw-hand-r{0%,100%{transform:translateX(-46px)}50%{transform:translateX(56px)}}
@keyframes pbsw-hand-l{0%,100%{transform:translateX(46px)}50%{transform:translateX(-56px)}}
.pbsw__peek{align-self:center;width:calc(100% - 24px);max-width:536px;margin:0 12px 10px;padding:8px 14px 12px;border-radius:20px 20px 0 0;background:#fff;text-align:center;display:flex;flex-direction:column;gap:2px;animation:pbsw-up .6s ease both}
.pbsw__peekhandle{width:44px;height:5px;border-radius:5px;background:#D8D2CB;margin:0 auto 6px}
.pbsw__peek span:last-child{font-size:14px;color:#4A5568}

/* demo nudges on the real first card */
.pbsw__face.is-demo-right{animation:pbsw-nr 1.8s ease-in-out infinite}
.pbsw__face.is-demo-left{animation:pbsw-nl 1.8s ease-in-out infinite}
@keyframes pbsw-nr{0%,100%{transform:none}50%{transform:translateX(34px) rotate(5deg)}}
@keyframes pbsw-nl{0%,100%{transform:none}50%{transform:translateX(-34px) rotate(-5deg)}}
.pbsw__face.is-demo-right .pbsw__stamp--yes,.pbsw__face.is-demo-left .pbsw__stamp--no{animation:pbsw-stamp 1.8s ease-in-out infinite}
@keyframes pbsw-stamp{0%,100%{opacity:0}50%{opacity:1}}
.pbsw__face.is-demo-tap::after{content:'';position:absolute;top:50%;left:50%;width:70px;height:70px;margin:-35px 0 0 -35px;border-radius:50%;border:4px solid #F5691A;animation:pbsw-ripple 1.4s ease-out infinite;pointer-events:none}
@keyframes pbsw-ripple{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}

/* summary */
.pbsw__summary{flex:1;min-height:0;overflow-y:auto;width:100%;max-width:560px;margin:0 auto;padding:8px 16px calc(24px + env(safe-area-inset-bottom))}
.pbsw__sumtitle{margin:6px 0 4px;font-family:'Fredoka',sans-serif;font-weight:700;font-size:26px;line-height:1.2}
.pbsw__sumsub{margin:14px 0 10px;font-family:'Fredoka',sans-serif;font-weight:600;font-size:17px}
.pbsw__grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.pbsw__gitem{display:flex;flex-direction:column;gap:6px;padding:8px;border-radius:16px;background:#fff;border:1px solid #EAE4DE}
.pbsw__gopen{display:flex;flex-direction:column;gap:4px;padding:0;border:0;background:none;text-align:left;color:#011E4A}
.pbsw__gopen img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px}
.pbsw__gname{font-size:14px;font-weight:700}
.pbsw__gpct{font-size:13px;font-weight:700}
.pbsw__gbuy{min-height:44px;border:2px solid #F5691A;border-radius:999px;background:#FFF1E6;color:#B34A0E;font-size:14px;font-weight:700}
.pbsw__sumbtns{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px;align-items:center}
.pbsw__empty{margin-top:14px;padding:16px;border-radius:16px;background:#fff;border:1px solid #EAE4DE;display:flex;flex-direction:column;gap:12px;align-items:flex-start}
.pbsw__empty p{margin:0;font-size:15px;line-height:1.45}

@media (min-width:520px){.pbsw__grid{grid-template-columns:repeat(3,1fr)}.pbsw__two{grid-template-columns:1fr 1fr;gap:14px}}
@media (max-width:339px){.pbsw__facts2{grid-template-columns:1fr}}
@media (hover:hover){.pbsw__round:hover:not(:disabled){border-color:#F5691A}.pbsw__gitem:hover{border-color:#F5691A}}
@media (prefers-reduced-motion:reduce){
  .pbsw__sheet,.pbsw__peek{animation:none}
  .pbsw__round{transition:none}
  .pbsw__face.is-demo-right,.pbsw__face.is-demo-left{animation:none}
  .pbsw__face.is-demo-right .pbsw__stamp--yes,.pbsw__face.is-demo-left .pbsw__stamp--no{animation:none;opacity:1 !important}
  .pbsw__face.is-demo-tap::after{animation:none;transform:none;opacity:.8}
}
`;
