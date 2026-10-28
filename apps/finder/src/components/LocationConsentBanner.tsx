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
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <MapPin size={20} className="text-primary-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Share your location to help reunite this pet?</p>
            <p className="text-xs text-gray-600 mt-1">Your exact location (from your phone&apos;s GPS) will be shared with the pet&apos;s owner so they know where their pet was last seen. Only the pet&apos;s owner sees it — used only for this reunion.</p>
            <div className="flex gap-2 mt-3">
              <button onClick={onGrant} className="border border-primary-600 bg-white text-primary-700 px-4 py-3 rounded-lg text-sm font-medium hover:bg-primary-50 transition-colors flex items-center gap-1.5">
                <MapPin size={14} /> Share Location
              </button>
              <button onClick={onDecline} className="px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Skip
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (hasLocation) {
    return (
      <div className="bg-green-50 text-green-700 py-2 px-3 rounded-lg text-sm flex items-center gap-2">
        <CheckCircle size={14} /> Location captured — will be shared with owner
      </div>
    );
  }

  if (consent === 'denied') {
    return (
      <div className="bg-gray-50 text-gray-500 py-2 px-3 rounded-lg text-sm flex items-center gap-2">
        <MapPin size={14} /> Location not shared
      </div>
    );
  }

  return null;
}
