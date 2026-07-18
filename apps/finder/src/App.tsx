import { useState, useEffect } from 'react';
import { useParams, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { PawPrint, Phone, MapPin, AlertTriangle, Loader2, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [data, setData] = useState<FinderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notified, setNotified] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [locationShared, setLocationShared] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);

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

  // Resolve photos and main photo
  const petPhotos: PetPhoto[] = data?.pet?.photos || [];
  const hasPhotos = petPhotos.length > 0;
  const mainPhoto = hasPhotos
    ? (petPhotos.find((p) => p.isMain) || petPhotos[0])
    : null;
  const displayPhotoUrl = mainPhoto?.url || data?.pet?.photoUrl;
  const currentPhoto = hasPhotos ? petPhotos[photoIdx] : null;

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
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <PawPrint size={40} className="text-primary-600 mx-auto mb-2" />
          <h1 className="text-2xl font-bold">Lost Pet Found!</h1>
          <p className="text-sm text-gray-500">Tag: {data.tagId}
            {data.tagStatus && (
              <span className={`ml-2 inline-block px-1.5 py-0.5 text-xs rounded-full ${
                data.tagStatus === 'active' ? 'bg-green-100 text-green-700' :
                data.tagStatus === 'lost' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-700'
              }`}>{data.tagStatus}</span>
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
            <h2 className="text-xl font-bold mb-1">{data.pet.name}</h2>
            {data.pet.petId && <p className="text-xs font-mono text-gray-400 mb-1">ID: {data.pet.petId}</p>}
            <p className="text-gray-600 mb-2">{data.pet.petType || data.pet.species} — {formatBreed()} ({data.pet.color}{data.pet.pattern ? `, ${data.pet.pattern}` : ''})</p>
            <div className="flex flex-wrap gap-2 mb-4 text-sm text-gray-500">
              {data.pet.gender && data.pet.gender !== 'unknown' && <span>Gender: {data.pet.gender === 'male' ? 'Male' : 'Female'}</span>}
              {data.pet.age != null && <span>Age: {data.pet.age} yrs</span>}
              {data.pet.favouriteFood && <span>Fav Food: {data.pet.favouriteFood}</span>}
            </div>

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
