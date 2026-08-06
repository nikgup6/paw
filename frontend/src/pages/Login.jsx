import { useState, useContext } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Login = () => {
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userData = await login(mobile, "PawBuddy@123");
      if (userData?.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate(from);
      }
    } catch (err) {
      setError('Login failed. Check credentials.');
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
        <h2 className="auth-title">Welcome Back</h2>
        <p className="auth-sub">Log in to your Paw Buddy account</p>
        
        {error && <div className="auth-error" style={{ marginBottom: '15px' }}>{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="auth-field">
            <label>Mobile Number</label>
            <input type="text" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="Enter 10-digit mobile" required />
          </div>

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
