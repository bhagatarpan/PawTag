import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-6">
          <PawPrint size={32} className="text-primary-600 mx-auto mb-2" />
          <h1 className="text-xl font-bold">Customer Portal</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to manage your pets</p>
        </div>
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded mb-4">{error}</div>}
        <form onSubmit={async (e: FormEvent) => {
          e.preventDefault();
          setError('');
          setLoading(true);
          try {
            await login(email, password, captchaRequired ? captchaToken : undefined, captchaRequired ? captchaAnswer : undefined);
          } catch (err: any) {
            const data = err.response?.data;
            if (data?.code === 'CAPTCHA_REQUIRED') {
              setCaptchaRequired(true);
              await fetchCaptcha();
              setError('Please complete the verification challenge below');
              setLoading(false);
              return;
            }
            if (data?.code === 'REQUIRES_VERIFICATION') {
              const missing = [];
              if (data.data && !data.data.emailVerified) missing.push('email');
              if (data.data && !data.data.phoneVerified) missing.push('phone');
              const msg = missing.length > 0
                ? `Please verify your ${missing.join(' and ')} to activate your account.`
                : 'Please verify your email and phone number to activate your account.';
              setError(msg + ' You will be redirected to the verification page.');
              setTimeout(() => { window.location.href = `${window.location.origin}/../verify-account?email=${encodeURIComponent(data.data?.email || email)}`; }, 3000);
            } else {
              setError(err.response?.data?.error || 'Login failed');
              if (captchaRequired) {
                await fetchCaptcha();
              }
            }
          } finally {
            setLoading(false);
          }
        }} className="space-y-4">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm" required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm" required />
          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-xs text-primary-600 hover:text-primary-700">Forgot password?</Link>
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

          <button type="submit" disabled={loading || (captchaRequired && !captchaAnswer)}
            className="w-full bg-primary-600 text-white py-2 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 font-medium hover:text-primary-700">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
