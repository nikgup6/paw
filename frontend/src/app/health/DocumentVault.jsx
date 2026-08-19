import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import DocumentUploader from '../components/DocumentUploader';
import QuickFeedback from '../../components/QuickFeedback';
import {
  deleteDocument, fileUrl, listDocuments, listPrescriptions, reprocessDocument,
} from '../../utils/healthVault';
import { formatDay, formatTimestamp, parseServerDate } from '../../utils/healthStatus';

/* Every file uploaded for one dog: the original on Cloudinary, when it landed,
   what the scanner made of it, and how many records came out.

   Prescriptions live here too rather than in a section of their own — the file
   and what was read off it are the same thing to an owner, so a prescription row
   expands to show the medicines inline.

   Deleting is deliberately a question, not an action. The scan is usually the
   disposable part — a duplicate, a bad photo — while the records read off it are
   the valuable part, so those survive unless the owner explicitly says otherwise. */

const Medicines = ({ rx }) => (
  <div className="pb-doc__rx">
    <p className="pb-doc__rxhead">
      {[rx.doctor, rx.clinic_name, rx.prescribed_date && formatDay(rx.prescribed_date)]
        .filter(Boolean).join(' · ') || 'Prescription'}
      {rx.diagnosis && <em> — {rx.diagnosis}</em>}
    </p>
    <ul>
      {(rx.medicines || []).map((m, i) => (
        <li key={`${m.name}-${i}`}>
          <strong>{m.name}</strong>
          <span>{[m.dosage, m.frequency, m.duration].filter(Boolean).join(' · ') || '—'}</span>
          {m.notes && <em>{m.notes}</em>}
        </li>
      ))}
    </ul>
  </div>
);

const DOC_TYPES = [
  { value: 'vaccination', label: 'Vaccination certificate' },
  { value: 'prescription', label: 'Prescription' },
];

const AI_STATUS = {
  Completed: { label: 'Analysed', tone: 'completed' },
  'Needs Review': { label: 'Needs review', tone: 'needs-review' },
  Failed: { label: 'Analysis failed', tone: 'overdue' },
  Processing: { label: 'Analysing…', tone: 'upcoming' },
  Pending: { label: 'Not analysed', tone: 'neutral' },
};

const formatSize = (bytes) => {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const DocumentVault = () => {
  const { dog, dogId } = useOutletContext();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [docType, setDocType] = useState('vaccination');
  const [preview, setPreview] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [retrying, setRetrying] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);

  const load = useCallback(async (spinner = false) => {
    if (spinner) setLoading(true);
    /* Independent requests, independent failures: the document list is the
       page's reason to exist, so it still renders even if the prescriptions
       call fails on its own (offline with an incomplete cache, a slow network,
       whatever) — the medicine details inline under a document just won't
       appear for that one card, rather than the whole page going blank. */
    const [docsResult, rxResult] = await Promise.allSettled([listDocuments(dogId), listPrescriptions(dogId)]);
    if (docsResult.status === 'fulfilled') {
      setDocs(docsResult.value);
      setError('');
    } else {
      setError('Couldn’t load this dog’s documents. Please try again.');
    }
    setPrescriptions(rxResult.status === 'fulfilled' ? rxResult.value : []);
    if (spinner) setLoading(false);
  }, [dogId]);

  /* The first fetch owns the page spinner. Later calls to load() — after an
     upload, a delete, a retry — refresh in place instead of blanking the page. */
  useEffect(() => {
    (async () => { await load(true); })();
  }, [load]);

  const retryScan = async (doc) => {
    setRetrying(doc.id);
    try {
      await reprocessDocument(doc.id);
      await load();
    } catch {
      setError('Couldn’t re-run that scan. Please try again.');
    } finally {
      setRetrying(null);
    }
  };

  const confirmDelete = async (doc, alsoRecords) => {
    setPendingDelete(null);
    try {
      await deleteDocument(doc.id, alsoRecords);
    } catch {
      setError('Couldn’t delete that document. Refresh to see its current state.');
    }
    load();
  };

  return (
    <>
      <section className="pb-card">
        <div className="pb-card__head">
          <div>
            <h3 className="pb-card__title">Add to {dog.name}’s vault</h3>
            <p className="pb-card__sub">Certificates and prescriptions are read automatically.</p>
          </div>
        </div>

        <label className="pb-field" style={{ maxWidth: 320, marginBottom: 14 }}>
          <span>Document type</span>
          <select value={docType} onChange={(e) => setDocType(e.target.value)}>
            {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>

        <DocumentUploader dogId={dogId} documentType={docType} onUploaded={load} />
      </section>

      <section className="pb-card">
        <div className="pb-card__head">
          <div>
            <h3 className="pb-card__title">Stored documents</h3>
            <p className="pb-card__sub">Newest first.</p>
          </div>
          {docs.length > 0 && <span className="pb-pill is-neutral">{docs.length}</span>}
        </div>

        {error && <p className="pb-error" role="alert">{error}</p>}

        {loading ? (
          <div className="pb-loading"><span className="pb-spin" aria-hidden="true" /> Loading documents…</div>
        ) : docs.length === 0 ? (
          <div className="pb-empty">
            <span className="pb-empty__icon" aria-hidden="true">🗂️</span>
            <strong>Nothing stored yet</strong>
            Upload a certificate or prescription above.
          </div>
        ) : (
          <ul className="pb-docs">
            {docs.map((doc) => {
              const ai = AI_STATUS[doc.processing_status] || AI_STATUS.Pending;
              const isPdf = String(doc.original_filename || '').toLowerCase().endsWith('.pdf');
              const canRetry = doc.processing_status === 'Failed' || doc.processing_status === 'Pending';
              return (
                <li className="pb-doc" key={doc.id}>
                  <div className={`pb-doc__thumb ${isPdf ? 'is-pdf' : ''}`}>
                    {isPdf ? <span>PDF</span> : <img src={fileUrl(doc.id)} alt="" loading="lazy" />}
                  </div>

                  <div className="pb-doc__meta">
                    <span className="pb-doc__name" title={doc.original_filename}>{doc.original_filename}</span>
                    <span className="pb-doc__sub">
                      {formatSize(doc.file_size) && <>{formatSize(doc.file_size)} · </>}
                      {formatTimestamp(parseServerDate(doc.uploaded_at))}
                      {doc.vaccination_count > 0 && <> · {doc.vaccination_count} record{doc.vaccination_count > 1 ? 's' : ''} extracted</>}
                    </span>
                    <span className="pb-doc__tags">
                      <span className="pb-pill is-neutral">{String(doc.document_type || '').replace('_', ' ')}</span>
                      <span className={`pb-pill is-${ai.tone}`}>
                        {retrying === doc.id ? <><span className="pb-spin pb-spin--sm" aria-hidden="true" /> Analysing…</> : ai.label}
                      </span>
                      {doc.confidence_score != null && (
                        <span className="pb-doc__conf">{Math.round(doc.confidence_score * 100)}% confident</span>
                      )}
                    </span>
                    {doc.ai_summary && <span className="pb-doc__summary">{doc.ai_summary}</span>}
                    {prescriptions.filter((rx) => rx.source_document_id === doc.id)
                      .map((rx) => <Medicines key={rx.id} rx={rx} />)}
                    {doc.processing_status === 'Failed' && doc.ai_metadata?.last_error && (
                      <span className="pb-doc__err">{doc.ai_metadata.last_error}</span>
                    )}

                    {/* Asked only where there is something to judge: the scan
                        finished AND pulled records out. "Did it get the details
                        right?" is unanswerable on a failed or empty scan, and
                        this is the one place an owner can actually compare what
                        was read against the document sitting next to it. */}
                    {(doc.processing_status === 'Completed' || doc.processing_status === 'Needs Review')
                      && doc.vaccination_count > 0 && (
                      <QuickFeedback
                        context="vaccination_scan"
                        contextId={doc.id}
                        question="Did the scan get the details right?"
                      />
                    )}
                  </div>

                  <div className="pb-doc__actions">
                    {canRetry && (
                      <button type="button" className="pb-btn pb-btn--sm" onClick={() => retryScan(doc)} disabled={retrying === doc.id}>
                        Retry scan
                      </button>
                    )}
                    <button type="button" className="pb-btn pb-btn--sm" onClick={() => setPreview({ ...doc, isPdf })}>View</button>
                    <a className="pb-btn pb-btn--sm" href={fileUrl(doc.id, { download: true })} target="_blank" rel="noreferrer">
                      Download
                    </a>
                    <button type="button" className="pb-btn pb-btn--sm pb-btn--danger" onClick={() => setPendingDelete(doc)}>
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---- preview ---- */}
      {preview && (
        <div className="pb-overlay" role="dialog" aria-modal="true" aria-label={`Preview of ${preview.original_filename}`} onClick={() => setPreview(null)}>
          <div className="pb-modal pb-modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="pb-modal__bar">
              <span title={preview.original_filename}>{preview.original_filename}</span>
              <button type="button" onClick={() => setPreview(null)} aria-label="Close preview">×</button>
            </div>
            {preview.isPdf
              ? <iframe className="pb-doc__frame" src={fileUrl(preview.id)} title={preview.original_filename} />
              : <img className="pb-doc__full" src={fileUrl(preview.id)} alt={preview.original_filename} />}
          </div>
        </div>
      )}

      {/* ---- delete: the owner decides what happens to the extracted data ---- */}
      {pendingDelete && (
        <div className="pb-overlay" role="dialog" aria-modal="true" aria-label="Delete document" onClick={() => setPendingDelete(null)}>
          <div className="pb-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="pb-modal__bar">
              <span>Delete this document?</span>
              <button type="button" onClick={() => setPendingDelete(null)} aria-label="Cancel">×</button>
            </div>
            <div className="pb-modal__body">
              <p style={{ margin: '0 0 8px', fontWeight: 700, color: 'var(--brown)', fontSize: 14 }}>
                {pendingDelete.original_filename}
              </p>
              <p className="pb-card__sub" style={{ lineHeight: 1.6 }}>
                {pendingDelete.vaccination_count > 0
                  ? `We read ${pendingDelete.vaccination_count} record${pendingDelete.vaccination_count > 1 ? 's' : ''} from this document. Keep them in ${dog.name}’s history, or remove them along with the file?`
                  : 'No medical records came from this document, so only the file will be removed.'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
                <button type="button" className="pb-btn pb-btn--block" onClick={() => confirmDelete(pendingDelete, false)}>
                  Delete document only
                </button>
                {pendingDelete.vaccination_count > 0 && (
                  <button type="button" className="pb-btn pb-btn--block pb-btn--danger" onClick={() => confirmDelete(pendingDelete, true)}>
                    Delete document + {pendingDelete.vaccination_count} extracted record{pendingDelete.vaccination_count > 1 ? 's' : ''}
                  </button>
                )}
                <button type="button" className="pb-btn pb-btn--block" style={{ border: 'none' }} onClick={() => setPendingDelete(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .pb-docs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
        .pb-doc {
          display: flex; align-items: center; gap: 12px;
          background: var(--white); border: 1px solid var(--border); border-radius: 14px; padding: 11px 12px;
          transition: border-color .2s ease, box-shadow .2s ease;
        }
        .pb-doc:hover { border-color: rgba(227,93,24,.35); box-shadow: 0 6px 16px -10px rgba(61,41,28,.4); }
        .pb-doc__thumb {
          flex: 0 0 46px; width: 46px; height: 46px; border-radius: 10px; overflow: hidden;
          background: var(--cream); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
        }
        .pb-doc__thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .pb-doc__thumb.is-pdf { background: #FFF1F1; border-color: #F3D3D3; }
        .pb-doc__thumb.is-pdf span { color: #C0392B; font-size: 11px; font-weight: var(--weight-bold); }
        .pb-doc__meta { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .pb-doc__name {
          color: var(--brown); font-size: 14px; font-weight: var(--weight-semibold);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pb-doc__sub { color: var(--text-soft); font-size: 11.5px; }
        .pb-doc__tags { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .pb-doc__conf { font-size: 11px; color: var(--text-soft); }
        .pb-doc__summary { font-size: 12.5px; color: var(--brown); line-height: 1.45; }
        .pb-doc__rx {
          margin-top: 8px; padding: 9px 11px; border-radius: 10px;
          background: var(--cream); border: 1px solid #F0EAE3;
        }
        .pb-doc__rxhead { margin: 0 0 6px; font-size: 11.5px; color: var(--text-soft); font-weight: var(--weight-semibold); }
        .pb-doc__rxhead em { font-style: normal; color: var(--brown); }
        .pb-doc__rx ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
        .pb-doc__rx li { display: flex; gap: 8px; flex-wrap: wrap; align-items: baseline; font-size: 12px; }
        .pb-doc__rx li strong { color: var(--brown); font-weight: var(--weight-bold); }
        .pb-doc__rx li span { color: var(--text-soft); }
        .pb-doc__rx li em { color: var(--text-soft); font-style: italic; font-size: 11px; }

        .pb-doc__err { font-size: 11.5px; color: #B23B3B; line-height: 1.45; }
        .pb-doc__actions { display: flex; gap: 7px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
        .pb-doc__frame { width: 100%; height: 78dvh; border: none; display: block; }
        .pb-doc__full { max-width: 100%; max-height: calc(90dvh - 54px); object-fit: contain; display: block; margin: auto; }
        @media (max-width: 620px) {
          .pb-doc { flex-wrap: wrap; }
          .pb-doc__meta { flex: 1 1 60%; }
          .pb-doc__actions { flex: 1 1 100%; justify-content: flex-end; }
          .pb-doc__frame { height: 70dvh; }
        }
      `}</style>
    </>
  );
};

export default DocumentVault;
