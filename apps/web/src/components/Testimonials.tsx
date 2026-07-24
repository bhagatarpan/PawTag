import { Star } from 'lucide-react';
import { useHomepageSections, useSiteSettings } from '../hooks/useCms';

export default function Testimonials() {
  const { sections } = useHomepageSections('testimonial');
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';

  const defaultTestimonials = [
    { name: 'Sarah M.', initials: 'SM', color: 'bg-primary-500', pet: 'Golden Retriever', quote: `My dog Max got out during a storm last month. A neighbor found him 3 blocks away and scanned his ${companyName}. I had him back within 20 minutes. I can't imagine what would have happened without it.`, focus: 'Fast Reunion' },
    { name: 'James K.', initials: 'JK', color: 'bg-sky-500', pet: 'Tabby Cat', quote: "Setting up Luna's profile took less than 5 minutes. The peace of mind knowing that anyone who finds her can instantly see her info and contact me — it's worth every penny.", focus: 'Easy Setup' },
    { name: 'Priya D.', initials: 'PD', color: 'bg-violet-500', pet: 'Cocker Spaniel', quote: `We travel a lot with our dog, and having ${companyName} gives me confidence that no matter where we are, if he slips his leash, someone can scan his tag and get him home safely.`, focus: 'Peace of Mind' },
  ];

  const testimonials = sections.length > 0
    ? sections.map((s) => {
        const content = s.content as Record<string, unknown>;
        return {
          name: (content?.name as string) || 'Anonymous',
          initials: (content?.initials as string) || 'AN',
          color: (content?.color as string) || 'bg-primary-500',
          pet: (content?.pet as string) || 'Pet',
          quote: (content?.quote as string) || s.subtitle || '',
          focus: (content?.focus as string) || '',
        };
      })
    : defaultTestimonials;

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold uppercase tracking-wider mb-4">
            Testimonials
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            What pet owners are saying
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Hear from pet parents who trust {companyName} to keep their families safe.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 flex flex-col"
            >
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={16} className="text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-gray-600 text-sm leading-relaxed flex-1 mb-6">"{t.quote}"</p>
              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                <div className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center text-white font-bold text-sm`}>
                  {t.initials}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                  <p className="text-gray-400 text-xs">Owner of a {t.pet}</p>
                </div>
                {t.focus && (
                  <span className="ml-auto text-xs font-medium text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full">
                    {t.focus}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}