import React, { useEffect, useMemo, useRef, useState } from 'react';

/* A type-ahead picker for the 23 breeds. Same shape as components/CitySelect.jsx so the two
   behave identically: type to filter, arrow keys to move, Enter to choose, Escape to close.
   Free text is never accepted — it can only ever emit a name that exists in the list. */
export default function BreedSelect({ names, value, onChange, label = 'Breed' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return names;
    return names.filter((n) => n.toLowerCase().includes(q));
  }, [names, query]);

  // Clicking anywhere else closes the list and forgets a half-typed query.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setQuery(''); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown); };
  }, [open]);

  const choose = (name) => {
    onChange(name);
    setOpen(false);
    setQuery('');
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setHighlight((h) => {
        const next = e.key === 'ArrowDown' ? h + 1 : h - 1;
        return Math.max(0, Math.min(matches.length - 1, next));
      });
    } else if (e.key === 'Enter') {
      if (open && matches[highlight]) { e.preventDefault(); choose(matches[highlight]); }
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); setOpen(false); setQuery(''); }
    }
  };

  return (
    <div className="pbhc__sel" ref={wrapRef}>
      <input
        ref={inputRef}
        className="pbhc__selinput"
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls="pbhc-breed-list"
        aria-autocomplete="list"
        aria-label={label}
        value={open ? query : value}
        placeholder={value}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onKeyDown={onKey}
      />
      <span className="pbhc__selarrow" aria-hidden="true">▾</span>
      {open && (
        <ul className="pbhc__sellist" id="pbhc-breed-list" role="listbox" aria-label={label}>
          {matches.length === 0 && <li className="pbhc__selempty">No breed by that name</li>}
          {matches.map((n, i) => (
            <li key={n}>
              <button
                type="button"
                role="option"
                aria-selected={n === value}
                className={`pbhc__selopt${i === highlight ? ' is-hi' : ''}${n === value ? ' is-sel' : ''}`}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => choose(n)}
              >
                {n}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
