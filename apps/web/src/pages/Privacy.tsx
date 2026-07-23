import { useCmsPage } from '../hooks/useCms';
import SeoHead from '../components/SeoHead';

export default function Privacy() {
  const { page, loading } = useCmsPage('privacy-policy');

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
    <div className="max-w-3xl mx-auto px-4 py-12">
      <SeoHead 
        title="Privacy Policy"
        description="PawTag Privacy Policy - Learn how we collect, use, and protect your personal information."
        keywords={['privacy policy', 'data protection', 'personal information', 'PawTag']}
      />
      <h1 className="text-3xl font-bold mb-6">{page?.title || 'Privacy Policy'}</h1>
      <div className="prose prose-gray max-w-none">
        {page?.sections?.filter(s => s.visible && s.status === 'published').map((section) => (
          <div key={section._id}>
            {section.title && <h2 className="text-2xl font-bold mt-8 mb-4">{section.title}</h2>}
            {section.type === 'text' && section.content?.body && (
              <div dangerouslySetInnerHTML={{ __html: section.content.body }} />
            )}
          </div>
        )) || (
          <div className="text-gray-600 space-y-4">
            <p className="text-lg">Last updated: {new Date().toLocaleDateString()}</p>
            <h2 className="text-xl font-semibold mt-6">1. Information We Collect</h2>
            <p>We collect information you provide directly to us, such as when you create an account, register a pet, purchase a tag, or contact us for support.</p>
            <h2 className="text-xl font-semibold mt-6">2. How We Use Your Information</h2>
            <p>We use the information we collect to provide, maintain, and improve our services, to process transactions, and to send you technical notices and support messages.</p>
            <h2 className="text-xl font-semibold mt-6">3. Information Sharing</h2>
            <p>We do not sell your personal information. We may share your information only when you direct us to (such as when a finder scans your pet's tag) or as required by law.</p>
            <h2 className="text-xl font-semibold mt-6">4. Data Security</h2>
            <p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>
            <h2 className="text-xl font-semibold mt-6">5. Contact Us</h2>
            <p>If you have questions about this Privacy Policy, please contact us at support@pawtag.co.nz.</p>
          </div>
        )}
      </div>
    </div>
  );
}
