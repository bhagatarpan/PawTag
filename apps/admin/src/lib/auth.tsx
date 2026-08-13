import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from './api';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  rbacRoles?: Array<{ name: string; displayName: string; isSuperAdmin: boolean }>;
}

interface EffectivePermission {
  name: string;
  displayName: string;
  resource: string;
  action: string;
  scope?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  permissions: EffectivePermission[];
  hasPermission: (permissionName: string) => boolean;
  login: (email: string, password: string, captchaToken?: string, captchaAnswer?: string) => Promise<any>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('admin_token'));
  const [permissions, setPermissions] = useState<EffectivePermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api
        .get('/auth/me')
        .then((res) => {
          const u = res.data.data;
          const isAdmin = u.rbacRoles?.some((r: any) =>
            ['SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE', 'WEBSITE_EDITOR'].includes(r.name)
          );
          if (!isAdmin) {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_refresh_token');
            setToken(null);
            setUser(null);
          } else {
            setUser(u);
            // Fetch effective permissions for this user
            return api.get(`/admin/rbac/users/${u.id}/effective-permissions`);
          }
        })
        .then((res) => {
          if (res?.data?.data?.permissions) {
            setPermissions(res.data.data.permissions);
          }
        })
        .catch(() => {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_refresh_token');
          setToken(null);
          setUser(null);
          setPermissions([]);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const hasPermission = (permissionName: string): boolean => {
    return permissions.some((p) => p.name === permissionName);
  };

  const login = async (email: string, password: string, captchaToken?: string, captchaAnswer?: string) => {
    const payload: any = { email, password };
    if (captchaToken && captchaAnswer) {
      payload.captchaToken = captchaToken;
      payload.captchaAnswer = parseInt(captchaAnswer, 10);
    }
    const res = await api.post('/auth/login', payload);
    const data = res.data.data;

    // If MFA is required, return the data for the login page to handle
    if (data.code === 'MFA_REQUIRED') {
      return data;
    }

    const { token: newToken, refreshToken: newRefreshToken, user: userData } = data;
    const isAdmin = userData.rbacRoles?.some((r: any) =>
      ['SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE', 'WEBSITE_EDITOR'].includes(r.name)
    );
    if (!isAdmin) {
      throw new Error('Access denied. Admin accounts only.');
    }
    localStorage.setItem('admin_token', newToken);
    if (newRefreshToken) {
      localStorage.setItem('admin_refresh_token', newRefreshToken);
    }
    setToken(newToken);
    setUser(userData);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_refresh_token');
    setToken(null);
    setUser(null);
    setPermissions([]);
  };

  return (
    <AuthContext.Provider value={{ user, token, permissions, hasPermission, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
