import { Render } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { pawtagConfig } from '../components/puck/config';
import { useCmsPage, useSiteSettings } from '../hooks/useCms';
import SeoHead from '../components/SeoHead';
import PageHero from '../components/PageHero';
import { sectionsToPuckData } from '../utils/puckData';

export default function Terms() {
  const { page, loading } = useCmsPage('terms-of-service');
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
        title={`${companyName} - Terms of Service`}
        description={`${companyName} Terms of Service - Read our terms and conditions for using our pet recovery services.`}
        keywords={['terms of service', 'terms and conditions', 'user agreement', companyName]}
      />
      <PageHero
        title={page?.title || `Terms of Service - ${companyName}`}
        subtitle="Our terms and conditions for using PawTag services."
      />

      <div className="py-12">
        <Render config={pawtagConfig} data={puckData} />
      </div>
    </div>
  );
}
