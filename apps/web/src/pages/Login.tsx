import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PawPrint, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAuthPage, useSiteSettings } from '../hooks/useCms';
import api from '../lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaTempToken, setMfaTempToken] = useState('');
  const [mfaMaskedEmail, setMfaMaskedEmail] = useState('');
  const [mfaOtp, setMfaOtp] = useState('');
  const [mfaExpiry, setMfaExpiry] = useState(300);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaSuccess, setMfaSuccess] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const { page: authPage } = useAuthPage('login');
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';

  const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE', 'WEBSITE_EDITOR'];

  const fetchCaptcha = async () => {
    try {
      const res = await api.get('/auth/captcha');
      setCaptchaQuestion(res.data.data.question);
      setCaptchaToken(res.data.data.token);
      setCaptchaAnswer('');
    } catch {
      setError('Failed to load verification challenge');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password, captchaRequired ? captchaToken : undefined, captchaRequired ? captchaAnswer : undefined);

      // Check if MFA is required
      if (result?.code === 'MFA_REQUIRED') {
        setMfaRequired(true);
        setMfaTempToken(result.tempToken);
        setMfaMaskedEmail(result.maskedEmail);
        setMfaExpiry(result.expiresIn);
        setLoading(false);
        return;
      }

      // Determine redirect based on RBAC role
      const roles: string[] = result.rbacRoles?.map((r: any) => r.name) || [];
      const isAdmin = roles.some((r) => adminRoles.includes(r));

      if (isAdmin) {
        window.location.href = import.meta.env.VITE_ADMIN_URL || 'http://localhost:3001';
      } else {
        navigate('/account');
      }
    } catch (err: any) {
      const responseCode = err.response?.data?.code;
      if (responseCode === 'CAPTCHA_REQUIRED') {
        setCaptchaRequired(true);
        await fetchCaptcha();
        setError('Please complete the verification challenge below');
        setLoading(false);
        return;
      }
      if (responseCode === 'REQUIRES_VERIFICATION') {
        const data = err.response?.data?.data;
        const params = new URLSearchParams();
        if (data?.email) params.set('email', data.email);
        if (data?.phoneNumber) params.set('phone', data.phoneNumber);
        navigate(`/verify-account?${params.toString()}`);
        return;
      }
      setError(err.response?.data?.error || 'Invalid email or password');
      if (captchaRequired) {
        await fetchCaptcha();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/mfa/verify', {
        tempToken: mfaTempToken,
        otp: mfaOtp,
      });
      const { token: newToken, refreshToken: newRefreshToken, user: userData } = res.data.data;
      localStorage.setItem('pawtag_token', newToken);
      if (newRefreshToken) {
        localStorage.setItem('pawtag_refresh_token', newRefreshToken);
      }

      // Show success animation
      setMfaSuccess(true);
      setMfaLoading(false);

      // Determine redirect based on RBAC role
      const roles: string[] = userData.rbacRoles?.map((r: any) => r.name) || [];
      const isAdmin = roles.some((r) => adminRoles.includes(r));

      // Redirect after success animation
      setTimeout(() => {
        if (isAdmin) {
          window.location.href = import.meta.env.VITE_ADMIN_URL || 'http://localhost:3001';
        } else {
          navigate('/account');
        }
      }, 1800);
    } catch (err: any) {
      const code = err.response?.data?.code;
      if (code === 'OTP_EXPIRED' || code === 'OTP_MAX_ATTEMPTS') {
        setError(err.response?.data?.error || 'Code expired. Please request a new one.');
      } else {
        setError(err.response?.data?.error || 'Invalid code. Please try again.');
      }
      setMfaOtp('');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      await api.post('/auth/mfa/send-otp', { tempToken: mfaTempToken });
      setMfaExpiry(300);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resend code.');
    }
  };

  // MFA Success screen
  if (mfaSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <div className="h-12 w-12 bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl flex items-center justify-center">
                <PawPrint className="h-7 w-7 text-white" />
              </div>
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-8">
            <div className="flex flex-col items-center justify-center py-6">
              {/* Animated checkmark circle */}
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center animate-[scale-in_0.3s_cubic-bezier(0.34,1.56,0.64,1)]">
                  <svg
                    className="w-10 h-10 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                      className="animate-[draw-check_0.4s_ease-out_0.2s_both]"
                      style={{
                        strokeDasharray: 24,
                        strokeDashoffset: 24,
                        animation: 'draw-check 0.4s ease-out 0.2s forwards',
                      }}
                    />
                  </svg>
                </div>
                {/* Pulse ring effect */}
                <div className="absolute inset-0 rounded-full bg-green-200 animate-[ping_1s_cubic-bezier(0,0,0.2,1)_0.5s]" style={{ opacity: 0.4 }} />
              </div>

              <h2 className="text-xl font-semibold text-gray-900 mb-2">Verification Successful</h2>
              <p className="text-gray-500 text-center">Redirecting you to your account...</p>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes scale-in {
            0% { transform: scale(0); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes draw-check {
            0% { stroke-dashoffset: 24; }
            100% { stroke-dashoffset: 0; }
          }
        `}</style>
      </div>
    );
  }

  // MFA OTP screen
  if (mfaRequired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <div className="h-12 w-12 bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl flex items-center justify-center">
                <PawPrint className="h-7 w-7 text-white" />
              </div>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Two-Factor Verification</h1>
            <p className="text-gray-500 mt-2">Enter the code sent to your email</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-8">
            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="text-center mb-6">
              <p className="text-sm text-gray-600">
                A verification code has been sent to
              </p>
              <p className="text-sm font-medium text-gray-900">{mfaMaskedEmail}</p>
            </div>

            <form onSubmit={handleMfaVerify} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
                <input
                  type="text"
                  value={mfaOtp}
                  onChange={(e) => setMfaOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-center text-lg tracking-widest font-mono focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="000000"
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={mfaLoading || mfaOtp.length !== 6}
                className="w-full py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
              >
                {mfaLoading ? 'Verifying...' : 'Verify Code'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                Didn't receive the code?{' '}
                <button
                  onClick={handleResendOtp}
                  className="text-teal-600 font-medium hover:text-teal-700"
                >
                  Resend
                </button>
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Code expires in {Math.floor(mfaExpiry / 60)}:{(mfaExpiry % 60).toString().padStart(2, '0')}
              </p>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setMfaRequired(false);
                  setMfaOtp('');
                  setError('');
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Back to login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Login screen
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
          <p className="text-gray-500 mt-2">{authPage?.subtitle || `Sign in to your ${companyName} account`}</p>
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

            {captchaRequired && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                <label className="block text-sm font-medium text-gray-700">Verify you're human</label>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-mono bg-white border border-gray-300 rounded px-4 py-2 text-gray-800 select-none">
                    {captchaQuestion}
                  </span>
                  <span className="text-gray-400">=</span>
                  <input
                    type="number"
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="?"
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={fetchCaptcha}
                  className="text-sm text-teal-600 hover:text-teal-700"
                >
                  Get new challenge
                </button>
              </div>
            )}

            <button type="submit" disabled={loading || (captchaRequired && !captchaAnswer)} className="w-full py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Don't have an account?{' '}
              <Link to="/register" className="text-teal-600 font-medium hover:text-teal-700">Create one</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
