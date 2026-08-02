import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

interface Subscription {
  _id: string;
  userId: { _id: string; fullName: string; email: string };
  tagId: { _id: string; tagId: string; status: string };
  planName: string;
  planType: string;
  status: string;
  price: number;
  startDate: string;
  currentPeriodEnd: string;
  freePeriodEndsAt?: string;
  gracePeriodEndsAt?: string;
  autoRenew: boolean;
  totalScans: number;
  createdAt: string;
}

interface SubscriptionStats {
  totalActive: number;
  totalExpired: number;
  totalGracePeriod: number;
  totalCancelled: number;
  totalPendingPayment: number;
  totalSubscriptions: number;
  mrr: number;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
  grace_period: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-gray-100 text-gray-700',
  pending_payment: 'bg-orange-100 text-orange-700',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  expired: 'Expired',
  grace_period: 'Grace Period',
  cancelled: 'Cancelled',
  pending_payment: 'Pending Payment',
};

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [statusFilter, planFilter, page]);

  async function fetchStats() {
    try {
      const res = await api.get('/admin/subscriptions/stats');
      setStats(res.data.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }

  async function fetchSubscriptions() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (planFilter) params.set('planType', planFilter);
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('limit', '20');

      const res = await api.get(`/admin/subscriptions?${params.toString()}`);
      setSubscriptions(res.data.data.items);
      setTotalPages(res.data.data.totalPages);
    } catch (err) {
      console.error('Failed to fetch subscriptions:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchSubscriptions();
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-NZ', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <StatCard label="Total" value={stats.totalSubscriptions} color="text-gray-900" />
          <StatCard label="Active" value={stats.totalActive} color="text-green-600" />
          <StatCard label="Grace Period" value={stats.totalGracePeriod} color="text-yellow-600" />
          <StatCard label="Expired" value={stats.totalExpired} color="text-red-600" />
          <StatCard label="Cancelled" value={stats.totalCancelled} color="text-gray-600" />
          <StatCard label="Pending" value={stats.totalPendingPayment} color="text-orange-600" />
          <StatCard label="MRR" value={`$${stats.mrr.toFixed(2)}`} color="text-blue-600" />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Email, name, or tag ID..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
              >
                Search
              </button>
            </div>
          </form>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="grace_period">Grace Period</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
              <option value="pending_payment">Pending Payment</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
            <select
              value={planFilter}
              onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Plans</option>
              <option value="annual">Annual</option>
              <option value="monthly">Monthly</option>
              <option value="free">Free</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tag</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period End</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scans</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">Loading...</td>
              </tr>
            ) : subscriptions.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">No subscriptions found</td>
              </tr>
            ) : (
              subscriptions.map((sub) => (
                <tr key={sub._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{sub.userId?.fullName || 'Unknown'}</div>
                    <div className="text-sm text-gray-500">{sub.userId?.email || ''}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-mono text-gray-900">{sub.tagId?.tagId || 'N/A'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{sub.planName}</div>
                    <div className="text-xs text-gray-500 capitalize">{sub.planType}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[sub.status] || 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABELS[sub.status] || sub.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">${sub.price.toFixed(2)}/mo</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{formatDate(sub.currentPeriodEnd)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{sub.totalScans}</td>
                  <td className="px-6 py-4">
                    <Link
                      to={`/subscriptions/${sub._id}`}
                      className="text-teal-600 hover:text-teal-800 text-sm font-medium"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-xs font-medium text-gray-500 uppercase">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
