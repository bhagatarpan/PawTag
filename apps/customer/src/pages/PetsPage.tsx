import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, AlertTriangle, CheckCircle, Star, X, Edit2, Save, ShieldAlert, ShieldCheck, ShoppingBag, ChevronRight, Clock, Skull, EyeOff, Activity, Info, CreditCard, QrCode } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import PhotoManager from '../components/PhotoManager';
import type { PhotoItem } from '../components/PhotoManager';
import HealthRecords from './HealthRecords';
import { PET_TYPES, PET_COLORS, PET_PATTERNS, PET_GENDERS, emptyForm } from '../constants/petOptions';
import { BREED_ORIGINS, getBreedsForOrigin } from '@pawtag/shared';
import type { PetType } from '@pawtag/shared';

export default function PetsPage() {
  const { } = useAuth();
  const navigate = useNavigate();
  const [pets, setPets] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPet, setEditingPet] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [foundTimers, setFoundTimers] = useState<Record<string, string>>({});
  const [timeToFoundMsg, setTimeToFoundMsg] = useState('');
  const [healthPet, setHealthPet] = useState<any>(null);
  const [unredeemedCount, setUnredeemedCount] = useState(0);

  const refreshPets = () => api.get('/customer/pets').then((r) => setPets(r.data.data)).catch(console.error);
  useEffect(() => { refreshPets(); }, []);

  useEffect(() => {
    api.get('/customer/tags/unredeemed-count').then((r) => setUnredeemedCount(r.data.data.count)).catch(() => {});
  }, []);

  useEffect(() => {
    const foundPets = pets.filter((p) => p.status === 'found');
    foundPets.forEach((pet) => {
      api.get(`/customer/pets/${pet._id}/found-timer`).then((r) => {
        if (r.data.data.active) {
          setFoundTimers((prev) => ({ ...prev, [pet._id]: r.data.data }));
        }
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
    const payload: any = { ...form, species: form.petType, photos };
    if (form.breedOrigin !== 'Mixed Breed' && form.breedOrigin !== 'Designer Breed') payload.secondaryBreed = 'Unknown';
    if (form.age) payload.age = parseFloat(form.age);
    if (!payload.dateOfBirth) delete payload.dateOfBirth;
    try {
      if (editingPet) { await api.put(`/customer/pets/${editingPet._id}`, payload); } else { await api.post('/customer/pets', payload); }
      cancelForm();
      refreshPets();
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
    await api.post(`/customer/pets/${id}/mark-terminal`, { reason });
    refreshPets();
  };
  const deletePet = async (id: string) => { if (confirm('Delete this pet?')) { await api.delete(`/customer/pets/${id}`); refreshPets(); } };

  const getMainPhoto = (pet: any): string | null => {
    if (pet.photos?.length > 0) { const m = pet.photos.find((p: any) => p.isMain); return m ? m.url : pet.photos[0].url; }
    return pet.photoUrl || null;
  };

  const formatBreed = (pet: any) => {
    const origin = pet.breedOrigin || 'Purebred';
    const breed = pet.breed || '';
    const secondary = pet.secondaryBreed || '';
    if (origin === 'Unknown') return 'Unknown';
    if ((origin === 'Mixed Breed' || origin === 'Designer Breed') && secondary && secondary !== 'Unknown') {
      return `${origin === 'Designer Breed' ? 'Designer' : 'Mixed'} (${breed} × ${secondary})`;
    }
    if (origin === 'Landrace') return `${breed} (Landrace)`;
    return breed;
  };

  const genderLabel = (g: string) => g === 'male' ? 'Male' : g === 'female' ? 'Female' : 'Unknown';

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Pets</h1>
        <button onClick={startAdd} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm flex items-center gap-2 hover:bg-primary-700"><Plus size={16} /> Add Pet</button>
      </div>

      {unredeemedCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center gap-4">
          <QrCode size={24} className="text-blue-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-blue-800">You have {unredeemedCount} unredeemed tag{unredeemedCount > 1 ? 's' : ''}</p>
            <p className="text-sm text-blue-600">Activate your tag to link it to a pet profile and start protecting them.</p>
          </div>
          <button
            onClick={() => navigate('/redeem-tag')}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Activate Now
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 mb-6 space-y-4">
          <h2 className="text-lg font-semibold">{editingPet ? `Edit ${editingPet.name}` : 'Add New Pet'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs text-gray-500 mb-1">Pet Name *</label><input placeholder="Pet Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required disabled={!!editingPet} />{editingPet && <p className="text-xs text-gray-400 mt-1">Name cannot be changed after creation</p>}</div>
            <div><label className="block text-xs text-gray-500 mb-1">Pet Type *</label><select value={form.petType} onChange={(e) => handleTypeChange(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required>{PET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div className="relative">
              <label className="block text-xs text-gray-500 mb-1">Breed Origin *</label>
              <div className="flex items-center gap-1">
                <select value={form.breedOrigin} onChange={(e) => handleBreedOriginChange(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required>
                  {BREED_ORIGINS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span className="group relative flex-shrink-0">
                  <Info size={14} className="text-gray-400 cursor-help" />
                  <span className="absolute right-0 top-6 z-50 w-64 p-2 text-xs text-white bg-gray-800 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    {BREED_ORIGINS.find((o) => o.value === form.breedOrigin)?.tooltip}
                  </span>
                </span>
              </div>
            </div>
            <div><label className="block text-xs text-gray-500 mb-1">{showSecondaryBreed ? 'Primary Breed *' : 'Breed *'}</label><select value={form.breed} onChange={(e) => handleBreedChange(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required><option value="">{form.breedOrigin === 'Unknown' ? 'Unknown' : 'Select breed...'}</option>{availableBreeds.map((b) => <option key={b} value={b}>{b}</option>)}</select></div>
            {showSecondaryBreed && <div><label className="block text-xs text-gray-500 mb-1">Secondary Breed *</label><select value={form.secondaryBreed} onChange={(e) => setForm({ ...form, secondaryBreed: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required><option value="">Select...</option>{availableBreeds.filter((b) => b !== form.breed).map((b) => <option key={b} value={b}>{b}</option>)}</select></div>}
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
            <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 flex items-center gap-1"><Save size={14} /> {editingPet ? 'Update Pet' : 'Save Pet'}</button>
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
                {mainPhoto && <div className="h-40 bg-gray-100 relative"><img src={mainPhoto} alt={pet.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /></div>}
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold">{pet.name}</h3>
                      {pet.petId && <p className="text-sm text-gray-400 font-mono">ID: {pet.petId}</p>}
                      {pet.linkedTag && <p className="text-sm text-primary-600 font-mono mt-0.5">Tag: {pet.linkedTag.tagId}<span className={`ml-1.5 inline-block w-2 h-2 rounded-full ${pet.linkedTag.status === 'active' ? 'bg-green-500' : pet.linkedTag.status === 'lost' ? 'bg-red-500' : 'bg-gray-400'}`} /><span className="ml-1 text-gray-400 font-sans">({pet.linkedTag.status})</span></p>}
                      {!pet.linkedTag && <p className="text-sm text-gray-300 mt-0.5">No tag linked</p>}
                      {pet.linkedTag?.subscription && (
                        <div className="mt-2 p-2 bg-teal-50 rounded-lg border border-teal-100">
                          <div className="flex items-center gap-1.5 text-xs text-teal-700 font-medium">
                            <CreditCard size={12} />
                            <span>{pet.linkedTag.subscription.productName}</span>
                            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                              pet.linkedTag.subscription.status === 'active' ? 'bg-green-100 text-green-700' :
                              pet.linkedTag.subscription.status === 'grace_period' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {pet.linkedTag.subscription.status === 'active' ? 'Active' :
                               pet.linkedTag.subscription.status === 'grace_period' ? 'Expiring Soon' : 'Expired'}
                            </span>
                          </div>
                          <p className="text-[11px] text-teal-600 mt-0.5">
                            ${pet.linkedTag.subscription.price}/mo · {pet.linkedTag.subscription.autoRenew ? 'Auto-renew on' : 'Auto-renew off'}
                          </p>
                          {(pet.linkedTag.subscription.status === 'grace_period' || pet.linkedTag.subscription.status === 'expired') && (
                            <button
                              onClick={() => navigate('/subscriptions')}
                              className="mt-2 px-3 py-1.5 bg-primary-600 text-white rounded-md text-xs font-medium hover:bg-primary-700"
                            >
                              Renew Subscription
                            </button>
                          )}
                        </div>
                      )}
                      {pet.linkedTag && !pet.linkedTag.subscription && (
                        <p className="text-xs text-gray-400 mt-1 italic">No active subscription</p>
                      )}
                      <p className="text-base text-gray-600 mt-1">{pet.petType || pet.species} — {formatBreed(pet)}</p>
                      <p className="text-sm text-gray-400">Origin: {pet.breedOrigin || 'Purebred'}</p>
                      {pet.secondaryBreed && pet.secondaryBreed !== 'Unknown' && <p className="text-sm text-gray-400">Secondary: {pet.secondaryBreed}</p>}
                      <p className="text-base text-gray-500">Color: {pet.color}{pet.pattern ? ` | Pattern: ${pet.pattern}` : ''}</p>
                      <p className="text-base text-gray-500">Gender: {genderLabel(pet.gender)}{pet.age != null ? ` | Age: ${pet.age} yrs` : ''}</p>
                      {pet.favouriteFood && <p className="text-base text-gray-500">Fav Food: {pet.favouriteFood}</p>}
                      {pet.photos?.length > 1 && <p className="text-sm text-gray-400 mt-1">{pet.photos.length} photos</p>}
                      {pet.medicalAlerts && <p className="text-base text-red-600 mt-1 flex items-center gap-1"><AlertTriangle size={16} /> {pet.medicalAlerts}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-3 border-t flex-wrap">
                    <button onClick={() => startEdit(pet)} className="bg-primary-50 text-primary-700 hover:bg-primary-100 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 border border-primary-200"><Edit2 size={14} /> Edit</button>
                    <button onClick={() => setHealthPet(pet)} className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 border border-blue-200"><Activity size={14} /> Health Records</button>
                    {pet.status === 'safe' ? (
                      <button onClick={() => markLost(pet._id)} className="bg-red-50 text-red-700 hover:bg-red-100 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 border border-red-200">
                        <ShieldAlert size={14} /> Mark as Lost
                      </button>
                    ) : pet.status === 'lost' || pet.status === 'found' ? (
                      <>
                        <button onClick={() => markFound(pet._id)} className="bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 border border-green-200">
                          <CheckCircle size={14} /> Mark as Found
                        </button>
                        <button onClick={() => markTerminal(pet._id, 'stolen')} className="bg-purple-50 text-purple-700 hover:bg-purple-100 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 border border-purple-200">
                          <EyeOff size={14} /> Stolen
                        </button>
                        <button onClick={() => markTerminal(pet._id, 'deceased')} className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 border border-gray-300">
                          <Skull size={14} /> Deceased
                        </button>
                        <button onClick={() => markTerminal(pet._id, 'transferred')} className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 border border-blue-200">
                          <ChevronRight size={14} /> Transferred
                        </button>
                        <button onClick={() => markTerminal(pet._id, 'donated')} className="bg-teal-50 text-teal-700 hover:bg-teal-100 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 border border-teal-200">
                          <Star size={14} /> Donated
                        </button>
                        <button onClick={() => markTerminal(pet._id, 'sold')} className="bg-amber-50 text-amber-700 hover:bg-amber-100 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 border border-amber-200">
                          <ShoppingBag size={14} /> Sold
                        </button>
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
