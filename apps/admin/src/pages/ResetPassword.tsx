import { useState, FormEvent } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { validatePassword } from '@pawtag/shared';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Invalid Reset Link</h1>
          <p className="text-gray-500 mb-6">This password reset link is invalid or missing a token.</p>
          <Link to="/forgot-password" className="text-primary-600 hover:text-primary-700 font-medium">
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.error!);
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password. Please try again.');
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
              Your password has been updated. You can now sign in with your new password.
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-primary-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              Sign In
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Reset your password</h2>
            <p className="text-sm text-gray-500 mb-6">Enter your new password below.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                  minLength={8}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
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
