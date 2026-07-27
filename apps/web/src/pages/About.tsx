import { useCmsPage, useSiteSettings } from '../hooks/useCms';
import SeoHead from '../components/SeoHead';

const fallbackContent = {
  title: 'About PawTag',
  sections: [
    {
      _id: 'fallback-hero',
      type: 'text',
      title: '',
      content: {
        body: '<p class="text-lg text-gray-600">PawTag is a New Zealand-born pet recovery platform that helps reunite lost pets with their families — faster, simpler, and more reliably than traditional methods.</p>'
      },
      visible: true,
      status: 'published' as const,
    },
    {
      _id: 'fallback-story',
      type: 'text',
      title: 'Our Story',
      content: {
        body: '<p class="text-gray-600">Every year, thousands of pets go missing across New Zealand. Traditional methods — printed flyers, social media posts, and word of mouth — are slow and often ineffective. PawTag was created to change that.</p><p class="text-gray-600">We built a simple QR-coded tag system that connects a lost pet to their owner in seconds. When someone finds your pet, they scan the tag, see your contact details, and reach you instantly — no app download required.</p>'
      },
      visible: true,
      status: 'published' as const,
    },
    {
      _id: 'fallback-mission',
      type: 'text',
      title: 'Our Mission',
      content: {
        body: '<p class="text-gray-600">To make pet recovery fast, simple, and reliable. We believe every pet deserves a safe way home, and every owner deserves peace of mind.</p>'
      },
      visible: true,
      status: 'published' as const,
    },
    {
      _id: 'fallback-how',
      type: 'text',
      title: 'How It Works',
      content: {
        body: '<div class="space-y-4"><div class="flex gap-4"><div class="flex-shrink-0 w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">1</div><div><h4 class="font-semibold text-gray-800">Order Your Tag</h4><p class="text-gray-600">Choose a tag for your pet and register your details online.</p></div></div><div class="flex gap-4"><div class="flex-shrink-0 w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">2</div><div><h4 class="font-semibold text-gray-800">Attach the Tag</h4><p class="text-gray-600">Clip the QR tag onto your pet\'s collar. It\'s lightweight and durable.</p></div></div><div class="flex gap-4"><div class="flex-shrink-0 w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">3</div><div><h4 class="font-semibold text-gray-800">Get Reunited</h4><p class="text-gray-600">If your pet is found, the finder scans the tag and contacts you right away.</p></div></div></div>'
      },
      visible: true,
      status: 'published' as const,
    },
    {
      _id: 'fallback-values',
      type: 'text',
      title: 'Why PawTag',
      content: {
        body: '<ul class="list-disc list-inside space-y-2 text-gray-600"><li><strong>No app needed</strong> — anyone with a smartphone camera can scan the QR code.</li><li><strong>Instant contact</strong> — the finder sees your contact info and can call or message you immediately.</li><li><strong>Real-time updates</strong> — mark your pet as lost or found from your dashboard.</li><li><strong>Health records</strong> — store vaccination and medical information in one place.</li><li><strong>Built for New Zealand</strong> — designed locally for Kiwi pet owners.</li></ul>'
      },
      visible: true,
      status: 'published' as const,
    },
  ],
};

export default function About() {
  const { page, loading } = useCmsPage('about');
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';

  // Use CMS content or fallback
  const displayPage = page || fallbackContent;
  const sections = displayPage.sections?.filter(s => s.visible && s.status === 'published') || fallbackContent.sections;

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
    <div className="max-w-3xl mx-auto px-4 py-12">
      <SeoHead 
        title={`${companyName} - About Us`}
        description={`Learn about ${companyName} - a New Zealand company dedicated to pet safety and reunification through QR-coded recovery tags.`}
        keywords={['about', 'pet safety', 'pet recovery', 'QR code tags', 'New Zealand']}
      />
      <h1 className="text-3xl font-bold mb-6">{displayPage.title || `About ${companyName}`}</h1>
      <div className="prose prose-gray max-w-none">
        {sections.map((section) => (
          <div key={section._id}>
            {section.title && <h2 className="text-2xl font-bold mt-8 mb-4">{section.title}</h2>}
            {section.type === 'text' && section.content?.body && (
              <div dangerouslySetInnerHTML={{ __html: section.content.body }} />
            )}
            {section.type === 'rich_text' && section.content?.html && (
              <div dangerouslySetInnerHTML={{ __html: section.content.html }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
