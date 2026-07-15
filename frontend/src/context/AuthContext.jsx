import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

// Which navigation items each role can see.
export const CAN = {
  viewInventory: ['SUPER_ADMIN', 'ADMIN', 'IT_MANAGER', 'IT_SUPPORT', 'HR', 'ACCOUNTS'],
  manageInventory: ['SUPER_ADMIN', 'ADMIN', 'IT_MANAGER', 'IT_SUPPORT'],
  manageUsers: ['SUPER_ADMIN', 'ADMIN', 'IT_MANAGER', 'HR'],
  viewAudit: ['SUPER_ADMIN', 'ADMIN', 'IT_MANAGER'],
};
export const can = (user, action) => user && CAN[action]?.includes(user.role);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Accept token handed back by the Microsoft 365 redirect (#token=...)
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get('token')) {
      localStorage.setItem('token', hash.get('token'));
      window.history.replaceState(null, '', window.location.pathname);
    }
    if (!localStorage.getItem('token')) { setLoading(false); return; }
    api.get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
  };

  const loginWithFirebase = async (firebaseToken) => {
    const res = await api.post('/auth/firebase', { token: firebaseToken });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout, loginWithFirebase }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
