import { useState, useEffect, useCallback } from 'react';
import { Phone, Mail, User, MapPin, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import type { LocationData, CaptchaChallenge } from '../types';
import { notifyOwner as apiNotifyOwner, fetchCaptcha } from '../lib/finderApi';

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

  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [captchaError, setCaptchaError] = useState('');

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    setCaptchaError('');
    try {
      const challenge = await fetchCaptcha();
      setCaptcha(challenge);
      setCaptchaAnswer('');
    } catch {
      setCaptchaError('Could not load verification challenge. Please try again.');
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showForm && !captcha) {
      loadCaptcha();
    }
  }, [showForm, captcha, loadCaptcha]);

  const handleSubmit = async () => {
    if (!finderPhone && !finderEmail) {
      setError('Please provide at least a phone number or email so the owner can contact you.');
      return;
    }
    if (!captcha || captchaAnswer === '') {
      setCaptchaError('Please answer the verification question.');
      return;
    }

    setLoading(true);
    setError('');
    setCaptchaError('');
    try {
      const payload: any = {
        finderName,
        finderPhone,
        finderEmail,
        captchaToken: captcha.token,
        captchaAnswer: parseInt(captchaAnswer, 10),
      };
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
      const msg = err.response?.data?.error || 'Failed to notify owner. Please try again.';
      if (msg.toLowerCase().includes('captcha')) {
        setCaptchaError(msg);
        loadCaptcha();
      } else {
        setError(msg);
      }
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
          {error && <div role="alert" className="bg-red-50 text-red-600 text-sm p-2 rounded">{error}</div>}
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

          {/* CAPTCHA challenge */}
          <div className="border border-gray-200 rounded-md p-3 space-y-2">
            <p className="text-xs text-gray-500 font-medium">Verification</p>
            {captchaLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 size={14} className="animate-spin" /> Loading challenge...
              </div>
            )}
            {captchaError && (
              <div role="alert" className="bg-red-50 text-red-600 text-sm p-2 rounded flex items-center justify-between">
                <span>{captchaError}</span>
                <button onClick={loadCaptcha} className="text-primary-600 hover:text-primary-700 ml-2" aria-label="Retry loading challenge">
                  <RefreshCw size={14} />
                </button>
              </div>
            )}
            {captcha && !captchaLoading && (
              <>
                <p className="text-sm text-gray-700 font-medium">{captcha.question}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    className="w-24 border rounded-md px-3 py-2 text-sm"
                    placeholder="Answer"
                    aria-label="CAPTCHA answer"
                  />
                  <button
                    type="button"
                    onClick={loadCaptcha}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label="Get new challenge"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </>
            )}
          </div>

          {location && (
            <div className="bg-blue-50 border border-blue-100 rounded-md p-2 text-xs text-blue-700 flex items-center gap-1.5">
              <MapPin size={12} /> Your location will be shared with the owner
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={loading || (!finderPhone && !finderEmail) || !captcha || captchaAnswer === ''}
              className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors disabled:opacity-50"
              aria-busy={loading}
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : <><CheckCircle size={16} /> Send Notification{location ? ' + Location' : ''}</>}
            </button>
            <button onClick={() => { setShowForm(false); setError(''); setCaptchaError(''); }} className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}
