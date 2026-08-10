import { useState, useEffect } from 'react';
import { useParams, Routes, Route } from 'react-router-dom';
import { Phone, PawPrint, Heart, Shield, MapPin, MessageCircle, Loader2 } from 'lucide-react';
import { useSiteSettings } from './hooks/useSiteSettings';
import { fetchTagData, fetchFoundTimer, notifyOwner as apiNotifyOwner } from './lib/finderApi';
import type { FinderData, FoundTimerData, LocationData, Vaccination, Microchip } from './types';
import FinderLoadingState from './components/FinderLoadingState';
import FinderErrorState from './components/FinderErrorState';

/* ------------------------------------------------------------------ */
/*  Helper Functions                                                   */
/* ------------------------------------------------------------------ */

function formatBreed(data: FinderData): string {
  const origin = data.pet.breedOrigin || 'Pure breed';
  const breed = data.pet.breed || '';
  const secondary = data.pet.secondaryBreed || '';
  if (origin === 'Unknown') return 'Unknown';
  if ((origin === 'Mixed Breed' || origin === 'Designer Breed') && secondary && secondary !== 'Unknown') {
    return `${origin === 'Designer Breed' ? 'Designer' : 'Mixed'} (${breed} × ${secondary})`;
  }
  if (origin === 'Landrace') return `${breed} (Landrace)`;
  return breed;
}

function timeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/* ------------------------------------------------------------------ */
/*  Status Config                                                      */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG = {
  lost: {
    bg: 'bg-gradient-to-b from-red-600 to-red-700',
    badge: 'bg-red-500 text-white',
    icon: <Shield size={20} />,
    title: 'LOST PET',
    subtitle: 'Contact owner immediately',
    pulse: true,
  },
  found: {
    bg: 'bg-gradient-to-b from-amber-500 to-amber-600',
    badge: 'bg-amber-500 text-white',
    icon: <Heart size={20} />,
    title: 'PET FOUND',
    subtitle: 'Help reunite with owner',
    pulse: false,
  },
  safe: {
    bg: 'bg-gradient-to-b from-emerald-500 to-emerald-600',
    badge: 'bg-emerald-500 text-white',
    icon: <PawPrint size={20} />,
    title: 'SAFE & SOUND',
    subtitle: 'This pet is with its owner',
    pulse: false,
  },
};

/* ------------------------------------------------------------------ */
/*  Finder Page                                                        */
/* ------------------------------------------------------------------ */

function FinderPage() {
  const { tagId } = useParams<{ tagId: string }>();
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';

  const [data, setData] = useState<FinderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notified, setNotified] = useState(false);
  const [foundTimer, setFoundTimer] = useState<FoundTimerData | null>(null);

  // Location state
  const [locationConsent, setLocationConsent] = useState<'pending' | 'granted' | 'denied' | 'unavailable'>('pending');
  const [finderLocation, setFinderLocation] = useState<LocationData | null>(null);
  const [consentTimestamp, setConsentTimestamp] = useState<Date | null>(null);

  // Notify form state
  const [showForm, setShowForm] = useState(false);
  const [finderName, setFinderName] = useState('');
  const [finderPhone, setFinderPhone] = useState('');
  const [finderEmail, setFinderEmail] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tagId) { setError('No tag ID provided'); setLoading(false); return; }
    fetchTagData(tagId)
      .then((res) => {
        setData(res);
        if (res.pet.status === 'found') loadFoundTimer();
      })
      .catch((err) => setError(err.response?.data?.error || 'Tag not found'))
      .finally(() => setLoading(false));
  }, [tagId]);

  const loadFoundTimer = async () => {
    if (!tagId) return;
    try { setFoundTimer(await fetchFoundTimer(tagId)); } catch {}
  };

  const handleLocationGrant = () => {
    if (!navigator.geolocation) { setLocationConsent('unavailable'); setConsentTimestamp(new Date()); return; }
    setLocationConsent('granted');
    setConsentTimestamp(new Date());
    navigator.geolocation.getCurrentPosition(
      (pos) => setFinderLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => setLocationConsent('denied'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSubmit = async () => {
    if (!finderPhone && !finderEmail) { setFormError('Please provide at least a phone or email.'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      const payload: any = { finderName, finderPhone, finderEmail };
      if (finderLocation) { payload.latitude = finderLocation.latitude; payload.longitude = finderLocation.longitude; payload.accuracy = finderLocation.accuracy; }
      payload.consent = { locationConsent: locationConsent === 'pending' ? 'skipped' : locationConsent, consentedAt: consentTimestamp?.toISOString() || new Date().toISOString(), consentVersion: '1.0' };
      await apiNotifyOwner(tagId!, payload);
      setNotified(true);
      loadFoundTimer();
    } catch (err: any) { setFormError(err.response?.data?.error || 'Failed to notify owner.'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <FinderLoadingState />;
  if (error) return <FinderErrorState message={error} />;
  if (!data) return null;

  const { pet } = data;
  const config = STATUS_CONFIG[pet.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.safe;
  const mainPhoto = pet.photos?.find(p => p.isMain) || pet.photos?.[0];
  const photoUrl = mainPhoto?.url || pet.photoUrl;
  const vaccinations = pet.vaccinations || [];
  const microchips = pet.microchips || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section with Photo */}
      <div className="relative">
        {/* Status Header */}
        <div className={`${config.bg} text-white px-5 py-4`}>
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center ${config.pulse ? 'animate-pulse' : ''}`}>
                {config.icon}
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">{config.title}</h1>
                <p className="text-white/80 text-xs">{config.subtitle}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/60 uppercase tracking-wider">Tag</p>
              <p className="text-sm font-mono font-bold">{data.tagId}</p>
            </div>
          </div>
        </div>

        {/* Pet Photo */}
        <div className="relative h-80 bg-gray-900">
          {photoUrl ? (
            <img src={photoUrl} alt={pet.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <PawPrint size={64} className="text-gray-600" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          
          {/* Pet Name Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="max-w-lg mx-auto">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-white">{pet.name}</h2>
                  {pet.petId && <p className="text-white/60 text-xs font-mono mt-0.5">{pet.petId}</p>}
                </div>
                <div className="flex gap-2">
                  {pet.gender && pet.gender !== 'unknown' && (
                    <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full">
                      {pet.gender === 'male' ? '♂ Male' : '♀ Female'}
                    </span>
                  )}
                  {pet.age != null && (
                    <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full">
                      {pet.age} yrs
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto">
        {/* Pet Info Card */}
        <div className="px-4 -mt-6 relative z-10">
          <div className="bg-white rounded-2xl shadow-xl p-5">
            {/* Breed */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">{pet.petType || pet.species}</span>
                <span className="mx-2 text-gray-300">|</span>
                {formatBreed(data)}
              </p>
              <p className="text-xs text-gray-500 mt-1">{pet.color}{pet.pattern ? `, ${pet.pattern}` : ''}</p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {pet.gender && pet.gender !== 'unknown' && (
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Gender</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{pet.gender === 'male' ? 'Male' : 'Female'}</p>
                </div>
              )}
              {pet.age != null && (
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Age</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{pet.age} yrs</p>
                </div>
              )}
              {pet.favouriteFood && (
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Food</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5 truncate">{pet.favouriteFood}</p>
                </div>
              )}
            </div>

            {/* Owner */}
            <div className="flex items-center gap-3 py-3 border-t border-gray-100">
              <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
                <PawPrint size={16} className="text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Owner</p>
                <p className="text-sm font-semibold text-gray-800">{data.ownerName}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Vaccinations & Microchips */}
        {(vaccinations.length > 0 || microchips.length > 0) && (
          <div className="px-4 mt-4">
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
              {vaccinations.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Vaccinations</p>
                  <div className="flex flex-wrap gap-1.5">
                    {vaccinations.map((vax, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-medium">
                        {vax.vaccine}
                        {vax.vaccineType && vax.vaccineType !== 'core' && (
                          <span className="bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded text-[10px]">
                            {vax.vaccineType === 'non-core' ? 'Non-core' : 'Other'}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {microchips.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Microchip</p>
                  <div className="flex flex-wrap gap-1.5">
                    {microchips.map((chip, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-medium">
                        <span className="font-mono">{chip.chipNumber}</span>
                        {chip.brand && <span className="text-blue-500 text-[10px]">({chip.brand})</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Medical Alert */}
        {pet.medicalAlerts && (
          <div className="px-4 mt-4">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-red-600 text-lg">⚠</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Medical Alert</p>
                  <p className="text-sm text-red-700 mt-0.5">{pet.medicalAlerts}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="px-4 mt-6 space-y-3 pb-8">
          {/* Found Timer */}
          {foundTimer?.active && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
              <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Time Since Found</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">
                {foundTimer.elapsed ? `${Math.floor(foundTimer.elapsed / 3600)}h ${Math.floor((foundTimer.elapsed % 3600) / 60)}m` : 'Calculating...'}
              </p>
            </div>
          )}

          {/* Notified Success */}
          {notified ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Heart size={24} className="text-emerald-600" />
              </div>
              <p className="font-bold text-emerald-800">Owner Notified!</p>
              <p className="text-sm text-emerald-600 mt-1">Thank you for helping reunite this pet.</p>
            </div>
          ) : !foundTimer?.active ? (
            <>
              {/* Location Consent */}
              {locationConsent === 'pending' && navigator.geolocation && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <MapPin size={18} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-800">Share your location?</p>
                      <p className="text-xs text-blue-600 mt-0.5">Help the owner know where to find their pet.</p>
                      <div className="flex gap-2 mt-3">
                        <button onClick={handleLocationGrant} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors">
                          Share Location
                        </button>
                        <button onClick={() => { setLocationConsent('denied'); setConsentTimestamp(new Date()); }} className="px-4 py-2 border border-gray-300 rounded-xl text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                          Skip
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {locationConsent === 'granted' && finderLocation && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 py-2.5 px-4 rounded-xl text-xs font-medium flex items-center gap-2">
                  <MapPin size={14} /> Location captured
                </div>
              )}

              {/* Notify Button / Form */}
              {!showForm ? (
                <button onClick={() => setShowForm(true)} className="w-full bg-gradient-to-r from-teal-500 to-teal-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:from-teal-600 hover:to-teal-700 transition-all shadow-lg shadow-teal-500/25">
                  <MessageCircle size={20} /> Notify Owner I Found Their Pet
                </button>
              ) : (
                <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
                  <div>
                    <h3 className="font-bold text-gray-800">How will the owner contact you?</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Provide at least one way to reach you.</p>
                  </div>

                  {formError && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl">{formError}</div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Your Name (optional)</label>
                      <input type="text" value={finderName} onChange={(e) => setFinderName(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" placeholder="e.g. John" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Mobile Number</label>
                      <input type="tel" value={finderPhone} onChange={(e) => setFinderPhone(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" placeholder="e.g. 021 123 4567" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Email Address</label>
                      <input type="email" value={finderEmail} onChange={(e) => setFinderEmail(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" placeholder="e.g. john@example.com" />
                    </div>
                  </div>

                  {finderLocation && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 flex items-center gap-2">
                      <MapPin size={14} /> Your location will be shared
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={handleSubmit} disabled={submitting || (!finderPhone && !finderEmail)} className="flex-1 bg-gradient-to-r from-teal-500 to-teal-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:from-teal-600 hover:to-teal-700 transition-all disabled:opacity-50">
                      {submitting ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : 'Send Notification'}
                    </button>
                    <button onClick={() => { setShowForm(false); setFormError(''); }} className="px-5 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors font-medium">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}

          {/* Call Owner */}
          {data.ownerPhone && (
            <a href={`tel:${data.ownerPhone}`} className="block w-full border-2 border-gray-200 text-gray-700 py-4 rounded-2xl font-bold text-center hover:bg-gray-50 hover:border-gray-300 transition-all">
              Call Owner: {data.ownerPhone}
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="text-center pb-8">
          <div className="inline-flex items-center gap-1.5 text-xs text-gray-400">
            <PawPrint size={12} />
            Powered by {companyName}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  App Root                                                           */
/* ------------------------------------------------------------------ */

export default function App() {
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';
  return (
    <Routes>
      <Route path="/:tagId" element={<FinderPage />} />
      <Route path="*" element={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center mx-auto mb-6">
              <PawPrint size={40} className="text-teal-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{companyName} Finder</h1>
            <p className="text-gray-500">Scan a QR code to view a pet's information.</p>
          </div>
        </div>
      } />
    </Routes>
  );
}
