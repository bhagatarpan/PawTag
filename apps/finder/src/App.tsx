import { useState, useEffect, useCallback } from 'react';
import { useParams, Routes, Route } from 'react-router-dom';
import { Phone, PawPrint, WifiOff, AlertTriangle } from 'lucide-react';
import { SiteAvailabilityStatus } from '@pawtag/shared';
import { useSiteSettings } from './hooks/useSiteSettings';
import { fetchTagData, fetchFoundTimer, fetchSystemStatus } from './lib/finderApi';
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


function OfflineScreen({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <WifiOff size={40} className="text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{title}</h1>
        <p className="text-lg text-gray-600 mb-6">{message}</p>
        <p className="text-sm text-gray-400">PawTag — Reuniting lost pets with their families</p>
      </div>
    </div>
  );
}

function FinderPage() {
  const { tagId } = useParams<{ tagId: string }>();
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';

  const [data, setData] = useState<FinderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notified, setNotified] = useState(false);
  const [foundTimer, setFoundTimer] = useState<FoundTimerData | null>(null);
  const [siteStatus, setSiteStatus] = useState<SiteAvailabilityStatus>(SiteAvailabilityStatus.ONLINE);

  // Location state
  const [locationConsent, setLocationConsent] = useState<'pending' | 'granted' | 'denied' | 'unavailable'>('pending');
  const [finderLocation, setFinderLocation] = useState<LocationData | null>(null);
  const [consentTimestamp, setConsentTimestamp] = useState<Date | null>(null);

  const checkSiteStatus = useCallback(async () => {
    const status = await fetchSystemStatus();
    setSiteStatus(status);
  }, []);

  useEffect(() => {
    checkSiteStatus();
    const interval = setInterval(checkSiteStatus, 30000);
    return () => clearInterval(interval);
  }, [checkSiteStatus]);

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

  const isMaintenance = siteStatus === SiteAvailabilityStatus.MAINTENANCE;
  const bgColor = data.pet.status === 'lost' ? 'bg-red-50' : data.pet.status === 'found' ? 'bg-amber-50' : 'bg-gray-50';

  return (
    <div className={`min-h-screen py-8 px-4 ${bgColor}`}>
      <div className="max-w-md mx-auto">
        {/* Maintenance warning for finder */}
        {isMaintenance && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">PawTag is under maintenance</p>
              <p className="text-sm text-amber-700 mt-1">
                You can view pet information, but actions like notifying the owner are temporarily unavailable.
              </p>
            </div>
          </div>
        )}

        <StatusBanner status={data.pet.status} tagId={data.tagId} tagStatus={data.tagStatus} />

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

            {/* Location and notify actions — blocked during maintenance */}
            {!isMaintenance && !notified && !foundTimer?.active && (
              <LocationConsentBanner
                consent={locationConsent}
                hasLocation={!!finderLocation}
                onGrant={handleLocationGrant}
                onDecline={handleLocationDecline}
              />
            )}

            {!isMaintenance && !notified && !foundTimer?.active ? (
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
            ) : isMaintenance ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-500 text-sm">
                Actions are temporarily unavailable during maintenance.
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

function FinderOfflineScreen() {
  return (
    <Routes>
      <Route path="*" element={
        <OfflineScreen
          title="PawTag is currently offline"
          message="Please come back later."
        />
      } />
    </Routes>
  );
}

export default function App() {
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';
  const [siteStatus, setSiteStatus] = useState<SiteAvailabilityStatus>(SiteAvailabilityStatus.ONLINE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSystemStatus()
      .then((status) => setSiteStatus(status))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (siteStatus === SiteAvailabilityStatus.OFFLINE) {
    return <FinderOfflineScreen />;
  }

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
