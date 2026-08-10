import { useState, useEffect } from 'react';
import { useParams, Routes, Route } from 'react-router-dom';
import { Phone, PawPrint } from 'lucide-react';
import { useSiteSettings } from './hooks/useSiteSettings';
import { fetchTagData, fetchFoundTimer } from './lib/finderApi';
import type { FinderData, FoundTimerData, LocationData, PetPhoto } from './types';
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

  const bgColor = data.pet.status === 'lost' ? 'bg-red-50' : data.pet.status === 'found' ? 'bg-amber-50' : 'bg-gray-50';

  return (
    <div className={`min-h-screen py-8 px-4 ${bgColor}`}>
      <div className="max-w-md mx-auto">
        <StatusBanner status={data.pet.status} />

        <TagInfoHeader tagId={data.tagId} tagStatus={data.tagStatus} />

        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <PetPhotoCarousel
            photos={data.pet.photos}
            fallbackUrl={data.pet.photoUrl}
            petName={data.pet.name}
          />

          <PetDetailsCard data={data} />

          {data.pet.medicalAlerts && (
            <MedicalAlertBanner message={data.pet.medicalAlerts} />
          )}

          <div className="px-6 pb-6 space-y-3">
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
              <div className="bg-green-50 text-green-700 py-3 rounded-lg text-center flex items-center justify-center gap-2">
                <Phone size={18} /> Owner has been notified! Thank you for helping.
              </div>
            ) : null}

            {data.ownerPhone && (
              <a
                href={`tel:${data.ownerPhone}`}
                className="block w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-medium text-center hover:bg-gray-50 transition-colors"
              >
                Call Owner: {data.ownerPhone}
              </a>
            )}
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
