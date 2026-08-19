import { useState } from 'react';
import Portal from './Portal';
import { ICON_CHOICES, saveCareItems } from '../../utils/dailyCare';

/* Edit which habits the routine card tracks.

   The whole list is edited locally and saved in one call, so a half-finished
   edit never reaches the server and Cancel genuinely cancels.

   Existing rows carry their `code` through untouched — that is what keeps
   today's ticks attached across a rename. New rows have no code; the server
   assigns one. Removing a row stops showing the habit but does not rewrite
   the days it was already ticked on. */

const MAX_ITEMS = 10;
const MAX_LABEL = 28;

const RoutineEditor = ({ dogId, items, onSaved, onClose }) => {
  const [rows, setRows] = useState(() => items.map((i) => ({ ...i })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [iconFor, setIconFor] = useState(null);   // index whose picker is open

  const patch = (index, changes) =>
    setRows((list) => list.map((row, i) => (i === index ? { ...row, ...changes } : row)));

  const remove = (index) => setRows((list) => list.filter((_, i) => i !== index));

  const add = () => {
    if (rows.length >= MAX_ITEMS) return;
    setRows((list) => [...list, { label: '', icon: '🐾' }]);
  };

  const save = async () => {
    const cleaned = rows
      .map((r) => ({ ...r, label: r.label.trim() }))
      .filter((r) => r.label);
    if (cleaned.length === 0) {
      setError('Keep at least one item — or close without saving.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      onSaved(await saveCareItems(dogId, cleaned));
      onClose();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Couldn’t save that list.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
    <div className="pb-overlay" role="dialog" aria-modal="true" aria-label="Edit routine care" onClick={onClose}>
      <div className="pb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pb-modal__bar">
          <span>Edit routine care</span>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="pb-modal__body">
          <p className="pb-red__hint">
            Rename anything, remove what you don’t track, or add your own.
            Today’s ticks stay put when you rename an item.
          </p>

          <ul className="pb-red__list">
            {rows.map((row, index) => (
              <li key={row.code || `new-${index}`} className="pb-red__row">
                <div className="pb-red__iconwrap">
                  <button
                    type="button"
                    className="pb-red__icon"
                    onClick={() => setIconFor(iconFor === index ? null : index)}
                    aria-label={`Choose an icon for ${row.label || 'this item'}`}
                  >
                    {row.icon || '🐾'}
                  </button>
                  {iconFor === index && (
                    <div className="pb-red__picker">
                      {ICON_CHOICES.map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          className="pb-red__pick"
                          onClick={() => { patch(index, { icon }); setIconFor(null); }}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <input
                  className="pb-red__input"
                  value={row.label}
                  maxLength={MAX_LABEL}
                  placeholder="e.g. Evening medicine"
                  onChange={(e) => patch(index, { label: e.target.value })}
                />

                <button
                  type="button"
                  className="pb-red__del"
                  onClick={() => remove(index)}
                  aria-label={`Remove ${row.label || 'this item'}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          {rows.length < MAX_ITEMS && (
            <button type="button" className="pb-btn pb-btn--sm" onClick={add} style={{ marginTop: 10 }}>
              ＋ Add an item
            </button>
          )}

          {error && <p className="pb-error" role="alert" style={{ marginTop: 12 }}>{error}</p>}

          <div className="pb-modal__actions">
            <button type="button" className="pb-btn" onClick={onClose}>Cancel</button>
            <button type="button" className="pb-btn pb-btn--primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save list'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .pb-red__hint { margin: 0 0 14px; color: var(--text-soft); font-size: 12.5px; line-height: 1.6; }
        .pb-red__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .pb-red__row { display: flex; align-items: center; gap: 8px; }

        .pb-red__iconwrap { position: relative; flex: 0 0 auto; }
        .pb-red__icon {
          width: 44px; height: 44px; border-radius: 12px; cursor: pointer;
          border: 1px solid var(--border-strong); background: var(--cream); font-size: 18px;
          -webkit-tap-highlight-color: transparent;
        }
        .pb-red__picker {
          position: absolute; z-index: 20; top: calc(100% + 6px); left: 0;
          display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px;
          padding: 7px; width: 236px;
          background: #fff; border: 1px solid var(--border-strong); border-radius: 12px;
          box-shadow: 0 18px 40px rgba(61,41,28,.18);
        }
        .pb-red__pick {
          width: 34px; height: 34px; border: none; background: none;
          border-radius: 8px; font-size: 17px; cursor: pointer;
        }
        .pb-red__pick:active { background: var(--cream); }
        @media (hover: hover) { .pb-red__pick:hover { background: var(--cream); } }

        .pb-red__input {
          flex: 1 1 auto; min-width: 0; padding: 11px 13px;
          border: 1px solid var(--border-strong); border-radius: 12px; background: #fff;
          font-family: inherit; font-size: 15px; color: var(--brown); outline: none;
        }
        .pb-red__input:focus { border-color: var(--orange); box-shadow: 0 0 0 3px rgba(227,93,24,.12); }

        .pb-red__del {
          flex: 0 0 auto; width: 38px; height: 38px; border-radius: 10px;
          border: 1px solid #F2C9C9; background: #FFF5F5; color: #B23B3B;
          font-size: 18px; line-height: 1; cursor: pointer;
        }
        .pb-red__del:active { background: #FFE9E9; }
      `}</style>
    </div>
    </Portal>
  );
};

export default RoutineEditor;
