import { AlertTriangle } from 'lucide-react';

interface MedicalAlertBannerProps {
  message: string;
}

export default function MedicalAlertBanner({ message }: MedicalAlertBannerProps) {
  return (
    <div className="mx-4 mt-4">
      <div className="relative overflow-hidden bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl p-4">
        <div className="absolute top-0 right-0 w-20 h-20 bg-red-200/30 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-start gap-3">
          <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0 border border-red-200">
            <AlertTriangle size={18} className="text-red-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-red-800 uppercase tracking-wider">Medical Alert</p>
            <p className="text-sm text-red-600 mt-0.5">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
