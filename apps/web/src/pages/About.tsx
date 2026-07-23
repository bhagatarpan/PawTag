import { useCmsPage } from '../hooks/useCms';

// Fallback content when CMS page not available
const fallbackContent = {
  title: 'About PawTag',
  sections: [
    {
      _id: 'fallback-1',
      type: 'text',
      title: '',
      content: {
        body: '<p class="text-lg text-gray-600 mb-4">PawTag is a New Zealand company dedicated to pet safety and reunification.</p><p class="text-gray-600 mb-4">Every year, thousands of pets go missing in New Zealand. Traditional ID tags can fall off or become unreadable. PawTag solves this problem with durable, scannable QR code tags that link directly to your pet\'s online profile.</p><p class="text-gray-600 mb-4">When someone finds your pet, they simply scan the QR code with their smartphone camera. No app download required. They see your pet\'s photo, name, and medical alerts, and can notify you immediately with their location.</p>'
      },
      visible: true,
      status: 'published' as const,
    },
    {
      _id: 'fallback-2',
      type: 'text',
      title: 'Our Mission',
      content: {
        body: '<p class="text-gray-600">To make pet recovery fast, simple, and reliable. We believe every pet deserves a safe way home.</p>'
      },
      visible: true,
      status: 'published' as const,
    },
  ],
};

export default function About() {
  const { page, loading } = useCmsPage('about');

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
      <h1 className="text-3xl font-bold mb-6">{displayPage.title}</h1>
      <div className="prose prose-gray max-w-none">
        {sections.map((section) => (
          <div key={section._id}>
            {section.title && <h2 className="text-2xl font-bold mt-8 mb-4">{section.title}</h2>}
            {section.type === 'text' && section.content?.body && (
              <div dangerouslySetInnerHTML={{ __html: section.content.body }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
