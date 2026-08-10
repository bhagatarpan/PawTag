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
    sectionId: 'fallback-intro',
    type: 'rich_text',
    title: '',
    content: { html: '<p class="text-lg text-gray-600">PawTag is a New Zealand-born pet recovery platform that helps reunite lost pets with their families — faster, simpler, and more reliably than traditional methods.</p>' },
    visible: true,
    order: 0,
    status: 'published' as const,
  },
  {
    sectionId: 'fallback-story',
    type: 'rich_text',
    title: 'Our Story',
    content: { html: '<p class="text-gray-600 mb-4">Every year, thousands of pets go missing across New Zealand. Traditional methods — printed flyers, social media posts, and word of mouth — are slow and often ineffective. PawTag was created to change that.</p><p class="text-gray-600">We built a simple QR-coded tag system that connects a lost pet to their owner in seconds. When someone finds your pet, they scan the tag, see your contact details, and reach you instantly — no app download required.</p>' },
    visible: true,
    order: 1,
    status: 'published' as const,
  },
  {
    sectionId: 'fallback-mission',
    type: 'rich_text',
    title: 'Our Mission',
    content: { html: '<p class="text-gray-600">To make pet recovery fast, simple, and reliable. We believe every pet deserves a safe way home, and every owner deserves peace of mind.</p>' },
    visible: true,
    order: 2,
    status: 'published' as const,
  },
  {
    sectionId: 'fallback-how',
    type: 'rich_text',
    title: 'How It Works',
    content: { html: '<div class="space-y-4"><div class="flex gap-4"><div class="flex-shrink-0 w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">1</div><div><h4 class="font-semibold text-gray-800">Order Your Tag</h4><p class="text-gray-600">Choose a tag for your pet and register your details online.</p></div></div><div class="flex gap-4"><div class="flex-shrink-0 w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">2</div><div><h4 class="font-semibold text-gray-800">Attach the Tag</h4><p class="text-gray-600">Clip the QR tag onto your pet\'s collar. It\'s lightweight and durable.</p></div></div><div class="flex gap-4"><div class="flex-shrink-0 w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">3</div><div><h4 class="font-semibold text-gray-800">Get Reunited</h4><p class="text-gray-600">If your pet is found, the finder scans the tag and contacts you right away.</p></div></div></div>' },
    visible: true,
    order: 3,
    status: 'published' as const,
  },
  {
    sectionId: 'fallback-values',
    type: 'cards',
    title: 'Why PawTag',
    content: {
      heading: 'Why PawTag',
      items: [
        { icon: '\uD83F\uDDF1', title: 'No app needed', description: 'Anyone with a smartphone camera can scan the QR code.', link: '' },
        { icon: '\u260E\uFE0F', title: 'Instant contact', description: 'The finder sees your contact info and can call or message you immediately.', link: '' },
        { icon: '\uD83D\uDD04', title: 'Real-time updates', description: 'Mark your pet as lost or found from your dashboard.', link: '' },
        { icon: '\uD83C\uDFE5', title: 'Health records', description: 'Store vaccination and medical information in one place.', link: '' },
        { icon: '\uD83C\uDDF3\uD83C\uDDFF', title: 'Built for New Zealand', description: 'Designed locally for Kiwi pet owners.', link: '' },
      ],
    },
    visible: true,
    order: 4,
    status: 'published' as const,
  },
];

export default function About() {
  const { page, loading } = useCmsPage('about');
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';

  const sections = page?.sections?.length ? page.sections : fallbackSections;
  const puckData = sectionsToPuckData(sections);

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
        title={`${companyName} - About Us`}
        description={`Learn about ${companyName} - a New Zealand company dedicated to pet safety and reunification through QR-coded recovery tags.`}
        keywords={['about', 'pet safety', 'pet recovery', 'QR code tags', 'New Zealand']}
      />
      <PageHero
        title={page?.title || `About ${companyName}`}
        subtitle="Learn about our mission to reunite pets with their families."
      />

      <div className="py-12">
        <Render config={pawtagConfig} data={puckData} />
      </div>
    </div>
  );
}
