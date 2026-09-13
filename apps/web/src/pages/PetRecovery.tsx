import { Render } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { pawtagConfig } from '../components/puck/config';
import { useCmsPage, useSiteSettings } from '../hooks/useCms';
import SeoHead from '../components/SeoHead';
import PageHero from '../components/PageHero';
import { sectionsToPuckData } from '../utils/puckData';

// Fallback content when CMS page not available
const fallbackSections = [
  {
    sectionId: 'fallback-hero',
    type: 'rich_text',
    title: '',
    content: {
      html: '<div class="text-center max-w-3xl mx-auto py-12"><span class="inline-block px-3 py-1 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold uppercase tracking-wider mb-4">How It Works</span><h1 class="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Your Pet\'s Safety Journey</h1><p class="text-lg text-gray-600">Every year, thousands of pets go missing in New Zealand. PawTag makes sure yours always has a way home.</p></div>'
    },
    visible: true,
    order: 0,
    status: 'published' as const,
  },
  {
    sectionId: 'fallback-process',
    type: 'rich_text',
    title: 'How It Works',
    content: {
      html: '<div class="max-w-4xl mx-auto py-12 px-4"><h2 class="text-3xl font-bold text-gray-900 text-center mb-12">From Lost to Home in Four Simple Steps</h2><div class="space-y-8"><div class="flex gap-6 items-start"><div class="flex-shrink-0 w-12 h-12 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-lg">1</div><div><h3 class="font-semibold text-gray-800 text-lg">Register Your Pet</h3><p class="text-gray-600">Create your pet\'s online profile with their name, photo, breed, and medical information.</p></div></div><div class="flex gap-6 items-start"><div class="flex-shrink-0 w-12 h-12 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-lg">2</div><div><h3 class="font-semibold text-gray-800 text-lg">Attach the PawTag</h3><p class="text-gray-600">Clip the durable QR tag to your pet\'s collar. It\'s lightweight, waterproof, and designed to last.</p></div></div><div class="flex gap-6 items-start"><div class="flex-shrink-0 w-12 h-12 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-lg">3</div><div><h3 class="font-semibold text-gray-800 text-lg">Finder Scans the Tag</h3><p class="text-gray-600">Anyone who finds your pet can scan the QR code with their phone camera. No app needed.</p></div></div><div class="flex gap-6 items-start"><div class="flex-shrink-0 w-12 h-12 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-lg">4</div><div><h3 class="font-semibold text-gray-800 text-lg">You\'re Reunited</h3><p class="text-gray-600">The finder sees your pet\'s profile and can call you directly. Most pets are home within hours.</p></div></div></div></div>'
    },
    visible: true,
    order: 1,
    status: 'published' as const,
  },
];

export default function PetRecovery() {
  const { page, loading } = useCmsPage('pet-recovery');
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';

  const sections = page?.sections?.length ? page.sections : fallbackSections;
  const puckData = sectionsToPuckData(sections);

  // SEO from CMS page data (API returns meta fields not in the Page type)
  const cmsPage = page as any;
  const seoTitle = cmsPage?.metaTitle || `${companyName} - Pet Recovery — Scan, Locate, Reunite`;
  const seoDescription = cmsPage?.metaDescription || 'Learn how PawTag QR pet recovery works. From lost to home in minutes. Scan the tag, get instant alerts, share GPS location.';
  const seoKeywords = cmsPage?.metaKeywords?.length
    ? cmsPage.metaKeywords
    : ['pet recovery NZ', 'QR pet tag', 'lost pet system', 'pet safety New Zealand', 'scan to reunite'];

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SeoHead
        title={seoTitle}
        description={seoDescription}
        keywords={seoKeywords}
        ogImage={cmsPage?.ogImage || undefined}
        canonicalUrl={cmsPage?.canonicalUrl || '/pet-recovery'}
      />
      <PageHero
        title={page?.title || 'Pet Recovery'}
        subtitle="Scan. Locate. Reunite. Pet Recovery is now Safer and Simpler."
      />

      <div className="py-12">
        <Render config={pawtagConfig} data={puckData} />
      </div>
    </div>
  );
}
