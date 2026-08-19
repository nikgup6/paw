import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadDocument } from '../../utils/healthVault';

/* Drag-and-drop / browse / camera capture for one dog's medical documents.

   Shared by the Document Vault and Medical Logs so there is a single upload
   implementation: the vault lets the owner pick the document type, Medical Logs
   pins it to "prescription". Every upload carries the dog id it was rendered
   with, so a file can only ever land in the dog whose page you're on.

   The file goes to the server, which stores the original on Cloudinary and runs
   the AI scanner; `onUploaded` fires when that comes back so the page can
   refresh its lists. */

const ACCEPTED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
const ACCEPTED_EXT = ['jpg', 'jpeg', 'png', 'pdf'];
const MAX_FILE_MB = 10;

const extOf = (name) => String(name).split('.').pop().toLowerCase();

const DocumentUploader = ({ dogId, documentType, onUploaded, hint }) => {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState([]);        // filenames currently uploading
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const [camera, setCamera] = useState('idle'); // 'idle' | 'starting' | 'live' | 'error'
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const addFiles = useCallback(async (fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;

    const accepted = [];
    const rejected = [];
    for (const file of incoming) {
      const okType = ACCEPTED_MIME.includes(file.type) || ACCEPTED_EXT.includes(extOf(file.name));
      if (!okType) { rejected.push(`${file.name} (unsupported type)`); continue; }
      if (file.size > MAX_FILE_MB * 1024 * 1024) { rejected.push(`${file.name} (over ${MAX_FILE_MB}MB)`); continue; }
      accepted.push(file);
    }
    setError(rejected.length ? `Couldn’t add: ${rejected.join(', ')}` : '');
    if (!accepted.length) return;

    setBusy((list) => [...list, ...accepted.map((f) => f.name)]);
    for (const file of accepted) {
      try {
        const saved = await uploadDocument(dogId, file, documentType);
        onUploaded?.(saved);
      } catch (e) {
        setError(e?.response?.data?.detail || `Couldn’t upload ${file.name}. Please try again.`);
      } finally {
        setBusy((list) => list.filter((name) => name !== file.name));
      }
    }
  }, [dogId, documentType, onUploaded]);

  /* ---- camera capture (desktop webcam or phone; needs https or localhost) ---- */
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const openCamera = async () => {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera('error');
      setCameraError('Camera isn’t available on this device or browser. You can still upload a photo instead.');
      return;
    }
    setCamera('starting');
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      setCamera('live');
    } catch (err) {
      stopStream();
      setCamera('error');
      setCameraError(err?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow access in your browser, or upload a photo instead.'
        : 'Couldn’t start the camera. You can upload a photo instead.');
    }
  };

  const closeCamera = useCallback(() => { stopStream(); setCamera('idle'); setCameraError(''); }, [stopStream]);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      addFiles([new File([blob], `${documentType}-photo-${stamp}.jpg`, { type: 'image/jpeg' })]);
      closeCamera();
    }, 'image/jpeg', 0.92);
  };

  // Attach the stream once <video> is mounted; release it if we unmount live.
  useEffect(() => {
    if (camera === 'live' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [camera]);
  useEffect(() => () => stopStream(), [stopStream]);

  return (
    <div className="pb-up">
      <div
        className={`pb-up__drop ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
        role="button"
        tabIndex={0}
        aria-label="Upload a document"
      >
        <span className="pb-up__icon" aria-hidden="true">📄</span>
        <strong>Drag &amp; drop here</strong>
        <span className="pb-up__hint">{hint || <>or <u>browse</u> from your device · JPG, JPEG, PNG, PDF up to {MAX_FILE_MB}MB</>}</span>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          hidden
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      <div className="pb-up__or">
        <span /><em>or</em><span />
      </div>
      <button type="button" className="pb-btn pb-btn--block" onClick={openCamera}>
        📷 Take a photo
      </button>

      {busy.length > 0 && (
        <div className="pb-loading" style={{ padding: '14px 0 2px' }}>
          <span className="pb-spin pb-spin--sm" aria-hidden="true" />
          Uploading &amp; analysing {busy.length} file{busy.length > 1 ? 's' : ''}…
        </div>
      )}
      {error && <p className="pb-error" role="alert">{error}</p>}

      {camera !== 'idle' && (
        <div className="pb-overlay" role="dialog" aria-modal="true" aria-label="Take a photo">
          <div className="pb-modal" style={{ maxWidth: 560, overflow: 'hidden' }}>
            <div className="pb-modal__bar">
              <span>Take a photo</span>
              <button type="button" onClick={closeCamera} aria-label="Close camera">×</button>
            </div>
            {camera === 'error' ? (
              <>
                <div className="pb-modal__body">
                  <div className="pb-empty">
                    <span className="pb-empty__icon" aria-hidden="true">📷</span>
                    {cameraError}
                  </div>
                </div>
                <div className="pb-modal__actions">
                  <button type="button" className="pb-btn pb-btn--primary" onClick={() => { closeCamera(); fileRef.current?.click(); }}>
                    Upload instead
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="pb-cam__stage">
                  <video ref={videoRef} playsInline muted />
                  {camera === 'starting' && <div className="pb-cam__loading">Starting camera…</div>}
                </div>
                <div className="pb-modal__actions">
                  <button type="button" className="pb-btn" onClick={closeCamera}>Cancel</button>
                  <button type="button" className="pb-btn pb-btn--primary" onClick={capturePhoto} disabled={camera !== 'live'}>
                    📸 Capture
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        .pb-up__drop {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          padding: 24px 18px; border-radius: 14px; cursor: pointer; text-align: center;
          border: 2px dashed #DFD4C8; background: var(--white);
          transition: border-color .2s ease, background .2s ease, transform .2s ease;
        }
        .pb-up__drop:hover, .pb-up__drop:focus-visible { border-color: var(--orange); background: #FFFCF9; outline: none; }
        .pb-up__drop.is-dragging { border-color: var(--orange); background: var(--orange-pale); transform: scale(1.01); }
        .pb-up__icon { font-size: 26px; }
        .pb-up__drop strong { color: var(--brown); font-size: 14.5px; }
        .pb-up__hint { color: var(--text-soft); font-size: 12.5px; }
        .pb-up__or { display: flex; align-items: center; gap: 12px; margin: 12px 0; }
        .pb-up__or span { flex: 1; height: 1px; background: var(--border-strong); }
        .pb-up__or em { color: var(--text-soft); font-size: 12px; font-weight: var(--weight-semibold); font-style: normal; }
        .pb-cam__stage { position: relative; background: #000; aspect-ratio: 4 / 3; display: flex; }
        .pb-cam__stage video { width: 100%; height: 100%; object-fit: cover; display: block; }
        .pb-cam__loading {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 14px; opacity: .85;
        }
      `}</style>
    </div>
  );
};

export default DocumentUploader;
