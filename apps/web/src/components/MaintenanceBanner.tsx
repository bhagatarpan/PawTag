import { useSiteAvailability } from './SiteAvailabilityProvider';
import { SiteAvailabilityStatus } from '@pawtag/shared';
import { AlertTriangle } from 'lucide-react';

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function MaintenanceBanner() {
  const { status, messages } = useSiteAvailability();

  if (status !== SiteAvailabilityStatus.MAINTENANCE) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-[60] bg-red-600 text-white shadow-lg"
      style={prefersReducedMotion ? undefined : { animation: 'maintenance-pulse 3s ease-in-out infinite' }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 sm:py-5 flex items-center gap-4">
        <AlertTriangle size={24} className="shrink-0 text-red-200" />
        <div>
          <h2 className="text-lg sm:text-xl font-bold leading-tight">{messages.maintenanceTitle}</h2>
          <p className="text-sm sm:text-base text-red-100 mt-1 leading-snug">{messages.maintenanceMessage}</p>
        </div>
      </div>
    </div>
  );
}
