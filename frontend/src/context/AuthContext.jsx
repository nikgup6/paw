import { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { identify, recallReadiness, saveProgress, track } from '../utils/analytics';
import { setVisitToken } from '../utils/apiAuth';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";


export const AuthContext = createContext();

/* localStorage can throw (private mode, blocked site data). Reading it must
   never take the whole site down, so every touch goes through these. */
const readStored = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const writeStored = (key, value) => {
  try { localStorage.setItem(key, value); return localStorage.getItem(key) === value; } catch { return false; }
};
const dropStored = (key) => { try { localStorage.removeItem(key); } catch { /* nothing stored */ } };

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => readStored('pb_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      // Decode or validate token if needed, for now just set user
      let parsed = null;
      try { parsed = JSON.parse(readStored('pb_user') || 'null'); } catch { /* unreadable: treat as none */ }
      if (parsed) {
        setUser(parsed);
        identify(parsed?.id);   // later events carry the account
      }
    }
    setLoading(false);
  }, [token]);

  const login = async (mobile, password) => {
    const readiness_code = recallReadiness();
    track('login_started', { readiness_code });

    // API Call later
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      username: mobile,
      password: password
    }, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const { access_token, user: userData } = response.data;
    setToken(access_token);
    setUser(userData);
    const stored = writeStored('pb_token', access_token) && writeStored('pb_user', JSON.stringify(userData));
    setVisitToken(stored ? null : access_token);

    /* Only after the call succeeds. Firing this alongside login_started would
       make the login step look 100% converting no matter how many people got
       their password wrong. */
    identify(userData?.id);
    track('login_completed', { readiness_code });
    saveProgress({ user_id: userData?.id });   // ties the session to the account
    return userData;
  };

  /* The contact form (components/auth/ContactCapture.jsx) already has a token
     from /api/auth/contact: keep it exactly where login() keeps one. Returns
     false when the browser would not store it - the token then lives in memory
     and the person stays signed in for this visit only. */
  const loginWithToken = (accessToken, userData) => {
    const stored = writeStored('pb_token', accessToken) && writeStored('pb_user', JSON.stringify(userData));
    setVisitToken(stored ? null : accessToken);
    setUser(userData);
    setToken(accessToken);
    identify(userData?.id);
    return stored;
  };

  const register = async (userData) => {
    const response = await axios.post(`${API_URL}/api/auth/register`, userData);
    return response.data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setVisitToken(null);
    dropStored('pb_token');
    dropStored('pb_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginWithToken, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
