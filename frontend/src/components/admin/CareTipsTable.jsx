import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

/* Care Tips review — the vet-approval gate the Care Tips Matrix spec
   requires: every imported row starts unapproved, and only an approved row
   can ever reach an owner (see backend care_tips_service.match_tips).

   Uploading a workbook REPLACES every row and resets every approval, even
   for content that didn't change — that's deliberate (backend/CARE_TIPS
   import_workbook docstring), not something to soften here. */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const CATEGORIES = ['Climate', 'Health Risk', 'Grooming', 'Energy', 'Age', 'Behavior'];
const PAGE_SIZE = 40;

const th = {
  textAlign: 'left', padding: '9px 10px', fontSize: '11px', textTransform: 'uppercase',
  letterSpacing: '.05em', color: 'var(--text-soft)', borderBottom: '1px solid #EFE6DC',
  whiteSpace: 'nowrap',
};
const td = {
  padding: '9px 10px', fontSize: '13px', color: 'var(--brown)',
  borderBottom: '1px solid #F6F1EB', fontFamily: 'var(--font-body-family)', verticalAlign: 'top',
};

const CareTipsTable = () => {
  const [data, setData] = useState({ stats: {}, tips: [], fallback: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [breed, setBreed] = useState('');
  const [category, setCategory] = useState('');
  const [approved, setApproved] = useState(''); // '', 'true', 'false'
  const [page, setPage] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('pb_token') || ''}` } });

  const load = useCallback(async (filters) => {
    try {
      const { data: res } = await axios.get(`${API_URL}/api/care-tips`, {
        ...auth(),
        params: {
          breed: filters?.breed || undefined,
          category: filters?.category || undefined,
          approved: filters?.approved === '' ? undefined : filters?.approved === 'true',
        },
      });
      setData(res);
      setError('');
    } catch (e) {
      setError(e?.response?.status === 401 || e?.response?.status === 403
        ? 'Your administrator session has expired. Please sign in again.'
        : 'Couldn’t load care tips.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Debounced so typing a breed name doesn't fire a request per keystroke. */
  useEffect(() => {
    const timer = setTimeout(() => { setPage(0); load({ breed, category, approved }); }, 350);
    return () => clearTimeout(timer);
  }, [breed, category, approved, load]);

  const toggleApproval = async (tip, nextApproved) => {
    try {
      await axios.patch(`${API_URL}/api/care-tips/${tip.id}/approve`, { approved: nextApproved }, auth());
      setData((prev) => ({
        ...prev,
        tips: prev.tips.map((t) => (t.id === tip.id ? { ...t, is_approved: nextApproved } : t)),
        stats: {
          ...prev.stats,
          approved: prev.stats.approved + (nextApproved ? 1 : -1),
          pending: prev.stats.pending + (nextApproved ? -1 : 1),
        },
      }));
    } catch {
      setError('Couldn’t update that tip’s approval status.');
    }
  };

  const toggleFallbackApproval = async (tip, nextApproved) => {
    try {
      await axios.patch(`${API_URL}/api/care-tips/fallback/${tip.id}/approve`, { approved: nextApproved }, auth());
      setData((prev) => ({
        ...prev,
        fallback: prev.fallback.map((t) => (t.id === tip.id ? { ...t, is_approved: nextApproved } : t)),
      }));
    } catch {
      setError('Couldn’t update the fallback tip’s approval status.');
    }
  };

  /* Acts on exactly what the current filters show, so "approve these" always
     means the rows on screen — never a blind approve-everything. */
  const approveFiltered = async (nextApproved) => {
    const shown = tips.filter((t) => t.is_approved !== nextApproved);
    if (shown.length === 0) return;
    const verb = nextApproved ? 'Approve' : 'Unapprove';
    if (!window.confirm(`${verb} ${shown.length} tip(s) matching the current filters?`)) return;
    try {
      await axios.patch(`${API_URL}/api/care-tips/approve-bulk`,
        { ids: shown.map((t) => t.id), approved: nextApproved }, auth());
      await load({ breed, category, approved });
      setNotice(`${verb}d ${shown.length} tip(s).`);
    } catch {
      setError(`Couldn’t ${verb.toLowerCase()} those tips.`);
    }
  };

  const onUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    setNotice('');
    try {
      const body = new FormData();
      body.append('file', file);
      const { data: res } = await axios.post(`${API_URL}/api/care-tips/import`, body, auth());
      const parts = [`${res.matrix_imported} tips`, `${res.fallback_imported} fallback tip(s)`];
      if (res.season_calendar_imported !== null) parts.push(`${res.season_calendar_imported} season-calendar rows`);
      setNotice(
        `Imported ${parts.join(', ')}. Every row is unapproved — review below before it reaches an owner.`
        + (res.warnings.length ? ` ${res.warnings.length} warning(s): ${res.warnings.slice(0, 3).join(' ')}` : ''),
      );
      await load({ breed, category, approved });
    } catch (e) {
      setError(e?.response?.data?.detail || 'Couldn’t import that workbook.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (loading) {
    return <div style={{ background: 'white', padding: '30px', borderRadius: '20px' }}>Loading care tips…</div>;
  }

  const { stats, tips, fallback } = data;
  const pageRows = tips.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(tips.length / PAGE_SIZE));

  return (
    <div style={{ background: 'white', padding: '30px', borderRadius: '20px', boxShadow: 'var(--shadow)', minHeight: '500px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '6px' }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--brown)' }}>Care Tips review</h3>
          <p style={{ color: 'var(--text-soft)', margin: '5px 0 0' }}>
            {stats.total || 0} tips · <strong style={{ color: '#1B8046' }}>{stats.approved || 0} approved</strong>
            {' · '}<strong style={{ color: '#9A6B1F' }}>{stats.pending || 0} pending</strong>
            {' · '}fallback tip {stats.fallback_approved ? 'approved' : 'not approved'}
            {stats.season_calendar_rows ? <> · {stats.season_calendar_rows} season-calendar rows</> : null}
          </p>
        </div>
        <div>
          <input
            ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }}
            onChange={(e) => onUpload(e.target.files?.[0])}
          />
          <button
            onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{
              padding: '9px 18px', borderRadius: '50px', border: 'none', background: 'var(--orange)',
              color: 'white', fontWeight: 700, fontFamily: 'inherit', fontSize: '13px',
              cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? 'Importing…' : '⤒ Upload Care Tips workbook'}
          </button>
        </div>
      </div>

      {notice && (
        <p style={{ background: '#F3FBF6', border: '1px solid #C9E9D4', color: '#1B6B3E', padding: '11px 14px', borderRadius: '12px', fontSize: '13px', margin: '14px 0 0' }}>
          {notice}
        </p>
      )}
      {error && (
        <p style={{ background: '#FFF5F5', border: '1px solid #F2C9C9', color: '#B23B3B', padding: '11px 14px', borderRadius: '12px', fontSize: '13px', margin: '14px 0 0' }}>
          {error}
        </p>
      )}

      {fallback.length > 0 && (
        <div style={{ margin: '20px 0', padding: '14px 16px', border: '1px solid #EFE6DC', borderRadius: '14px', background: 'var(--cream)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <strong style={{ fontSize: '13px', color: 'var(--brown)' }}>Fallback Tip</strong>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-soft)', maxWidth: '620px' }}>{fallback[0].tip}</p>
            </div>
            <button
              onClick={() => toggleFallbackApproval(fallback[0], !fallback[0].is_approved)}
              style={{
                padding: '7px 16px', borderRadius: '50px', border: 'none', fontWeight: 700, fontSize: '12px',
                cursor: 'pointer', whiteSpace: 'nowrap',
                background: fallback[0].is_approved ? '#EAF7EE' : 'var(--orange)',
                color: fallback[0].is_approved ? '#1B8046' : 'white',
              }}
            >
              {fallback[0].is_approved ? '✓ Approved' : 'Approve'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', margin: '16px 0 20px' }}>
        <input
          value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="Filter by breed…"
          style={{ padding: '9px 14px', borderRadius: '10px', border: '1px solid #E3D9CE', fontFamily: 'inherit', fontSize: '13px', flex: '1 1 180px' }}
        />
        <select
          value={category} onChange={(e) => setCategory(e.target.value)}
          style={{ padding: '9px 14px', borderRadius: '10px', border: '1px solid #E3D9CE', fontFamily: 'inherit', fontSize: '13px' }}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={approved} onChange={(e) => setApproved(e.target.value)}
          style={{ padding: '9px 14px', borderRadius: '10px', border: '1px solid #E3D9CE', fontFamily: 'inherit', fontSize: '13px' }}
        >
          <option value="">All statuses</option>
          <option value="true">Approved only</option>
          <option value="false">Pending only</option>
        </select>
        {(breed || category || approved) && (
          <button onClick={() => { setBreed(''); setCategory(''); setApproved(''); }}
            style={{ border: 'none', background: 'none', color: 'var(--orange)', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
            Clear
          </button>
        )}
        {(breed || category) && tips.length > 0 && (
          <button
            onClick={() => approveFiltered(true)}
            style={{ padding: '9px 16px', borderRadius: '10px', border: '1px solid #C9E9D4', background: '#F3FBF6', color: '#1B6B3E', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
          >
            ✓ Approve these {tips.filter((t) => !t.is_approved).length || ''}
          </button>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
          <thead>
            <tr>
              <th style={th}>Breed</th>
              <th style={th}>Category</th>
              <th style={th}>Trait / Trigger</th>
              <th style={th}>Tip</th>
              <th style={th}>City</th>
              <th style={th}>Duration</th>
              <th style={th}>Season</th>
              <th style={th}>Vet-flag</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan="9" style={{ ...td, textAlign: 'center', padding: '40px 0', color: 'var(--text-soft)' }}>
                No care tips match these filters.
              </td></tr>
            ) : pageRows.map((t) => (
              <tr key={t.id}>
                <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{t.breed_name}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{t.category}</td>
                <td style={{ ...td, maxWidth: '160px' }}>{t.trait_trigger}</td>
                <td style={{ ...td, maxWidth: '340px' }}>{t.tip}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{t.city_climate_dependency}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{t.ownership_duration_dependency}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{t.season_dependency}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  {t.vet_verify_flag === 'Y'
                    ? <span title={t.vet_verify_note || ''} style={{ color: '#B23B3B', fontWeight: 700 }}>Y</span>
                    : t.vet_verify_flag || '—'}
                </td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  <button
                    onClick={() => toggleApproval(t, !t.is_approved)}
                    style={{
                      padding: '6px 14px', borderRadius: '50px', border: 'none', fontWeight: 700, fontSize: '12px',
                      cursor: 'pointer',
                      background: t.is_approved ? '#EAF7EE' : 'var(--orange)',
                      color: t.is_approved ? '#1B8046' : 'white',
                    }}
                  >
                    {t.is_approved ? '✓ Approved' : 'Approve'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '18px', alignItems: 'center' }}>
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            style={{ padding: '6px 14px', borderRadius: '50px', border: '1px solid #E3D9CE', background: 'white', cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
            ← Prev
          </button>
          <span style={{ fontSize: '13px', color: 'var(--text-soft)' }}>Page {page + 1} of {pageCount}</span>
          <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}
            style={{ padding: '6px 14px', borderRadius: '50px', border: '1px solid #E3D9CE', background: 'white', cursor: page >= pageCount - 1 ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default CareTipsTable;
