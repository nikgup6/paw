import React from 'react';
import { Link } from 'react-router-dom';
import DogArt from '../quiz/DogArt';

/* Homepage teaser for the /play game: a small looping dog-run preview and a "Play, 30 sec" button.
   Between TrustSection and FeaturedPuppies.

   NO LAYOUT SHIFT: the section has a fixed height at each breakpoint (--pbpt-h below) and every piece inside
   has a fixed size, so nothing moves when fonts or the dog load. The preview is pure CSS (the road dashes slide),
   which is switched off under prefers-reduced-motion; the dog then stands still (DogArt handles that itself).
   It links to /play and imports no game code, so the main bundle is not affected. */

export default function PlayTeaser() {
  return (
    <section className="pbpt" aria-label="Walk the dog, a 30 second game">
      <style>{CSS}</style>
      <div className="pbpt__card">
        <div className="pbpt__scene" aria-hidden="true">
          <div className="pbpt__sun" />
          <div className="pbpt__dog"><DogArt mood="run" running width={64} /></div>
          <div className="pbpt__road"><div className="pbpt__dashes" /></div>
        </div>
        <div className="pbpt__text">
          <h2 className="pbpt__title">Walk the dog</h2>
          <p className="pbpt__sub">Hop over cows, puddles and auto-rickshaws. Unlock barks as you go.</p>
          <Link to="/play" className="pbpt__btn">Play, 30 sec</Link>
        </div>
      </div>
    </section>
  );
}

const CSS = `
.pbpt{--pbpt-h:244px;box-sizing:border-box;width:100%;max-width:960px;margin:0 auto;padding:12px 16px;height:calc(var(--pbpt-h) + 24px);font-family:'Satoshi',system-ui,sans-serif}
@media (min-width:700px){.pbpt{--pbpt-h:168px}}
.pbpt__card{box-sizing:border-box;height:var(--pbpt-h);display:flex;flex-direction:column;overflow:hidden;border:2px solid #011E4A;border-radius:22px;background:#FFF1E3;color:#011E4A}
@media (min-width:700px){.pbpt__card{flex-direction:row}}
.pbpt__scene{position:relative;flex:none;height:96px;overflow:hidden;background:linear-gradient(180deg,#FFF6EC,#FFD9BD)}
@media (min-width:700px){.pbpt__scene{width:300px;height:auto}}
.pbpt__sun{position:absolute;right:26px;top:12px;width:42px;height:42px;border-radius:50%;background:rgba(245,105,26,.3)}
.pbpt__dog{position:absolute;left:34px;bottom:30px;width:64px;height:47px;line-height:0}
.pbpt__road{position:absolute;left:0;right:0;bottom:0;height:30px;background:#5B5B66;border-top:4px solid #C9BFB4;overflow:hidden}
.pbpt__dashes{position:absolute;left:0;top:12px;width:200%;height:4px;background:repeating-linear-gradient(90deg,#F1E7D8 0 30px,transparent 30px 60px);animation:pbpt-road 1.1s linear infinite}
@keyframes pbpt-road{to{transform:translateX(-60px)}}
.pbpt__text{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:6px;padding:12px 16px}
@media (min-width:700px){.pbpt__text{padding:16px 24px;gap:8px}}
.pbpt__title{margin:0;font-family:'Fredoka',sans-serif;font-weight:700;font-size:22px;line-height:1.1}
.pbpt__sub{margin:0;font-size:14px;line-height:1.4;color:#4A5568}
.pbpt__btn{box-sizing:border-box;align-self:flex-start;min-height:44px;padding:0 22px;display:inline-flex;align-items:center;border-radius:999px;background:#F5691A;border:2px solid #F5691A;color:#011E4A;font:700 15px 'Satoshi',sans-serif;text-decoration:none}
.pbpt__btn:focus-visible{outline:3px solid #011E4A;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.pbpt__dashes{animation:none}}
`;
