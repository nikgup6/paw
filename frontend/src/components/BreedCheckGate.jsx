/* ── Personalised "why this may not fit" summary + Buy confirmation ──

   Shown when the user opens a breed that fell outside their top-5 matches and
   then taps Buy: a short, diplomatic paragraph explaining — in their own terms
   — why the breed may be a demanding match, plus Proceed / Go-back actions.
   Shared by both results surfaces (Results.jsx and BreedProfileModal) so the
   message and buttons read identically.

   Note: the earlier pre-profile "ideal living conditions" paw-rating gate was
   removed at Vibhuvan's request. The profile now opens directly (with its
   pros/cons); this confirmation is the only lifestyle-fit check, and it fires
   at the Buy step. The file name is kept so imports don't churn. */

const _levelToken = (s) => {
  const t = String(s || '').trim().toLowerCase();
  // Longest-first so "Very High" beats "High" and "Low-Medium" beats "Low".
  // Handles both the en-dash ("Low–Medium") and hyphen ("Low-Medium") forms.
  for (const k of ['Very High', 'Very Low', 'Medium-High', 'Medium–High', 'Low-Medium', 'Low–Medium', 'High', 'Medium', 'Low']) {
    if (t.startsWith(k.toLowerCase())) return k.replace('–', '-');
  }
  return '';
};
const _detailAfterDash = (s) => {
  // "High – 1–2 hrs vigorous daily; ..." → "1–2 hrs vigorous daily"
  const parts = String(s || '').split(/\s[–-]\s/);
  const tail = parts.length > 1 ? parts.slice(1).join(' - ') : '';
  return tail.split(';')[0].trim();
};
const _firstVal = (answers, key) => { const v = answers?.[key]; return Array.isArray(v) ? v[0] : v; };
const _HOME_RANK = { 'apt-1bhk': 1, 'apt-2bhk': 2, 'apt-3bhk': 3, 'house-no-yard': 4, 'house-yard': 5 };
const _HOME_LABEL = { 'apt-1bhk': 'a 1BHK apartment', 'apt-2bhk': 'a 2BHK apartment', 'apt-3bhk': 'a 3BHK apartment', 'house-no-yard': 'a house without a yard', 'house-yard': 'a house with a yard' };
const _BREED_SPACE_RANK = { '1BHK OK': 1, '2BHK min': 2, '3BHK min': 4, 'House only': 5 };
const _ACT_LABEL = { relaxed: 'the relaxed routine you described', moderate: 'a moderately active routine', high: 'a very active routine' };

export function lifestyleMismatchSummary(breed, answers) {
  if (!breed) return null;
  const home = _firstVal(answers, 'home');
  const act = _firstVal(answers, 'activity');
  const exp = _firstVal(answers, 'experience');
  const clauses = [];

  const need = _BREED_SPACE_RANK[String(breed.minApartmentSize || '').trim()];
  const have = _HOME_RANK[home];
  if (need != null && have != null && need > have) {
    const space = breed.minApartmentSize === 'House only'
      ? 'an independent house'
      : `a ${String(breed.minApartmentSize).replace(/\s*(min|OK)$/i, '')}`;
    clauses.push(`it's happiest with ${space}, which is more room than ${_HOME_LABEL[home] || 'your current home'} offers`);
  }
  const en = _levelToken(breed.energy);
  if ((en === 'High' || en === 'Very High') && (act === 'relaxed' || act === 'moderate')) {
    const detail = _detailAfterDash(breed.energy);
    clauses.push(`it needs ${detail || 'a lot of vigorous exercise every day'}, which is demanding alongside ${_ACT_LABEL[act] || 'your routine'}`);
  }
  if (String(breed.experienceLevel || '').trim() === 'Experienced only' && exp === 'none') {
    clauses.push(`it's usually recommended for experienced owners rather than first-time dog parents`);
  }
  if (clauses.length < 3 && ['High', 'Very High'].includes(_levelToken(breed.grooming))) {
    clauses.push(`its coat needs frequent, committed grooming`);
  }

  const intro = `We can tell you're drawn to the ${breed.name}, and it's a wonderful dog.`;
  const picked = clauses.slice(0, 3);
  if (!picked.length) {
    return `${intro} It just wasn't among your top matches for the lifestyle you described, so it's worth reading the full profile carefully before deciding. Many owners make a less-obvious match work with the right commitment — we only want your choice to be a well-informed one.`;
  }
  const body = picked.length === 1
    ? `Based on what you told us, though, ${picked[0]}.`
    : `Based on what you told us, though, ${picked.slice(0, -1).join('; ')}; and ${picked[picked.length - 1]}.`;
  return `${intro} ${body} Plenty of families still make it work with extra time and commitment — we're only sharing this so your decision is an informed one.`;
}

/* The Buy confirmation: the diplomatic summary above plus two actions. Shared
   by both results surfaces so the message and buttons read identically. */
export const BuyConfirm = ({ breed, answers, onProceed, onBack }) => (
  <div style={{ fontFamily: 'var(--font-body-family)', textAlign: 'center', padding: '8px 4px' }}>
    <div style={{ fontSize: '40px', marginBottom: '6px' }} aria-hidden="true">🐾</div>
    <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--brown)', fontSize: 'clamp(20px, 5vw, 24px)', margin: '0 0 12px' }}>Before you decide…</h3>
    <p style={{ color: 'var(--text-soft)', fontSize: '14.5px', lineHeight: 1.6, maxWidth: '520px', margin: '0 auto 22px' }}>
      {lifestyleMismatchSummary(breed, answers)}
    </p>
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
      <button
        onClick={onProceed}
        style={{ flex: '1 1 180px', maxWidth: '260px', padding: '13px 20px', border: 'none', borderRadius: 'var(--radius-pill)', background: 'var(--orange)', color: 'white', fontWeight: 'var(--weight-bold)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '15px' }}
      >
        Proceed anyway
      </button>
      <button
        onClick={onBack}
        style={{ flex: '1 1 180px', maxWidth: '260px', padding: '13px 20px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-pill)', background: 'white', color: 'var(--brown)', fontWeight: 'var(--weight-bold)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '15px' }}
      >
        Go back
      </button>
    </div>
  </div>
);
