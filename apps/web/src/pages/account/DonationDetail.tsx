import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Eye, Loader2, Heart, ShieldAlert, Copy } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import {
  centsToDollars,
  formatCurrency,
  formatDate,
  getDonationStatusLabel,
  getDonationStatusVariant,
  DONATION_FREQUENCY_LABELS,
} from '@pawtag/shared';
import { CopyButton, StatusBadge, buttonClassName, InfoCard } from '@pawtag/ui';
import api from '../../lib/api';
import { openDonationReceipt, downloadDonationReceiptPdf } from '../../lib/donationReceipt';
import type { PortalDonation } from '../../types';

/**
 * Donation detail (/account/donations/:id) — the invoice-detail twin
 * (owner request after the package Phase 4 pass): compact document summary
 * (type/amount/status pill/date), the full payment history demoted from the
 * list, receipt View/Download actions sticky on desktop and fixed above the
 * tab bar on mobile. Data comes from the existing donations.me projection
 * selected by id — no API change; receipt endpoints/gating unchanged.
 */
export default function DonationDetail() {
  const { id } = useParams<{ id: string }>();
  const [donation, setDonation] = useState<PortalDonation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get(API.donations.me)
      .then((res) => {
        const items: PortalDonation[] = res.data.data || [];
        const found = items.find((d) => d.id === id) || null;
        setDonation(found);
        if (!found) setNotFound(true);
      })
      .catch((err: any) => setError(err?.response?.data?.error || 'Failed to load this donation'))
      .finally(() => setLoading(false));
  }, [id]);

  const canReceipt = Boolean(donation && donation.status === 'succeeded' && donation.receiptId);

  const handleView = async () => {
    if (!donation?.receiptId) return;
    setViewing(true);
    setError('');
    try {
      await openDonationReceipt(donation.receiptId);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Unable to load receipt');
    } finally {
      setViewing(false);
    }
  };

  const handleDownload = async () => {
    if (!donation?.receiptId) return;
    setDownloading(true);
    setError('');
    try {
      await downloadDonationReceiptPdf(donation.receiptId, donation.receiptNumber);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to download receipt PDF');
    } finally {
      setDownloading(false);
    }
  };

  const viewDownloadButton = (
    // shrink-0 + flex-wrap: fits 320px without overflow (invoice-detail rule).
    <div className="flex items-center gap-2 shrink-0 flex-wrap ml-auto">
      <button
        type="button"
        onClick={handleView}
        disabled={viewing}
        className={buttonClassName({ variant: 'secondary', size: 'md', className: 'shrink-0' })}
      >
        {viewing ? (
          <><Loader2 size={16} className="animate-spin" /> Opening…</>
        ) : (
          <><Eye size={16} /> View Receipt</>
        )}
      </button>
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className={buttonClassName({ variant: 'primary', size: 'md', className: 'shrink-0' })}
      >
        {downloading ? (
          <><Loader2 size={16} className="animate-spin" /> Downloading…</>
        ) : (
          <><Download size={16} /> Download PDF</>
        )}
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center py-12 text-gray-500" aria-busy="true">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading donation…
      </div>
    );
  }

  if (notFound || !donation) {
    return (
      <div className="space-y-4">
        <InfoCard
          tone="danger"
          icon={<ShieldAlert size={18} />}
          title={error || 'Donation not found'}
        >
          It may have been removed, or the link is out of date.
        </InfoCard>
        <Link to="/account/donations" className={buttonClassName({ variant: 'secondary' })}>
          <ArrowLeft size={16} /> Back to donations
        </Link>
      </div>
    );
  }

  const payments = donation.payments || [];

  return (
    // Bottom clearance: shell pb-28 covers the tab bar; the fixed receipt bar
    // stacks above it (same contract as the invoice detail page).
    <div className={`space-y-6 animate-fade-in ${canReceipt ? 'pb-24 lg:pb-8' : ''}`}>
      <Link
        to="/account/donations"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Back to donations
      </Link>

      {/* Sticky top bar — desktop actions live here (invoice-detail contract) */}
      <div className="sticky top-16 z-20 -mx-4 px-4 py-2 bg-white/95 backdrop-blur border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <h1 className="text-lg font-bold text-gray-900 truncate">
            {donation.receiptNumber || 'Donation'}
          </h1>
          {donation.receiptNumber && <CopyButton text={donation.receiptNumber} />}
        </div>
        <div className="hidden lg:block">{canReceipt ? viewDownloadButton : null}</div>
      </div>

      {error && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        {/* Compact summary (plan §5.3 shape): type, amount, status, date */}
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="w-12 h-12 shrink-0 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center"
          >
            <Heart size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-gray-500">
                {DONATION_FREQUENCY_LABELS[donation.frequency] || donation.frequency} donation
                {donation.receiptNumber ? ` · Receipt ${donation.receiptNumber}` : ''}
              </p>
              <StatusBadge
                size="md"
                label={getDonationStatusLabel(donation.status, donation.pastDue)}
                variant={getDonationStatusVariant(donation.status, donation.pastDue)}
              />
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(centsToDollars(donation.amountCents), donation.currency || 'NZD')}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Given {formatDate(donation.createdAt, 'long')}
              {donation.cancelledAt ? ` · Cancelled ${formatDate(donation.cancelledAt, 'long')}` : ''}
            </p>
          </div>
        </div>

        {/* Payment history — demoted from the list (invoice-metadata rule) */}
        {payments.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-gray-900 mb-3">Payments ({payments.length})</h2>
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
              {payments.map((p) => {
                const rid = p.receiptId || donation.receiptId;
                return (
                  <div key={p.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {p.paidAt ? formatDate(p.paidAt, 'medium') : 'Payment'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge
                          label={getDonationStatusLabel(p.status)}
                          variant={getDonationStatusVariant(p.status)}
                        />
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCurrency(centsToDollars(p.amountCents), donation.currency || 'NZD')}
                        </span>
                      </div>
                    </div>
                    {rid && p.status === 'succeeded' && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            setBusyPaymentId(p.id);
                            setError('');
                            try {
                              await openDonationReceipt(rid);
                            } catch (err: any) {
                              setError(err?.response?.data?.error || 'Unable to load receipt');
                            } finally {
                              setBusyPaymentId(null);
                            }
                          }}
                          disabled={busyPaymentId === p.id}
                          className={buttonClassName({ variant: 'secondary', size: 'md', className: 'shrink-0' })}
                        >
                          {busyPaymentId === p.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Eye size={16} />
                          )}
                          View receipt
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setBusyPaymentId(p.id);
                            setError('');
                            try {
                              await downloadDonationReceiptPdf(rid, p.receiptNumber || donation.receiptNumber);
                            } catch (err: any) {
                              setError(err?.response?.data?.error || 'Failed to download receipt PDF');
                            } finally {
                              setBusyPaymentId(null);
                            }
                          }}
                          disabled={busyPaymentId === p.id}
                          className={buttonClassName({ variant: 'primary', size: 'md', className: 'shrink-0' })}
                        >
                          {busyPaymentId === p.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Download size={16} />
                          )}
                          Download PDF
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 inline-flex items-center gap-1">
          <Copy size={12} aria-hidden="true" />
          View Receipt opens the issued receipt document; Download PDF saves the server-generated file.
        </p>
      </div>

      {/* Mobile fixed bar — above the account tab bar via --app-bottom-nav-height */}
      {canReceipt && (
        <div className="lg:hidden fixed bottom-[var(--app-bottom-nav-height)] left-0 right-0 z-40 bg-white border-t border-gray-200 px-4 py-3 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-gray-500 truncate">
                {donation.receiptNumber || `${DONATION_FREQUENCY_LABELS[donation.frequency] || donation.frequency} donation`}
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {formatCurrency(centsToDollars(donation.amountCents), donation.currency || 'NZD')}
              </p>
            </div>
            {viewDownloadButton}
          </div>
        </div>
      )}
    </div>
  );
}
