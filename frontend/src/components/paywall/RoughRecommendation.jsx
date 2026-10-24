import { useEffect, useRef, useState } from 'react';
import { roughRecViewed } from '../../utils/paymentEvents';

/* The rough recommendation, shown after the free screens.

   Three breeds from the free answers only (utils/roughMatches.js): photo, name, a
   one-line description and a "Rough match" tag. Deliberately NOT shown: a match
   %, a label like "Excellent", warnings, city care or breeders - those are the
   paid part.

   Below them, the unlock card. "Maybe later" keeps them here with a slimmer
   card; "Back to home" leaves. Two free extras open in-page, so the answers so
   far are never lost. */

export default function RoughRecommendation({
  sniffing, breeds, freeCount, totalCount, price, onUnlock, onHome, onExplore, onSwipe,
}) {
  const [later, setLater] = useState(false);
  const headRef = useRef(null);
  const reported = useRef(false);
  const remaining = totalCount - freeCount;
  const empty = !breeds.length;

  useEffect(() => {
    if (sniffing || reported.current) return;
    reported.current = true;
    roughRecViewed(breeds.map((b) => b.name));
    headRef.current?.focus({ preventScroll: false });
  }, [sniffing]); // eslint-disable-line react-hooks/exhaustive-deps

  if (sniffing) {
    return (
      <div className="pbrr pbrr--sniff" role="status" aria-live="polite">
        <style>{CSS}</style>
        <span className="pbrr__paw" aria-hidden="true">{'🐾'}</span>
        <p className="pbrr__sniff">Sniffing around...</p>
      </div>
    );
  }

  const priceText = price != null ? `₹${price}` : '';

  return (
    <section className="pbrr" aria-labelledby="pbrr-title">
      <style>{CSS}</style>
      <h2 id="pbrr-title" ref={headRef} tabIndex={-1} className="pbrr__title">
        {empty ? 'We need a few more answers' : <>Your <span className="pbrr__hl">rough</span> match</>}
      </h2>

      {empty ? (
        <p className="pbrr__copy">
          Your first {freeCount} answers don't narrow it down enough yet. Answer the rest to see your full match.
        </p>
      ) : (
        <>
          <ul className="pbrr__grid">
            {breeds.map((b) => (
              <li key={b.name} className="pbrr__card">
                <span className="pbrr__ph">
                  {b.img && (
                    <img src={`/${b.img}`} alt="" width="240" height="180" loading="lazy" decoding="async"
                         onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  )}
                  <span className="pbrr__tag">Rough match</span>
                </span>
                <span className="pbrr__name">{b.name}</span>
                {b.line && <span className="pbrr__line">{b.line}</span>}
              </li>
            ))}
          </ul>
          <p className="pbrr__copy">A first guess from {freeCount} answers. Your full match uses all {totalCount}.</p>
        </>
      )}

      <div className={`pbrr__unlock${later ? ' is-slim' : ''}`}>
        {!later && (
          <p className="pbrr__pitch">
            <strong>Want your full match?</strong> Answer {remaining} more questions and unlock your top 5 with
            match %, warnings, city care guide and a day with your dog.
          </p>
        )}
        <div className="pbrr__actions">
          <button type="button" className="pbrr__btn pbrr__btn--go" onClick={onUnlock}>
            Unlock my full match
          </button>
          {!later && (
            <button type="button" className="pbrr__btn pbrr__btn--later" onClick={() => setLater(true)}>Maybe later</button>
          )}
        </div>
      </div>

      <p className="pbrr__extras">
        Meanwhile, try{' '}
        <button type="button" className="pbrr__link" onClick={onExplore}>browsing every breed</button>
        {' '}or{' '}
        <button type="button" className="pbrr__link" onClick={onSwipe}>Tinder for dogs</button>.
      </p>
      <p className="pbrr__home"><button type="button" className="pbrr__link" onClick={onHome}>Back to home</button></p>
    </section>
  );
}

const CSS = `
.pbrr{box-sizing:border-box;max-width:880px;margin:0 auto;padding:8px 0 24px;color:#011E4A;font-family:'Figtree',system-ui,sans-serif}
.pbrr--sniff{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:320px;gap:8px}
.pbrr__paw{font-size:44px;animation:pbrr-sniff .9s ease-in-out infinite alternate}
@keyframes pbrr-sniff{from{transform:translateX(-8px) rotate(-8deg)}to{transform:translateX(8px) rotate(8deg)}}
.pbrr__sniff{margin:0;font:800 20px 'Gabarito',system-ui,sans-serif}
.pbrr__title{margin:0 0 6px;font-family:'Gabarito',system-ui,sans-serif;font-weight:800;font-size:40px;line-height:1.05;letter-spacing:-.02em;outline:none}
.pbrr__hl{color:#F5691A}
.pbrr__grid{list-style:none;margin:18px 0 10px;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.pbrr__card{display:flex;flex-direction:column;gap:4px;background:#FFFFFF;border:1.5px solid #FFD9BD;border-radius:22px;padding:10px 10px 14px}
.pbrr__ph{position:relative;display:block;aspect-ratio:4/3;border-radius:16px;overflow:hidden;background:#FFE9D6}
.pbrr__ph img{width:100%;height:100%;object-fit:cover;display:block}
.pbrr__tag{position:absolute;left:8px;top:8px;padding:4px 10px;border-radius:999px;background:#011E4A;color:#FFF6EC;font-size:12px;font-weight:700}
.pbrr__name{margin-top:6px;font:800 19px 'Gabarito',system-ui,sans-serif}
.pbrr__line{font-size:13.5px;line-height:1.35;color:#3C4F6B}
.pbrr__copy{margin:0 0 18px;font-size:15px;color:#3C4F6B}
.pbrr__unlock{background:#FFF6EC;border:2px solid #011E4A;border-radius:24px;padding:20px}
.pbrr__unlock.is-slim{padding:12px}
.pbrr__pitch{margin:0 0 14px;font-size:16px;line-height:1.5}
.pbrr__actions{display:flex;gap:10px;flex-wrap:wrap}
.pbrr__btn{min-height:48px;padding:0 22px;border-radius:999px;cursor:pointer;font:800 16px 'Figtree',system-ui,sans-serif}
.pbrr__btn--go{border:0;background:#F5691A;color:#011E4A;flex:1 1 260px}
.pbrr__btn--later{background:transparent;border:2px solid #011E4A;color:#011E4A;flex:0 1 auto}
.pbrr__extras,.pbrr__home{margin:14px 0 0;font-size:14.5px;color:#3C4F6B}
.pbrr__home{margin-top:2px}
.pbrr__link{min-height:44px;padding:0 2px;border:0;background:none;color:#C84B0A;font:700 14.5px 'Figtree',system-ui,sans-serif;text-decoration:underline;text-underline-offset:2px;cursor:pointer}
.pbrr :focus-visible{outline:3px solid #F5691A;outline-offset:2px}
@media (max-width:640px){
  .pbrr__title{font-size:32px}
  .pbrr__grid{grid-template-columns:1fr;gap:10px}
  .pbrr__card{flex-direction:row;flex-wrap:wrap;align-items:center;gap:4px 12px}
  .pbrr__ph{width:96px;flex:none;aspect-ratio:1/1}
  .pbrr__tag{left:4px;top:4px;font-size:10.5px;padding:3px 7px}
  .pbrr__name{margin:0;flex:1 1 140px}
  .pbrr__line{flex:1 1 100%}
  .pbrr__btn{width:100%}
}
@media (prefers-reduced-motion:reduce){.pbrr__paw{animation:none}}
`;
