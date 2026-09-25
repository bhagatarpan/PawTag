import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, Filter, Crown, Shield, Diamond } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';

interface Member {
  _id: string;
  userId: { _id: string; fullName: string; email: string };
  tierId: { tier: string; displayName: string; price: number };
  status: string;
  price: number;
  currentPeriodEnd: string;
  createdAt: string;
}

const TIER_ICONS: Record<string, typeof Crown> = {
  gold: Crown,
  platinum: Diamond,
  black: Shield,
};

export default function MembershipSubscribers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ tier: '', status: '', search: '' });

  useEffect(() => {
    fetchMembers();
  }, [page, filters]);

  async function fetchMembers() {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (filters.tier) params.tier = filters.tier;
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      
      const res = await api.get(API.admin.membership.subscribers, { params });
      const data = res.data.data;
      setMembers(data.memberships || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-NZ', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Membership Subscribers</h1>
          <p className="text-sm text-gray-500">{total} total members</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={filters.search}
                onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>
          </div>
          <select
            value={filters.tier}
            onChange={(e) => { setFilters({ ...filters, tier: e.target.value }); setPage(1); }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Tiers</option>
            <option value="gold">Gold</option>
            <option value="platinum">Platinum</option>
            <option value="black">Black</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Member</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Tier</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Price</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Renewal Date</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : members.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No members found</td></tr>
            ) : members.map((m) => {
              const tier = m.tierId;
              const Icon = TIER_ICONS[tier?.tier] || Crown;
              return (
                <tr key={m._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{m.userId?.fullName || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{m.userId?.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium">{tier?.displayName || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      m.status === 'active' ? 'bg-green-100 text-green-700' :
                      m.status === 'cancelled' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">${m.price}/yr</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatDate(m.currentPeriodEnd)}</td>
                  <td className="px-6 py-4">
                    <Link
                      to={`/membership/subscribers/${m._id}`}
                      className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-gray-500">
            Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
