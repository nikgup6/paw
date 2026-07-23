import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const AuthModal = ({ isOpen, onClose, onSuccess }) => {
  const { login, register } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('signin'); // 'signin' or 'signup'
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sign up fields
  const [signUpData, setSignUpData] = useState({
    name: '',
    city: '',
    email: '',
    mobile: ''
  });

  if (!isOpen) return null;

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    if (!mobile || mobile.length !== 10) {
      setError('Mobile number must be exactly 10 digits.');
      return;
    }
    setLoading(true);
    try {
      await login(mobile, "PawBuddy@123");
      onSuccess();
    } catch (err) {
      setError('Login failed. Mobile number not registered.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpChange = (e) => {
    setSignUpData({ ...signUpData, [e.target.name]: e.target.value });
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    if (!signUpData.mobile || signUpData.mobile.length !== 10) {
      setError('Mobile number must be exactly 10 digits.');
      return;
    }
    setLoading(true);
    try {
      // 1. Register User
      await axios.post(`${API_URL}/api/auth/register`, {
        name: signUpData.name,
        mobile: signUpData.mobile,
        email: signUpData.email,
        city: signUpData.city,
        password: "PawBuddy@123",
        role: "USER"
      });

      // 2. Auto Login after Registration
      await login(signUpData.mobile, "PawBuddy@123");
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed. Mobile might already be registered.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay open" onClick={onClose} style={{ pointerEvents: 'auto' }}>
      <div className="auth-box" onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute', top: '15px', right: '20px',
            background: 'none', border: 'none', fontSize: '24px',
            cursor: 'pointer', color: 'var(--text-soft)', fontWeight: 'bold'
          }}
        >
          &times;
        </button>

        <div className="auth-logo">🐾</div>
        <h2 className="auth-title">Paw Buddy Account</h2>
        <p className="auth-sub">Save your results &amp; connect with breeders</p>
        
        <div className="auth-tabs">
          <button 
            className={`auth-tab ${activeTab === 'signin' ? 'active' : ''}`}
            onClick={() => { setActiveTab('signin'); setError(''); }}
          >
            Sign In
          </button>
          <button 
            className={`auth-tab ${activeTab === 'signup' ? 'active' : ''}`}
            onClick={() => { setActiveTab('signup'); setError(''); }}
          >
            Sign Up
          </button>
        </div>

        {error && <div className="auth-error" style={{ marginBottom: '15px' }}>{error}</div>}

        {activeTab === 'signin' ? (
          <form onSubmit={handleSignIn}>
            <div className="auth-field">
              <label>Mobile Number</label>
              <input 
                type="tel" 
                value={mobile} 
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))} 
                placeholder="Enter 10-digit mobile" 
                maxLength="10"
                required 
              />
            </div>
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUp}>
            <div className="auth-field" style={{ marginBottom: '10px' }}>
              <label>Full Name *</label>
              <input 
                type="text" 
                name="name"
                value={signUpData.name} 
                onChange={handleSignUpChange}
                placeholder="Your full name" 
                required 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div className="auth-field" style={{ marginBottom: 0 }}>
                <label>Mobile Number *</label>
                <input 
                  type="tel" 
                  name="mobile"
                  value={signUpData.mobile} 
                  onChange={(e) => setSignUpData({ ...signUpData, mobile: e.target.value.replace(/\D/g, '') })}
                  placeholder="10-digit mobile" 
                  maxLength="10"
                  required 
                />
              </div>
              <div className="auth-field" style={{ marginBottom: 0 }}>
                <label>City *</label>
                <input 
                  type="text" 
                  name="city"
                  value={signUpData.city} 
                  onChange={handleSignUpChange}
                  placeholder="e.g. Bangalore" 
                  required 
                />
              </div>
            </div>

            <div className="auth-field" style={{ marginBottom: '15px' }}>
              <label>Email *</label>
              <input 
                type="email" 
                name="email"
                value={signUpData.email} 
                onChange={handleSignUpChange}
                placeholder="your@email.com" 
                required 
              />
            </div>

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account →'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
