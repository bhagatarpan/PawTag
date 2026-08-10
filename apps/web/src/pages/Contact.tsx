import { Render } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { pawtagConfig } from '../components/puck/config';
import { useCmsPage, useSiteSettings } from '../hooks/useCms';
import SeoHead from '../components/SeoHead';
import PageHero from '../components/PageHero';
import { sectionsToPuckData } from '../utils/puckData';

export default function Contact() {
  const { page } = useCmsPage('contact');
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';

  const puckData = sectionsToPuckData(page?.sections || [], { filterPublished: false });

  const firstSection = page?.sections?.[0]?.content as Record<string, unknown> | undefined;
  const heading = (firstSection?.heading as string) || 'Contact Us';
  const subtitle = (firstSection?.subtitle as string) || `Get in touch with the ${companyName} team.`;

  return (
    <div className="min-h-screen bg-gray-50">
      <SeoHead title={heading} description={subtitle} keywords={['contact', 'support', 'help', companyName]} />
      <PageHero title={heading} subtitle={subtitle} />

      <div className="py-12">
        <Render config={pawtagConfig} data={puckData} />
      </div>
    </div>
  );
}
