import { useEffect, useState, useRef } from 'react';
import api, { PaginatedData } from '../lib/api';
import { Search, ChevronDown, ChevronUp, Trash2, Plus, Edit2, Save, X, Camera, Star, ImageIcon, Upload } from 'lucide-react';

// --- Pet attribute options ---
const PET_TYPES = ['Dog', 'Cat', 'Rabbit', 'Hamster', 'Guinea Pig', 'Bird'] as const;
const PET_GENDERS = [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'unknown', label: 'Unknown' }];

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
  Dog: ['Mixed Breed', 'Labrador Retriever', 'German Shepherd', 'Golden Retriever', 'French Bulldog', 'Bulldog', 'Poodle', 'Beagle', 'Rottweiler', 'Dachshund', 'German Shorthaired Pointer', 'Pembroke Welsh Corgi', 'Australian Shepherd', 'Yorkshire Terrier', 'Cavalier King Charles Spaniel', 'Doberman Pinscher', 'Boxer', 'Miniature Schnauzer', 'Cocker Spaniel', 'Shih Tzu', 'Border Collie', 'Belgian Malinois', 'Siberian Husky', 'Bernese Mountain Dog', 'Great Dane', 'Chihuahua', 'Pomeranian', 'Maltese', 'Pug', 'Shiba Inu', 'Shar Pei', 'Dalmatian', 'Goldendoodle', 'Labradoodle', 'Pomsky'],
  Cat: ['Mixed Breed', 'Domestic Shorthair', 'Domestic Longhair', 'Ragdoll', 'Maine Coon', 'Persian', 'British Shorthair', 'Bengal', 'Abyssinian', 'Siamese', 'Russian Blue', 'Scottish Fold', 'Sphynx', 'Birman', 'Norwegian Forest Cat', 'Ragamuffin', 'Himalayan', 'Cornish Rex', 'Devon Rex', 'Manx', 'Munchkin', 'Turkish Van'],
  Rabbit: ['Mixed Breed', 'Holland Lop', 'Mini Lop', 'English Lop', 'French Lop', 'Netherland Dwarf', 'Mini Rex', 'Standard Rex', 'Lionhead', 'Angora', 'Flemish Giant', 'Dutch', 'English Spot', 'Californian', 'New Zealand'],
  Hamster: ['Syrian (Golden)', 'Dwarf Campbell', 'Dwarf Winter White', 'Roborovski', 'Chinese'],
  'Guinea Pig': ['American', 'Peruvian', 'Silkie (Sheltie)', 'Teddy', 'Texel', 'Rex', 'American Crested', 'Skinny Pig', 'Sheba'],
  Bird: ['Budgerigar (Budgie)', 'Cockatiel', 'Lovebird', 'African Grey', 'Amazon Parrot', 'Macaw', 'Cockatoo', 'Conure', 'Canary', 'Finch', 'Parrotlet', 'Quaker Parrot'],
};

const emptyForm = {
  name: '', petType: 'Dog', breed: '', secondaryBreed: 'Unknown', color: '', pattern: '',
  gender: 'unknown', dateOfBirth: '', favouriteFood: '', medicalAlerts: '', ownerId: '',
};

interface PhotoItem { url: string; caption?: string; isMain: boolean; }

function PhotoManager({ photos, onChange }: { photos: PhotoItem[]; onChange: (p: PhotoItem[]) => void }) {
  const [urlInput, setUrlInput] = useState('');
  const [captionInput, setCaptionInput] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addPhoto = (url: string, caption?: string) => {
    if (!url.trim() || photos.length >= 5) { setError(photos.length >= 5 ? 'Max 5 photos' : 'URL required'); return; }
    setError('');
    onChange([...photos, { url: url.trim(), caption: caption?.trim() || undefined, isMain: photos.length === 0 }]);
    setUrlInput(''); setCaptionInput('');
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    addPhoto(urlInput, captionInput);
    setUrlInput(''); setCaptionInput('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photos.length >= 5) { setError('Max 5 photos'); return; }

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
    if (!allowed.includes(file.type)) { setError('Only jpg, png, gif, webp images allowed'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('File too large. Max 5MB.'); return; }

    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await api.post('/upload/pet-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      addPhoto(res.data.data.url, captionInput || undefined);
      setCaptionInput('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = (idx: number) => {
    const updated = photos.filter((_, i) => i !== idx);
    if (updated.length > 0 && !updated.some((p) => p.isMain)) updated[0].isMain = true;
    onChange(updated);
  };
  const mainPhoto = photos.find((p) => p.isMain);
  return (
    <div className="space-y-2">
      {mainPhoto && (
        <div className="relative w-full h-32 rounded overflow-hidden border bg-gray-100">
          <img src={mainPhoto.url} alt="Main" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span className="absolute top-1 left-1 bg-primary-600 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-0.5"><Star size={8} fill="currentColor" /> Main</span>
        </div>
      )}
      {photos.length > 0 && (
        <div className="grid grid-cols-5 gap-1.5">
          {photos.map((photo, idx) => (
            <div key={idx} className={`relative group rounded overflow-hidden border-2 ${photo.isMain ? 'border-primary-500' : 'border-gray-200'} aspect-square`}>
              <img src={photo.url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100">
                {!photo.isMain && <button type="button" onClick={() => onChange(photos.map((p, i) => ({ ...p, isMain: i === idx })))} className="bg-white/90 rounded-full p-0.5 hover:bg-yellow-400"><Star size={10} /></button>}
                <button type="button" onClick={() => removePhoto(idx)} className="bg-white/90 rounded-full p-0.5 hover:bg-red-500 hover:text-white"><X size={10} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {photos.length < 5 && (
        <div className="space-y-1.5">
          <div className="flex gap-1.5 items-end">
            <input type="url" placeholder="Image URL" value={urlInput} onChange={(e) => { setUrlInput(e.target.value); setError(''); }} className="flex-1 border rounded px-2 py-1.5 text-xs" />
            <input type="text" placeholder="Caption" value={captionInput} onChange={(e) => setCaptionInput(e.target.value)} className="w-24 border rounded px-2 py-1.5 text-xs" />
            <button type="button" onClick={handleAddUrl} disabled={!urlInput.trim()} className="bg-gray-100 border rounded px-2 py-1.5 text-xs hover:bg-gray-200 disabled:opacity-50"><Camera size={10} /></button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">or</span>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif" onChange={handleFileUpload} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="bg-primary-50 border border-primary-200 rounded px-2 py-1.5 text-xs text-primary-700 hover:bg-primary-100 flex items-center gap-1 disabled:opacity-50">
              <Upload size={10} /> {uploading ? 'Uploading...' : 'Upload from Device'}
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function Pets() {
  const [data, setData] = useState<PaginatedData<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPet, setEditingPet] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [owners, setOwners] = useState<any[]>([]);

  // Filter states
  const [petType, setPetType] = useState('');
  const [petName, setPetName] = useState('');
  const [petBreed, setPetBreed] = useState('');
  const [petColor, setPetColor] = useState('');
  const [petPattern, setPetPattern] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');

  const buildParams = () => {
    const params: any = { page, limit: 20 };
    if (petType) params.petType = petType;
    if (petName) params.petName = petName;
    if (petBreed) params.petBreed = petBreed;
    if (petColor) params.petColor = petColor;
    if (petPattern) params.petPattern = petPattern;
    if (statusFilter) params.status = statusFilter;
    if (ownerName) params.ownerName = ownerName;
    if (ownerEmail) params.ownerEmail = ownerEmail;
    if (ownerPhone) params.ownerPhone = ownerPhone;
    return params;
  };

  const fetchPets = () => {
    setLoading(true);
    api.get('/admin/pets', { params: buildParams() }).then((res) => setData(res.data.data)).catch(console.error).finally(() => setLoading(false));
  };
  const fetchOwners = () => api.get('/admin/users', { params: { role: 'customer', limit: 200 } }).then((r) => setOwners(r.data.data.items)).catch(console.error);

  useEffect(() => { fetchPets(); }, [page, statusFilter]);
  useEffect(() => { fetchOwners(); }, []);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchPets(); };
  const clearFilters = () => { setPetType(''); setPetName(''); setPetBreed(''); setPetColor(''); setPetPattern(''); setStatusFilter(''); setOwnerName(''); setOwnerEmail(''); setOwnerPhone(''); setPage(1); };
  const hasActiveFilters = petType || petName || petBreed || petColor || petPattern || statusFilter || ownerName || ownerEmail || ownerPhone;

  const handleTypeChange = (type: string) => { setForm({ ...form, petType: type, breed: '', secondaryBreed: 'Unknown', color: '', pattern: '' }); };
  const handleBreedChange = (breed: string) => { setForm({ ...form, breed, secondaryBreed: breed !== 'Mixed Breed' ? 'Unknown' : '' }); };

  const startAdd = () => { setEditingPet(null); setForm(emptyForm); setPhotos([]); setShowForm(true); };
  const startEdit = (pet: any) => {
    setEditingPet(pet);
    setForm({
      name: pet.name, petType: pet.petType || 'Dog', breed: pet.breed || '', secondaryBreed: pet.secondaryBreed || 'Unknown',
      color: pet.color || '', pattern: pet.pattern || '', gender: pet.gender || 'unknown',
      dateOfBirth: pet.dateOfBirth ? pet.dateOfBirth.split('T')[0] : '', favouriteFood: pet.favouriteFood || '',
      medicalAlerts: pet.medicalAlerts || '', ownerId: pet.ownerId?._id || pet.ownerId || '',
    });
    setPhotos(pet.photos || []);
    setShowForm(true);
  };
  const cancelForm = () => { setShowForm(false); setEditingPet(null); setForm(emptyForm); setPhotos([]); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...form, species: form.petType, photos };
    if (form.breed !== 'Mixed Breed') payload.secondaryBreed = 'Unknown';
    if (editingPet) {
      await api.put(`/admin/pets/${editingPet._id}`, payload);
    } else {
      await api.post('/admin/pets', payload);
    }
    cancelForm(); fetchPets();
  };

  const deletePet = async (id: string) => { if (!confirm('Delete this pet?')) return; await api.delete(`/admin/pets/${id}`); fetchPets(); };

  const availableColors = form.petType ? PET_COLORS[form.petType] || [] : [];
  const availablePatterns = form.petType ? PET_PATTERNS[form.petType] || [] : [];
  const availableBreeds = form.petType ? PET_BREEDS[form.petType] || [] : [];
  const isMixedBreed = form.breed === 'Mixed Breed';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Pet Management</h1>
        <button onClick={startAdd} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm flex items-center gap-1.5 hover:bg-primary-700">
          <Plus size={14} /> Add Pet
        </button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">{editingPet ? `Edit ${editingPet.name}` : 'Register New Pet'}</h2>
            {editingPet?.petId && <span className="text-xs font-mono text-gray-400">ID: {editingPet.petId}</span>}
            <button type="button" onClick={cancelForm} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Owner *</label>
              <select value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })} className="w-full border rounded-md px-2 py-1.5 text-sm" required>
                <option value="">Select owner...</option>
                {owners.map((o: any) => <option key={o._id} value={o._id}>{o.fullName} ({o.email})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Pet Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-md px-2 py-1.5 text-sm" required disabled={!!editingPet} />
              {editingPet && <p className="text-xs text-gray-400">Name immutable</p>}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Pet Type *</label>
              <select value={form.petType} onChange={(e) => handleTypeChange(e.target.value)} className="w-full border rounded-md px-2 py-1.5 text-sm" required>
                {PET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Breed *</label>
              <select value={form.breed} onChange={(e) => handleBreedChange(e.target.value)} className="w-full border rounded-md px-2 py-1.5 text-sm" required>
                <option value="">Select...</option>
                {availableBreeds.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            {isMixedBreed && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Secondary Breed</label>
                <select value={form.secondaryBreed} onChange={(e) => setForm({ ...form, secondaryBreed: e.target.value })} className="w-full border rounded-md px-2 py-1.5 text-sm">
                  <option value="Unknown">Unknown</option>
                  {availableBreeds.filter((b) => b !== 'Mixed Breed').map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Color *</label>
              <select value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-full border rounded-md px-2 py-1.5 text-sm" required>
                <option value="">Select...</option>
                {availableColors.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Pattern</label>
              <select value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} className="w-full border rounded-md px-2 py-1.5 text-sm">
                <option value="">Select...</option>
                {availablePatterns.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Gender</label>
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="w-full border rounded-md px-2 py-1.5 text-sm">
                {PET_GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Birthday</label>
              <input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} className="w-full border rounded-md px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Favourite Food</label>
              <input value={form.favouriteFood} onChange={(e) => setForm({ ...form, favouriteFood: e.target.value })} className="w-full border rounded-md px-2 py-1.5 text-sm" placeholder="Chicken, Salmon..." />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Medical Alerts</label>
              <input value={form.medicalAlerts} onChange={(e) => setForm({ ...form, medicalAlerts: e.target.value })} className="w-full border rounded-md px-2 py-1.5 text-sm" placeholder="Allergies..." />
            </div>
          </div>
          <div className="border-t pt-3">
            <label className="block text-xs text-gray-500 mb-1 font-medium">Pet Photos (up to 5)</label>
            <PhotoManager photos={photos} onChange={setPhotos} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 flex items-center gap-1"><Save size={14} /> {editingPet ? 'Update' : 'Create'}</button>
            <button type="button" onClick={cancelForm} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <form onSubmit={handleSearch}>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="w-40">
              <label className="block text-xs font-medium text-gray-500 mb-1">Pet Type</label>
              <select value={petType} onChange={(e) => setPetType(e.target.value)} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm">
                <option value="">All Types</option>
                {PET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[160px] max-w-xs">
              <label className="block text-xs font-medium text-gray-500 mb-1">Pet Name</label>
              <input type="text" placeholder="Search name..." value={petName} onChange={(e) => setPetName(e.target.value)} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
            </div>
            <div className="w-44">
              <label className="block text-xs font-medium text-gray-500 mb-1">Breed</label>
              <select value={petBreed} onChange={(e) => setPetBreed(e.target.value)} disabled={!petType} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm disabled:opacity-50">
                <option value="">{petType ? 'All Breeds' : 'Select type'}</option>
                {(PET_BREEDS[petType] || []).map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="border border-gray-300 rounded-md px-2 py-1.5 text-sm">
                <option value="">All</option><option value="safe">Safe</option><option value="lost">Lost</option><option value="found">Found</option><option value="deceased">Deceased</option><option value="stolen">Stolen</option><option value="transferred">Transferred</option><option value="donated">Donated</option><option value="sold">Sold</option>
              </select>
            </div>
            <button type="submit" className="bg-primary-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-primary-700 flex items-center gap-1"><Search size={12} /> Search</button>
            {hasActiveFilters && <button type="button" onClick={clearFilters} className="text-gray-500 hover:text-red-600 text-sm px-2">Clear</button>}
          </div>
          <button type="button" onClick={() => setShowFilters(!showFilters)} className="mt-2 text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1">
            {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Owner Filters
          </button>
          {showFilters && (
            <div className="mt-2 grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
              <input placeholder="Owner name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm" />
              <input placeholder="Owner email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm" />
              <input placeholder="Owner phone" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm" />
            </div>
          )}
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500 w-10">Photo</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">Pet ID</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">Name</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">Tag</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">Type</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">Breed</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">Color</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">Gender</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">Owner</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">Status</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">Lost#</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={11} className="px-4 py-6 text-center text-gray-500">Loading...</td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={11} className="px-4 py-6 text-center text-gray-500">No pets found</td></tr>
            ) : data?.items.map((pet: any) => {
              const mainPhoto = pet.photos?.length > 0 ? (pet.photos.find((p: any) => p.isMain) || pet.photos[0])?.url : pet.photoUrl;
              const breedDisplay = pet.breed === 'Mixed Breed' && pet.secondaryBreed && pet.secondaryBreed !== 'Unknown' ? `Mixed (${pet.secondaryBreed})` : pet.breed;
              const genderLabel = pet.gender === 'male' ? 'Male' : pet.gender === 'female' ? 'Female' : 'Unknown';
              return (
                <tr key={pet._id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    {mainPhoto ? <img src={mainPhoto} alt="" className="w-8 h-8 rounded-full object-cover border" onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="%23f3f4f6" rx="16"/><text x="16" y="19" text-anchor="middle" fill="%239ca3af" font-size="9">?</text></svg>'; }} />
                      : <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">?</div>}
                  </td>
                  <td className="px-3 py-2 text-xs font-mono text-gray-500">{pet.petId || '—'}</td>
                  <td className="px-3 py-2 font-medium text-sm">{pet.name}{pet.photos?.length > 1 && <span className="text-gray-400 text-xs ml-1">({pet.photos.length})</span>}</td>
                  <td className="px-3 py-2">
                    {pet.linkedTag ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono rounded bg-primary-50 text-primary-700 border border-primary-200">
                        {pet.linkedTag.tagId}
                        <span className={`w-1.5 h-1.5 rounded-full ${pet.linkedTag.status === 'active' ? 'bg-green-500' : pet.linkedTag.status === 'lost' ? 'bg-red-500' : 'bg-gray-400'}`} />
                      </span>
                    ) : <span className="text-gray-300 text-xs">No tag</span>}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-600">{pet.petType}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{breedDisplay}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{pet.color}</td>
                  <td className="px-3 py-2 text-sm text-gray-500">{genderLabel}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{pet.ownerId?.fullName || 'N/A'}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-1 text-sm rounded-full font-medium ${
                      pet.status === 'safe' ? 'bg-green-100 text-green-700' :
                      pet.status === 'lost' ? 'bg-red-100 text-red-700' :
                      pet.status === 'found' ? 'bg-yellow-100 text-yellow-700' :
                      pet.status === 'deceased' ? 'bg-gray-100 text-gray-700' :
                      pet.status === 'stolen' ? 'bg-purple-100 text-purple-700' :
                      pet.status === 'transferred' ? 'bg-blue-100 text-blue-700' :
                      pet.status === 'donated' ? 'bg-teal-100 text-teal-700' :
                      pet.status === 'sold' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{pet.status}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                      (pet.lostCount || 0) === 0 ? 'bg-green-100 text-green-700' :
                      (pet.lostCount || 0) <= 2 ? 'bg-amber-100 text-amber-700' :
                      (pet.lostCount || 0) <= 4 ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>{pet.lostCount || 0}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1.5 items-center flex-wrap">
                      <button onClick={() => startEdit(pet)} className="text-primary-500 hover:text-primary-700 p-1.5 rounded hover:bg-primary-50" title="Edit"><Edit2 size={15} /></button>
                      {pet.status !== 'lost' && (
                        <button onClick={async () => { await api.put(`/admin/pets/${pet._id}/status`, { status: 'lost' }); fetchPets(); }} className="bg-red-50 text-red-700 hover:bg-red-100 text-xs px-2 py-1 rounded border border-red-200 font-medium" title="Mark Lost">Lost</button>
                      )}
                      {pet.status !== 'found' && (
                        <button onClick={async () => { await api.put(`/admin/pets/${pet._id}/status`, { status: 'found' }); fetchPets(); }} className="bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs px-2 py-1 rounded border border-amber-200 font-medium" title="Mark Found">Found</button>
                      )}
                      {pet.status !== 'safe' && (
                        <button onClick={async () => { await api.put(`/admin/pets/${pet._id}/status`, { status: 'safe' }); fetchPets(); }} className="bg-green-50 text-green-700 hover:bg-green-100 text-xs px-2 py-1 rounded border border-green-200 font-medium" title="Mark Safe">Safe</button>
                      )}
                      {pet.status !== 'deceased' && (
                        <button onClick={async () => { await api.put(`/admin/pets/${pet._id}/status`, { status: 'deceased' }); fetchPets(); }} className="bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs px-2 py-1 rounded border border-gray-300 font-medium" title="Mark Deceased">Deceased</button>
                      )}
                      {pet.status !== 'stolen' && (
                        <button onClick={async () => { await api.put(`/admin/pets/${pet._id}/status`, { status: 'stolen' }); fetchPets(); }} className="bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs px-2 py-1 rounded border border-purple-200 font-medium" title="Mark Stolen">Stolen</button>
                      )}
                      {pet.status !== 'transferred' && (
                        <button onClick={async () => { await api.put(`/admin/pets/${pet._id}/status`, { status: 'transferred' }); fetchPets(); }} className="bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs px-2 py-1 rounded border border-blue-200 font-medium" title="Mark Transferred">Transferred</button>
                      )}
                      {pet.status !== 'donated' && (
                        <button onClick={async () => { await api.put(`/admin/pets/${pet._id}/status`, { status: 'donated' }); fetchPets(); }} className="bg-teal-50 text-teal-700 hover:bg-teal-100 text-xs px-2 py-1 rounded border border-teal-200 font-medium" title="Mark Donated">Donated</button>
                      )}
                      {pet.status !== 'sold' && (
                        <button onClick={async () => { await api.put(`/admin/pets/${pet._id}/status`, { status: 'sold' }); fetchPets(); }} className="bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs px-2 py-1 rounded border border-amber-200 font-medium" title="Mark Sold">Sold</button>
                      )}
                      <button onClick={() => deletePet(pet._id)} className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">{data.total} total pets</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
            <span className="px-3 py-1">Page {page} of {data.totalPages}</span>
            <button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
