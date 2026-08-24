import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import FunnelReport from '../components/admin/FunnelReport';
import OwnerSurveyTable from '../components/admin/OwnerSurveyTable';
import CareTipsTable from '../components/admin/CareTipsTable';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/* The five experience-survey questions, in the order they are asked. Short
   column headings; the full question text is the header's tooltip, because a
   table with five sentences across the top is unreadable. */
const EXPERIENCE_COLUMNS = [
  { key: 'reliability', label: 'Worked', full: 'Did everything work as expected?' },
  { key: 'ease_of_use', label: 'Easy', full: 'How easy was it to find and use what you needed?' },
  { key: 'match_accuracy', label: 'Match', full: 'How accurate did your breed match feel?' },
  { key: 'unbiased', label: 'Unbiased', full: 'Did the advice feel unbiased and genuinely helpful?' },
  { key: 'recommend', label: 'Recommend', full: 'How likely to recommend to another first-time owner?' },
];

const th = { padding: '12px 8px', fontWeight: 'var(--weight-semibold)', whiteSpace: 'nowrap' };
const cell = { padding: '12px 8px', fontSize: '13px', verticalAlign: 'top' };

/* A score reads as a number, with colour only as reinforcement — 1-2 is the
   thing worth finding in this table. */
const Score = ({ n }) => {
  const tone = n <= 2 ? '#C62828' : n === 3 ? '#9A6B1F' : '#1B8046';
  const bg = n <= 2 ? '#FDECEC' : n === 3 ? '#FBEFD8' : '#E7F6EC';
  return (
    <span style={{
      display: 'inline-block', minWidth: '24px', textAlign: 'center',
      padding: '3px 7px', borderRadius: '7px', background: bg, color: tone,
      fontWeight: 'var(--weight-bold)', fontSize: '12.5px',
    }}>{n}</span>
  );
};

const ExperienceFeedbackPanel = ({ data, sort, onSort, owner, onOwner, score, onScore }) => {
  const { entries = [], averages = {}, count = 0 } = data || {};
  const input = {
    padding: '8px 12px', borderRadius: '50px', border: '1px solid #EAE4DE',
    fontFamily: 'var(--font-body-family)', fontSize: '13px', outline: 'none',
  };

  /* Clicking a column sorts by it; clicking the active one flips direction. */
  const toggle = (key) => onSort(
    sort.by === key
      ? { by: key, order: sort.order === 'asc' ? 'desc' : 'asc' }
      : { by: key, order: 'asc' },   // ascending first: worst scores to the top
  );
  const arrow = (key) => (sort.by === key ? (sort.order === 'asc' ? ' ▲' : ' ▼') : '');

  return (
    <div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)', marginBottom: '6px', color: 'var(--brown)' }}>
        Experience surveys
      </h3>
      <p style={{ color: 'var(--text-soft)', fontSize: '13px', margin: '0 0 16px' }}>
        The 5-question survey from the app’s “More” menu. Each score is stored separately —
        click a column to sort by that question and find the weak dimension.
      </p>

      {/* Averages across whatever the filter currently selects, so "matching is
          the low one" is visible without reading down the column. */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {EXPERIENCE_COLUMNS.map((c) => (
          <div key={c.key} title={c.full} style={{
            flex: '1 1 120px', background: 'var(--cream)', borderRadius: '12px',
            padding: '10px 12px', border: '1px solid #EFE6DC',
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '3px' }}>{c.label}</div>
            <div style={{ fontFamily: 'var(--font-accent)', fontSize: '21px', color: 'var(--brown)' }}>
              {averages[c.key] == null ? '—' : averages[c.key]}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px', alignItems: 'center' }}>
        <input
          style={{ ...input, flex: '1 1 240px' }}
          value={owner}
          onChange={(e) => onOwner(e.target.value)}
          placeholder="Filter by owner id…"
        />
        <select
          style={input}
          value={score.field}
          onChange={(e) => onScore({ ...score, field: e.target.value })}
        >
          <option value="">Any question…</option>
          {EXPERIENCE_COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.full}</option>)}
        </select>
        <select
          style={input}
          value={score.max}
          onChange={(e) => onScore({ ...score, max: e.target.value })}
          disabled={!score.field}
          title={score.field ? '' : 'Pick a question first'}
        >
          <option value="">scored…</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} or below</option>)}
        </select>
        {(owner || score.field || score.max) && (
          <button
            onClick={() => { onOwner(''); onScore({ field: '', max: '' }); }}
            style={{ ...input, cursor: 'pointer', background: 'white', color: 'var(--orange)', border: '1px solid var(--orange)' }}
          >
            Clear
          </button>
        )}
        <span style={{ color: 'var(--text-soft)', fontSize: '12.5px' }}>{count} shown</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '820px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', color: 'var(--text-soft)' }}>
              <th style={th}>Owner</th>
              {EXPERIENCE_COLUMNS.map((c) => (
                <th
                  key={c.key}
                  style={{ ...th, cursor: 'pointer', color: sort.by === c.key ? 'var(--orange)' : undefined }}
                  title={c.full}
                  onClick={() => toggle(c.key)}
                >
                  {c.label}{arrow(c.key)}
                </th>
              ))}
              <th style={{ ...th, width: '32%' }}>Comment</th>
              <th
                style={{ ...th, cursor: 'pointer', color: sort.by === 'created_at' ? 'var(--orange)' : undefined }}
                onClick={() => toggle('created_at')}
              >
                Date{arrow('created_at')}
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.length > 0 ? entries.map((e) => (
              <tr key={e._id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11.5px' }}>
                  {/* Truncated for width; the title carries the full id and the
                      name, when an auth session happened to supply one. */}
                  <span title={`${e.owner_id}${e.user_name ? ` · ${e.user_name}` : ''}`}>
                    {String(e.owner_id || '').slice(0, 8)}…
                  </span>
                  {e.user_name && (
                    <div style={{ fontFamily: 'var(--font-body-family)', color: 'var(--text-soft)', fontSize: '11.5px' }}>{e.user_name}</div>
                  )}
                </td>
                {EXPERIENCE_COLUMNS.map((c) => (
                  <td key={c.key} style={cell}><Score n={e[c.key]} /></td>
                ))}
                <td style={{ ...cell, color: 'var(--text-soft)', whiteSpace: 'pre-wrap' }}>{e.comment || '—'}</td>
                <td style={{ ...cell, color: 'var(--text-soft)', whiteSpace: 'nowrap' }}>
                  {new Date(e.created_at).toLocaleDateString()}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8} style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-soft)' }}>
                  No survey responses{owner || score.field ? ' match that filter' : ' yet'}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};


const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [buyRequests, setBuyRequests] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  /* The 5-question experience survey lives in its own collection, so it is its
     own request — and its own sort/filter state, since the server does the
     sorting (the whole set may exceed what one page holds). */
  const [experience, setExperience] = useState({ entries: [], averages: {}, count: 0 });
  const [expSort, setExpSort] = useState({ by: 'created_at', order: 'desc' });
  const [expOwner, setExpOwner] = useState('');
  const [expScore, setExpScore] = useState({ field: '', max: '' });
  const [anonymousVisitors, setAnonymousVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'users', 'buy_requests', 'leads', 'anonymous'
  const [cityFilter, setCityFilter] = useState('');
  const [authError, setAuthError] = useState('');
  const [anonPage, setAnonPage] = useState(0);   // visitors table paging
  const ANON_PER_PAGE = 25;
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  /* loadAll is stable (no deps) so it doesn't retrigger the mount effect; it
     reads the current filter through a ref rather than closing over the value. */
  const cityFilterRef = useRef('');
  useEffect(() => { cityFilterRef.current = cityFilter; }, [cityFilter]);

  // /api/admin/* is token-gated server-side; without this header the dashboard
  // gets a 401 no matter what the browser thinks the role is.
  const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('pb_token') || ''}` },
  });

  const handleFetchError = (error) => {
    // A 401/403 means the stored token is gone or stale — the browser role flag
    // alone no longer opens this page.
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      setAuthError('Your administrator session has expired. Please sign in again.');
    } else {
      console.error('Error fetching admin data:', error);
    }
  };

  /* Everything on the page, in one pass. Runs on mount and on Refresh — NOT on
     every keystroke in the city box, which is what it used to do: each letter
     re-fetched all six endpoints, so typing "Bengaluru" fired ~54 requests and
     pulled the whole 122-row visitor list nine times over. */
  const loadAll = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setRefreshing(true);
    const auth = authHeader();
    const city = cityFilterRef.current;

    /* Promise.allSettled, not Promise.all: one failing endpoint (e.g. /api/buy
       when the token is stale) used to reject the whole batch, leaving every
       tab empty. Now each endpoint succeeds or fails on its own, and a 401/403
       on any admin-gated route still shows the auth banner. */
    const results = await Promise.allSettled([
      axios.get(`${API_URL}/api/admin/dashboard`, auth),
      axios.get(`${API_URL}/api/admin/users${city ? `?city=${encodeURIComponent(city)}` : ''}`, auth),
      axios.get(`${API_URL}/api/buy`, auth),
      axios.get(`${API_URL}/api/admin/leads`, auth),
      axios.get(`${API_URL}/api/feedback`, auth),
      axios.get(`${API_URL}/api/admin/anonymous-visitors`, auth),
    ]);

    const unwrap = (result, fallback) =>
      result.status === 'fulfilled' ? result.value.data : fallback;

    let authFailed = false;
    for (const r of results) {
      if (r.status === 'rejected' && (r.reason?.response?.status === 401 || r.reason?.response?.status === 403)) {
        authFailed = true;
      }
    }

    setStats(unwrap(results[0], null));
    setUsers(unwrap(results[1], []));
    setBuyRequests(unwrap(results[2], []));
    setLeads(unwrap(results[3], []));
    setFeedbacks(unwrap(results[4], []));
    setAnonymousVisitors(unwrap(results[5], []));

    if (authFailed) {
      setAuthError('Your administrator session has expired. Please sign in again.');
    } else {
      setAuthError('');
    }
    setRefreshedAt(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadAll({ silent: true }); }, [loadAll]);

  /* Its own request, re-run whenever the sort or filter changes: the server
     orders and filters the rows, so this cannot be done by sorting whatever
     happened to be in the first page of a shared response. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams({ sort_by: expSort.by, order: expSort.order });
      if (expOwner.trim()) params.set('owner_id', expOwner.trim());
      // A bound means nothing without the question it applies to, so both are
      // sent together or neither is.
      if (expScore.field && expScore.max) {
        params.set('score_field', expScore.field);
        params.set('score_max', expScore.max);
      }
      try {
        const { data } = await axios.get(
          `${API_URL}/api/feedback/experience?${params}`, authHeader());
        if (!cancelled) setExperience(data);
      } catch {
        if (!cancelled) setExperience({ entries: [], averages: {}, count: 0 });
      }
    })();
    return () => { cancelled = true; };
  }, [expSort, expOwner, expScore, refreshedAt]);

  /* The city box filters the USERS list and nothing else, so only that request
     is repeated — debounced, so it fires when you stop typing rather than on
     every letter. */
  const firstFilterRun = useRef(true);
  useEffect(() => {
    if (firstFilterRun.current) { firstFilterRun.current = false; return; }
    const timer = setTimeout(async () => {
      try {
        const { data } = await axios.get(
          `${API_URL}/api/admin/users${cityFilter ? `?city=${encodeURIComponent(cityFilter)}` : ''}`,
          authHeader(),
        );
        setUsers(data);
      } catch (error) {
        handleFetchError(error);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [cityFilter]);

  const data = [
    { name: 'Users', count: stats?.users || 0 },
    { name: 'Quizzes', count: stats?.quiz_completions || 0 },
    { name: 'Feedback', count: stats?.feedback || 0 },
    { name: 'Buy Requests', count: stats?.buy_requests || 0 },
    { name: 'Anon Visitors', count: stats?.anonymous_visitors || 0 },
  ];

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'var(--font-body-family)' }}>Loading Dashboard...</div>;

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100dvh', padding: '20px', position: 'relative' }}>
      
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <img src="/logo.png" alt="Paw Buddy" style={{ width: '140px', mixBlendMode: 'multiply', cursor: 'pointer' }} onClick={() => navigate('/')} />

        <button 
          onClick={() => navigate('/')}
          style={{
            background: 'var(--orange)', color: 'white', border: 'none',
            padding: '10px 20px', borderRadius: '50px', cursor: 'pointer',
            fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)',
            transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(255,107,43,0.3)'
          }}
          onMouseOver={e => { e.currentTarget.style.transform = 'translateX(-2px)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = 'translateX(0)'; }}
        >
          ← Home
        </button>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--font-body-family)' }}>

        {authError && (
          <div style={{ background: '#FFF5F5', border: '1px solid #F2C9C9', color: '#B23B3B',
                        padding: '14px 18px', borderRadius: '14px', marginBottom: '20px',
                        display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 'var(--weight-bold)' }}>{authError}</span>
            <button onClick={() => navigate('/login')}
                    style={{ padding: '8px 18px', borderRadius: '50px', border: 'none',
                             background: '#C62828', color: 'white', fontWeight: 'var(--weight-bold)',
                             fontFamily: 'var(--font-display)', cursor: 'pointer' }}>
              Sign in
            </button>
          </div>
        )}
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h2 className="text-h2" style={{ fontFamily: 'var(--font-display)', color: 'var(--brown)', fontWeight: 'var(--weight-bold)', margin: 0 }}>Dashboard</h2>
            {/* The page fetches once on mount, so left open it goes stale.
                Saying when it was last read — and offering to read it again —
                is the honest version of "real-time". */}
            <p style={{ color: 'var(--text-soft)', margin: '5px 0 0 0', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span>
                Monitor Paw Buddy platform activity.
                {refreshedAt && (
                  <span style={{ marginLeft: '6px', fontSize: '13px' }}>
                    Updated {refreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.
                  </span>
                )}
              </span>
              <button
                onClick={() => loadAll()}
                disabled={refreshing}
                style={{
                  padding: '5px 14px', borderRadius: '50px', border: '1px solid #E3D9CE',
                  background: 'white', color: 'var(--brown)', fontFamily: 'var(--font-display)',
                  fontSize: '12.5px', fontWeight: 'var(--weight-bold)',
                  cursor: refreshing ? 'not-allowed' : 'pointer', opacity: refreshing ? 0.6 : 1,
                }}
              >
                {refreshing ? 'Refreshing…' : '↻ Refresh'}
              </button>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setActiveTab('overview')} style={{ padding: '8px 16px', borderRadius: '50px', border: 'none', background: activeTab === 'overview' ? 'var(--orange)' : 'white', color: activeTab === 'overview' ? 'white' : 'var(--text-soft)', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'var(--shadow)', fontSize: '13px' }}>Overview</button>
            <button onClick={() => setActiveTab('users')} style={{ padding: '8px 16px', borderRadius: '50px', border: 'none', background: activeTab === 'users' ? 'var(--orange)' : 'white', color: activeTab === 'users' ? 'white' : 'var(--text-soft)', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'var(--shadow)', fontSize: '13px' }}>Users</button>
            <button onClick={() => setActiveTab('buy_requests')} style={{ padding: '8px 16px', borderRadius: '50px', border: 'none', background: activeTab === 'buy_requests' ? 'var(--orange)' : 'white', color: activeTab === 'buy_requests' ? 'white' : 'var(--text-soft)', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'var(--shadow)', fontSize: '13px' }}>Buy Requests</button>
            <button onClick={() => setActiveTab('leads')} style={{ padding: '8px 16px', borderRadius: '50px', border: 'none', background: activeTab === 'leads' ? 'var(--orange)' : 'white', color: activeTab === 'leads' ? 'white' : 'var(--text-soft)', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'var(--shadow)', fontSize: '13px' }}>Leads</button>
            <button onClick={() => setActiveTab('feedback')} style={{ padding: '8px 16px', borderRadius: '50px', border: 'none', background: activeTab === 'feedback' ? 'var(--orange)' : 'white', color: activeTab === 'feedback' ? 'white' : 'var(--text-soft)', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'var(--shadow)', fontSize: '13px' }}>Feedback</button>
            <button onClick={() => setActiveTab('anonymous')} style={{ padding: '8px 16px', borderRadius: '50px', border: 'none', background: activeTab === 'anonymous' ? 'var(--orange)' : 'white', color: activeTab === 'anonymous' ? 'white' : 'var(--text-soft)', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'var(--shadow)', fontSize: '13px' }}>Visitors (Anon)</button>
            <button onClick={() => setActiveTab('owner_survey')} style={{ padding: '8px 16px', borderRadius: '50px', border: 'none', background: activeTab === 'owner_survey' ? 'var(--orange)' : 'white', color: activeTab === 'owner_survey' ? 'white' : 'var(--text-soft)', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'var(--shadow)', fontSize: '13px' }}>Owner Survey</button>
            <button onClick={() => setActiveTab('care_tips')} style={{ padding: '8px 16px', borderRadius: '50px', border: 'none', background: activeTab === 'care_tips' ? 'var(--orange)' : 'white', color: activeTab === 'care_tips' ? 'white' : 'var(--text-soft)', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'var(--shadow)', fontSize: '13px' }}>Care Tips</button>
          </div>
        </div>
        
        {/* The acquisition funnel sits above the existing tabs and has its own
            date range — it answers a different question from the tables below
            it, which are lifetime lists rather than a period report. */}
        <FunnelReport />

        {activeTab === 'overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '40px' }}>
              {[
                { label: 'Total Users', val: stats?.users || 0 },
                { label: 'Quizzes Taken', val: stats?.quiz_completions || 0 },
                { label: 'Anon Visitors', val: stats?.anonymous_visitors || 0 },
                { label: 'Buy Requests', val: stats?.buy_requests || 0 },
                { label: 'Feedback Items', val: stats?.feedback || 0 }
              ].map((item, i) => (
                <div key={i} style={{ 
                  background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)', border: '1px solid white',
                  padding: '25px', borderRadius: '20px', boxShadow: 'var(--shadow)', textAlign: 'center',
                  transition: 'transform 0.3s ease'
                }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
                  <h4 style={{ fontFamily: 'var(--font-body-family)', fontWeight: 'var(--weight-medium)', color: 'var(--text-soft)', marginBottom: '10px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>{item.label}</h4>
                  <p style={{ fontSize: '42px', fontWeight: '800', color: 'var(--orange)', margin: 0 }}>{item.val}</p>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
              <div style={{ background: 'white', padding: '30px', borderRadius: '20px', boxShadow: 'var(--shadow)', height: '400px' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)', marginBottom: '20px', color: 'var(--brown)' }}>Platform Analytics</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'var(--orange-pale)' }} contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="count" fill="var(--orange)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

            </div>
          </>
        )}

        {activeTab === 'users' && (
          <div style={{ background: 'white', padding: '30px', borderRadius: '20px', boxShadow: 'var(--shadow)', minHeight: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)', color: 'var(--brown)', margin: 0 }}>All Users</h3>
              <input 
                type="text" 
                placeholder="Filter by city..." 
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                style={{ padding: '10px 15px', borderRadius: '10px', border: '1px solid #ddd', fontFamily: 'var(--font-body-family)', width: '250px' }}
              />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', color: 'var(--text-soft)' }}>
                    <th style={{ padding: '10px 0', fontWeight: 'var(--weight-semibold)' }}>Name</th>
                    <th style={{ padding: '10px 0', fontWeight: 'var(--weight-semibold)' }}>Mobile</th>
                    <th style={{ padding: '10px 0', fontWeight: 'var(--weight-semibold)' }}>City</th>
                    <th style={{ padding: '10px 0', fontWeight: 'var(--weight-semibold)' }}>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length > 0 ? users.map((u, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <td style={{ padding: '15px 0', fontWeight: 'var(--weight-medium)' }}>{u.name}</td>
                      <td style={{ padding: '15px 0', color: 'var(--text-soft)' }}>{u.mobile}</td>
                      <td style={{ padding: '15px 0', color: 'var(--text-soft)' }}>{u.city}</td>
                      <td style={{ padding: '15px 0' }}>
                        <span style={{ 
                          background: u.role === 'ADMIN' ? 'var(--orange-pale)' : '#e8f5e9', 
                          color: u.role === 'ADMIN' ? 'var(--orange)' : '#2e7d32', 
                          padding: '4px 10px', borderRadius: '50px', fontSize: '12px', fontWeight: 'var(--weight-bold)' 
                        }}>
                          {u.role}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="4" style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-soft)' }}>No users found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'buy_requests' && (
          <div style={{ background: 'white', padding: '30px', borderRadius: '20px', boxShadow: 'var(--shadow)', minHeight: '500px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)', marginBottom: '20px', color: 'var(--brown)' }}>Buy / Adoption Requests</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', color: 'var(--text-soft)' }}>
                    <th style={{ padding: '15px 0', fontWeight: 'var(--weight-semibold)' }}>Name</th>
                    <th style={{ padding: '15px 0', fontWeight: 'var(--weight-semibold)' }}>Mobile</th>
                    <th style={{ padding: '15px 0', fontWeight: 'var(--weight-semibold)' }}>City</th>
                    <th style={{ padding: '15px 0', fontWeight: 'var(--weight-semibold)' }}>Breed</th>
                    <th style={{ padding: '15px 0', fontWeight: 'var(--weight-semibold)' }}>Intent</th>
                    <th style={{ padding: '15px 0', fontWeight: 'var(--weight-semibold)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {buyRequests.length > 0 ? buyRequests.map((req, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <td style={{ padding: '15px 0', fontWeight: 'var(--weight-medium)' }}>{req.user_name}</td>
                      <td style={{ padding: '15px 0', color: 'var(--text-soft)' }}>{req.mobile}</td>
                      <td style={{ padding: '15px 0', color: 'var(--text-soft)' }}>{req.city}</td>
                      <td style={{ padding: '15px 0', fontWeight: 'var(--weight-semibold)', color: 'var(--orange)' }}>{req.breed_name}</td>
                      <td style={{ padding: '15px 0', color: 'var(--text-soft)' }}>{req.intent}</td>
                      <td style={{ padding: '15px 0' }}>
                        <span style={{ background: req.status === 'NEW' ? '#fff3e0' : '#e8f5e9', color: req.status === 'NEW' ? '#ef6c00' : '#2e7d32', padding: '4px 10px', borderRadius: '50px', fontSize: '12px', fontWeight: 'var(--weight-bold)' }}>
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="6" style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-soft)' }}>No buy requests yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'leads' && (
          <div style={{ background: 'white', padding: '30px', borderRadius: '20px', boxShadow: 'var(--shadow)', minHeight: '500px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)', marginBottom: '5px', color: 'var(--brown)' }}>Inactive Leads</h3>
            <p style={{ color: 'var(--text-soft)', marginBottom: '20px' }}>Users who registered but have not completed the quiz.</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '500px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', color: 'var(--text-soft)' }}>
                    <th style={{ padding: '15px 0', fontWeight: 'var(--weight-semibold)' }}>Name</th>
                    <th style={{ padding: '15px 0', fontWeight: 'var(--weight-semibold)' }}>Mobile</th>
                    <th style={{ padding: '15px 0', fontWeight: 'var(--weight-semibold)' }}>City</th>
                    <th style={{ padding: '15px 0', fontWeight: 'var(--weight-semibold)' }}>Quiz Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.length > 0 ? leads.map((lead, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <td style={{ padding: '15px 0', fontWeight: 'var(--weight-medium)' }}>{lead.name}</td>
                      <td style={{ padding: '15px 0', color: 'var(--text-soft)' }}>{lead.mobile}</td>
                      <td style={{ padding: '15px 0', color: 'var(--text-soft)' }}>{lead.city}</td>
                      <td style={{ padding: '15px 0' }}>
                        <span style={{ background: '#ffebee', color: '#c62828', padding: '4px 10px', borderRadius: '50px', fontSize: '12px', fontWeight: 'var(--weight-bold)' }}>
                          {lead.quiz_status}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="4" style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-soft)' }}>No inactive leads found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'feedback' && (
          <div style={{ background: 'white', padding: '30px', borderRadius: '20px', boxShadow: 'var(--shadow)', minHeight: '500px' }}>
            <ExperienceFeedbackPanel
              data={experience}
              sort={expSort} onSort={setExpSort}
              owner={expOwner} onOwner={setExpOwner}
              score={expScore} onScore={setExpScore}
            />

            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)', margin: '38px 0 20px', color: 'var(--brown)' }}>One-tap & other feedback</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', color: 'var(--text-soft)' }}>
                    <th style={{ padding: '15px 0', fontWeight: 'var(--weight-semibold)', width: '20%' }}>User</th>
                    <th style={{ padding: '15px 0', fontWeight: 'var(--weight-semibold)', width: '20%' }}>Rating</th>
                    <th style={{ padding: '15px 0', fontWeight: 'var(--weight-semibold)', width: '40%' }}>Comment</th>
                    <th style={{ padding: '15px 0', fontWeight: 'var(--weight-semibold)', width: '20%' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbacks.length > 0 ? feedbacks.map((fb, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <td style={{ padding: '15px 0', fontWeight: 'var(--weight-medium)' }}>{fb.user_name || 'Anonymous'}</td>
                      <td style={{ padding: '15px 0', color: '#FFD700', fontSize: '18px', minWidth: '100px' }}>{'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}</td>
                      <td style={{ padding: '15px 0', color: 'var(--text-soft)', whiteSpace: 'pre-wrap' }}>{fb.comment || '-'}</td>
                      <td style={{ padding: '15px 0', color: 'var(--text-soft)', fontSize: '13px' }}>{new Date(fb.created_at).toLocaleDateString()}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="4" style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-soft)' }}>No feedback received yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'owner_survey' && <OwnerSurveyTable />}

        {activeTab === 'care_tips' && <CareTipsTable />}

        {activeTab === 'anonymous' && (
          <div style={{ background: 'white', padding: '30px', borderRadius: '20px', boxShadow: 'var(--shadow)', minHeight: '500px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)', marginBottom: '5px', color: 'var(--brown)' }}>Anonymous Visitors</h3>
            <p style={{ color: 'var(--text-soft)', marginBottom: '20px' }}>
              Users who explored the site without logging in. One row per visit —
              showing {Math.min(anonPage * ANON_PER_PAGE + 1, anonymousVisitors.length)}–
              {Math.min((anonPage + 1) * ANON_PER_PAGE, anonymousVisitors.length)} of {anonymousVisitors.length}.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '400px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', color: 'var(--text-soft)' }}>
                    <th style={{ padding: '15px 0', fontWeight: 'var(--weight-semibold)' }}>Visitor ID</th>
                    <th style={{ padding: '15px 0', fontWeight: 'var(--weight-semibold)' }}>Time of Visit</th>
                  </tr>
                </thead>
                <tbody>
                  {anonymousVisitors.length > 0 ? anonymousVisitors.slice(anonPage * ANON_PER_PAGE, (anonPage + 1) * ANON_PER_PAGE).map((anon, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <td style={{ padding: '15px 0', fontWeight: 'var(--weight-medium)', fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-soft)' }}>{anon.visitor_id}</td>
                      <td style={{ padding: '15px 0', color: 'var(--text-color)' }}>
                        {anon.visited_at ? new Date(anon.visited_at).toLocaleString() : '-'}
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="2" style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-soft)' }}>No anonymous visitors tracked yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {anonymousVisitors.length > ANON_PER_PAGE && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '18px' }}>
                <button
                  onClick={() => setAnonPage((p) => Math.max(0, p - 1))}
                  disabled={anonPage === 0}
                  style={{ padding: '8px 16px', borderRadius: '50px', border: '1px solid #E3D9CE',
                           background: 'white', cursor: anonPage === 0 ? 'not-allowed' : 'pointer',
                           opacity: anonPage === 0 ? 0.5 : 1, fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-bold)' }}
                >
                  ← Previous
                </button>
                <span style={{ color: 'var(--text-soft)', fontSize: '13px' }}>
                  Page {anonPage + 1} of {Math.ceil(anonymousVisitors.length / ANON_PER_PAGE)}
                </span>
                <button
                  onClick={() => setAnonPage((p) =>
                    Math.min(Math.ceil(anonymousVisitors.length / ANON_PER_PAGE) - 1, p + 1))}
                  disabled={(anonPage + 1) * ANON_PER_PAGE >= anonymousVisitors.length}
                  style={{ padding: '8px 16px', borderRadius: '50px', border: '1px solid #E3D9CE',
                           background: 'white',
                           cursor: (anonPage + 1) * ANON_PER_PAGE >= anonymousVisitors.length ? 'not-allowed' : 'pointer',
                           opacity: (anonPage + 1) * ANON_PER_PAGE >= anonymousVisitors.length ? 0.5 : 1,
                           fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-bold)' }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;
