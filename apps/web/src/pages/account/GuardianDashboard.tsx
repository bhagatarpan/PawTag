import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Gift, ArrowUpRight, Award, Star, Trophy, Target, ShoppingBag, MessageSquare, Users, TrendingUp, Zap, Crown, Heart, Flame, Medal, CheckCircle } from 'lucide-react';
import { API } from '@pawtag/shared/api';
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
  isGoldMember: boolean;
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

const TIER_ORDER: TierName[] = ['CARE', 'NURTURE', 'PROTECTOR', 'SAFEGUARD'];

interface Achievement {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number;
  total: number;
  gradient: string;
  glowColor: string;
}

function useAchievements(data: GuardianData): Achievement[] {
  const tierIndex = TIER_ORDER.indexOf(data.tier);
  const purchaseCount = data.recentActivity.filter((a) => a.type === 'purchase').length;
  const reviewCount = data.recentActivity.filter((a) => a.type === 'review').length;
  const referralCount = data.recentActivity.filter((a) => a.type === 'referral').length;

  return [
    {
      id: 'guardian-member',
      icon: <Star size={24} />,
      title: 'Guardian Member',
      description: 'Joined the Guardian loyalty program',
      unlocked: true,
      progress: 1,
      total: 1,
      gradient: 'from-amber-400 to-orange-500',
      glowColor: 'rgba(251, 191, 36, 0.4)',
    },
    {
      id: 'first-purchase',
      icon: <ShoppingBag size={24} />,
      title: 'First Purchase',
      description: 'Made your first order',
      unlocked: data.points > 0,
      progress: Math.min(data.points > 0 ? 1 : 0, 1),
      total: 1,
      gradient: 'from-emerald-400 to-teal-500',
      glowColor: 'rgba(16, 185, 129, 0.4)',
    },
    {
      id: 'care-tier',
      icon: <Award size={24} />,
      title: 'CARE Tier',
      description: 'Reached CARE Guardian status',
      unlocked: tierIndex >= 0,
      progress: tierIndex >= 0 ? 1 : Math.min(data.points / 100, 0.99),
      total: 1,
      gradient: 'from-emerald-500 to-teal-600',
      glowColor: 'rgba(16, 185, 129, 0.4)',
    },
    {
      id: 'points-collector',
      icon: <Target size={24} />,
      title: 'Points Collector',
      description: 'Earned 500+ Guardian Points',
      unlocked: data.points >= 500,
      progress: Math.min(data.points / 500, 1),
      total: 500,
      gradient: 'from-primary-400 to-primary-600',
      glowColor: 'rgba(20, 184, 166, 0.4)',
    },
    {
      id: 'review-star',
      icon: <MessageSquare size={24} />,
      title: 'Review Star',
      description: 'Left a product review',
      unlocked: reviewCount > 0,
      progress: Math.min(reviewCount > 0 ? 1 : 0, 1),
      total: 1,
      gradient: 'from-yellow-400 to-amber-500',
      glowColor: 'rgba(245, 158, 11, 0.4)',
    },
    {
      id: 'refer-a-friend',
      icon: <Users size={24} />,
      title: 'Refer a Friend',
      description: 'Referred 1+ friend to PawTag',
      unlocked: referralCount > 0,
      progress: Math.min(referralCount > 0 ? 1 : 0, 1),
      total: 1,
      gradient: 'from-blue-400 to-indigo-500',
      glowColor: 'rgba(59, 130, 246, 0.4)',
    },
    {
      id: 'nurture-tier',
      icon: <TrendingUp size={24} />,
      title: 'NURTURE Tier',
      description: 'Reached NURTURE Guardian status',
      unlocked: tierIndex >= 1,
      progress: tierIndex >= 1 ? 1 : Math.min(data.points / 100, 0.99),
      total: 100,
      gradient: 'from-teal-500 to-cyan-600',
      glowColor: 'rgba(20, 184, 166, 0.4)',
    },
    {
      id: 'power-shopper',
      icon: <Zap size={24} />,
      title: 'Power Shopper',
      description: 'Made 10+ purchases',
      unlocked: purchaseCount >= 10,
      progress: Math.min(purchaseCount / 10, 1),
      total: 10,
      gradient: 'from-violet-400 to-purple-600',
      glowColor: 'rgba(139, 92, 246, 0.4)',
    },
    {
      id: 'protector-tier',
      icon: <Shield size={24} />,
      title: 'PROTECTOR Tier',
      description: 'Reached PROTECTOR Guardian status',
      unlocked: tierIndex >= 2,
      progress: tierIndex >= 2 ? 1 : Math.min(data.points / 200, 0.99),
      total: 200,
      gradient: 'from-purple-500 to-indigo-600',
      glowColor: 'rgba(139, 92, 246, 0.4)',
    },
    {
      id: 'safeguard-elite',
      icon: <Crown size={24} />,
      title: 'SAFEGUARD Elite',
      description: 'Reached the highest Guardian tier',
      unlocked: tierIndex >= 3,
      progress: tierIndex >= 3 ? 1 : Math.min(data.points / 300, 0.99),
      total: 300,
      gradient: 'from-amber-500 to-orange-600',
      glowColor: 'rgba(245, 158, 11, 0.5)',
    },
  ];
}

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
        api.get(API.customer.guardian.points),
        api.get(API.customer.guardian.rewards),
        api.get(API.customer.guardian.tier),
        api.get(API.customer.guardian.history),
      ]);

      setData({
        points: pointsRes.data.data.points,
        tier: pointsRes.data.data.tier,
        isGoldMember: tierRes.data.data.isGoldMember || false,
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

const achievements = useAchievements(data);
const unlockedCount = achievements.filter((a) => a.unlocked).length;

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

      {/* Gold Membership Indicator */}
      {data.isGoldMember && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                <Crown size={28} className="text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Gold Member</h3>
                <p className="text-white/80 text-sm">2× points on all purchases · Priority support · Early access</p>
              </div>
            </div>
            <span className="px-4 py-2 bg-white/20 rounded-full text-sm font-bold uppercase tracking-wide">Active</span>
          </div>
        </div>
      )}

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

        {/* Achievements Card — removed, now full-width below */}
      </div>

      {/* Achievements Section — Full Width */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 md:p-8 text-white relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-500/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

        {/* Header */}
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Trophy size={28} className="text-amber-400" />
              <h2 className="text-2xl font-bold">Achievements</h2>
            </div>
            <p className="text-gray-400 text-sm">
              {unlockedCount} of {achievements.length} unlocked — keep going!
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-2xl font-bold text-amber-400">{unlockedCount}/{achievements.length}</div>
              <div className="text-xs text-gray-400">Completed</div>
            </div>
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="url(#achievementGradient)"
                  strokeWidth="3"
                  strokeDasharray={`${(unlockedCount / achievements.length) * 100}, 100`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="achievementGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#f97316" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Medal size={20} className="text-amber-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Achievement Grid */}
        <div className="relative grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
          {achievements.map((achievement) => (
            <div
              key={achievement.id}
              className={`group relative rounded-xl p-4 transition-all duration-300 ${
                achievement.unlocked
                  ? 'bg-gradient-to-br ' + achievement.gradient + ' text-white shadow-lg hover:scale-105 hover:shadow-xl cursor-default'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
              }`}
              style={achievement.unlocked ? { boxShadow: `0 4px 20px ${achievement.glowColor}` } : undefined}
            >
              {/* Unlocked shine effect */}
              {achievement.unlocked && (
                <div className="absolute inset-0 rounded-xl overflow-hidden">
                  <div className="absolute -top-1 -right-1 w-8 h-8 bg-white/20 rounded-full blur-lg" />
                </div>
              )}

              <div className="relative">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                  achievement.unlocked
                    ? 'bg-white/20'
                    : 'bg-white/5'
                }`}>
                  {achievement.icon}
                </div>

                {/* Title & Description */}
                <h3 className={`text-sm font-semibold mb-1 ${
                  achievement.unlocked ? 'text-white' : 'text-gray-300'
                }`}>
                  {achievement.title}
                </h3>
                <p className={`text-xs leading-relaxed ${
                  achievement.unlocked ? 'text-white/70' : 'text-gray-500'
                }`}>
                  {achievement.description}
                </p>

                {/* Progress bar for locked achievements */}
                {!achievement.unlocked && achievement.progress > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                      <span>{Math.round(achievement.progress * 100)}%</span>
                      <span>{achievement.total} pts</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500/60 to-orange-500/60 rounded-full transition-all duration-700"
                        style={{ width: `${achievement.progress * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Unlocked badge */}
                {achievement.unlocked && (
                  <div className="mt-3 flex items-center gap-1">
                    <CheckCircle size={12} className="text-white/80" />
                    <span className="text-[10px] font-medium text-white/80 uppercase tracking-wide">Unlocked</span>
                  </div>
                )}
              </div>
            </div>
          ))}
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
