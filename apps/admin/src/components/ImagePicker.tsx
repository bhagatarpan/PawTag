import { useState, useRef, useEffect } from 'react';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';
import { Search, Upload, X, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface MediaItem {
  _id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  alt?: string;
}

interface ImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  label?: string;
}

export default function ImagePicker({ value, onChange, placeholder = 'https://example.com/image.jpg', label }: ImagePickerProps) {
  const [showModal, setShowModal] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMedia = async (pageNum: number = 1, searchTerm: string = '') => {
    setLoading(true);
    try {
      const res = await api.get(API.admin.cms.media.list, {
        params: { page: pageNum, limit: 20, search: searchTerm || undefined },
      });
      const data = res.data.data;
      setMediaItems(data.items || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Failed to fetch media:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showModal) {
      fetchMedia(page, search);
    }
  }, [showModal, page]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append('files', file));
      await api.post(API.admin.cms.media.upload, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      fetchMedia(page, search);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelect = (url: string) => {
    onChange(url);
    setShowModal(false);
  };

  const handleSearch = () => {
    setPage(1);
    fetchMedia(1, search);
  };

  const isImageUrl = (url: string) => {
    return url && (url.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)$/i) || url.includes('/uploads/'));
  };

  return (
    <>
      {/* Text input + Browse button */}
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors whitespace-nowrap"
        >
          <ImageIcon className="h-4 w-4" />
          Browse
        </button>
      </div>

      {/* Thumbnail preview */}
      {value && isImageUrl(value) && (
        <div className="mt-2 flex items-start gap-3">
          <button
            type="button"
            onClick={() => setShowViewer(true)}
            className="relative group cursor-pointer"
          >
            <img
              src={value}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-gray-200 group-hover:border-primary-400 transition-colors"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors flex items-center justify-center">
              <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">View</span>
            </div>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 truncate">{value.split('/').pop()}</p>
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-xs text-red-500 hover:text-red-700 mt-1"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Media Browser Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div
            className="bg-white rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Select Image</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search + Upload */}
            <div className="px-6 py-3 border-b border-gray-100 flex gap-3">
              <div className="flex-1 relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search images..."
                  className="w-full border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
              />
            </div>

            {/* Media Grid */}
            <div className="flex-1 overflow-auto p-6">
              {loading ? (
                <div className="text-center py-12 text-gray-500">Loading...</div>
              ) : mediaItems.length === 0 ? (
                <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                  <ImageIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No images found. Upload some files to get started.</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {mediaItems
                    .filter((item) => item.mimeType.startsWith('image/'))
                    .map((item) => (
                      <button
                        key={item._id}
                        type="button"
                        onClick={() => handleSelect(item.url)}
                        className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-transparent hover:border-primary-500 transition-colors"
                      >
                        <img
                          src={item.url}
                          alt={item.alt || item.originalName}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-white text-xs truncate">{item.originalName}</p>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-gray-200 flex justify-between items-center">
                <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="flex items-center gap-1 px-3 py-1 text-xs border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50"
                  >
                    <ChevronLeft className="h-3 w-3" /> Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                    className="flex items-center gap-1 px-3 py-1 text-xs border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50"
                  >
                    Next <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full-Size Viewer */}
      {showViewer && value && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setShowViewer(false)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowViewer(false)}
              className="absolute -top-10 right-0 p-1 text-white/70 hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={value}
              alt="Full size"
              className="max-w-full max-h-[85vh] object-contain mx-auto rounded-lg"
            />
            <div className="text-center mt-3">
              <p className="text-white/70 text-sm">{value.split('/').pop()}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
