import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import api from '../lib/api';
import { User } from '../types';
import { API } from '@pawtag/shared';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string, captchaToken?: string, captchaAnswer?: string, rememberMe?: boolean) => Promise<any>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  /** Persist an access token and hydrate the full user from /auth/me. */
  completeLogin: (accessToken: string, partialUser?: User | null) => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('pawtag_token'));
  const [isLoading, setIsLoading] = useState(true);

  const hydrateUser = useCallback(async (partialUser?: User | null) => {
    // Account gates (verification/onboarding) must see the full /auth/me user.
    // Login payloads alone can omit flags and cause false /verify-account redirects.
    try {
      const res = await api.get(API.auth.me);
      setUser(res.data.data);
    } catch {
      setUser(partialUser ?? null);
    }
  }, []);

  useEffect(() => {
    if (token) {
      api.get(API.auth.me)
        .then((res) => setUser(res.data.data))
        .catch(() => {
          localStorage.removeItem('pawtag_token');
          // Refresh token is HttpOnly cookie only — clear any legacy localStorage copy
          localStorage.removeItem('pawtag_refresh_token');
          setToken(null);
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const completeLogin = useCallback(async (accessToken: string, partialUser?: User | null) => {
    localStorage.setItem('pawtag_token', accessToken);
    // Browser security: never persist refresh tokens in localStorage.
    // The API sets an HttpOnly refresh cookie on login; api client refreshes via cookie.
    localStorage.removeItem('pawtag_refresh_token');
    setToken(accessToken);
    setIsLoading(true);
    try {
      await hydrateUser(partialUser);
    } finally {
      setIsLoading(false);
    }
  }, [hydrateUser]);

  const login = useCallback(async (email: string, password: string, captchaToken?: string, captchaAnswer?: string, rememberMe?: boolean): Promise<any> => {
    const payload: any = { email, password };
    if (captchaToken && captchaAnswer) {
      payload.captchaToken = captchaToken;
      payload.captchaAnswer = parseInt(captchaAnswer, 10);
    }
    if (rememberMe !== undefined) {
      payload.rememberMe = rememberMe;
    }
    const res = await api.post(API.auth.login, payload);
    const data = res.data;

    if (data.code === 'REQUIRES_VERIFICATION' || data.code === 'CAPTCHA_REQUIRED') {
      const error: any = new Error(data.error);
      error.code = data.code;
      error.data = data.data;
      throw error;
    }

    if (data.data?.code === 'MFA_REQUIRED') {
      return data.data;
    }

    const { token: newToken, user: userData } = data.data;
    // Await full /auth/me hydration before login resolves so route guards
    // never evaluate incomplete verification flags mid-redirect.
    await completeLogin(newToken, userData);
    return userData;
  }, [completeLogin]);

  const logout = useCallback(() => {
    localStorage.removeItem('pawtag_token');
    localStorage.removeItem('pawtag_refresh_token');
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get(API.auth.me);
      setUser(res.data.data);
    } catch {
      // silently fail — token may be expired
    }
  }, [token]);

  // Memoize context value — prevents cascade re-renders to CartProvider and below
  const value = useMemo(() => ({
    user, token, login, logout, refreshUser, completeLogin, isLoading,
  }), [user, token, isLoading, login, logout, refreshUser, completeLogin]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
