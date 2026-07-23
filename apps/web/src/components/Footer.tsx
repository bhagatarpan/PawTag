import { Link } from 'react-router-dom';
import { PawPrint, Mail, Phone, MapPin } from 'lucide-react';
import { useFooter, useSiteSettings } from '../hooks/useCms';

export default function Footer() {
  const { footer, loading: footerLoading } = useFooter();
  const { settings, loading: settingsLoading } = useSiteSettings();

  // Fallback data
  const fallbackGroups = [
    {
      title: 'Quick Links',
      links: [
        { label: 'Shop', url: '/shop', type: 'custom' as const },
        { label: 'About', url: '/about', type: 'custom' as const },
        { label: 'Sign In', url: '/login', type: 'custom' as const },
      ],
    },
    {
      title: 'Support',
      links: [
        { label: 'support@pawtag.co.nz', url: 'mailto:support@pawtag.co.nz', type: 'custom' as const },
        { label: '+64 XX XXX XXXX', url: 'tel:+64XXXXXXXX', type: 'custom' as const },
      ],
    },
  ];

  const displayGroups = footerLoading || !footer?.groups?.length ? fallbackGroups : footer.groups;
  const brandDescription = footer?.brandDescription || 'Smart QR-coded pet recovery tags. Because every pet deserves a safe way home.';
  const companyName = settings?.['company.name'] || 'PawTag';
  const contactEmail = settings?.['contact.email'] || 'support@pawtag.co.nz';
  const contactPhone = settings?.['contact.phone'] || '+64 XX XXX XXXX';
  const contactAddress = settings?.['contact.address'] || 'New Zealand';

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="h-9 w-9 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center">
                <PawPrint className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Paw<span className="text-teal-400">Tag</span></span>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed">
              {brandDescription}
            </p>
          </div>

          {/* Dynamic Groups */}
          {displayGroups.map((group, idx) => (
            <div key={idx}>
              <h3 className="text-white font-semibold mb-4">{group.title}</h3>
              <ul className="space-y-3">
                {group.links.map((link, linkIdx) => (
                  <li key={linkIdx}>
                    {link.url.startsWith('mailto:') || link.url.startsWith('tel:') ? (
                      <a href={link.url} className="text-gray-400 hover:text-teal-400 text-sm transition-colors">
                        {link.label}
                      </a>
                    ) : (
                      <Link to={link.url} className="text-gray-400 hover:text-teal-400 text-sm transition-colors">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-4">Contact</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-gray-400 text-sm">
                <Mail className="h-4 w-4" /> {contactEmail}
              </li>
              <li className="flex items-center gap-2 text-gray-400 text-sm">
                <MapPin className="h-4 w-4" /> {contactAddress}
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">&copy; {new Date().getFullYear()} {companyName}. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="text-gray-500 hover:text-teal-400 text-sm transition-colors">Privacy</Link>
            <Link to="/terms" className="text-gray-500 hover:text-teal-400 text-sm transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
