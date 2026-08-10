import { useState, useEffect } from 'react';
import { useParams, Routes, Route } from 'react-router-dom';
import { Phone, PawPrint } from 'lucide-react';
import { useSiteSettings } from './hooks/useSiteSettings';
import { fetchTagData, fetchFoundTimer } from './lib/finderApi';
import type { FinderData, FoundTimerData, LocationData } from './types';
import StatusBanner from './components/StatusBanner';
import PetPhotoCarousel from './components/PetPhotoCarousel';
import PetDetailsCard from './components/PetDetailsCard';
import MedicalAlertBanner from './components/MedicalAlertBanner';
import LocationConsentBanner from './components/LocationConsentBanner';
import NotifyOwnerForm from './components/NotifyOwnerForm';
import FoundTimer from './components/FoundTimer';
import FinderLoadingState from './components/FinderLoadingState';
import FinderErrorState from './components/FinderErrorState';
import TagInfoHeader from './components/TagInfoHeader';

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

  useEffect(() => {
    if (!tagId) { setError('No tag ID provided'); setLoading(false); return; }
    fetchTagData(tagId)
      .then((res) => {
        setData(res);
        if (res.pet.status === 'found') {
          loadFoundTimer();
        }
      })
      .catch((err) => setError(err.response?.data?.error || 'Tag not found'))
      .finally(() => setLoading(false));
  }, [tagId]);

  const loadFoundTimer = async () => {
    if (!tagId) return;
    try {
      const timer = await fetchFoundTimer(tagId);
      setFoundTimer(timer);
    } catch { /* ignore */ }
  };

  const handleLocationGrant = () => {
    if (!navigator.geolocation) {
      setLocationConsent('unavailable');
      setConsentTimestamp(new Date());
      return;
    }
    setLocationConsent('granted');
    setConsentTimestamp(new Date());
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFinderLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => { setLocationConsent('denied'); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleLocationDecline = () => {
    setLocationConsent('denied');
    setConsentTimestamp(new Date());
  };

  const handleNotified = () => {
    setNotified(true);
    loadFoundTimer();
  };

  if (loading) return <FinderLoadingState />;
  if (error) return <FinderErrorState message={error} />;
  if (!data) return null;

  const bgClass = data.pet.status === 'lost' 
    ? 'bg-gradient-to-br from-red-50 via-white to-red-50' 
    : data.pet.status === 'found' 
      ? 'bg-gradient-to-br from-amber-50 via-white to-amber-50' 
      : 'bg-gradient-to-br from-emerald-50 via-white to-emerald-50';

  return (
    <div className={`min-h-screen ${bgClass}`}>
      <div className="max-w-md mx-auto pb-8">
        {/* Status Banner */}
        <div className="px-4 pt-6">
          <StatusBanner status={data.pet.status} />
        </div>

        {/* Tag Info */}
        <TagInfoHeader tagId={data.tagId} tagStatus={data.tagStatus} />

        {/* Photo */}
        <PetPhotoCarousel
          photos={data.pet.photos}
          fallbackUrl={data.pet.photoUrl}
          petName={data.pet.name}
        />

        {/* Pet Details (Floating Card) */}
        <PetDetailsCard data={data} />

        {/* Medical Alert */}
        {data.pet.medicalAlerts && (
          <MedicalAlertBanner message={data.pet.medicalAlerts} />
        )}

        {/* Actions Section */}
        <div className="px-4 mt-6 space-y-3">
          {foundTimer && <FoundTimer timer={foundTimer} />}

          {!notified && !foundTimer?.active && (
            <LocationConsentBanner
              consent={locationConsent}
              hasLocation={!!finderLocation}
              onGrant={handleLocationGrant}
              onDecline={handleLocationDecline}
            />
          )}

          {!notified && !foundTimer?.active ? (
            <NotifyOwnerForm
              tagId={tagId!}
              location={finderLocation}
              locationConsent={locationConsent}
              consentTimestamp={consentTimestamp}
              onNotified={handleNotified}
            />
          ) : notified ? (
            <div className="mx-4 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 text-emerald-700 py-4 rounded-xl text-center flex items-center justify-center gap-2 shadow-sm">
              <Phone size={18} /> 
              <span className="font-semibold">Owner notified! Thank you for helping.</span>
            </div>
          ) : null}

          {data.ownerPhone && (
            <div className="px-4">
              <a
                href={`tel:${data.ownerPhone}`}
                className="block w-full border-2 border-gray-200 text-gray-700 py-3.5 rounded-xl font-semibold text-center hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
              >
                Call Owner: {data.ownerPhone}
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs text-gray-400">
            <PawPrint size={12} />
            Powered by {companyName}
          </div>
        </div>
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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
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
