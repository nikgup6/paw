import ContactCapture from './auth/ContactCapture';

/* The "Paw Buddy Account" popup. Signing in by mobile number is gone (nobody
   can prove a number is theirs without OTP), so this is now the contact screen
   with a close button. See components/auth/ContactCapture.jsx. */
const AuthModal = ({ isOpen, onClose, onSuccess }) => {
  if (!isOpen) return null;

  return (
    <div className="auth-overlay open cc-overlay" onClick={onClose} style={{ pointerEvents: 'auto' }}>
      <div className="auth-box" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 10, right: 10, width: 44, height: 44,
            background: 'none', border: 'none', borderRadius: '50%', fontSize: '24px',
            cursor: 'pointer', color: 'var(--text-soft)', fontWeight: 'bold'
          }}
        >
          &times;
        </button>
        <ContactCapture
          title="Paw Buddy Account"
          sub="Save your results & connect with breeders"
          onDone={() => onSuccess?.()}
          autoFocus
        />
      </div>
    </div>
  );
};

export default AuthModal;
