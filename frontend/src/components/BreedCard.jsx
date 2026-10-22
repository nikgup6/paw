import { Link } from 'react-router-dom';
import BarkButton from './results/BarkButton';
import { hasHeatData } from '../utils/heat';
import DogArt from './quiz/DogArt';

/* `barkSource` (optional): when set ('carousel' / 'result') the card shows a "Hear it" bark button. */
/* `onCelebrate` (optional): when given, a small sitting dog appears next to the breed name and tapping it
   barks and sets the "zoomies" running, exactly like the one on the #1 match. Only the results top-5 pass
   it — the Explore and Featured grids leave it out and look the same as before. */
/* `showHeatLink` (optional): adds the "Check this breed in your city" link, the same one the #1
   match card carries. Only the results top-5 pass it, and it hides itself for a breed that has no
   heat data, so it can never link to a page that would have to guess. */
/* `onDayInLife` (optional): when given, a "See a day with ..." button opens the puppy-day story
   (components/results/DayInLife.jsx). Leave the prop out and the button does not render at all, which is
   why Explore and the Featured grid are untouched. */
const BreedCard = ({ breed, rank, reason, onBuy, onCompare, onFullProfile, hideActionButtons, hideBuyButton, hideFullProfileButton, hideCompareButton, onImageClick, barkSource, onCelebrate, onDayInLife, showHeatLink }) => {
  return (
    <div className="breed-card" onClick={() => onFullProfile && onFullProfile(breed)} style={{ cursor: 'pointer' }}>
      <style>{`
        .breed-name-row{display:flex;align-items:center;gap:8px;min-width:0}
        .breed-name-row .breed-name{margin:0;min-width:0}
        .rbx-dogbtn--light{flex:none;min-width:44px;min-height:44px;align-items:center;justify-content:center}
        .rbx-dogbtn--light:focus-visible{outline:3px solid #011E4A;outline-offset:2px}
        /* "See a day with ..." — a quiet, full-width row so it never competes with Buy. */
        .bc-daybtn{box-sizing:border-box;width:100%;min-height:44px;margin:10px 0 2px;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1.5px solid #011E4A;border-radius:50px;background:#FFFFFF;color:#011E4A;font:700 13.5px var(--font-display,'Satoshi',sans-serif);cursor:pointer;text-align:center;line-height:1.25}
        .bc-daybtn:hover{background:#F3F7FC}
        .bc-daybtn:focus-visible{outline:3px solid #F5691A;outline-offset:2px}
        .bc-daybtn svg{flex:none}
        .bc-heatline{margin:10px 0 0}
        .bc-heatline a{display:inline-flex;align-items:center;min-height:44px;color:var(--orange,#F5691A);font:700 13.5px var(--font-display,'Satoshi',sans-serif);text-decoration:underline;text-underline-offset:3px}
        .bc-heatline a:focus-visible{outline:3px solid #011E4A;outline-offset:2px;border-radius:6px}
      `}</style>
      <div className="breed-card-img">
        {(rank || breed.matchPercentage) && <div className="breed-rank">{rank ? `#${rank} ` : ''}{breed.matchPercentage ? `\u2022 ${breed.matchPercentage}% Match` : ''}</div>}
        <img 
          src={`/${breed.img}`} 
          alt={breed.name} 
          onClick={(e) => { e.stopPropagation(); onImageClick && onImageClick(breed); }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
          onError={(e) => { e.target.src = 'https://via.placeholder.com/140?text=Dog'; }}
        />
      </div>
      <div className="breed-card-body">
        <div className="breed-name-row">
          <h4 className="breed-name">{breed.name}</h4>
          {onCelebrate && (
            <button
              type="button"
              className="rbx-dogbtn rbx-dogbtn--light"
              data-html2canvas-ignore="true"
              aria-label={`Celebrate the ${breed.name}`}
              onClick={(e) => { e.stopPropagation(); onCelebrate(breed); }}
            >
              <DogArt mood="sit" width={44} />
            </button>
          )}
        </div>
        <p className="breed-reason">{breed.purpose}</p>
        {barkSource && (
          <div style={{ margin: '8px 0 4px' }} onClick={(e) => e.stopPropagation()}>
            <BarkButton breed={breed} source={barkSource} />
          </div>
        )}
        {showHeatLink && hasHeatData(breed.name) && (
          <p className="bc-heatline" onClick={(e) => e.stopPropagation()}>
            <Link to={'/heat-check?breed=' + encodeURIComponent(breed.name)}>Check this breed in your city &rarr;</Link>
          </p>
        )}
        {onDayInLife && (
          <button
            type="button"
            className="bc-daybtn"
            onClick={(e) => { e.stopPropagation(); onDayInLife(breed); }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
              <circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 7.4V12l3.2 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            See a day with {breed.name}
          </button>
        )}
        
        {reason && (
          <p className="breed-reason-box" style={{ fontSize: '13px', color: 'var(--text-soft)', marginTop: '12px', marginBottom: '12px', lineHeight: 1.5, background: 'rgba(255,107,43,0.05)', padding: '10px', borderRadius: '8px', borderLeft: '3px solid var(--orange)' }}>
            {reason}
          </p>
        )}

        {/* Every real warning the engine computed, not just the worst one — a
            breed with two concerns (e.g. flooring risk AND a training-effort
            gap) used to show only the first and let the Full Profile carry
            the rest, so a genuine second concern read as a clean card here. */}
        {breed.warnings?.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '0 0 12px' }}>
            {breed.warnings.map((w, i) => (
              <p key={i} style={{ fontSize: '12.5px', color: '#9a6b1f', background: '#fdf3e0', border: '1px solid #f3ddb2', borderRadius: '8px', padding: '8px 10px', margin: 0, lineHeight: 1.5 }}>
                ⚠ {w}
              </p>
            ))}
          </div>
        )}
        <div className="breed-pills">
          {breed.tags?.slice(0, 3).map(tag => (
            <span key={tag} className="pill pill-orange">{tag}</span>
          ))}
        </div>
        {!hideActionButtons && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            {!hideBuyButton && (
              /* High-emphasis CTA — literally the role table's "Buy" example. */
              <button className="breed-btn breed-btn--buy" onClick={(e) => { e.stopPropagation(); onBuy && onBuy(breed); }} style={{ flex: 1, padding: '8px', background: 'var(--orange)', color: 'white', border: 'none', borderRadius: '50px', fontWeight: 'var(--weight-bold)', cursor: 'pointer', fontFamily: 'var(--font-display)' }}>Buy</button>
            )}
            {!hideCompareButton && (
              <button className="breed-btn breed-btn--compare" onClick={(e) => { e.stopPropagation(); onCompare && onCompare(breed); }} style={{ flex: 1, padding: '8px', background: 'transparent', color: 'var(--orange)', border: '1px solid var(--orange)', borderRadius: '50px', fontWeight: 'var(--weight-semibold)', cursor: 'pointer', fontFamily: 'var(--font-display)' }}>Compare</button>
            )}
            {!hideFullProfileButton && (
              <button className="breed-btn breed-btn--profile" onClick={(e) => { e.stopPropagation(); onFullProfile && onFullProfile(breed); }} style={{ flex: 1, padding: '8px', background: 'transparent', color: 'var(--brown)', border: '1px solid var(--brown)', borderRadius: '50px', fontWeight: 'var(--weight-semibold)', cursor: 'pointer', fontFamily: 'var(--font-display)' }}>Full Profile</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BreedCard;
