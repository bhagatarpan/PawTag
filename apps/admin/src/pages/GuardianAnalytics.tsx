import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Users, Star, Gift, DollarSign, RefreshCw } from 'lucide-react';
import api from '../lib/api';

interface GuardianAnalytics {
  totalMembers: number;
  tierDistribution: Record<string, number>;
  totalPointsEarned: number;
  totalRewardsAllocated: number;
  totalRewardsRedeemed: number;
  goldMembers: number;
  averagePointsPerMember: number;
  averageRewardsPerMember: number;
  recentActivity: any[];
}

export default function GuardianAnalytics() {
  const [analytics, setAnalytics] = useState<GuardianAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    try {
      const res = await api.get('/admin/guardian/stats');
      const stats = res.data.data;
      
      // Calculate additional metrics
      const averagePointsPerMember = stats.totalMembers > 0 
        ? stats.totalPointsEarned / stats.totalMembers 
        : 0;
      const averageRewardsPerMember = stats.totalMembers > 0
        ? stats.totalRewardsAllocated / stats.totalMembers
        : 0;

      setAnalytics({
        ...stats,
        averagePointsPerMember,
        averageRewardsPerMember,
        recentActivity: [],
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-red-800">Error Loading Analytics</h2>
          <p className="text-red-600 mt-2">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  const tierColors: Record<string, string> = {
    CARE: 'bg-green-100 text-green-800',
    NURTURE: 'bg-teal-100 text-teal-800',
    PROTECTOR: 'bg-purple-100 text-purple-800',
    SAFEGUARD: 'bg-amber-100 text-amber-800',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guardian Analytics</h1>
          <p className="text-gray-500">Program performance and insights</p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Total Members</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{analytics.totalMembers}</p>
          <p className="text-sm text-gray-500 mt-1">Active Guardian members</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Star className="h-6 w-6 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Gold Members</h3>
          </div>
          <p className="text-3xl font-bold text-amber-600">{analytics.goldMembers}</p>
          <p className="text-sm text-gray-500 mt-1">Premium subscribers</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Total Points</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">{analytics.totalPointsEarned.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">Points earned by all members</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Gift className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Rewards Allocated</h3>
          </div>
          <p className="text-3xl font-bold text-purple-600">${analytics.totalRewardsAllocated.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">Total PawRewards distributed</p>
        </div>
      </div>

      {/* Tier Distribution */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Tier Distribution</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Object.entries(analytics.tierDistribution).map(([tier, count]) => (
            <div key={tier} className={`rounded-xl p-4 ${tierColors[tier] || 'bg-gray-100 text-gray-800'}`}>
              <p className="text-sm font-medium">{tier}</p>
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-sm opacity-75">
                {analytics.totalMembers > 0 ? ((count / analytics.totalMembers) * 100).toFixed(1) : 0}%
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Average Points per Member</span>
              <span className="font-semibold text-gray-900">{analytics.averagePointsPerMember.toFixed(1)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Average Rewards per Member</span>
              <span className="font-semibold text-gray-900">${analytics.averageRewardsPerMember.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Rewards Redemption Rate</span>
              <span className="font-semibold text-gray-900">
                {analytics.totalRewardsAllocated > 0 
                  ? ((analytics.totalRewardsRedeemed / analytics.totalRewardsAllocated) * 100).toFixed(1)
                  : 0}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Gold Conversion Rate</span>
              <span className="font-semibold text-gray-900">
                {analytics.totalMembers > 0 
                  ? ((analytics.goldMembers / analytics.totalMembers) * 100).toFixed(1)
                  : 0}%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Rewards Allocated</span>
              <span className="font-semibold text-gray-900">${analytics.totalRewardsAllocated.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Rewards Redeemed</span>
              <span className="font-semibold text-green-600">${analytics.totalRewardsRedeemed.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Outstanding Rewards</span>
              <span className="font-semibold text-amber-600">
                ${(analytics.totalRewardsAllocated - analytics.totalRewardsRedeemed).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Estimated Monthly MRR</span>
              <span className="font-semibold text-blue-600">
                ${(analytics.goldMembers * 1.99).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-primary-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/guardian"
            className="px-4 py-2 bg-white border border-primary-300 text-primary-700 rounded-lg hover:bg-primary-50 transition-colors"
          >
            View Dashboard
          </Link>
          <Link
            to="/guardian/members"
            className="px-4 py-2 bg-white border border-primary-300 text-primary-700 rounded-lg hover:bg-primary-50 transition-colors"
          >
            Manage Members
          </Link>
          <Link
            to="/guardian/settings"
            className="px-4 py-2 bg-white border border-primary-300 text-primary-700 rounded-lg hover:bg-primary-50 transition-colors"
          >
            Program Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
