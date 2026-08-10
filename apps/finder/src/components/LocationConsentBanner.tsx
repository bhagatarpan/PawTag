import { MapPin, CheckCircle } from 'lucide-react';

interface LocationConsentBannerProps {
  consent: 'pending' | 'granted' | 'denied' | 'unavailable';
  hasLocation: boolean;
  onGrant: () => void;
  onDecline: () => void;
}

export default function LocationConsentBanner({ consent, hasLocation, onGrant, onDecline }: LocationConsentBannerProps) {
  if (consent === 'pending' && typeof navigator !== 'undefined' && navigator.geolocation) {
    return (
      <div className="mx-4 mt-4">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 border border-blue-200">
              <MapPin size={18} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-800">Share your location?</p>
              <p className="text-xs text-blue-600 mt-1 leading-relaxed">
                Help the owner know where to find their pet. Location is only used for reunification.
              </p>
              <div className="flex gap-2 mt-3">
                <button 
                  onClick={onGrant} 
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all duration-200 flex items-center gap-1.5 shadow-sm shadow-blue-600/20"
                >
                  <MapPin size={14} /> Share
                </button>
                <button 
                  onClick={onDecline} 
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (hasLocation) {
    return (
      <div className="mx-4 mt-3">
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 py-2.5 px-3 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle size={16} /> 
          <span className="text-xs font-medium">Location captured — will be shared with owner</span>
        </div>
      </div>
    );
  }

  if (consent === 'denied') {
    return (
      <div className="mx-4 mt-3">
        <div className="bg-gray-50 border border-gray-200 text-gray-500 py-2.5 px-3 rounded-xl text-sm flex items-center gap-2">
          <MapPin size={16} /> 
          <span className="text-xs font-medium">Location not shared</span>
        </div>
      </div>
    );
  }

  return null;
}
