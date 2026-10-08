import { useEffect, useState } from 'react';
import { Search, Loader2, Heart, RefreshCw, Receipt, XCircle, Eye, Download, Mail, ChevronRight } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import { centsToDollars } from '@pawtag/shared';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface AdminDonation {
  id: string;
  email: string;
  name: string;
  amountCents: number;
  currency: string;
  frequency: string;
  status: string;
  pastDue?: boolean;
  stripeSubscriptionId?: string;
  createdAt: string;
  receiptId?: string;
  receiptNumber?: string;
  receiptStatus?: string;
}

const STATUS_COLORS: Record<string, string> = {
  succeeded: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-700',
  refunded: 'bg-purple-100 text-purple-700',
  partially_refunded: 'bg-purple-100 text-purple-700',
};

export default function Donations() {
  const [items, setItems] = useState<AdminDonation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminDonation | null>(null);

  const fetchList = async (q?: string, status?: string) => {
    setLoading(true);
    try {
      const res = await api.get(API.adminDonations.list, {
        params: { q: q ?? search, status: status ?? statusFilter },
      });
      setItems(res.data?.data || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to load donations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleRefund = async (id: string) => {
    if (!window.confirm('Refund this donation? This cannot be undone.')) return;
    setBusyId(id);
    try {
      await api.post(API.adminDonations.refund(id), { reason: 'Admin refund' });
      toast.success('Donation refunded');
      setSelected(null);
      await fetchList();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Refund failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleView = async (receiptId: string) => {
    setBusyId(receiptId);
    try {
      const res = await api.get(API.adminDonations.receiptHtml(receiptId));
      const html = typeof res.data === 'string' ? res.data : res.data?.data || '';
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to view receipt');
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (receiptId: string, receiptNumber?: string) => {
    setBusyId(receiptId);
    try {
      const res = await api.get(API.adminDonations.receiptDownload(receiptId), { responseType: 'blob' });
      const blob = res.data as Blob;
      const safeName = (receiptNumber || 'donation-receipt').replace(/[^\w.-]+/g, '_');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to download receipt PDF');
    } finally {
      setBusyId(null);
    }
  };

  const handleEmail = async (receiptId: string) => {
    setBusyId(receiptId);
    try {
      await api.post(API.adminDonations.resendReceipt(receiptId));
      toast.success('Receipt emailed to donor');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to email receipt');
    } finally {
      setBusyId(null);
    }
  };

  const hasReceipt = (d: AdminDonation) => !!d.receiptId && d.status === 'succeeded';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Heart className="h-6 w-6 text-primary-600" /> Donations
        </h1>
        <button
          onClick={() => fetchList()}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchList(search, statusFilter)}
            placeholder="Search email, name, or receipt # (PTD-…)…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
            aria-label="Search donations"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="succeeded">Succeeded</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary-600" /></div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500">
          No donations found
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600">Donor</th>
                <th className="px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">Receipt #</th>
                <th className="px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((d) => (
                <tr
                  key={d.id}
                  className={`cursor-pointer hover:bg-gray-50 ${selected?.id === d.id ? 'bg-primary-50' : ''}`}
                  onClick={() => setSelected(d)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{d.name || 'Supporter'}</div>
                    <div className="text-xs text-gray-500">{d.email}</div>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    ${centsToDollars(d.amountCents).toFixed(2)} {d.currency}
                  </td>
                  <td className="px-4 py-3">{d.frequency === 'monthly' ? 'Monthly' : 'One-time'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[d.status] || 'bg-gray-100'}`}>
                      {d.pastDue ? 'past_due' : d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">
                    {d.receiptNumber || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(d.createdAt).toLocaleDateString('en-NZ')}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap items-center gap-2">
                      {hasReceipt(d) && (
                        <>
                          <button
                            onClick={() => handleView(d.receiptId!)}
                            disabled={busyId === d.receiptId}
                            className="text-sm text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <Eye className="h-4 w-4" /> View
                          </button>
                          <button
                            onClick={() => handleDownload(d.receiptId!, d.receiptNumber)}
                            disabled={busyId === d.receiptId}
                            className="text-sm text-gray-600 hover:text-gray-900 font-medium inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <Download className="h-4 w-4" /> Download
                          </button>
                          <button
                            onClick={() => handleEmail(d.receiptId!)}
                            disabled={busyId === d.receiptId}
                            className="text-sm text-gray-600 hover:text-gray-900 font-medium inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <Mail className="h-4 w-4" /> Email
                          </button>
                        </>
                      )}
                      {(d.status === 'succeeded' || d.status === 'pending') && (
                        <button
                          onClick={() => handleRefund(d.id)}
                          disabled={busyId === d.id}
                          className="text-sm text-red-600 hover:text-red-700 font-medium inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <XCircle className="h-4 w-4" /> Refund
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Donation detail</h2>
              <p className="text-sm text-gray-600">{selected.name || 'Supporter'} · {selected.email}</p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close detail"
            >
              ✕
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs">Amount</p>
              <p className="font-semibold">${centsToDollars(selected.amountCents).toFixed(2)} {selected.currency}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Frequency</p>
              <p className="font-semibold">{selected.frequency === 'monthly' ? 'Monthly' : 'One-time'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Status</p>
              <p className="font-semibold">{selected.pastDue ? 'past_due' : selected.status}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Receipt</p>
              <p className="font-mono font-semibold">{selected.receiptNumber || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Date</p>
              <p>{new Date(selected.createdAt).toLocaleString('en-NZ')}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Stripe subscription</p>
              <p className="text-xs font-mono">{selected.stripeSubscriptionId || '—'}</p>
            </div>
          </div>
          {hasReceipt(selected) && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => handleView(selected.receiptId!)}
                disabled={busyId === selected.receiptId}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 font-medium disabled:opacity-50"
              >
                <Eye className="h-4 w-4" /> View receipt
              </button>
              <button
                onClick={() => handleDownload(selected.receiptId!, selected.receiptNumber)}
                disabled={busyId === selected.receiptId}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> Download PDF
              </button>
              <button
                onClick={() => handleEmail(selected.receiptId!)}
                disabled={busyId === selected.receiptId}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50"
              >
                <Mail className="h-4 w-4" /> Email to donor
              </button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400 flex items-center gap-1">
        <Receipt className="h-3.5 w-3.5" /> Search by donor email, name, or receipt number.
        Tax claims remain off until NZ donee status is confirmed.
      </p>
    </div>
  );
}
