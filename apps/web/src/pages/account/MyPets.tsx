import { useState, useEffect, useRef, FormEvent } from 'react';
import { PawPrint, Plus, AlertTriangle, CheckCircle, Star, X, Edit2, Save, Upload, ShieldAlert, ShieldCheck, ShoppingBag, ChevronRight, Skull, EyeOff, Clock, Activity, Camera } from 'lucide-react';
import api from '../../lib/api';
import HealthRecords from './HealthRecords';
import SaveToast from '../../components/SaveToast';

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

const PET_BREEDS: Record<string, string[]> = {
  Dog: [
    'Mixed Breed', 'Labrador Retriever', 'German Shepherd', 'Golden Retriever', 'French Bulldog',
    'Bulldog', 'Poodle', 'Beagle', 'Rottweiler', 'Dachshund', 'German Shorthaired Pointer',
    'Pembroke Welsh Corgi', 'Australian Shepherd', 'Yorkshire Terrier', 'Cavalier King Charles Spaniel',
    'Doberman Pinscher', 'Boxer', 'Miniature Schnauzer', 'Cocker Spaniel', 'Shih Tzu',
    'Border Collie', 'Belgian Malinois', 'Alaskan Malamute', 'Siberian Husky',
    'Bernese Mountain Dog', 'Great Dane', 'Saint Bernard', 'Old English Sheepdog',
    'Samoyed', 'Akita', 'Mastiff', 'Newfoundland',
    'West Highland White Terrier', 'Scottish Terrier', 'Bull Terrier', 'Jack Russell Terrier',
    'Staffordshire Bull Terrier', 'Airedale Terrier',
    'Chihuahua', 'Pomeranian', 'Maltese', 'Pug', 'Papillon',
    'Italian Greyhound', 'Chinese Crested',
    'Basset Hound', 'Bloodhound', 'Greyhound', 'Whippet',
    'Rhodesian Ridgeback', 'Afghan Hound', 'Basenji',
    'Shiba Inu', 'Shar Pei', 'Chow Chow', 'Lhasa Apso',
    'Sheltie', 'Collie', 'Dalmatian', 'Weimaraner',
    'Vizsla', 'Brittany Spaniel', 'Setter (Irish)', 'Setter (English)',
    'Pointer', 'Havanese', 'Bichon Frise', 'Maltepoo',
    'Goldendoodle', 'Labradoodle', 'Cockapoo', 'Pomsky',
  ],
  Cat: [
    'Mixed Breed', 'Domestic Shorthair', 'Domestic Longhair', 'Ragdoll', 'Maine Coon',
    'Persian', 'British Shorthair', 'Bengal', 'Abyssinian',
    'Siamese', 'Russian Blue', 'Scottish Fold', 'Sphynx',
    'Birman', 'Norwegian Forest Cat', 'Ragamuffin', 'Himalayan',
    'American Shorthair', 'Exotic Shorthair', 'Oriental Shorthair',
    'Tonkinese', 'Burmese', 'Cornish Rex', 'Devon Rex', 'Selkirk Rex',
    'Somali', 'Balinese', 'Chartreux', 'Korat',
    'LaPerm', 'Manx', 'Munchkin', 'Singapura',
    'Snowshoe', 'Turkish Angora', 'Turkish Van',
  ],
  Rabbit: [
    'Mixed Breed', 'Holland Lop', 'Mini Lop', 'English Lop', 'French Lop',
    'Netherland Dwarf', 'Mini Rex', 'Standard Rex', 'Velveteen Lop',
    'Himalayan', 'Dutch', 'English Spot', 'Checkered Giant',
    'Flemish Giant', 'Lionhead', 'Angora', 'Jersey Wooly',
    'Californian', 'New Zealand', 'American', 'Chinchilla',
    'Argente', 'Belgian Hare', 'English Angora', 'French Angora',
  ],
  Hamster: ['Syrian (Golden)', 'Dwarf Campbell', 'Dwarf Winter White', 'Roborovski', 'Chinese'],
  'Guinea Pig': [
    'American', 'Peruvian', 'Silkie (Sheltie)', 'Teddy',
    'Texel', 'Rex', 'American Crested', 'Peruvian Crested',
    'Skinny Pig', 'Baldwin', 'Sheba', 'White Crested', 'Merino', 'Lunkarya',
  ],
  Bird: [
    'Budgerigar (Budgie)', 'Cockatiel', 'Lovebird', 'African Grey',
    'Amazon Parrot', 'Macaw', 'Cockatoo', 'Conure',
    'Canary', 'Finch', 'Parrotlet', 'Quaker Parrot',
    'Ringneck Dove', 'Pionus', 'Caique', 'Lorikeet',
    'Mynah', "Bourke's Parakeet", 'Lineolated Parakeet',
  ],
};

const PET_GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'unknown', label: 'Unknown' },
];

const emptyForm = {
  name: '', petType: 'Dog', breed: '', secondaryBreed: '', color: '', pattern: '',
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
        <div className="relative w-full h-48 rounded-lg overflow-hidden border-2 border-teal-300 bg-gray-100">
          <img src={mainPhoto.url} alt="Main photo" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span className="absolute top-2 left-2 bg-teal-600 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1"><Star size={10} fill="currentColor" /> Main Photo</span>
        </div>
      )}
      {photos.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {photos.map((photo, idx) => (
            <div key={idx} className={`relative group rounded-lg overflow-hidden border-2 ${photo.isMain ? 'border-teal-500' : 'border-gray-200'} aspect-square`}>
              <img src={photo.url} alt={photo.caption || `Photo ${idx + 1}`} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="10">Error</text></svg>'; }} />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                {!photo.isMain && <button type="button" onClick={() => setMain(idx)} className="bg-white/90 rounded-full p-1 hover:bg-yellow-400" title="Set as main"><Star size={12} /></button>}
                <button type="button" onClick={() => removePhoto(idx)} className="bg-white/90 rounded-full p-1 hover:bg-red-500 hover:text-white" title="Remove"><X size={12} /></button>
              </div>
              {photo.isMain && <span className="absolute top-1 right-1"><Star size={10} className="text-yellow-500" fill="currentColor" /></span>}
            </div>
          ))}
        </div>
      )}
      {photos.length < 5 && (
        <div className="space-y-2">
          <div className="flex gap-2 items-end">
            <div className="flex-1"><input type="url" placeholder="Paste image URL" value={urlInput} onChange={(e) => { setUrlInput(e.target.value); setError(''); }} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
            <div className="w-40"><input type="text" placeholder="Caption (optional)" value={captionInput} onChange={(e) => setCaptionInput(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
            <button type="button" onClick={handleAddUrl} disabled={!urlInput.trim()} className="bg-gray-100 border rounded-md px-3 py-2 text-sm hover:bg-gray-200 flex items-center gap-1 disabled:opacity-50"><Camera size={14} /> Add URL</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">or</span>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif" onChange={handleFileUpload} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="bg-teal-50 border border-teal-200 rounded-md px-3 py-2 text-sm text-teal-700 hover:bg-teal-100 flex items-center gap-1 disabled:opacity-50"><Upload size={14} /> {uploading ? 'Uploading...' : 'Upload from Device'}</button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function MyPets() {
  const [pets, setPets] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPet, setEditingPet] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [foundTimers, setFoundTimers] = useState<Record<string, string>>({});
  const [timeToFoundMsg, setTimeToFoundMsg] = useState('');
  const [healthPet, setHealthPet] = useState<any>(null);
  const [showSaved, setShowSaved] = useState(false);

  const refreshPets = () => api.get('/customer/pets').then((r) => setPets(r.data.data)).catch(console.error);
  useEffect(() => { refreshPets(); }, []);

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
  const availableBreeds = form.petType ? PET_BREEDS[form.petType] || [] : [];
  const isMixedBreed = form.breed === 'Mixed Breed';

  const handleTypeChange = (type: string) => setForm({ ...form, petType: type, breed: '', secondaryBreed: '', color: '', pattern: '' });
  const handleBreedChange = (breed: string) => setForm({ ...form, breed, secondaryBreed: breed !== 'Mixed Breed' ? 'Unknown' : '' });

  const startEdit = (pet: any) => {
    setEditingPet(pet);
    setForm({ name: pet.name, petType: pet.petType || 'Dog', breed: pet.breed || '', secondaryBreed: pet.secondaryBreed || 'Unknown', color: pet.color || '', pattern: pet.pattern || '', gender: pet.gender || 'unknown', dateOfBirth: pet.dateOfBirth ? pet.dateOfBirth.split('T')[0] : '', age: pet.age != null ? String(pet.age) : '', favouriteFood: pet.favouriteFood || '', medicalAlerts: pet.medicalAlerts || '' });
    setPhotos(pet.photos || []);
    setShowForm(true);
  };

  const startAdd = () => { setEditingPet(null); setForm(emptyForm); setPhotos([]); setShowForm(true); };
  const cancelForm = () => { setShowForm(false); setEditingPet(null); setForm(emptyForm); setPhotos([]); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const payload: any = { species: form.petType, photos, name: form.name, petType: form.petType, breed: form.breed, secondaryBreed: form.breed === 'Mixed Breed' ? form.secondaryBreed : 'Unknown', color: form.color, pattern: form.pattern, gender: form.gender, favouriteFood: form.favouriteFood, medicalAlerts: form.medicalAlerts };
    if (form.dateOfBirth) payload.dateOfBirth = form.dateOfBirth;
    if (form.age !== '') payload.age = parseFloat(form.age);
    try {
      if (editingPet) { await api.put(`/customer/pets/${editingPet._id}`, payload); } else { await api.post('/customer/pets', payload); }
      cancelForm(); refreshPets(); setShowSaved(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save pet');
    }
  };

  const markLost = async (id: string) => { await api.post(`/customer/pets/${id}/mark-lost`); refreshPets(); };
  const markFound = async (id: string) => {
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
  };
  const markTerminal = async (id: string, reason: string) => {
    if (!confirm(`Mark pet as ${reason}? This action cannot be undone from the portal.`)) return;
    await api.post(`/customer/pets/${id}/mark-terminal`, { reason }); refreshPets();
  };
  const deletePet = async (id: string) => { if (confirm('Delete this pet?')) { await api.delete(`/customer/pets/${id}`); refreshPets(); } };

  const getMainPhoto = (pet: any): string | null => {
    if (pet.photos?.length > 0) { const m = pet.photos.find((p: any) => p.isMain); return m ? m.url : pet.photos[0].url; }
    return pet.photoUrl || null;
  };

  const formatBreed = (pet: any) => {
    if (pet.breed === 'Mixed Breed' && pet.secondaryBreed && pet.secondaryBreed !== 'Unknown') return `Mixed (${pet.secondaryBreed})`;
    if (pet.breed === 'Mixed Breed') return 'Mixed Breed';
    return pet.breed;
  };

  const genderLabel = (g: string) => g === 'male' ? 'Male' : g === 'female' ? 'Female' : 'Unknown';

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Pets</h1>
        <button onClick={startAdd} className="bg-teal-600 text-white px-4 py-2 rounded-md text-sm flex items-center gap-2 hover:bg-teal-700"><Plus size={16} /> Add Pet</button>
      </div>
      {showSaved && <SaveToast message="Pet saved successfully" onDone={() => setShowSaved(false)} />}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 mb-6 space-y-4">
          <h2 className="text-lg font-semibold">{editingPet ? `Edit ${editingPet.name}` : 'Add New Pet'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs text-gray-500 mb-1">Pet Name *</label><input placeholder="Pet Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required disabled={!!editingPet} />{editingPet && <p className="text-xs text-gray-400 mt-1">Name cannot be changed after creation</p>}</div>
            <div><label className="block text-xs text-gray-500 mb-1">Pet Type *</label><select value={form.petType} onChange={(e) => handleTypeChange(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required>{PET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="block text-xs text-gray-500 mb-1">Breed *</label><select value={form.breed} onChange={(e) => handleBreedChange(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required><option value="">Select breed...</option>{availableBreeds.map((b) => <option key={b} value={b}>{b}</option>)}</select></div>
            {isMixedBreed && <div><label className="block text-xs text-gray-500 mb-1">Secondary Breed *</label><select value={form.secondaryBreed} onChange={(e) => setForm({ ...form, secondaryBreed: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required><option value="">Select...</option><option value="Unknown">Unknown</option>{availableBreeds.filter((b) => b !== 'Mixed Breed').map((b) => <option key={b} value={b}>{b}</option>)}</select></div>}
            <div><label className="block text-xs text-gray-500 mb-1">Color *</label><select value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required><option value="">Select color...</option>{availableColors.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="block text-xs text-gray-500 mb-1">Pattern</label><select value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm"><option value="">Select pattern...</option>{availablePatterns.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
            <div><label className="block text-xs text-gray-500 mb-1">Gender</label><select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm">{PET_GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></div>
            <div><label className="block text-xs text-gray-500 mb-1">Birthday</label><input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Age (years)</label><input type="number" min="0" max="30" step="0.5" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="e.g. 3" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Favourite Food</label><input placeholder="e.g. Chicken, Salmon..." value={form.favouriteFood} onChange={(e) => setForm({ ...form, favouriteFood: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Medical Alerts</label><input placeholder="Allergies, conditions..." value={form.medicalAlerts} onChange={(e) => setForm({ ...form, medicalAlerts: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          </div>
          <div className="border-t pt-4"><PhotoManager photos={photos} onChange={setPhotos} /></div>
          <div className="flex gap-2">
            <button type="submit" className="bg-teal-600 text-white px-4 py-2 rounded-md text-sm hover:bg-teal-700 flex items-center gap-1"><Save size={14} /> {editingPet ? 'Update Pet' : 'Save Pet'}</button>
            <button type="button" onClick={cancelForm} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
          </div>
        </form>
      )}

      {pets.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No pets yet. Add your first pet above.</div>
      ) : (
        <div className="space-y-4">
          {timeToFoundMsg && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle size={20} className="text-green-600" />
              <p className="text-green-800 font-medium">{timeToFoundMsg}</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pets.map((pet) => {
            const mainPhoto = getMainPhoto(pet);
            return (
              <div key={pet._id} className={`bg-white rounded-lg border overflow-hidden ${pet.status === 'lost' ? 'border-red-300 ring-2 ring-red-200' : pet.status === 'found' ? 'border-amber-300 ring-2 ring-amber-200' : ''}`}>
                {pet.status === 'lost' && <div className="bg-red-600 text-white px-4 py-3 flex items-center gap-2"><ShieldAlert size={24} /><span className="font-extrabold text-base tracking-wide">LOST PET</span>{pet.lostCount > 0 && <span className="ml-auto bg-red-800 text-red-100 text-sm px-2 py-0.5 rounded-full">Lost {pet.lostCount}x</span>}</div>}
                {pet.status === 'found' && (
                  <div className="bg-amber-500 text-white px-4 py-3">
                    <div className="flex items-center gap-2"><ShieldCheck size={24} /><span className="font-bold text-base tracking-wide">FOUND — Needs owner pickup</span></div>
                    {(foundTimers[pet._id] as any)?.display && (
                      <div className="flex items-center gap-1.5 mt-1 text-amber-100 text-sm">
                        <Clock size={14} />
                        <span className="font-mono">{(foundTimers[pet._id] as any).display}</span>
                        <span>since found</span>
                      </div>
                    )}
                  </div>
                )}
                {pet.status === 'safe' && <div className="bg-green-500 text-white px-4 py-2.5 flex items-center gap-2"><ShieldCheck size={20} /><span className="font-semibold text-sm">Safe</span>{pet.lostCount > 0 && <span className="ml-auto bg-green-700 text-green-100 text-sm px-2 py-0.5 rounded-full">Lost {pet.lostCount}x</span>}</div>}
                {pet.status === 'deceased' && <div className="bg-gray-600 text-white px-4 py-2.5 flex items-center gap-2"><Skull size={20} /><span className="font-semibold text-sm">Deceased</span></div>}
                {pet.status === 'stolen' && <div className="bg-purple-600 text-white px-4 py-2.5 flex items-center gap-2"><EyeOff size={20} /><span className="font-semibold text-sm">Stolen — Report to police</span></div>}
                {pet.status === 'transferred' && <div className="bg-blue-600 text-white px-4 py-2.5 flex items-center gap-2"><ChevronRight size={20} /><span className="font-semibold text-sm">Transferred</span></div>}
                {pet.status === 'donated' && <div className="bg-teal-600 text-white px-4 py-2.5 flex items-center gap-2"><Star size={20} /><span className="font-semibold text-sm">Donated</span></div>}
                {pet.status === 'sold' && <div className="bg-amber-600 text-white px-4 py-2.5 flex items-center gap-2"><ShoppingBag size={20} /><span className="font-semibold text-sm">Sold</span></div>}
                {mainPhoto ? <div className="h-40 bg-gray-100 relative"><img src={mainPhoto} alt={pet.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /></div> : <button type="button" onClick={() => startEdit(pet)} className="h-40 bg-gradient-to-br from-teal-50 to-teal-100 flex flex-col items-center justify-center gap-1.5 px-4 text-center hover:from-teal-100 hover:to-teal-200 transition-colors cursor-pointer w-full"><PawPrint size={28} className="text-teal-400 mb-1" /><p className="text-sm text-teal-700 font-semibold">Add a photo of {pet.name}</p><p className="text-xs text-amber-600 font-medium italic">A clear photo helps finders identify and reunite your pet faster</p><p className="text-[10px] text-teal-500 mt-1 underline">Click to edit</p></button>}
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold">{pet.name}</h3>
                      {pet.petId && <p className="text-sm text-gray-400 font-mono">ID: {pet.petId}</p>}
                      {pet.linkedTag && <p className="text-sm text-teal-600 font-mono mt-0.5">Tag: {pet.linkedTag.tagId}<span className={`ml-1.5 inline-block w-2 h-2 rounded-full ${pet.linkedTag.status === 'active' ? 'bg-green-500' : pet.linkedTag.status === 'lost' ? 'bg-red-500' : 'bg-gray-400'}`} /><span className="ml-1 text-gray-400 font-sans">({pet.linkedTag.status})</span></p>}
                      {!pet.linkedTag && <p className="text-sm text-gray-300 mt-0.5">No tag linked</p>}
                      <p className="text-base text-gray-600 mt-1">{pet.petType || pet.species} — {formatBreed(pet)}</p>
                      <p className="text-base text-gray-500">Color: {pet.color}{pet.pattern ? ` | Pattern: ${pet.pattern}` : ''}</p>
                      <p className="text-base text-gray-500">Gender: {genderLabel(pet.gender)}{pet.age != null ? ` | Age: ${pet.age} yrs` : ''}</p>
                      {pet.favouriteFood && <p className="text-base text-gray-500">Fav Food: {pet.favouriteFood}</p>}
                      {pet.photos?.length > 1 && <p className="text-sm text-gray-400 mt-1">{pet.photos.length} photos</p>}
                      {pet.medicalAlerts && <p className="text-base text-red-600 mt-1 flex items-center gap-1"><AlertTriangle size={16} /> {pet.medicalAlerts}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-3 border-t flex-wrap">
                    <button onClick={() => startEdit(pet)} className="bg-teal-50 text-teal-700 hover:bg-teal-100 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 border border-teal-200"><Edit2 size={14} /> Edit</button>
                    <button onClick={() => setHealthPet(pet)} className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 border border-blue-200"><Activity size={14} /> Health Records</button>
                    {pet.status === 'safe' ? (
                      <button onClick={() => markLost(pet._id)} className="bg-red-50 text-red-700 hover:bg-red-100 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 border border-red-200"><ShieldAlert size={14} /> Mark as Lost</button>
                    ) : pet.status === 'lost' || pet.status === 'found' ? (
                      <>
                        <button onClick={() => markFound(pet._id)} className="bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 border border-green-200"><CheckCircle size={14} /> Mark as Found</button>
                        <button onClick={() => markTerminal(pet._id, 'stolen')} className="bg-purple-50 text-purple-700 hover:bg-purple-100 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 border border-purple-200"><EyeOff size={14} /> Stolen</button>
                        <button onClick={() => markTerminal(pet._id, 'deceased')} className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 border border-gray-300"><Skull size={14} /> Deceased</button>
                        <button onClick={() => markTerminal(pet._id, 'transferred')} className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 border border-blue-200"><ChevronRight size={14} /> Transferred</button>
                        <button onClick={() => markTerminal(pet._id, 'donated')} className="bg-teal-50 text-teal-700 hover:bg-teal-100 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 border border-teal-200"><Star size={14} /> Donated</button>
                        <button onClick={() => markTerminal(pet._id, 'sold')} className="bg-amber-50 text-amber-700 hover:bg-amber-100 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 border border-amber-200"><ShoppingBag size={14} /> Sold</button>
                      </>
                    ) : null}
                    <button onClick={() => deletePet(pet._id)} className="text-gray-400 hover:text-red-600 text-sm ml-auto px-3 py-1.5">Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}
      {healthPet && <HealthRecords pet={healthPet} onClose={() => setHealthPet(null)} />}
    </div>
  );
}
