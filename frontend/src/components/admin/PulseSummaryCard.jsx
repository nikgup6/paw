import { useEffect, useState } from 'react';
import axios from 'axios';
import { SCREENERS, USEFUL } from '../../config/pulse';

/* "What people told us": the answers from the "Was this useful?" card
   (components/results/ResultsPulse.jsx), from GET /api/feedback/pulse/summary.
   Admin only (the server checks). Sits at the bottom of FunnelReport and uses
   the same date range.

   Nothing personal is ever in this data: comments come with a date, the
   breed and the paywall state, never a name, number or email. Comments are
   rendered as React text, so anything typed into them is shown as text. */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const card = {
  background: 'white', borderRadius: '16px', padding: '20px',
  boxShadow: 'var(--shadow, 0 4px 20px rgba(0,0,0,.06))', marginBottom: '20px',
};
const h3 = { fontFamily: 'var(--font-display)', color: 'var(--brown)', margin: '0 0 4px', fontSize: '17px', fontWeight: 'var(--weight-semibold)' };
const h4 = { fontFamily: 'var(--font-display)', color: 'var(--brown)', margin: '0 0 8px', fontSize: '14.5px', fontWeight: 'var(--weight-semibold)' };
const sub = { color: 'var(--text-soft)', margin: '0 0 16px', fontSize: '13px', fontFamily: 'var(--font-body-family)' };

const STATE_LABEL = {
  all: 'Everyone', paid: 'Paid (real money)', fake_door: 'Tapped Pay (fake door, no money)',
  dismissed: 'Closed the paywall', none: 'Paywall off',
};
const USEFUL_LABEL = Object.fromEntries(USEFUL.options);
const USEFUL_COLOR = { yes: '#1B8046', some: '#E0A100', no: '#C0392B' };
const ANSWER_LABEL = Object.fromEntries(
  Object.entries(SCREENERS).map(([key, q]) => [key, Object.fromEntries(q.options)]),
);
const SCREENER_TITLE = {
  not_paid_reason: 'What held people back from unlocking',
  breed_known: 'Already knew which breed they wanted?',
  price_fair: 'Was the price fair? (people who unlocked)',
};

const TooFew = ({ total, threshold }) => (total < threshold ? (
  <span style={{ marginLeft: 8, fontSize: '11.5px', fontWeight: 700, color: '#8A5A00', background: '#FFF4D6', padding: '2px 8px', borderRadius: 20 }}>
    too few ({total} of {threshold}) - read as anecdotes
  </span>
) : null);

/* One stacked bar: yes / some / no for one group of people. */
const UsefulBar = ({ label, counts, threshold }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--brown)', marginBottom: 4 }}>
      {label} <span style={{ fontWeight: 400, color: 'var(--text-soft)' }}>({counts.total})</span>
      <TooFew total={counts.total} threshold={threshold} />
    </div>
    <div style={{ display: 'flex', height: 22, borderRadius: 8, overflow: 'hidden', background: '#F3EEE8' }}>
      {['yes', 'some', 'no'].map((code) => (counts[code] ? (
        <div key={code} title={`${USEFUL_LABEL[code]}: ${counts[code]}`}
          style={{ width: `${(counts[code] / counts.total) * 100}%`, background: USEFUL_COLOR[code], color: 'white',
                   fontSize: '11.5px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {counts[code]}
        </div>
      ) : null))}
    </div>
  </div>
);

const Distribution = ({ k, data, threshold, title }) => {
  const max = Math.max(1, ...data.counts.map((c) => c.count));
  return (
    <div style={{ flex: '1 1 260px', minWidth: 0 }}>
      <h4 style={h4}>{title || SCREENER_TITLE[k]} <TooFew total={data.total} threshold={threshold} /></h4>
      {/* The server sends these sorted by count, most common first. */}
      {data.counts.map(({ answer, count }) => (
        <div key={answer} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 34px', gap: 8, alignItems: 'center', marginBottom: 6, fontSize: '12.5px' }}>
          <span style={{ color: 'var(--brown)' }}>{ANSWER_LABEL[k][answer] || answer}</span>
          <span style={{ height: 12, borderRadius: 6, background: '#F3EEE8', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${(count / max) * 100}%`, background: 'var(--orange)' }} />
          </span>
          <span style={{ textAlign: 'right', fontWeight: 700 }}>{count}</span>
        </div>
      ))}
    </div>
  );
};

const PulseSummaryCard = ({ days, start, end }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [includeTest, setIncludeTest] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const params = start || end ? { start: start || undefined, end: end || undefined } : { days };
    let token = '';
    try { token = localStorage.getItem('pb_token') || ''; } catch { /* storage blocked */ }
    axios.get(`${API_URL}/api/feedback/pulse/summary`, {
      params: { ...params, include_test: includeTest },
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(({ data: d }) => { if (!cancelled) { setData(d); setError(''); } })
      .catch(() => { if (!cancelled) setError('Couldn’t load the answers. Is the API running?'); });
    return () => { cancelled = true; };
  }, [days, start, end, includeTest]);

  if (error) return <div style={card}><h3 style={h3}>What people told us</h3><p style={{ ...sub, margin: 0 }}>{error}</p></div>;
  if (!data) return <div style={card}><h3 style={h3}>What people told us</h3><p style={{ ...sub, margin: 0 }}>Loading…</p></div>;

  const t = data.too_few_threshold;
  const r = data.response;
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={h3}>What people told us</h3>
        <label style={{ fontSize: '12.5px', color: 'var(--text-soft)', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} />
          Include my test visits (?utm_source=test)
        </label>
      </div>
      <p style={sub}>
        From the “Was this useful?” card after a recommendation. Asked {r.shown} time{r.shown === 1 ? '' : 's'},
        answered by {r.answered} - response rate {r.rate == null ? '—' : `${r.rate}%`}. Mobile numbers are unverified;
        these answers are tied to a visit, not to a proven person.
      </p>

      {/* The most useful card in the fake-door pilot goes first. */}
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 22 }}>
        <Distribution k="not_paid_reason" data={data.screeners.not_paid_reason} threshold={t} />
        {data.left_paywall_open_no_answer != null && (
          <div style={{ flex: '0 1 220px', alignSelf: 'flex-start', background: '#FFF6EC', border: '1px solid #FFD9BD', borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ fontSize: '12.5px', color: 'var(--text-soft)' }}>Left with the paywall open (no answer)</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--brown)' }}>{data.left_paywall_open_no_answer}</div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-soft)' }}>closed the tab or switched apps with the price on screen</div>
          </div>
        )}
      </div>

      <h4 style={h4}>Was the recommendation useful?</h4>
      <div style={{ display: 'flex', gap: 14, fontSize: '12px', color: 'var(--text-soft)', marginBottom: 10 }}>
        {['yes', 'some', 'no'].map((code) => (
          <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: USEFUL_COLOR[code] }} />{USEFUL_LABEL[code]}
          </span>
        ))}
      </div>
      {['all', 'paid', 'fake_door', 'dismissed', 'none'].map((state) => (
        data.useful[state].total > 0 || state === 'all'
          ? <UsefulBar key={state} label={STATE_LABEL[state]} counts={data.useful[state]} threshold={t} />
          : null
      ))}

      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', margin: '20px 0 22px' }}>
        <Distribution k="breed_known" data={data.screeners.breed_known} threshold={t} />
        {/* Real payers and fake-door unlockers answer different questions ("was it
            fair?" vs "would it have been fair?"), so they are never mixed. */}
        {data.price_fair_by_state ? (
          <>
            <Distribution k="price_fair" title="Was the price fair? (paid, real money)" data={data.price_fair_by_state.paid} threshold={t} />
            <Distribution k="price_fair" title="Would the price have felt fair? (tapped Pay, fake door)" data={data.price_fair_by_state.fake_door} threshold={t} />
          </>
        ) : <Distribution k="price_fair" data={data.screeners.price_fair} threshold={t} />}
      </div>

      {data.legacy_paid_rows_fake_door > 0 && (
        <p style={{ ...sub, color: '#8A5A00' }}>
          {data.legacy_paid_rows_fake_door} older answer{data.legacy_paid_rows_fake_door === 1 ? '' : 's'} say “paid” but
          the person only tapped Pay through the fake door (saved before the two were split). Left as they were.
        </p>
      )}

      <h4 style={h4}>Latest comments <span style={{ fontWeight: 400, color: 'var(--text-soft)', fontSize: '12.5px' }}>({data.comments.length})</span></h4>
      {data.comments.length === 0 ? (
        <p style={{ ...sub, margin: 0 }}>No comments in this range yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {data.comments.map((c, i) => (
            <li key={`${c.date}-${i}`} style={{ padding: '10px 0', borderTop: i ? '1px solid #F1EAE2' : 'none', fontSize: '13px' }}>
              <div style={{ color: 'var(--text-soft)', fontSize: '11.5px', marginBottom: 3 }}>
                {new Date(c.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                {' · '}{c.breed || 'breed unknown'}{' · '}{STATE_LABEL[c.paywall_state] || c.paywall_state}
                {' · '}<span style={{ color: USEFUL_COLOR[c.useful], fontWeight: 700 }}>{USEFUL_LABEL[c.useful]}</span>
              </div>
              <div style={{ color: 'var(--brown)' }}>{c.comment}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PulseSummaryCard;
