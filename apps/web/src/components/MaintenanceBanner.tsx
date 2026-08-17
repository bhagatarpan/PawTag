import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function MaintenanceBanner() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const dismissed = sessionStorage.getItem('maintenance_banner_dismissed');
    if (dismissed === 'true') setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="relative bg-red-600 text-white animate-maintenance-pulse">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-200 animate-pulse" />
            <p className="text-sm font-medium">
              PawTag is currently under maintenance. Some website functionality is temporarily unavailable. Please check back shortly.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setVisible(false);
              sessionStorage.setItem('maintenance_banner_dismissed', 'true');
            }}
            className="ml-4 inline-flex shrink-0 rounded-lg p-1 text-red-200 hover:text-white hover:bg-red-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
