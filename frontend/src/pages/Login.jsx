import { useState, useContext } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

/* Placeholder every account was created with. Ordinary sign-in is by mobile
   number alone; this is sent only so the existing form contract is unchanged. */
const PLACEHOLDER_PASSWORD = 'PawBuddy@123';

const Login = () => {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  /* Only the admin account has a real password. Rather than showing everyone a
     field that 28 of 29 accounts must leave blank, the field appears when the
     server says this mobile needs one. */
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

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userData = await login(mobile, needsPassword ? password : PLACEHOLDER_PASSWORD);
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
      } else {
        setError('Login failed. Check credentials.');
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
          style={{
            background: 'var(--orange)', color: 'white', border: 'none',
            padding: '10px 20px', borderRadius: '50px', cursor: 'pointer',
            fontFamily: "'Poppins', sans-serif", fontWeight: 600,
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
        <h2 className="auth-title">{bouncedFromAdmin ? 'Administrator Sign In' : 'Welcome Back'}</h2>
        <p className="auth-sub">
          {bouncedFromAdmin
            ? 'The dashboard needs an administrator account.'
            : 'Log in to your Paw Buddy account'}
        </p>

        {/* Says plainly that a password is coming. Landing on a bare mobile
            field after clicking "Admin" is what made this look broken. */}
        {bouncedFromAdmin && !error && (
          <div
            style={{
              marginBottom: '15px', padding: '11px 14px', borderRadius: '12px',
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

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: 'var(--text-soft)' }}>
          Don't have an account? <Link to="/signup" state={{ from }} style={{ color: 'var(--orange)', fontWeight: 'bold', textDecoration: 'none' }}>Sign Up</Link>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Login;
