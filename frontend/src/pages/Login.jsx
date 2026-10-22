import { useState, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import ContactCapture from '../components/auth/ContactCapture';
import LegacyNumberLogin from '../components/auth/LegacyNumberLogin';

/* Two screens in one page.
   - Everyone else: the contact screen. There is no sign-in by mobile number
     (nobody can prove a number is theirs without OTP), so a visitor on a new
     browser simply gives their details again and gets a fresh account.
   - Administrators: mobile, then the real password - unchanged. */

const Login = () => {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  /* Only admin accounts have a password. The field appears once the server
     says this mobile is one. */
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';
  /* Set by ProtectedRoute when it bounced you here. "admin" means you followed
     a link into the dashboard — say so, otherwise the redirect reads as the
     link being broken. */
  const bouncedFromAdmin = location.state?.reason === 'admin';
  const [adminView, setAdminView] = useState(bouncedFromAdmin);
  const [dogOwnerView, setDogOwnerView] = useState(false);   // TEMPORARY number-only sign-in, until OTP

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // An empty password is only a question: "is this an admin number?"
      const userData = await login(mobile, needsPassword ? password : '');
      if (userData?.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate(from);
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail === 'admin_password_required') {
        if (!needsPassword) {
          setNeedsPassword(true);
          setError('This is an administrator account. Enter its password to continue.');
        } else {
          setError('That password is not right.');
        }
      } else if (err?.response?.status === 503) {
        setError('Administrator sign-in is not configured on the server.');
      } else if (err?.response?.status === 429) {
        setError(typeof detail === 'string' ? detail : 'Too many attempts. Please wait and try again.');
      } else {
        setError(needsPassword ? 'That password is not right.' : 'That number is not an administrator account.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-section" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--cream)', position: 'relative' }}>
      
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0' }}>
        <img src="/logo.png" alt="Paw Buddy" style={{ width: '140px', mixBlendMode: 'multiply', cursor: 'pointer' }} onClick={() => navigate('/')} />
        <button 
          onClick={() => navigate(-1)}
          className="auth-back"
          style={{
            background: 'var(--orange)', color: 'white', border: 'none',
            padding: '10px 20px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
            fontFamily: 'var(--font-body-family)', fontWeight: 'var(--weight-semibold)',
            transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(245,124,0,0.3)'
          }}
          onMouseOver={e => { e.currentTarget.style.transform = 'translateX(-2px)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = 'translateX(0)'; }}
        >
          ← Back
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="auth-box" style={{ maxWidth: '440px', width: '100%' }}>
        <div className="auth-logo">🐾</div>
        {dogOwnerView && !adminView ? (
          <>
            <h2 className="auth-title">Welcome back</h2>
            <p className="auth-sub">Sign in with the number your dog profile was made with.</p>
            <LegacyNumberLogin onDone={() => navigate('/app')} />
            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px' }}>
              <button type="button" className="auth-signup" onClick={() => setDogOwnerView(false)}
                style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--orange)', fontWeight: 'bold', font: 'inherit' }}>
                Back
              </button>
            </div>
          </>
        ) : !adminView ? (
          <>
            <ContactCapture
              title="Welcome to Paw Buddy"
              sub="No password needed. On a new phone or browser, just enter your details again."
              onDone={() => navigate(from)}
            />
            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px', color: 'var(--text-soft)' }}>
              <button type="button" className="auth-signup" onClick={() => setDogOwnerView(true)}
                style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--orange)', fontWeight: 'bold', font: 'inherit' }}>
                Already have a dog profile? Sign in with your number
              </button>
              <br />
              <button type="button" className="auth-signup" onClick={() => { setAdminView(true); setError(''); }}
                style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--orange)', fontWeight: 'bold', font: 'inherit' }}>
                Administrator sign in
              </button>
            </div>
          </>
        ) : (
        <>
        <h2 className="auth-title">Administrator Sign In</h2>
        <p className="auth-sub">
          {bouncedFromAdmin ? 'The dashboard needs an administrator account.' : 'For the PAW BUDDY team only.'}
        </p>

        {/* Says plainly that a password is coming. Landing on a bare mobile
            field after clicking "Admin" is what made this look broken. */}
        {!needsPassword && !error && (
          <div
            style={{
              marginBottom: '15px', padding: '11px 14px', borderRadius: 'var(--radius-sm)',
              background: '#FFF6E9', border: '1px solid #F5D9AE',
              color: '#7A5320', fontSize: '13px', lineHeight: 1.5, textAlign: 'left',
            }}
          >
            Enter the admin mobile number, then Log In — you’ll be asked for the
            administrator password on the next step.
          </div>
        )}

        {error && <div className="auth-error" style={{ marginBottom: '15px' }}>{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="auth-field">
            <label>Mobile Number</label>
            <input type="text" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="Enter 10-digit mobile" required />
          </div>

          {needsPassword && (
            <div className="auth-field">
              <label>Administrator Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter the admin password"
                autoFocus
                required
              />
            </div>
          )}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Logging In...' : 'Log In'}
          </button>
        </form>

        </>
        )}
      </div>
      </div>
    </div>
  );
};

export default Login;
