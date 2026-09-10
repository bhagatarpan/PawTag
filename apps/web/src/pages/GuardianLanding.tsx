import { Link } from 'react-router-dom';
import { Shield, Star, Zap, Crown, Check, ArrowRight, PawPrint, Gift, Truck, Clock, Users, TrendingUp } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import PageHero from '../components/PageHero';

const tiers = [
  {
    name: 'Care',
    icon: Shield,
    points: '1×',
    rewards: '$2/mo',
    shipping: 'Over $100',
    color: 'bg-emerald-100 text-emerald-700',
    borderColor: 'border-emerald-200',
    minPoints: 0,
    features: ['1× points on purchases', '$2/mo PawRewards', 'Free shipping over $100', 'Guardian badge', 'Monthly progress email'],
  },
  {
    name: 'Nurture',
    icon: Star,
    points: '1×',
    rewards: '$3/mo',
    shipping: 'Over $75',
    color: 'bg-teal-100 text-teal-700',
    borderColor: 'border-teal-200',
    minPoints: 100,
    features: ['1× points on purchases', '$3/mo PawRewards', 'Free shipping over $75', 'Photo review bonus', 'Exclusive promotions'],
  },
  {
    name: 'Protector',
    icon: Zap,
    points: '1×',
    rewards: '$5/mo',
    shipping: 'Over $50',
    color: 'bg-purple-100 text-purple-700',
    borderColor: 'border-purple-200',
    minPoints: 200,
    features: ['1× points on purchases', '$5/mo PawRewards', 'Free shipping over $50', 'Early access', 'Priority support'],
  },
  {
    name: 'Safeguard',
    icon: Crown,
    points: '2×',
    rewards: '$8/mo',
    shipping: 'Free',
    color: 'bg-amber-100 text-amber-700',
    borderColor: 'border-amber-200',
    minPoints: 300,
    features: ['2× points on purchases', '$8/mo PawRewards', 'Free shipping always', 'Annual gift', 'Referral bonus boost'],
  },
];

const howItWorks = [
  { step: '1', title: 'Join Guardian', description: 'Sign up for free and start earning points immediately.' },
  { step: '2', title: 'Earn Points', description: 'Get points on every purchase, pet milestones, reviews, and referrals.' },
  { step: '3', title: 'Unlock Rewards', description: 'Convert points to PawRewards and spend them on products.' },
  { step: '4', title: 'Level Up', description: 'Progress through tiers for better benefits and higher rewards.' },
];

const faqs = [
  { q: 'Is Guardian free to join?', a: 'Yes! Guardian is completely free. You start earning points from your very first purchase.' },
  { q: 'How do I earn points?', a: 'Earn points on every purchase, when your pet hits milestones, for leaving reviews, referring friends, and more.' },
  { q: 'What are PawRewards?', a: 'PawRewards are store credit you earn monthly based on your tier. You can spend them on any product.' },
  { q: 'How do I level up?', a: 'Earn points through purchases and activities. Your tier upgrades automatically as you accumulate points.' },
  { q: 'What is Gold?', a: 'Gold is a premium membership at $1.99/month. You earn 2× points on every purchase and start at Nurture tier.' },
];

export default function GuardianLanding() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SeoHead
        title="Guardian Loyalty Program"
        description="Join PawTag Guardian and earn rewards on every purchase. Free to join, earn points, PawRewards, and unlock exclusive benefits."
        keywords={['Guardian', 'loyalty', 'rewards', 'points', 'PawRewards', 'membership', 'PawTag']}
      />

      {/* Hero */}
      <PageHero
        title="Protect More. Earn More. Save More."
        subtitle="Join Guardian and turn every PawTag purchase into rewards. Free to join, earn points on every purchase, and unlock exclusive benefits."
      >
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <Link
            to="/register"
            className="inline-flex items-center justify-center gap-2 bg-white text-teal-700 px-8 py-3 rounded-xl font-semibold hover:bg-teal-50 transition-colors"
          >
            Join Guardian — It's Free <ArrowRight size={18} />
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center justify-center gap-2 border border-white/30 text-white px-8 py-3 rounded-xl font-semibold hover:bg-white/10 transition-colors"
          >
            Learn How It Works
          </a>
        </div>
      </PageHero>

      {/* Gold Upsell — shown immediately after hero for maximum visibility */}
      <section className="py-12 bg-gradient-to-r from-amber-500 to-orange-500">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Crown className="h-10 w-10 text-white mx-auto mb-3" />
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Want to Earn Even More?</h2>
          <p className="text-amber-100 text-lg mb-5">
            Gold members earn <strong>2× Points</strong> on every purchase and start at Nurture tier.
            That's $1.99/month — less than a coffee.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/gold"
              className="inline-flex items-center justify-center gap-2 bg-white text-amber-600 px-6 py-2.5 rounded-xl font-semibold hover:bg-amber-50 transition-colors text-sm"
            >
              Learn About Gold <ArrowRight size={16} />
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 border border-white/30 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-white/10 transition-colors text-sm"
            >
              Join Guardian Free
            </Link>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { icon: <PawPrint className="h-8 w-8 text-primary-600" />, title: 'Earn on Every Purchase', desc: 'Get points every time you shop' },
              { icon: <Gift className="h-8 w-8 text-primary-600" />, title: 'Monthly PawRewards', desc: 'Store credit every month based on your tier' },
              { icon: <TrendingUp className="h-8 w-8 text-primary-600" />, title: 'Level Up', desc: 'Progress through 4 tiers for better benefits' },
              { icon: <Users className="h-8 w-8 text-primary-600" />, title: 'Refer & Earn', desc: 'Earn bonus points for every friend you refer' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  {item.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How Guardian Works</h2>
            <p className="text-gray-500 text-lg">Four simple steps to start earning rewards</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {howItWorks.map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tier Comparison */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Choose Your Tier</h2>
            <p className="text-gray-500 text-lg">Start at Care and level up as you earn points</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {tiers.map((tier) => {
              const Icon = tier.icon;
              return (
                <div
                  key={tier.name}
                  className={`bg-white rounded-2xl border-2 ${tier.borderColor} p-6 hover:shadow-lg transition-all`}
                >
                  <div className={`w-12 h-12 ${tier.color} rounded-xl flex items-center justify-center mb-4`}>
                    <Icon size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{tier.name}</h3>
                  <p className="text-xs text-gray-500 mb-4">{tier.minPoints}+ points</p>
                  <ul className="space-y-2">
                    {tier.features.map((feature, fi) => (
                      <li key={fi} className="flex items-center gap-2 text-sm text-gray-600">
                        <Check size={14} className="text-primary-500 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Points Examples */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">See What You Could Earn</h2>
            <p className="text-gray-500 text-lg">Real examples based on actual purchase amounts</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { spend: 50, guardian: 50, gold: 100 },
              { spend: 100, guardian: 100, gold: 200 },
              { spend: 200, guardian: 200, gold: 400 },
            ].map((ex) => (
              <div key={ex.spend} className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
                <p className="text-sm text-gray-500 mb-2">Spend ${ex.spend}</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-2xl font-bold text-primary-600">{ex.guardian} Points</p>
                    <p className="text-xs text-gray-400">Guardian member</p>
                  </div>
                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-2xl font-bold text-amber-600">{ex.gold} Points</p>
                    <p className="text-xs text-gray-400">Gold member (2×)</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-gray-600 text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-primary-600">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Start Earning?</h2>
          <p className="text-primary-100 text-lg mb-8">
            Join thousands of pet owners who are already earning rewards with Guardian.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center justify-center gap-2 bg-white text-primary-600 px-8 py-3 rounded-xl font-semibold hover:bg-primary-50 transition-colors"
          >
            Join Guardian — It's Free <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
