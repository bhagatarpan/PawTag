import { Link } from 'react-router-dom';
import { Crown, Check, ArrowRight, Shield, Star, Zap, Truck, Clock, Gift, Headphones, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SeoHead from '../components/SeoHead';
import PageHero from '../components/PageHero';

const goldBenefits = [
  { icon: <Sparkles className="h-6 w-6" />, title: '2× Points', description: 'Earn double points on every purchase' },
  { icon: <Star className="h-6 w-6" />, title: 'Nurture Starting Tier', description: 'Skip Care and start with better benefits' },
  { icon: <Truck className="h-6 w-6" />, title: 'Free Shipping Over $50', description: 'Lower threshold than Guardian tiers' },
  { icon: <Clock className="h-6 w-6" />, title: 'Early Access', description: 'Get new products before anyone else' },
  { icon: <Headphones className="h-6 w-6" />, title: 'Priority Support', description: 'Faster response times from our team' },
  { icon: <Gift className="h-6 w-6" />, title: '$3/mo PawRewards', description: 'Monthly store credit to spend on products' },
];

const comparison = [
  { feature: 'Points on purchases', guardian: '1×', gold: '2×' },
  { feature: 'Starting tier', guardian: 'Care', gold: 'Nurture' },
  { feature: 'Monthly PawRewards', guardian: '$2/mo', gold: '$3/mo' },
  { feature: 'Free shipping threshold', guardian: '$100', gold: '$50' },
  { feature: 'Early access to products', guardian: '—', gold: '✓' },
  { feature: 'Priority support', guardian: '—', gold: '✓' },
  { feature: 'Exclusive promotions', guardian: '✓', gold: '✓' },
  { feature: 'Guardian badge', guardian: '✓', gold: '✓' },
];

const scenarios = [
  { monthly: 50, guardianPoints: 50, goldPoints: 100, guardianRewards: 2, goldRewards: 3 },
  { monthly: 100, guardianPoints: 100, goldPoints: 200, guardianRewards: 2, goldRewards: 3 },
  { monthly: 200, guardianPoints: 200, goldPoints: 400, guardianRewards: 2, goldRewards: 3 },
];

export default function GoldLanding() {
  const { user } = useAuth();
  // Logged-in users go to upgrade page; guests go to register
  const goldCtaTo = user ? '/account/upgrade' : '/register';

  return (
    <div className="min-h-screen bg-gray-50">
      <SeoHead
        title="Gold Membership"
        description="Upgrade to PawTag Gold and earn 2× points on every purchase. Priority support, early access, and exclusive benefits."
        keywords={['Gold', 'membership', 'premium', '2x points', 'early access', 'PawTag']}
      />

      {/* Hero */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Crown className="h-16 w-16 text-white mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Go Gold. Get 2× the Rewards.</h1>
          <p className="text-amber-100 text-xl mb-8">
            Earn double points, unlock exclusive benefits, and start at a higher tier.
            Just $1.99/month — less than a coffee.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to={goldCtaTo}
              className="inline-flex items-center justify-center gap-2 bg-white text-amber-600 px-8 py-3 rounded-xl font-semibold hover:bg-amber-50 transition-colors"
            >
              Upgrade to Gold <ArrowRight size={18} />
            </Link>
            <Link
              to="/guardian"
              className="inline-flex items-center justify-center gap-2 border border-white/30 text-white px-8 py-3 rounded-xl font-semibold hover:bg-white/10 transition-colors"
            >
              Compare with Guardian
            </Link>
          </div>
        </div>
      </div>

      {/* Benefits Grid */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Gold Benefits</h2>
            <p className="text-gray-500 text-lg">Everything you get with Gold membership</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {goldBenefits.map((benefit, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                  {benefit.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{benefit.title}</h3>
                  <p className="text-sm text-gray-500">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Guardian vs Gold</h2>
            <p className="text-gray-500 text-lg">See the difference Gold makes</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Feature</th>
                  <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">Guardian</th>
                  <th className="text-center px-6 py-4 text-sm font-medium text-amber-600">Gold</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="px-6 py-4 text-sm text-gray-900">{row.feature}</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-600">
                      {row.guardian === '✓' ? <Check size={16} className="text-primary-500 mx-auto" /> : row.guardian}
                    </td>
                    <td className="px-6 py-4 text-sm text-center text-amber-600 font-medium">
                      {row.gold === '✓' ? <Check size={16} className="text-amber-500 mx-auto" /> : row.gold}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ROI Calculator */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">See Your Potential Earnings</h2>
            <p className="text-gray-500 text-lg">Based on monthly spending</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {scenarios.map((s) => (
              <div key={s.monthly} className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-6 text-center">
                <p className="text-sm text-amber-700 font-medium mb-2">Spend ${s.monthly}/month</p>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Guardian</p>
                    <p className="text-xl font-bold text-gray-900">{s.guardianPoints} pts/mo</p>
                    <p className="text-xs text-gray-400">${s.guardianRewards}/mo PawRewards</p>
                  </div>
                  <div className="border-t border-amber-200 pt-4">
                    <p className="text-xs text-amber-700 mb-1">Gold (2×)</p>
                    <p className="text-xl font-bold text-amber-600">{s.goldPoints} pts/mo</p>
                    <p className="text-xs text-amber-500">${s.goldRewards}/mo PawRewards</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-400 mt-6">
            Gold costs $1.99/month. Spend $50+/month and Gold pays for itself.
          </p>
        </div>
      </section>

      {/* Pricing Psychology */}
      <section className="py-16 bg-gradient-to-r from-amber-500 to-orange-500">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Less Than a Coffee a Month</h2>
          <p className="text-amber-100 text-xl mb-6">
            Gold is just <strong>$1.99/month</strong> — that's $23.88/year.
            Spend $50/month and you'll earn $36 in PawRewards annually.
          </p>
          <p className="text-amber-100 text-lg mb-8">
            <strong>That's a 50% return on your membership.</strong>
          </p>
          <Link
            to={goldCtaTo}
            className="inline-flex items-center justify-center gap-2 bg-white text-amber-600 px-8 py-3 rounded-xl font-semibold hover:bg-amber-50 transition-colors"
          >
            Upgrade to Gold <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Gold FAQ</h2>
          </div>
          <div className="space-y-4">
            {[
              { q: 'Can I upgrade from Guardian to Gold?', a: 'Yes! You can upgrade at any time from your account settings. Your points and tier progress are preserved.' },
              { q: 'Do I start earning 2× points immediately?', a: 'Yes! As soon as Gold is active, you earn 2× points on all eligible purchases.' },
              { q: 'What happens to my Guardian points?', a: 'All your existing points and tier progress carry over to Gold. You just earn faster from now on.' },
              { q: 'Can I cancel Gold anytime?', a: 'Yes, cancel anytime. You will keep Gold benefits until the end of your current billing period.' },
            ].map((faq, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-gray-600 text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Crown className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Go Gold?</h2>
          <p className="text-gray-400 text-lg mb-8">
            Join Gold today and start earning 2× points on every purchase.
          </p>
          <Link
            to={goldCtaTo}
            className="inline-flex items-center justify-center gap-2 bg-amber-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-amber-600 transition-colors"
          >
            Upgrade to Gold <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
