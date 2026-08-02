import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Shield, RefreshCw, Printer, ArrowLeft } from 'lucide-react';

export default function InvoiceView() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const isAdmin = searchParams.get('admin') === '1';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invoice, setInvoice] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [invoiceHtml, setInvoiceHtml] = useState('');
  const [verified, setVerified] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (token) checkStatus();
  }, [token]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  async function checkStatus() {
    try {
      const res = await fetch(`/api/invoice/${token}/status`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid link');
        setLoading(false);
        return;
      }
      setInvoice(data.data.invoice);
      setCustomer(data.data.customer);
      if (data.data.verified) {
        setVerified(true);
        setInvoiceHtml(data.data.invoiceHtml);
      }
    } catch {
      setError('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    const code = otp.join('');
    if (code.length !== 6) { setOtpError('Please enter all 6 digits'); return; }
    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await fetch(`/api/invoice/${token}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error || 'Invalid code');
        if (data.attemptsLeft !== undefined && data.attemptsLeft <= 0) {
          setError('Too many attempts. Please request a new link.');
        }
        return;
      }
      setVerified(true);
      setInvoiceHtml(data.data.invoiceHtml);
    } catch {
      setOtpError('Verification failed');
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleResendOtp() {
    setResendCooldown(60);
    try {
      await fetch(`/api/invoice/${token}/resend-otp`, { method: 'POST' });
    } catch {}
  }

  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setOtpError('');
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    if (newOtp.every(d => d) && newOtp.join('').length === 6) {
      setTimeout(() => handleVerifyOtp(), 100);
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      const newOtp = pasted.split('').concat(Array(6).fill('')).slice(0, 6);
      setOtp(newOtp);
      otpRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg border p-8 max-w-md text-center">
          <Shield size={48} className="text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500 mb-6">{error}</p>
          <a href="/" className="text-teal-600 hover:text-teal-700 text-sm font-medium">Go to PawTag</a>
        </div>
      </div>
    );
  }

  if (verified && invoiceHtml) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="no-print bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <a href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm">
            <ArrowLeft size={16} /> PawTag
          </a>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{invoice?.invoiceNumber}</span>
            <button onClick={handlePrint} className="flex items-center gap-1.5 bg-teal-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-teal-700">
              <Printer size={14} /> Print / Save PDF
            </button>
          </div>
        </div>
        <div dangerouslySetInnerHTML={{ __html: invoiceHtml }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg border p-8 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <Shield size={48} className="text-teal-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-1">Verify Your Identity</h1>
          <p className="text-sm text-gray-500">
            Enter the 6-digit code sent to<br />
            <strong>{customer?.email || 'your email'}</strong>
          </p>
          {invoice && (
            <p className="text-xs text-gray-400 mt-2">
              Invoice: {invoice.invoiceNumber} — ${invoice.amount?.toFixed(2)}
            </p>
          )}
        </div>

        <div className="flex justify-center gap-2 mb-4" onPaste={handlePaste}>
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { otpRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(i, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(i, e)}
              className="w-12 h-14 text-center text-xl font-bold border-2 rounded-lg focus:border-teal-500 focus:outline-none transition-colors"
            />
          ))}
        </div>

        {otpError && <p className="text-red-500 text-sm text-center mb-4">{otpError}</p>}

        <button
          onClick={handleVerifyOtp}
          disabled={otpLoading || otp.join('').length !== 6}
          className="w-full bg-teal-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
        >
          {otpLoading ? 'Verifying...' : 'Verify & View Invoice'}
        </button>

        <div className="text-center">
          <button
            onClick={handleResendOtp}
            disabled={resendCooldown > 0}
            className="text-teal-600 hover:text-teal-700 text-sm font-medium disabled:text-gray-400 disabled:cursor-not-allowed flex items-center gap-1.5 mx-auto"
          >
            <RefreshCw size={14} className={resendCooldown > 0 ? 'animate-spin' : ''} />
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          This code expires in 10 minutes.<br />
          Once verified, you can view this invoice for 24 hours without re-entering the code.
        </p>
      </div>
    </div>
  );
}
