import { Render } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { pawtagConfig } from '../components/puck/config';
import { useCmsPage, useSiteSettings } from '../hooks/useCms';
import SeoHead from '../components/SeoHead';
import PageHero from '../components/PageHero';
import { sectionsToPuckData } from '../utils/puckData';

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
      <PageHero
        title={page?.title || `Privacy Policy - ${companyName}`}
        subtitle="How we collect, use, and protect your personal information."
      />

      <div className="py-12">
        <Render config={pawtagConfig} data={puckData} />
      </div>
    </div>
  );
}
