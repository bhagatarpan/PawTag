import { useState } from 'react';
import { Phone, Mail, User, MapPin, CheckCircle, Loader2, MessageCircle } from 'lucide-react';
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
    <div className="mx-4 mt-4 space-y-3">
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full bg-gradient-to-r from-teal-500 to-teal-600 text-white py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 hover:from-teal-600 hover:to-teal-700 transition-all duration-200 shadow-lg shadow-teal-500/25"
        >
          <MessageCircle size={18} /> I Found This Pet
        </button>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
              <Phone size={18} className="text-teal-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Contact the Owner</h3>
              <p className="text-xs text-gray-500">Provide at least one way to reach you</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl flex items-center gap-2">
              <span className="text-red-500">!</span> {error}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                <User size={12} /> Your Name
              </label>
              <input 
                type="text" 
                value={finderName} 
                onChange={(e) => setFinderName(e.target.value)} 
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" 
                placeholder="e.g. John" 
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                <Phone size={12} /> Mobile Number
              </label>
              <input 
                type="tel" 
                value={finderPhone} 
                onChange={(e) => setFinderPhone(e.target.value)} 
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" 
                placeholder="e.g. 021 123 4567" 
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                <Mail size={12} /> Email Address
              </label>
              <input 
                type="email" 
                value={finderEmail} 
                onChange={(e) => setFinderEmail(e.target.value)} 
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" 
                placeholder="e.g. john@example.com" 
              />
            </div>
          </div>

          {location && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 flex items-center gap-2">
              <MapPin size={14} className="text-blue-500" /> 
              <span className="font-medium">Your location will be shared with the owner</span>
            </div>
          )}

          <div className="flex gap-2">
            <button 
              onClick={handleSubmit} 
              disabled={loading || (!finderPhone && !finderEmail)} 
              className="flex-1 bg-gradient-to-r from-teal-500 to-teal-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:from-teal-600 hover:to-teal-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Sending...</>
              ) : (
                <><CheckCircle size={16} /> Send{location ? ' + Location' : ''}</>
              )}
            </button>
            <button 
              onClick={() => { setShowForm(false); setError(''); }} 
              className="px-5 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
