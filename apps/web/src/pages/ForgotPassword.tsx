import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@pawtag/ui';
import api from '../lib/api';
import { useAuthPage } from '../hooks/useCms';
import AuthLayout from '../components/AuthLayout';
import { API } from '@pawtag/shared';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const { page: authPage } = useAuthPage('forgot_password');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post(API.auth.forgotPassword, { email });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={authPage?.title || 'Forgot your password?'}
      subtitle={authPage?.subtitle || "Enter your email and we'll send you a reset link."}
    >
      {error && (
        <div role="alert" className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {success ? (
        <div className="text-center py-4">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h2>
          <p className="text-gray-500 text-sm mb-6">
            If an account exists with <strong>{email}</strong>, we've sent a password reset link.
            Check your inbox and follow the instructions.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium text-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                autoComplete="email"
                inputMode="email"
              />
            </div>
          </div>

          <Button type="submit" size="lg" full disabled={loading}>
            {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Sending...</> : 'Send Reset Link'}
          </Button>

          <div className="text-center">
            <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700">
              Remember your password? Sign in
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
