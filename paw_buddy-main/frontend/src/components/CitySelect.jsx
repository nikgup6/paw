import React, { useMemo, useRef, useState, useEffect } from 'react';
import cityZones from '../config/cityZones.json';

/* Q3 collects a real city, not a climate band — that is what lets the engine
   tell Chennai's humid heat apart from Jaipur's dry heat (G1 HOT_HUMID vs
   HOT_DRY). Cities come from config/cityZones.json, so adding one needs no
   code change.

   Type-ahead rather than a 127-row <select>: on mobile a long native picker is
   painful, and most people know their city name faster than they can scroll.
   The four climate fallbacks stay pinned at the bottom so nobody can dead-end,
   and free text is never accepted — the engine fails loud on unmapped values,
   so this control only ever emits a known city or an explicit zone. */

const ZONE_ORDER = ['HOT_HUMID', 'HOT_DRY', 'MODERATE', 'COLD'];
const ZONE_GROUP_LABEL = {
  HOT_HUMID: 'Warm & humid',
  HOT_DRY: 'Hot & dry',
  MODERATE: 'Moderate & pleasant',
  COLD: 'Cool & cold',
};
const ZONE_FALLBACK_LABEL = {
  HOT_HUMID: 'Other — warm & humid (coastal/tropical)',
  HOT_DRY: 'Other — hot & dry (inland/north)',
  MODERATE: 'Other — moderate & pleasant',
  COLD: 'Other — cool & cold (hills)',
};

const CitySelect = ({ value, onChange, placeholder = 'Type your city…' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  const { cities, fallbacks } = useMemo(() => ({
    cities: Object.entries(cityZones.cities)
      .map(([city, zone]) => ({ value: city, label: city, hint: ZONE_GROUP_LABEL[zone] }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    fallbacks: ZONE_ORDER.map((z) => ({
      value: `zone:${z}`, label: ZONE_FALLBACK_LABEL[z], hint: 'Climate fallback', isFallback: true,
    })),
  }), []);

  /** Label shown in the closed input for whatever is currently selected. */
  const selectedLabel = useMemo(() => {
    if (!value) return '';
    if (value.startsWith('zone:')) return ZONE_FALLBACK_LABEL[value.slice(5)] || '';
    return value;
  }, [value]);

  const { matches, cityHits } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hits = q
      ? cities.filter((c) => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q))
      : cities;
    // Fallbacks are always appended, so the list can never dead-end.
    return { matches: [...hits, ...fallbacks], cityHits: hits.length };
  }, [query, cities, fallbacks]);

  // Close when clicking away; never leave a half-typed value behind.
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  // Keep the highlighted row scrolled into view.
  useEffect(() => {
    const el = listRef.current?.children?.[highlight];
    if (el?.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const choose = (opt) => {
    onChange(opt.value);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setHighlight((h) => {
        const next = e.key === 'ArrowDown' ? h + 1 : h - 1;
        return (next + matches.length) % matches.length;
      });
    } else if (e.key === 'Enter') {
      if (open && matches[highlight]) { e.preventDefault(); choose(matches[highlight]); }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-label="Your city"
        autoComplete="off"
        value={open ? query : selectedLabel}
        placeholder={selectedLabel || placeholder}
        onFocus={() => { setOpen(true); setQuery(''); setHighlight(0); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
        onKeyDown={onKeyDown}
        style={{
          width: '100%',
          padding: '14px 40px 14px 16px',
          borderRadius: '12px',
          border: `2px solid ${open ? 'var(--orange)' : '#EAE4DE'}`,
          background: '#fff',
          color: 'var(--brown)',
          fontSize: '16px', // 16px stops iOS zooming the page on focus
          fontFamily: "'Poppins', sans-serif",
          fontWeight: 600,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      <span aria-hidden="true" style={{
        position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
        pointerEvents: 'none', color: 'var(--text-soft)', fontSize: '13px',
      }}>{open ? '⌕' : '▾'}</span>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          style={{
            position: 'absolute', zIndex: 60, top: 'calc(100% + 6px)', left: 0, right: 0,
            margin: 0, padding: '6px', listStyle: 'none',
            maxHeight: '260px', overflowY: 'auto',
            background: '#fff', border: '1px solid #EAE4DE', borderRadius: '12px',
            boxShadow: '0 18px 40px rgba(61, 41, 28, 0.18)',
          }}
        >
          {cityHits === 0 && query.trim() !== '' && (
            <li style={{ padding: '10px 12px', color: 'var(--text-soft)', fontSize: '13px', lineHeight: 1.5 }}>
              No city matches “{query.trim()}”. Pick the closest climate instead:
            </li>
          )}
          {matches.map((opt, i) => {
            const active = i === highlight;
            const firstFallback = opt.isFallback && !matches[i - 1]?.isFallback;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={value === opt.value}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => { e.preventDefault(); choose(opt); }}
                style={{
                  padding: '10px 12px',
                  marginTop: firstFallback ? '6px' : 0,
                  borderTop: firstFallback ? '1px solid #EAE4DE' : 'none',
                  paddingTop: firstFallback ? '12px' : '10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: active ? 'var(--orange-pale, #FDF1E8)' : 'transparent',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px',
                }}
              >
                <span style={{
                  color: 'var(--brown)', fontSize: '15px',
                  fontWeight: opt.isFallback ? 500 : 600,
                  fontStyle: opt.isFallback ? 'italic' : 'normal',
                }}>{opt.label}</span>
                <span style={{ color: 'var(--text-soft)', fontSize: '11px', whiteSpace: 'nowrap' }}>{opt.hint}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default CitySelect;
