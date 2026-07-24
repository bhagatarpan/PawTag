import { useState, useEffect } from 'react';
import { useParams, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import { PawPrint, Phone, MapPin, AlertTriangle, Loader2, CheckCircle, ChevronLeft, ChevronRight, ShieldAlert, ShieldCheck, Clock, Mail, User } from 'lucide-react';
import { useSiteSettings } from './hooks/useSiteSettings';

interface PetPhoto {
  url: string;
  caption?: string;
  isMain: boolean;
}

interface FinderData {
  pet: {
    name: string;
    petId?: string;
    petType?: string;
    species: string;
    breed: string;
    secondaryBreed?: string;
    color: string;
    pattern?: string;
    gender?: string;
    age?: number;
    favouriteFood?: string;
    photos: PetPhoto[];
    photoUrl?: string;
    medicalAlerts?: string;
    status: string;
  };
  tagId: string;
  tagStatus?: string;
  ownerName: string;
  ownerPhone?: string;
}

function FinderPage() {
  const { tagId } = useParams<{ tagId: string }>();
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';
  const [data, setData] = useState<FinderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notified, setNotified] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [locationShared, setLocationShared] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [showContactForm, setShowContactForm] = useState(false);
  const [finderName, setFinderName] = useState('');
  const [finderPhone, setFinderPhone] = useState('');
  const [finderEmail, setFinderEmail] = useState('');
  const [contactError, setContactError] = useState('');
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [foundTimer, setFoundTimer] = useState<{ active: boolean; foundAt?: string; elapsed?: number; finderPhone?: string; finderEmail?: string; finderName?: string } | null>(null);
  const [timerDisplay, setTimerDisplay] = useState('');

  const apiBase = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    if (!tagId) { setError('No tag ID provided'); setLoading(false); return; }
    axios
      .get(`${apiBase}/finder/${tagId}`)
      .then((res) => {
        setData(res.data.data);
        // Check if pet is in 'found' status and load timer
        if (res.data.data.pet.status === 'found') {
          loadFoundTimer();
        }
      })
      .catch((err) => setError(err.response?.data?.error || 'Tag not found'))
      .finally(() => setLoading(false));
  }, [tagId]);

  const loadFoundTimer = async () => {
    if (!tagId) return;
    try {
      const res = await axios.get(`${apiBase}/finder/${tagId}/found-timer`);
      setFoundTimer(res.data.data);
    } catch { /* ignore */ }
  };

  // Timer display updater
  useEffect(() => {
    if (!foundTimer?.active || !foundTimer.foundAt) return;
    const updateTimer = () => {
      const elapsed = Date.now() - new Date(foundTimer.foundAt!).getTime();
      const hours = Math.floor(elapsed / (1000 * 60 * 60));
      const mins = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((elapsed % (1000 * 60)) / 1000);
      setTimerDisplay(`${hours}h ${mins}m ${secs}s`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [foundTimer]);

  const notifyOwner = async () => {
    if (!tagId) return;
    if (!finderPhone && !finderEmail) {
      setContactError('Please provide at least a phone number or email so the owner can contact you.');
      return;
    }
    setNotifyLoading(true);
    setContactError('');
    try {
      await axios.post(`${apiBase}/finder/${tagId}/notify`, {
        finderName,
        finderPhone,
        finderEmail,
      });
      setNotified(true);
      setShowContactForm(false);
      loadFoundTimer();
    } catch (err: any) {
      setContactError(err.response?.data?.error || 'Failed to notify owner. Please try again.');
    } finally { setNotifyLoading(false); }
  };

  const shareLocation = async () => {
    if (!tagId || !navigator.geolocation) return;
    setSharing(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await axios.post(`${apiBase}/finder/${tagId}/share-location`, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          setLocationShared(true);
        } catch { alert('Failed to share location.'); }
        setSharing(false);
      },
      () => { alert('Could not get your location. Please enable GPS.'); setSharing(false); },
      { enableHighAccuracy: true },
    );
  };

  // Resolve photos and main photo
  const petPhotos: PetPhoto[] = data?.pet?.photos || [];
  const hasPhotos = petPhotos.length > 0;
  const mainPhoto = hasPhotos
    ? (petPhotos.find((p) => p.isMain) || petPhotos[0])
    : null;
  const displayPhotoUrl = mainPhoto?.url || data?.pet?.photoUrl;
  const _currentPhoto = hasPhotos ? petPhotos[photoIdx] : null;

  const formatBreed = () => {
    if (!data) return '';
    if (data.pet.breed === 'Mixed Breed' && data.pet.secondaryBreed) {
      return `Mixed Breed (${data.pet.secondaryBreed})`;
    }
    return data.pet.breed;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-md p-8 max-w-md text-center">
          <PawPrint size={48} className="text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Tag Not Found</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={`min-h-screen py-8 px-4 ${data.pet.status === 'lost' ? 'bg-red-50' : data.pet.status === 'found' ? 'bg-amber-50' : 'bg-gray-50'}`}>
      <div className="max-w-md mx-auto">

        {/* BIG STATUS BANNER */}
        {data.pet.status === 'lost' && (
          <div className="bg-red-600 text-white rounded-xl p-6 mb-6 text-center shadow-lg animate-pulse">
            <ShieldAlert size={56} className="mx-auto mb-2" />
            <h1 className="text-4xl font-extrabold tracking-wide">THIS PET IS LOST</h1>
            <p className="text-red-100 text-base mt-2">If you know this pet, please contact the owner immediately or use the options below.</p>
          </div>
        )}
        {data.pet.status === 'found' && (
          <div className="bg-amber-500 text-white rounded-xl p-6 mb-6 text-center shadow-lg">
            <ShieldCheck size={56} className="mx-auto mb-2" />
            <h1 className="text-4xl font-extrabold tracking-wide">PET FOUND</h1>
            <p className="text-amber-100 text-base mt-2">This pet has been reported as found. Please help reunite it with its owner.</p>
          </div>
        )}
        {data.pet.status === 'safe' && (
          <div className="bg-green-600 text-white rounded-xl p-6 mb-6 text-center shadow-lg">
            <ShieldCheck size={56} className="mx-auto mb-2" />
            <h1 className="text-3xl font-bold">Pet Information</h1>
            <p className="text-green-100 text-base mt-1">This pet is safe and with its owner.</p>
          </div>
        )}

        <div className="text-center mb-4">
          <PawPrint size={28} className="text-primary-600 mx-auto mb-1" />
          <p className="text-sm text-gray-500">Tag: <span className="font-mono font-medium">{data.tagId}</span>
            {data.tagStatus && (
              <span className={`ml-2 inline-block px-2 py-0.5 text-xs font-bold rounded-full ${
                data.tagStatus === 'active' ? 'bg-green-100 text-green-700' :
                data.tagStatus === 'lost' ? 'bg-red-200 text-red-800' :
                'bg-gray-200 text-gray-700'
              }`}>{data.tagStatus.toUpperCase()}</span>
            )}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {/* Photo section */}
          {displayPhotoUrl && (
            <div className="relative">
              <img
                src={displayPhotoUrl}
                alt={data.pet.name}
                className="w-full h-56 object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              {/* Photo navigation */}
              {hasPhotos && petPhotos.length > 1 && (
                <>
                  <button
                    onClick={() => setPhotoIdx((i) => (i === 0 ? petPhotos.length - 1 : i - 1))}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={() => setPhotoIdx((i) => (i === petPhotos.length - 1 ? 0 : i + 1))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {petPhotos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setPhotoIdx(i)}
                        className={`w-2 h-2 rounded-full transition-colors ${i === photoIdx ? 'bg-white' : 'bg-white/50'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="p-6">
            <h2 className="text-2xl font-bold mb-1">{data.pet.name}</h2>
            {data.pet.petId && <p className="text-sm font-mono text-gray-400 mb-1">ID: {data.pet.petId}</p>}
            <p className="text-base text-gray-600 mb-2">{data.pet.petType || data.pet.species} — {formatBreed()} ({data.pet.color}{data.pet.pattern ? `, ${data.pet.pattern}` : ''})</p>
            <div className="flex flex-wrap gap-2 mb-4 text-base text-gray-500">
              {data.pet.gender && data.pet.gender !== 'unknown' && <span>Gender: {data.pet.gender === 'male' ? 'Male' : 'Female'}</span>}
              {data.pet.age != null && <span>Age: {data.pet.age} yrs</span>}
              {data.pet.favouriteFood && <span>Fav Food: {data.pet.favouriteFood}</span>}
            </div>

            {data.pet.medicalAlerts && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertTriangle size={20} className="text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-base font-medium text-red-700">Medical Alert</p>
                  <p className="text-base text-red-600">{data.pet.medicalAlerts}</p>
                </div>
              </div>
            )}

            <p className="text-base text-gray-500 mb-4">Owner: {data.ownerName}</p>

            <div className="space-y-3">
              {/* Found Timer */}
              {foundTimer?.active && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-blue-700 mb-1">
                    <Clock size={18} />
                    <span className="font-semibold">Pet Found — Waiting for Owner</span>
                  </div>
                  <p className="text-2xl font-mono font-bold text-blue-800">{timerDisplay}</p>
                  <p className="text-xs text-blue-600 mt-1">since notification was sent</p>
                  {foundTimer.finderName && (
                    <p className="text-xs text-blue-500 mt-2">Finder: {foundTimer.finderName}</p>
                  )}
                </div>
              )}

              {/* Notify Owner */}
              {!notified && !foundTimer?.active ? (
                <>
                  {!showContactForm ? (
                    <button onClick={() => setShowContactForm(true)} className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors">
                      <Phone size={18} /> Notify Owner I Found Their Pet
                    </button>
                  ) : (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                      <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <Phone size={16} /> How will the owner contact you?
                      </h3>
                      <p className="text-sm text-gray-500">Please provide at least one way for the owner to reach you.</p>
                      {contactError && <div className="bg-red-50 text-red-600 text-sm p-2 rounded">{contactError}</div>}
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
                      <div className="flex gap-2">
                        <button onClick={notifyOwner} disabled={notifyLoading || (!finderPhone && !finderEmail)} className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors disabled:opacity-50">
                          {notifyLoading ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : <><CheckCircle size={16} /> Send Notification</>}
                        </button>
                        <button onClick={() => { setShowContactForm(false); setContactError(''); }} className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
                      </div>
                    </div>
                  )}
                </>
              ) : notified ? (
                <div className="bg-green-50 text-green-700 py-3 rounded-lg text-center flex items-center justify-center gap-2">
                  <CheckCircle size={18} /> Owner has been notified! Thank you for helping.
                </div>
              ) : null}

              {!locationShared ? (
                <button onClick={shareLocation} disabled={sharing} className="w-full border border-primary-600 text-primary-700 py-3 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-primary-50 transition-colors disabled:opacity-50">
                  <MapPin size={18} /> {sharing ? 'Getting location...' : 'Share My Location'}
                </button>
              ) : (
                <div className="bg-green-50 text-green-700 py-3 rounded-lg text-center flex items-center justify-center gap-2">
                  <CheckCircle size={18} /> Location shared with owner!
                </div>
              )}

              {data.ownerPhone && (
                <a href={`tel:${data.ownerPhone}`} className="block w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-medium text-center hover:bg-gray-50 transition-colors">
                  Call Owner: {data.ownerPhone}
                </a>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by {companyName} - Helping reunite lost pets with their families
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';
  return (
    <Routes>
      <Route path="/:tagId" element={<FinderPage />} />
      <Route path="*" element={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <PawPrint size={48} className="text-primary-600 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">{companyName} Finder</h1>
            <p className="text-gray-500">Scan a QR code to view a lost pet's information.</p>
          </div>
        </div>
      } />
    </Routes>
  );
}
