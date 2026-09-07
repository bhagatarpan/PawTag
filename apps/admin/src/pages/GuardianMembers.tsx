import { useState, useEffect } from 'react';
import api from '../lib/api';

interface GuardianMember {
  _id: string;
  userId: {
    _id: string;
    fullName: string;
    email: string;
    phoneNumber?: string;
  };
  subscription: {
    _id: string;
    planType: string;
    planName: string;
    status: string;
    price: number;
    currentPeriodEnd: string;
    autoRenew: boolean;
  };
  points: number;
  tier: string;
  pawRewardsBalance: number;
  lastActivity: string;
}

const TIER_BADGES: Record<string, string> = {
  CARE: 'bg-emerald-100 text-emerald-700',
  NURTURE: 'bg-teal-100 text-teal-700',
  PROTECTOR: 'bg-purple-100 text-purple-700',
  SAFEGUARD: 'bg-amber-100 text-amber-700',
};

const STATUS_BADGES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  grace_period: 'bg-amber-100 text-amber-700',
  expired: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-700',
};

export default function GuardianMembers() {
  const [members, setMembers] = useState<GuardianMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState({
    tier: '',
    status: '',
    search: '',
  });

  useEffect(() => {
    fetchMembers();
  }, [page, filters]);

  async function fetchMembers() {
    try {
      const params = new URLSearchParams({
        limit: '20',
        offset: String((page - 1) * 20),
      });

      if (filters.tier) params.append('tier', filters.tier);
      if (filters.status) params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);

      const res = await api.get(`/admin/guardian/members?${params.toString()}`);
      
      if (page === 1) {
        setMembers(res.data.data);
      } else {
        setMembers((prev) => [...prev, ...res.data.data]);
      }

      setHasMore(res.data.data.length === 20);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }

  if (loading && page === 1) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => { setLoading(true); setError(null); fetchMembers(); }}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guardian Members</h1>
          <p className="text-gray-500">Manage Guardian loyalty program members</p>
        </div>
        <div className="flex gap-3">
          <a
            href="/admin/guardian"
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back to Dashboard
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={filters.search}
              onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tier</label>
            <select
              value={filters.tier}
              onChange={(e) => { setFilters({ ...filters, tier: e.target.value }); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All Tiers</option>
              <option value="CARE">Care</option>
              <option value="NURTURE">Nurture</option>
              <option value="PROTECTOR">Protector</option>
              <option value="SAFEGUARD">Safeguard</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="grace_period">Grace Period</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setFilters({ tier: '', status: '', search: '' }); setPage(1); }}
              className="w-full px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Members List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {members.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No members found</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {members.map((member) => (
              <div key={member._id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mr-4">
                      <span className="text-lg font-semibold">
                        {member.userId?.fullName?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {member.userId?.fullName || 'Unknown User'}
                      </h3>
                      <p className="text-sm text-gray-500">{member.userId?.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIER_BADGES[member.tier] || 'bg-gray-100 text-gray-700'}`}>
                          {member.tier}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGES[member.subscription?.status] || 'bg-gray-100 text-gray-700'}`}>
                          {member.subscription?.status?.replace('_', ' ') || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary-600">{member.points} pts</div>
                    <div className="text-sm text-gray-500">${member.pawRewardsBalance.toFixed(2)} rewards</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Last activity: {new Date(member.lastActivity).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="p-4 border-t border-gray-100 text-center">
            <button
              onClick={() => setPage(page + 1)}
              disabled={loading}
              className="px-4 py-2 text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
