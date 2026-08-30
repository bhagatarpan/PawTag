import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Smartphone, CheckCircle, Loader2, ArrowRight, Shield, LogIn, Pencil, X } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface VerificationStatus {
  verified: boolean;
  emailVerified: boolean;
  smsVerified: boolean;
  expiresAt?: string;
}

interface CheckoutVerificationGateProps {
  children: React.ReactNode;
}

export default function CheckoutVerificationGate({ children }: CheckoutVerificationGateProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // If not logged in, show login prompt instead of dead-end verification
  if (!user && !loading) {
    // Save checkout as return URL so login redirects back here
    const returnUrl = '/checkout';
    localStorage.setItem('pawtag_return_url', returnUrl);

    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-primary-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign in to Checkout</h2>
          <p className="text-gray-500">
            Please sign in or create an account to complete your purchase.
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <Link
            to="/login"
            className="flex items-center justify-center gap-2 w-full bg-primary-600 text-white rounded-xl font-semibold px-6 py-3 hover:bg-primary-700 active:bg-primary-800 transition-all"
          >
            <LogIn className="h-5 w-5" />
            Sign In
          </Link>
          <Link
            to="/register"
            className="flex items-center justify-center gap-2 w-full border border-primary-600 text-primary-600 rounded-xl font-semibold px-6 py-3 hover:bg-primary-50 transition-all"
          >
            Create Account
          </Link>
        </div>
      </div>
    );
  }
  const [emailStep, setEmailStep] = useState<'idle' | 'sending' | 'entered' | 'verified'>('idle');
  const [smsStep, setSmsStep] = useState<'idle' | 'sending' | 'entered' | 'verified'>('idle');
  const [emailOtp, setEmailOtp] = useState('');
  const [smsOtp, setSmsOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<'email' | 'sms' | null>(null);
  const [editingField, setEditingField] = useState<'email' | 'phone' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const checkStatus = useCallback(async () => {
    try {
      const res = await api.get('/customer/checkout-otp/status');
      setStatus(res.data.data);
    } catch {
      setStatus({ verified: false, emailVerified: false, smsVerified: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Auto-verify if already verified
  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (status?.verified) {
    return <>{children}</>;
  }

  const sendOtp = async (channel: 'email' | 'sms') => {
    setError(null);
    setSending(channel);
    try {
      const res = await api.post('/customer/checkout-otp/send', { channel });
      if (res.data.data?.alreadyVerified) {
        await checkStatus();
        return;
      }
      if (channel === 'email') setEmailStep('sending');
      else setSmsStep('sending');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send code');
    } finally {
      setSending(null);
    }
  };

  const verifyOtp = async (channel: 'email' | 'sms') => {
    setError(null);
    const otp = channel === 'email' ? emailOtp : smsOtp;
    if (otp.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }
    try {
      const res = await api.post('/customer/checkout-otp/verify', { channel, otp });
      if (channel === 'email') {
        setEmailStep('verified');
        setEmailOtp('');
      } else {
        setSmsStep('verified');
        setSmsOtp('');
      }
      if (res.data.data?.allVerified) {
        await checkStatus();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Invalid code');
    }
  };

  const startEdit = (field: 'email' | 'phone') => {
    setEditingField(field);
    setEditValue(field === 'email' ? (user?.email || '') : (user?.phoneNumber || ''));
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
      // Reset verification state for the changed field
      if (editingField === 'email') {
        setEmailStep('idle');
        setEmailOtp('');
      } else {
        setSmsStep('idle');
        setSmsOtp('');
      }
      setEditingField(null);
      // Re-fetch status (will show false for changed field)
      await checkStatus();
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Failed to update');
    } finally {
      setEditSaving(false);
    }
  };

  const emailDone = emailStep === 'verified' || status?.emailVerified;
  const smsDone = smsStep === 'verified' || status?.smsVerified;
  const bothDone = emailDone && smsDone;

  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Shield className="h-8 w-8 text-primary-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Identity</h2>
        <p className="text-gray-500">
          For your security, please verify via email and SMS before checkout.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 p-4 mb-6">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Email OTP */}
        <div className={`bg-white rounded-2xl shadow-sm border p-6 transition-all ${emailDone ? 'border-green-200 bg-green-50' : 'border-gray-100'}`}>
          {editingField === 'email' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary-100">
                  <Mail className="h-5 w-5 text-primary-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Edit Email</h3>
              </div>
              <input
                type="email"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
                placeholder="Enter new email address"
              />
              {editError && <p className="text-xs text-red-600">{editError}</p>}
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={editSaving || !editValue || editValue === user?.email}
                  className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-50 transition-all">
                  {editSaving ? 'Saving...' : 'Save & Re-verify'}
                </button>
                <button onClick={() => setEditingField(null)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 transition-all">
                  Cancel
                </button>
              </div>
              <p className="text-xs text-gray-400 text-center">You'll need to re-verify your email after changing it.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${emailDone ? 'bg-green-100' : 'bg-primary-100'}`}>
                  {emailDone ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <Mail className="h-5 w-5 text-primary-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Email Verification</h3>
                  <p className="text-sm text-gray-700">{user?.email || 'your email'}</p>
                </div>
                <button onClick={() => startEdit('email')} className="text-xs text-primary-500 hover:text-primary-700 flex items-center gap-1">
                  <Pencil size={12} /> Edit
                </button>
              </div>

              {emailDone ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Email verified</span>
                </div>
              ) : (
                <>
                  {emailStep === 'idle' && (
                    <button
                      onClick={() => sendOtp('email')}
                      disabled={sending === 'email'}
                      className="w-full bg-primary-600 text-white rounded-xl font-semibold px-6 py-3 hover:bg-primary-700 active:bg-primary-800 transition-all disabled:opacity-50"
                    >
                      {sending === 'email' ? (
                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                      ) : (
                        'Send Email Code'
                      )}
                    </button>
                  )}

                  {(emailStep === 'sending' || emailStep === 'entered') && (
                    <div className="space-y-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={emailOtp}
                        onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="Enter 6-digit code"
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-center text-lg tracking-widest font-mono"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setEmailStep('idle'); setEmailOtp(''); }}
                          className="flex-1 py-3 border border-primary-600 text-primary-600 rounded-xl font-medium hover:bg-primary-50 transition-all text-sm"
                        >
                          Resend
                        </button>
                        <button
                          onClick={() => { setEmailStep('entered'); verifyOtp('email'); }}
                          disabled={emailOtp.length !== 6}
                          className="flex-1 bg-primary-600 text-white rounded-xl font-semibold px-6 py-3 hover:bg-primary-700 active:bg-primary-800 transition-all text-sm disabled:opacity-50"
                        >
                          Verify
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* SMS OTP */}
        <div className={`bg-white rounded-2xl shadow-sm border p-6 transition-all ${smsDone ? 'border-green-200 bg-green-50' : 'border-gray-100'}`}>
          {editingField === 'phone' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary-100">
                  <Smartphone className="h-5 w-5 text-primary-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Edit Phone</h3>
              </div>
              <input
                type="tel"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
                placeholder="Enter new phone number"
              />
              {editError && <p className="text-xs text-red-600">{editError}</p>}
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={editSaving || !editValue || editValue === user?.phoneNumber}
                  className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-50 transition-all">
                  {editSaving ? 'Saving...' : 'Save & Re-verify'}
                </button>
                <button onClick={() => setEditingField(null)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 transition-all">
                  Cancel
                </button>
              </div>
              <p className="text-xs text-gray-400 text-center">You'll need to re-verify your phone after changing it.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${smsDone ? 'bg-green-100' : 'bg-primary-100'}`}>
                  {smsDone ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <Smartphone className="h-5 w-5 text-primary-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Phone Verification</h3>
                  <p className="text-sm text-gray-700">{user?.phoneNumber || 'your phone'}</p>
                </div>
                <button onClick={() => startEdit('phone')} className="text-xs text-primary-500 hover:text-primary-700 flex items-center gap-1">
                  <Pencil size={12} /> Edit
                </button>
              </div>

              {smsDone ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Phone verified</span>
                </div>
              ) : (
                <>
                  {smsStep === 'idle' && (
                    <button
                      onClick={() => sendOtp('sms')}
                      disabled={sending === 'sms'}
                      className="w-full bg-primary-600 text-white rounded-xl font-semibold px-6 py-3 hover:bg-primary-700 active:bg-primary-800 transition-all disabled:opacity-50"
                    >
                      {sending === 'sms' ? (
                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                      ) : (
                        'Send SMS Code'
                      )}
                    </button>
                  )}

                  {(smsStep === 'sending' || smsStep === 'entered') && (
                    <div className="space-y-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={smsOtp}
                        onChange={(e) => setSmsOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="Enter 6-digit code"
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-center text-lg tracking-widest font-mono"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setSmsStep('idle'); setSmsOtp(''); }}
                          className="flex-1 py-3 border border-primary-600 text-primary-600 rounded-xl font-medium hover:bg-primary-50 transition-all text-sm"
                        >
                          Resend
                        </button>
                        <button
                          onClick={() => { setSmsStep('entered'); verifyOtp('sms'); }}
                          disabled={smsOtp.length !== 6}
                          className="flex-1 bg-primary-600 text-white rounded-xl font-semibold px-6 py-3 hover:bg-primary-700 active:bg-primary-800 transition-all text-sm disabled:opacity-50"
                        >
                          Verify
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Continue to Checkout */}
      {bothDone && (
        <div className="mt-6 text-center">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-green-700 font-medium">Identity verified. You can now proceed to checkout.</p>
          </div>
          {children}
        </div>
      )}
    </div>
  );
}
