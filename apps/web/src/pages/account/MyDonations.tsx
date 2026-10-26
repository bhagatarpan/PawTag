import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Loader2, Download, XCircle, ChevronRight, RefreshCw } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import {
  centsToDollars,
  formatCurrency,
  formatDate,
  getDonationStatusLabel,
  getDonationStatusVariant,
  DONATION_FREQUENCY_LABELS,
} from '@pawtag/shared';
import { StatusBadge, buttonClassName } from '@pawtag/ui';
import api from '../../lib/api';
import { downloadDonationReceiptPdf } from '../../lib/donationReceipt';
import { useAuth } from '../../context/AuthContext';
import type { PortalDonation } from '../../types';

/**
 * My Donations — invoice document-card structure (owner request after the
 * package Phase 4 invoices pass; image 30 = composition only). Individual
 * cards on the page surface; statuses/frequency resolve from shared config;
 * full-label "View details" (→ detail route) + "Download PDF" controls;
 * payment history lives on the detail page (metadata demotion, same rule as
 * order/invoice details). Receipt/cancel endpoints and gating unchanged.
 */
export default function MyDonations() {
  const { user } = useAuth();
  const [items, setItems] = useState<PortalDonation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api.get(API.donations.me)
      .then((res) => setItems(res.data.data || []))
      .catch((err) => setError(err?.response?.data?.error || 'Failed to load donations'))
      .finally(() => setLoading(false));
  }, [user]);

  const downloadReceipt = async (receiptId: string, receiptNumber?: string) => {
    setBusyId(receiptId);
    setError('');
    try {
      await downloadDonationReceiptPdf(receiptId, receiptNumber);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to download receipt PDF');
    } finally {
      setBusyId(null);
    }
  };

  const cancelMonthly = async (id: string) => {
    if (!window.confirm('Cancel this monthly donation? Future payments will stop.')) return;
    try {
      await api.post(API.donations.cancel(id));
      const res = await api.get(API.donations.me);
      setItems(res.data.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to cancel donation');
    }
  };

  // Stats (image 30): total = money actually received (succeeded payments;
  // a completed donation with no payment rows still counts). Mixed-currency
  // histories hide the total rather than summing across currencies.
  const currencies = new Set(items.map((d) => d.currency || 'NZD'));
  const baseCurrency = items[0]?.currency || 'NZD';
  const mixedCurrency = currencies.size > 1;
  const totalCents = items.reduce((sum, d) => {
    const succeeded = (d.payments || []).filter((p) => p.status === 'succeeded');
    if (succeeded.length > 0) return sum + succeeded.reduce((s, p) => s + (p.amountCents || 0), 0);
    return sum + (d.status === 'succeeded' ? d.amountCents || 0 : 0);
  }, 0);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center py-12 text-gray-500" aria-busy="true">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading donations…
      </div>
    );
  }

  return (
    // Shell owns width/padding/breadcrumb (DESIGN.md — account page chrome);
    // children follow the invoice list rhythm (space-y-6 root, space-y-3 cards).
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Heart className="h-6 w-6 text-primary-600" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-gray-900">My Donations</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Thank you for making a kinder world for pets. Here's your donation history and impact.
        </p>
      </div>

      {error && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <p className="text-gray-600 mb-4">You have not made a donation yet.</p>
          <Link to="/donate" className={buttonClassName({ variant: 'primary', size: 'lg' })}>
            <Heart className="h-4 w-4" aria-hidden="true" /> Donate now
          </Link>
        </div>
      ) : (
        <>
          {/* Impact strip (image 30) — computed client-side from the loaded
              payload; the total hides for mixed currencies instead of lying. */}
          <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 flex flex-wrap items-center gap-x-10 gap-y-4">
            {!mixedCurrency && (
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="w-11 h-11 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center">
                  <Heart size={20} />
                </span>
                <div>
                  <p className="text-xs text-gray-500">Total Donated</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(centsToDollars(totalCents), baseCurrency)}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="w-11 h-11 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center">
                <Heart size={20} />
              </span>
              <div>
                <p className="text-xs text-gray-500">Donations</p>
                <p className="text-xl font-bold text-gray-900">{items.length}</p>
                <p className="text-xs text-gray-500">lives supported</p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Donation History</h2>
            <div className="space-y-3">
              {items.map((d) => {
                const canReceipt = d.status === 'succeeded' && !!d.receiptId;
                const canCancel = d.frequency === 'monthly' && d.status !== 'cancelled';
                const lastPayment = (d.payments || [])[0];
                return (
                  <article
                    key={d.id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="w-11 h-11 shrink-0 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center"
                      >
                        <Heart size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <StatusBadge
                            label={DONATION_FREQUENCY_LABELS[d.frequency] || d.frequency}
                            variant={d.frequency === 'monthly' ? 'primary' : 'neutral'}
                            icon={d.frequency === 'monthly' ? <RefreshCw size={12} /> : undefined}
                          />
                          <StatusBadge
                            label={getDonationStatusLabel(d.status, d.pastDue)}
                            variant={getDonationStatusVariant(d.status, d.pastDue)}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">{formatDate(d.createdAt, 'medium')}</p>
                        {d.receiptNumber && (
                          <p className="text-xs text-gray-500 mt-0.5">Receipt {d.receiptNumber}</p>
                        )}
                        {d.frequency === 'monthly' && (d.payments || []).length > 0 && lastPayment && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {(d.payments || []).length} payments
                            {lastPayment.paidAt ? ` · last ${formatDate(lastPayment.paidAt, 'medium')}` : ''}
                            {' '}· <Link to={`/account/donations/${d.id}`} className="text-primary-600 hover:text-primary-700 font-medium">View history</Link>
                          </p>
                        )}
                      </div>
                      <p className="text-base font-bold text-gray-900 shrink-0">
                        {formatCurrency(centsToDollars(d.amountCents), d.currency || 'NZD')}
                      </p>
                    </div>

                    {/* Full-label controls per the invoice pattern — nothing
                        nested inside a button-like row. */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Link
                        to={`/account/donations/${d.id}`}
                        className={buttonClassName({ variant: 'primary', size: 'md', full: true })}
                      >
                        View details
                        <ChevronRight size={16} aria-hidden="true" />
                      </Link>
                      {canReceipt && (
                        <button
                          type="button"
                          onClick={() => downloadReceipt(d.receiptId!, d.receiptNumber)}
                          disabled={busyId === d.receiptId}
                          className={buttonClassName({ variant: 'secondary', size: 'md', full: true, className: 'shrink-0' })}
                        >
                          {busyId === d.receiptId ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Download size={16} />
                          )}
                          Download PDF
                        </button>
                      )}
                    </div>

                    {canCancel && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => cancelMonthly(d.id)}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 min-h-[44px] px-2"
                        >
                          <XCircle size={15} aria-hidden="true" /> Cancel monthly
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
