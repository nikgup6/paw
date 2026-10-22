import { useContext, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { sessionId, track, trackOnce } from '../../utils/analytics';
import { AGE_RANGES, emailProblem, mobileProblem, nameProblem, normaliseMobile } from './contactRules';
import './ContactCapture.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/* Private mode or blocked site data: the token cannot be kept past this tab. */
function storageWorks() {
  try {
    localStorage.setItem('pb_storage_probe', '1');
    localStorage.removeItem('pb_storage_probe');
    return true;
  } catch {
    return false;
  }
}

/**
 * The contact screen: name, mobile, optional email and age range, one button.
 *
 * There is no login by mobile number. Nobody can prove a number is theirs yet
 * (no OTP), so each Continue makes a NEW account that belongs to this browser,
 * and the number is kept only as an unverified contact detail. That is why
 * this screen never says "sign in" or "verify".
 *
 * Used before question 1 of the quiz (pages/Home.jsx), inside QuickLoginModal
 * (the post-results and paywall fallbacks) and on /signup and /login.
 *
 *   onDone(user)  called once the account exists and the token is kept
 *   title, sub    replace the heading and the line under it
 *   autoFocus     focus the name field on open (off by default: on a phone it
 *                 throws the keyboard up before the person has seen the screen)
 */
/* How many contact forms are on screen (for contact_form_closed). */
let liveForms = 0;

const ContactCapture = ({ onDone, title, sub, autoFocus = false }) => {
  const { loginWithToken } = useContext(AuthContext);
  const uid = useId();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [ageRange, setAgeRange] = useState(null);   // never preselected, never required
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);
  const [visitOnly, setVisitOnly] = useState(null);  // the reply, held until the person has read the storage note

  const ids = { name: `${uid}-name`, mobile: `${uid}-mobile`, email: `${uid}-email`, title: `${uid}-title` };

  /* The entry funnel (Pilot tab): seen, started typing, error, closed. Codes
     only - never what was typed. Each is once per browser session. */
  const done = useRef(false);            // an account was created: leaving is not "closing"
  useEffect(() => {
    trackOnce('contact_form_viewed', 'form_session');
    liveForms += 1;
    return () => {
      liveForms -= 1;
      // Checked a beat later: React's development mode unmounts and remounts once,
      // and a form swapped for another form is not someone leaving.
      window.setTimeout(() => {
        if (!done.current && liveForms === 0) trackOnce('contact_form_closed', 'form_session');
      }, 0);
    };
  }, []);
  // A tap or a keystroke, not focus: the modal focuses the name field by itself.
  const onStart = () => trackOnce('contact_form_started', 'form_session');

  const onMobile = (e) => {
    // Pasting "+91 98765 43210" works; anything past 10 digits is dropped.
    setMobile(normaliseMobile(e.target.value).slice(0, 10));
    if (errors.mobile) setErrors((x) => ({ ...x, mobile: '' }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    const found = { name: nameProblem(name), mobile: mobileProblem(mobile), email: emailProblem(email) };
    setErrors(found);
    setFormError('');
    const first = ['name', 'mobile', 'email'].find((k) => found[k]);
    if (first) {
      track('contact_form_error', { field: first });
      document.getElementById(ids[first])?.focus();
      return;
    }

    // No name, number, email or age range in any event - only who-is-counting context.
    track('login_started');
    setSending(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/auth/contact`, {
        name: name.trim(),
        mobile,
        email: email.trim() || undefined,
        age_range: ageRange || undefined,
        session_id: sessionId || undefined,
      });
      done.current = true;
      if (storageWorks()) {
        loginWithToken(data.access_token, data.user);
        track('login_completed');
        onDone?.(data.user);
      } else {
        // Signing in here would swap this screen for the quiz before the note is read.
        track('login_completed');
        setVisitOnly(data);
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === 'object' && !Array.isArray(detail) && detail.field) {
        track('contact_form_error', { field: detail.field });
        setErrors({ [detail.field]: detail.message });
        document.getElementById(ids[detail.field])?.focus();
      } else if (typeof detail === 'string' && err.response.status === 429) {
        track('contact_form_error', { reason: 'rate_limited' });
        setFormError(detail);                       // the limiter's own plain sentence
      } else if (!err?.response) {
        track('contact_form_error', { reason: 'network' });
        setFormError("We couldn't reach PAW BUDDY. Check your internet and try again.");
      } else {
        setFormError('Something went wrong on our side. Please try again.');
      }
    } finally {
      setSending(false);
    }
  };

  if (visitOnly) {
    return (
      <div className="cc" role="status">
        <h2 className="auth-title" id={ids.title}>You're in for this visit</h2>
        <p className="cc-note">
          Your browser is blocking this site from saving anything, so we can only keep your
          details until you close this tab. Everything works as normal until then.
        </p>
        <button type="button" className="auth-btn cc-continue" onClick={() => { loginWithToken(visitOnly.access_token, visitOnly.user); onDone?.(visitOnly.user); }}>
          Continue
        </button>
      </div>
    );
  }

  const fieldError = (key) => errors[key] && (
    <p className="cc-field-error" id={`${ids[key]}-error`}>{errors[key]}</p>
  );
  const describedBy = (key) => (errors[key] ? `${ids[key]}-error` : undefined);

  return (
    <form className="cc" onSubmit={submit} onPointerDown={onStart} onKeyDown={onStart} onInput={onStart} noValidate aria-labelledby={ids.title}>
      <h2 className="auth-title" id={ids.title}>{title || 'Before we start'}</h2>
      <p className="auth-sub cc-sub">
        {sub || 'Tell us who you are, so we can share your dog matches with you.'}
      </p>

      <div className="auth-field">
        <label htmlFor={ids.name}>Name</label>
        <input
          id={ids.name}
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((x) => ({ ...x, name: '' })); }}
          autoComplete="name"
          autoCapitalize="words"
          maxLength={80}
          autoFocus={autoFocus}
          aria-invalid={!!errors.name}
          aria-describedby={describedBy('name')}
        />
        {fieldError('name')}
      </div>

      <div className="auth-field">
        <label htmlFor={ids.mobile}>Mobile number</label>
        <div className={`cc-phone${errors.mobile ? ' cc-phone--error' : ''}`}>
          <span className="cc-phone__prefix" aria-hidden="true">+91</span>
          <input
            id={ids.mobile}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={mobile}
            onChange={onMobile}
            placeholder="10-digit number"
            aria-invalid={!!errors.mobile}
            aria-describedby={describedBy('mobile')}
          />
        </div>
        {fieldError('mobile')}
      </div>

      <div className="auth-field">
        <label htmlFor={ids.email}>Email <span className="cc-optional">(optional)</span></label>
        <input
          id={ids.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((x) => ({ ...x, email: '' })); }}
          aria-invalid={!!errors.email}
          aria-describedby={describedBy('email')}
        />
        {fieldError('email')}
      </div>

      <fieldset className="cc-ages">
        <legend>Age range <span className="cc-optional">(optional)</span></legend>
        <div className="cc-ages__chips">
          {AGE_RANGES.map(([code, label]) => (
            <button
              key={code}
              type="button"
              className="cc-chip"
              aria-pressed={ageRange === code}
              onClick={() => setAgeRange((cur) => (cur === code ? null : code))}  // tap again to clear
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {formError && <p className="auth-error cc-form-error" role="alert">{formError}</p>}

      <p className="cc-terms">
        We use your number only to share your results and breeder updates. By continuing you agree to
        our <Link to="/terms" target="_blank" rel="noopener">Terms</Link> and{' '}
        <Link to="/privacy" target="_blank" rel="noopener">Privacy Policy</Link>.
      </p>

      <button type="submit" className="auth-btn cc-continue" disabled={sending} aria-busy={sending}>
        {sending ? 'Saving…' : 'Continue'}
      </button>
    </form>
  );
};

export default ContactCapture;
