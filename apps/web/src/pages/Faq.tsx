import { Render } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { pawtagConfig } from '../components/puck/config';
import { useCmsPage, useSiteSettings } from '../hooks/useCms';
import SeoHead from '../components/SeoHead';
import PageHero from '../components/PageHero';
import { sectionsToPuckData } from '../utils/puckData';

export default function Faq() {
  const { page } = useCmsPage('faq');
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';

  const puckData = sectionsToPuckData(page?.sections || [], { filterPublished: false });

  const firstSection = page?.sections?.[0]?.content as Record<string, unknown> | undefined;
  const heading = (firstSection?.heading as string) || 'Frequently Asked Questions';
  const subtitle = `Everything you need to know about ${companyName}.`;

  return (
    <div className="min-h-screen bg-gray-50">
      <SeoHead title="FAQ" description={subtitle} keywords={['FAQ', 'help', 'support', 'questions', companyName]} />
      <PageHero title={heading} subtitle={subtitle} />

      <div className="py-12">
        <Render config={pawtagConfig} data={puckData} />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="text-center bg-white rounded-2xl p-8 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Still have questions?</h2>
          <p className="text-gray-500 mb-4">We're here to help. Reach out to our support team.</p>
          <a href="/contact" className="inline-flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-700 transition-all">
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
