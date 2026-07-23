import { ShieldCheck, Lock, Eye, RotateCcw } from 'lucide-react';
import { useHomepageSections } from '../hooks/useCms';

const iconMap: Record<string, typeof ShieldCheck> = { ShieldCheck, Lock, Eye, RotateCcw };

const defaultBadges = [
  { icon: 'ShieldCheck', title: 'Secure Accounts', desc: 'Every account is protected with encrypted passwords and optional two-factor authentication.', color: 'bg-primary-50 text-primary-600' },
  { icon: 'Eye', title: 'Data Privacy', desc: 'Your address and personal details are only shared when you choose to. You stay in control.', color: 'bg-violet-50 text-violet-600' },
  { icon: 'Lock', title: 'Encrypted Payments', desc: 'All transactions are processed through Stripe with bank-level encryption. We never store card data.', color: 'bg-amber-50 text-amber-600' },
  { icon: 'RotateCcw', title: 'Reliable Recovery', desc: 'Our tags are waterproof, scratch-resistant, and built to last the lifetime of your pet.', color: 'bg-emerald-50 text-emerald-600' },
];

export default function TrustSection() {
  const { sections } = useHomepageSections('trust');

  const badges = sections.length > 0
    ? sections.map((s) => {
        const content = s.content as Record<string, unknown>;
        return {
          icon: (content?.icon as string) || 'ShieldCheck',
          title: (content?.title as string) || s.title,
          desc: (content?.desc as string) || s.subtitle || '',
          color: (content?.color as string) || 'bg-primary-50 text-primary-600',
        };
      })
    : defaultBadges;

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold uppercase tracking-wider mb-4">
            Trust & Security
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Your pet's safety is our priority
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            PawTag is built on a foundation of security, privacy, and reliability.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {badges.map((badge) => {
            const Icon = iconMap[badge.icon] || ShieldCheck;
            return (
              <div
                key={badge.title}
                className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-primary-200 hover:shadow-lg transition-all duration-300 group"
              >
                <div className={`inline-flex p-3 rounded-xl ${badge.color} mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{badge.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{badge.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}