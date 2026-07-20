import { Link } from 'react-router-dom';
import { PawPrint, Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
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
              Smart QR-coded pet recovery tags. Because every pet deserves a safe way home.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-3">
              <li><Link to="/shop" className="text-gray-400 hover:text-teal-400 text-sm transition-colors">Shop</Link></li>
              <li><Link to="/about" className="text-gray-400 hover:text-teal-400 text-sm transition-colors">About</Link></li>
              <li><Link to="/login" className="text-gray-400 hover:text-teal-400 text-sm transition-colors">Sign In</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-semibold mb-4">Support</h3>
            <ul className="space-y-3">
              <li><a href="mailto:support@pawtag.co.nz" className="text-gray-400 hover:text-teal-400 text-sm transition-colors">support@pawtag.co.nz</a></li>
              <li><a href="tel:+64XXXXXXXX" className="text-gray-400 hover:text-teal-400 text-sm transition-colors">+64 XX XXX XXXX</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-4">Contact</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-gray-400 text-sm">
                <Mail className="h-4 w-4" /> support@pawtag.co.nz
              </li>
              <li className="flex items-center gap-2 text-gray-400 text-sm">
                <MapPin className="h-4 w-4" /> New Zealand
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">&copy; {new Date().getFullYear()} PawTag. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="text-gray-500 hover:text-teal-400 text-sm transition-colors">Privacy</a>
            <a href="#" className="text-gray-500 hover:text-teal-400 text-sm transition-colors">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
