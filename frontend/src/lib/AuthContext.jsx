import React, { createContext, useContext, useState, useEffect } from 'react';
import api from './api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState({ panel_name: 'Sada Mia Panel', panel_logo: null });

  const fetchBranding = async () => {
    try {
      const { data } = await api.get('/public/panel/branding');
      setBranding(data);
      if (data.panel_name) {
        document.title = data.panel_name;
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      if (localStorage.getItem('panel_token')) {
        try {
          const { data } = await api.post('/auth/user');
          setUser(data);
        } catch (error) {
          localStorage.removeItem('panel_token');
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('panel_token', data.token);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // ignore
    } finally {
      localStorage.removeItem('panel_token');
      setUser(null);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading, branding, refreshBranding: fetchBranding }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
