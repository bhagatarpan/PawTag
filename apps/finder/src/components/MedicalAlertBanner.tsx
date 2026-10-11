import { AlertTriangle } from 'lucide-react';

interface MedicalAlertBannerProps {
  message: string;
  /** Extra classes (e.g. `mx-0` when the parent already provides padding). */
  className?: string;
}

export default function MedicalAlertBanner({ message, className }: MedicalAlertBannerProps) {
  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2 ${className || 'mx-6'}`}>
      <AlertTriangle size={20} className="text-red-500 mt-0.5 shrink-0" />
      <div>
        <p className="text-base font-medium text-red-700">Medical Alert</p>
        <p className="text-base text-red-600">{message}</p>
      </div>
    </div>
  );
}
