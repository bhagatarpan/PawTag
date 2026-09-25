import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Star, Zap, Crown, ArrowRight, TrendingUp, Diamond } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../hooks/useCms';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';

const membershipTiers = [
  {
    tier: 'gold',
    name: 'Gold',
    price: 89,
    icon: Crown,
    gradient: 'from-yellow-400 to-amber-500',
    badge: 'Most Popular',
    benefits: ['1× Points', 'Free shipping $100+'],
  },
  {
    tier: 'platinum',
    name: 'Platinum',
    price: 99,
    icon: Diamond,
    gradient: 'from-gray-300 to-gray-500',
    badge: 'Best Value',
    benefits: ['2× Points', 'Emergency Contacts'],
  },
  {
    tier: 'black',
    name: 'Black',
    price: 199,
    icon: Shield,
    gradient: 'from-gray-800 to-black',
    badge: 'Elite',
    benefits: ['3× Points', 'Pet Recovery'],
    comingSoon: true,
  },
];

const tiers = [
  {
    name: 'Care',
    icon: Shield,
    points: '1×',
    rewards: '$2/mo',
    shipping: 'Over $100',
    color: 'bg-emerald-100 text-emerald-700',
    minPoints: 0,
  },
  {
    name: 'Nurture',
    icon: Star,
    points: '1×',
    rewards: '$3/mo',
    shipping: 'Over $75',
    color: 'bg-teal-100 text-teal-700',
    minPoints: 100,
  },
  {
    name: 'Protector',
    icon: Zap,
    points: '1×',
    rewards: '$5/mo',
    shipping: 'Over $50',
    color: 'bg-purple-100 text-purple-700',
    minPoints: 200,
  },
  {
    name: 'Safeguard',
    icon: Crown,
    points: '2×',
    rewards: '$8/mo',
    shipping: 'Free',
    color: 'bg-amber-100 text-amber-700',
    minPoints: 300,
  },
];

interface GuardianData {
  tier: string;
  points: number;
  isGoldMember: boolean;
}

export default function GuardianSection() {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const goldPrice = settings?.['guardian.goldPrice'] || '3.99';
  const [guardianData, setGuardianData] = useState<GuardianData | null>(null);

  useEffect(() => {
    if (user) {
      api.get(API.customer.guardian.tier)
        .then(res => setGuardianData(res.data.data))
        .catch(() => {});
    }
  }, [user]);

  const currentTierIndex = guardianData ? tiers.findIndex(t => t.name === guardianData.tier) : -1;
  const nextTier = currentTierIndex >= 0 && currentTierIndex < tiers.length - 1 ? tiers[currentTierIndex + 1] : null;
  const progressToNext = nextTier && guardianData ? 
    Math.min(100, ((guardianData.points - tiers[currentTierIndex].minPoints) / (nextTier.minPoints - tiers[currentTierIndex].minPoints)) * 100) : 0;

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold uppercase tracking-wider mb-4">
            Guardian Program
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Earn rewards for being a great pet parent
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Join the Guardian loyalty program and earn points on every purchase. Redeem for PawRewards, unlock exclusive benefits, and level up through tiers.
          </p>
        </div>

        {/* Tier Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {tiers.map((tier) => {
            const Icon = tier.icon;
            return (
              <div
                key={tier.name}
                className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:border-primary-200 transition-all"
              >
                <div className={`w-12 h-12 ${tier.color} rounded-xl flex items-center justify-center mb-4`}>
                  <Icon size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{tier.name}</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                    {tier.points} points on all purchases
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                    {tier.rewards} PawRewards
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                    Free shipping {tier.shipping === 'Free' ? '' : `over ${tier.shipping}`}
                  </li>
                </ul>
              </div>
            );
          })}
        </div>

        {/* How It Works */}
        <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-2xl p-8 md:p-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Protect Your Pet. Join the Pack.</h2>
            <p className="text-gray-600">Get peace of mind with PawTag membership. Emergency contacts, health records, and premium benefits.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {membershipTiers.map((tier) => {
              const Icon = tier.icon;
              return (
                <div key={tier.tier} className="bg-white rounded-xl shadow-md overflow-hidden">
                  <div className={`bg-gradient-to-br ${tier.gradient} p-4 text-white`}>
                    <div className="flex items-center justify-between">
                      <Icon className="h-6 w-6" />
                      <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">{tier.badge}</span>
                    </div>
                    <h3 className="text-xl font-bold mt-2">{tier.name}</h3>
                    <div className="text-2xl font-bold mt-1">${tier.price}<span className="text-sm font-normal">/yr</span></div>
                  </div>
                  <div className="p-4">
                    {tier.benefits.map((benefit, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <span className="text-green-500">✓</span> {benefit}
                      </div>
                    ))}
                    {tier.comingSoon ? (
                      <div className="mt-3 text-xs text-gray-400 text-center font-medium">COMING SOON</div>
                    ) : (
                      <Link to="/membership" className="block mt-3 text-center text-sm font-semibold text-primary-600 hover:text-primary-700">
                        Learn More →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Points Visualizer for logged-in users */}
        {user && guardianData && (
          <div className="mt-12 bg-white rounded-2xl border border-gray-100 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Your Guardian Progress</h3>
                <p className="text-sm text-gray-500">{guardianData.points} points · {guardianData.tier} Tier</p>
              </div>
            </div>
            
            {nextTier ? (
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">{guardianData.tier}</span>
                  <span className="text-primary-600 font-medium">{nextTier.name}</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-500"
                    style={{ width: `${progressToNext}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {nextTier.minPoints - guardianData.points} points to {nextTier.name}
                </p>
              </div>
            ) : (
              <p className="text-sm text-primary-600 font-medium">
                You've reached the highest tier! Enjoy all premium benefits.
              </p>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="text-center mt-12">
          <Link
            to="/membership"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all"
          >
            <Crown size={20} /> View All Membership Plans <ArrowRight size={20} />
          </Link>
          <p className="text-sm text-gray-500 mt-4">Gold from $89/yr · Platinum from $99/yr · Black from $199/yr</p>
        </div>
      </div>
    </section>
  );
}
