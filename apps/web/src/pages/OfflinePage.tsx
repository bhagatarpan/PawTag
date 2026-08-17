import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import api from '../lib/api';

export default function OfflinePage() {
  const [isActuallyOffline, setIsActuallyOffline] = useState(false);

  useEffect(() => {
    api.get('/public/system/status')
      .then((res) => {
        const status = res.data.data.status;
        if (status === 'ONLINE') {
          // Site came back online, reload to restore normal state
          window.location.reload();
        }
      })
      .catch(() => {
        // Network error — this is actual connectivity loss, not deliberate offline
        setIsActuallyOffline(true);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <WifiOff size={40} className="text-red-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">PawTag is currently offline</h1>
        <p className="text-lg text-gray-600 mb-8">
          {isActuallyOffline
            ? 'It looks like you may have lost your internet connection.'
            : 'Please come back later. Our administrators are working to restore service.'}
        </p>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full px-6 py-3 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors"
          >
            Try Again
          </button>
          <p className="text-sm text-gray-500">
            If this persists, contact{' '}
            <a href="mailto:support@pawtag.co.nz" className="text-teal-600 hover:underline">
              support@pawtag.co.nz
            </a>
          </p>
        </div>
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-400">PawTag — Reuniting lost pets with their families</p>
        </div>
      </div>
    </div>
  );
}
