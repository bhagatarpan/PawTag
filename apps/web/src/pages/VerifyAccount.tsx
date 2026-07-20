import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Phone, CheckCircle2, Clock, ArrowRight, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import api from '../lib/api';
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

  const emailStatus = searchParams.get('email_status');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/auth/verification-status');
      setStatus(res.data.data);
      setCooldown(res.data.data.otpCooldown || 0);
    } catch {
      // Not authenticated — may have just registered
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (emailStatus === 'verified') {
      setSuccess('Email verified successfully!');
      fetchStatus();
    } else if (emailStatus === 'expired') {
      setError('This verification link has expired. Please request a new one.');
    } else if (emailStatus === 'invalid') {
      setError('This verification link is invalid.');
    } else if (emailStatus === 'already_verified') {
      setSuccess('Your email is already verified.');
    }
  }, [emailStatus, fetchStatus]);

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
      await api.post('/auth/resend-email-verification', { email: status?.email });
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
      await api.post('/auth/send-phone-otp', { phoneNumber: status?.phoneNumber });
      setSuccess('OTP sent to your phone number.');
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
      await api.post('/auth/verify-phone', { otp: otpValue });
      setSuccess('Phone number verified successfully!');
      setOtpValue('');
      fetchStatus();
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
    navigate('/account');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  const allVerified = status?.emailVerified && status?.phoneVerified;
  const isPending = status?.status === 'pending_verification';

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
          {/* Step 1: Email Verification */}
          <div className={`bg-white rounded-xl border-2 p-6 transition-all ${
            status?.emailVerified ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  status?.emailVerified ? 'bg-green-100' : 'bg-teal-100'
                }`}>
                  {status?.emailVerified ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Mail className="h-5 w-5 text-teal-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Email Verification</h3>
                  <p className="text-xs text-gray-500">{status?.email}</p>
                </div>
              </div>
              {status?.emailVerified && (
                <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">Verified</span>
              )}
            </div>

            {!status?.emailVerified && (
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  We'll send a verification link to your email address.
                </p>
                <button
                  onClick={handleSendVerificationEmail}
                  disabled={emailSending || cooldown > 0}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-teal-600 text-white rounded-lg font-medium text-sm hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {emailSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : cooldown > 0 && !emailSent ? null : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {emailSending
                    ? 'Sending...'
                    : cooldown > 0 && !emailSent
                    ? `Resend in ${cooldown}s`
                    : 'Send Verification Email'}
                </button>
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Click the link in the email to verify. Check your spam folder if you don't see it.
                </p>
              </div>
            )}
          </div>

          {/* Step 2: Phone Verification */}
          <div className={`bg-white rounded-xl border-2 p-6 transition-all ${
            status?.phoneVerified ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  status?.phoneVerified ? 'bg-green-100' : 'bg-teal-100'
                }`}>
                  {status?.phoneVerified ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Phone className="h-5 w-5 text-teal-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Phone Verification</h3>
                  <p className="text-xs text-gray-500">{status?.phoneNumber}</p>
                </div>
              </div>
              {status?.phoneVerified && (
                <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">Verified</span>
              )}
            </div>

            {!status?.phoneVerified && (
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  Enter the 6-digit code sent to your phone.
                </p>

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
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-teal-600 text-white rounded-lg font-medium text-sm hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {otpVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    {otpVerifying ? 'Verifying...' : 'Verify'}
                  </button>
                  <button
                    onClick={handleSendOtp}
                    disabled={otpSending || cooldown > 0}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {otpSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : cooldown > 0 ? (
                      <Clock className="h-4 w-4" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {otpSending ? 'Sending...' : cooldown > 0 ? `${cooldown}s` : 'Send OTP'}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">
                  OTP expires in 10 minutes. Max 5 attempts.
                </p>
              </div>
            )}
          </div>

          {/* Step 3: Continue */}
          {allVerified && isPending && (
            <div className="bg-white rounded-xl border-2 border-green-200 p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Account Verified!</h3>
              <p className="text-sm text-gray-600 mb-4">Your account is now active.</p>
              <button
                onClick={handleContinue}
                className="w-full py-3 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-all"
              >
                Continue to Dashboard
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
