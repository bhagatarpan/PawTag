import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import api from '../lib/api';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handleSubmit = async (e: FormEvent) => {
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
    } catch (err: any) {
      const code = err.response?.data?.code;
      if (code === 'CAPTCHA_REQUIRED') {
        setCaptchaRequired(true);
        await fetchCaptcha();
        setError('Please complete the verification challenge below');
      } else {
        setError(err.response?.data?.error || err.message || 'Login failed');
        if (captchaRequired) {
          await fetchCaptcha();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e: FormEvent) => {
    e.preventDefault();
    setMfaLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/mfa/verify', {
        tempToken: mfaTempToken,
        otp: mfaOtp,
      });
      const { token: newToken, user: userData } = res.data.data;
      localStorage.setItem('admin_token', newToken);
      window.location.href = '/dashboard';
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

  // MFA OTP screen
  if (mfaRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold">
              <span className="text-primary-600">Paw</span>Tag
            </h1>
            <p className="text-sm text-gray-500 mt-1">Two-Factor Verification</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md mb-4">{error}</div>
          )}

          <div className="text-center mb-6">
            <p className="text-sm text-gray-600">
              A verification code has been sent to
            </p>
            <p className="text-sm font-medium text-gray-900">{mfaMaskedEmail}</p>
          </div>

          <form onSubmit={handleMfaVerify} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
              <input
                type="text"
                value={mfaOtp}
                onChange={(e) => setMfaOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-center tracking-widest font-mono"
                placeholder="000000"
                maxLength={6}
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={mfaLoading || mfaOtp.length !== 6}
              className="w-full bg-primary-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {mfaLoading ? 'Verifying...' : 'Verify Code'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Didn't receive the code?{' '}
              <button
                onClick={handleResendOtp}
                className="text-primary-600 hover:text-primary-700 font-medium"
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
    );
  }

  // Login screen
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">
            <span className="text-primary-600">Paw</span>Tag
          </h1>
          <p className="text-sm text-gray-500 mt-1">Admin Portal</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
            <div className="mt-1 text-right">
              <Link to="/forgot-password" className="text-xs text-primary-600 hover:text-primary-700">
                Forgot password?
              </Link>
            </div>
          </div>

          {captchaRequired && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-3">
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
                  className="w-20 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="?"
                  required
                />
              </div>
              <button
                type="button"
                onClick={fetchCaptcha}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                Get new challenge
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (captchaRequired && !captchaAnswer)}
            className="w-full bg-primary-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
