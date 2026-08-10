import { useState } from 'react';
import { Phone, Mail, User, MapPin, CheckCircle, Loader2 } from 'lucide-react';
import type { LocationData } from '../types';
import { notifyOwner as apiNotifyOwner } from '../lib/finderApi';

interface NotifyOwnerFormProps {
  tagId: string;
  location: LocationData | null;
  locationConsent: string;
  consentTimestamp: Date | null;
  onNotified: () => void;
}

export default function NotifyOwnerForm({ tagId, location, locationConsent, consentTimestamp, onNotified }: NotifyOwnerFormProps) {
  const [showForm, setShowForm] = useState(false);
  const [finderName, setFinderName] = useState('');
  const [finderPhone, setFinderPhone] = useState('');
  const [finderEmail, setFinderEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!finderPhone && !finderEmail) {
      setError('Please provide at least a phone number or email so the owner can contact you.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload: any = { finderName, finderPhone, finderEmail };
      if (location) {
        payload.latitude = location.latitude;
        payload.longitude = location.longitude;
        payload.accuracy = location.accuracy;
      }
      payload.consent = {
        locationConsent: locationConsent === 'pending' ? 'skipped' : locationConsent,
        consentedAt: consentTimestamp?.toISOString() || new Date().toISOString(),
        consentVersion: '1.0',
      };
      await apiNotifyOwner(tagId, payload);
      onNotified();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to notify owner. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors"
        >
          <Phone size={18} /> Notify Owner I Found Their Pet
        </button>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Phone size={16} /> How will the owner contact you?
          </h3>
          <p className="text-sm text-gray-500">Please provide at least one way for the owner to reach you.</p>
          {error && <div className="bg-red-50 text-red-600 text-sm p-2 rounded">{error}</div>}
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1"><User size={12} /> Your Name (optional)</label>
              <input type="text" value={finderName} onChange={(e) => setFinderName(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="e.g. John" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1"><Phone size={12} /> Mobile Number</label>
              <input type="tel" value={finderPhone} onChange={(e) => setFinderPhone(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="e.g. 021 123 4567" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1"><Mail size={12} /> Email Address</label>
              <input type="email" value={finderEmail} onChange={(e) => setFinderEmail(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="e.g. john@example.com" />
            </div>
          </div>
          {location && (
            <div className="bg-blue-50 border border-blue-100 rounded-md p-2 text-xs text-blue-700 flex items-center gap-1.5">
              <MapPin size={12} /> Your location will be shared with the owner
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleSubmit} disabled={loading || (!finderPhone && !finderEmail)} className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors disabled:opacity-50">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : <><CheckCircle size={16} /> Send Notification{location ? ' + Location' : ''}</>}
            </button>
            <button onClick={() => { setShowForm(false); setError(''); }} className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}
