import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, ExternalLink, Loader2 } from 'lucide-react';
import api from '../lib/api';

export default function MedusaStatusCard() {
  const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading');
  const [medusaUrl] = useState(import.meta.env.VITE_MEDUSA_ADMIN_URL || 'http://localhost:9000/app');

  useEffect(() => {
    // Check Medusa health
    fetch(`${medusaUrl.replace('/app', '')}/health`, { method: 'GET' })
      .then((res) => {
        setStatus(res.ok ? 'connected' : 'error');
      })
      .catch(() => setStatus('error'));
  }, [medusaUrl]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-lg ${status === 'connected' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-gray-300'}`}>
            {status === 'loading' ? (
              <Loader2 size={20} className="text-white animate-spin" />
            ) : status === 'connected' ? (
              <CheckCircle size={20} className="text-white" />
            ) : (
              <XCircle size={20} className="text-white" />
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">Medusa Commerce</p>
            <p className="text-lg font-bold text-gray-900">
              {status === 'connected' ? 'Connected' : status === 'error' ? 'Disconnected' : 'Checking...'}
            </p>
          </div>
        </div>
        <a
          href={medusaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
        >
          Open Dashboard
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
