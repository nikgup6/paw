import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import BarkButton from './BarkButton';
import DogArt from '../quiz/DogArt';
import { hasHeatData } from '../../utils/heat';

/* One of the four runner-up cards on the Top 5 ("More good fits").

   This is a SEPARATE component from components/BreedCard.jsx on purpose. That one is also used
   by Explore, the Featured grid and the standalone /results page, and the Top 5 redesign changes
   the layout (photo on the left, rank circle, amber warning strip, different buttons). Restyling
   BreedCard would have silently restyled three other surfaces. The class names other code and the
   test harness look for - .breed-card, .breed-name - are kept.

   It does nothing on its own: every handler is passed in and behaves exactly as it did before.

   HOW TO EDIT
   - colours, borders and radii ... the CSS at the bottom of RecommendationResults.jsx
   - the photo and its placeholder ... PHOTO below
   - the count-up and fade-in timings ... COUNT_MS here, and the keyframes in that same CSS */

const COUNT_MS = 700;        // the percentage counting up the first time the card is seen

/* Status pill colours. Read from the START of the engine's own label - never a new threshold,
   and never a cheerier colour than the engine's word. */
const LABEL_STYLE = (label = '') => {
  if (label.startsWith('Excellent')) return { background: '#1E8E5A', color: '#FFFFFF' };
  if (label.startsWith('Good')) return { background: '#FFE3CF', color: '#8A3300' };
  return { background: '#ECEFF3', color: '#3C4F6B' };
};

const PawMark = ({ size = 32, stroke = '#B08A6B' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <circle cx="6" cy="10" r="2" /><circle cx="10" cy="6" r="2" /><circle cx="15" cy="6" r="2" /><circle cx="19" cy="10" r="2" />
    <path d="M8 18c0-3 2-5 4-5s4 2 4 5c0 2-2 2-4 2s-4 0-4-2z" />
  </svg>
);

const WarnMark = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5C3D00" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="pbmc__warnicon">
    <path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" />
  </svg>
);

export default function MatchCard({
  breed, rank, onBuy, onFullProfile, onImageClick, onCelebrate, onDayInLife, showHeatLink, barkSource,
}) {
  const ref = useRef(null);
  const pctRef = useRef(null);
  const [seen, setSeen] = useState(false);        // has this card entered the view yet
  const [photoOk, setPhotoOk] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const raf = useRef(0);

  /* Entrance and count-up fire the FIRST time the card is scrolled into view, once only.
     The observer disconnects immediately, so scrolling away and back never replays it. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let reduced = false;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* assume motion is fine */ }
    if (reduced || typeof IntersectionObserver === 'undefined') { setSeen(true); return undefined; }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      setSeen(true);
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The percentage counts up from 0 once the card has been seen.
  useEffect(() => {
    const target = Number(breed.matchPercentage) || 0;
    if (!seen) return undefined;
    let reduced = false;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* */ }
    if (reduced) { if (pctRef.current) pctRef.current.textContent = `${target}%`; return undefined; }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      const eased = 1 - (1 - t) ** 3;
      if (pctRef.current) pctRef.current.textContent = `${t === 1 ? target : Math.round(target * eased)}%`;
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [seen, breed.matchPercentage]);

  const pill = LABEL_STYLE(breed.label);
  const subtitle = breed.purpose || '';

  return (
    <article
      ref={ref}
      className={`breed-card pbmc${seen ? ' is-in' : ''}`}
      style={{ '--pbmc-delay': `${((rank || 2) - 2) * 90}ms` }}
      onClick={() => onFullProfile && onFullProfile(breed)}
    >
      <div className="pbmc__media">
        {photoOk && breed.img ? (
          <img
            className={`pbmc__img${loaded ? ' is-loaded' : ''}`}
            src={`/${breed.img}`}
            alt={breed.name}
            width="340"
            height="380"
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setPhotoOk(false)}
            onClick={(e) => { e.stopPropagation(); onImageClick && onImageClick(breed); }}
          />
        ) : (
          /* Never a broken image: a peach plate with a paw and the word Photo. */
          <span className="pbmc__noimg"><PawMark /><span>Photo</span></span>
        )}
        {rank && <span className="pbmc__rank">{rank}</span>}
        {breed.label && <span className="pbmc__pill pbmc__pill--onphoto" style={pill}>{breed.label}</span>}
      </div>

      <div className="pbmc__body">
        <div className="pbmc__top">
          <div className="pbmc__id">
            <h3 className="breed-name pbmc__name">
              {breed.name}
              {onCelebrate && (
                <button
                  type="button"
                  className="rbx-dogbtn rbx-dogbtn--light"
                  data-html2canvas-ignore="true"
                  aria-label={`Celebrate the ${breed.name}`}
                  onClick={(e) => { e.stopPropagation(); onCelebrate(breed); }}
                >
                  <DogArt mood="sit" width={40} />
                </button>
              )}
            </h3>
            {subtitle && <p className="pbmc__sub">{subtitle}</p>}
          </div>
          <div className="pbmc__score">
            <span className="pbmc__pct" ref={pctRef}>0%</span>
            {breed.label && <span className="pbmc__pill pbmc__pill--aside" style={pill}>{breed.label}</span>}
          </div>
        </div>

        {/* Every warning the engine produced, in full. Never shortened. */}
        {breed.warnings?.length > 0 && (
          <div className="pbmc__warns">
            {breed.warnings.map((w, i) => (
              <p className="pbmc__warn" key={i}><WarnMark /><span>{w}</span></p>
            ))}
          </div>
        )}

        {barkSource && (
          <div className="pbmc__bark" onClick={(e) => e.stopPropagation()}>
            <BarkButton breed={breed} source={barkSource} />
          </div>
        )}

        {showHeatLink && hasHeatData(breed.name) && (
          <p className="pbmc__heat" onClick={(e) => e.stopPropagation()}>
            <Link to={'/heat-check?breed=' + encodeURIComponent(breed.name)}>Check this breed in your city &rarr;</Link>
          </p>
        )}

        <div className="pbmc__spacer" />

        <div className="pbmc__actions">
          <button type="button" className="pbmc__btn pbmc__btn--profile" onClick={(e) => { e.stopPropagation(); onFullProfile && onFullProfile(breed); }}>Full profile</button>
          <button type="button" className="pbmc__btn pbmc__btn--buy" onClick={(e) => { e.stopPropagation(); onBuy && onBuy(breed); }}>Buy</button>
          {onDayInLife && (
            <button type="button" className="pbmc__daylink" onClick={(e) => { e.stopPropagation(); onDayInLife(breed); }}>
              A day with {breed.name} &rarr;
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
