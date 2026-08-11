import { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { identify, recallReadiness, saveProgress, track } from '../utils/analytics';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";


export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('pb_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      // Decode or validate token if needed, for now just set user
      const storedUser = localStorage.getItem('pb_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
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
    localStorage.setItem('pb_token', access_token);
    localStorage.setItem('pb_user', JSON.stringify(userData));

    /* Only after the call succeeds. Firing this alongside login_started would
       make the login step look 100% converting no matter how many people got
       their password wrong. */
    identify(userData?.id);
    track('login_completed', { readiness_code });
    saveProgress({ user_id: userData?.id });   // ties the session to the account
    return userData;
  };

  const register = async (userData) => {
    const response = await axios.post(`${API_URL}/api/auth/register`, userData);
    return response.data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('pb_token');
    localStorage.removeItem('pb_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
