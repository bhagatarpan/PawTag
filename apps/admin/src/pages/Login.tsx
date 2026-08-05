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
      await login(email, password, captchaRequired ? captchaToken : undefined, captchaRequired ? captchaAnswer : undefined);
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
