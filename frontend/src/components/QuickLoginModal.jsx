import { useEffect } from 'react';
import ContactCapture from './auth/ContactCapture';

/**
 * The contact screen in a modal. A thin wrapper: the form itself, and the rule
 * that a mobile number is a contact detail and never a login, live in
 * components/auth/ContactCapture.jsx.
 *
 * Fallback for people who reach a gated screen without a token (Results, the
 * owner survey, the paywall's unlock). Most people already gave their details
 * before question 1 of the quiz and never see this.
 *
 *   onClose     shows a Close button and lets Escape close it. Without it the
 *               modal cannot be dismissed, as the post-results gate needs.
 *   title, sub  replace the heading and the line under it.
 */
const QuickLoginModal = ({ isOpen, onSuccess, onClose, title, sub }) => {
  useEffect(() => {
    if (!isOpen || !onClose) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="auth-overlay open cc-overlay" style={{ pointerEvents: 'auto' }}>
      <div className="auth-box" role="dialog" aria-modal="true" style={{ position: 'relative' }}>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ position: 'absolute', top: 10, right: 10, width: 44, height: 44, border: 0, borderRadius: '50%',
                     background: 'transparent', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: '#011E4A' }}>
            {'×'}
          </button>
        )}
        <ContactCapture
          title={title || 'One last step!'}
          sub={sub || "Save your results so you don't lose them. Just your name and number."}
          onDone={() => onSuccess?.()}
          autoFocus
        />
      </div>
    </div>
  );
};

export default QuickLoginModal;
