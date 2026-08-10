import { useState, useEffect, useRef, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PawPrint, Plus, CheckCircle, X, Save, Upload, Info, QrCode, Camera, Sparkles } from 'lucide-react';
import api from '../../lib/api';
import HealthRecords from './HealthRecords';
import SaveToast from '../../components/SaveToast';
import PetCard, { PetCardSkeleton } from '../../components/PetCard';
import { BREED_ORIGINS, getBreedsForOrigin } from '@pawtag/shared';
import type { PetType } from '@pawtag/shared';

const PET_TYPES = ['Dog', 'Cat', 'Rabbit', 'Hamster', 'Guinea Pig', 'Bird'] as const;

const PET_COLORS: Record<string, string[]> = {
  Dog: ['Black', 'White', 'Brown', 'Cream', 'Golden', 'Red', 'Blue (Gray)', 'Fawn', 'Brindle', 'Merle', 'Sable', 'Chocolate', 'Liver', 'Tan', 'Silver'],
  Cat: ['Black', 'White', 'Gray', 'Blue', 'Orange (Ginger)', 'Cream', 'Brown', 'Chocolate', 'Lilac', 'Cinnamon', 'Fawn'],
  Rabbit: ['White', 'Black', 'Blue', 'Chocolate', 'Lilac', 'Chestnut', 'Chinchilla', 'Sable', 'Tortoise', 'Agouti'],
  Hamster: ['Golden', 'White', 'Black', 'Gray', 'Cream', 'Cinnamon', 'Sable', 'Silver'],
  'Guinea Pig': ['White', 'Black', 'Brown', 'Red', 'Cream', 'Buff', 'Chocolate', 'Lilac', 'Slate'],
  Bird: ['Green', 'Blue', 'Yellow', 'White', 'Gray', 'Black', 'Red', 'Violet', 'Turquoise', 'Lutino', 'Albino'],
};

const PET_PATTERNS: Record<string, string[]> = {
  Dog: ['Solid', 'Merle', 'Brindle', 'Sable', 'Tan Points', 'Tricolor', 'Piebald', 'Tuxedo', 'Harlequin', 'Spotted', 'Roan'],
  Cat: ['Solid', 'Tabby', 'Calico', 'Tortoiseshell', 'Bicolor', 'Tricolor', 'Colorpoint', 'Ticked', 'Spotted', 'Mackerel', 'Classic Tabby'],
  Rabbit: ['Solid', 'Broken', 'Dutch', 'Himalayan', 'Otter', 'Chinchilla', 'Fox', 'Steel', 'Butterfly', 'Magpie'],
  Hamster: ['Solid', 'Banded', 'Sanded', 'Ticked', 'Agouti', 'Spotted'],
  'Guinea Pig': ['Solid', 'Roan', 'Dalmatian', 'Brindle', 'Himalayan', 'Dutch', 'Orange', 'Ticked', 'Agouti'],
  Bird: ['Solid', 'Pied', 'Lutino', 'Albino', 'Opaline', 'Spangle', 'Clearwing', 'Crested', 'Dominant Pied'],
};

const PET_GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'unknown', label: 'Unknown' },
];

const emptyForm = {
  name: '', petType: 'Dog', breedOrigin: 'Purebred', breed: '', secondaryBreed: '', color: '', pattern: '',
  gender: 'unknown', dateOfBirth: '', age: '', favouriteFood: '', medicalAlerts: '',
};

interface PhotoItem { url: string; caption?: string; isMain: boolean; }

function PhotoManager({ photos, onChange }: { photos: PhotoItem[]; onChange: (photos: PhotoItem[]) => void }) {
  const [urlInput, setUrlInput] = useState('');
  const [captionInput, setCaptionInput] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addPhoto = (url: string, caption?: string) => {
    if (!url.trim()) return;
    if (photos.length >= 5) { setError('Maximum 5 photos allowed'); return; }
    setError('');
    const isFirst = photos.length === 0;
    onChange([...photos, { url: url.trim(), caption: caption?.trim() || undefined, isMain: isFirst }]);
  };

  const handleAddUrl = () => { if (!urlInput.trim()) return; addPhoto(urlInput, captionInput); setUrlInput(''); setCaptionInput(''); };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photos.length >= 5) { setError('Maximum 5 photos allowed'); return; }
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
    if (!allowed.includes(file.type)) { setError('Only jpg, png, gif, webp images are allowed'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('File too large. Maximum size is 5MB.'); return; }
    setUploading(true); setError('');
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await api.post('/upload/pet-photo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      addPhoto(res.data.data.url, captionInput || undefined);
      setCaptionInput('');
    } catch (err: any) { setError(err.response?.data?.error || 'Upload failed'); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const removePhoto = (idx: number) => { const updated = photos.filter((_, i) => i !== idx); if (updated.length > 0 && !updated.some((p) => p.isMain)) updated[0].isMain = true; onChange(updated); };
  const setMain = (idx: number) => onChange(photos.map((p, i) => ({ ...p, isMain: i === idx })));
  const mainPhoto = photos.find((p) => p.isMain);

  return (
    <div className="space-y-3">
      <label className="block text-xs text-gray-500 font-medium">Pet Photos (up to 5)</label>
      {mainPhoto && (
        <div className="relative w-full h-48 rounded-xl overflow-hidden border-2 border-teal-300 bg-gray-100">
          <img src={mainPhoto.url} alt="Main photo" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span className="absolute top-2 left-2 bg-teal-600 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1 shadow-lg"><span className="text-yellow-300">★</span> Main Photo</span>
        </div>
      )}
      {photos.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {photos.map((photo, idx) => (
            <div key={idx} className={`relative group rounded-xl overflow-hidden border-2 ${photo.isMain ? 'border-teal-500' : 'border-gray-200'} aspect-square`}>
              <img src={photo.url} alt={photo.caption || `Photo ${idx + 1}`} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="10">Error</text></svg>'; }} />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                {!photo.isMain && <button type="button" onClick={() => setMain(idx)} className="bg-white/90 rounded-full p-1.5 hover:bg-yellow-400 shadow-lg" title="Set as main"><span className="text-yellow-500">★</span></button>}
                <button type="button" onClick={() => removePhoto(idx)} className="bg-white/90 rounded-full p-1.5 hover:bg-red-500 hover:text-white shadow-lg" title="Remove"><X size={12} /></button>
              </div>
              {photo.isMain && <span className="absolute top-1.5 right-1.5 text-yellow-400 drop-shadow-lg">★</span>}
            </div>
          ))}
        </div>
      )}
      {photos.length < 5 && (
        <div className="space-y-2">
          <div className="flex gap-2 items-end">
            <div className="flex-1"><input type="url" placeholder="Paste image URL" value={urlInput} onChange={(e) => { setUrlInput(e.target.value); setError(''); }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" /></div>
            <div className="w-40"><input type="text" placeholder="Caption (optional)" value={captionInput} onChange={(e) => setCaptionInput(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" /></div>
            <button type="button" onClick={handleAddUrl} disabled={!urlInput.trim()} className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 text-sm hover:bg-gray-200 flex items-center gap-1.5 disabled:opacity-50 transition-colors font-medium"><Camera size={14} /> Add</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">or</span>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif" onChange={handleFileUpload} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5 text-sm text-teal-700 hover:bg-teal-100 flex items-center gap-1.5 disabled:opacity-50 transition-colors font-medium"><Upload size={14} /> {uploading ? 'Uploading...' : 'Upload from Device'}</button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function MyPets() {
  const navigate = useNavigate();
  const [pets, setPets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPet, setEditingPet] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [foundTimers, setFoundTimers] = useState<Record<string, string>>({});
  const [timeToFoundMsg, setTimeToFoundMsg] = useState('');
  const [healthPet, setHealthPet] = useState<any>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [unredeemedCount, setUnredeemedCount] = useState(0);

  const refreshPets = () => {
    setLoading(true);
    api.get('/customer/pets')
      .then((r) => setPets(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(() => { refreshPets(); }, []);

  useEffect(() => {
    api.get('/customer/tags/unredeemed-count').then((r) => setUnredeemedCount(r.data.data.count)).catch(() => {});
  }, []);

  useEffect(() => {
    const foundPets = pets.filter((p) => p.status === 'found');
    foundPets.forEach((pet) => {
      api.get(`/customer/pets/${pet._id}/found-timer`).then((r) => {
        if (r.data.data.active) setFoundTimers((prev) => ({ ...prev, [pet._id]: r.data.data }));
      }).catch(() => {});
    });
  }, [pets]);

  useEffect(() => {
    const interval = setInterval(() => {
      setFoundTimers((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((petId) => {
          const timerData = updated[petId] as any;
          if (timerData?.foundAt) {
            const elapsed = Date.now() - new Date(timerData.foundAt).getTime();
            const hours = Math.floor(elapsed / (1000 * 60 * 60));
            const mins = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
            updated[petId] = { ...timerData, display: `${hours}h ${mins}m` };
          }
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const availableColors = form.petType ? PET_COLORS[form.petType] || [] : [];
  const availablePatterns = form.petType ? PET_PATTERNS[form.petType] || [] : [];
  const availableBreeds = form.petType ? getBreedsForOrigin(form.petType as PetType, form.breedOrigin) : [];
  const showSecondaryBreed = form.breedOrigin === 'Mixed Breed' || form.breedOrigin === 'Designer Breed';

  const handleTypeChange = (type: string) => setForm({ ...form, petType: type, breedOrigin: 'Purebred', breed: '', secondaryBreed: '', color: '', pattern: '' });
  const handleBreedOriginChange = (breedOrigin: string) => {
    if (breedOrigin === 'Unknown') {
      setForm({ ...form, breedOrigin, breed: 'Unknown', secondaryBreed: 'Unknown' });
    } else if (breedOrigin === 'Mixed Breed' || breedOrigin === 'Designer Breed') {
      setForm({ ...form, breedOrigin, breed: '', secondaryBreed: '' });
    } else {
      setForm({ ...form, breedOrigin, breed: '', secondaryBreed: 'Unknown' });
    }
  };
  const handleBreedChange = (breed: string) => setForm({ ...form, breed, secondaryBreed: (form.breedOrigin === 'Mixed Breed' || form.breedOrigin === 'Designer Breed') ? '' : 'Unknown' });

  const startEdit = (pet: any) => {
    setEditingPet(pet);
    setForm({ name: pet.name, petType: pet.petType || 'Dog', breedOrigin: pet.breedOrigin || 'Purebred', breed: pet.breed || '', secondaryBreed: pet.secondaryBreed || 'Unknown', color: pet.color || '', pattern: pet.pattern || '', gender: pet.gender || 'unknown', dateOfBirth: pet.dateOfBirth ? pet.dateOfBirth.split('T')[0] : '', age: pet.age != null ? String(pet.age) : '', favouriteFood: pet.favouriteFood || '', medicalAlerts: pet.medicalAlerts || '' });
    setPhotos(pet.photos || []);
    setShowForm(true);
  };

  const startAdd = () => { setEditingPet(null); setForm(emptyForm); setPhotos([]); setShowForm(true); };
  const cancelForm = () => { setShowForm(false); setEditingPet(null); setForm(emptyForm); setPhotos([]); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const payload: any = { species: form.petType, photos, name: form.name, petType: form.petType, breedOrigin: form.breedOrigin, breed: form.breed, secondaryBreed: (form.breedOrigin === 'Mixed Breed' || form.breedOrigin === 'Designer Breed') ? form.secondaryBreed : 'Unknown', color: form.color, pattern: form.pattern, gender: form.gender, favouriteFood: form.favouriteFood, medicalAlerts: form.medicalAlerts };
    if (form.dateOfBirth) payload.dateOfBirth = form.dateOfBirth;
    if (form.age !== '') payload.age = parseFloat(form.age);
    try {
      if (editingPet) { await api.put(`/customer/pets/${editingPet._id}`, payload); } else { await api.post('/customer/pets', payload); }
      cancelForm(); refreshPets(); setShowSaved(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save pet');
    }
  };

  const markLost = async (id: string) => { try { await api.post(`/customer/pets/${id}/mark-lost`); refreshPets(); } catch {} };
  const markFound = async (id: string) => {
    try {
      const res = await api.post(`/customer/pets/${id}/mark-found`);
      const timeMs = res.data.data.timeToFoundMs;
      if (timeMs) {
        const hours = Math.floor(timeMs / (1000 * 60 * 60));
        const mins = Math.floor((timeMs % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((timeMs % (1000 * 60)) / 1000);
        setTimeToFoundMsg(`Pet reunited in ${hours}h ${mins}m ${secs}s`);
        setTimeout(() => setTimeToFoundMsg(''), 8000);
      }
      refreshPets();
    } catch {}
  };
  const markTerminal = async (id: string, reason: string) => {
    if (!confirm(`Mark pet as ${reason}? This action cannot be undone from the portal.`)) return;
    try { await api.post(`/customer/pets/${id}/mark-terminal`, { reason }); refreshPets(); } catch {}
  };
  const deletePet = async (id: string) => { if (confirm('Delete this pet? This cannot be undone.')) { try { await api.delete(`/customer/pets/${id}`); refreshPets(); } catch {} } };

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Pets</h1>
          <p className="text-sm text-gray-500 mt-0.5">{pets.length} pet{pets.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button
          onClick={startAdd}
          className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:from-teal-700 hover:to-cyan-700 shadow-lg shadow-teal-500/25 transition-all hover:shadow-xl hover:shadow-teal-500/30"
        >
          <Plus size={18} /> Add Pet
        </button>
      </div>

      {showSaved && <SaveToast message="Pet saved successfully" onDone={() => setShowSaved(false)} />}

      {/* Unredeemed Tags Banner */}
      {unredeemedCount > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 mb-6 flex items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <QrCode size={24} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-blue-800">You have {unredeemedCount} unredeemed tag{unredeemedCount > 1 ? 's' : ''}</p>
            <p className="text-sm text-blue-600 mt-0.5">Activate your tag to link it to a pet profile and start protecting them.</p>
          </div>
          <button
            onClick={() => navigate('/account/redeem-tag')}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all flex-shrink-0"
          >
            Activate Now
          </button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-xl p-6 mb-8 space-y-5 animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{editingPet ? `Edit ${editingPet.name}` : 'Add New Pet'}</h2>
            <button type="button" onClick={cancelForm} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs text-gray-500 mb-1.5 font-medium">Pet Name *</label><input placeholder="Pet Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" required disabled={!!editingPet} />{editingPet && <p className="text-xs text-gray-400 mt-1">Name cannot be changed after creation</p>}</div>
            <div><label className="block text-xs text-gray-500 mb-1.5 font-medium">Pet Type *</label><select value={form.petType} onChange={(e) => handleTypeChange(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" required>{PET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div className="relative">
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">Breed Origin *</label>
              <div className="flex items-center gap-1">
                <select value={form.breedOrigin} onChange={(e) => handleBreedOriginChange(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" required>
                  {BREED_ORIGINS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span className="group relative flex-shrink-0">
                  <Info size={14} className="text-gray-400 cursor-help" />
                  <span className="absolute right-0 top-6 z-50 w-64 p-2.5 text-xs text-white bg-gray-800 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    {BREED_ORIGINS.find((o) => o.value === form.breedOrigin)?.tooltip}
                  </span>
                </span>
              </div>
            </div>
            <div><label className="block text-xs text-gray-500 mb-1.5 font-medium">{showSecondaryBreed ? 'Primary Breed *' : 'Breed *'}</label><select value={form.breed} onChange={(e) => handleBreedChange(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" required><option value="">{form.breedOrigin === 'Unknown' ? 'Unknown' : 'Select breed...'}</option>{availableBreeds.map((b) => <option key={b} value={b}>{b}</option>)}</select></div>
            {showSecondaryBreed && <div><label className="block text-xs text-gray-500 mb-1.5 font-medium">Secondary Breed *</label><select value={form.secondaryBreed} onChange={(e) => setForm({ ...form, secondaryBreed: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" required><option value="">Select...</option>{availableBreeds.filter((b) => b !== form.breed).map((b) => <option key={b} value={b}>{b}</option>)}</select></div>}
            <div><label className="block text-xs text-gray-500 mb-1.5 font-medium">Color *</label><select value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" required><option value="">Select color...</option>{availableColors.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="block text-xs text-gray-500 mb-1.5 font-medium">Pattern</label><select value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"><option value="">Select pattern...</option>{availablePatterns.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
            <div><label className="block text-xs text-gray-500 mb-1.5 font-medium">Gender</label><select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all">{PET_GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></div>
            <div><label className="block text-xs text-gray-500 mb-1.5 font-medium">Birthday</label><input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" /></div>
            <div><label className="block text-xs text-gray-500 mb-1.5 font-medium">Age (years)</label><input type="number" min="0" max="30" step="0.5" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" placeholder="e.g. 3" /></div>
            <div><label className="block text-xs text-gray-500 mb-1.5 font-medium">Favourite Food</label><input placeholder="e.g. Chicken, Salmon..." value={form.favouriteFood} onChange={(e) => setForm({ ...form, favouriteFood: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" /></div>
            <div><label className="block text-xs text-gray-500 mb-1.5 font-medium">Medical Alerts</label><input placeholder="Allergies, conditions..." value={form.medicalAlerts} onChange={(e) => setForm({ ...form, medicalAlerts: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all" /></div>
          </div>
          <div className="border-t border-gray-100 pt-5"><PhotoManager photos={photos} onChange={setPhotos} /></div>
          <div className="flex gap-3">
            <button type="submit" className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:from-teal-700 hover:to-cyan-700 shadow-lg shadow-teal-500/25 transition-all flex items-center gap-2"><Save size={16} /> {editingPet ? 'Update Pet' : 'Save Pet'}</button>
            <button type="button" onClick={cancelForm} className="border border-gray-200 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {/* Found Reunited Toast */}
      {timeToFoundMsg && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3 mb-6 animate-fade-in">
          <CheckCircle size={22} className="text-green-600" />
          <p className="text-green-800 font-semibold">{timeToFoundMsg}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => <PetCardSkeleton key={i} />)}
        </div>
      )}

      {/* Empty State */}
      {!loading && pets.length === 0 && (
        <div className="text-center py-20 animate-fade-in">
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center shadow-inner">
            <PawPrint size={48} className="text-teal-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">No pets yet</h2>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">Add your first pet to get started. Link a QR tag to protect them and help them get home safely.</p>
          <button
            onClick={startAdd}
            className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-6 py-3 rounded-xl text-sm font-semibold inline-flex items-center gap-2 hover:from-teal-700 hover:to-cyan-700 shadow-lg shadow-teal-500/25 transition-all"
          >
            <Plus size={18} /> Add Your First Pet
          </button>
        </div>
      )}

      {/* Pet Cards Grid */}
      {!loading && pets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {pets.map((pet, index) => (
            <PetCard
              key={pet._id}
              pet={pet}
              index={index}
              foundTimer={foundTimers[pet._id] as any}
              onEdit={startEdit}
              onHealth={setHealthPet}
              onMarkLost={markLost}
              onMarkFound={markFound}
              onMarkTerminal={markTerminal}
              onDelete={deletePet}
            />
          ))}
        </div>
      )}

      {healthPet && <HealthRecords pet={healthPet} onClose={() => setHealthPet(null)} />}
    </div>
  );
}
