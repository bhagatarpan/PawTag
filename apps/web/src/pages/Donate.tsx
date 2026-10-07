import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShieldCheck, Loader2 } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import { centsToDollars, type DonationSettingsPublic } from '@pawtag/shared';
import api from '../lib/api';
import StripePaymentForm from '../components/StripePaymentForm';

/**
 * Public /donate page — NZD one-time and monthly donations.
 * Amount/copy from server settings. Card entry via Stripe Elements.
 * Public menu visibility is controlled by donation.publicEnabled (footer).
 */
export default function DonatePage() {
  const [settings, setSettings] = useState<DonationSettingsPublic | null>(null);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [custom, setCustom] = useState('');
  const [frequency, setFrequency] = useState<'one_time' | 'monthly'>('one_time');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [marketing, setMarketing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [donationId, setDonationId] = useState<string | null>(null);
  const [paymentAmountCents, setPaymentAmountCents] = useState(0);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    api.get(API.donations.settings)
      .then((res) => setSettings(res.data.data))
      .catch((err) => setError(err?.response?.data?.error || 'Donations are not available right now'));
  }, []);

  const selectedAmount = amount !== '' ? amount : custom ? parseFloat(custom) : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (selectedAmount === '' || Number.isNaN(Number(selectedAmount))) {
      setSubmitError('Please choose or enter a donation amount');
      return;
    }
    setLoading(true);
    try {
      const idempotencyKey = `donate_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const res = await api.post(API.donations.create, {
        amount: Number(selectedAmount),
        currency: settings?.currency || 'NZD',
        frequency,
        email,
        name: name || undefined,
        marketingConsent: marketing,
        idempotencyKey,
      });
      const data = res.data.data;
      setDonationId(data.donationId);
      setPaymentAmountCents(data.amountCents);
      setPaymentClientSecret(data.clientSecret);
    } catch (err: any) {
      setSubmitError(err?.response?.data?.error || 'Could not start your donation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    // Poll status — Stripe webhook is authoritative; this is UX confirmation
    if (!donationId) return;
    try {
      for (let i = 0; i < 10; i++) {
        const res = await api.get(API.donations.status(donationId));
        const st = res.data?.data?.status;
        if (st === 'succeeded') {
          setSuccess(true);
          setPaymentClientSecret(null);
          return;
        }
        await new Promise((r) => setTimeout(r, 800));
      }
      setSuccess(true);
      setPaymentClientSecret(null);
    } catch {
      setSuccess(true);
      setPaymentClientSecret(null);
    }
    void paymentIntentId;
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Donate</h1>
          <p className="text-gray-600">{error}</p>
          <Link to="/" className="inline-block mt-4 text-primary-600 font-medium">Back to home</Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <Heart className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank you</h1>
          <p className="text-gray-600 mb-2">
            Your donation of <strong>${centsToDollars(paymentAmountCents).toFixed(2)}</strong> has been received.
          </p>
          <p className="text-sm text-gray-500 mb-4">
            A receipt email is on its way. You can also view donations in your account after signing in.
          </p>
          <p className="text-xs text-gray-400">
            {settings?.organisationName || 'PawTag'} — {settings?.receiptStatement}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link to="/" className="inline-block text-primary-600 font-medium">Back to home</Link>
            <Link to="/account/donations" className="text-sm text-gray-500 hover:text-gray-700">My Donations</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 bg-primary-50 rounded-full flex items-center justify-center mb-3">
            <Heart className="h-7 w-7 text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {settings?.missionHeadline || 'Support PawTag'}
          </h1>
          <p className="text-gray-600">
            {settings?.missionBody || 'Help keep lost-pet recovery working.'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          {!paymentClientSecret ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <span className="block text-sm font-medium text-gray-700 mb-2">Donation amount (NZD)</span>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {(settings?.suggestedAmounts || [5, 10, 20, 50]).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => { setAmount(a); setCustom(''); }}
                      className={`py-3 rounded-xl border-2 font-semibold transition ${
                        amount === a
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                      aria-pressed={amount === a}
                    >
                      ${a}
                    </button>
                  ))}
                </div>
                <label htmlFor="custom-amount" className="block text-sm font-medium text-gray-700 mb-1">
                  Or enter another amount
                </label>
                <input
                  id="custom-amount"
                  type="number"
                  min={settings ? settings.minAmountCents / 100 : 5}
                  max={settings ? settings.maxAmountCents / 100 : 10000}
                  step="0.01"
                  value={custom}
                  onChange={(e) => { setCustom(e.target.value); setAmount(''); }}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g. 15.00"
                />
                {settings && (
                  <p className="text-xs text-gray-400 mt-1">
                    Min ${(settings.minAmountCents / 100).toFixed(2)} · Max ${(settings.maxAmountCents / 100).toFixed(2)}
                  </p>
                )}
              </div>

              {settings?.frequencies?.includes('monthly') && (
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-2">Frequency</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFrequency('one_time')}
                      className={`py-3 rounded-xl border-2 font-semibold transition ${
                        frequency === 'one_time'
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                      aria-pressed={frequency === 'one_time'}
                    >
                      One-time
                    </button>
                    <button
                      type="button"
                      onClick={() => setFrequency('monthly')}
                      className={`py-3 rounded-xl border-2 font-semibold transition ${
                        frequency === 'monthly'
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                      aria-pressed={frequency === 'monthly'}
                    >
                      Monthly
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="donor-email" className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  id="donor-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <p className="text-xs text-gray-400 mt-1">We use this to send your receipt. No pet account required.</p>
              </div>

              <div>
                <label htmlFor="donor-name" className="block text-sm font-medium text-gray-700 mb-1">Name (optional)</label>
                <input
                  id="donor-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                  autoComplete="name"
                />
              </div>

              <div className="flex items-start gap-2">
                <input
                  id="marketing"
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className="mt-1 w-4 h-4 text-primary-600"
                />
                <label htmlFor="marketing" className="text-sm text-gray-600">
                  I would like occasional updates from PawTag (optional)
                </label>
              </div>

              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700" role="alert">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || selectedAmount === ''}
                className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                  </>
                ) : (
                  <>Continue to payment{selectedAmount !== '' ? ` — $${Number(selectedAmount).toFixed(2)}` : ''}</>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Payment details</h2>
                <span className="text-sm font-medium text-gray-700">
                  ${centsToDollars(paymentAmountCents).toFixed(2)} {settings?.currency || 'NZD'}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Enter your card securely via Stripe. PawTag never stores your card number.
              </p>
              <StripePaymentForm
                clientSecret={paymentClientSecret}
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentError={(msg) => setSubmitError(msg)}
                disabled={loading}
              />
            </div>
          )}

          <p className="flex items-center justify-center gap-2 text-xs text-gray-400 mt-6">
            <ShieldCheck className="h-4 w-4" /> Secure payment via Stripe
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          {settings?.organisationName || 'PawTag'} · {settings?.receiptStatement || 'Thank you for your donation.'}
        </p>
      </div>
    </div>
  );
}
