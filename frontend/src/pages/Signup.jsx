import { useState, useContext } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";


const Signup = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    city: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.mobile || formData.mobile.length !== 10) {
      return setError('Mobile number must be exactly 10 digits.');
    }

    setLoading(true);
    try {
      // 1. Register User
      await axios.post(`${API_URL}/api/auth/register`, {
        name: formData.name,
        mobile: formData.mobile,
        email: formData.email,
        city: formData.city,
        password: "PawBuddy@123",
        role: "USER"
      });

      // 2. Auto Login after Registration
      await login(formData.mobile, "PawBuddy@123");
      navigate(from);
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed. Mobile might already be registered.');
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
        <h2 className="auth-title">Join Paw Buddy</h2>
        <p className="auth-sub">Create your account to save your matches</p>
        
        {error && <div className="auth-error" style={{ marginBottom: '15px' }}>{error}</div>}
        
        <form onSubmit={handleSignup}>
          <div className="auth-field">
            <label>Full Name *</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Enter your name" required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div className="auth-field">
              <label>Mobile Number *</label>
              <input type="text" name="mobile" value={formData.mobile} onChange={handleChange} placeholder="10-digit mobile" required />
            </div>
            <div className="auth-field">
              <label>City *</label>
              <input type="text" name="city" value={formData.city} onChange={handleChange} placeholder="e.g. Bangalore" required />
            </div>
          </div>

          <div className="auth-field">
            <label>Email *</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="your@email.com" required />
          </div>



          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Signing Up...' : 'Sign Up'}
          </button>
        </form>
        
        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: 'var(--text-soft)' }}>
          Already have an account? <Link to="/login" state={{ from }} style={{ color: 'var(--orange)', fontWeight: 'bold', textDecoration: 'none' }}>Log In</Link>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Signup;
