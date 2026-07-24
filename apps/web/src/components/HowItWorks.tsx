import { UserPlus, Tag, Scan, Home } from 'lucide-react';
import { useHomepageSections, useSiteSettings } from '../hooks/useCms';

const iconMap: Record<string, typeof UserPlus> = { UserPlus, Tag, Scan, Home };

export default function HowItWorks() {
  const { sections } = useHomepageSections('how_it_works');
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';

  const defaultSteps = [
    { num: 1, icon: 'UserPlus', title: 'Register Your Pet', desc: "Create a secure profile with your pet's name, photo, medical needs, and your contact details.", iconBg: 'bg-primary-600' },
    { num: 2, icon: 'Tag', title: `Attach Your ${companyName}`, desc: "Clip the durable QR tag onto your pet's collar. It's waterproof, scratch-resistant, and built to last.", iconBg: 'bg-amber-500' },
    { num: 3, icon: 'Scan', title: 'A Finder Scans', desc: "Anyone with a smartphone can scan the QR code — no app needed. They instantly see your pet's profile.", iconBg: 'bg-sky-500' },
    { num: 4, icon: 'Home', title: 'Get Your Pet Home', desc: 'The finder contacts you directly, and you get an instant notification with their location. Reunion in minutes.', iconBg: 'bg-rose-500' },
  ];

  const steps = sections.length > 0
    ? sections.map((s, i) => {
        const content = s.content as Record<string, unknown>;
        return {
          num: i + 1,
          icon: (content?.icon as string) || defaultSteps[i]?.icon || 'UserPlus',
          title: (content?.title as string) || s.title,
          desc: (content?.desc as string) || s.subtitle || '',
          iconBg: (content?.iconBg as string) || defaultSteps[i]?.iconBg || 'bg-primary-600',
        };
      })
    : defaultSteps;

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold uppercase tracking-wider mb-4">
            How It Works
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            From lost to home in four simple steps
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            {companyName} makes reunions fast and stress-free. Here's how it works.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          <div className="hidden lg:block absolute top-12 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-primary-200 via-primary-300 to-primary-200" />

          {steps.map((step) => {
            const Icon = iconMap[step.icon] || UserPlus;
            return (
              <div key={step.num} className="relative text-center group">
                <div className="relative z-10 mb-6">
                  <div className={`inline-flex items-center justify-center w-24 h-24 rounded-3xl ${step.iconBg} text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon size={36} strokeWidth={1.5} />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white border-2 border-primary-300 flex items-center justify-center shadow-sm">
                    <span className="text-sm font-bold text-primary-700">{step.num}</span>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}