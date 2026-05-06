import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSessionUser } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize from localStorage on mount
  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (!storedToken || !storedUser) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const parsedUser = JSON.parse(storedUser);
        if (cancelled) return;

        // Optimistic restore for snappy UX
        setToken(storedToken);
        setUser(parsedUser);
        setIsAuthenticated(true);

        // Validate token against backend. If backend is temporarily unavailable,
        // keep the existing local session and retry on next app load.
        try {
          const res = await getSessionUser();
          if (!cancelled) {
            const serverUser = res.data?.user || parsedUser;
            localStorage.setItem('user', JSON.stringify(serverUser));
            setUser(serverUser);
            setIsAuthenticated(true);
          }
        } catch (err) {
          const status = err?.response?.status;
          // 401/403 = token invalid/forbidden; 404 = user no longer exists in DB
          if (!cancelled && (status === 401 || status === 403 || status === 404)) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
            setIsAuthenticated(false);
          }
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const loginAction = (newToken, newUser) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, loading, login: loginAction, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export default AuthContext;
