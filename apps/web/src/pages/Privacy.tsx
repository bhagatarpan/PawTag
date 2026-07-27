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
    .filter((s: any) => s.visible !== false && s.status === 'published')
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

export default function Privacy() {
  const { page, loading } = useCmsPage('privacy-policy');
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';

  const puckData = sectionsToPuckData(page?.sections || []);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SeoHead
        title={`${companyName} - Privacy Policy`}
        description={`${companyName} Privacy Policy - Learn how we collect, use, and protect your personal information.`}
        keywords={['privacy policy', 'data protection', 'personal information', companyName]}
      />
      <div className="bg-gradient-to-r from-teal-700 to-teal-600 text-white py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-4">{page?.title || `Privacy Policy - ${companyName}`}</h1>
          <p className="text-teal-100 text-lg">How we collect, use, and protect your personal information.</p>
        </div>
      </div>

      <div className="py-12">
        <Render config={pawtagConfig} data={puckData} />
      </div>
    </div>
  );
}
