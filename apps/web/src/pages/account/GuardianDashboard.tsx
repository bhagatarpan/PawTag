import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Gift, ArrowUpRight } from 'lucide-react';
import api from '../../lib/api';

type TierName = 'CARE' | 'NURTURE' | 'PROTECTOR' | 'SAFEGUARD';

interface TierBenefits {
  name: string;
  displayName: string;
  pointsMultiplier: number;
  pawRewardsMonthly: number;
  freeShippingThreshold: number;
  earlyAccess: boolean;
  prioritySupport: boolean;
  exclusivePromotions: boolean;
  monthlyProgressEmail: boolean;
  guardianBadge: boolean;
  communityAccess: boolean;
}

interface GuardianData {
  points: number;
  tier: TierName;
  pawRewards: {
    balance: number;
    totalEarned: number;
    totalRedeemed: number;
    totalExpired: number;
  };
  recentActivity: Array<{
    type: string;
    points?: number;
    amount?: number;
    description?: string;
    createdAt: string;
  }>;
  tierInfo: {
    currentTier: TierName;
    points: number;
    nextTier: TierName | null;
    pointsToNextTier: number | null;
    benefits: TierBenefits;
  };
}

const TIER_COLORS: Record<TierName, string> = {
  CARE: 'from-emerald-500 to-teal-600',
  NURTURE: 'from-teal-500 to-cyan-600',
  PROTECTOR: 'from-purple-500 to-indigo-600',
  SAFEGUARD: 'from-amber-500 to-orange-600',
};

const TIER_BADGES: Record<TierName, string> = {
  CARE: 'bg-emerald-100 text-emerald-700',
  NURTURE: 'bg-teal-100 text-teal-700',
  PROTECTOR: 'bg-purple-100 text-purple-700',
  SAFEGUARD: 'bg-amber-100 text-amber-700',
};

export default function GuardianDashboard() {
  const [data, setData] = useState<GuardianData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGuardianData();
  }, []);

  async function fetchGuardianData() {
    try {
      const [pointsRes, rewardsRes, tierRes, historyRes] = await Promise.all([
        api.get('/customer/guardian/points'),
        api.get('/customer/guardian/rewards'),
        api.get('/customer/guardian/tier'),
        api.get('/customer/guardian/history'),
      ]);

      setData({
        points: pointsRes.data.data.points,
        tier: pointsRes.data.data.tier,
        pawRewards: {
          balance: rewardsRes.data.data.balance,
          totalEarned: rewardsRes.data.data.totalEarned,
          totalRedeemed: rewardsRes.data.data.totalRedeemed,
          totalExpired: rewardsRes.data.data.totalExpired,
        },
        recentActivity: historyRes.data.data.history,
        tierInfo: tierRes.data.data,
      });
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-48 bg-gray-200 rounded-2xl"></div>
            <div className="h-48 bg-gray-200 rounded-2xl"></div>
            <div className="h-48 bg-gray-200 rounded-2xl"></div>
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
          onClick={fetchGuardianData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!data) return null;

const progressPercent = data.tierInfo.pointsToNextTier !== null
   ? Math.min(100, (data.points / (data.points + data.tierInfo.pointsToNextTier)) * 100)
   : 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guardian Dashboard</h1>
          <p className="text-gray-500">Your loyalty journey and rewards</p>
        </div>
        <Link
          to="/account/guardian/points"
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          View Points History
        </Link>
      </div>

      {/* Tier Card */}
      <div className={`bg-gradient-to-r ${TIER_COLORS[data.tier]} rounded-2xl p-6 text-white`}>
        <div className="flex items-center justify-between">
          <div>
<div className="flex items-center gap-3 mb-2">
               <span className="text-3xl font-bold">{data.tierInfo.benefits.displayName}</span>
               {data.tierInfo.benefits.guardianBadge && (
                 <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                   Guardian Badge
                 </span>
               )}
             </div>
<p className="text-white/80">
               {data.tierInfo.pointsToNextTier !== null
                 ? `${data.tierInfo.pointsToNextTier} points to ${data.tierInfo.nextTier}`
                 : 'Maximum tier reached!'}
             </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold">{data.points}</div>
            <div className="text-white/80">Guardian Points</div>
          </div>
        </div>

        {/* Progress Bar */}
{data.tierInfo.pointsToNextTier !== null && (
           <div className="mt-6">
             <div className="flex justify-between text-sm text-white/80 mb-2">
               <span>{data.tier}</span>
               <span>{data.tierInfo.nextTier}</span>
             </div>
             <div className="h-2 bg-white/20 rounded-full overflow-hidden">
               <div
                 className="h-full bg-white rounded-full transition-all duration-500"
                 style={{ width: `${progressPercent}%` }}
               />
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Points Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Guardian Points</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${TIER_BADGES[data.tier]}`}>
              {data.tier}
            </span>
          </div>
          <div className="text-3xl font-bold text-primary-600 mb-2">{data.points}</div>
          <p className="text-sm text-gray-500">Lifetime points earned</p>
          <Link
            to="/account/guardian/points"
            className="mt-4 block text-center text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            View History →
          </Link>
        </div>

        {/* PawRewards Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">PawRewards</h3>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
              ${data.pawRewards.balance.toFixed(2)}
            </span>
          </div>
          <div className="text-3xl font-bold text-green-600 mb-2">
            ${data.pawRewards.balance.toFixed(2)}
</div>
           <p className="text-sm text-gray-500">Available to redeem</p>
           <Link
             to="/account/guardian/rewards"
             className="mt-4 block text-center text-primary-600 hover:text-primary-700 text-sm font-medium"
           >
             View Rewards →
           </Link>
        </div>

        {/* Benefits Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Benefits</h3>
          <ul className="space-y-2">
            <li className="flex items-center text-sm">
<span className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center mr-3">
                 ✓
               </span>
               Monthly PawRewards: ${data.tierInfo.benefits.pawRewardsMonthly.toFixed(2)}
            </li>
            <li className="flex items-center text-sm">
<span className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center mr-3">
                 ✓
               </span>
               Free shipping over ${data.tierInfo.benefits.freeShippingThreshold}
            </li>
{data.tierInfo.benefits.earlyAccess && (
               <li className="flex items-center text-sm">
                 <span className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center mr-3">
                   ✓
                 </span>
                 Early access to products
               </li>
             )}
{data.tierInfo.benefits.prioritySupport && (
               <li className="flex items-center text-sm">
                 <span className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center mr-3">
                   ✓
                 </span>
                 Priority support
               </li>
             )}
          </ul>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        {data.recentActivity.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No activity yet. Start earning points by making purchases or completing your profile!
          </p>
        ) : (
          <div className="space-y-4">
            {data.recentActivity.slice(0, 5).map((activity, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mr-4">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{activity.description}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(activity.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className="text-green-600 font-semibold">+{activity.points} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/account/guardian/points"
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:border-primary-200 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3 mb-2">
            <Shield size={20} className="text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">Points History</h3>
          </div>
          <p className="text-gray-500">View all your points transactions and earning history</p>
        </Link>
        <Link
          to="/account/guardian/rewards"
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:border-primary-200 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3 mb-2">
            <Gift size={20} className="text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">PawRewards</h3>
          </div>
          <p className="text-gray-500">Manage your rewards balance and redemption history</p>
        </Link>
        <Link
          to="/account/upgrade"
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:border-primary-200 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3 mb-2">
            <ArrowUpRight size={20} className="text-amber-600" />
            <h3 className="text-lg font-semibold text-gray-900">Upgrade Plan</h3>
          </div>
          <p className="text-gray-500">Unlock higher tiers with more benefits and rewards</p>
        </Link>
      </div>
    </div>
  );
}

function getActivityIcon(type: string): string {
  if (type.includes('purchase')) return '🛒';
  if (type.includes('review')) return '⭐';
  if (type.includes('referral')) return '👥';
  if (type.includes('scan')) return '📱';
  if (type.includes('profile')) return '👤';
  if (type.includes('birthday')) return '🎂';
  return '✨';
}
