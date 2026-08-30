import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Phone, CheckCircle2, Clock, ArrowRight, RefreshCw, Loader2, AlertCircle, Pencil, Check } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import OtpInput from '../components/verification/OtpInput';

type VerificationStatus = {
  emailVerified: boolean;
  phoneVerified: boolean;
  status: string;
  email: string;
  phoneNumber: string;
  otpCooldown: number;
} | null;

export default function VerifyAccount() {
  const { user: authUser } = useAuth();
  const [searchParams] = useSearchParams();
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
      const res = await api.get(`/auth/verification-status${params}`);
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
      await api.post('/auth/resend-email-verification', { email: effectiveEmail });
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
      await api.post('/auth/send-phone-otp', { phoneNumber: effectivePhone });
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
    setOtpVerifying(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/auth/verify-phone', { otp: otpValue, phoneNumber: effectivePhone });
      setSuccess('Phone number verified successfully!');
      setOtpValue('');
      setPhoneOtpSent(false);
      fetchStatus();
      // Optimistically update local state when no auth
      if (!status) {
        setStatus(prev => prev ? { ...prev, phoneVerified: true } : {
          emailVerified: true,
          phoneVerified: true,
          status: 'pending_verification',
          email: emailParam || '',
          phoneNumber: phoneParam || '',
          otpCooldown: 0,
        });
      }
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.code === 'OTP_MAX_ATTEMPTS') {
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

  const handleContinue = () => {
    // Check if there's a return URL (e.g., from checkout)
    const returnUrl = localStorage.getItem('pawtag_return_url');
    if (returnUrl) {
      localStorage.removeItem('pawtag_return_url');
      navigate(returnUrl);
      return;
    }
    navigate(status ? '/account' : '/login');
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
      await api.put('/auth/profile', payload);
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  const isEmailVerified = status?.emailVerified ?? false;
  const isPhoneVerified = status?.phoneVerified ?? false;
  const allVerified = isEmailVerified && isPhoneVerified;
  const isPending = status?.status === 'pending_verification' || !status;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="h-14 w-14 bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl">🐾</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Verify Your Account</h1>
          <p className="text-gray-500 mt-2">
            {allVerified
              ? 'Your account is fully verified!'
              : 'Complete the steps below to activate your account.'}
          </p>
        </div>

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
                <div className="h-10 w-10 rounded-full flex items-center justify-center bg-teal-100">
                  <Mail className="h-5 w-5 text-teal-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Edit Email</h3>
              </div>
              <input
                type="email"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors text-sm mb-3"
                placeholder="Enter new email address"
              />
              {editError && <p className="text-xs text-red-600 mb-2">{editError}</p>}
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={editSaving || !editValue || editValue === effectiveEmail}
                  className="flex-1 py-2.5 bg-teal-600 text-white rounded-lg font-medium text-sm hover:bg-teal-700 disabled:opacity-50 transition-all">
                  {editSaving ? 'Saving...' : 'Save & Re-verify'}
                </button>
                <button onClick={() => setEditingField(null)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition-all">
                  Cancel
                </button>
              </div>
              <p className="text-xs text-gray-400 text-center mt-2">You'll need to re-verify your email after changing it.</p>
            </div>
          ) : (
            <div className={`p-4 rounded-xl transition-all ${isEmailVerified ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className={`h-5 w-5 ${isEmailVerified ? 'text-green-600' : 'text-gray-400'}`} />
                  <div>
                    <p className="font-medium text-gray-900">Email Verification</p>
                    <p className="text-xs text-gray-500">{effectiveEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isEmailVerified ? (
                    <span className="text-sm text-green-600 font-medium flex items-center gap-1"><Check className="h-4 w-4" /> Verified</span>
                  ) : (
                    <span className="text-sm text-amber-600 font-medium">Not Verified</span>
                  )}
                  <button onClick={() => startEdit('email')} className="text-xs text-teal-600 hover:text-teal-800 flex items-center gap-1">
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
                <div className="h-10 w-10 rounded-full flex items-center justify-center bg-teal-100">
                  <Phone className="h-5 w-5 text-teal-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Edit Phone</h3>
              </div>
              <input
                type="tel"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors text-sm mb-3"
                placeholder="Enter new phone number"
              />
              {editError && <p className="text-xs text-red-600 mb-2">{editError}</p>}
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={editSaving || !editValue || editValue === effectivePhone}
                  className="flex-1 py-2.5 bg-teal-600 text-white rounded-lg font-medium text-sm hover:bg-teal-700 disabled:opacity-50 transition-all">
                  {editSaving ? 'Saving...' : 'Save & Re-verify'}
                </button>
                <button onClick={() => setEditingField(null)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition-all">
                  Cancel
                </button>
              </div>
              <p className="text-xs text-gray-400 text-center mt-2">You'll need to re-verify your phone after changing it.</p>
            </div>
          ) : (
            <div className={`p-4 rounded-xl transition-all ${isPhoneVerified ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Phone className={`h-5 w-5 ${isPhoneVerified ? 'text-green-600' : 'text-gray-400'}`} />
                  <div>
                    <p className="font-medium text-gray-900">Mobile Verification</p>
                    <p className="text-xs text-gray-500">{effectivePhone || 'Not set'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isPhoneVerified ? (
                    <span className="text-sm text-green-600 font-medium flex items-center gap-1"><Check className="h-4 w-4" /> Verified</span>
                  ) : (
                    <span className="text-sm text-amber-600 font-medium">Not Verified</span>
                  )}
                  <button onClick={() => startEdit('phone')} className="text-xs text-teal-600 hover:text-teal-800 flex items-center gap-1">
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
                  className="w-full py-2.5 text-sm text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50 font-medium disabled:opacity-50 transition-all"
                >
                  {emailSending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Verify Email'}
                </button>
              )}
              {!isPhoneVerified && (
                <button
                  onClick={handleSendOtp}
                  disabled={otpSending || cooldown > 0}
                  className="w-full py-2.5 text-sm text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50 font-medium disabled:opacity-50 transition-all"
                >
                  {otpSending ? 'Sending...' : cooldown > 0 ? `${cooldown}s` : 'Verify Mobile'}
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
                <button
                  onClick={handleVerifyOtp}
                  disabled={otpValue.length !== 6 || otpVerifying}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-teal-600 text-white rounded-lg font-medium text-sm hover:bg-teal-700 disabled:opacity-50 transition-all"
                >
                  {otpVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {otpVerifying ? 'Verifying...' : 'Verify'}
                </button>
                <button
                  onClick={() => { setOtpValue(''); handleSendOtp(); }}
                  disabled={otpSending || cooldown > 0}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 disabled:opacity-50 transition-all"
                >
                  {otpSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {otpSending ? 'Sending...' : cooldown > 0 ? `${cooldown}s` : 'Resend'}
                </button>
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
                {localStorage.getItem('pawtag_return_url')
                  ? 'Your account is active. Please log in to continue.'
                  : 'Your account is now active.'}
              </p>
              <button
                onClick={handleContinue}
                className="w-full py-3 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-all"
              >
                {localStorage.getItem('pawtag_return_url') ? 'Log in to Continue' : 'Continue to Dashboard'}
              </button>
            </div>
          )}

          {allVerified && !isPending && (
            <div className="text-center">
              <button
                onClick={handleContinue}
                className="w-full py-3 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-all"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
