import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

/* The acquisition funnel, read from the events log and the quiz_progress rows.

   Every number is a count of DISTINCT SESSIONS, computed server-side in one
   request. Six separate fetches could land in six different states, and a
   funnel whose steps disagree with each other is worse than no funnel.

   Desktop only, deliberately — this is a page you sit down with. */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const STEP_LABELS = {
  quiz_started: 'Started',
  quiz_completed: 'Completed',
  results_viewed: 'Results viewed',
  breeder_cta_clicked: 'Breeder CTA',
  contact_submitted: 'Contacted',
};

/* Keyed by readiness code. Ready Now is the hottest colour and the ramp cools
   with the rank, so the section reads at a glance without reading the labels.
   The LABELS themselves never live here — they come from readiness_levels. */
const READINESS_COLOR = {
  ready_now: '#C62828', ready_soon: '#E35D18', planning: '#2F7FB8', researching: '#7A6A5C',
};
const colorFor = (code) => READINESS_COLOR[code] || '#B9AA9C';

const PRESETS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

const card = {
  background: 'white', borderRadius: '16px', padding: '20px',
  boxShadow: 'var(--shadow, 0 4px 20px rgba(0,0,0,.06))', marginBottom: '20px',
};
const h3 = { fontFamily: 'var(--font-display)', color: 'var(--brown)', margin: '0 0 4px', fontSize: '17px', fontWeight: 'var(--weight-semibold)' };
const sub = { color: 'var(--text-soft)', margin: '0 0 16px', fontSize: '13px', fontFamily: 'var(--font-body-family)' };
const th = {
  textAlign: 'left', padding: '9px 10px', fontSize: '11px', textTransform: 'uppercase',
  letterSpacing: '.05em', color: 'var(--text-soft)', borderBottom: '1px solid #EFE6DC', whiteSpace: 'nowrap',
};
const td = {
  padding: '9px 10px', fontSize: '13px', color: 'var(--brown)',
  borderBottom: '1px solid #F6F1EB', fontFamily: 'var(--font-body-family)',
};

const ago = (iso) => {
  if (!iso) return '—';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};

const stamp = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
}) : '—');

const FunnelReport = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = start || end ? { start: start || undefined, end: end || undefined } : { days };
      const { data } = await axios.get(`${API_URL}/api/funnel/report`, { params });
      setReport(data);
      setError('');
    } catch {
      setError('Couldn’t load the funnel. Is the API running?');
    } finally {
      setLoading(false);
    }
  }, [days, start, end]);

  useEffect(() => { load(); }, [load]);

  if (loading && !report) {
    return <div style={{ ...card, color: 'var(--text-soft)' }}>Loading funnel…</div>;
  }
  if (error) {
    return (
      <div style={{ ...card, color: '#B23B3B' }}>
        {error}
        <button onClick={load} style={{ marginLeft: 12, padding: '6px 14px', borderRadius: 50, border: '1px solid #E3D9CE', background: 'white', cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }

  const { funnel, dropoff, readiness, abandoned, completions, cta_rate: cta } = report;
  const readinessTotal = readiness.reduce((sum, r) => sum + r.count, 0);
  const custom = Boolean(start || end);

  return (
    <div style={{ marginBottom: '34px', fontFamily: 'var(--font-body-family)' }}>

      {/* ---------------------------- range picker --------------------------- */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <strong style={{ color: 'var(--brown)', fontSize: '14px' }}>Acquisition funnel</strong>
        <span style={{ flex: 1 }} />
        {PRESETS.map((p) => (
          <button
            key={p.days}
            onClick={() => { setStart(''); setEnd(''); setDays(p.days); }}
            style={{
              padding: '7px 14px', borderRadius: '50px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700,
              border: 'none', fontFamily: 'inherit',
              background: !custom && days === p.days ? 'var(--orange)' : 'white',
              color: !custom && days === p.days ? 'white' : 'var(--text-soft)',
              boxShadow: 'var(--shadow, 0 2px 8px rgba(0,0,0,.06))',
            }}
          >
            {p.label}
          </button>
        ))}
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ padding: '7px 10px', borderRadius: '10px', border: '1px solid #E3D9CE', fontFamily: 'inherit', fontSize: '12.5px' }} />
        <span style={{ color: 'var(--text-soft)', fontSize: '12px' }}>to</span>
        <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={{ padding: '7px 10px', borderRadius: '10px', border: '1px solid #E3D9CE', fontFamily: 'inherit', fontSize: '12.5px' }} />
        {custom && (
          <button onClick={() => { setStart(''); setEnd(''); }} style={{ border: 'none', background: 'none', color: 'var(--orange)', fontWeight: 700, cursor: 'pointer', fontSize: '12.5px' }}>
            Clear
          </button>
        )}
      </div>

      {/* -------------------------- 1. the funnel ---------------------------- */}
      <div style={card}>
        <h3 style={h3}>Funnel</h3>
        <p style={sub}>Distinct sessions at each step. The percentage is conversion from the step before it.</p>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '4px', flexWrap: 'nowrap', overflowX: 'auto' }}>
          {funnel.map((step, i) => (
            <div key={step.event} style={{ display: 'flex', alignItems: 'center', flex: '1 1 0', minWidth: 0 }}>
              <div style={{
                flex: 1, minWidth: '120px', padding: '16px 14px', borderRadius: '14px',
                background: i === 0 ? 'var(--orange-pale, #FDF1E8)' : '#FBF7F2',
                border: '1px solid #EFE6DC',
              }}>
                <div style={{ fontFamily: 'var(--font-accent)', fontSize: '30px', fontWeight: 800, color: 'var(--brown)', lineHeight: 1.05 }}>{step.count}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-soft)', fontWeight: 700, marginTop: '3px' }}>
                  {STEP_LABELS[step.event]}
                </div>
                {step.from_start != null && i > 0 && (
                  <div style={{ fontSize: '11px', color: 'var(--text-soft)', marginTop: '2px' }}>
                    {step.from_start}% of started
                  </div>
                )}
              </div>
              {i < funnel.length - 1 && (
                <div style={{ padding: '0 6px', textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: funnel[i + 1].from_previous >= 50 ? '#1B8046' : '#C62828' }}>
                    {funnel[i + 1].from_previous == null ? '—' : `${funnel[i + 1].from_previous}%`}
                  </div>
                  <div style={{ color: '#D8CCBE', fontSize: '16px', lineHeight: 1 }}>→</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ------------------- 6. the number that matters most ------------------ */}
      <div style={{
        ...card, borderLeft: '5px solid var(--orange)',
        display: 'flex', alignItems: 'center', gap: '22px', flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-accent)', fontSize: '46px', fontWeight: 800, color: 'var(--orange)', lineHeight: 1 }}>{cta.rate}%</div>
        </div>
        <div style={{ minWidth: '260px' }}>
          <h3 style={{ ...h3, margin: 0 }}>Breeder CTA click rate</h3>
          <p style={{ ...sub, margin: '4px 0 0' }}>
            Of the {cta.results_viewed} sessions that saw a recommendation, {cta.cta_clicked} asked to be
            connected with a breeder. This is the number that says whether the product works.
          </p>
        </div>
      </div>

      {/* --------------------- 2. drop-off by question ----------------------- */}
      <div style={card}>
        <h3 style={h3}>Drop-off by question</h3>
        <p style={sub}>Shown vs answered. The gap is where people quit — and it says which question did it.</p>
        {dropoff.length === 0 ? (
          <p style={{ ...sub, margin: 0 }}>No question activity in this range yet.</p>
        ) : (
          <>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={dropoff.map((d) => ({ ...d, name: `Q${d.q_index + 1} ${d.q_id}` }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0EAE3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="viewed" name="Viewed" fill="#D8CCBE" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="answered" name="Answered" fill="#E35D18" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '14px' }}>
              <thead>
                <tr><th style={th}>#</th><th style={th}>Question</th><th style={th}>Viewed</th><th style={th}>Answered</th><th style={th}>Dropped</th><th style={th}>Drop rate</th></tr>
              </thead>
              <tbody>
                {dropoff.map((d) => (
                  <tr key={d.q_index}>
                    <td style={td}>Q{d.q_index + 1}</td>
                    <td style={td}>{d.q_id}</td>
                    <td style={td}>{d.viewed}</td>
                    <td style={td}>{d.answered}</td>
                    <td style={td}>{d.dropped}</td>
                    <td style={{ ...td, color: d.drop_rate >= 25 ? '#C62828' : 'var(--brown)', fontWeight: d.drop_rate >= 25 ? 700 : 400 }}>
                      {d.drop_rate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* ---------------------- 3. readiness breakdown ----------------------- */}
      <div style={card}>
        <h3 style={h3}>Readiness breakdown</h3>
        <p style={sub}>
          Completed quizzes by how soon they said they’re bringing a dog home, Ready Now first.
          This is the table to screenshot for a breeder conversation.
        </p>
        {readinessTotal === 0 ? (
          <p style={{ ...sub, margin: 0 }}>No completed quizzes in this range yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {readiness.map((level) => (
                <tr key={level.code || 'unanswered'}>
                  <td style={{ ...td, width: '150px', fontWeight: 700 }} title={level.description || ''}>
                    <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: colorFor(level.code), marginRight: 8 }} />
                    {level.label}
                  </td>
                  <td style={{ ...td, width: '60px' }}>{level.count}</td>
                  <td style={{ ...td, width: '60px', color: 'var(--text-soft)' }}>{level.share}%</td>
                  <td style={td}>
                    <div style={{ background: '#F4EEE7', borderRadius: 5, height: 10, overflow: 'hidden' }}>
                      <div style={{ width: `${level.share}%`, background: colorFor(level.code), height: '100%' }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ---------------------- 4. abandoned sessions ------------------------ */}
      <div style={card}>
        <h3 style={h3}>In progress / abandoned <span style={{ fontSize: '13px', color: 'var(--text-soft)', fontWeight: 400 }}>({abandoned.length})</span></h3>
        <p style={sub}>
          Started the quiz, never finished, quiet for over an hour. Not date-filtered — someone who
          dropped out weeks ago is still someone we can see. These are the people we used to lose entirely.
        </p>
        {abandoned.length === 0 ? (
          <p style={{ ...sub, margin: 0 }}>Nobody stuck mid-quiz.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th style={th}>Session</th><th style={th}>Reached</th><th style={th}>Readiness</th><th style={th}>Answers so far</th><th style={th}>City</th><th style={th}>Started</th><th style={th}>Idle</th></tr>
            </thead>
            <tbody>
              {abandoned.map((row) => (
                <tr key={row.session_id}>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: '11.5px' }}>{String(row.session_id).slice(0, 8)}</td>
                  <td style={td}>Q{(row.current_question ?? 0) + 1}</td>
                  {/* Somebody who answered the timeline question and THEN quit
                      is still a usable signal — arguably the best one here. */}
                  <td style={td}>
                    {row.readiness_label ? (
                      <span style={{
                        padding: '2px 9px', borderRadius: 20, fontSize: '11px', fontWeight: 800,
                        color: 'white', background: colorFor(row.readiness_code),
                      }}>
                        {row.readiness_label}
                      </span>
                    ) : <span style={{ color: 'var(--text-soft)' }}>—</span>}
                  </td>
                  <td style={{ ...td, maxWidth: '320px' }}>
                    <span style={{ color: 'var(--text-soft)' }}>{row.answered_count} saved · </span>
                    {Object.entries(row.answers || {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ') || '—'}
                  </td>
                  <td style={td}>{row.city || '—'}</td>
                  <td style={td}>{stamp(row.started_at)}</td>
                  <td style={{ ...td, color: 'var(--text-soft)' }}>{row.idle_minutes != null ? ago(row.updated_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ---------------------- 5. recent completions ------------------------ */}
      <div style={card}>
        <h3 style={h3}>Recent completions <span style={{ fontSize: '13px', color: 'var(--text-soft)', fontWeight: 400 }}>({completions.length})</span></h3>
        <p style={sub}>Finished quizzes, newest first. This is the table you show a breeder as proof of demand.</p>
        {completions.length === 0 ? (
          <p style={{ ...sub, margin: 0 }}>No completions in this range yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th style={th}>When</th><th style={th}>Top breed</th><th style={th}>City</th><th style={th}>Readiness</th><th style={th}>Timeline</th><th style={th}>Clicked breeder</th></tr>
            </thead>
            <tbody>
              {completions.map((row) => (
                <tr key={row.session_id}>
                  <td style={td}>{stamp(row.updated_at)}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{row.top_breed || '—'}</td>
                  <td style={td}>{row.city || '—'}</td>
                  <td style={td}>
                    {/* The label, never the code — resolved server-side from
                        readiness_levels so it can't drift from the section above. */}
                    <span style={{
                      padding: '2px 9px', borderRadius: 20, fontSize: '11px', fontWeight: 800,
                      color: 'white', background: colorFor(row.readiness_code),
                    }}>
                      {row.readiness_label || 'Not answered'}
                    </span>
                  </td>
                  <td style={{ ...td, color: 'var(--text-soft)' }}>{row.purchase_timeline || '—'}</td>
                  <td style={{ ...td, fontWeight: 700, color: row.breeder_cta_clicked ? '#1B8046' : 'var(--text-soft)' }}>
                    {row.breeder_cta_clicked ? 'Yes' : 'No'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default FunnelReport;
