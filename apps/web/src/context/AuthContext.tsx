import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../lib/api';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string, captchaToken?: string, captchaAnswer?: string) => Promise<any>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('pawtag_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.get('/auth/me')
        .then((res) => setUser(res.data.data))
        .catch(() => {
          localStorage.removeItem('pawtag_token');
          localStorage.removeItem('pawtag_refresh_token');
          setToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string, captchaToken?: string, captchaAnswer?: string): Promise<any> => {
    const payload: any = { email, password };
    if (captchaToken && captchaAnswer) {
      payload.captchaToken = captchaToken;
      payload.captchaAnswer = parseInt(captchaAnswer, 10);
    }
    const res = await api.post('/auth/login', payload);
    const data = res.data;

    if (data.code === 'REQUIRES_VERIFICATION' || data.code === 'CAPTCHA_REQUIRED') {
      const error: any = new Error(data.error);
      error.code = data.code;
      error.data = data.data;
      throw error;
    }

    // If MFA is required, return the data for the login page to handle
    if (data.data?.code === 'MFA_REQUIRED') {
      return data.data;
    }

    const { token: newToken, refreshToken: newRefreshToken, user: userData } = data.data;
    localStorage.setItem('pawtag_token', newToken);
    if (newRefreshToken) {
      localStorage.setItem('pawtag_refresh_token', newRefreshToken);
    }
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('pawtag_token');
    localStorage.removeItem('pawtag_refresh_token');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.data);
    } catch {
      // silently fail — token may be expired
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
