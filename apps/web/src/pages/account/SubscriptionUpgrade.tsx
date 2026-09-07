import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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

interface UpgradeOption {
  id: string;
  name: string;
  price: number;
  period: 'monthly' | 'annual';
  features: string[];
  isCurrent: boolean;
  isUpgrade: boolean;
}

export default function SubscriptionUpgrade() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscription();
  }, []);

  async function fetchSubscription() {
    try {
      const res = await api.get('/customer/subscriptions');
      const subs = res.data.data;
      if (subs.length > 0) {
        setSubscription(subs[0]);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(planType: 'monthly' | 'annual') {
    if (!subscription) return;

    setUpgrading(true);
    try {
      await api.post(`/customer/subscriptions/${subscription._id}/upgrade`, {
        planType,
      });
      await fetchSubscription();
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
          onClick={() => { setLoading(true); setError(null); fetchSubscription(); }}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  const options: UpgradeOption[] = [
    {
      id: 'guardian',
      name: 'Guardian',
      price: 0.99,
      period: 'monthly',
      features: [
        '1× Guardian Points on all activities',
        '$2.00 monthly PawRewards',
        'Free shipping over $100',
        'Member-only promotions',
        'Monthly progress email',
        'Guardian badge',
        'Community access',
      ],
      isCurrent: subscription?.planType === 'monthly' && subscription?.price === 0.99,
      isUpgrade: false,
    },
    {
      id: 'gold',
      name: 'Gold',
      price: 1.99,
      period: 'monthly',
      features: [
        '2× Guardian Points on all activities',
        '$3.00 monthly PawRewards',
        'Free shipping over $75',
        'Gold-exclusive promotions',
        'Monthly progress email',
        'Gold badge',
        'Community access',
        'Start at Nurture tier (100 points)',
        'Priority support',
      ],
      isCurrent: subscription?.planType === 'monthly' && subscription?.price === 1.99,
      isUpgrade: true,
    },
  ];

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {options.map((option) => (
          <div
            key={option.id}
            className={`bg-white rounded-2xl shadow-sm border-2 p-6 transition-all ${
              option.isCurrent
                ? 'border-primary-500 ring-2 ring-primary-200'
                : 'border-gray-100 hover:border-primary-200 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">{option.name}</h2>
              {option.isCurrent && (
                <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                  Current Plan
                </span>
              )}
              {option.isUpgrade && !option.isCurrent && (
                <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                  Recommended
                </span>
              )}
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900">${option.price.toFixed(2)}</span>
              <span className="text-gray-500">/{option.period}</span>
            </div>

            <ul className="space-y-3 mb-6">
              {option.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <span className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center mr-3 mt-0.5">
                    ✓
                  </span>
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            {option.isCurrent ? (
              <button
                disabled
                className="w-full py-3 px-4 bg-gray-100 text-gray-500 rounded-xl font-semibold cursor-not-allowed"
              >
                Current Plan
              </button>
            ) : option.isUpgrade ? (
              <button
                onClick={() => handleUpgrade(option.period)}
                disabled={upgrading}
                className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50"
              >
                {upgrading ? 'Upgrading...' : 'Upgrade to Gold'}
              </button>
            ) : (
              <button
                onClick={() => handleUpgrade(option.period)}
                disabled={upgrading}
                className="w-full py-3 px-4 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-all disabled:opacity-50"
              >
                {upgrading ? 'Switching...' : 'Switch to Guardian'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900">What's the difference between Guardian and Gold?</h3>
            <p className="text-gray-600 text-sm mt-1">
              Gold members earn 2× Guardian Points on all activities, get higher monthly PawRewards ($3 vs $2),
              and start at Nurture tier (100 points) instead of Care tier.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Can I switch between plans?</h3>
            <p className="text-gray-600 text-sm mt-1">
              Yes, you can upgrade or downgrade at any time. Changes take effect at your next billing cycle.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">What happens to my points if I downgrade?</h3>
            <p className="text-gray-600 text-sm mt-1">
              You keep all your earned points, but you'll earn at the standard rate (1× instead of 2×) after downgrading.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
