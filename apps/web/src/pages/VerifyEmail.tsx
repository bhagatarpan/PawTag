import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { buttonClassName } from '@pawtag/ui';
import api from '../lib/api';
import AuthLayout from '../components/AuthLayout';
import { API } from '@pawtag/shared';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [verifyParams, setVerifyParams] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided.');
      return;
    }

    // Guard against React StrictMode double-invoking this effect in dev (mount → unmount →
    // remount). The cancelled flag prevents the first (cleaned-up) invocation from overwriting
    // the state of the second one, and the API is idempotent so a re-run is harmless.
    let cancelled = false;
    api.get(`${API.auth.verifyEmail}?token=${token}`)
      .then((res) => {
        if (cancelled) return;
        if (res.data.success) {
          setStatus('success');
          setMessage(res.data.data?.message || 'Your email has been verified successfully!');
          const email = res.data.data?.email;
          const phone = res.data.data?.phoneNumber;
          const params = new URLSearchParams();
          if (email) params.set('email', email);
          if (phone) params.set('phone', phone);
          params.set('email_status', 'verified');
          setVerifyParams(params.toString());
        } else {
          setStatus('error');
          setMessage(res.data.error || 'Verification failed.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setMessage(err.response?.data?.error || 'Something went wrong. Please try again.');
      });
    return () => { cancelled = true; };
  }, [searchParams]);

  const title =
    status === 'loading' ? 'Verifying your email...' : status === 'success' ? 'Email Verified!' : 'Verification Failed';

  return (
    <AuthLayout title={title} subtitle={status === 'loading' ? undefined : message}>
      <div className="text-center">
        {status === 'loading' && (
          <Loader2 className="h-12 w-12 text-primary-600 animate-spin mx-auto my-6" aria-label="Verifying" />
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-6" />
            <Link
              to={`/verify-account${verifyParams ? `?${verifyParams}` : ''}`}
              className={buttonClassName({ variant: 'primary', size: 'lg', full: true })}
            >
              Continue to Verification
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-6" />
            <Link
              to="/verify-account"
              className={buttonClassName({ variant: 'primary', size: 'lg', full: true })}
            >
              Back to Verification
            </Link>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
