import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PawPrint, X, AlertTriangle, Search, UserRoundX } from 'lucide-react';

// Get the base URL for customer and finder portals
// In production, these would be different domains or subdomains
const getBaseUrl = () => {
  const hostname = window.location.hostname;
  // For development, use localhost with different ports
  if (hostname === 'localhost') {
    return {
      customer: 'http://localhost:3002',
      finder: 'http://localhost:3003',
    };
  }
  // For production, use relative paths or configured URLs
  return {
    customer: '/customer',
    finder: '/finder',
  };
};

export default function EmergencyLostPet() {
  const [isOpen, setIsOpen] = useState(false);
  const urls = getBaseUrl();

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className="mb-3 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden w-72 animate-slide-up">
          <div className="bg-gradient-to-r from-red-500 to-orange-500 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <AlertTriangle size={18} />
              <span className="font-bold text-sm">Lost Pet?</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <div className="p-4 space-y-3">
            <a
              href={urls.customer}
              className="flex items-center gap-3 p-3 rounded-xl bg-red-50 hover:bg-red-100 border border-red-100 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <UserRoundX size={20} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">I Lost My Pet</p>
                <p className="text-gray-500 text-xs">Report and track your pet</p>
              </div>
            </a>
            <a
              href={urls.finder}
              className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-100 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Search size={20} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">I Found a Pet</p>
                <p className="text-gray-500 text-xs">Scan a tag or report a found pet</p>
              </div>
            </a>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'bg-gray-800 hover:bg-gray-700 rotate-0'
            : 'bg-gradient-to-br from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 animate-pulse-once'
        }`}
        aria-label="Lost pet help"
      >
        {isOpen ? (
          <X size={24} className="text-white" />
        ) : (
          <PawPrint size={24} className="text-white" />
        )}
      </button>
    </div>
  );
}
