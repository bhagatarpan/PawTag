import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Heart, Loader2 } from 'lucide-react';
import { API } from '@pawtag/shared/api';

/**
 * Public donation receipt view — token in URL, no login required.
 * Used by emailed "Download receipt" links.
 */
export default function DonationReceiptView() {
  const { token } = useParams<{ token: string }>();
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError('Invalid receipt link');
      setLoading(false);
      return;
    }
    fetch(`/api${API.donations.receiptAccess(token)}`)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            setError(data.error || 'Receipt unavailable');
          } catch {
            setError('Receipt unavailable');
          }
          setLoading(false);
          return;
        }
        const text = await res.text();
        // Endpoint returns HTML document
        if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
          setHtml(text);
        } else {
          try {
            const data = JSON.parse(text);
            setHtml(data.data?.invoiceHtml || data.data?.html || '');
          } catch {
            setHtml(text);
          }
        }
      })
      .catch(() => setError('Failed to load receipt'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <Heart className="h-10 w-10 text-primary-600 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Receipt unavailable</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link to="/" className="text-primary-600 font-medium">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-3 flex justify-between items-center">
          <Link to="/" className="text-primary-600 font-medium text-sm">← PawTag</Link>
          <button
            onClick={() => window.print()}
            className="text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5"
          >
            Print / Save PDF
          </button>
        </div>
        <iframe
          title="Donation receipt"
          srcDoc={html}
          className="w-full bg-white rounded-xl border border-gray-200"
          style={{ minHeight: '70vh' }}
        />
      </div>
    </div>
  );
}
