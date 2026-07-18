import { useState, useEffect } from 'react';
import { useParams, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { PawPrint, Phone, MapPin, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';

interface FinderData {
  pet: {
    name: string;
    species: string;
    breed: string;
    color: string;
    photoUrl?: string;
    medicalAlerts?: string;
    status: string;
  };
  tagId: string;
  ownerName: string;
  ownerPhone?: string;
}

function FinderPage() {
  const { tagId } = useParams<{ tagId: string }>();
  const [data, setData] = useState<FinderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notified, setNotified] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [locationShared, setLocationShared] = useState(false);

  const apiBase = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    if (!tagId) { setError('No tag ID provided'); setLoading(false); return; }
    axios
      .get(`${apiBase}/finder/${tagId}`)
      .then((res) => setData(res.data.data))
      .catch((err) => setError(err.response?.data?.error || 'Tag not found'))
      .finally(() => setLoading(false));
  }, [tagId]);

  const notifyOwner = async () => {
    if (!tagId) return;
    try {
      await axios.post(`${apiBase}/finder/${tagId}/notify`);
      setNotified(true);
    } catch { alert('Failed to notify owner. Please try again.'); }
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
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <PawPrint size={40} className="text-primary-600 mx-auto mb-2" />
          <h1 className="text-2xl font-bold">Lost Pet Found!</h1>
          <p className="text-sm text-gray-500">Tag: {data.tagId}</p>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {data.pet.photoUrl && (
            <img src={data.pet.photoUrl} alt={data.pet.name} className="w-full h-56 object-cover" />
          )}
          <div className="p-6">
            <h2 className="text-xl font-bold mb-1">{data.pet.name}</h2>
            <p className="text-gray-600 mb-4">{data.pet.species} - {data.pet.breed} ({data.pet.color})</p>

            {data.pet.medicalAlerts && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-700">Medical Alert</p>
                  <p className="text-sm text-red-600">{data.pet.medicalAlerts}</p>
                </div>
              </div>
            )}

            <p className="text-sm text-gray-500 mb-4">Owner: {data.ownerName}</p>

            <div className="space-y-3">
              {!notified ? (
                <button onClick={notifyOwner} className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors">
                  <Phone size={18} /> Notify Owner I Found Their Pet
                </button>
              ) : (
                <div className="bg-green-50 text-green-700 py-3 rounded-lg text-center flex items-center justify-center gap-2">
                  <CheckCircle size={18} /> Owner has been notified!
                </div>
              )}

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
          Powered by PawTag - Helping reunite lost pets with their families
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/:tagId" element={<FinderPage />} />
      <Route path="*" element={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <PawPrint size={48} className="text-primary-600 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">PawTag Finder</h1>
            <p className="text-gray-500">Scan a QR code to view a lost pet's information.</p>
          </div>
        </div>
      } />
    </Routes>
  );
}
