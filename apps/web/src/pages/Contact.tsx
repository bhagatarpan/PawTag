import { Render } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { pawtagConfig } from '../components/puck/config';
import { useCmsPage, useSiteSettings } from '../hooks/useCms';
import SeoHead from '../components/SeoHead';

function sectionsToPuckData(sections: any[]) {
  const typeMap: Record<string, string> = {
    hero: 'HeroBanner', features: 'FeaturesGrid', rich_text: 'RichTextBlock',
    gallery: 'ImageGallery', cards: 'CardsGrid', pricing: 'PricingTable',
    testimonials: 'TestimonialsSection', faq: 'FaqAccordion',
    timeline: 'TimelineSection', statistics: 'StatsCounter',
    video: 'VideoEmbed', cta: 'CtaBanner', partners: 'PartnersLogos',
    map: 'MapBlock', custom: 'CustomHtml', contact_form: 'ContactForm',
  };

  const content = (sections || [])
    .filter((s: any) => s.visible !== false)
    .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
    .map((section: any, idx: number) => {
      const props = { ...section.content };
      return {
        type: typeMap[section.type] || section.type,
        props: {
          id: section.sectionId || `section_${idx}`,
          ...props,
        },
      };
    });
  return { content, root: {} };
}

export default function Contact() {
  const { page } = useCmsPage('contact');
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';

  const puckData = sectionsToPuckData(page?.sections || []);

  const firstSection = page?.sections?.[0]?.content as Record<string, unknown> | undefined;
  const heading = (firstSection?.heading as string) || 'Contact Us';
  const subtitle = (firstSection?.subtitle as string) || `Get in touch with the ${companyName} team.`;

  return (
    <div className="min-h-screen bg-gray-50">
      <SeoHead title={heading} description={subtitle} keywords={['contact', 'support', 'help', companyName]} />
      <div className="bg-gradient-to-r from-teal-700 to-teal-600 text-white py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-4">{heading}</h1>
          <p className="text-teal-100 text-lg">{subtitle}</p>
        </div>
      </div>

      <div className="py-12">
        <Render config={pawtagConfig} data={puckData} />
      </div>
    </div>
  );
}
