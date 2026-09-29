import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Crown, Check, Shield, Diamond, Loader2, ArrowLeft, CreditCard } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../../lib/api';
import StripePaymentForm from '../../components/StripePaymentForm';

interface MembershipTier {
  _id: string;
  tier: 'gold' | 'platinum' | 'black';
  name: string;
  displayName: string;
  description: string;
  price: number;
  entitlements: Record<string, { enabled: boolean; value: any; name?: string; description?: string }>;
  comingSoon: boolean;
  tagLimit: number;
  icon: string;
  color: string;
  gradient: string;
}

const TIER_CONFIG: Record<string, { icon: typeof Crown; gradient: string; popular?: boolean; recommended?: boolean }> = {
  gold: { icon: Crown, gradient: 'from-yellow-400 to-amber-500', popular: true },
  platinum: { icon: Diamond, gradient: 'from-gray-300 to-gray-500', recommended: true },
  black: { icon: Shield, gradient: 'from-gray-800 to-black' },
};

export default function MembershipSubscribe() {
  const navigate = useNavigate();
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<MembershipTier | null>(null);
  const [processing, setProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [membershipId, setMembershipId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchTiers();
  }, []);

  async function fetchTiers() {
    try {
      const res = await api.get(API.customer.membership.tiers);
      setTiers(res.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load membership tiers');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe(tier: MembershipTier) {
    if (tier.comingSoon) return;

    setSelectedTier(tier);
    setProcessing(true);
    setError('');

    try {
      const res = await api.post(API.customer.membership.subscribe, {
        tierId: tier._id,
      });

      const { clientSecret: secret, membership, isDemoMode } = res.data.data;

      // Store membership ID for activation after payment
      setMembershipId(membership._id);

      if (secret) {
        // Real Stripe payment needed
        setClientSecret(secret);
        setProcessing(false);
      } else if (isDemoMode) {
        // Demo/fake mode — membership already activated by server
        setSuccess(true);
        setTimeout(() => navigate('/account/membership'), 2000);
      } else {
        // Stripe is enabled but no client secret returned — payment setup failed
        // Show the server error message if available, otherwise show generic message
        const serverMessage = res.data.data?.message;
        setError(serverMessage || 'Unable to start payment. Please try again or contact support.');
        setProcessing(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start subscription');
      setProcessing(false);
    }
  }

  async function handlePaymentSuccess(paymentIntentId: string) {
    // Retry activation up to 3 times with exponential backoff
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (membershipId) {
          await api.post(API.customer.membership.activate, { membershipId });
        }
        // Success — show success and navigate
        setSuccess(true);
        setProcessing(false);
        setTimeout(() => navigate('/account/membership'), 2000);
        return;
      } catch (err: any) {
        if (attempt < 3) {
          // Wait before retrying (exponential backoff: 1s, 2s)
          await new Promise(r => setTimeout(r, 1000 * attempt));
        } else {
          // Final attempt failed — show error to user
          console.error('Membership activation failed after 3 attempts:', err);
          setError('Payment succeeded but activation failed. Please contact support or try refreshing the page.');
          setProcessing(false);
        }
      }
    }
  }

  function handlePaymentError(error: string) {
    setError(error);
    setProcessing(false);
    setClientSecret(null);
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-96 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check size={32} className="text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to {selectedTier?.displayName}!</h1>
        <p className="text-gray-500">Your membership is being activated. Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/membership" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft size={16} /> Back to Membership Plans
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Choose Your Membership</h1>
        <p className="text-gray-500 mt-1">Select a tier to protect your pet with PawTag membership benefits.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Payment Form */}
      {clientSecret && selectedTier && (
        <div className="mb-8 bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <CreditCard size={20} className="text-gray-400" />
            <div>
              <h3 className="font-semibold text-gray-900">Complete Payment</h3>
              <p className="text-sm text-gray-500">{selectedTier.displayName} — ${selectedTier.price}/year</p>
            </div>
          </div>
          <StripePaymentForm
            clientSecret={clientSecret}
            onPaymentSuccess={handlePaymentSuccess}
            onPaymentError={handlePaymentError}
            disabled={processing}
          />
        </div>
      )}

      {/* Tier Selection */}
      {!clientSecret && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier) => {
            const config = TIER_CONFIG[tier.tier] || TIER_CONFIG.gold;
            const Icon = config.icon;
            const isSelected = selectedTier?._id === tier._id;

            return (
              <div
                key={tier._id}
                className={`relative bg-white rounded-2xl border-2 p-6 transition-all ${
                  isSelected
                    ? 'border-primary-500 shadow-lg'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                } ${tier.comingSoon ? 'opacity-60' : ''}`}
              >
                {config.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full">
                    POPULAR
                  </div>
                )}
                {config.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary-500 text-white text-xs font-bold rounded-full">
                    RECOMMENDED
                  </div>
                )}
                {tier.comingSoon && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gray-500 text-white text-xs font-bold rounded-full">
                    COMING SOON
                  </div>
                )}

                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center mb-4`}>
                  <Icon size={24} className="text-white" />
                </div>

                <h3 className="text-lg font-bold text-gray-900">{tier.displayName}</h3>
                <p className="text-sm text-gray-500 mb-4">{tier.description}</p>

                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-900">${tier.price}</span>
                  <span className="text-gray-500 text-sm">/year</span>
                </div>

                <ul className="space-y-2 mb-6">
                  {Object.entries(tier.entitlements).map(([key, entitlement]) => {
                    if (key === 'points_multiplier' && typeof entitlement.value === 'number' && entitlement.value > 1) {
                      return (
                        <li key={key} className="flex items-center gap-2 text-sm text-gray-700">
                          <Check size={16} className="text-green-500 shrink-0" />
                          {entitlement.value}× Guardian Points
                        </li>
                      );
                    }
                    if (key === 'free_shipping_threshold' && typeof entitlement.value === 'number') {
                      return (
                        <li key={key} className="flex items-center gap-2 text-sm text-gray-700">
                          <Check size={16} className="text-green-500 shrink-0" />
                          Free shipping {entitlement.value === 0 ? 'always' : `over $${entitlement.value}`}
                        </li>
                      );
                    }
                    if (key === 'accessory_discount' && typeof entitlement.value === 'number' && entitlement.value > 0) {
                      return (
                        <li key={key} className="flex items-center gap-2 text-sm text-gray-700">
                          <Check size={16} className="text-green-500 shrink-0" />
                          {entitlement.value}% off accessories
                        </li>
                      );
                    }
                    return null;
                  })}
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check size={16} className="text-green-500 shrink-0" />
                    Cover up to {tier.tagLimit} tags
                  </li>
                </ul>

                {tier.comingSoon ? (
                  <button
                    disabled
                    className="w-full py-3 px-4 bg-gray-200 text-gray-500 rounded-xl font-semibold cursor-not-allowed"
                  >
                    Coming Soon
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubscribe(tier)}
                    disabled={processing}
                    className={`w-full py-3 px-4 rounded-xl font-semibold transition-colors ${
                      isSelected && processing
                        ? 'bg-primary-400 text-white cursor-wait'
                        : 'bg-primary-600 text-white hover:bg-primary-700'
                    }`}
                  >
                    {processing && isSelected ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" /> Processing...
                      </span>
                    ) : (
                      `Join ${tier.displayName}`
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-sm text-gray-400 mt-8">
        All transactions are processed securely through Stripe
      </p>
    </div>
  );
}
