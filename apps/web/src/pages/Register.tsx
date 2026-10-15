import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { PawPrint, Mail, Lock, User, Phone, Eye, EyeOff, CheckCircle, Loader2, LogIn } from 'lucide-react';
import { MembershipCheckboxes } from '@pawtag/ui';
import api from '../lib/api';
import { useAuthPage, useSiteSettings } from '../hooks/useCms';
import { useAuth } from '../context/AuthContext';
import { validatePassword } from '@pawtag/shared';
import { API } from '@pawtag/shared';
import { peekReturnUrl, setReturnUrl, RETURN_URL_KEY } from '../lib/return-url';

export default function Register() {
  const { login } = useAuth();
  const { settings } = useSiteSettings();
  // Email carried over from Login ("Create an account with …" hand-off)
  const location = useLocation();
  const carriedEmail = (location.state as { email?: string } | null)?.email;
  const [form, setForm] = useState({ fullName: '', email: carriedEmail || '', phoneNumber: '', password: '', confirmPassword: '', acceptTerms: false, addGold: false });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  // The email already has an account (user actually just forgot their
  // password) — offer a one-tap return to sign-in with the email carried.
  const [existingAccount, setExistingAccount] = useState(false);
  const navigate = useNavigate();
  const { page: authPage } = useAuthPage('register');

  // When the email arrived pre-filled from the login hand-off, focus the
  // next field so the user can keep typing without tapping first.
  const fullNameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (carriedEmail) fullNameRef.current?.focus();
  }, [carriedEmail]);

  // Capture the checkout flag on mount. Other workflow return URLs (e.g.
  // /cart from the guest cart banner) must SURVIVE registration so the
  // post-verification Continue can honour them — only the checkout flag
  // is consumed here.
  const [fromCheckout] = useState(() => {
    const url = peekReturnUrl();
    if (url === '/checkout') {
      localStorage.removeItem(RETURN_URL_KEY);
      return true;
    }
    return false;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setExistingAccount(false);

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    const passwordValidation = validatePassword(form.password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.error!);
      return;
    }
    if (!form.acceptTerms) {
      setError('You must accept the terms and conditions');
      return;
    }

    setLoading(true);
    try {
      await api.post(API.auth.register, {
        fullName: form.fullName,
        email: form.email,
        phoneNumber: form.phoneNumber,
        password: form.password,
        confirmPassword: form.confirmPassword,
        acceptTerms: form.acceptTerms,
      });

      // Auto-login after registration so checkout flow continues smoothly
      try {
        await login(form.email, form.password);
      } catch {
        // Login may fail if email verification is required — that's OK
        // User will see verification prompts on the verify-account page
      }

      // Store Gold preference — subscription will be created after verification
      // (when user has a valid auth token)
      if (form.addGold) {
        localStorage.setItem('pawtag_subscribe_gold', 'true');
      }

      setSuccess(true);
    } catch (err: any) {
      const serverError = err.response?.data?.error || 'Registration failed. Please try again.';
      // "Email/phone already exists" → offer the sign-in hand-off instead of a dead end
      if (/already exists/i.test(serverError)) {
        setExistingAccount(true);
      }
      setError(serverError);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-start justify-center px-4 py-8 sm:items-center sm:py-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
          <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Created!</h1>
          <p className="text-gray-500 mb-6">
            Your account has been created. Please verify your email address and mobile number to activate your account.
            {fromCheckout && ' After verification, you\'ll return to checkout.'}
          </p>
          <button
            onClick={() => {
              // Re-set return URL for checkout-originated registrations so
              // VerifyAccount can redirect back after verification
              if (fromCheckout) {
                setReturnUrl('/checkout');
              }
              navigate(`/verify-account?email=${encodeURIComponent(form.email)}&phone=${encodeURIComponent(form.phoneNumber)}`);
            }}
            className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-all"
          >
            Verify My Account
          </button>
          {fromCheckout && (
            <button
              onClick={() => navigate('/checkout')}
              className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-all"
            >
              Skip for now — return to checkout
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center px-4 py-8 sm:items-center sm:py-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="h-12 w-12 bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl flex items-center justify-center">
              <PawPrint className="h-7 w-7 text-white" />
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{authPage?.title || 'Create your account'}</h1>
          <p className="text-gray-500 mt-2">{authPage?.subtitle || 'Join thousands of pet owners protecting their companions'}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8">
          {error && (
            <div role="alert" className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* The email already has an account — one-tap back to sign-in
              with the email carried along (seamless login ↔ register loop). */}
          {existingAccount && form.email.trim() && (
            <div className="mb-6 p-4 bg-primary-50 border border-primary-200 rounded-lg">
              <p className="text-sm text-primary-900 font-medium mb-3">
                Good news — {form.email.trim()} already has an account. Sign in instead.
              </p>
              <button
                type="button"
                onClick={() => navigate('/login', { state: { email: form.email.trim() } })}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors"
              >
                <LogIn className="h-4 w-4" />
                Sign in instead
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input ref={fullNameRef} type="text" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="John Smith" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="you@example.com" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input type="tel" required value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="+64 21 123 4567" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input type={showPassword ? 'text' : 'password'} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full pl-10 pr-12 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="Min 8 characters" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input type="password" required value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="Re-enter password" />
              </div>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="acceptTerms"
                checked={form.acceptTerms}
                onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })}
                className="mt-1 h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
              />
              <label htmlFor="acceptTerms" className="text-sm text-gray-600">
                I agree to the{' '}
                <Link to="/terms" className="text-teal-600 font-medium hover:text-teal-700">Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy" className="text-teal-600 font-medium hover:text-teal-700">Privacy Policy</Link>
              </label>
            </div>

            <MembershipCheckboxes
              addGold={form.addGold}
              onGoldChange={(checked) => setForm({ ...form, addGold: checked })}
            />

            <button type="submit" disabled={loading} className="w-full py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="animate-spin h-4 w-4" /> Creating account...</> : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Already have an account?{' '}
              <Link to="/login" className="text-teal-600 font-medium hover:text-teal-700">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
