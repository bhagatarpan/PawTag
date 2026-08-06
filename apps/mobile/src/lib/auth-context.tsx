import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '../api/client';
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from '../lib/tokenStorage';

interface User {
  _id: string;
  fullName: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ mfaRequired?: boolean; tempToken?: string; maskedEmail?: string; expiresIn?: number }>;
  register: (data: {
    fullName: string;
    email: string;
    phoneNumber: string;
    password: string;
    confirmPassword: string;
    acceptTerms: boolean;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = await getAccessToken();
        const refreshToken = await getRefreshToken();
        if (token && refreshToken) {
          await refreshUser();
        }
      } catch {
        await clearTokens();
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const data = res.data.data;

    if (data.code === 'MFA_REQUIRED') {
      return {
        mfaRequired: true,
        tempToken: data.tempToken,
        maskedEmail: data.maskedEmail,
        expiresIn: data.expiresIn,
      };
    }

    const { token: accessToken, refreshToken: newRefreshToken, user: userData } = data;
    await setTokens(accessToken, newRefreshToken);
    setUser(userData);
    return {};
  };

  const register = async (data: {
    fullName: string;
    email: string;
    phoneNumber: string;
    password: string;
    confirmPassword: string;
    acceptTerms: boolean;
  }) => {
    await api.post('/auth/register', data);
  };

  const logout = async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch {
      // Logout even if the API call fails
    } finally {
      await clearTokens();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
