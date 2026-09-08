import { Link } from 'react-router-dom';
import { Shield, Star, Zap, Crown, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const tiers = [
  {
    name: 'Care',
    icon: Shield,
    points: '1×',
    rewards: '$2/mo',
    shipping: 'Over $100',
    color: 'bg-emerald-100 text-emerald-700',
  },
  {
    name: 'Nurture',
    icon: Star,
    points: '1×',
    rewards: '$3/mo',
    shipping: 'Over $75',
    color: 'bg-teal-100 text-teal-700',
  },
  {
    name: 'Protector',
    icon: Zap,
    points: '1×',
    rewards: '$5/mo',
    shipping: 'Over $50',
    color: 'bg-purple-100 text-purple-700',
  },
  {
    name: 'Safeguard',
    icon: Crown,
    points: '1×',
    rewards: '$8/mo',
    shipping: 'Free',
    color: 'bg-amber-100 text-amber-700',
  },
];

export default function GuardianSection() {
  const { user } = useAuth();

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold">1</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Make a Purchase</h3>
              <p className="text-sm text-gray-600">Earn Guardian Points on every order you place</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold">2</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Earn & Redeem</h3>
              <p className="text-sm text-gray-600">Convert points to PawRewards and spend on products</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold">3</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Level Up</h3>
              <p className="text-sm text-gray-600">Unlock higher tiers with better benefits</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          {user ? (
            <Link
              to="/account/guardian"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
            >
              View Your Guardian Dashboard <ArrowRight size={18} />
            </Link>
          ) : (
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
            >
              Start Earning Points <ArrowRight size={18} />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
