import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Check, Star, Truck, Headphones, Zap, Shield, Gift, ArrowRight } from 'lucide-react';
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

interface GuardianTierData {
  currentTier: TierName;
  points: number;
  pointsToNextTier: number | null;
  nextTier: TierName | null;
  benefits: TierBenefits;
}

const TIER_CONFIG: Record<TierName, { gradient: string; icon: typeof Crown }> = {
  CARE: { gradient: 'from-emerald-500 to-teal-600', icon: Shield },
  NURTURE: { gradient: 'from-teal-500 to-cyan-600', icon: Star },
  PROTECTOR: { gradient: 'from-purple-500 to-indigo-600', icon: Zap },
  SAFEGUARD: { gradient: 'from-amber-500 to-orange-600', icon: Crown },
};

export default function GoldBenefits() {
  const [tierData, setTierData] = useState<GuardianTierData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBenefits();
  }, []);

  async function fetchBenefits() {
    try {
      const res = await api.get(API.customer.guardian.points);
      setTierData(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load benefits');
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
          <h2 className="text-lg font-semibold text-red-800">Error Loading Benefits</h2>
          <p className="text-red-600 mt-2">{error}</p>
          <button
            onClick={fetchBenefits}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!tierData) return null;

  const { benefits } = tierData;
  const tierConfig = TIER_CONFIG[tierData.currentTier];
  const TierIcon = tierConfig.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{benefits.displayName}</h1>
          <p className="text-gray-500">Your Guardian tier benefits and rewards</p>
        </div>
        <Link
          to="/account/guardian"
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Back to Guardian
        </Link>
      </div>

      {/* Tier Card */}
      <div className={`bg-gradient-to-br ${tierConfig.gradient} rounded-2xl p-6 text-white shadow-lg`}>
        <div className="flex items-center gap-3 mb-4">
          <TierIcon className="h-8 w-8" />
          <h2 className="text-2xl font-bold">{benefits.displayName}</h2>
        </div>
        <p className="text-white/80 mb-4">
          {tierData.pointsToNextTier !== null
            ? `${tierData.pointsToNextTier} points to ${tierData.nextTier}`
            : 'Maximum tier reached!'}
        </p>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold">{tierData.points}</p>
            <p className="text-white/70 text-sm">Guardian Points</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">{benefits.pointsMultiplier}×</p>
            <p className="text-white/70 text-sm">Points Multiplier</p>
          </div>
        </div>
      </div>

      {/* Benefits Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly PawRewards */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Gift className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Monthly PawRewards</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Receive ${benefits.pawRewardsMonthly.toFixed(2)} in PawRewards every month to spend on products.
          </p>
          <div className="flex items-center gap-2 text-green-600">
            <Check className="h-5 w-5" />
            <span className="font-medium">${benefits.pawRewardsMonthly.toFixed(2)} per month</span>
          </div>
        </div>

        {/* Free Shipping */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Truck className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Free Shipping</h3>
          </div>
          <p className="text-gray-600 mb-4">
            {benefits.freeShippingThreshold === 0
              ? 'Free shipping on all orders, no minimum required.'
              : `Free shipping on orders over $${benefits.freeShippingThreshold}.`}
          </p>
          <div className="flex items-center gap-2 text-blue-600">
            <Check className="h-5 w-5" />
            <span className="font-medium">
              {benefits.freeShippingThreshold === 0 ? 'All orders' : `Orders over $${benefits.freeShippingThreshold}`}
            </span>
          </div>
        </div>

        {/* Priority Support */}
        {benefits.prioritySupport && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Headphones className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Priority Support</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Get priority customer support with faster response times and dedicated assistance.
            </p>
            <div className="flex items-center gap-2 text-purple-600">
              <Check className="h-5 w-5" />
              <span className="font-medium">Priority response times</span>
            </div>
          </div>
        )}

        {/* Early Access */}
        {benefits.earlyAccess && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Zap className="h-6 w-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Early Access</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Be the first to access new products and features before they're released to the public.
            </p>
            <div className="flex items-center gap-2 text-amber-600">
              <Check className="h-5 w-5" />
              <span className="font-medium">Early access to new products</span>
            </div>
          </div>
        )}

        {/* Exclusive Promotions */}
        {benefits.exclusivePromotions && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-pink-100 rounded-lg">
                <Star className="h-6 w-6 text-pink-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Exclusive Promotions</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Access exclusive deals and special offers available only to Guardian members.
            </p>
            <div className="flex items-center gap-2 text-pink-600">
              <Check className="h-5 w-5" />
              <span className="font-medium">Member-only promotions</span>
            </div>
          </div>
        )}

        {/* Points Multiplier */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-teal-100 rounded-lg">
              <Shield className="h-6 w-6 text-teal-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Points Multiplier</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Earn {benefits.pointsMultiplier}× points on all purchases, reviews, and referrals.
          </p>
          <div className="flex items-center gap-2 text-teal-600">
            <Check className="h-5 w-5" />
            <span className="font-medium">{benefits.pointsMultiplier}× points on all activities</span>
          </div>
        </div>
      </div>

      {/* Upgrade CTA */}
      {tierData.nextTier && (
        <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Ready to level up?</h3>
              <p className="text-gray-600 mt-1">
                Upgrade to {tierData.nextTier} to unlock even more benefits
              </p>
            </div>
            <Link
              to="/account/upgrade"
              className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors flex items-center gap-2"
            >
              Upgrade Plan <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Max Tier Message */}
      {!tierData.nextTier && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <Crown className="h-6 w-6 text-green-600" />
            <div>
              <h3 className="text-lg font-semibold text-green-800">Maximum Tier Reached!</h3>
              <p className="text-green-600 mt-1">
                You've reached the highest Guardian tier. Enjoy all premium benefits!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
