import { useState, useEffect } from 'react';
import api from '../lib/api';

interface GuardianStats {
  totalMembers: number;
  guardianMembers: number;
  goldMembers: number;
  totalPointsEarned: number;
  totalPawRewardsAllocated: number;
  totalPawRewardsRedeemed: number;
  tierDistribution: {
    CARE: number;
    NURTURE: number;
    PROTECTOR: number;
    SAFEGUARD: number;
  };
  monthlyRecurringRevenue: number;
  averagePointsPerUser: number;
}

interface RecentActivity {
  _id: string;
  userId: { fullName: string; email: string };
  points: number;
  activity: string;
  description: string;
  createdAt: string;
}

export default function GuardianDashboard() {
  const [stats, setStats] = useState<GuardianStats | null>(null);
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [statsRes, activityRes] = await Promise.all([
        api.get('/admin/guardian/stats'),
        api.get('/admin/guardian/activity?limit=10'),
      ]);

      setStats(statsRes.data.data);
      setActivity(activityRes.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load Guardian data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => { setLoading(true); setError(null); fetchData(); }}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guardian Dashboard</h1>
          <p className="text-gray-500">Overview of the Guardian loyalty program</p>
        </div>
        <div className="flex gap-3">
          <a
            href="/admin/guardian/members"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            View Members
          </a>
          <a
            href="/admin/guardian/settings"
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Settings
          </a>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Members</h3>
          <div className="text-3xl font-bold text-gray-900">{stats.totalMembers}</div>
          <p className="text-sm text-gray-500 mt-1">
            {stats.guardianMembers} Guardian · {stats.goldMembers} Gold
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Monthly Revenue</h3>
          <div className="text-3xl font-bold text-green-600">${stats.monthlyRecurringRevenue.toFixed(2)}</div>
          <p className="text-sm text-gray-500 mt-1">Recurring subscription revenue</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Points Earned</h3>
          <div className="text-3xl font-bold text-primary-600">{stats.totalPointsEarned.toLocaleString()}</div>
          <p className="text-sm text-gray-500 mt-1">Total points earned by all members</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">PawRewards</h3>
          <div className="text-3xl font-bold text-amber-600">${stats.totalPawRewardsAllocated.toFixed(2)}</div>
          <p className="text-sm text-gray-500 mt-1">
            ${stats.totalPawRewardsRedeemed.toFixed(2)} redeemed
          </p>
        </div>
      </div>

      {/* Tier Distribution */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Tier Distribution</h2>
        <div className="grid grid-cols-4 gap-4">
          {Object.entries(stats.tierDistribution).map(([tier, count]) => (
            <div key={tier} className="text-center">
              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-2 ${
                tier === 'CARE' ? 'bg-emerald-100' :
                tier === 'NURTURE' ? 'bg-teal-100' :
                tier === 'PROTECTOR' ? 'bg-purple-100' :
                'bg-amber-100'
              }`}>
                <span className={`text-2xl font-bold ${
                  tier === 'CARE' ? 'text-emerald-600' :
                  tier === 'NURTURE' ? 'text-teal-600' :
                  tier === 'PROTECTOR' ? 'text-purple-600' :
                  'text-amber-600'
                }`}>
                  {count}
                </span>
              </div>
              <div className="text-sm font-medium text-gray-900">{tier}</div>
              <div className="text-xs text-gray-500">
                {stats.totalMembers > 0 ? Math.round((count / stats.totalMembers) * 100) : 0}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        {activity.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No recent activity</p>
        ) : (
          <div className="space-y-4">
            {activity.map((item) => (
              <div
                key={item._id}
                className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mr-4">
                    {getActivityIcon(item.activity)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {item.userId?.fullName || 'Unknown User'}
                    </p>
                    <p className="text-sm text-gray-500">{item.description}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className="text-green-600 font-semibold">+{item.points}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getActivityIcon(activity: string): string {
  if (activity.includes('purchase')) return '🛒';
  if (activity.includes('review')) return '⭐';
  if (activity.includes('referral')) return '👥';
  if (activity.includes('scan')) return '📱';
  if (activity.includes('profile')) return '👤';
  if (activity.includes('birthday')) return '🎂';
  return '✨';
}
