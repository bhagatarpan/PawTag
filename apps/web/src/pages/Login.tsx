import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PawPrint, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAuthPage, useSiteSettings } from '../hooks/useCms';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { page: authPage } = useAuthPage('login');
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';

  const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE', 'WEBSITE_EDITOR'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userData = await login(email, password);

      // Determine redirect based on RBAC role
      const roles: string[] = userData.rbacRoles?.map((r: any) => r.name) || [];
      const isAdmin = roles.some((r) => adminRoles.includes(r));

      if (isAdmin) {
        window.location.href = 'http://localhost:3001';
      } else {
        navigate('/account');
      }
    } catch (err: any) {
      const responseCode = err.response?.data?.code;
      if (responseCode === 'REQUIRES_VERIFICATION') {
        const data = err.response?.data?.data;
        const params = new URLSearchParams();
        if (data?.email) params.set('email', data.email);
        if (data?.phoneNumber) params.set('phone', data.phoneNumber);
        navigate(`/verify-account?${params.toString()}`);
        return;
      }
      setError(err.response?.data?.error || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="h-12 w-12 bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl flex items-center justify-center">
              <PawPrint className="h-7 w-7 text-white" />
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{authPage?.title || 'Welcome back'}</h1>
          <p className="text-gray-500 mt-2">{authPage?.subtitle || 'Sign in to your {companyName} account'}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8">
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Enter your password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <div className="text-right">
                <Link to="/forgot-password" className="text-sm text-teal-600 hover:text-teal-700">
                  Forgot password?
                </Link>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Don't have an account?{' '}
              <Link to="/register" className="text-teal-600 font-medium hover:text-teal-700">Create one</Link>
            </p>
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg space-y-1">
            <p className="text-xs text-gray-400 text-center">
              <span className="font-medium">Demo admin:</span> admin@pawtag.co.nz / PawTagAdmin2024!
            </p>
            <p className="text-xs text-gray-400 text-center">
              <span className="font-medium">Test customer:</span> john@example.com / TestPass123!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
