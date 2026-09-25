import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Check, ArrowRight, Shield, Diamond } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import SeoHead from '../components/SeoHead';

interface MembershipTier {
  _id: string;
  tier: 'gold' | 'platinum' | 'black';
  name: string;
  displayName: string;
  description: string;
  price: number;
  benefits: {
    medicalAlert: boolean;
    petHealthRecords: boolean;
    emailNotifications: boolean;
    freeShippingThreshold: number;
    pointsMultiplier: number;
    inAppNotifications: boolean;
    criticalEmergencyContact: boolean;
    emergencyPersonEmail: boolean;
    emergencyPersonInApp: boolean;
    accessoryDiscount: number;
    petRecovery: boolean;
    blackFridayDeal: boolean;
  };
  icon: string;
  color: string;
  gradient: string;
}

const TIER_CONFIG: Record<string, { icon: typeof Crown; gradient: string; popular?: boolean; recommended?: boolean; comingSoon?: boolean }> = {
  gold: { icon: Crown, gradient: 'from-yellow-400 to-amber-500', popular: true },
  platinum: { icon: Diamond, gradient: 'from-gray-300 to-gray-500', recommended: true },
  black: { icon: Shield, gradient: 'from-gray-800 to-black', comingSoon: true },
};

const BENEFIT_LABELS: Record<string, string> = {
  medicalAlert: 'Medical Alert to Finder',
  petHealthRecords: 'Pet Health Records',
  emailNotifications: 'Email Notifications',
  inAppNotifications: 'In-App Notifications',
  criticalEmergencyContact: 'Critical Emergency Contact',
  emergencyPersonEmail: 'Emergency Person Email',
  emergencyPersonInApp: 'Emergency Person In-App',
  petRecovery: 'Pet Recovery via PawTag',
  blackFridayDeal: 'Exclusive Black Friday Deal',
};

export default function MembershipLanding() {
  const { user } = useAuth();
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTiers();
  }, []);

  async function fetchTiers() {
    try {
      const res = await api.get(API.public.membership.tiers);
      setTiers(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch membership tiers:', err);
    } finally {
      setLoading(false);
    }
  }

  const ctaTo = user ? '/account/membership/subscribe' : '/register';

  return (
    <div className="min-h-screen bg-gray-50">
      <SeoHead
        title="PawTag Membership"
        description="Protect your pet with PawTag membership. Gold, Platinum, and Black tiers with premium benefits."
        keywords={['membership', 'pet protection', 'gold', 'platinum', 'black', 'PawTag']}
      />

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-teal-600 to-teal-700 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Crown className="h-16 w-16 text-teal-100 mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Protect Your Pet. Join the Pack.
          </h1>
          <p className="text-teal-100 text-xl mb-8">
            Get peace of mind with PawTag membership. Emergency contacts, health records, and premium benefits for your furry family.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to={ctaTo}
              className="inline-flex items-center justify-center gap-2 bg-white text-teal-600 px-8 py-3 rounded-xl font-semibold hover:bg-teal-50 transition-colors"
            >
              Get Started <ArrowRight size={18} />
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center gap-2 border border-white/30 text-white px-8 py-3 rounded-xl font-semibold hover:bg-white/10 transition-colors"
            >
              View Pricing
            </a>
          </div>
        </div>
      </section>

      {/* Tier Cards */}
      <section id="pricing" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Choose Your Membership</h2>
            <p className="text-gray-500 text-lg">Select the plan that best fits your needs</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {tiers.map((tier) => {
                const config = TIER_CONFIG[tier.tier] || TIER_CONFIG.gold;
                const Icon = config.icon;

                return (
                  <div
                    key={tier._id}
                    className={`relative rounded-2xl shadow-xl overflow-hidden ${config.comingSoon ? 'opacity-75' : ''}`}
                  >
                    {/* Card Header */}
                    <div className={`bg-gradient-to-br ${config.gradient} p-8 text-white`}>
                      {config.recommended && (
                        <div className="absolute top-4 right-4 bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-bold">
                          RECOMMENDED
                        </div>
                      )}
                      {config.popular && (
                        <div className="absolute top-4 right-4 bg-white/20 text-white px-3 py-1 rounded-full text-xs font-bold">
                          MOST POPULAR
                        </div>
                      )}
                      {config.comingSoon && (
                        <div className="absolute top-4 right-4 bg-gray-700 text-white px-3 py-1 rounded-full text-xs font-bold">
                          COMING SOON
                        </div>
                      )}
                      <Icon className="h-12 w-12 mb-4" />
                      <h3 className="text-2xl font-bold mb-2">{tier.displayName}</h3>
                      <p className="text-white/80 text-sm mb-4">{tier.description}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold">${tier.price}</span>
                        <span className="text-white/80">/year</span>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="bg-white p-8">
                      <ul className="space-y-3 mb-8">
                        {Object.entries(tier.benefits).map(([key, value]) => {
                          if (key === 'freeShippingThreshold' || key === 'pointsMultiplier' || key === 'accessoryDiscount') {
                            return null;
                          }
                          if (typeof value === 'boolean' && value) {
                            return (
                              <li key={key} className="flex items-center gap-3">
                                <Check className="h-5 w-5 text-green-500 shrink-0" />
                                <span className="text-sm text-gray-700">{BENEFIT_LABELS[key] || key}</span>
                              </li>
                            );
                          }
                          return null;
                        })}

                        {/* Points Multiplier */}
                        <li className="flex items-center gap-3">
                          <Check className="h-5 w-5 text-green-500 shrink-0" />
                          <span className="text-sm text-gray-700">{tier.benefits.pointsMultiplier}x Guardian Points</span>
                        </li>

                        {/* Free Shipping */}
                        {tier.benefits.freeShippingThreshold === 0 ? (
                          <li className="flex items-center gap-3">
                            <Check className="h-5 w-5 text-green-500 shrink-0" />
                            <span className="text-sm text-gray-700">LIFETIME Free Shipping</span>
                          </li>
                        ) : tier.benefits.freeShippingThreshold > 0 ? (
                          <li className="flex items-center gap-3">
                            <Check className="h-5 w-5 text-green-500 shrink-0" />
                            <span className="text-sm text-gray-700">Free Shipping over ${tier.benefits.freeShippingThreshold}</span>
                          </li>
                        ) : null}

                        {/* Accessory Discount */}
                        {tier.benefits.accessoryDiscount > 0 && (
                          <li className="flex items-center gap-3">
                            <Check className="h-5 w-5 text-green-500 shrink-0" />
                            <span className="text-sm text-gray-700">{tier.benefits.accessoryDiscount}% OFF All Accessories</span>
                          </li>
                        )}
                      </ul>

                      {config.comingSoon ? (
                        <button
                          disabled
                          className="w-full py-3 px-4 bg-gray-300 text-gray-500 rounded-xl font-semibold cursor-not-allowed"
                        >
                          Coming Soon
                        </button>
                      ) : (
                        <Link
                          to={ctaTo}
                          className="block w-full py-3 px-4 bg-primary-600 text-white rounded-xl font-semibold text-center hover:bg-primary-700 transition-colors"
                        >
                          Join {tier.displayName}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-12 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Secure Payments</h3>
              <p className="text-sm text-gray-500">All transactions are processed securely through Stripe</p>
            </div>
            <div>
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Cancel Anytime</h3>
              <p className="text-sm text-gray-500">No lock-in contracts. Cancel your membership anytime</p>
            </div>
            <div>
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Crown className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Premium Benefits</h3>
              <p className="text-sm text-gray-500">Emergency contacts, health records, and exclusive perks</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
