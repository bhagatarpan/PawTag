import { AlertTriangle } from 'lucide-react';

interface MedicalAlertBannerProps {
  message: string;
}

export default function MedicalAlertBanner({ message }: MedicalAlertBannerProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mx-6 mb-4 flex items-start gap-2">
      <AlertTriangle size={20} className="text-red-500 mt-0.5 shrink-0" />
      <div>
        <p className="text-base font-medium text-red-700">Medical Alert</p>
        <p className="text-base text-red-600">{message}</p>
      </div>
    </div>
  );
}
