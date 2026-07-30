import { useState, useRef } from 'react';
import { Camera, Upload, Star, X } from 'lucide-react';
import api from '../lib/api';

export interface PhotoItem { url: string; caption?: string; isMain: boolean; }

export default function PhotoManager({ photos, onChange }: { photos: PhotoItem[]; onChange: (photos: PhotoItem[]) => void }) {
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

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    addPhoto(urlInput, captionInput);
    setUrlInput('');
    setCaptionInput('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photos.length >= 5) { setError('Maximum 5 photos allowed'); return; }

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
    if (!allowed.includes(file.type)) { setError('Only jpg, png, gif, webp images are allowed'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('File too large. Maximum size is 5MB.'); return; }

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

  const setMain = (idx: number) => {
    onChange(photos.map((p, i) => ({ ...p, isMain: i === idx })));
  };

  const mainPhoto = photos.find((p) => p.isMain);

  return (
    <div className="space-y-3">
      <label className="block text-xs text-gray-500 font-medium">Pet Photos (up to 5)</label>
      {mainPhoto && (
        <div className="relative w-full h-48 rounded-lg overflow-hidden border-2 border-primary-300 bg-gray-100">
          <img src={mainPhoto.url} alt="Main photo" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span className="absolute top-2 left-2 bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1"><Star size={10} fill="currentColor" /> Main Photo</span>
        </div>
      )}
      {photos.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {photos.map((photo, idx) => (
            <div key={idx} className={`relative group rounded-lg overflow-hidden border-2 ${photo.isMain ? 'border-primary-500' : 'border-gray-200'} aspect-square`}>
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
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="bg-primary-50 border border-primary-200 rounded-md px-3 py-2 text-sm text-primary-700 hover:bg-primary-100 flex items-center gap-1 disabled:opacity-50"><Upload size={14} /> {uploading ? 'Uploading...' : 'Upload from Device'}</button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
