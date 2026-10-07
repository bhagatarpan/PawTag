import { useEffect, useState } from 'react';
import { Search, Loader2, Heart, RefreshCw, Receipt, XCircle } from 'lucide-react';
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

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await api.get(API.adminDonations.list, {
        params: { q: search || undefined, status: statusFilter || undefined },
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
      await fetchList();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Refund failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Heart className="h-6 w-6 text-primary-600" /> Donations
        </h1>
        <button
          onClick={fetchList}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchList()}
            placeholder="Search email or name…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
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
                <th className="px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((d) => (
                <tr key={d.id}>
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
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(d.createdAt).toLocaleDateString('en-NZ')}
                  </td>
                  <td className="px-4 py-3">
                    {(d.status === 'succeeded' || d.status === 'pending') && (
                      <button
                        onClick={() => handleRefund(d.id)}
                        disabled={busyId === d.id}
                        className="text-sm text-red-600 hover:text-red-700 font-medium inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" /> Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 flex items-center gap-1">
        <Receipt className="h-3.5 w-3.5" /> Receipts are emailed to donors and visible under My Donations after sign-in.
        Public tax claims remain off until NZ donee status is confirmed.
      </p>
    </div>
  );
}
