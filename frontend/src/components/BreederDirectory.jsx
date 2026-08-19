import React, { useMemo, useState } from 'react';
import {
  resolveBreederCity, getBreedersByCity, getAreas, areasOf, rankBreeders,
  buildBreederWhatsAppLink, telHref, NETWORK_CITIES, readCityPreference, writeCityPreference,
} from '../utils/breeders';

import { WhatsAppIcon } from './WhatsAppButton';
import QuickFeedback from './QuickFeedback';

/* Shown after "Buy Now": the verified breeder network for the user's city.
   Two filters as specced — a free-text breeder-name search, and a zone picker
   populated from the database. Motion lives on the card surfaces (entrance,
   sheen, lift) and never on the text itself. */

const RATING_COLOR = (r) => (r >= 4.7 ? '#1E9E52' : r >= 4.3 ? '#2F8F4E' : '#B4761B');

const BreederDirectory = ({ userCity, breedName, topBreeds = [], onBack, onContact }) => {
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('all');
  /* Breeders whose WhatsApp button has been tapped this session. Asking before
     they've made contact would be asking about nothing; asking every card at
     once would be noise. Session-only — the once-ever rule lives in
     QuickFeedback's own storage. */
  const [contacted, setContacted] = useState(() => new Set());
  //: The owner's explicit choice, if they've made one. Null means "follow the
  //  city the quiz worked out". Read once — it's a device preference, not state
  //  that changes underneath us.
  const [picked, setPicked] = useState(readCityPreference);

  const auto = useMemo(() => resolveBreederCity(userCity), [userCity]);
  const city = picked || auto.city;
  const overridden = Boolean(picked) && picked !== auto.city;
  //: Only the automatic choice can be a fallback. If they picked the city
  //  themselves, telling them it isn't theirs would be nonsense.
  const isFallback = auto.isFallback && !picked;
  const resolvedUserCity = auto.userCity;

  const chooseCity = (next) => {
    setPicked(next);
    writeCityPreference(next);
    setArea('all');          // an area from the old city matches nothing here
  };

  const areas = useMemo(() => getAreas(city), [city]);

  const results = useMemo(() => {
    let list = getBreedersByCity(city);
    if (area !== 'all') list = list.filter((b) => areasOf(b).includes(area));
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((b) =>
        b.name.toLowerCase().includes(q) ||
        b.locality.toLowerCase().includes(q) ||
        (b.owner || '').toLowerCase().includes(q) ||
        [...b.breeds, ...b.otherBreeds].some((x) => x.toLowerCase().includes(q)));
    }
    return rankBreeders(list, { breedName, topBreeds });
  }, [city, area, query, breedName, topBreeds]);

  const matchCount = results.filter((b) => b.hasPicked).length;

  return (
    <div className="bd-wrap">
      <div className="bd-head">
        {onBack && (
          <button className="bd-back" onClick={onBack}>← Back</button>
        )}
        <h3 className="bd-title">Breeders in {city}</h3>
        <p className="bd-sub">
          {breedName
            ? <>Breeders near you{matchCount > 0 && <> — <strong>{matchCount}</strong> currently list the <strong>{breedName}</strong></>}.</>
            : <>Our breeder network in {city}.</>}
        </p>

        <div className="bd-citybar">
          <label className="bd-citybar__label" htmlFor="bd-city">Showing</label>
          <select
            id="bd-city"
            className="bd-city"
            value={city}
            onChange={(e) => chooseCity(e.target.value)}
          >
            {NETWORK_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {overridden && (
            <button type="button" className="bd-city__reset" onClick={() => chooseCity(null)}>
              Reset to {auto.city}
            </button>
          )}
        </div>

        {isFallback && (
          <div className="bd-notice">
            <span aria-hidden="true">📍</span>
            <span>
              We don’t have breeders in {resolvedUserCity || 'your city'} yet — showing our
              <strong> {city}</strong> network. They ship and travel; always ask before paying.
            </span>
          </div>
        )}

        <div className="bd-filters">
          <div className="bd-search">
            <span className="bd-search__icon" aria-hidden="true">⌕</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search breeder, area or breed…"
              aria-label="Search breeders"
            />
            {query && (
              <button className="bd-search__clear" onClick={() => setQuery('')} aria-label="Clear search">×</button>
            )}
          </div>

          <select
            className="bd-zone"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            aria-label="Filter by area"
          >
            <option value="all">All areas in {city}</option>
            {areas.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="bd-empty">
          <div style={{ fontSize: '34px', marginBottom: '8px' }}>🔍</div>
          <p>No breeder matches “{query || area}”.</p>
          <button className="bd-reset" onClick={() => { setQuery(''); setArea('all'); }}>
            Show all {city} breeders
          </button>
        </div>
      ) : (
        <div className="bd-grid">
          {results.map((b, i) => {
            const wa = buildBreederWhatsAppLink(b, breedName);
            return (
              <article
                key={b.id}
                className="bd-card"
                style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}
              >
                <div className="bd-card__sheen" aria-hidden="true" />

                <div className="bd-card__top">
                  <h4 className="bd-card__name">{b.name}</h4>
                  {b.rating != null && (
                    <span className="bd-rating" style={{ background: RATING_COLOR(b.rating) }}>
                      ★ {b.rating.toFixed(1)}
                    </span>
                  )}
                </div>

                {b.matchLabel && <span className="bd-match">{b.matchLabel}</span>}

                <dl className="bd-meta">
                  <div>
                    <dt>Phone</dt>
                    <dd>
                      {telHref(b.phone)
                        ? <a href={telHref(b.phone)}>{b.phone}</a>
                        : <span className="bd-dim">Not listed — reach them via Maps</span>}
                    </dd>
                  </div>
                  <div>
                    <dt>Google reviews</dt>
                    <dd>{b.rating != null ? `${b.rating.toFixed(1)} / 5` : '—'} <span className="bd-dim">({b.reviews.toLocaleString('en-IN')} reviews)</span></dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>{b.locality}</dd>
                  </div>
                </dl>

                <div className="bd-actions">
                  {b.mapsUrl && (
                    <a
                      className="bd-btn bd-btn--map"
                      href={b.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span aria-hidden="true">📍</span> Map Link
                    </a>
                  )}
                  {wa && (
                    <a
                      className="bd-btn bd-btn--wa"
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        onContact?.(b);
                        setContacted((prev) => new Set(prev).add(b.id));
                      }}
                    >
                      <WhatsAppIcon size={17} /> WhatsApp Us
                    </a>
                  )}
                </div>

                {/* Anchors itself to the screen rather than to this card —
                    they have already left for WhatsApp, so it should be
                    waiting when they come back, not buried in a card that may
                    have scrolled away. Still a toast, never a modal. */}
                {contacted.has(b.id) && (
                  <QuickFeedback
                    context="breeder_contact"
                    contextId={b.id}
                    question="Was this breeder helpful?"
                  />
                )}
              </article>
            );
          })}
        </div>
      )}

      <p className="bd-foot">
        Showing {results.length} {results.length === 1 ? 'breeder' : 'breeders'} in {city}.
        Always visit in person and ask to meet the puppy’s mother before you pay.
      </p>

      <style>{`
        .bd-wrap { font-family: var(--font-body-family); }

        .bd-head { margin-bottom: 22px; }
        .bd-back {
          background: none; border: none; color: var(--orange); font-weight: 700;
          font-size: 13px; cursor: pointer; padding: 0; margin-bottom: 10px;
        }
        .bd-title {
          font-family: var(--font-display); font-weight: var(--weight-semibold); color: var(--brown);
          font-size: 26px; margin: 0 0 4px;
        }
        .bd-sub { color: var(--text-soft); font-size: 14px; margin: 0 0 14px; }

        /* The city control sits with the heading, not down among the filters:
           it changes which network you are looking at, which is a different
           kind of decision from narrowing the one you're already in. */
        .bd-citybar {
          display: flex; align-items: center; gap: 9px; flex-wrap: wrap;
          margin: 0 0 14px;
        }
        .bd-citybar__label {
          font-size: 11px; font-weight: 800; letter-spacing: .05em;
          text-transform: uppercase; color: var(--text-soft);
        }
        .bd-city {
          padding: 9px 12px; border-radius: 11px;
          border: 2px solid #EAE4DE; background: #fff; color: var(--brown);
          font-size: 14px; font-family: inherit; font-weight: 700;
          cursor: pointer; outline: none;
          transition: border-color .25s ease, box-shadow .25s ease;
        }
        .bd-city:hover { border-color: var(--orange); }
        .bd-city:focus { border-color: var(--orange); box-shadow: 0 0 0 4px rgba(227,93,24,.12); }
        .bd-city__reset {
          border: none; background: none; cursor: pointer; padding: 0;
          color: var(--orange); font-family: inherit; font-size: 12.5px;
          font-weight: 700; text-decoration: underline;
        }

        .bd-notice {
          display: flex; gap: 10px; align-items: flex-start;
          background: #FFF6E9; border: 1px solid #F5D9AE; border-radius: 12px;
          padding: 12px 14px; font-size: 13px; color: #7A5320; line-height: 1.5;
          margin-bottom: 16px;
        }

        .bd-filters { display: flex; gap: 12px; flex-wrap: wrap; }
        .bd-search { position: relative; flex: 1 1 240px; }
        .bd-search__icon {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          color: var(--text-soft); font-size: 15px; pointer-events: none;
        }
        .bd-search input {
          width: 100%; box-sizing: border-box;
          padding: 13px 36px 13px 36px; border-radius: 12px;
          border: 2px solid #EAE4DE; background: #fff; color: var(--brown);
          font-size: 15px; font-family: inherit; font-weight: 500; outline: none;
          transition: border-color .25s ease, box-shadow .25s ease;
        }
        .bd-search input:focus {
          border-color: var(--orange);
          box-shadow: 0 0 0 4px rgba(227,93,24,.12);
        }
        .bd-search__clear {
          position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
          border: none; background: none; color: var(--text-soft);
          font-size: 20px; cursor: pointer; line-height: 1; padding: 0 4px;
        }
        .bd-zone {
          flex: 0 1 220px; padding: 13px 14px; border-radius: 12px;
          border: 2px solid #EAE4DE; background: #fff; color: var(--brown);
          font-size: 14px; font-family: inherit; font-weight: 600;
          cursor: pointer; outline: none;
          transition: border-color .25s ease, box-shadow .25s ease;
        }
        .bd-zone:focus { border-color: var(--orange); box-shadow: 0 0 0 4px rgba(227,93,24,.12); }

        .bd-grid {
          display: grid; gap: 16px;
          grid-template-columns: repeat(auto-fill, minmax(268px, 1fr));
        }

        /* Card surface: staggered rise on mount, a slow sheen drifting across the
           background, and a lift on hover. No motion on the text itself. */
        /* Entrance animates TRANSFORM only and never opacity. If the animation
           clock is throttled or the stylesheet is slow, a card is still fully
           visible (just un-slid) instead of being stuck invisible at opacity 0. */
        @keyframes bd-rise {
          from { transform: translateY(16px) scale(.985); }
          to   { transform: translateY(0) scale(1); }
        }
        @keyframes bd-sheen {
          0%   { transform: translateX(-120%) rotate(8deg); }
          60%  { transform: translateX(220%) rotate(8deg); }
          100% { transform: translateX(220%) rotate(8deg); }
        }
        .bd-card {
          position: relative; overflow: hidden;
          background: linear-gradient(150deg, #FFFFFF 0%, #FFF9F3 100%);
          border: 1px solid #EFE6DC; border-radius: 18px; padding: 18px 18px 16px;
          box-shadow: 0 6px 18px -10px rgba(61,41,28,.28);
          animation: bd-rise .55s cubic-bezier(.16,1,.3,1) both;
          transition: transform .3s cubic-bezier(.16,1,.3,1), box-shadow .3s ease, border-color .3s ease;
        }
        .bd-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 22px 40px -18px rgba(61,41,28,.42);
          border-color: rgba(227,93,24,.42);
        }
        .bd-card__sheen {
          position: absolute; top: -40%; left: 0; width: 45%; height: 180%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.72), transparent);
          transform: translateX(-120%) rotate(8deg);
          pointer-events: none;
        }
        .bd-card:hover .bd-card__sheen { animation: bd-sheen 1.1s ease-out; }

        .bd-card__top {
          display: flex; justify-content: space-between; align-items: flex-start;
          gap: 10px; margin-bottom: 8px;
        }
        .bd-card__name {
          margin: 0; font-family: var(--font-display); font-weight: var(--weight-semibold); color: var(--brown);
          font-size: 17px; line-height: 1.3;
        }
        .bd-rating {
          flex-shrink: 0; color: #fff; font-size: 12px; font-weight: 700;
          padding: 4px 9px; border-radius: 20px; white-space: nowrap;
        }
        .bd-match {
          display: inline-block; background: var(--orange-pale, #FDF1E8);
          color: var(--orange-strong, #C44E12); border: 1px solid rgba(227,93,24,.28);
          font-size: 11px; font-weight: 700; padding: 3px 9px;
          border-radius: 20px; margin-bottom: 12px;
        }

        .bd-meta { margin: 0 0 15px; display: grid; gap: 8px; }
        .bd-meta > div { display: grid; grid-template-columns: 84px 1fr; gap: 8px; align-items: baseline; }
        .bd-meta dt {
          font-size: 11px; text-transform: uppercase; letter-spacing: .04em;
          color: var(--text-soft); font-weight: 700;
        }
        .bd-meta dd { margin: 0; font-size: 13.5px; color: var(--brown); font-weight: 500; line-height: 1.45; }
        .bd-meta dd a { color: var(--brown); text-decoration: none; font-weight: 600; }
        .bd-meta dd a:hover { color: var(--orange); text-decoration: underline; }
        .bd-dim { color: var(--text-soft); font-weight: 400; font-size: 12px; }

        .bd-actions { display: flex; gap: 9px; }
        .bd-btn {
          flex: 1; display: inline-flex; align-items: center; justify-content: center;
          gap: 6px; padding: 11px 10px; border-radius: 11px;
          font-size: 13.5px; font-weight: 700; text-decoration: none;
          transition: transform .2s ease, box-shadow .25s ease, background .25s ease;
        }
        .bd-btn:active { transform: scale(.97); }
        .bd-btn--map {
          background: #fff; color: var(--brown); border: 1.5px solid #E3D9CE;
        }
        .bd-btn--map:hover { background: var(--cream, #FBF5EF); border-color: var(--orange); color: var(--orange-strong, #C44E12); }
        .bd-btn--wa {
          background: #25D366; color: #fff;
          box-shadow: 0 6px 16px -6px rgba(37,211,102,.7);
        }
        .bd-btn--wa:hover { background: #1EBE5B; box-shadow: 0 10px 22px -8px rgba(37,211,102,.85); }

        .bd-empty {
          text-align: center; padding: 42px 20px; color: var(--text-soft);
          background: #FCFAF7; border: 1px dashed #E3D9CE; border-radius: 16px;
        }
        .bd-empty p { margin: 0 0 14px; font-size: 14px; }
        .bd-reset {
          background: var(--orange); color: #fff; border: none; border-radius: 50px;
          padding: 10px 22px; font-weight: 700; cursor: pointer; font-family: inherit;
        }

        .bd-foot {
          margin: 18px 0 0; font-size: 12px; color: var(--text-soft);
          text-align: center; line-height: 1.6;
        }

        @media (max-width: 600px) {
          .bd-grid { grid-template-columns: 1fr; }
          .bd-zone { flex: 1 1 100%; }
          .bd-title { font-size: 22px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .bd-card { animation: none; transform: none; transition: none; }
          .bd-card:hover { transform: none; }
          .bd-card:hover .bd-card__sheen { animation: none; }
        }
      `}</style>
    </div>
  );
};

export default BreederDirectory;
