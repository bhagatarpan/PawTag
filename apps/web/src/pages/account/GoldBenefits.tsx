import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Check, Star, Truck, Headphones, Zap, Shield, Gift, ArrowRight } from 'lucide-react';
import api from '../../lib/api';

interface GoldBenefitsData {
  isGoldMember: boolean;
  benefits: string[];
  nextBillingDate?: string;
  monthlyPrice: number;
}

export default function GoldBenefits() {
  const [benefitsData, setBenefitsData] = useState<GoldBenefitsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBenefits();
  }, []);

  async function fetchBenefits() {
    try {
      const res = await api.get('/customer/guardian/tier');
      const tierData = res.data.data;
      
      // Mock Gold benefits data (in real implementation, this would come from API)
      setBenefitsData({
        isGoldMember: tierData.currentTier === 'GOLD',
        benefits: [
          'Free shipping on orders over $50',
          'Priority customer support',
          'Early access to new products',
          'Double points on all purchases',
          'Nurture tier starting point (100 bonus points)',
        ],
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        monthlyPrice: 1.99,
      });
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gold Membership</h1>
          <p className="text-gray-500">Premium benefits for our most loyal guardians</p>
        </div>
        <Link
          to="/account/guardian"
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Back to Guardian
        </Link>
      </div>

      {/* Gold Membership Card */}
      <div className="bg-gradient-to-br from-amber-500 to-yellow-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <Crown className="h-8 w-8" />
          <h2 className="text-2xl font-bold">Gold Membership</h2>
        </div>
        <p className="text-amber-100 mb-4">
          Unlock premium benefits and earn points faster with Gold membership.
        </p>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold">${benefitsData?.monthlyPrice.toFixed(2)}</p>
            <p className="text-amber-200 text-sm">per month</p>
          </div>
          {benefitsData?.isGoldMember && benefitsData.nextBillingDate && (
            <div className="text-center">
              <p className="text-lg font-semibold">Next Billing</p>
              <p className="text-amber-200 text-sm">
                {new Date(benefitsData.nextBillingDate).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Benefits Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Free Shipping */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Truck className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Free Shipping</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Get free shipping on all orders over $50. No minimum purchase required for Gold members.
          </p>
          <div className="flex items-center gap-2 text-green-600">
            <Check className="h-5 w-5" />
            <span className="font-medium">Available on all orders over $50</span>
          </div>
        </div>

        {/* Priority Support */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Headphones className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Priority Support</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Get priority customer support with faster response times and dedicated assistance.
          </p>
          <div className="flex items-center gap-2 text-blue-600">
            <Check className="h-5 w-5" />
            <span className="font-medium">24-hour response guarantee</span>
          </div>
        </div>

        {/* Early Access */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Zap className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Early Access</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Be the first to access new products and features before they're released to the public.
          </p>
          <div className="flex items-center gap-2 text-purple-600">
            <Check className="h-5 w-5" />
            <span className="font-medium">48-hour early access window</span>
          </div>
        </div>

        {/* Double Points */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Star className="h-6 w-6 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Double Points</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Earn 2× points on all purchases, reviews, and referrals. Accelerate your tier progression.
          </p>
          <div className="flex items-center gap-2 text-amber-600">
            <Check className="h-5 w-5" />
            <span className="font-medium">2× points on all activities</span>
          </div>
        </div>

        {/* Nurture Tier Starting Point */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-teal-100 rounded-lg">
              <Shield className="h-6 w-6 text-teal-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Nurture Tier Start</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Start at the Nurture tier with 100 bonus points credited to your account immediately.
          </p>
          <div className="flex items-center gap-2 text-teal-600">
            <Check className="h-5 w-5" />
            <span className="font-medium">100 bonus points on signup</span>
          </div>
        </div>

        {/* Exclusive Rewards */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-pink-100 rounded-lg">
              <Gift className="h-6 w-6 text-pink-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Exclusive Rewards</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Access exclusive PawRewards and special offers available only to Gold members.
          </p>
          <div className="flex items-center gap-2 text-pink-600">
            <Check className="h-5 w-5" />
            <span className="font-medium">$40 maximum PawRewards balance</span>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      {!benefitsData?.isGoldMember && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Ready to go Gold?</h3>
              <p className="text-gray-600 mt-1">
                Unlock all premium benefits for just $1.99/month
              </p>
            </div>
            <Link
              to="/account/subscriptions"
              className="px-6 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-colors flex items-center gap-2"
            >
              Upgrade to Gold <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Current Member Info */}
      {benefitsData?.isGoldMember && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <Crown className="h-6 w-6 text-green-600" />
            <div>
              <h3 className="text-lg font-semibold text-green-800">You're a Gold Member!</h3>
              <p className="text-green-600 mt-1">
                Enjoying all premium benefits. Thank you for being a valued member.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
