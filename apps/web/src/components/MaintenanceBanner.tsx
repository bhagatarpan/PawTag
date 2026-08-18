import { useSiteAvailability } from './SiteAvailabilityProvider';
import { SiteAvailabilityStatus } from '@pawtag/shared';
import { AlertTriangle } from 'lucide-react';

export default function MaintenanceBanner() {
  const { status, messages } = useSiteAvailability();

  if (status !== SiteAvailabilityStatus.MAINTENANCE) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white shadow-lg maintenance-banner"
    >
      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 flex items-start gap-3">
        <AlertTriangle size={24} className="shrink-0 mt-0.5 text-red-200" />
        <div>
          <h2 className="text-lg sm:text-xl font-bold">{messages.maintenanceTitle}</h2>
          <p className="text-sm sm:text-base text-red-100 mt-1">{messages.maintenanceMessage}</p>
        </div>
      </div>
    </div>
  );
}
