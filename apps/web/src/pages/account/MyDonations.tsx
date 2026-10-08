import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Loader2, Eye, Download, XCircle } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import { centsToDollars } from '@pawtag/shared';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

interface PortalDonation {
  id: string;
  amountCents: number;
  currency: string;
  frequency: string;
  status: string;
  pastDue?: boolean;
  createdAt: string;
  receiptId?: string;
  receiptNumber?: string;
  payments: Array<{
    id: string;
    amountCents: number;
    status: string;
    paidAt?: string;
    receiptId?: string;
    receiptNumber?: string;
  }>;
}

async function fetchReceiptHtml(receiptId: string): Promise<string> {
  const res = await api.get(API.donations.receiptHtml(receiptId));
  return typeof res.data === 'string' ? res.data : res.data?.data || '';
}

function openReceiptInNewTab(html: string) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  // Revoke after a delay so the new tab can load
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function downloadReceiptFile(html: string, receiptNumber?: string) {
  const safeName = (receiptNumber || 'donation-receipt').replace(/[^\w.-]+/g, '_');
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

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

  const viewReceipt = async (receiptId: string) => {
    setBusyId(receiptId);
    setError('');
    try {
      const html = await fetchReceiptHtml(receiptId);
      openReceiptInNewTab(html);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load receipt');
    } finally {
      setBusyId(null);
    }
  };

  const downloadReceipt = async (receiptId: string, receiptNumber?: string) => {
    setBusyId(receiptId);
    setError('');
    try {
      const html = await fetchReceiptHtml(receiptId);
      downloadReceiptFile(html, receiptNumber);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to download receipt');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Heart className="h-6 w-6 text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-900">My Donations</h1>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <p className="text-gray-600 mb-4">You have not made a donation yet.</p>
          <Link to="/donate" className="inline-flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-primary-700">
            <Heart className="h-4 w-4" /> Donate now
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((d) => (
            <div key={d.id} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">
                    ${centsToDollars(d.amountCents).toFixed(2)} {d.currency}
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      {d.frequency === 'monthly' ? 'Monthly' : 'One-time'}
                    </span>
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(d.createdAt).toLocaleDateString('en-NZ')}
                    {' · '}
                    <span className={
                      d.status === 'succeeded' ? 'text-green-600' :
                      d.status === 'cancelled' ? 'text-gray-500' :
                      d.status === 'pending' ? 'text-amber-600' :
                      d.pastDue ? 'text-amber-600' : 'text-gray-700'
                    }>
                      {d.pastDue
                        ? 'Payment due'
                        : d.status === 'pending'
                          ? 'Awaiting payment confirmation'
                          : d.status}
                    </span>
                  </p>
                  {d.receiptNumber && (
                    <p className="text-xs text-primary-700 mt-1 font-medium">
                      Receipt {d.receiptNumber}
                    </p>
                  )}
                  {d.status === 'succeeded' && d.receiptId && (
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => viewReceipt(d.receiptId!)}
                        disabled={busyId === d.receiptId}
                        className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
                      >
                        <Eye className="h-4 w-4" /> View
                      </button>
                      <button
                        onClick={() => downloadReceipt(d.receiptId!, d.receiptNumber)}
                        disabled={busyId === d.receiptId}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium disabled:opacity-50"
                      >
                        <Download className="h-4 w-4" /> Download
                      </button>
                    </div>
                  )}
                </div>
                {d.frequency === 'monthly' && d.status !== 'cancelled' && (
                  <button
                    onClick={() => cancelMonthly(d.id)}
                    className="text-sm text-red-600 hover:text-red-700 font-medium inline-flex items-center gap-1"
                  >
                    <XCircle className="h-4 w-4" /> Cancel
                  </button>
                )}
              </div>

              {d.payments?.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payments</p>
                  <ul className="space-y-2">
                    {d.payments.map((p) => {
                      const rid = p.receiptId || d.receiptId;
                      return (
                        <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="text-gray-700">
                            ${centsToDollars(p.amountCents).toFixed(2)}
                            {p.paidAt ? ` · ${new Date(p.paidAt).toLocaleDateString('en-NZ')}` : ''}
                            {' · '}
                            <span className={p.status === 'succeeded' ? 'text-green-600' : 'text-gray-500'}>{p.status}</span>
                            {p.receiptNumber ? ` · ${p.receiptNumber}` : ''}
                          </span>
                          {rid && p.status === 'succeeded' && (
                            <span className="flex items-center gap-3">
                              <button
                                onClick={() => viewReceipt(rid!)}
                                disabled={busyId === rid}
                                className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
                              >
                                <Eye className="h-4 w-4" /> View
                              </button>
                              <button
                                onClick={() => downloadReceipt(rid!, p.receiptNumber || d.receiptNumber)}
                                disabled={busyId === rid}
                                className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 font-medium disabled:opacity-50"
                              >
                                <Download className="h-4 w-4" /> Download
                              </button>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
