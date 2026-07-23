import { Mail, Phone, MapPin, Clock } from 'lucide-react';
import { useSiteSettings } from '../hooks/useCms';
import SeoHead from '../components/SeoHead';

export default function Contact() {
  const { settings } = useSiteSettings();

  const contactEmail = settings?.['contact.email'] || settings?.['company.email'] || 'support@pawtag.co.nz';
  const contactPhone = settings?.['contact.phone'] || settings?.['company.phone'] || '+64 21 123 4567';
  const contactAddress = settings?.['contact.address'] || settings?.['company.address'] || 'Auckland, New Zealand';

  return (
    <div className="min-h-screen bg-gray-50">
      <SeoHead title="Contact Us" description="Get in touch with the PawTag team. We're here to help with any questions about our pet recovery tags." keywords={['contact', 'support', 'help', 'PawTag']} />
      <div className="bg-gradient-to-r from-teal-700 to-teal-600 text-white py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
          <p className="text-teal-100 text-lg">Have a question or need help? We'd love to hear from you.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-shadow">
            <div className="inline-flex p-3 rounded-xl bg-teal-50 text-teal-600 mb-4">
              <Mail size={24} />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Email</h3>
            <a href={`mailto:${contactEmail}`} className="text-teal-600 hover:text-teal-700 text-sm">{contactEmail}</a>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-shadow">
            <div className="inline-flex p-3 rounded-xl bg-blue-50 text-blue-600 mb-4">
              <Phone size={24} />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Phone</h3>
            <a href={`tel:${contactPhone}`} className="text-blue-600 hover:text-blue-700 text-sm">{contactPhone}</a>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-shadow">
            <div className="inline-flex p-3 rounded-xl bg-violet-50 text-violet-600 mb-4">
              <MapPin size={24} />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Address</h3>
            <p className="text-gray-600 text-sm">{contactAddress}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-shadow">
            <div className="inline-flex p-3 rounded-xl bg-amber-50 text-amber-600 mb-4">
              <Clock size={24} />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Hours</h3>
            <p className="text-gray-600 text-sm">Mon-Fri: 9am - 5pm NZST</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Send us a message</h2>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert('Thank you! We\'ll be in touch soon.'); }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" className="w-full border rounded-lg px-4 py-3 text-sm" placeholder="Your name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="w-full border rounded-lg px-4 py-3 text-sm" placeholder="you@example.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input type="text" className="w-full border rounded-lg px-4 py-3 text-sm" placeholder="How can we help?" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea rows={5} className="w-full border rounded-lg px-4 py-3 text-sm" placeholder="Tell us more..." />
            </div>
            <button type="submit" className="bg-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-700 transition-all">
              Send Message
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}