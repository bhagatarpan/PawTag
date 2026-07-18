import { PawPrint } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <PawPrint className="text-primary-400" size={24} />
              <span className="text-lg font-bold text-white">PawTag</span>
            </div>
            <p className="text-sm">Never lose your pet again. QR-powered pet recovery for New Zealand.</p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-3">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="/shop" className="hover:text-white transition-colors">Shop</a></li>
              <li><a href="/about" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Support</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-3">Contact</h3>
            <p className="text-sm">support@pawtag.co.nz</p>
            <p className="text-sm">New Zealand</p>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-xs">
          &copy; {new Date().getFullYear()} PawTag. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
