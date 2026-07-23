import { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { useCmsPage } from '../hooks/useCms';
import SeoHead from '../components/SeoHead';

const defaultFaqs = [
  { q: 'How does PawTag work?', a: 'Each PawTag has a unique QR code. When someone finds your pet, they scan the tag with their phone and instantly see your pet\'s profile with your contact details. No app is needed.' },
  { q: 'Do finders need an app to scan the tag?', a: 'No. The QR code works with any smartphone camera. Simply point your camera at the tag and a link will appear to view the pet\'s profile.' },
  { q: 'What information is visible to finders?', a: 'Only what you choose to share: your pet\'s name, photo, medical alerts, and a contact number or email. Your home address is never shown unless you add it.' },
  { q: 'Is my personal data secure?', a: 'Yes. All data is encrypted and stored securely. We never sell or share your personal information. You control exactly what finders can see.' },
  { q: 'How long does the tag last?', a: 'PawTag QR tags are waterproof, scratch-resistant, and built to last the lifetime of your pet. They do not require batteries or charging.' },
  { q: 'Can I update my pet\'s profile after purchasing?', a: 'Yes. You can update your pet\'s photo, contact details, medical information, and any other profile data at any time from your account dashboard.' },
  { q: 'What happens if my pet goes missing?', a: 'When someone scans the tag, you\'ll receive an instant notification with the finder\'s location. You can then contact them directly to arrange a reunion.' },
  { q: 'Do you ship internationally?', a: 'Currently we ship within New Zealand. International shipping is coming soon.' },
];

interface FaqItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  toggle: () => void;
}

function FaqItem({ question, answer, isOpen, toggle }: FaqItemProps) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-900 pr-4">{question}</span>
        {isOpen ? <ChevronUp size={20} className="text-gray-400 shrink-0" /> : <ChevronDown size={20} className="text-gray-400 shrink-0" />}
      </button>
      {isOpen && (
        <div className="px-5 pb-5 text-gray-600 text-sm leading-relaxed">{answer}</div>
      )}
    </div>
  );
}

export default function Faq() {
  const { page } = useCmsPage('faq');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const content = page?.sections?.[0]?.content as Record<string, unknown> | undefined;
  const faqs = (content?.faqs as Array<{ q: string; a: string }>) || defaultFaqs;
  const pageTitle = page?.sections?.[0]?.title || 'Frequently Asked Questions';
  const pageDesc = (content?.description as string) || 'Everything you need to know about PawTag.';

  return (
    <div className="min-h-screen bg-gray-50">
      <SeoHead title="FAQ" description={pageDesc} keywords={['FAQ', 'help', 'support', 'questions', 'PawTag']} />
      <div className="bg-gradient-to-r from-teal-700 to-teal-600 text-white py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <HelpCircle size={40} className="mx-auto mb-4 text-teal-200" />
          <h1 className="text-4xl font-bold mb-4">{pageTitle}</h1>
          <p className="text-teal-100 text-lg">{pageDesc}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <FaqItem
              key={i}
              question={faq.q}
              answer={faq.a}
              isOpen={openIndex === i}
              toggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>

        <div className="mt-12 text-center bg-white rounded-2xl p-8 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Still have questions?</h2>
          <p className="text-gray-500 mb-4">We're here to help. Reach out to our support team.</p>
          <a href="mailto:support@pawtag.co.nz" className="inline-flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-700 transition-all">
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}