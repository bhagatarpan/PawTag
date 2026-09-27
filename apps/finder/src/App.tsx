import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Routes, Route } from 'react-router-dom';
import { Phone, PawPrint, WifiOff, AlertTriangle } from 'lucide-react';
import { SiteAvailabilityStatus } from '@pawtag/shared';
import { useSiteSettings } from './hooks/useSiteSettings';
import { fetchTagData, fetchFoundTimer, fetchSystemStatus } from './lib/finderApi';
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

/**
 * Simple session cache for Finder data.
 * Stores the last loaded pet data in sessionStorage so page refreshes
 * don't require a full re-fetch. Cleared on tag change or manual refresh.
 */
const finderCache = new Map<string, { data: FinderData; timestamp: number }>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

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
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [notified, setNotified] = useState(false);
  const [foundTimer, setFoundTimer] = useState<FoundTimerData | null>(null);
  const [siteStatus, setSiteStatus] = useState<SiteAvailabilityStatus>(SiteAvailabilityStatus.ONLINE);

  // Location state
  const [locationConsent, setLocationConsent] = useState<'pending' | 'granted' | 'denied' | 'unavailable'>('pending');
  const [finderLocation, setFinderLocation] = useState<LocationData | null>(null);
  const [consentTimestamp, setConsentTimestamp] = useState<Date | null>(null);

  // Track if location was denied to avoid re-prompting
  const locationDeniedRef = useRef(false);

  const checkSiteStatus = useCallback(async () => {
    // Non-blocking — site status check should not prevent pet display
    fetchSystemStatus()
      .then((status) => setSiteStatus(status))
      .catch(() => {}); // Silently ignore failures
  }, []);

  useEffect(() => {
    checkSiteStatus();
    const interval = setInterval(checkSiteStatus, 30000);
    return () => clearInterval(interval);
  }, [checkSiteStatus]);

  const loadTagData = useCallback(async (id: string, forceRefresh = false) => {
    if (!id) { setError('No tag ID provided'); setLoading(false); return; }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = finderCache.get(id);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        setData(cached.data);
        setLoading(false);
        if (cached.data.pet.status === 'found') {
          loadFoundTimer(id);
        }
        return;
      }
    }

    try {
      const res = await fetchTagData(id);
      setData(res);
      // Cache the result
      finderCache.set(id, { data: res, timestamp: Date.now() });
      if (res.pet.status === 'found') {
        loadFoundTimer(id);
      }
      setError('');
      setIsNetworkError(false);
    } catch (err: any) {
      // Distinguish network errors from invalid tags
      const isNetwork = !err.response || err.code === 'ECONNABORTED' || err.message?.includes('network');
      setIsNetworkError(isNetwork);
      if (isNetwork) {
        setError('Unable to connect. Please check your internet connection and try again.');
      } else if (err.response?.status === 404) {
        setError('This tag was not found. Please check the QR code and try again.');
      } else {
        setError(err.response?.data?.error || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTagData(tagId || '');
  }, [tagId, loadTagData]);

  const loadFoundTimer = async (id: string) => {
    try {
      const timer = await fetchFoundTimer(id);
      setFoundTimer(timer);
    } catch { /* ignore */ }
  };

  const handleRetry = () => {
    setLoading(true);
    setError('');
    loadTagData(tagId || '', true);
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
      () => {
        setLocationConsent('denied');
        locationDeniedRef.current = true;
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleLocationDecline = () => {
    setLocationConsent('denied');
    locationDeniedRef.current = true;
    setConsentTimestamp(new Date());
  };

  const handleNotified = () => {
    setNotified(true);
    loadFoundTimer(tagId || '');
  };

  if (loading) return <FinderLoadingState />;
  if (error) return <FinderErrorState message={error} isNetworkError={isNetworkError} onRetry={handleRetry} />;
  if (!data) return null;

  // Handle expired tag
  if (data.tagActive === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle size={40} className="text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Tag Expired</h1>
          <p className="text-lg text-gray-600 mb-6">
            This PawTag is no longer active. No pet information is available for this tag.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            If you found a pet wearing this tag, please contact PawTag directly:
          </p>
          <a
            href="mailto:support@pawtag.co.nz"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
          >
            <Phone size={18} />
            Contact PawTag Support
          </a>
          <p className="text-xs text-gray-400 mt-8">PawTag — Reuniting lost pets with their families</p>
        </div>
      </div>
    );
  }

  // HYBRID 2: Handle limited tag (active period expired, no membership)
  if (data.tagLimited) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Limited Mode Banner */}
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                This tag's active period has expired
              </p>
              <p className="text-xs text-amber-600">
                The owner hasn't renewed their membership yet. You can see pet information, but cannot notify the owner.
              </p>
            </div>
          </div>
        </div>

        {/* Pet Information (limited - no owner contact) */}
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          {/* Status Banner */}
          <StatusBanner 
            status={data.pet.status} 
            tagId={data.tagId}
            tagStatus={data.tagStatus || 'limited'} 
          />

          {/* Pet Photo */}
          <PetPhotoCarousel photos={data.pet.photos || []} petName={data.pet.name} />

          {/* Medical Alerts */}
          {data.pet.medicalAlerts && (
            <MedicalAlertBanner message={data.pet.medicalAlerts} />
          )}

          {/* Pet Details */}
          <PetDetailsCard data={data} />

          {/* Limited Mode Notice */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">
                  Owner notifications are disabled
                </p>
                <p className="text-sm text-gray-600">
                  The owner of this pet hasn't renewed their PawTag membership. 
                  You can see the pet's information, but we cannot notify the owner that you found their pet.
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  If this is your pet, please contact PawTag directly at{' '}
                  <a href="mailto:support@pawtag.co.nz" className="text-primary-600 font-medium">
                    support@pawtag.co.nz
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Found Timer (if pet is found) */}
          {data.pet.status === 'found' && foundTimer && (
            <FoundTimer timer={foundTimer} />
          )}

          {/* Footer */}
          <div className="text-center pt-4 pb-8">
            <p className="text-xs text-gray-400">PawTag — Reuniting lost pets with their families</p>
          </div>
        </div>
      </div>
    );
  }

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
            photos={data.pet.photos || []}
            fallbackUrl={data.pet.photoUrl}
            petName={data.pet.name}
          />

          <PetDetailsCard data={data} />

          {data.pet.medicalAlerts && (
            <MedicalAlertBanner message={data.pet.medicalAlerts} />
          )}

          <div className="px-6 pb-6 space-y-3">
            {foundTimer && <FoundTimer timer={foundTimer} />}

            {/* Location and notify actions — blocked during maintenance or safe pet masking */}
            {!isMaintenance && !notified && !foundTimer?.active && !data.safePetMasking && (
              <LocationConsentBanner
                consent={locationConsent}
                hasLocation={!!finderLocation}
                onGrant={handleLocationGrant}
                onDecline={handleLocationDecline}
              />
            )}

            {!isMaintenance && !notified && !foundTimer?.active && !data.safePetMasking ? (
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
            ) : data.safePetMasking ? (
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 text-center text-primary-700 text-sm">
                This pet is safe and with its owner. No action needed.
              </div>
            ) : null}

            {data.ownerPhone && !data.safePetMasking && (
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
