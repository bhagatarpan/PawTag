import { useState, useRef } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import api from '../lib/api';

interface AvatarUploadProps {
  currentPicture?: string | null;
  userName: string;
  onUploadComplete: (url: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
};

const iconSizes = {
  sm: 14,
  md: 18,
  lg: 24,
};

export default function AvatarUpload({ currentPicture, userName, onUploadComplete, size = 'md' }: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreview(event.target?.result as string);
      setShowModal(true);
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!preview) return;

    setIsUploading(true);
    try {
      // Convert base64 to blob
      const response = await fetch(preview);
      const blob = await response.blob();
      
      // Create form data
      const formData = new FormData();
      formData.append('photo', blob, 'profile-picture.jpg');

      // Upload to server
      const uploadResponse = await api.post('/upload/profile-picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { url } = uploadResponse.data.data;
      onUploadComplete(url);
      setShowModal(false);
      setPreview(null);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload profile picture. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    try {
      await api.put('/auth/profile', { profilePicture: '' });
      onUploadComplete('');
      setShowModal(false);
      setPreview(null);
    } catch (error) {
      console.error('Failed to remove profile picture:', error);
      alert('Failed to remove profile picture. Please try again.');
    }
  };

  const getInitial = () => userName?.charAt(0)?.toUpperCase() || '?';

  return (
    <>
      <div className="relative group">
        {/* Avatar Display */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="relative focus:outline-none"
        >
          {currentPicture ? (
            <img
              src={currentPicture}
              alt={userName}
              className={`${sizeClasses[size]} rounded-full object-cover ring-2 ring-white shadow-sm`}
            />
          ) : (
            <div className={`${sizeClasses[size]} bg-teal-100 rounded-full flex items-center justify-center text-teal-700 font-bold ring-2 ring-white shadow-sm`}>
              <span className={size === 'sm' ? 'text-sm' : size === 'md' ? 'text-lg' : 'text-2xl'}>
                {getInitial()}
              </span>
            </div>
          )}

          {/* Camera overlay on hover */}
          <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera size={iconSizes[size]} className="text-white" />
          </div>
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Update Profile Picture</h3>
              <button
                onClick={() => { setShowModal(false); setPreview(null); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Preview */}
            <div className="p-6">
              <div className="flex justify-center mb-6">
                {preview && (
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-32 h-32 rounded-full object-cover ring-4 ring-teal-100"
                  />
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Save Profile Picture'
                  )}
                </button>

                {currentPicture && (
                  <button
                    onClick={handleRemove}
                    disabled={isUploading}
                    className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Remove Picture
                  </button>
                )}

                <button
                  onClick={() => { setShowModal(false); setPreview(null); }}
                  disabled={isUploading}
                  className="w-full text-gray-500 py-2 text-sm hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
