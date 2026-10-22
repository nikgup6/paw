import React from 'react';
import { NOT_RECOMMENDED_LABEL } from '../../utils/breedUtils';
import { ringColour } from '../../utils/swipeFacts';

/* The end-of-deck screen: the shortlist, plus what to do next. */

export default function SwipeSummary({ total, partial, shortlist, hasAnswers, source, onOpen, onFindBreeders, onCompareTop, onStartOver, onBack, onTakeQuiz }) {
  const title = partial ? `That's your ${total} breeds` : "You've seen all the breeds";
  const backLabel = source === 'results' ? 'Back to my matches' : 'Back to Explore';

  return (
    <div className="pbsw__summary">
      <h2 className="pbsw__sumtitle">{title}</h2>

      {shortlist.length === 0 ? (
        <div className="pbsw__empty">
          <p>Nothing shortlisted. That&rsquo;s fine, your Top 5 are still your best fits.</p>
          {hasAnswers || source === 'results'
            ? <button type="button" className="pbsw__primary" onClick={onBack}>{backLabel}</button>
            : <button type="button" className="pbsw__primary" onClick={onTakeQuiz}>Take the quiz</button>}
        </div>
      ) : (
        <>
          <h3 className="pbsw__sumsub">Your shortlist ({shortlist.length})</h3>
          <ul className="pbsw__grid">
            {shortlist.map((b) => (
              <li key={b.id} className="pbsw__gitem">
                <button type="button" className="pbsw__gopen" onClick={() => onOpen(b)} aria-label={`Open details for ${b.name}`}>
                  <img src={`/${b.img}`} alt="" width="160" height="160" loading="lazy" />
                  <span className="pbsw__gname">{b.name}</span>
                  {hasAnswers && b.matchPercentage != null && (
                    <span className="pbsw__gpct" style={{ color: ringColour(b.label) }}>
                      {b.matchPercentage}%{b.label === NOT_RECOMMENDED_LABEL ? ' · not a good fit' : ''}
                    </span>
                  )}
                </button>
                <button type="button" className="pbsw__gbuy" onClick={() => onFindBreeders(b)}>Find breeders</button>
              </li>
            ))}
          </ul>
          <div className="pbsw__sumbtns">
            <button type="button" className="pbsw__primary" onClick={onCompareTop}>Compare my top pick</button>
            <button type="button" className="pbsw__secondary" onClick={onStartOver}>Start over</button>
            <button type="button" className="pbsw__textbtn" onClick={onBack}>{backLabel}</button>
          </div>
        </>
      )}
      {shortlist.length === 0 && (
        <div className="pbsw__sumbtns">
          <button type="button" className="pbsw__secondary" onClick={onStartOver}>Start over</button>
        </div>
      )}
    </div>
  );
}
