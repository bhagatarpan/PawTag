import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import api from '../lib/api';

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

    api.get(`/auth/verify-email?token=${token}`)
      .then((res) => {
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
        setStatus('error');
        setMessage(err.response?.data?.error || 'Something went wrong. Please try again.');
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 text-teal-600 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900">Verifying your email...</h1>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <Link
              to={`/verify-account${verifyParams ? `?${verifyParams}` : ''}`}
              className="inline-block py-3 px-6 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-all"
            >
              Continue to Verification
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <Link
              to="/verify-account"
              className="inline-block py-3 px-6 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-all"
            >
              Back to Verification
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
