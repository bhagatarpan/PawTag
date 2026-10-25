import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, User, Phone, Eye, EyeOff, CheckCircle, Loader2, LogIn } from 'lucide-react';
import { Button, MembershipCheckboxes } from '@pawtag/ui';
import api from '../lib/api';
import { useAuthPage, useSiteSettings } from '../hooks/useCms';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
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
      <AuthLayout
        title="Account Created!"
        subtitle={`Your account has been created. Please verify your email address and mobile number to activate your account.${fromCheckout ? " After verification, you'll return to checkout." : ''}`}
      >
        <div className="text-center">
          <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <Button
            size="lg"
            full
            onClick={() => {
              // Re-set return URL for checkout-originated registrations so
              // VerifyAccount can redirect back after verification
              if (fromCheckout) {
                setReturnUrl('/checkout');
              }
              navigate(`/verify-account?email=${encodeURIComponent(form.email)}&phone=${encodeURIComponent(form.phoneNumber)}`);
            }}
          >
            Verify My Account
          </Button>
          {fromCheckout && (
            <button
              onClick={() => navigate('/checkout')}
              className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-all"
            >
              Skip for now — return to checkout
            </button>
          )}
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={authPage?.title || 'Create your account'}
      subtitle={authPage?.subtitle || 'Join thousands of pet owners protecting their companions'}
    >
      {error && (
        <div role="alert" className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* The email already has an account — one-tap back to sign-in
          with the email carried along (seamless login ↔ register loop). */}
      {existingAccount && form.email.trim() && (
        <div className="mb-6 p-4 bg-primary-50 border border-primary-200 rounded-xl">
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

      {/* Registration progress — step 2 (verify) begins after submit */}
      <div className="flex items-center justify-center gap-3 mb-6" aria-label="Step 1 of 2: account details. Step 2: verification.">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-primary-700">
          <span aria-hidden="true" className="h-5 w-5 rounded-full bg-primary-600 text-white flex items-center justify-center text-[10px]">1</span>
          Account
        </span>
        <span aria-hidden="true" className="h-px w-8 bg-gray-200" />
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
          <span aria-hidden="true" className="h-5 w-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-[10px]">2</span>
          Verify
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input id="reg-name" ref={fullNameRef} type="text" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="John Smith" autoComplete="name" />
          </div>
        </div>

        <div>
          <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input id="reg-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="you@example.com" autoComplete="email" inputMode="email" />
          </div>
        </div>

        <div>
          <label htmlFor="reg-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input id="reg-phone" type="tel" required value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="+64 21 123 4567" autoComplete="tel" inputMode="tel" />
          </div>
        </div>

        <div>
          <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input id="reg-password" type={showPassword ? 'text' : 'password'} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full pl-10 pr-12 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Min 8 characters" autoComplete="new-password" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="reg-confirm" className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input id="reg-confirm" type="password" required value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Re-enter password" autoComplete="new-password" />
          </div>
        </div>

        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="acceptTerms"
            checked={form.acceptTerms}
            onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })}
            className="mt-1 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          />
          <label htmlFor="acceptTerms" className="text-sm text-gray-600">
            I agree to the{' '}
            <Link to="/terms" className="text-primary-600 font-medium hover:text-primary-700">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy" className="text-primary-600 font-medium hover:text-primary-700">Privacy Policy</Link>
          </label>
        </div>

        <MembershipCheckboxes
          addGold={form.addGold}
          onGoldChange={(checked) => setForm({ ...form, addGold: checked })}
        />

        <Button type="submit" size="lg" full disabled={loading}>
          {loading ? <><Loader2 className="animate-spin h-4 w-4" /> Creating account...</> : 'Create Account'}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 font-medium hover:text-primary-700">Sign in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
