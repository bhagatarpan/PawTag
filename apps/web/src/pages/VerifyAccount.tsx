import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Phone, CheckCircle2, ArrowRight, RefreshCw, Loader2, AlertCircle, Pencil, Check } from 'lucide-react';
import { Button, buttonClassName } from '@pawtag/ui';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import OtpInput from '../components/verification/OtpInput';
import AuthLayout from '../components/AuthLayout';
import { consumeReturnUrl, peekReturnUrl } from '../lib/return-url';
import { API } from '@pawtag/shared';

type VerificationStatus = {
  emailVerified: boolean;
  phoneVerified: boolean;
  status: string;
  email: string;
  phoneNumber: string;
  otpCooldown: number;
} | null;

export default function VerifyAccount() {
  const { user: authUser, refreshUser, completeLogin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<VerificationStatus>(null);
  const [loading, setLoading] = useState(true);
  const [emailSending, setEmailSending] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [emailSent, setEmailSent] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [editingField, setEditingField] = useState<'email' | 'phone' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const emailParam = searchParams.get('email');
  const phoneParam = searchParams.get('phone');
  const emailStatus = searchParams.get('email_status');

  const effectiveEmail = status?.email || emailParam || '';
  const effectivePhone = status?.phoneNumber || phoneParam || '';

  const fetchStatus = useCallback(async () => {
    try {
      const lookupEmail = emailParam || authUser?.email || '';
      const params = lookupEmail ? `?email=${encodeURIComponent(lookupEmail)}` : '';
      const res = await api.get(`${API.auth.verificationStatus}${params}`);
      setStatus(res.data.data);
      setCooldown(res.data.data?.otpCooldown || 0);
    } catch {
      // Not authenticated — may have just registered
    } finally {
      setLoading(false);
    }
  }, [emailParam, authUser?.email]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (emailStatus === 'verified') {
      setSuccess('Email verified successfully!');
      fetchStatus();
      // If no auth (status is null), optimistically update local state
      if (!status) {
        setStatus(prev => prev ? { ...prev, emailVerified: true } : {
          emailVerified: true,
          phoneVerified: false,
          status: 'pending_verification',
          email: emailParam || '',
          phoneNumber: phoneParam || '',
          otpCooldown: 0,
        });
      }
    } else if (emailStatus === 'expired') {
      setError('This verification link has expired. Please request a new one.');
    } else if (emailStatus === 'invalid') {
      setError('This verification link is invalid.');
    } else if (emailStatus === 'already_verified') {
      setSuccess('Your email is already verified.');
    }
  }, [emailStatus, fetchStatus, status, emailParam, phoneParam]);

  // Capture access token from URL params when redirected after activation.
  // Refresh tokens are never accepted from URLs — they travel only as HttpOnly cookies.
  // completeLogin (not a raw localStorage write) so AuthContext hydrates the
  // full user — otherwise account gates render a user-less dashboard.
  useEffect(() => {
    const tokenParam = searchParams.get('token');
    const refreshTokenParam = searchParams.get('refreshToken');
    if (tokenParam) {
      void completeLogin(tokenParam);
    }
    if (tokenParam || refreshTokenParam) {
      searchParams.delete('token');
      searchParams.delete('refreshToken');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, completeLogin]);

  // Fully verified authenticated users should not remain stuck here
  // (e.g. post-login redirect race). Registration still needs the CTA
  // until channels are verified — then continue runs gold/onboarding steps.
  const userChannelsVerified = authUser?.emailVerified === true && authUser?.phoneVerified === true;
  const statusChannelsVerified = status?.emailVerified === true && status?.phoneVerified === true;
  useEffect(() => {
    if (!authUser || !status) return;
    if (!userChannelsVerified || !statusChannelsVerified) return;
    void handleContinue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, status, userChannelsVerified, statusChannelsVerified]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendVerificationEmail = async () => {
    setEmailSending(true);
    setError('');
    setSuccess('');
    try {
      await api.post(API.auth.resendEmailVerification, { email: effectiveEmail });
      setSuccess('Verification email sent! Check your inbox.');
      setEmailSent(true);
      setCooldown(60);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send verification email');
    } finally {
      setEmailSending(false);
    }
  };

  const handleSendOtp = async () => {
    setOtpSending(true);
    setError('');
    setSuccess('');
    try {
      await api.post(API.auth.sendPhoneOtp, { phoneNumber: effectivePhone });
      setSuccess('OTP sent to your phone number.');
      setPhoneOtpSent(true);
      setCooldown(60);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6) {
      setError('Please enter the complete 6-digit code.');
      return;
    }
    if (!effectivePhone.trim()) {
      setError('Add your phone number first — use Edit next to Mobile Verification.');
      return;
    }
    setOtpVerifying(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.post(API.auth.verifyPhone, { otp: otpValue, phoneNumber: effectivePhone });
      // Store the activation token through completeLogin (not a raw
      // localStorage write) so AuthContext hydrates the full user — the
      // onboarding wizard gate in AccountLayout needs the verified flags.
      // Refresh token is HttpOnly cookie only — never localStorage.
      const { token } = res.data.data || {};
      if (token) {
        await completeLogin(token);
      }
      setSuccess('Phone number verified successfully!');
      setOtpValue('');
      setPhoneOtpSent(false);
      fetchStatus();
      // Optimistically update local state when no auth. ONLY the phone is
      // marked verified — claiming emailVerified here previously produced a
      // false "Account Verified!" state that routed unauthenticated users
      // into /account, which bounced them back to /login (the verify loop).
      if (!status) {
        setStatus(prev => prev ? { ...prev, phoneVerified: true } : {
          emailVerified: false,
          phoneVerified: true,
          status: 'pending_verification',
          email: emailParam || '',
          phoneNumber: phoneParam || '',
          otpCooldown: 0,
        });
      }
    } catch (err: any) {
      const data = err.response?.data;
      if (!err.response) {
        // Network failure — say so honestly instead of blaming the code
        setError('Connection problem — please check your signal and try again.');
      } else if (data?.code === 'OTP_MAX_ATTEMPTS') {
        setError('Too many failed attempts. Please request a new OTP.');
      } else if (data?.code === 'OTP_EXPIRED') {
        setError('This OTP has expired. Please request a new one.');
      } else {
        setError(data?.error || 'Invalid OTP. Please try again.');
      }
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleContinue = async () => {
    // If user opted into Gold during registration, subscribe now (token is available)
    const goldPreference = localStorage.getItem('pawtag_subscribe_gold');
    if (goldPreference) {
      localStorage.removeItem('pawtag_subscribe_gold');
      try {
        await api.post('/membership/subscribe', { planType: 'monthly' });
      } catch (err: any) {
        // Non-critical — log for monitoring, user can upgrade later from the dashboard
        console.warn('Gold subscription creation failed during verification:', err?.response?.data?.error || err.message);
      }
    }

    // Refresh user data to ensure onboarding status is current before navigating
    await refreshUser();

    // Check if there's a return URL (e.g., from checkout or the guest cart)
    const returnUrl = consumeReturnUrl();
    if (returnUrl) {
      navigate(returnUrl);
      return;
    }
    // Only enter the authenticated area when we actually hold a session.
    // Navigating to /account without a token bounced through ProtectedRoute
    // back to /login — the verification loop users experienced.
    if (localStorage.getItem('pawtag_token')) {
      navigate('/account');
    } else {
      navigate('/login', { state: { email: effectiveEmail } });
    }
  };

  const startEdit = (field: 'email' | 'phone') => {
    setEditingField(field);
    setEditValue(field === 'email' ? effectiveEmail : effectivePhone);
    setEditError('');
  };

  const saveEdit = async () => {
    setEditSaving(true);
    setEditError('');
    try {
      const payload: Record<string, string> = {};
      if (editingField === 'email') payload.email = editValue;
      if (editingField === 'phone') payload.phoneNumber = editValue;
      await api.put(API.auth.profile, payload);
      // Reset verification for changed field
      if (editingField === 'email') {
        setEmailSent(false);
      } else {
        setOtpValue('');
        setPhoneOtpSent(false);
      }
      setEditingField(null);
      setSuccess('Contact updated. Please re-verify.');
      await fetchStatus();
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Failed to update');
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) {
    return (
      <AuthLayout title="Verify Your Account" card={false}>
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 text-primary-600 animate-spin" aria-label="Loading verification status" />
        </div>
      </AuthLayout>
    );
  }

  const isEmailVerified = status?.emailVerified ?? false;
  const isPhoneVerified = status?.phoneVerified ?? false;
  const allVerified = isEmailVerified && isPhoneVerified;
  const isPending = status?.status === 'pending_verification' || !status;
  const hasReturnUrl = !!peekReturnUrl();

  return (
    <AuthLayout
      title="Verify Your Account"
      subtitle={allVerified ? 'Your account is fully verified!' : 'Complete the steps below to activate your account.'}
      card={false}
    >
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* Email Verification */}
          {editingField === 'email' ? (
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full flex items-center justify-center bg-primary-100">
                  <Mail className="h-5 w-5 text-primary-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Edit Email</h3>
              </div>
              <input
                type="email"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm mb-3"
                placeholder="Enter new email address"
                autoComplete="email"
                inputMode="email"
                aria-label="New email address"
              />
              {editError && <p className="text-xs text-red-600 mb-2">{editError}</p>}
              <div className="flex gap-2">
                <Button onClick={saveEdit} disabled={editSaving || !editValue || editValue === effectiveEmail} className="flex-1">
                  {editSaving ? 'Saving...' : 'Save & Re-verify'}
                </Button>
                <Button variant="secondary" onClick={() => setEditingField(null)} className="flex-1">
                  Cancel
                </Button>
              </div>
              <p className="text-xs text-gray-400 text-center mt-2">You'll need to re-verify your email after changing it.</p>
            </div>
          ) : (
            <div className={`p-4 rounded-xl transition-all ${isEmailVerified ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Step 1 of 2 — numbered progress item (spec §6.2) */}
                  <span aria-hidden="true" className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold ${isEmailVerified ? 'bg-green-600 text-white' : 'bg-primary-100 text-primary-700'}`}>1</span>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">Email Verification</p>
                    <p className="text-xs text-gray-500 truncate">{effectiveEmail}</p>
                    <p className="text-[11px] text-gray-400">Step 1 of 2</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {isEmailVerified ? (
                    <span className="text-sm text-green-600 font-medium flex items-center gap-1"><Check className="h-4 w-4" /> Verified</span>
                  ) : (
                    <span className="text-sm text-amber-600 font-medium">Not Verified</span>
                  )}
                  <button onClick={() => startEdit('email')} className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
                    <Pencil size={12} /> Edit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Phone Verification */}
          {editingField === 'phone' ? (
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full flex items-center justify-center bg-primary-100">
                  <Phone className="h-5 w-5 text-primary-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Edit Phone</h3>
              </div>
              <input
                type="tel"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm mb-3"
                placeholder="Enter new phone number"
                autoComplete="tel"
                inputMode="tel"
                aria-label="New phone number"
              />
              {editError && <p className="text-xs text-red-600 mb-2">{editError}</p>}
              <div className="flex gap-2">
                <Button onClick={saveEdit} disabled={editSaving || !editValue || editValue === effectivePhone} className="flex-1">
                  {editSaving ? 'Saving...' : 'Save & Re-verify'}
                </Button>
                <Button variant="secondary" onClick={() => setEditingField(null)} className="flex-1">
                  Cancel
                </Button>
              </div>
              <p className="text-xs text-gray-400 text-center mt-2">You'll need to re-verify your phone after changing it.</p>
            </div>
          ) : (
            <div className={`p-4 rounded-xl transition-all ${isPhoneVerified ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Step 2 of 2 — numbered progress item (spec §6.2) */}
                  <span aria-hidden="true" className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold ${isPhoneVerified ? 'bg-green-600 text-white' : 'bg-primary-100 text-primary-700'}`}>2</span>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">Mobile Verification</p>
                    <p className="text-xs text-gray-500 truncate">{effectivePhone || 'Not set'}</p>
                    <p className="text-[11px] text-gray-400">Step 2 of 2</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {isPhoneVerified ? (
                    <span className="text-sm text-green-600 font-medium flex items-center gap-1"><Check className="h-4 w-4" /> Verified</span>
                  ) : (
                    <span className="text-sm text-amber-600 font-medium">Not Verified</span>
                  )}
                  <button onClick={() => startEdit('phone')} className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
                    <Pencil size={12} /> Edit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Verification Actions */}
          {(!isEmailVerified || !isPhoneVerified) && (
            <div className="space-y-2 mt-2">
              {!isEmailVerified && (
                <button
                  onClick={handleSendVerificationEmail}
                  disabled={emailSending || cooldown > 0}
                  className={buttonClassName({ variant: 'secondary', size: 'md', full: true, className: 'text-sm' })}
                >
                  {emailSending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Verify Email'}
                </button>
              )}
              {!isPhoneVerified && (
                <button
                  onClick={handleSendOtp}
                  disabled={otpSending || cooldown > 0 || !effectivePhone.trim()}
                  className={buttonClassName({ variant: 'secondary', size: 'md', full: true, className: 'text-sm' })}
                >
                  {otpSending ? 'Sending...' : !effectivePhone.trim() ? 'Add phone number first' : cooldown > 0 ? `${cooldown}s` : 'Verify Mobile'}
                </button>
              )}
            </div>
          )}

          {/* OTP Input (shown when phone verification is in progress) */}
          {!isPhoneVerified && phoneOtpSent && (
            <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
              <p className="text-sm text-gray-600 mb-3">Enter the 6-digit code sent to your phone.</p>
              <OtpInput
                length={6}
                value={otpValue}
                onChange={setOtpValue}
                disabled={otpVerifying}
              />
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={handleVerifyOtp}
                  disabled={otpValue.length !== 6 || otpVerifying}
                  className="flex-1"
                >
                  {otpVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {otpVerifying ? 'Verifying...' : 'Verify'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => { setOtpValue(''); handleSendOtp(); }}
                  disabled={otpSending || cooldown > 0}
                >
                  {otpSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {otpSending ? 'Sending...' : cooldown > 0 ? `${cooldown}s` : 'Resend'}
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                OTP expires in 10 minutes. Max 5 attempts.
              </p>
            </div>
          )}

          {/* Why verify */}
          <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 mt-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-primary-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-primary-700">
                <strong>Why do we verify?</strong> We use verified email & mobile to secure your account, send important updates and help reunite pets faster.
              </p>
            </div>
          </div>

          {/* Step 3: Continue */}
          {allVerified && isPending && (
            <div className="bg-white rounded-xl border-2 border-green-200 p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Account Verified!</h3>
              <p className="text-sm text-gray-600 mb-4">
                {hasReturnUrl
                  ? 'Your account is active. Please log in to continue.'
                  : "Your account is verified! Let's set up your Pet Recovery."}
              </p>
              <Button size="lg" full onClick={handleContinue}>
                {hasReturnUrl ? 'Log in to Continue' : "Let's Get You Started"}
              </Button>
            </div>
          )}

          {allVerified && !isPending && (
            <div className="text-center">
              <Button size="lg" full onClick={handleContinue}>
                {hasReturnUrl ? 'Continue to Checkout' : "Let's Get You Started"}
              </Button>
            </div>
          )}
        </div>
    </AuthLayout>
  );
}
