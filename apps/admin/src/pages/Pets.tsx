import { useState, useRef, useEffect, useCallback } from 'react';
import api, { PaginatedData } from '../lib/api';
import { toast } from '../lib/toast';
import {
  Search, X, ChevronDown, ChevronLeft, ChevronRight, Download,
  Trash2, Plus, Edit2, Save, Camera, Star, Upload, Info,
  Loader2, AlertTriangle, Users as UsersIcon, Dog, Cat,
  Activity, CheckCircle, AlertCircle, Clock, Copy, Settings,
  Database, FileText, User, Shield, Lock, Unlock, RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { BREED_ORIGINS, getBreedsForOrigin, PET_BREEDS } from '@pawtag/shared';
import type { PetType } from '@pawtag/shared';
import { DetailDrawer as UserDetailDrawer, type UserRecord } from './Users';
import { DetailDrawer as TagDetailDrawer, type TagItem } from './Tags';

/* ------------------------------------------------------------------ */
/*  Pet attribute options                                              */
/* ------------------------------------------------------------------ */

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

const PET_STATUSES = ['safe', 'lost', 'found', 'deceased', 'stolen', 'transferred', 'donated', 'sold'] as const;

const emptyForm = {
  name: '', petType: 'Dog', breedOrigin: 'Purebred', breed: '', secondaryBreed: 'Unknown', color: '', pattern: '',
  gender: 'unknown', dateOfBirth: '', favouriteFood: '', medicalAlerts: '', ownerId: '',
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PhotoItem { url: string; caption?: string; isMain: boolean; }

export interface PetRecord {
  _id: string;
  petId?: string;
  name: string;
  petType: string;
  breedOrigin?: string;
  breed: string;
  secondaryBreed?: string;
  color: string;
  pattern?: string;
  gender: string;
  dateOfBirth?: string;
  favouriteFood?: string;
  medicalAlerts?: string;
  status: string;
  lostCount?: number;
  photoUrl?: string;
  photos?: PhotoItem[];
  ownerId?: { _id: string; fullName: string; email: string; phoneNumber?: string };
  linkedTag?: { _id: string; tagId: string; status: string } | null;
  createdAt: string;
}

interface SummaryData {
  total: number;
  dogs: number;
  cats: number;
  other: number;
  lost: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copied to clipboard'),
    () => toast.error('Failed to copy'),
  );
}

function getStatusBadge(status: string): { className: string; icon: React.ReactNode } {
  switch (status) {
    case 'safe': return { className: 'bg-emerald-100 text-emerald-700 border border-emerald-200', icon: <CheckCircle size={13} /> };
    case 'lost': return { className: 'bg-red-100 text-red-700 border border-red-200', icon: <AlertCircle size={13} /> };
    case 'found': return { className: 'bg-amber-100 text-amber-700 border border-amber-200', icon: <Clock size={13} /> };
    case 'deceased': return { className: 'bg-gray-100 text-gray-600 border border-gray-200', icon: <AlertCircle size={13} /> };
    case 'stolen': return { className: 'bg-purple-100 text-purple-700 border border-purple-200', icon: <Shield size={13} /> };
    case 'transferred': return { className: 'bg-blue-100 text-blue-700 border border-blue-200', icon: <Activity size={13} /> };
    case 'donated': return { className: 'bg-teal-100 text-teal-700 border border-teal-200', icon: <Activity size={13} /> };
    case 'sold': return { className: 'bg-amber-100 text-amber-700 border border-amber-200', icon: <Activity size={13} /> };
    default: return { className: 'bg-gray-100 text-gray-600 border border-gray-200', icon: <Info size={13} /> };
  }
}

function formatStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="w-8 h-8 rounded-full bg-gray-200" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-24" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-32" /></td>
      <td className="px-4 py-3 hidden lg:table-cell"><div className="h-5 bg-gray-200 rounded-full w-16" /></td>
      <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 bg-gray-200 rounded w-20" /></td>
      <td className="px-4 py-3 hidden xl:table-cell"><div className="h-5 bg-gray-200 rounded-full w-20" /></td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Photo Manager                                                      */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Detail Drawer                                                      */
/* ------------------------------------------------------------------ */

export function DetailDrawer({
  pet,
  onClose,
  onRefresh,
  owners,
}: {
  pet: PetRecord | null;
  onClose: () => void;
  onRefresh: () => void;
  owners: any[];
}) {
  const [activeTab, setActiveTab] = useState<'profile' | 'settings'>('profile');
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const [selectedOwner, setSelectedOwner] = useState<UserRecord | null>(null);
  const [selectedTag, setSelectedTag] = useState<TagItem | null>(null);
  const [selectedTagLoading, setSelectedTagLoading] = useState(false);
  const [rbacRoles, setRbacRoles] = useState<any[]>([]);

  // Fetch RBAC roles for user drawer
  useEffect(() => {
    api.get('/admin/rbac/roles').then((r) => setRbacRoles(r.data.data || [])).catch(() => {});
  }, []);

  const handleTagClick = async (tagId: string) => {
    setSelectedTagLoading(true);
    try {
      const res = await api.get(`/admin/tags/${tagId}`);
      setSelectedTag(res.data.data);
    } catch {
      toast.error('Failed to load tag details');
    } finally {
      setSelectedTagLoading(false);
    }
  };

  const handleOwnerClick = async (ownerId: string) => {
    try {
      const res = await api.get(`/admin/users/${ownerId}`);
      setSelectedOwner(res.data.data);
    } catch {
      toast.error('Failed to load owner details');
    }
  };

  useEffect(() => {
    if (!pet) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [pet, onClose]);

  useEffect(() => {
    if (pet) {
      setForm({
        name: pet.name, petType: pet.petType || 'Dog', breedOrigin: pet.breedOrigin || 'Purebred',
        breed: pet.breed || '', secondaryBreed: pet.secondaryBreed || 'Unknown',
        color: pet.color || '', pattern: pet.pattern || '', gender: pet.gender || 'unknown',
        dateOfBirth: pet.dateOfBirth ? pet.dateOfBirth.split('T')[0] : '', favouriteFood: pet.favouriteFood || '',
        medicalAlerts: pet.medicalAlerts || '', ownerId: typeof pet.ownerId === 'object' ? pet.ownerId?._id || '' : pet.ownerId || '',
      });
      setPhotos(pet.photos || []);
      setEditMode(false);
      setEditError('');
      setActiveTab('profile');
    }
  }, [pet]);

  if (!pet) return null;

  const handleEditSave = async () => {
    setEditSaving(true);
    setEditError('');
    try {
      const payload: any = { ...form, species: form.petType, photos };
      if (form.breedOrigin !== 'Mixed Breed' && form.breedOrigin !== 'Designer Breed') payload.secondaryBreed = 'Unknown';
      await api.put(`/admin/pets/${pet._id}`, payload);
      toast.success('Pet updated');
      setEditMode(false);
      onRefresh();
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Failed to update');
    } finally {
      setEditSaving(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    setActionLoading('status');
    try {
      await api.put(`/admin/pets/${pet._id}/status`, { status });
      toast.success(`Status changed to ${formatStatusLabel(status)}`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete pet "${pet.name}"? This cannot be undone.`)) return;
    setActionLoading('delete');
    try {
      await api.delete(`/admin/pets/${pet._id}`);
      toast.success('Pet deleted');
      onClose();
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    } finally {
      setActionLoading(null);
    }
  };

  const availableColors = form.petType ? PET_COLORS[form.petType] || [] : [];
  const availablePatterns = form.petType ? PET_PATTERNS[form.petType] || [] : [];
  const availableBreeds = form.petType ? getBreedsForOrigin(form.petType as PetType, form.breedOrigin) : [];
  const showSecondaryBreed = form.breedOrigin === 'Mixed Breed' || form.breedOrigin === 'Designer Breed';

  const tabs = [
    { key: 'profile' as const, label: 'Profile' },
    { key: 'settings' as const, label: 'Settings' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Pet details: ${pet.name}`}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div ref={drawerRef} className="relative w-full max-w-2xl bg-white shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3 min-w-0">
            {(() => {
              const mainPhoto = pet.photos && pet.photos.length > 0 ? (pet.photos.find((p) => p.isMain) || pet.photos[0])?.url : pet.photoUrl;
              return mainPhoto ? (
                <img src={mainPhoto} alt="" className="w-10 h-10 rounded-full object-cover border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                  <span className="text-primary-600 text-lg">🐾</span>
                </div>
              );
            })()}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate">{pet.name}</h2>
              <p className="text-sm text-gray-500 truncate">{pet.breed} · {pet.petType}</p>
            </div>
            {(() => {
              const badge = getStatusBadge(pet.status);
              return (
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badge.className}`}>
                  {badge.icon} {formatStatusLabel(pet.status)}
                </span>
              );
            })()}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {editMode ? (
                <Section title="Edit Pet" icon={<Edit2 size={16} />}>
                  {editError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded mb-3">{editError}</div>}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Pet Name *</label>
                      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required disabled />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Pet Type *</label>
                      <select value={form.petType} onChange={(e) => setForm({ ...form, petType: e.target.value, breed: '', secondaryBreed: 'Unknown', color: '', pattern: '' })} className="w-full border rounded-md px-3 py-2 text-sm">
                        {PET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Breed Origin *</label>
                      <select value={form.breedOrigin} onChange={(e) => setForm({ ...form, breedOrigin: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm">
                        {BREED_ORIGINS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">{showSecondaryBreed ? 'Primary Breed *' : 'Breed *'}</label>
                      <select value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm">
                        <option value="">Select...</option>
                        {availableBreeds.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    {showSecondaryBreed && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Secondary Breed</label>
                        <select value={form.secondaryBreed} onChange={(e) => setForm({ ...form, secondaryBreed: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm">
                          <option value="">Select...</option>
                          {availableBreeds.filter((b) => b !== form.breed).map((b) => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Color *</label>
                      <select value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm">
                        <option value="">Select...</option>
                        {availableColors.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Pattern</label>
                      <select value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm">
                        <option value="">Select...</option>
                        {availablePatterns.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Gender</label>
                      <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm">
                        {PET_GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Birthday</label>
                      <input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Favourite Food</label>
                      <input value={form.favouriteFood} onChange={(e) => setForm({ ...form, favouriteFood: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Medical Alerts</label>
                      <input value={form.medicalAlerts} onChange={(e) => setForm({ ...form, medicalAlerts: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Owner *</label>
                      <select value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm">
                        <option value="">Select owner...</option>
                        {owners.map((o: any) => <option key={o._id} value={o._id}>{o.fullName} ({o.email})</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="border-t pt-3 mt-3">
                    <label className="block text-xs text-gray-500 mb-1 font-medium">Pet Photos (up to 5)</label>
                    <PhotoManager photos={photos} onChange={setPhotos} />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleEditSave} disabled={editSaving} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 flex items-center gap-1 disabled:opacity-50">
                      {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
                    </button>
                    <button onClick={() => { setEditMode(false); setEditError(''); setPhotos(pet.photos || []); }} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
                  </div>
                </Section>
              ) : (
                <>
                  <Section title="Pet Details" icon={<Dog size={16} />}>
                    {pet.petId && <DetailRow label="Pet ID" value={
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs">{pet.petId}</span>
                        <button onClick={() => copyToClipboard(pet.petId!)} className="text-gray-400 hover:text-gray-600"><Copy size={12} /></button>
                      </span>
                    } />}
                    <DetailRow label="Name" value={pet.name} />
                    <DetailRow label="Type" value={pet.petType} />
                    <DetailRow label="Breed Origin" value={pet.breedOrigin || 'Purebred'} />
                    <DetailRow label="Breed" value={pet.breed} />
                    {pet.secondaryBreed && pet.secondaryBreed !== 'Unknown' && (
                      <DetailRow label="Secondary Breed" value={pet.secondaryBreed} />
                    )}
                    <DetailRow label="Color" value={pet.color} />
                    {pet.pattern && <DetailRow label="Pattern" value={pet.pattern} />}
                    <DetailRow label="Gender" value={pet.gender === 'male' ? 'Male' : pet.gender === 'female' ? 'Female' : 'Unknown'} />
                    {pet.dateOfBirth && <DetailRow label="Birthday" value={formatDate(pet.dateOfBirth)} />}
                    {pet.favouriteFood && <DetailRow label="Favourite Food" value={pet.favouriteFood} />}
                    {pet.medicalAlerts && <DetailRow label="Medical Alerts" value={<span className="text-red-600">{pet.medicalAlerts}</span>} />}
                    <DetailRow label="Created" value={formatDate(pet.createdAt)} />
                    <button onClick={() => setEditMode(true)} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
                      <Edit2 size={13} /> Edit Pet
                    </button>
                  </Section>

                  <Section title="Owner & Tag" icon={<User size={16} />}>
                    {pet.ownerId ? (
                      <>
                        <DetailRow label="Owner" value={
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOwnerClick(pet.ownerId!._id); }}
                            className="text-primary-600 hover:underline font-medium inline-flex items-center gap-1"
                          >
                            {pet.ownerId.fullName}
                            <ExternalLink size={11} className="opacity-50" />
                          </button>
                        } />
                        <DetailRow label="Email" value={
                          <span className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOwnerClick(pet.ownerId!._id); }}
                              className="text-primary-600 hover:underline text-left"
                            >
                              {pet.ownerId.email}
                            </button>
                            <button onClick={() => copyToClipboard(pet.ownerId!.email)} className="text-gray-400 hover:text-gray-600"><Copy size={12} /></button>
                          </span>
                        } />
                        {pet.ownerId.phoneNumber && <DetailRow label="Phone" value={pet.ownerId.phoneNumber} />}
                      </>
                    ) : (
                      <DetailRow label="Owner" value={<span className="text-gray-400 italic">No owner</span>} />
                    )}
                    {pet.linkedTag ? (
                      <DetailRow label="Tag" value={
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTagClick(pet.linkedTag!._id); }}
                          disabled={selectedTagLoading}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 transition-colors disabled:opacity-50"
                        >
                          {selectedTagLoading ? <Loader2 size={10} className="animate-spin" /> : null}
                          {pet.linkedTag.tagId}
                          <span className={`w-1.5 h-1.5 rounded-full ${pet.linkedTag.status === 'active' ? 'bg-green-500' : pet.linkedTag.status === 'lost' ? 'bg-red-500' : 'bg-gray-400'}`} />
                          {!selectedTagLoading && <ExternalLink size={10} className="opacity-50" />}
                        </button>
                      } />
                    ) : (
                      <DetailRow label="Tag" value={<span className="text-gray-400 italic">No tag linked</span>} />
                    )}
                  </Section>

                  <Section title="Photos" icon={<Camera size={16} />}>
                    {pet.photos && pet.photos.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {pet.photos.map((photo, idx) => (
                          <div key={idx} className={`relative rounded overflow-hidden border-2 ${photo.isMain ? 'border-primary-500' : 'border-gray-200'} aspect-square`}>
                            <img src={photo.url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            {photo.isMain && <span className="absolute top-1 left-1 bg-primary-600 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-0.5"><Star size={8} fill="currentColor" /> Main</span>}
                          </div>
                        ))}
                      </div>
                    ) : pet.photoUrl ? (
                      <img src={pet.photoUrl} alt="" className="w-32 h-32 rounded object-cover border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <p className="text-sm text-gray-400">No photos</p>
                    )}
                  </Section>

                  <Section title="Quick Actions" icon={<Settings size={16} />}>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setEditMode(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
                        <Edit2 size={13} /> Edit
                      </button>
                      {PET_STATUSES.filter((s) => s !== pet.status).map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(s)}
                          disabled={actionLoading === 'status'}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                            s === 'lost' ? 'text-red-700 bg-red-50 hover:bg-red-100' :
                            s === 'safe' ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' :
                            'text-gray-600 bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          {actionLoading === 'status' && <Loader2 size={12} className="animate-spin" />}
                          {formatStatusLabel(s)}
                        </button>
                      ))}
                    </div>
                  </Section>
                </>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <Section title="Status Management" icon={<Settings size={16} />}>
                <div className="flex flex-wrap gap-2">
                  {PET_STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      disabled={pet.status === s || actionLoading === 'status'}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                        pet.status === s
                          ? 'bg-primary-100 text-primary-700 border border-primary-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {formatStatusLabel(s)}
                    </button>
                  ))}
                </div>
              </Section>

              <Section title="Danger Zone" icon={<Trash2 size={16} />}>
                <p className="text-sm text-gray-500 mb-3">Permanently delete this pet. This action cannot be undone.</p>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading === 'delete'}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg disabled:opacity-50"
                >
                  {actionLoading === 'delete' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete Pet
                </button>
              </Section>
            </div>
          )}
        </div>
      </div>

      {/* Nested Drawer: Owner */}
      <UserDetailDrawer
        user={selectedOwner}
        onClose={() => setSelectedOwner(null)}
        onRefresh={() => { setSelectedOwner(null); onRefresh(); }}
        rbacRoles={rbacRoles}
      />

      {/* Nested Drawer: Tag */}
      <TagDetailDrawer
        tag={selectedTag}
        onClose={() => setSelectedTag(null)}
        onRefresh={() => { setSelectedTag(null); onRefresh(); }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small reusable components for the drawer                           */
/* ------------------------------------------------------------------ */

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-gray-400">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="pl-6">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-1.5 text-sm">
      <span className="text-gray-400 w-28 shrink-0">{label}</span>
      <span className="text-gray-700 min-w-0">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function Pets() {
  // Data state
  const [data, setData] = useState<PaginatedData<PetRecord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Summary
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [petType, setPetType] = useState('');
  const [petBreed, setPetBreed] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [showOwnerFilters, setShowOwnerFilters] = useState(false);

  // UI state
  const [selectedPet, setSelectedPet] = useState<PetRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPet, setEditingPet] = useState<PetRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [formSaving, setFormSaving] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [search]);

  // Fetch owners for the form
  useEffect(() => {
    api.get('/admin/users', { params: { limit: 500 } }).then((r) => setOwners(r.data.data.items || [])).catch(console.error);
  }, []);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get('/admin/pets', { params: { limit: 10000 } });
      const items = res.data.data.items || [];
      const total = res.data.data.total || 0;
      const dogs = items.filter((p: PetRecord) => p.petType === 'Dog').length;
      const cats = items.filter((p: PetRecord) => p.petType === 'Cat').length;
      const other = total - dogs - cats;
      const lost = items.filter((p: PetRecord) => p.status === 'lost').length;
      setSummary({ total, dogs, cats, other, lost });
    } catch {
      // Non-critical
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // Fetch pets
  const fetchPets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page, limit: pageSize };
      if (debouncedSearch) params.search = debouncedSearch;
      if (petType) params.petType = petType;
      if (petBreed) params.petBreed = petBreed;
      if (statusFilter) params.status = statusFilter;
      if (ownerName) params.ownerName = ownerName;
      if (ownerEmail) params.ownerEmail = ownerEmail;
      if (ownerPhone) params.ownerPhone = ownerPhone;
      const res = await api.get('/admin/pets', { params });
      setData(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load pets');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, petType, petBreed, statusFilter, ownerName, ownerEmail, ownerPhone]);

  useEffect(() => { fetchPets(); }, [fetchPets]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Form handlers
  const startAdd = () => { setEditingPet(null); setForm(emptyForm); setPhotos([]); setShowForm(true); };
  const startEdit = (pet: PetRecord) => {
    setEditingPet(pet);
    setForm({
      name: pet.name, petType: pet.petType || 'Dog', breedOrigin: pet.breedOrigin || 'Purebred',
      breed: pet.breed || '', secondaryBreed: pet.secondaryBreed || 'Unknown',
      color: pet.color || '', pattern: pet.pattern || '', gender: pet.gender || 'unknown',
      dateOfBirth: pet.dateOfBirth ? pet.dateOfBirth.split('T')[0] : '', favouriteFood: pet.favouriteFood || '',
      medicalAlerts: pet.medicalAlerts || '', ownerId: typeof pet.ownerId === 'object' ? pet.ownerId?._id || '' : pet.ownerId || '',
    });
    setPhotos(pet.photos || []);
    setShowForm(true);
  };
  const cancelForm = () => { setShowForm(false); setEditingPet(null); setForm(emptyForm); setPhotos([]); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSaving(true);
    try {
      const payload: any = { ...form, species: form.petType, photos };
      if (form.breedOrigin !== 'Mixed Breed' && form.breedOrigin !== 'Designer Breed') payload.secondaryBreed = 'Unknown';
      if (editingPet) {
        await api.put(`/admin/pets/${editingPet._id}`, payload);
        toast.success('Pet updated');
      } else {
        await api.post('/admin/pets', payload);
        toast.success('Pet created');
      }
      cancelForm();
      fetchPets();
      fetchSummary();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save pet');
    } finally {
      setFormSaving(false);
    }
  };

  // Export
  const handleExport = async (format: 'csv' | 'json') => {
    setExportLoading(true);
    setShowExportMenu(false);
    try {
      const params: Record<string, unknown> = { format, limit: 10000 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (petType) params.petType = petType;
      if (petBreed) params.petBreed = petBreed;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/admin/pets', { params });
      const items = res.data.data.items || [];

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pets-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const headers = ['Name', 'Type', 'Breed', 'Color', 'Gender', 'Status', 'Owner', 'Tag', 'Lost#', 'Created'];
        const rows = items.map((p: PetRecord) => [
          p.name, p.petType, p.breed, p.color,
          p.gender === 'male' ? 'Male' : p.gender === 'female' ? 'Female' : 'Unknown',
          p.status, p.ownerId?.fullName || 'N/A', p.linkedTag?.tagId || 'No tag',
          String(p.lostCount || 0), formatDate(p.createdAt),
        ]);
        const csv = [headers, ...rows].map((r) => r.map((c: string) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pets-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
      toast.success(`Exported ${items.length} pets`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Export failed');
    } finally {
      setExportLoading(false);
    }
  };

  // Filter helpers
  const activeFilters: Array<{ key: string; label: string; clear: () => void }> = [];
  if (debouncedSearch) activeFilters.push({ key: 'search', label: `Search: "${debouncedSearch}"`, clear: () => { setSearch(''); setDebouncedSearch(''); } });
  if (petType) activeFilters.push({ key: 'type', label: `Type: ${petType}`, clear: () => setPetType('') });
  if (petBreed) activeFilters.push({ key: 'breed', label: `Breed: ${petBreed}`, clear: () => setPetBreed('') });
  if (statusFilter) activeFilters.push({ key: 'status', label: `Status: ${formatStatusLabel(statusFilter)}`, clear: () => setStatusFilter('') });
  if (ownerName) activeFilters.push({ key: 'ownerName', label: `Owner: ${ownerName}`, clear: () => setOwnerName('') });
  if (ownerEmail) activeFilters.push({ key: 'ownerEmail', label: `Owner Email: ${ownerEmail}`, clear: () => setOwnerEmail('') });
  if (ownerPhone) activeFilters.push({ key: 'ownerPhone', label: `Owner Phone: ${ownerPhone}`, clear: () => setOwnerPhone('') });

  const clearAllFilters = () => {
    setSearch(''); setDebouncedSearch('');
    setPetType(''); setPetBreed(''); setStatusFilter('');
    setOwnerName(''); setOwnerEmail(''); setOwnerPhone('');
    setPage(1);
  };

  const startIdx = data && data.total > 0 ? (page - 1) * pageSize + 1 : 0;
  const endIdx = data ? Math.min(page * pageSize, data.total) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pet Management</h1>
              <p className="mt-1 text-sm text-gray-500">Manage pet profiles, tags, and status across the platform.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={startAdd} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors">
                <Plus size={15} /> Add Pet
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={exportLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {exportLoading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  Export
                  <ChevronDown size={14} />
                </button>
                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                      <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2">
                        <FileText size={14} /> Export CSV
                      </button>
                      <button onClick={() => handleExport('json')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2">
                        <Database size={14} /> Export JSON
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <SummaryCard label="Total Pets" value={summary.total} icon={<span className="text-xl">🐾</span>} loading={summaryLoading} />
            <SummaryCard label="Dogs" value={summary.dogs} icon={<Dog size={20} />} color="amber" loading={summaryLoading} onClick={() => { setPetType(petType === 'Dog' ? '' : 'Dog'); setPage(1); }} active={petType === 'Dog'} />
            <SummaryCard label="Cats" value={summary.cats} icon={<Cat size={20} />} color="emerald" loading={summaryLoading} onClick={() => { setPetType(petType === 'Cat' ? '' : 'Cat'); setPage(1); }} active={petType === 'Cat'} />
            <SummaryCard label="Other" value={summary.other} icon={<Activity size={20} />} color="primary" loading={summaryLoading} onClick={() => { setPetType(petType === '' ? '' : ''); setPage(1); }} active={petType !== '' && petType !== 'Dog' && petType !== 'Cat'} />
            <SummaryCard label="Lost" value={summary.lost} icon={<AlertCircle size={20} />} color="red" loading={summaryLoading} onClick={() => { setStatusFilter(statusFilter === 'lost' ? '' : 'lost'); setPage(1); }} active={statusFilter === 'lost'} />
          </div>
        )}

        {/* Create/Edit Form */}
        {showForm && (() => {
          const availableColors = form.petType ? PET_COLORS[form.petType] || [] : [];
          const availablePatterns = form.petType ? PET_PATTERNS[form.petType] || [] : [];
          const availableBreeds = form.petType ? getBreedsForOrigin(form.petType as PetType, form.breedOrigin) : [];
          const showSecondaryBreed = form.breedOrigin === 'Mixed Breed' || form.breedOrigin === 'Designer Breed';
          return (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4 mb-6">
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
                <select value={form.petType} onChange={(e) => setForm({ ...form, petType: e.target.value, breed: '', secondaryBreed: 'Unknown', color: '', pattern: '' })} className="w-full border rounded-md px-2 py-1.5 text-sm" required>
                  {PET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="relative">
                <label className="block text-xs text-gray-500 mb-1">Breed Origin *</label>
                <div className="flex items-center gap-1">
                  <select value={form.breedOrigin} onChange={(e) => setForm({ ...form, breedOrigin: e.target.value })} className="w-full border rounded-md px-2 py-1.5 text-sm" required>
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
              <div>
                <label className="block text-xs text-gray-500 mb-1">{showSecondaryBreed ? 'Primary Breed *' : 'Breed *'}</label>
                <select value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} className="w-full border rounded-md px-2 py-1.5 text-sm" required>
                  <option value="">{form.breedOrigin === 'Unknown' ? 'Unknown' : 'Select...'}</option>
                  {availableBreeds.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              {showSecondaryBreed && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Secondary Breed</label>
                  <select value={form.secondaryBreed} onChange={(e) => setForm({ ...form, secondaryBreed: e.target.value })} className="w-full border rounded-md px-2 py-1.5 text-sm">
                    <option value="">Select...</option>
                    {availableBreeds.filter((b) => b !== form.breed).map((b) => <option key={b} value={b}>{b}</option>)}
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
              <button type="submit" disabled={formSaving} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 flex items-center gap-1 disabled:opacity-50">
                {formSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {editingPet ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={cancelForm} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
            </div>
          </form>
          );
        })()}

        {/* Search and Filters */}
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <div className="relative flex-1 min-w-[280px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, breed, or pet ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            {search && (
              <button onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <select
            value={petType}
            onChange={(e) => { setPetType(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Types</option>
            {PET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Statuses</option>
            {PET_STATUSES.map((s) => <option key={s} value={s}>{formatStatusLabel(s)}</option>)}
          </select>
          <button
            onClick={() => setShowOwnerFilters(!showOwnerFilters)}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Owner Filters
            <ChevronDown size={14} className={`transition-transform ${showOwnerFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Owner Filters */}
        {showOwnerFilters && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <div className="grid grid-cols-3 gap-3">
              <input placeholder="Owner name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <input placeholder="Owner email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <input placeholder="Owner phone" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
        )}

        {/* Filter Chips */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {activeFilters.map((f) => (
              <span key={f.key} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200">
                {f.label}
                <button onClick={f.clear} className="hover:bg-primary-200 rounded-full p-0.5 transition-colors" aria-label={`Remove filter: ${f.label}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
            <button onClick={clearAllFilters} className="text-xs text-gray-500 hover:text-gray-700 underline ml-1">
              Clear All
            </button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-10">Photo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Type / Breed</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Tag</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Owner</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden xl:table-cell">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden xl:table-cell">Lost#</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <AlertTriangle size={32} className="text-red-400" />
                      <p className="text-sm text-red-600">{error}</p>
                      <button onClick={fetchPets} className="text-sm text-primary-600 hover:underline flex items-center gap-1">
                        <RotateCcw size={14} /> Try Again
                      </button>
                    </div>
                  </td>
                </tr>
              ) : data?.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-4xl">🐾</span>
                      <p className="text-sm text-gray-500">No pets found</p>
                      {activeFilters.length > 0 && (
                        <button onClick={clearAllFilters} className="text-sm text-primary-600 hover:underline">
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                data?.items.map((pet) => {
              const mainPhoto = pet.photos && pet.photos.length > 0 ? (pet.photos.find((p) => p.isMain) || pet.photos[0])?.url : pet.photoUrl;
                  const genderLabel = pet.gender === 'male' ? 'Male' : pet.gender === 'female' ? 'Female' : 'Unknown';
                  return (
                    <tr key={pet._id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSelectedPet(pet)}>
                      <td className="px-4 py-3">
                        {mainPhoto ? (
                          <img src={mainPhoto} alt="" className="w-8 h-8 rounded-full object-cover border" onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="%23f3f4f6" rx="16"/><text x="16" y="19" text-anchor="middle" fill="%239ca3af" font-size="9">?</text></svg>'; }} />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">?</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{pet.name}</span>
                          {pet.photos && pet.photos.length > 1 && <span className="text-gray-400 text-xs">({pet.photos.length})</span>}
                        </div>
                        {pet.petId && <span className="text-xs font-mono text-gray-400">{pet.petId}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{pet.petType}</span>
                        <span className="text-gray-400 mx-1">·</span>
                        <span className="text-sm text-gray-500">{pet.breed}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {pet.linkedTag ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded bg-primary-50 text-primary-700 border border-primary-200">
                            {pet.linkedTag.tagId}
                            <span className={`w-1.5 h-1.5 rounded-full ${pet.linkedTag.status === 'active' ? 'bg-green-500' : pet.linkedTag.status === 'lost' ? 'bg-red-500' : 'bg-gray-400'}`} />
                          </span>
                        ) : <span className="text-gray-300 text-xs">No tag</span>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-sm text-gray-600">{pet.ownerId?.fullName || 'N/A'}</span>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        {(() => {
                          const badge = getStatusBadge(pet.status);
                          return (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                              {badge.icon} {formatStatusLabel(pet.status)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                          (pet.lostCount || 0) === 0 ? 'bg-emerald-100 text-emerald-700' :
                          (pet.lostCount || 0) <= 2 ? 'bg-amber-100 text-amber-700' :
                          (pet.lostCount || 0) <= 4 ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}>{pet.lostCount || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedPet(pet); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-3">
            <span className="text-sm text-gray-500">
              Showing {startIdx}–{endIdx} of {data.total} pets
            </span>
            <div className="flex items-center gap-3">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              >
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
              <div className="flex gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-3 py-1 text-sm text-gray-700">
                  Page {page} of {data.totalPages}
                </span>
                <button
                  disabled={page >= data.totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Detail Drawer */}
        <DetailDrawer
          pet={selectedPet}
          onClose={() => setSelectedPet(null)}
          onRefresh={() => { fetchPets(); fetchSummary(); }}
          owners={owners}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary Card                                                       */
/* ------------------------------------------------------------------ */

function SummaryCard({
  label, value, icon, color = 'primary', loading, onClick, active,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: 'primary' | 'emerald' | 'red' | 'amber';
  loading?: boolean;
  onClick?: () => void;
  active?: boolean;
}) {
  const colorMap = {
    primary: { bg: 'bg-primary-50', text: 'text-primary-600', border: 'border-primary-200' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
    red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  };
  const c = colorMap[color];

  return (
    <button
      onClick={onClick}
      disabled={!onClick || loading}
      className={`text-left p-4 rounded-xl border transition-all ${
        active ? `${c.bg} ${c.border} ring-2 ring-offset-1 ring-${color === 'primary' ? 'primary' : color}-400` : 'bg-white border-gray-200 hover:border-gray-300'
      } ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-2xl font-bold ${loading ? 'text-gray-300' : 'text-gray-900'}`}>
          {loading ? '—' : value.toLocaleString()}
        </span>
        <span className={`${c.text}`}>{icon}</span>
      </div>
      <span className="text-sm text-gray-500 mt-1 block">{label}</span>
    </button>
  );
}
