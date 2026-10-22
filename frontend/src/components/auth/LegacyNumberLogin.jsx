import { useContext, useId, useState } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { mobileProblem, normaliseMobile } from './contactRules';
import './ContactCapture.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/* "Already have a dog profile? Sign in with your number."

   TEMPORARY, until OTP: POST /api/auth/legacy-login lets an EXISTING dog owner
   whose number is on the server's allowlist sign in by number alone. Without
   OTP a number proves nothing, so the server keeps that list to the team's own
   numbers. Marketing visitors never come here; they use the contact form. Do
   not add a password back to this screen. */
const LegacyNumberLogin = ({ onDone }) => {
  const { loginWithToken } = useContext(AuthContext);
  const uid = useId();
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    const problem = mobileProblem(mobile);
    if (problem) { setError(problem); return; }
    setSending(true);
    setError('');
    try {
      const { data } = await axios.post(`${API_URL}/api/auth/legacy-login`, { mobile });
      loginWithToken(data.access_token, data.user);
      onDone?.(data.user);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail
        : !err?.response ? "We couldn't reach PAW BUDDY. Check your internet and try again."
          : "We couldn't find a dog profile for that number.");
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="cc" onSubmit={submit} noValidate>
      <div className="auth-field">
        <label htmlFor={`${uid}-m`}>Mobile number</label>
        <div className={`cc-phone${error ? ' cc-phone--error' : ''}`}>
          <span className="cc-phone__prefix" aria-hidden="true">+91</span>
          <input
            id={`${uid}-m`}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={mobile}
            onChange={(e) => { setMobile(normaliseMobile(e.target.value).slice(0, 10)); setError(''); }}
            placeholder="10-digit number"
            aria-invalid={!!error}
            aria-describedby={error ? `${uid}-err` : undefined}
          />
        </div>
        {error && <p className="cc-field-error" id={`${uid}-err`} role="alert">{error}</p>}
      </div>
      <button type="submit" className="auth-btn cc-continue" disabled={sending} aria-busy={sending}>
        {sending ? 'Checking…' : 'Sign in'}
      </button>
    </form>
  );
};

export default LegacyNumberLogin;
