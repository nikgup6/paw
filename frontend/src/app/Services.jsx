import { useEffect, useMemo, useState } from 'react';
import { MapPinIcon, PhoneIcon } from './components/TabIcons';
import { useDogs } from '../context/DogsContext';
import { GROOMER_CITIES, groomersForCity, readGroomerCityPreference, writeGroomerCityPreference } from '../utils/groomers';
import { areasForCity, areasOf, ratingLabel, resolveDirectoryCity, reviewLabel, shortServices, telHref } from '../utils/directory';
import { VET_CITIES, readVetCityPreference, vetsForCity, writeVetCityPreference } from '../utils/vets';

/* Services — the local business directory: vet care and groomers, one
   toggle apart, sharing a single generic list/filter/profile component.

   Every field rendered here comes from vets.json / groomers.json, which by
   construction only contain user-facing columns. There is deliberately no
   Tier badge, no confidence score and no internal notes anywhere in this
   file: that data is not in the bundle to render. Nothing is labelled
   "verified" — these are Google-listed practices we have collated, not
   practices we have inspected.

   Two actions per entry, both on the card and in the profile: Call dials
   the listed number, Map opens the Google listing. */

/* Section config — the only thing that differs between "Vet care" and
   "Groomers" is which data file backs it and two field names (the person
   line under the name, and the second detail section in the profile).
   Everything else — filtering, cards, the profile modal, all CSS — is one
   shared Directory component. */
const SECTIONS = {
  vets: {
    key: 'vets',
    tab: 'Vet care',
    noun: 'vet',
    nounPlural: 'vets',
    subtitleNoun: 'Clinics and hospitals',
    cities: VET_CITIES,
    forCity: vetsForCity,
    readCityPref: readVetCityPreference,
    writeCityPref: writeVetCityPreference,
    personField: 'leadVets',
    extraField: 'equipment',
    extraLabel: 'Equipment & specialty services',
  },
  groomers: {
    key: 'groomers',
    tab: 'Groomers',
    noun: 'groomer',
    nounPlural: 'groomers',
    subtitleNoun: 'Groomers and pet spas',
    cities: GROOMER_CITIES,
    forCity: groomersForCity,
    readCityPref: readGroomerCityPreference,
    writeCityPref: writeGroomerCityPreference,
    personField: 'groomers',
    extraField: 'specialFeatures',
    extraLabel: 'Special features',
  },
};

const StarRow = ({ item }) => {
  const rating = ratingLabel(item);
  if (!rating) return null;
  return (
    <p className="vt-rating">
      <span aria-hidden="true">★</span>
      <strong>{rating}</strong>
      {reviewLabel(item) && <span className="vt-rating__count">{reviewLabel(item)}</span>}
    </p>
  );
};

const Actions = ({ item, size }) => {
  const tel = telHref(item.phone);
  return (
    <div className={`vt-actions ${size === 'lg' ? 'vt-actions--lg' : ''}`}>
      {tel ? (
        <a className="vt-btn vt-btn--call" href={tel}>
          <PhoneIcon /> Call
        </a>
      ) : (
        <span className="vt-btn vt-btn--off">No number listed</span>
      )}
      {item.mapsUrl ? (
        <a className="vt-btn vt-btn--map" href={item.mapsUrl} target="_blank" rel="noopener noreferrer">
          <MapPinIcon /> Map
        </a>
      ) : (
        <span className="vt-btn vt-btn--off">No map listing</span>
      )}
    </div>
  );
};

const Profile = ({ item, section, onClose }) => (
  <div className="pb-overlay" role="dialog" aria-modal="true" aria-label={item.name} onClick={onClose}>
    <div className="pb-modal" onClick={(e) => e.stopPropagation()}>
      <div className="pb-modal__bar">
        <span>{item.city}</span>
        <button type="button" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="pb-modal__body">
        <h3 className="vt-prof__name">{item.name}</h3>
        {item[section.personField] && <p className="vt-prof__vets">{item[section.personField]}</p>}
        <StarRow item={item} />

        {item.services && (
          <section className="vt-prof__sec">
            <h4>Services</h4>
            <p>{item.services}</p>
          </section>
        )}
        {item[section.extraField] && (
          <section className="vt-prof__sec">
            <h4>{section.extraLabel}</h4>
            <p>{item[section.extraField]}</p>
          </section>
        )}
        <section className="vt-prof__sec">
          <h4>Where</h4>
          <p>
            {item.locality && <strong>{item.locality}</strong>}
            {item.address && <><br />{item.address}</>}
          </p>
        </section>

        <Actions item={item} size="lg" />
      </div>
    </div>
  </div>
);

const Directory = ({ section, dogCity }) => {
  /* Where this list opens, in precedence order:
       1. a city they picked themselves before — an explicit choice outranks
          anything we infer, and it is why the picker is remembered at all;
       2. the selected dog's own city, resolved to the nearest city we cover;
       3. whatever this directory actually has.
     Before this, it was `cities[0]` — literally always Hyderabad — so an owner
     whose dog lives in Nellore was shown Hyderabad vets with nothing saying
     why, while their dog profile said Nellore two taps away. */
  const resolved = useMemo(
    () => resolveDirectoryCity(dogCity, section.cities),
    [dogCity, section],
  );
  const [city, setCity] = useState(() => section.readCityPref() || resolved.city);
  const [area, setArea] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(null);
  //: Set once they touch the picker; from then on we stop re-seeding from the
  //  dog, so switching dogs cannot yank the list out from under them mid-browse.
  const [picked, setPicked] = useState(false);

  /* Follow the dog when the selection changes — but never over an explicit
     choice, and never after they have used the picker on this screen. */
  useEffect(() => {
    if (picked || section.readCityPref()) return;
    if (resolved.city) setCity(resolved.city);
  }, [resolved.city, picked, section]);

  /* Persist ONLY a city they chose themselves. Writing the auto-seeded value
     too would make the stored preference indistinguishable from a real choice
     — and since it lands on the very first render, before the dog list has
     even loaded, it would immediately look like "they already picked
     Hyderabad" and permanently block the dog's own city from ever seeding. */
  useEffect(() => {
    if (picked) section.writeCityPref(city);
  }, [city, picked, section]);

  /* Only worth saying while they are actually looking at the substituted city;
     once they pick somewhere themselves the notice is just noise. */
  const showFallbackNotice = resolved.isFallback && city === resolved.city && resolved.userCity;

  const items = useMemo(() => section.forCity(city), [city]);

  /* Only areas that actually have an entry in the chosen city, so the
     dropdown can never offer a filter that returns nothing. */
  const areas = useMemo(() => areasForCity(items, city), [items, city]);

  const results = useMemo(() => {
    let list = items;
    if (area) list = list.filter((i) => areasOf(i).includes(area));
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((i) => [i.name, i.locality, i.services, i[section.extraField], i[section.personField]]
      .some((f) => String(f || '').toLowerCase().includes(q)));
  }, [items, area, query, section]);

  const changeCity = (next) => {
    setCity(next);
    setPicked(true);   // their choice now owns this list, not the dog's city
    setArea('');       // an area from the old city would match nothing here
    setQuery('');
  };

  if (!city) {
    return (
      <section className="pb-card">
        <div className="pb-empty" style={{ padding: '22px 8px' }}>
          No {section.nounPlural} listed yet — check back soon.
        </div>
      </section>
    );
  }

  return (
    <>
      <p className="pb-page__sub">
        {section.subtitleNoun} in {city}{area ? ` · ${area}` : ''}.
      </p>

      {/* Says plainly that this is not their city and why. Substituting the
          nearest list silently is what made the app look like it had simply
          forgotten where the dog lives. */}
      {showFallbackNotice && (
        <p className="vt-nearest" role="status">
          No {section.nounPlural} listed in {resolved.userCity} yet — showing {city},
          the nearest city we cover. You can change this above.
        </p>
      )}

      <section className="pb-card">
        <div className="vt-bar">
          <label className="vt-bar__label" htmlFor={`vt-city-${section.key}`}>City</label>
          <select id={`vt-city-${section.key}`} className="vt-city" value={city} onChange={(e) => changeCity(e.target.value)}>
            {section.cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <label className="vt-bar__label" htmlFor={`vt-area-${section.key}`}>Area</label>
          <select id={`vt-area-${section.key}`} className="vt-city" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">All areas ({areas.length})</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>

          <input
            className="vt-search"
            type="search"
            value={query}
            placeholder="Search name, area or service…"
            onChange={(e) => setQuery(e.target.value)}
          />

          {(area || query) && (
            <button type="button" className="vt-clear" onClick={() => { setArea(''); setQuery(''); }}>
              Clear
            </button>
          )}
        </div>

        {results.length === 0 ? (
          <div className="pb-empty" style={{ padding: '22px 8px' }}>
            No {section.nounPlural} match {query ? `“${query}”` : 'that filter'} in {area || city}.
          </div>
        ) : (
          <ul className="vt-list">
            {results.map((item, i) => (
              <li key={item.id}>
                <article className="vt-card" style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}>
                  <span className="vt-card__sheen" aria-hidden="true" />
                  <button
                    type="button"
                    className="vt-card__main"
                    onClick={() => setOpen(item)}
                    aria-label={`${item.name} — full details`}
                  >
                    <h3 className="vt-card__name">{item.name}</h3>
                    <StarRow item={item} />
                    {item.services && <p className="vt-card__svc">{shortServices(item.services)}</p>}
                    {item.locality && <p className="vt-card__loc">{item.locality}</p>}
                  </button>
                  <Actions item={item} />
                </article>
              </li>
            ))}
          </ul>
        )}

        <p className="vt-foot">
          Showing {results.length} {results.length === 1 ? section.noun : section.nounPlural} in {city}.
          Listings are collated from public Google listings — call ahead to confirm timings{section.key === 'vets' ? ' and emergency cover' : ''}.
        </p>
      </section>

      {open && <Profile item={open} section={section} onClose={() => setOpen(null)} />}
    </>
  );
};

const Services = () => {
  const [tab, setTab] = useState('vets');
  const section = SECTIONS[tab];
  /* The selected dog is the app's own answer to "whose city is this?" — the
     same dog the dashboard, health records and tips are all scoped to. */
  const { selectedDog } = useDogs();

  return (
    <div className="pb-page pb-fade">
      <div className="pb-page__head">
        <div>
          <h2 className="pb-page__title">Services</h2>
          <div className="pb-seg" role="tablist" aria-label="Service type">
            {Object.values(SECTIONS).map((s) => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={tab === s.key}
                className={`pb-seg__btn ${tab === s.key ? 'is-on' : ''}`}
                onClick={() => setTab(s.key)}
              >
                {s.tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Directory key={section.key} section={section} dogCity={selectedDog?.city} />

      <style>{`
        .vt-nearest {
          margin: 0 0 14px; padding: 10px 13px;
          background: #FFFBF4; border: 1px solid #E9D8B8; border-radius: 11px;
          color: #9A6B1F; font-size: 12.5px; line-height: 1.55;
        }
        .pb-seg {
          display: inline-flex; gap: 4px; margin-top: 10px; padding: 4px;
          background: #F6F1EB; border-radius: 50px;
        }
        .pb-seg__btn {
          border: none; background: none; cursor: pointer; font-family: inherit;
          padding: 8px 16px; border-radius: 50px; font-size: 13px;
          font-weight: var(--weight-bold); color: var(--text-soft);
          transition: background .2s ease, color .2s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .pb-seg__btn.is-on { background: var(--orange); color: #fff; }
        .pb-seg__btn:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
        @media (hover: hover) {
          .pb-seg__btn:not(.is-on):hover { background: #EFE6DC; }
        }

        .vt-bar { display: flex; gap: 9px; flex-wrap: wrap; align-items: center; margin-bottom: 14px; }
        .vt-bar__label { font-size: 12px; font-weight: var(--weight-bold); color: var(--text-soft); }
        .vt-city, .vt-search {
          padding: 9px 12px; border-radius: 10px; border: 1px solid var(--border-strong);
          font-family: inherit; font-size: 13px; color: var(--brown); background: #fff;
        }
        .vt-search { flex: 1 1 190px; min-width: 0; }
        .vt-city:focus, .vt-search:focus { outline: 2px solid var(--orange); outline-offset: 1px; }

        .vt-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
        @media (min-width: 860px) { .vt-list { grid-template-columns: 1fr 1fr; } }

        /* Entrance animates TRANSFORM only, never opacity — a throttled
           animation clock then leaves a card un-slid rather than invisible.
           Same rule the breeder directory follows. */
        @keyframes vt-rise {
          from { transform: translateY(16px) scale(.985); }
          to   { transform: translateY(0) scale(1); }
        }
        @keyframes vt-sheen {
          0%   { transform: translateX(-120%) rotate(8deg); }
          60%  { transform: translateX(220%) rotate(8deg); }
          100% { transform: translateX(220%) rotate(8deg); }
        }
        .vt-card {
          position: relative; overflow: hidden;
          display: flex; flex-direction: column; gap: 10px; height: 100%;
          padding: 16px; border: 1px solid var(--border); border-radius: 18px;
          background: linear-gradient(150deg, #FFFFFF 0%, #FFF9F3 100%);
          box-shadow: 0 6px 18px -10px rgba(61,41,28,.28);
          animation: vt-rise .55s cubic-bezier(.16,1,.3,1) both;
          transition: transform .3s cubic-bezier(.16,1,.3,1), box-shadow .3s ease, border-color .3s ease;
        }
        @media (hover: hover) {
          .vt-card:hover {
            transform: translateY(-6px);
            box-shadow: 0 22px 40px -18px rgba(61,41,28,.42);
            border-color: rgba(227,93,24,.42);
          }
          .vt-card:hover .vt-card__sheen { animation: vt-sheen 1.1s cubic-bezier(.16,1,.3,1); }
        }
        .vt-card__sheen {
          position: absolute; top: -40%; left: 0; width: 45%; height: 180%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent);
          transform: translateX(-120%) rotate(8deg);
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .vt-card { animation: none; transition: none; }
          .vt-card__sheen { display: none; }
        }

        .vt-clear {
          border: none; background: none; color: var(--orange);
          font-family: inherit; font-weight: var(--weight-bold); font-size: 13px; cursor: pointer;
        }
        .vt-card__main {
          display: block; width: 100%; text-align: left; border: none; background: none;
          padding: 0; font-family: inherit; cursor: pointer; flex: 1 1 auto;
          -webkit-tap-highlight-color: transparent;
        }
        .vt-card__main:focus-visible { outline: 2px solid var(--orange); outline-offset: 3px; border-radius: 8px; }
        .vt-card__name {
          margin: 0 0 4px; font-family: var(--font-display); color: var(--brown);
          font-size: 15px; font-weight: var(--weight-semibold); line-height: 1.3;
        }
        .vt-card__svc { margin: 6px 0 0; color: var(--text-soft); font-size: 12.5px; line-height: 1.5; }
        .vt-card__loc { margin: 5px 0 0; color: var(--text-soft); font-size: 12px; }

        .vt-rating { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12.5px; color: var(--brown); }
        .vt-rating span[aria-hidden] { color: var(--orange); }
        .vt-rating__count { color: var(--text-soft); font-size: 11.5px; }

        .vt-actions { display: flex; gap: 8px; }
        .vt-actions--lg { margin-top: 18px; }
        .vt-btn {
          flex: 1 1 0; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          /* 44px keeps both actions a comfortable thumb target on a phone */
          min-height: 44px; padding: 10px 14px; border-radius: 50px;
          font-family: inherit; font-size: 13px; font-weight: var(--weight-bold); text-decoration: none;
          border: 1px solid transparent; cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .vt-btn--call { background: var(--orange); color: #fff; }
        .vt-btn--map { background: #fff; color: var(--brown); border-color: var(--border-strong); }
        .vt-btn--off { background: #F6F1EB; color: var(--text-soft); font-weight: var(--weight-semibold); cursor: default; }
        @media (hover: hover) {
          .vt-btn--call:hover { filter: brightness(1.05); }
          .vt-btn--map:hover { border-color: var(--orange); color: var(--orange); }
        }

        .vt-prof__name { margin: 0; font-family: var(--font-display); color: var(--brown); font-size: 19px; }
        .vt-prof__vets { margin: 3px 0 8px; color: var(--text-soft); font-size: 13px; }
        .vt-prof__sec { margin-top: 15px; }
        .vt-prof__sec h4 {
          margin: 0 0 5px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em;
          color: var(--text-soft); font-weight: var(--weight-bold);
        }
        .vt-prof__sec p { margin: 0; color: var(--brown); font-size: 13px; line-height: 1.6; }

        .vt-foot { margin: 16px 0 0; color: var(--text-soft); font-size: 11.5px; line-height: 1.6; }
      `}</style>
    </div>
  );
};

export default Services;
