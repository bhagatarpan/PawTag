import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Crown, ArrowRight, TrendingUp, Diamond } from 'lucide-react';
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

interface GuardianData {
  tier: string;
  points: number;
}

export default function GuardianSection() {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const [guardianData, setGuardianData] = useState<GuardianData | null>(null);

  useEffect(() => {
    if (user) {
      api.get(API.customer.guardian.tier)
        .then(res => setGuardianData(res.data.data))
        .catch(() => {});
    }
  }, [user]);

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

        {/* Membership Tiers */}
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
          </div>
        )}

        {/* CTA */}
        <div className="text-center mt-12">
          {user ? (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/account/guardian"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
              >
                View Your Guardian Dashboard <ArrowRight size={18} />
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/guardian"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
              >
                Join Guardian — It's Free <ArrowRight size={18} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
