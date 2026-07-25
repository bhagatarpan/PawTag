import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Request failed. Please try again.');
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

        {success ? (
          <div className="text-center">
            <div className="bg-green-50 text-green-700 text-sm p-4 rounded-md mb-4">
              If an account exists with that email, a password reset link has been sent.
            </div>
            <Link to="/login" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Reset your password</h2>
            <p className="text-sm text-gray-500 mb-6">Enter your email address and we'll send you a link to reset your password.</p>
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
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
            <div className="mt-4 text-center">
              <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700">
                Back to Login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
