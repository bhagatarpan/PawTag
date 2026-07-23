import { useCmsPage } from '../hooks/useCms';
import SeoHead from '../components/SeoHead';

export default function Terms() {
  const { page, loading } = useCmsPage('terms-of-service');

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
        title="Terms of Service"
        description="PawTag Terms of Service - Read our terms and conditions for using our pet recovery services."
        keywords={['terms of service', 'terms and conditions', 'user agreement', 'PawTag']}
      />
      <h1 className="text-3xl font-bold mb-6">{page?.title || 'Terms of Service'}</h1>
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
            <h2 className="text-xl font-semibold mt-6">1. Acceptance of Terms</h2>
            <p>By accessing or using PawTag's services, you agree to be bound by these Terms of Service.</p>
            <h2 className="text-xl font-semibold mt-6">2. Description of Service</h2>
            <p>PawTag provides QR-coded pet recovery tags and associated online profiles to help reunite lost pets with their owners.</p>
            <h2 className="text-xl font-semibold mt-6">3. User Responsibilities</h2>
            <p>You are responsible for maintaining the accuracy of your pet's profile information and keeping your account credentials secure.</p>
            <h2 className="text-xl font-semibold mt-6">4. Purchases and Refunds</h2>
            <p>All purchases are final. Refunds may be issued at our discretion for defective products within 30 days of purchase.</p>
            <h2 className="text-xl font-semibold mt-6">5. Limitation of Liability</h2>
            <p>PawTag is not responsible for the recovery of lost pets. Our service facilitates communication between finders and owners but does not guarantee reunification.</p>
            <h2 className="text-xl font-semibold mt-6">6. Contact Us</h2>
            <p>If you have questions about these Terms, please contact us at support@pawtag.co.nz.</p>
          </div>
        )}
      </div>
    </div>
  );
}
