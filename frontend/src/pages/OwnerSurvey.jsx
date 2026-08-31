import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import CitySelect from '../components/CitySelect';
import PawRating from '../components/PawRating';
import QuickLoginModal from '../components/QuickLoginModal';
import { AuthContext } from '../context/AuthContext';
import { useBreedList } from '../context/BreedsContext';
import { zoneForCity } from '../utils/ownerTips';
import { CATEGORY_ICON, fetchCareTips, fetchTeaserTip } from '../utils/careTips';
import { sessionId } from '../utils/analytics';

/* Existing Dog Owner intake — eight questions, one per screen, then straight
   into Add-a-Dog.

   The one-question-at-a-time flow deliberately mirrors Quiz.jsx: a progress
   bar reading "Question X of N", Back hidden on the first question, Next
   disabled until the current question is answered, and the last question's
   button does the terminal action instead of advancing.

   Everything else is borrowed rather than rebuilt: the breed list comes from
   BreedsContext (the same catalogue the RightBreed quiz scores against), the
   city control is the quiz's own CitySelect with its climate metadata, and on
   submit we hand breed + city to the existing dog-profile form rather than
   creating a second, parallel record.

   Built mobile-first: full-width controls, 48px targets, no hover-dependent
   interactions anywhere. */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/* Zero-based index of the city question, which is the ONLY place the inline
   teaser appears. Named rather than written as a bare 1 at the render site, so
   that inserting a question ahead of it is a one-line change here instead of a
   card that silently drifts onto the wrong screen. */
const TEASER_STEP = 1;

const CHOICES = {
  tenure: [
    ['lt_6_months', 'Less than 6 months'],
    ['6_12_months', '6 months – 1 year'],
    ['1_3_years', '1 – 3 years'],
    ['3_plus_years', '3+ years'],
  ],
  living_situation: [
    ['apt_no_outdoor', 'Apartment, no balcony/yard'],
    ['apt_balcony_or_shared', 'Apartment, with balcony or shared yard'],
    ['house_no_yard', 'Independent house, no yard'],
    ['house_with_yard', 'Independent house, with yard'],
  ],
  hours_alone: [
    ['lt_2', 'Less than 2 hours'],
    ['2_5', '2 – 5 hours'],
    ['5_8', '5 – 8 hours'],
    ['8_plus', '8+ hours'],
  ],
  biggest_challenge: [
    ['grooming', 'Grooming & maintenance'],
    ['energy', 'Energy & exercise needs'],
    ['health', 'Health issues'],
    ['training', 'Training & behavior'],
  ],
  would_recommend: [
    ['yes', 'Yes'],
    ['no', 'No'],
    ['depends', 'Depends'],
  ],
};

const Question = ({ n, title, children }) => (
  <section className="osq">
    <h2 className="osq__title"><span className="osq__n">Q{n}</span>{title}</h2>
    {children}
  </section>
);

/* Single-select by default (radiogroup, `value` is one code). Pass `multi` to
   get a checkbox group instead — `value` becomes an array and onChange hands
   back the whole updated array, same contract either way. */
const ChoiceList = ({ name, options, value, onChange, multi = false }) => {
  const selected = multi ? (Array.isArray(value) ? value : []) : value;
  const isOn = (code) => (multi ? selected.includes(code) : selected === code);
  const toggle = (code) => {
    if (!multi) { onChange(code); return; }
    onChange(isOn(code) ? selected.filter((c) => c !== code) : [...selected, code]);
  };
  return (
    <div className="osq__choices" role={multi ? 'group' : 'radiogroup'} aria-label={name}>
      {options.map(([code, label]) => (
        <button
          key={code}
          type="button"
          role={multi ? 'checkbox' : 'radio'}
          aria-checked={isOn(code)}
          className={`osq__choice ${multi ? 'osq__choice--check' : ''} ${isOn(code) ? 'is-on' : ''}`}
          onClick={() => toggle(code)}
        >
          <span className="osq__dot" aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
};

const OwnerSurvey = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const breeds = useBreedList();
  const { user } = useContext(AuthContext);
  const [showLoginGate, setShowLoginGate] = useState(false);

  /* Testing only — lets the season-aware second pass be checked without
     waiting for the actual season (e.g. /owner-survey?test_month=July to see
     monsoon tips in December). A real submission never sets this. */
  const testMonth = new URLSearchParams(location.search).get('test_month') || null;

  const [currentQ, setCurrentQ] = useState(0);
  const [form, setForm] = useState({
    breed: '', city: '', tenure: '', living_situation: '',
    hours_alone: '', satisfaction: 0, biggest_challenge: [],
    would_recommend: '', recommend_note: '',
  });
  const [breedQuery, setBreedQuery] = useState('');
  const [breedOpen, setBreedOpen] = useState(false);
  const [customBreed, setCustomBreed] = useState(false);  // true when "Others" is picked
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);   // survey saved successfully
  const [tips, setTips] = useState([]);                // Care Tips matched for it (may be empty)
  const tipsRef = useRef([]);                          // holds tips across login gate

  /* The one inline teaser, shown under Q2 once breed and city are both known.
     Null until a real tip comes back, and null is also what a no-match and a
     failed request produce — the card is simply not rendered in any of those
     cases rather than reserving space or apologising. */
  const [teaser, setTeaser] = useState(null);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  /* Fires when both answers exist, and again if either is changed. Kept out of
     the Next handler on purpose: it must not sit between the user and the next
     question, so nothing here gates navigation or is awaited by submit. */
  useEffect(() => {
    if (!form.breed || !form.city) {
      setTeaser(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const tip = await fetchTeaserTip({ breed: form.breed, city: form.city });
      if (!cancelled) setTeaser(tip);
    })();
    return () => { cancelled = true; };
  }, [form.breed, form.city]);

  /* Typeahead over the shared catalogue. Free text is allowed in the box for
     searching, but only a real breed can be committed — the tip lookup and any
     later analysis both key off the canonical name. */
  const breedMatches = useMemo(() => {
    const q = breedQuery.trim().toLowerCase();
    if (!q) return breeds.slice(0, 8);
    return breeds.filter((b) => b.name.toLowerCase().includes(q)).slice(0, 8);
  }, [breedQuery, breeds]);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    const climateZone = zoneForCity(form.city);
    try {
      await axios.post(`${API_URL}/api/owner-survey/submit`, {
        session_id: sessionId,
        ...form,
        satisfaction: Number(form.satisfaction),
        recommend_note: form.would_recommend === 'depends' ? (form.recommend_note || null) : null,
        climate_zone: climateZone,
      });
      // The save already succeeded — a tip-matching hiccup shouldn't make the
      // survey look like it failed, so this runs after the save is safe and
      // never re-throws into the catch below.
      const matched = await fetchCareTips({
        breed: form.breed, city: form.city, climateZone, tenure: form.tenure,
        challenges: form.biggest_challenge, monthOverride: testMonth,
      });
      tipsRef.current = matched;
      setSubmitted(true);
      window.scrollTo(0, 0);

      // If the user isn't logged in, show the login gate BEFORE care tips.
      // The tips are stashed in tipsRef and will be shown after login.
      if (!user) {
        setShowLoginGate(true);
      } else {
        setTips(matched);
      }
    } catch (e) {
      setError(e?.response?.data?.detail || 'Couldn’t save that. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /* Hand the answers to the existing Add-a-Dog form rather than writing a dog
     profile here — one creation path, not two. */
  const continueToProfile = () =>
    navigate('/app/dogs/new', { state: { prefill: { breed: form.breed, city: form.city } } });

  if (submitted) {
    // If the login gate is showing, render it FIRST — the user must sign in
    // before seeing their care tips. The tips are stashed in tipsRef.
    if (showLoginGate) {
      return (
        <div className="oswrap">
          <div className="oscard ostip" style={{ textAlign: 'center' }}>
            <span className="ostip__icon" aria-hidden="true">🐾</span>
            <h1 className="ostip__title">One last step!</h1>
            <p className="ostip__body" style={{ marginBottom: '24px' }}>
              Sign in or create an account to see your personalised care tips for your {form.breed}.
            </p>
          </div>
          <Styles />
          <QuickLoginModal
            isOpen={showLoginGate}
            onSuccess={() => {
              setShowLoginGate(false);
              setTips(tipsRef.current);
            }}
          />
        </div>
      );
    }

    return (
      <div className="oswrap">
        <div className="oscard ostip">
          <span className="ostip__icon" aria-hidden="true">🐾</span>
          <h1 className="ostip__title">Care tips for your {form.breed}</h1>
          {tips.length > 0 ? (
            <div className="ostip__list">
              {tips.map((t, i) => (
                <div className="ostip__card" key={t.id || i}>
                  <span className="ostip__cardicon" aria-hidden="true">{CATEGORY_ICON[t.category] || '🐾'}</span>
                  <p className="ostip__cardtext">{t.tip}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="ostip__body">Thanks — that helps. We’ll keep tailoring tips for your dog as our vet-reviewed library grows.</p>
          )}
          <button
            type="button"
            className="osbtn osbtn--primary"
            onClick={() => {
              if (!user) { setShowLoginGate(true); return; }
              continueToProfile();
            }}
          >
            Add your dog's details →
          </button>
          <p className="ostip__foot">Takes under a minute. We've already filled in the breed and city.</p>
        </div>
        <Styles />

        {/* Post-survey login gate — appears when a logged-out user clicks
            "Add your dog's details". Cannot be dismissed. */}
        <QuickLoginModal
          isOpen={showLoginGate}
          onSuccess={() => { setShowLoginGate(false); continueToProfile(); }}
        />
      </div>
    );
  }

  /* One question per screen, like the quiz. Each entry's `body` reads and
     writes the same `form` state the old single-page layout used — only the
     display (one at a time, gated Next) changed. */
  const steps = [
    {
      title: 'What breed is your dog?',
      answered: !!form.breed,
      body: (
        <div className="osq__typeahead">
          {!customBreed ? (
            <>
              <input
                type="text"
                inputMode="text"
                value={form.breed || breedQuery}
                placeholder="Start typing — e.g. Labrador"
                onChange={(e) => { setBreedQuery(e.target.value); set('breed', ''); setBreedOpen(true); }}
                onFocus={() => setBreedOpen(true)}
                onBlur={() => window.setTimeout(() => setBreedOpen(false), 160)}
                className="osq__input"
              />
              {breedOpen && (
                <ul className="osq__list">
                  {breedMatches.map((b) => (
                    <li key={b.id || b.name}>
                      <button
                        type="button"
                        className="osq__listitem"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { set('breed', b.name); setBreedQuery(b.name); setBreedOpen(false); }}
                      >
                        {b.img && <img src={`/${b.img}`} alt="" loading="lazy" />}
                        <span>{b.name}</span>
                      </button>
                    </li>
                  ))}
                  {/* "Others" — always visible at the bottom of the list */}
                  <li>
                    <button
                      type="button"
                      className="osq__listitem osq__listitem--other"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setCustomBreed(true); setBreedQuery(''); set('breed', ''); setBreedOpen(false); }}
                    >
                      <span className="osq__othericon" aria-hidden="true">✏️</span>
                      <span>Others — enter breed name</span>
                    </button>
                  </li>
                </ul>
              )}
            </>
          ) : (
            <div>
              <input
                type="text"
                inputMode="text"
                value={form.breed}
                placeholder="Enter your dog's breed name"
                onChange={(e) => set('breed', e.target.value)}
                className="osq__input"
                autoFocus
              />
              <button
                type="button"
                className="osq__backlink"
                onClick={() => { setCustomBreed(false); set('breed', ''); }}
                style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--orange)', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}
              >
                ← Back to breed list
              </button>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Which city do you live in?',
      answered: !!form.city,
      body: <CitySelect value={form.city} onChange={(v) => set('city', v)} />,
    },
    {
      title: 'How long have you had your dog?',
      answered: !!form.tenure,
      body: <ChoiceList name="tenure" options={CHOICES.tenure} value={form.tenure} onChange={(v) => set('tenure', v)} />,
    },
    {
      title: 'What’s your living situation?',
      answered: !!form.living_situation,
      body: <ChoiceList name="living" options={CHOICES.living_situation} value={form.living_situation} onChange={(v) => set('living_situation', v)} />,
    },
    {
      title: 'On an average day, how many hours is your dog alone?',
      answered: !!form.hours_alone,
      body: <ChoiceList name="alone" options={CHOICES.hours_alone} value={form.hours_alone} onChange={(v) => set('hours_alone', v)} />,
    },
    {
      title: 'How satisfied are you with this breed for your lifestyle?',
      answered: !!form.satisfaction,
      body: <PawRating value={form.satisfaction} onChange={(v) => set('satisfaction', v)} />,
    },
    {
      title: 'What’s been your biggest challenge with this breed?',
      hint: 'Select all that apply',
      answered: form.biggest_challenge.length > 0,
      body: (
        <ChoiceList
          name="challenge"
          multi
          options={CHOICES.biggest_challenge}
          value={form.biggest_challenge}
          onChange={(v) => set('biggest_challenge', v)}
        />
      ),
    },
    {
      title: 'Would you recommend this breed to a first-time owner in your situation?',
      answered: !!form.would_recommend,
      body: (
        <>
          <ChoiceList name="recommend" options={CHOICES.would_recommend} value={form.would_recommend} onChange={(v) => set('would_recommend', v)} />
          {form.would_recommend === 'depends' && (
            <input
              type="text"
              className="osq__input"
              style={{ marginTop: 10 }}
              placeholder="Optional — what does it depend on?"
              value={form.recommend_note}
              maxLength={140}
              onChange={(e) => set('recommend_note', e.target.value)}
            />
          )}
        </>
      ),
    },
  ];

  const step = steps[currentQ];
  const isLast = currentQ === steps.length - 1;
  const pct = Math.round(((currentQ + 1) / steps.length) * 100);

  const goNext = () => {
    setError('');
    if (isLast) { submit(); return; }
    setCurrentQ((n) => n + 1);
  };
  const goBack = () => {
    setError('');
    if (currentQ > 0) setCurrentQ((n) => n - 1);
  };

  return (
    <div className="oswrap">
      <header className="oshead">
        <img src="/logo.png" alt="Paw Buddy" className="oshead__logo" onClick={() => navigate('/')} />
        <h1 className="oshead__title">Tell us about your dog</h1>
        <p className="oshead__sub">Eight quick questions. It helps us tailor the care reminders you’ll get.</p>
      </header>

      <div className="oscard">
        <div className="osprog">
          <div className="osprog__row">
            <span>Question {currentQ + 1} of {steps.length}</span>
            <span>{pct}%</span>
          </div>
          <div className="osprog__track"><div className="osprog__fill" style={{ width: `${pct}%` }} /></div>
        </div>

        <Question n={currentQ + 1} title={step.title}>
          {step.hint && <p className="osq__hint">{step.hint}</p>}
          {step.body}

          {/* The survey's only teaser, and only on the city question (index 1).
              Inline and passive by design — no dismiss control, nothing to
              close, and it never blocks Next. Rendered inside the question so
              it sits directly under the city control on the same screen. */}
          {currentQ === TEASER_STEP && teaser && (
            <div className="osteaser" role="status">
              <span className="osteaser__icon" aria-hidden="true">
                {CATEGORY_ICON[teaser.category] || '🐾'}
              </span>
              <p className="osteaser__text">
                <strong>Quick tip based on what you’ve told us so far →</strong>{' '}
                {teaser.tip}
              </p>
            </div>
          )}
        </Question>

        {error && <p className="oserr" role="alert">{error}</p>}

        <div className="osnav">
          <button
            type="button"
            className="osbtn osbtn--ghost"
            onClick={goBack}
            style={{ visibility: currentQ === 0 ? 'hidden' : 'visible' }}
          >
            ← Back
          </button>
          <button
            type="button"
            className="osbtn osbtn--primary"
            onClick={goNext}
            disabled={!step.answered || saving}
          >
            {saving ? 'Saving…' : isLast ? 'Submit & continue' : 'Next →'}
          </button>
        </div>
      </div>
      <Styles />
    </div>
  );
};

const Styles = () => (
  <style>{`
    .oswrap {
      min-height: 100dvh; background: var(--cream);
      padding: 20px 16px 40px; font-family: var(--font-body-family);
    }
    .oshead { max-width: 640px; margin: 0 auto 18px; text-align: center; }
    .oshead__logo { width: 120px; mix-blend-mode: multiply; cursor: pointer; }
    .oshead__title {
      font-family: var(--font-display); color: var(--brown); font-weight: var(--weight-bold);
      font-size: clamp(22px, 6vw, 30px); margin: 6px 0 4px;
    }
    .oshead__sub { color: var(--text-soft); font-size: 14px; margin: 0; line-height: 1.5; }

    .oscard {
      max-width: 640px; margin: 0 auto; background: var(--white);
      border: 1px solid #EFE6DC; border-radius: 20px;
      padding: clamp(16px, 4vw, 26px); box-shadow: 0 10px 30px -22px rgba(61,41,28,.5);
    }

    /* ---- progress header, mirrors the quiz's "Question X of N" bar ---- */
    .osprog { margin-bottom: 18px; }
    .osprog__row {
      display: flex; justify-content: space-between; margin-bottom: 7px;
      font-size: 12px; font-weight: var(--weight-bold); color: var(--text-soft);
    }
    .osprog__track { background: #EAE4DE; border-radius: 50px; height: 7px; overflow: hidden; }
    .osprog__fill {
      height: 100%; background: linear-gradient(90deg, var(--orange), var(--orange-light));
      border-radius: 50px; transition: width .35s cubic-bezier(.34, 1.56, .64, 1);
    }

    .osq { padding: 0 0 6px; }
    .osq__title {
      display: flex; gap: 9px; align-items: baseline;
      font-family: var(--font-display); color: var(--brown);
      font-size: 16px; font-weight: var(--weight-semibold); margin: 0 0 12px; line-height: 1.4;
    }
    .osq__n {
      flex-shrink: 0; color: var(--orange); font-size: 12px; font-weight: var(--weight-bold);
      letter-spacing: .05em;
    }
    .osq__hint { margin: -6px 0 12px; color: var(--text-soft); font-size: 12.5px; }

    .osq__input {
      width: 100%; box-sizing: border-box; padding: 13px 15px;
      border: 2px solid #EAE4DE; border-radius: 12px; background: #fff;
      font-family: inherit; font-size: 16px; /* 16px stops iOS zooming on focus */
      color: var(--brown); outline: none;
    }
    .osq__input:focus { border-color: var(--orange); box-shadow: 0 0 0 3px rgba(227,93,24,.12); }

    .osq__typeahead { position: relative; }
    .osq__list {
      position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 40;
      margin: 0; padding: 6px; list-style: none; max-height: 260px; overflow-y: auto;
      background: #fff; border: 1px solid #EAE4DE; border-radius: 12px;
      box-shadow: 0 18px 40px rgba(61,41,28,.18);
    }
    .osq__listitem {
      display: flex; align-items: center; gap: 10px; width: 100%;
      padding: 10px 12px; border: none; background: none; border-radius: 8px;
      font-family: inherit; font-size: 14.5px; color: var(--brown);
      text-align: left; cursor: pointer;
    }
    .osq__listitem img { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
    .osq__listitem:active { background: var(--orange-pale, #FDF1E8); }
    @media (hover: hover) { .osq__listitem:hover { background: var(--cream); } }

    /* "Others" row — visually distinct from breed rows */
    .osq__listitem--other {
      border-top: 1px solid #EAE4DE; margin-top: 4px; padding-top: 12px;
      color: var(--orange); font-weight: var(--weight-semibold);
    }
    .osq__othericon { font-size: 16px; flex-shrink: 0; }

    .osq__choices { display: flex; flex-direction: column; gap: 8px; }
    .osq__choice {
      display: flex; align-items: center; gap: 11px; width: 100%;
      /* 52px min height — comfortably past the 44px touch minimum */
      min-height: 52px; padding: 12px 14px; text-align: left;
      border: 2px solid #EAE4DE; border-radius: 13px; background: #fff;
      font-family: inherit; font-size: 14.5px; color: var(--brown);
      cursor: pointer; -webkit-tap-highlight-color: transparent;
      transition: border-color .18s ease, background-color .18s ease;
    }
    .osq__choice.is-on { border-color: var(--orange); background: var(--orange-pale, #FDF1E8); }
    .osq__choice:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
    @media (hover: hover) { .osq__choice:hover { border-color: #D8CCBE; } }

    .osq__dot {
      flex-shrink: 0; width: 18px; height: 18px; border-radius: 50%;
      border: 2px solid #D8CCBE; background: #fff; transition: all .18s ease;
    }
    .osq__choice.is-on .osq__dot {
      border-color: var(--orange); background: var(--orange);
      box-shadow: inset 0 0 0 3px #fff;
    }
    /* multi-select rows use a checkbox square + tick instead of a radio dot */
    .osq__choice--check .osq__dot { border-radius: 6px; }
    .osq__choice--check.is-on .osq__dot { box-shadow: none; position: relative; }
    .osq__choice--check.is-on .osq__dot::after {
      content: ''; position: absolute; inset: 0; margin: auto;
      width: 5px; height: 9px; border: solid #fff; border-width: 0 2px 2px 0;
      transform: translate(0, -1px) rotate(45deg);
    }

    .oserr {
      margin: 14px 0 0; padding: 10px 13px; border-radius: 11px;
      background: #FFF5F5; border: 1px solid #F2C9C9; color: #B23B3B; font-size: 13px;
    }

    .osbtn {
      padding: 14px 26px; border: none; border-radius: 50px;
      font-family: var(--font-display); font-size: 15px; font-weight: var(--weight-semibold); cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .osbtn--primary {
      background: var(--orange); color: #fff;
      box-shadow: 0 8px 22px rgba(208,92,25,.28);
    }
    .osbtn--primary:disabled { opacity: .5; cursor: not-allowed; box-shadow: none; }
    .osbtn--wide { width: 100%; }
    .osbtn--ghost {
      background: none; border: 2px solid #EAE4DE; color: var(--text-soft);
    }
    @media (hover: hover) { .osbtn--ghost:hover { border-color: var(--orange); color: var(--orange); } }

    /* ---- Back / Next row, mirrors the quiz's nav ---- */
    .osnav { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 20px; }

    /* ---- the post-submit tip ---- */
    .ostip { text-align: center; max-width: 520px; }
    .ostip__icon { font-size: 42px; display: block; margin-bottom: 8px; }
    .ostip__title {
      font-family: var(--font-display); color: var(--brown); font-weight: var(--weight-semibold);
      font-size: clamp(19px, 5vw, 23px); margin: 0 0 10px; line-height: 1.3;
    }
    .ostip__body { color: var(--text-soft); font-size: 14.5px; line-height: 1.65; margin: 0; }
    .ostip__foot { color: var(--text-soft); font-size: 12px; margin: 10px 0 0; }

    /* Up to 3 tips, each its own card — never one paragraph block. */
    .ostip__list { display: flex; flex-direction: column; gap: 10px; text-align: left; margin: 4px 0 0; }
    .ostip__card {
      display: flex; gap: 11px; align-items: flex-start;
      padding: 14px 15px; border: 1px solid #EFE6DC; border-radius: 14px;
      background: var(--cream);
    }
    .ostip__cardicon { flex-shrink: 0; font-size: 19px; line-height: 1.5; }
    .ostip__cardtext { margin: 0; color: var(--brown); font-size: 13.5px; line-height: 1.6; }

    /* The single inline teaser under Q2. Quieter than the post-submit tip cards
       above — this one appears while the user is mid-task, so it reads as an
       aside rather than a result. Fades in instead of popping, so it does not
       read as something that needs attention. */
    .osteaser {
      display: flex; gap: 10px; align-items: flex-start;
      margin: 16px 0 0; padding: 12px 13px;
      background: var(--orange-pale, #FDF1E8);
      border: 1px solid #F3DDC6; border-radius: 12px;
      animation: osteaserIn .32s cubic-bezier(.16,1,.3,1) both;
    }
    .osteaser__icon { flex-shrink: 0; font-size: 16px; line-height: 1.55; }
    .osteaser__text {
      margin: 0; color: var(--brown); font-size: 13px; line-height: 1.6;
      /* Long tips wrap rather than stretching the card on a narrow phone. */
      min-width: 0; overflow-wrap: anywhere;
    }
    .osteaser__text strong { color: var(--orange-strong, #C44E12); font-weight: var(--weight-semibold); }
    @keyframes osteaserIn {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: none; }
    }
    @media (prefers-reduced-motion: reduce) { .osteaser { animation: none; } }
    @media (max-width: 480px) {
      .osteaser { padding: 11px 12px; gap: 8px; }
      .osteaser__text { font-size: 12.5px; }
    }
  `}</style>
);

export default OwnerSurvey;
