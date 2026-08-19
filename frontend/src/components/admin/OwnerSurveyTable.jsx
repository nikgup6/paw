import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

/* Existing Dog Owner survey responses — one row per submission.

   Added as a tab inside the existing admin dashboard rather than as a separate
   view, so there is still one place to look at everything the product collects.

   Answers are stored as codes and rendered as the wording the owner actually
   read; the same translation happens server-side for the CSV, so the table and
   the spreadsheet can't disagree. */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const LABELS = {
  tenure: {
    lt_6_months: 'Less than 6 months', '6_12_months': '6 months – 1 year',
    '1_3_years': '1 – 3 years', '3_plus_years': '3+ years',
  },
  living_situation: {
    apt_no_outdoor: 'Apartment, no balcony/yard',
    apt_balcony_or_shared: 'Apartment, balcony/shared yard',
    house_no_yard: 'House, no yard', house_with_yard: 'House, with yard',
  },
  hours_alone: {
    lt_2: 'Less than 2 hrs', '2_5': '2 – 5 hrs', '5_8': '5 – 8 hrs', '8_plus': '8+ hrs',
  },
  biggest_challenge: {
    grooming: 'Grooming & maintenance', energy: 'Energy & exercise',
    health: 'Health issues', training: 'Training & behavior',
  },
  would_recommend: { yes: 'Yes', no: 'No', depends: 'Depends' },
};

const label = (field, value) => LABELS[field]?.[value] ?? (value || '—');

/* Q7 is multi-select — value is a list of codes (or, for rows written before
   multi-select shipped, a single string; the server normalizes those to a
   one-item list, but this stays tolerant either way). */
const labelList = (field, value) => {
  const codes = Array.isArray(value) ? value : (value ? [value] : []);
  return codes.length ? codes.map((c) => LABELS[field]?.[c] ?? c).join(', ') : '—';
};

const RECOMMEND_COLOR = { yes: '#1B8046', no: '#C62828', depends: '#9A6B1F' };

const th = {
  textAlign: 'left', padding: '9px 10px', fontSize: '11px', textTransform: 'uppercase',
  letterSpacing: '.05em', color: 'var(--text-soft)', borderBottom: '1px solid #EFE6DC',
  whiteSpace: 'nowrap',
};
const td = {
  padding: '9px 10px', fontSize: '13px', color: 'var(--brown)',
  borderBottom: '1px solid #F6F1EB', fontFamily: 'var(--font-body-family)', verticalAlign: 'top',
};

const stamp = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
}) : '—');

const OwnerSurveyTable = () => {
  const [data, setData] = useState({ stats: {}, responses: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [breed, setBreed] = useState('');
  const [city, setCity] = useState('');

  const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('pb_token') || ''}` } });

  const load = useCallback(async (filters) => {
    try {
      const { data: res } = await axios.get(`${API_URL}/api/owner-survey/responses`, {
        ...auth(),
        params: { breed: filters?.breed || undefined, city: filters?.city || undefined },
      });
      setData(res);
      setError('');
    } catch (e) {
      setError(e?.response?.status === 401 || e?.response?.status === 403
        ? 'Your administrator session has expired. Please sign in again.'
        : 'Couldn’t load survey responses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Debounced so typing a breed name doesn't fire a request per keystroke. */
  useEffect(() => {
    const timer = setTimeout(() => load({ breed, city }), 350);
    return () => clearTimeout(timer);
  }, [breed, city, load]);

  /* The export is admin-gated, so it can't be a plain <a href> — the browser
     wouldn't send the token. Fetch it with the header, then hand the blob to a
     synthetic link. */
  const downloadCsv = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/owner-survey/export.csv`, {
        ...auth(), responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `paw-buddy-owner-surveys-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Couldn’t download the CSV.');
    }
  };

  if (loading) {
    return <div style={{ background: 'white', padding: '30px', borderRadius: '20px' }}>Loading responses…</div>;
  }

  const { stats, responses } = data;

  return (
    <div style={{ background: 'white', padding: '30px', borderRadius: '20px', boxShadow: 'var(--shadow)', minHeight: '500px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '6px' }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--brown)' }}>Existing Dog Owner survey</h3>
          <p style={{ color: 'var(--text-soft)', margin: '5px 0 0' }}>
            {stats.total || 0} response{stats.total === 1 ? '' : 's'}
            {stats.top_breed && <> · most common breed: <strong>{stats.top_breed}</strong></>}
            {stats.avg_satisfaction && <> · avg satisfaction: <strong>{stats.avg_satisfaction}/5</strong></>}
          </p>
        </div>
        <button
          onClick={downloadCsv}
          style={{
            padding: '9px 18px', borderRadius: '50px', border: 'none', background: 'var(--orange)',
            color: 'white', fontWeight: 700, fontFamily: 'inherit', fontSize: '13px', cursor: 'pointer',
          }}
        >
          ⤓ Download CSV
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', margin: '16px 0 20px' }}>
        <input
          value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="Filter by breed…"
          style={{ padding: '9px 14px', borderRadius: '10px', border: '1px solid #E3D9CE', fontFamily: 'inherit', fontSize: '13px', flex: '1 1 180px' }}
        />
        <input
          value={city} onChange={(e) => setCity(e.target.value)} placeholder="Filter by city…"
          style={{ padding: '9px 14px', borderRadius: '10px', border: '1px solid #E3D9CE', fontFamily: 'inherit', fontSize: '13px', flex: '1 1 180px' }}
        />
        {(breed || city) && (
          <button onClick={() => { setBreed(''); setCity(''); }}
            style={{ border: 'none', background: 'none', color: 'var(--orange)', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
            Clear
          </button>
        )}
      </div>

      {error && (
        <p style={{ background: '#FFF5F5', border: '1px solid #F2C9C9', color: '#B23B3B', padding: '11px 14px', borderRadius: '12px', fontSize: '13px' }}>
          {error}
        </p>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
          <thead>
            <tr>
              <th style={th}>Respondent</th>
              <th style={th}>Submitted</th>
              <th style={th}>Q1 Breed</th>
              <th style={th}>Q2 City</th>
              <th style={th}>Q3 Owned for</th>
              <th style={th}>Q4 Living</th>
              <th style={th}>Q5 Alone</th>
              <th style={th}>Q6 Rating</th>
              <th style={th}>Q7 Challenge</th>
              <th style={th}>Q8 Recommend</th>
            </tr>
          </thead>
          <tbody>
            {responses.length === 0 ? (
              <tr><td colSpan="10" style={{ ...td, textAlign: 'center', padding: '40px 0', color: 'var(--text-soft)' }}>
                No responses yet.
              </td></tr>
            ) : responses.map((r) => (
              <tr key={r.id}>
                <td style={{ ...td, fontWeight: 700, whiteSpace: 'nowrap' }}>{r.respondent_label}</td>
                <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text-soft)' }}>{stamp(r.created_at)}</td>
                <td style={{ ...td, fontWeight: 600 }}>{r.breed}</td>
                <td style={td}>
                  {String(r.city).startsWith('zone:') ? <em style={{ color: 'var(--text-soft)' }}>{r.city.slice(5)}</em> : r.city}
                </td>
                <td style={td}>{label('tenure', r.tenure)}</td>
                <td style={td}>{label('living_situation', r.living_situation)}</td>
                <td style={td}>{label('hours_alone', r.hours_alone)}</td>
                <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--orange)', fontWeight: 700 }}>
                  {'🐾'.repeat(r.satisfaction || 0)} <span style={{ color: 'var(--text-soft)', fontWeight: 400 }}>{r.satisfaction}/5</span>
                </td>
                <td style={td}>{labelList('biggest_challenge', r.biggest_challenge)}</td>
                <td style={td}>
                  <span style={{ fontWeight: 700, color: RECOMMEND_COLOR[r.would_recommend] || 'var(--brown)' }}>
                    {label('would_recommend', r.would_recommend)}
                  </span>
                  {r.recommend_note && (
                    <div style={{ color: 'var(--text-soft)', fontSize: '12px', marginTop: '3px', maxWidth: '220px' }}>
                      “{r.recommend_note}”
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OwnerSurveyTable;
