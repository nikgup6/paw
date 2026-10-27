import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import PulseSummaryCard from './PulseSummaryCard';
import { FREE_SCREEN_IDS } from '../../config/paywall';
import { AGE_RANGES } from '../auth/contactRules';
import BREEDERS from '../../constants/breeders.json';

/* The Pilot view: the four stages of the paid pilot, from
   GET /api/funnel/pilot-report (admin only; backend/app/services/pilot_report.py).

   Read-only, next to the Funnel view (which is unchanged). Same fetch, auth and
   loading pattern as FunnelReport.jsx, plain React and inline styles, no chart
   library: bars are plain divs.

   How to read it:
   - Funnel steps are distinct SESSIONS (one browser visit). Money and breeder
     numbers are also given as distinct signed-in PEOPLE. Each card says which.
   - Money is counted from the payments table, never from tracking events.
   - In fake-door mode nobody pays: "Tapped Pay" is intent, not money.
   - Mobile numbers are unverified (no OTP): a sign-up is a typed number. */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const NAVY = '#011E4A';
const ORANGE = '#F5691A';
const ORANGE_TEXT = '#C84B0A';
const PEACH = '#FFD9BD';
const GREY = '#6B7280';

const card = {
  background: 'white', borderRadius: '16px', padding: '18px',
  boxShadow: 'var(--shadow, 0 4px 20px rgba(0,0,0,.06))', marginBottom: '18px', minWidth: 0,
};
const h3 = { fontFamily: 'var(--font-display)', color: NAVY, margin: '0 0 4px', fontSize: '17px', fontWeight: 700 };
const sub = { color: GREY, margin: '0 0 14px', fontSize: '13px', lineHeight: 1.45 };
const th = {
  textAlign: 'left', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: GREY,
  padding: '8px 10px', borderBottom: `1px solid ${PEACH}`, whiteSpace: 'nowrap', background: 'white',
};
const td = { padding: '8px 10px', borderBottom: '1px solid #F4EDE5', fontSize: '13px', color: NAVY, whiteSpace: 'nowrap' };
const chip = (on) => ({
  padding: '7px 13px', borderRadius: '50px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, minHeight: 36,
  border: on ? 'none' : `1px solid ${PEACH}`, fontFamily: 'inherit',
  background: on ? NAVY : 'white', color: on ? 'white' : NAVY,
});

/* ---- formatting: never NaN or Infinity, Indian grouping, one decimal ---- */
const num = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-IN') : '—');
const pct = (p) => (typeof p === 'number' && Number.isFinite(p) ? `${p.toFixed(1)}%` : '—');
const share = (a, b) => (b ? (a / b) * 100 : null);
const rupees = (r) => (typeof r === 'number' && Number.isFinite(r)
  ? `₹${r.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—');
const ofText = (r) => (r ? `${num(r.count)} of ${num(r.of)} (${pct(r.pct)})` : '—');
const AGE_LABEL = Object.fromEntries(AGE_RANGES);
/* Name and city for a breeder id, from the list the app ships. Fills the name
   for old call taps that were sent without one. */
const BREEDER_BY_ID = Object.fromEntries(BREEDERS.map((b) => [b.id, { name: b.name, city: b.city }]));

/* "5 (3 / 2)": sessions, then how many of them unlocked / did not. */
const TapCell = ({ t }) => (
  <>{num(t.total)} <span style={{ color: GREY, fontSize: '12px' }}>({num(t.unlocked)} / {num(t.not_unlocked)})</span></>
);

const MODE_STYLE = {
  off: { bg: '#E5E7EB', fg: '#374151', text: 'Paywall off' },
  fake_door: { bg: '#FFF1D6', fg: '#8A5A00', text: 'Fake door: numbers are intent, not money' },
  test: { bg: '#DBEAFE', fg: '#1E3A8A', text: 'Test mode: pretend money' },
  live: { bg: '#DCFCE7', fg: '#166534', text: 'Live: real payments' },
};

const PRESETS = [
  { id: 'pilot', label: 'Pilot window' },
  { id: 7, label: '7 days' },
  { id: 30, label: '30 days' },
  { id: 90, label: '90 days' },
];

const NotLive = ({ show }) => (show
  ? <span style={{ marginLeft: 6, fontSize: '11px', color: GREY, background: '#F3F4F6', padding: '1px 7px', borderRadius: 20 }}>not live yet</span>
  : null);

/* A section that knows its own empty state. */
const Section = ({ title, note, children }) => (
  <div style={card}>
    <h3 style={h3}>{title}</h3>
    {note && <p style={sub}>{note}</p>}
    {children}
  </div>
);

const Scroll = ({ children }) => (
  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -4px' }}>{children}</div>
);

/* ---------------- the breakdown / per-reel table (sortable) ---------------- */
const COLUMNS = [
  ['visits', 'Visits'], ['tapped_find_dog', 'Tapped Find my dog'], ['quiz_started', 'Quiz started'],
  ['rough_rec_viewed', 'Rough rec'], ['form_submitted', 'Form submitted'],
  ['paywall_viewed', 'Paywall viewed'], ['paid', 'Paid / tapped Pay'], ['breeder_taps', 'Breeder taps'],
  ['paid_pct', 'Paid % of paywall views'],
];
const BreakdownTable = ({ rows, keyLabel, labelFor = (k) => k }) => {
  const [sort, setSort] = useState({ key: 'visits', dir: -1 });
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const x = sort.key === 'key' ? String(a.key) : (a[sort.key] ?? -1);
    const y = sort.key === 'key' ? String(b.key) : (b[sort.key] ?? -1);
    return (x > y ? 1 : x < y ? -1 : 0) * sort.dir;
  }), [rows, sort]);
  if (!rows.length) return <p style={{ ...sub, margin: 0 }}>Nothing in this range yet.</p>;
  const head = (key, label) => (
    <th style={th} key={key} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 }))}
        style={{ all: 'unset', cursor: 'pointer', minHeight: 32, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}{sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  );
  return (
    <Scroll>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
        <thead><tr>{head('key', keyLabel)}{COLUMNS.map(([k, l]) => head(k, l))}</tr></thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.key}>
              <td style={{ ...td, fontWeight: 700, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{labelFor(r.key)}</td>
              {COLUMNS.slice(0, -1).map(([k]) => <td key={k} style={td}>{num(r[k])}</td>)}
              <td style={td}>
                {r.too_few
                  ? <span title="Under 30 visits or under 5 paywall views" style={{ color: '#8A5A00', background: '#FFF4D6', padding: '2px 8px', borderRadius: 20, fontSize: '11.5px', fontWeight: 700 }}>too few</span>
                  : <b>{pct(r.paid_pct)}</b>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Scroll>
  );
};

/* ---------------- entry funnel (anonymous: before any account) ----------------
   The contact form comes at Unlock, after the free "About you" questions. */
const ENTRY_LABEL = {
  visits: 'Visits', tapped: 'Tapped Find my dog', quiz_started: 'Quiz started', free_done: 'Finished About you',
  rough_viewed: 'Saw the rough match', unlock_tapped: 'Tapped Unlock', form_viewed: 'Saw the contact form',
  form_started: 'Started typing', submitted: 'Submitted', account_created: 'Account created',
  paywall_viewed: 'Saw the paywall',
};
const EntryFunnel = ({ entry, notLive }) => {
  const max = Math.max(1, ...entry.steps.map((s) => s.count));
  const split = (rows, label) => (
    <div style={{ flex: '1 1 320px', minWidth: 0 }}>
      <h4 style={{ margin: '0 0 6px', fontSize: '14px' }}>By {label}</h4>
      {rows.length === 0 ? <p style={{ ...sub, margin: 0 }}>Nothing yet.</p> : (
        <Scroll>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
            <thead><tr>{[label, 'Tapped', 'Quiz', 'Unlock', 'Saw form', 'Account', 'Account % of form'].map((x) => <th key={x} style={th}>{x}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td style={{ ...td, fontWeight: 700 }}>{r.key}</td>
                  <td style={td}>{num(r.tapped)}</td><td style={td}>{num(r.quiz_started)}</td>
                  <td style={td}>{num(r.unlock_tapped)}</td><td style={td}>{num(r.form_viewed)}</td>
                  <td style={td}>{num(r.account_created)}</td>
                  <td style={td}>{r.too_few
                    ? <span style={{ color: '#8A5A00', background: '#FFF4D6', padding: '2px 8px', borderRadius: 20, fontSize: '11.5px', fontWeight: 700 }}>too few</span>
                    : <b>{pct(r.created_pct)}</b>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      )}
    </div>
  );
  return (
    <Section title="Entry funnel" note={`Anonymous visitors before they have an account (session only). The contact form now comes at Unlock, after the free questions. After "Visits", only sessions that tapped without an account yet are counted; ${num(entry.tapped_with_account)} returning browser${entry.tapped_with_account === 1 ? '' : 's'} skipped the form and are left out.${entry.old_flow_sessions ? ` ${num(entry.old_flow_sessions)} earlier session${entry.old_flow_sessions === 1 ? '' : 's'} saw the form before question 1 (the old order) and are left out too.` : ''}`}>
      <div style={{ display: 'grid', gap: 6, marginBottom: 14 }}>
        {entry.steps.map((s) => (
          <div key={s.step} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 170px) 1fr', gap: 10, alignItems: 'center', fontSize: '13px' }}>
            <span>{ENTRY_LABEL[s.step]}<NotLive show={s.step !== 'visits' && notLive.has(s.event)} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ height: 18, borderRadius: 5, background: '#F3EEE8', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(s.count / max) * 100}%`, background: s.step === 'visits' ? NAVY : ORANGE }} />
              </div>
              <div style={{ fontSize: '12px', color: GREY, marginTop: 2 }}>
                <b style={{ color: NAVY }}>{num(s.count)}</b> sessions
                {s.step !== 'visits' && <> · {pct(s.of_previous)} of previous · {pct(s.of_visits)} of visits</>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p style={{ margin: '0 0 6px', fontSize: '14px' }}>
        Saw the form but left without finishing: <b>{num(entry.left_form_unfinished.count)}</b> ({pct(entry.left_form_unfinished.pct)})
      </p>
      <p style={{ margin: '0 0 14px', fontSize: '14px' }}>
        Filled the form and saw the paywall: <b>{num(entry.finished_and_saw_paywall.count)}</b> ({pct(entry.finished_and_saw_paywall.pct)})
      </p>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {split(entry.by_source, 'button')}
        {split(entry.by_device, 'device')}
      </div>
    </Section>
  );
};

/* ---------------- stage cards ---------------- */
const Stage = ({ step, title, value, valueNote, lines }) => (
  <div style={{ ...card, marginBottom: 0, flex: '1 1 200px', borderTop: `4px solid ${step === 3 ? ORANGE : NAVY}` }}>
    <div style={{ fontSize: '11.5px', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: ORANGE_TEXT }}>
      {step}. {title}
    </div>
    <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 800, color: NAVY, lineHeight: 1.1, margin: '6px 0 2px' }}>{value}</div>
    <div style={{ fontSize: '12.5px', color: GREY, marginBottom: 10 }}>{valueNote}</div>
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: '12.5px', color: NAVY, lineHeight: 1.6 }}>
      {lines.filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}
    </ul>
  </div>
);
const Arrow = ({ value }) => (
  <div className="pilot-arrow" aria-hidden="true">
    <span>{'→'}</span><small>{pct(value)}</small>
  </div>
);

const Bar = ({ value, max, color, label }) => (
  <div title={label} style={{ width: 8, height: `${max ? Math.max((value / max) * 100, value ? 3 : 0) : 0}%`, background: color, borderRadius: '3px 3px 0 0' }} />
);

const PilotReport = () => {
  const [preset, setPreset] = useState('pilot');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [includeTest, setIncludeTest] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('city');

  const params = useMemo(() => {
    const p = { include_test: includeTest };
    if (preset === 'custom') { if (start) p.start = start; if (end) p.end = end; }
    else if (preset !== 'pilot') p.days = preset;
    return p;
  }, [preset, start, end, includeTest]);

  const auth = () => {
    let token = '';
    try { token = localStorage.getItem('pb_token') || ''; } catch { /* storage blocked */ }
    return { Authorization: `Bearer ${token}` };
  };

  // Refresh bumps this; a changed range or toggle changes `params`. Either way
  // the effect below asks again. `loading` starts true and Refresh sets it.
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    axios.get(`${API_URL}/api/funnel/pilot-report`, { params, headers: auth() })
      .then(({ data: d }) => { if (!cancelled) { setData(d); setError(''); } })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.status === 403 || err?.response?.status === 401
          ? 'This needs an administrator sign-in.' : 'Couldn’t load the pilot report. Is the API running?');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [params, reloadKey]);

  const downloadCsv = async () => {
    try {
      const { data: blob } = await axios.get(`${API_URL}/api/funnel/pilot-export.csv`, { params, responseType: 'blob', headers: auth() });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'paw-buddy-pilot.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Couldn’t download the CSV.');
    }
  };

  const header = (
    <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {data && (() => {
        const m = MODE_STYLE[data.paywall_mode] || MODE_STYLE.off;
        return <span style={{ background: m.bg, color: m.fg, fontWeight: 800, fontSize: '12px', padding: '6px 12px', borderRadius: 20 }}>{m.text}</span>;
      })()}
      {PRESETS.map((p) => (
        <button key={p.id} type="button" style={chip(preset === p.id)} onClick={() => setPreset(p.id)}>{p.label}</button>
      ))}
      <button type="button" style={chip(preset === 'custom')} onClick={() => setPreset('custom')}>Custom</button>
      {preset === 'custom' && (
        <>
          <input type="date" aria-label="From" value={start} onChange={(e) => setStart(e.target.value)} style={{ padding: '7px 10px', borderRadius: 10, border: `1px solid ${PEACH}`, fontFamily: 'inherit' }} />
          <input type="date" aria-label="To" value={end} onChange={(e) => setEnd(e.target.value)} style={{ padding: '7px 10px', borderRadius: 10, border: `1px solid ${PEACH}`, fontFamily: 'inherit' }} />
        </>
      )}
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '12.5px', color: NAVY, minHeight: 36 }}>
        <input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} />
        Include test and internal data
      </label>
      <span style={{ flex: 1 }} />
      <button type="button" style={chip(false)} onClick={downloadCsv}>Download CSV</button>
      <button type="button" style={chip(false)} onClick={() => { setLoading(true); setReloadKey((k) => k + 1); }} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      {data && (
        <span style={{ fontSize: '12px', color: GREY, width: '100%' }}>
          {data.range.start} to {data.range.end}{data.range.pilot_window ? ' (pilot window)' : ''} · updated{' '}
          {new Date(data.generated_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
          {data.include_test ? ' · including test and internal data' : ''}
        </span>
      )}
    </div>
  );

  if (loading && !data) return <div>{header}<div style={{ ...card, color: GREY }}>Loading the pilot report…</div></div>;
  if (error && !data) return <div>{header}<div style={{ ...card, color: '#B3261E' }}>{error}</div></div>;
  if (!data) return header;

  const { stages: s, targets: t, health: h } = data;
  const notLive = new Set(h.not_live_yet);
  const fakeDoor = data.paywall_mode === 'fake_door';
  const unlockedWord = fakeDoor ? 'tapped Pay' : data.paywall_mode === 'off' ? 'signed in' : 'paid';
  /* The Action card's wording follows the mode: nobody "paid" in fake-door mode. */
  const a = s.action;
  const actionNote = data.paywall_mode === 'off'
    ? `of ${num(a.unlocked_people)} signed-in people (paywall off) saw their full results`
    : fakeDoor
      ? `of ${num(a.unlocked_people)} people who tapped Pay saw their full results (no money taken)`
      : a.unlocked_people > a.real_paid_people
        ? `of ${num(a.unlocked_people)} people who unlocked (${num(a.real_paid_people)} paid, the rest tapped Pay in fake-door days) saw their full results`
        : `of ${num(a.unlocked_people)} paying people saw their full results`;
  const money = s.money;
  const breakdownKeys = [['city', 'City'], ['age_range', 'Age range'], ['channel', 'Channel'], ['device', 'Device'], ['top_breed', 'Top breed']];
  const maxDaily = Math.max(0, ...data.daily.map((d) => d.visits));
  const freeScreens = FREE_SCREEN_IDS.length;

  return (
    <div style={{ fontFamily: 'var(--font-body-family)', color: NAVY }}>
      <style>{`
        .pilot-stages { display: flex; align-items: stretch; gap: 8px; margin-bottom: 18px; }
        .pilot-arrow { display: flex; flex-direction: column; align-items: center; justify-content: center; color: #9CA3AF; min-width: 44px; }
        .pilot-arrow span { font-size: 22px; line-height: 1; }
        .pilot-arrow small { font-size: 11.5px; font-weight: 700; color: ${GREY}; }
        @media (max-width: 900px) {
          .pilot-stages { flex-direction: column; }
          .pilot-arrow { flex-direction: row; gap: 6px; min-height: 28px; }
          .pilot-arrow span { transform: rotate(90deg); }
        }
      `}</style>

      {header}
      {error && <div style={{ ...card, color: '#B3261E', padding: '10px 18px' }}>{error}</div>}

      {/* ---------------- 2. four stages ---------------- */}
      <div className="pilot-stages">
        <Stage step={1} title="Reach" value={num(s.reach.visits)} valueNote="sessions that visited"
          lines={[`Left straight away: ${ofText(s.reach.bounced)}`]} />
        <Arrow value={share(s.free.rough_rec_viewed.count, s.reach.visits)} />
        <Stage step={2} title="Free engine" value={num(s.free.rough_rec_viewed.count)} valueNote="sessions that saw the instant (rough) recommendation"
          lines={[
            <>Quiz started: {ofText(s.free.quiz_started)}</>,
            <>Finished the free questions: {ofText(s.free.free_part_completed)}<NotLive show={notLive.has('free_part_completed')} /></>,
            <>Gave a contact number (at Unlock): <b>{num(s.free.signed_in_people)}</b> people ({num(s.free.unique_numbers_unverified)} unique numbers, <i>unverified</i>)<NotLive show={notLive.has('login_completed')} /></>,
          ]} />
        <Arrow value={money.paywall_viewed.pct} />
        <Stage step={3} title="Money"
          value={fakeDoor ? num(money.intent_people) : num(money.paid_people)}
          valueNote={fakeDoor ? 'people tapped Pay (fake door: no money taken)' : 'people paid (from the payments table)'}
          lines={[
            fakeDoor
              ? <>Would-be revenue: <b>{rupees(money.would_be_rupees)}</b> · real revenue {rupees(money.revenue_rupees)}</>
              : <>Revenue: <b>{rupees(money.revenue_rupees)}</b>{money.intent_people ? ` · plus ${num(money.intent_people)} fake-door taps` : ''}</>,
            <>Paid or tapped Pay, of paywall viewers: {ofText(money.payers)}</>,
            <>Paywall viewed: {num(money.paywall_viewed.count)} sessions · unlock taps {num(money.paywall_cta_clicked.count)}<NotLive show={notLive.has('paywall_viewed')} /></>,
            <>Checkout opened {num(money.payment_started.count)} · closed {num(money.payment_dismissed)} · failed {num(money.payment_failed)}</>,
            <>Average time to pay: {money.avg_minutes_to_pay == null ? '—' : `${num(money.avg_minutes_to_pay)} min`} · refunds {num(money.refunds)}<NotLive show={!money.refunds} /></>,
          ]} />
        <Arrow value={s.action.unlocked.results_viewed.pct} />
        <Stage step={4} title="Action" value={num(s.action.unlocked.results_viewed.count)} valueNote={actionNote}
          lines={[
            <>Finished the full quiz: {ofText(s.action.unlocked.quiz_completed)}</>,
            <>Call button taps: {num(s.action.unlocked.breeder_call_clicked.count)} {unlockedWord} · {num(s.action.unpaid.breeder_call_clicked.count)} did not unlock<NotLive show={notLive.has('breeder_call_clicked')} /></>,
            <>WhatsApp taps: {num(s.action.unlocked.breeder_whatsapp_opened.count)} {unlockedWord} · {num(s.action.unpaid.breeder_whatsapp_opened.count)} did not unlock</>,
          ]} />
      </div>
      <p style={{ ...sub, marginTop: -8 }}>
        Stages 1 and 2 count <b>sessions</b> (one browser visit). Money and Action count <b>signed-in people</b>, because one
        person can have two sessions. Mobile numbers are <b>unverified</b>: a sign-up is a number someone typed.
      </p>

      {/* ---------------- 2b. entry funnel ---------------- */}
      {data.entry && <EntryFunnel entry={data.entry} notLive={notLive} />}

      {/* ---------------- 3. targets ---------------- */}
      <Section title="Targets" note={`Pilot window ${t.pilot_start} to ${t.pilot_end} · ${num(t.days_left)} day${t.days_left === 1 ? '' : 's'} left`}>
        {[['Signed-in people (unverified numbers)', t.signups], [fakeDoor ? 'People who tapped Pay' : 'Paying people', t.payers]].map(([label, x]) => (
          <div key={label} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: 4 }}>
              <span>{label}</span>
              <b>{num(x.count)}{x.target ? ` of ${num(x.target)} (${pct(share(x.count, x.target))})` : ''}</b>
            </div>
            {x.target ? (
              <div style={{ height: 10, borderRadius: 6, background: '#F3EEE8', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(share(x.count, x.target) || 0, 100)}%`, background: ORANGE }} />
              </div>
            ) : <span style={{ fontSize: '12px', color: GREY }}>Set a target: PILOT_TARGET_PAYERS in backend/.env</span>}
          </div>
        ))}
      </Section>

      {/* ---------------- 4. daily chart ---------------- */}
      <Section title="Per day" note="Visits, paywall views and paid (or tapped Pay) per Indian day, by when each session first did it.">
        {maxDaily === 0 ? <p style={{ ...sub, margin: 0 }}>No visits in this range yet.</p> : (
          <Scroll>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 150, minWidth: data.daily.length * 34, padding: '0 4px' }}>
              {data.daily.map((d) => (
                <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', flex: '0 0 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, flex: 1 }}>
                    <Bar value={d.visits} max={maxDaily} color={NAVY} label={`${d.date}: ${d.visits} visits`} />
                    <Bar value={d.paywall_viewed} max={maxDaily} color={PEACH} label={`${d.date}: ${d.paywall_viewed} paywall views`} />
                    <Bar value={d.paid} max={maxDaily} color={ORANGE} label={`${d.date}: ${d.paid} paid`} />
                  </div>
                  <span style={{ fontSize: '10px', color: GREY }}>{d.date.slice(8)}</span>
                </div>
              ))}
            </div>
          </Scroll>
        )}
        <div style={{ display: 'flex', gap: 14, fontSize: '12px', color: GREY, marginTop: 8, flexWrap: 'wrap' }}>
          {[[NAVY, 'Visits'], [PEACH, 'Paywall views'], [ORANGE, fakeDoor ? 'Tapped Pay' : 'Paid']].map(([c, l]) => (
            <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{l}</span>
          ))}
        </div>
      </Section>

      {/* ---------------- 5. per reel ---------------- */}
      <Section title="Per reel / campaign" note="A reel with under 30 visits is noise. Do not decide on it. (Also hidden: under 5 paywall views.) Click a column to sort.">
        <BreakdownTable rows={data.reels} keyLabel="Campaign / reel" />
      </Section>

      {/* ---------------- 6. breakdown tabs ---------------- */}
      <div style={card}>
        <div role="tablist" aria-label="Breakdown" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {breakdownKeys.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} style={chip(tab === k)} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        <BreakdownTable
          rows={data.breakdowns[tab] || []}
          keyLabel={breakdownKeys.find(([k]) => k === tab)[1]}
          labelFor={tab === 'age_range' ? (k) => AGE_LABEL[k] || k : undefined}
        />
      </div>

      {/* ---------------- 7. drop-off ---------------- */}
      <Section title="Drop-off by question" note={`Sessions that saw each quiz screen and how many answered it. The paywall sits after screen ${freeScreens}.`}>
        {data.dropoff.length === 0 ? <p style={{ ...sub, margin: 0 }}>No question activity in this range yet.</p> : (
          <Scroll>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <thead><tr>{['#', 'Screen', 'Saw it', 'Answered', 'Dropped', 'Drop rate'].map((x) => <th key={x} style={th}>{x}</th>)}</tr></thead>
              <tbody>
                {data.dropoff.flatMap((q) => {
                  const row = (
                    <tr key={q.q_index}>
                      <td style={td}>{q.q_index + 1}</td><td style={td}>{q.q_id || '—'}</td>
                      <td style={td}>{num(q.viewed)}</td><td style={td}>{num(q.answered)}</td>
                      <td style={td}>{num(q.dropped)}</td>
                      <td style={{ ...td, fontWeight: 700, color: q.drop_rate > 20 ? '#B3261E' : NAVY }}>{pct(q.drop_rate)}</td>
                    </tr>
                  );
                  return q.q_index === freeScreens - 1
                    ? [row, <tr key="paywall"><td colSpan={6} style={{ padding: '4px 10px', borderTop: `3px solid ${ORANGE}`, fontSize: '11.5px', fontWeight: 800, color: ORANGE_TEXT }}>Paywall here</td></tr>]
                    : [row];
                })}
              </tbody>
            </table>
          </Scroll>
        )}
      </Section>

      {/* ---------------- 8. breeders ---------------- */}
      <Section title="Breeder taps" note={`Call button taps and WhatsApp taps, once per breeder per session. A tap is not a conversation. Each cell: sessions (${unlockedWord} / did not).`}>
        <h4 style={{ margin: '0 0 6px', fontSize: '14px' }}>By breeder</h4>
        {data.breeders.by_breeder.length === 0 ? <p style={{ ...sub, margin: '0 0 14px' }}>No taps yet.<NotLive show={notLive.has('breeder_call_clicked') && notLive.has('breeder_whatsapp_opened')} /></p> : (
          <Scroll>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640, marginBottom: 14 }}>
              <thead><tr>{['Breeder', 'Breed(s)', 'City', 'Call taps', 'WhatsApp taps', 'Total'].map((x) => <th key={x} style={th}>{x}</th>)}</tr></thead>
              <tbody>
                {data.breeders.by_breeder.map((r) => {
                  const known = BREEDER_BY_ID[r.key];
                  const name = r.name || known?.name;
                  return (
                    <tr key={r.key}>
                      <td style={{ ...td, fontWeight: 700, color: name ? NAVY : GREY }}>{name || r.key}</td>
                      <td style={td}>{r.breeds.join(', ') || '—'}</td>
                      <td style={td}>{known?.city || '—'}</td>
                      <td style={td}><TapCell t={r.call} /></td>
                      <td style={td}><TapCell t={r.whatsapp} /></td>
                      <td style={{ ...td, fontWeight: 700 }}><TapCell t={r.total} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Scroll>
        )}
        {[['by_breed', 'Breed'], ['by_source', 'Opened from']].map(([k, label]) => (data.breeders[k].length ? (
          <div key={k} style={{ marginBottom: 14 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '14px' }}>By {label.toLowerCase()} (top 10)</h4>
            <Scroll>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                <thead><tr>{[label, 'Call taps', 'WhatsApp taps', 'Total', ...(k === 'by_breed' ? ['Most-tapped breeder'] : [])].map((x) => <th key={x} style={th}>{x}</th>)}</tr></thead>
                <tbody>
                  {data.breeders[k].map((r) => (
                    <tr key={r.key}>
                      <td style={{ ...td, fontWeight: 700 }}>{r.key}</td>
                      <td style={td}><TapCell t={r.call} /></td>
                      <td style={td}><TapCell t={r.whatsapp} /></td>
                      <td style={{ ...td, fontWeight: 700 }}><TapCell t={r.total} /></td>
                      {k === 'by_breed' && (
                        <td style={td}>
                          {r.top_breeder.name || BREEDER_BY_ID[r.top_breeder.key]?.name || r.top_breeder.key} ({num(r.top_breeder.sessions)})
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroll>
          </div>
        ) : null))}
      </Section>

      {/* ---------------- 9. health ---------------- */}
      <div style={{ ...card, background: h.mismatch.flag || h.rejected_events ? '#FFF6E5' : 'white', border: h.mismatch.flag ? '1px solid #F0C36D' : '1px solid transparent' }}>
        <h3 style={h3}>Tracking health</h3>
        {h.mismatch.flag && (
          <p style={{ ...sub, color: '#8A5A00', fontWeight: 700 }}>
            Tracking mismatch: {num(h.mismatch.payment_success_event_people)} people have a payment_success event but the
            payments table has {num(h.mismatch.paid_in_database_people)} paid. The payments table is the truth; check the events.
          </p>
        )}
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: '12.5px', marginBottom: 10 }}>
          <span>Events in last 24h: <b>{num(h.events_last_24h)}</b></span>
          <span>Rejected events: <b>{num(h.rejected_events)}</b>{h.last_rejected ? ` (last: ${h.last_rejected}, ${h.last_rejected_reason || ''})` : ''}</span>
          <span>Test/internal sessions excluded: <b>{num(h.excluded_sessions)}</b></span>
          <span>Internal numbers configured: <b>{num(h.internal_numbers_configured)}</b></span>
          <span>Report took {num(data.took_ms)} ms</span>
        </div>
        {h.not_live_yet.length > 0 && (
          <p style={{ ...sub, margin: '0 0 8px' }}>Not live yet (never seen): {h.not_live_yet.join(', ')}</p>
        )}
        {h.events_last_24h_by_name.length > 0 && (
          <p style={{ ...sub, margin: 0 }}>
            Last 24h: {h.events_last_24h_by_name.slice(0, 12).map((e) => `${e.event} ${num(e.count)}`).join(' · ')}
          </p>
        )}
      </div>

      {/* ---------------- 10. what people told us ---------------- */}
      <PulseSummaryCard days={null} start={data.range.start} end={data.range.end} />
    </div>
  );
};

export default PilotReport;
