import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import api from './api';

interface AuthContextType {
  user: any;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => void;
}

const AuthCtx = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const nav = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('customer_token');
    if (token) api.get('/auth/me').then((r) => setUser(r.data.data)).catch(() => localStorage.removeItem('customer_token'));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: newToken, user: userData } = res.data.data;
    localStorage.setItem('customer_token', newToken);
    setUser(userData);
    nav('/');
  };

  const logout = () => { localStorage.removeItem('customer_token'); setUser(null); nav('/login'); };

  const refreshUser = () => { api.get('/auth/me').then((r) => setUser(r.data.data)).catch(() => {}); };

  return <AuthCtx.Provider value={{ user, login, logout, refreshUser }}>{children}</AuthCtx.Provider>;
}

export function useAuth() { return useContext(AuthCtx)!; }

export function Protected({ children }: { children: ReactNode }) {
  const token = localStorage.getItem('customer_token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
