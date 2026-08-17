import { PawPrint } from 'lucide-react';

interface OfflinePageProps {
  title: string;
  message: string;
}

export default function OfflinePage({ title, message }: OfflinePageProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mb-6">
          <PawPrint size={40} className="text-primary-600" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">{title}</h1>
        <p className="text-lg text-gray-600 mb-8">{message}</p>
        <div className="text-sm text-gray-400">
          <p>PawTag — Reuniting lost pets with their families</p>
        </div>
      </div>
    </div>
  );
}
