import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Shield, Settings, Users, DollarSign, TrendingUp } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';

interface MembershipTier {
  _id: string;
  tier: string;
  displayName: string;
  price: number;
  isActive: boolean;
  displayOrder: number;
}

interface MembershipStats {
  totalMembers: number;
  activeMembers: number;
  tierDistribution: Array<{ tier: string; displayName: string; count: number }>;
}

export default function MembershipDashboard() {
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [stats, setStats] = useState<MembershipStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [tiersRes, statsRes] = await Promise.all([
        api.get(API.admin.membership.tiers),
        api.get(API.admin.membership.stats),
      ]);
      setTiers(tiersRes.data.data || []);
      setStats(statsRes.data.data);
    } catch (err) {
      console.error('Failed to fetch membership data:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const totalRevenue = stats?.tierDistribution.reduce((sum, t) => {
    const tier = tiers.find((ti) => ti.tier === t.tier);
    return sum + (tier?.price || 0) * t.count;
  }, 0) || 0;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Membership Dashboard</h1>
          <p className="text-sm text-gray-500">Overview of membership program performance</p>
        </div>
        <Link
          to="/membership/tiers"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Settings className="h-4 w-4" />
          Manage Tiers
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-5 w-5 text-primary-600" />
            <span className="text-sm text-gray-500">Total Members</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats?.totalMembers || 0}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Crown className="h-5 w-5 text-green-600" />
            <span className="text-sm text-gray-500">Active Members</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats?.activeMembers || 0}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="h-5 w-5 text-amber-600" />
            <span className="text-sm text-gray-500">Total Revenue</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">${totalRevenue.toFixed(0)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <span className="text-sm text-gray-500">Avg. Revenue/Member</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            ${stats?.activeMembers ? (totalRevenue / stats.activeMembers).toFixed(0) : '0'}
          </p>
        </div>
      </div>

      {/* Tier Distribution */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Tier Distribution</h2>
        <div className="space-y-4">
          {stats?.tierDistribution.map((t) => {
            const tier = tiers.find((ti) => ti.tier === t.tier);
            const percentage = stats.activeMembers ? (t.count / stats.activeMembers) * 100 : 0;
            return (
              <div key={t.tier} className="flex items-center gap-4">
                <div className="w-24">
                  <span className="text-sm font-medium text-gray-900">{t.displayName}</span>
                </div>
                <div className="flex-1">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                <div className="w-20 text-right">
                  <span className="text-sm text-gray-600">{t.count} members</span>
                </div>
                <div className="w-20 text-right">
                  <span className="text-sm text-gray-500">${tier?.price || 0}/yr</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-primary-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/membership/tiers"
            className="px-4 py-2 bg-white border border-primary-300 text-primary-700 rounded-lg hover:bg-primary-50 transition-colors"
          >
            Configure Tiers
          </Link>
          <Link
            to="/membership/subscribers"
            className="px-4 py-2 bg-white border border-primary-300 text-primary-700 rounded-lg hover:bg-primary-50 transition-colors"
          >
            View Subscribers
          </Link>
        </div>
      </div>
    </div>
  );
}
