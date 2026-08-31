import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Post-quiz / post-survey login gate.
 *
 * Only name and mobile are required; email is optional. The modal CANNOT be
 * dismissed — the user must either sign in (if their mobile is already known)
 * or register (name + mobile, email optional) to continue.
 *
 * Styling reuses the existing .auth-* classes from index.css so the look
 * matches the rest of the application.
 */
const QuickLoginModal = ({ isOpen, onSuccess }) => {
  const { login } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedMobile = mobile.replace(/\D/g, '');
    if (!trimmedMobile || trimmedMobile.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }

    setLoading(true);
    try {
      // Quick-register: creates the account if new, returns existing if not.
      // This is the primary path — it always succeeds for a valid mobile.
      await axios.post(`${API_URL}/api/auth/quick-register`, {
        name: name.trim(),
        mobile: trimmedMobile,
        email: email.trim() || undefined,
      });

      // Now sign in through the AuthContext so the whole app sees the login.
      // Every account uses the same default password, so this always works
      // once the account exists (which quick-register guarantees).
      await login(trimmedMobile, 'PawBuddy@123');
      onSuccess?.();
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
        'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay open" style={{ pointerEvents: 'auto' }}>
      <div className="auth-box" style={{ position: 'relative' }}>
        {/* No close button — this gate cannot be skipped */}

        <div className="auth-logo">🐾</div>
        <h2 className="auth-title">One last step!</h2>
        <p className="auth-sub">
          Save your results so you don't lose them. Just your name and number —
          that's all we need, and only this once.
        </p>

        {/* The same three-up strip the /login screen shows, from the shared
            .auth-strip rules in index.css. One component for both auth
            surfaces: this gate and Welcome Back are the two places someone is
            asked for a number, and they should not argue about what they get
            for it.

            Each label names something the product genuinely does. Note the
            middle one is deliberately about vaccination RECORDS: uploading a
            prescription creates no reminders (PrescriptionProcessor sets
            creates_reminders = False), so promising otherwise would send
            people down a dead end. */}
        <div className="auth-strip">
          <div className="auth-strip__item">
            <span className="auth-strip__icon" aria-hidden="true">💉</span>
            <span className="auth-strip__label">Vaccination reminders</span>
          </div>
          <div className="auth-strip__item">
            <span className="auth-strip__icon" aria-hidden="true">🏥</span>
            <span className="auth-strip__label">Verified services</span>
          </div>
          <div className="auth-strip__item">
            <span className="auth-strip__icon" aria-hidden="true">🩺</span>
            <span className="auth-strip__label">Personalized tips</span>
          </div>
        </div>

        {error && (
          <div className="auth-error" style={{ marginBottom: '15px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>Full Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
              autoFocus
            />
          </div>

          <div className="auth-field">
            <label>Mobile Number *</label>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
              placeholder="10-digit mobile number"
              maxLength="10"
              required
            />
          </div>

          <div className="auth-field">
            <label>Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>

          <button
            type="submit"
            className="auth-btn"
            disabled={loading}
            style={{ marginTop: '16px' }}
          >
            {loading ? 'Saving…' : 'Save & Continue →'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default QuickLoginModal;
