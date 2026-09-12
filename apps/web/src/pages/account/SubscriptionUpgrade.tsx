import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../../lib/api';

interface SubscriptionData {
  _id: string;
  planType: 'annual' | 'monthly' | 'free';
  planName: string;
  status: string;
  price: number;
  currentPeriodEnd: string;
  autoRenew: boolean;
}

interface SubscriptionPlan {
  _id: string;
  name: string;
  sku?: string;
  price: number;
  subscriptionConfig: {
    type: 'annual' | 'monthly';
    monthlyPrice?: number;
    features: string[];
  };
}

interface TierBenefits {
  pointsMultiplier: number;
  pawRewardsMonthly: number;
  freeShippingThreshold: number;
  earlyAccess: boolean;
  prioritySupport: boolean;
  exclusivePromotions: boolean;
}

interface GuardianTierData {
  currentTier: string;
  benefits: TierBenefits;
  nextTier: string | null;
  pointsToNextTier: number | null;
}

export default function SubscriptionUpgrade() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [tierData, setTierData] = useState<GuardianTierData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [subsRes, plansRes, tierRes] = await Promise.all([
        api.get(API.customer.subscriptions.list).catch(() => ({ data: { data: [] } })),
        api.get(API.products.list).catch(() => ({ data: { data: [] } })),
        api.get(API.customer.guardian.points).catch(() => ({ data: { data: null } })),
      ]);

      const subs = subsRes.data.data;
      if (subs.length > 0) {
        setSubscription(subs[0]);
      }

      const allProducts = plansRes.data.data?.items || [];
      const subscriptionPlans = allProducts.filter((p: any) => p.isSubscription === true);
      setPlans(subscriptionPlans);
      setTierData(tierRes.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(planId: string, isGold: boolean) {
    setUpgrading(true);
    try {
      if (isGold) {
        // Gold membership — call dedicated Gold subscribe endpoint
        await api.post(API.customer.subscriptions.goldSubscribe);
      } else if (subscription) {
        // Existing subscriber — change plan (annual ↔ monthly)
        await api.post(API.customer.subscriptions.changePlan(subscription._id), {
          planType: 'monthly', // Default to monthly for plan changes
        });
      }
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upgrade subscription');
    } finally {
      setUpgrading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-96 bg-gray-200 rounded-2xl"></div>
            <div className="h-96 bg-gray-200 rounded-2xl"></div>
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
          onClick={() => { setLoading(true); setError(null); fetchData(); }}
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
      <div>
        <Link to="/account/subscriptions" className="text-primary-600 hover:text-primary-700 text-sm mb-2 block">
          ← Back to Subscriptions
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Upgrade Your Membership</h1>
        <p className="text-gray-500">Choose the plan that's right for you</p>
      </div>

      {/* Plans */}
      {plans.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
          <p className="text-gray-500">No subscription plans available at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {plans.map((plan) => {
            const price = plan.subscriptionConfig?.monthlyPrice || plan.price;
            const isCurrent = subscription?.planName === plan.name;
            const features = plan.subscriptionConfig?.features || [];

            return (
              <div
                key={plan._id}
                className={`bg-white rounded-2xl shadow-sm border-2 p-6 transition-all ${
                  isCurrent
                    ? 'border-primary-500 ring-2 ring-primary-200'
                    : 'border-gray-100 hover:border-primary-200 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">{plan.name}</h2>
                  {isCurrent && (
                    <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                      Current Plan
                    </span>
                  )}
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">${price.toFixed(2)}</span>
                  <span className="text-gray-500">/{plan.subscriptionConfig?.type || 'monthly'}</span>
                </div>

                <ul className="space-y-3 mb-6">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <span className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center mr-3 mt-0.5">
                        <Check size={12} />
                      </span>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button
                    disabled
                    className="w-full py-3 px-4 bg-gray-100 text-gray-500 rounded-xl font-semibold cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan._id, plan.name.toLowerCase().includes('gold') || plan.sku === 'PT-GOLD-001')}
                    disabled={upgrading}
                    className="w-full py-3 px-4 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {upgrading ? 'Upgrading...' : 'Select Plan'}
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Current Tier Info */}
      {tierData && (
        <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Your Guardian Status</h2>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm text-gray-600">Current Tier</p>
              <p className="text-lg font-bold text-gray-900">{tierData.currentTier}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Points Multiplier</p>
              <p className="text-lg font-bold text-gray-900">{tierData.benefits.pointsMultiplier}×</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Monthly PawRewards</p>
              <p className="text-lg font-bold text-gray-900">${tierData.benefits.pawRewardsMonthly.toFixed(2)}</p>
            </div>
            {tierData.nextTier && (
              <div>
                <p className="text-sm text-gray-600">Next Tier</p>
                <p className="text-lg font-bold text-gray-900">{tierData.nextTier}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FAQ */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900">How do subscription plans work?</h3>
            <p className="text-gray-600 text-sm mt-1">
              Each plan includes different benefits like points multipliers, monthly PawRewards, and free shipping thresholds.
              Choose the plan that best fits your needs.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Can I switch between plans?</h3>
            <p className="text-gray-600 text-sm mt-1">
              Yes, you can upgrade or downgrade at any time. Changes take effect at your next billing cycle.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">What happens to my points if I change plans?</h3>
            <p className="text-gray-600 text-sm mt-1">
              You keep all your earned points. Your points multiplier will change based on the new plan's benefits.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
