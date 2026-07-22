import { useEffect, useState, useRef } from 'react';
import api, { PaginatedData } from '../../lib/api';
import { Upload, Trash2, Search, Grid, List } from 'lucide-react';

interface MediaItem {
  _id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  alt?: string;
  caption?: string;
  title?: string;
  folder?: string;
  tags?: string[];
  createdAt: string;
  uploadedBy?: { fullName: string };
}

export default function CmsMedia() {
  const [data, setData] = useState<PaginatedData<MediaItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = () => {
    setLoading(true);
    api.get('/admin/cms/media', { params: { page, limit: 20, search: search || undefined } })
      .then((res) => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [page]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append('files', file));
      await api.post('/admin/cms/media/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this media file?')) return;
    await api.delete(`/admin/cms/media/${id}`);
    fetchData();
  };

  const handleUpdate = async () => {
    if (!editingMedia) return;
    try {
      await api.put(`/admin/cms/media/${editingMedia._id}`, {
        alt: editingMedia.alt,
        caption: editingMedia.caption,
        title: editingMedia.title,
        tags: editingMedia.tags,
      });
      setEditingMedia(null);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Media Library</h1>
          <p className="text-sm text-gray-500 mt-1">Manage images, videos, and documents</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} className="border border-gray-300 px-3 py-2 rounded-md text-sm">
            {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 flex items-center gap-2 disabled:opacity-50">
            <Upload className="h-4 w-4" /> {uploading ? 'Uploading...' : 'Upload Files'}
          </button>
          <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,application/pdf" onChange={handleUpload} className="hidden" />
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchData()} placeholder="Search media..." className="w-full border border-gray-300 rounded-md pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
          </div>
          <button onClick={fetchData} className="bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-200">Search</button>
        </div>
      </div>

      {/* Media Grid/List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : data?.items.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">No media files found. Upload some files to get started.</div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {data?.items.map((media) => (
            <div key={media._id} className="bg-white border border-gray-200 rounded-lg overflow-hidden group cursor-pointer" onClick={() => setEditingMedia(media)}>
              <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                {media.mimeType.startsWith('image/') ? (
                  <img src={media.url} alt={media.alt || media.originalName} className="w-full h-full object-cover" />
                ) : media.mimeType.startsWith('video/') ? (
                  <div className="text-gray-400 text-xs text-center p-2">Video<br />{media.originalName}</div>
                ) : (
                  <div className="text-gray-400 text-xs text-center p-2">File<br />{media.originalName}</div>
                )}
              </div>
              <div className="p-2">
                <p className="text-xs font-medium truncate">{media.originalName}</p>
                <p className="text-xs text-gray-400">{formatSize(media.size)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-500 w-12"></th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Type</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Size</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Uploaded</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data?.items.map((media) => (
                <tr key={media._id} className="hover:bg-gray-50">
                  <td className="px-5 py-2">
                    {media.mimeType.startsWith('image/') ? <img src={media.url} alt="" className="w-10 h-10 rounded object-cover" /> : <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-400">{media.mimeType.split('/')[1]?.toUpperCase()}</div>}
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-medium">{media.originalName}</div>
                    {media.alt && <div className="text-xs text-gray-400">Alt: {media.alt}</div>}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">{media.mimeType}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">{formatSize(media.size)}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">{new Date(media.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3 flex gap-2">
                    <button onClick={() => setEditingMedia(media)} className="text-primary-600 hover:text-primary-800 text-xs">Edit</button>
                    <button onClick={() => handleDelete(media._id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">Page {data.page} of {data.totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 text-xs border rounded disabled:opacity-50">Previous</button>
            <button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 text-xs border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingMedia && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingMedia(null)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Edit Media</h2>
            {editingMedia.mimeType.startsWith('image/') && <img src={editingMedia.url} alt="" className="w-full h-48 object-cover rounded mb-4" />}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Alt Text</label>
                <input value={editingMedia.alt || ''} onChange={(e) => setEditingMedia({ ...editingMedia, alt: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Caption</label>
                <input value={editingMedia.caption || ''} onChange={(e) => setEditingMedia({ ...editingMedia, caption: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                <input value={editingMedia.title || ''} onChange={(e) => setEditingMedia({ ...editingMedia, title: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tags (comma-separated)</label>
                <input value={(editingMedia.tags || []).join(', ')} onChange={(e) => setEditingMedia({ ...editingMedia, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleUpdate} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700">Save</button>
              <button onClick={() => setEditingMedia(null)} className="border border-gray-300 px-4 py-2 rounded-md text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
