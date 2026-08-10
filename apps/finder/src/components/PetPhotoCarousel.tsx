import { useState } from 'react';
import { ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import type { PetPhoto } from '../types';

interface PetPhotoCarouselProps {
  photos: PetPhoto[];
  fallbackUrl?: string;
  petName: string;
}

export default function PetPhotoCarousel({ photos, fallbackUrl, petName }: PetPhotoCarouselProps) {
  const [currentIdx, setCurrentIdx] = useState(0);

  const hasPhotos = photos.length > 0;
  const mainPhoto = hasPhotos ? (photos.find((p) => p.isMain) || photos[0]) : null;
  const displayUrl = mainPhoto?.url || fallbackUrl;

  if (!displayUrl) {
    return (
      <div className="relative h-72 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
        <div className="text-center">
          <Camera size={48} className="text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">No photo available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-72 overflow-hidden group">
      {/* Main Image */}
      <img
        src={displayUrl}
        alt={petName}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      {/* Photo Counter */}
      {hasPhotos && photos.length > 1 && (
        <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full">
          {currentIdx + 1} / {photos.length}
        </div>
      )}

      {/* Navigation Arrows */}
      {hasPhotos && photos.length > 1 && (
        <>
          <button
            onClick={() => setCurrentIdx((i) => (i === 0 ? photos.length - 1 : i - 1))}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all duration-200"
            aria-label="Previous photo"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setCurrentIdx((i) => (i === photos.length - 1 ? 0 : i + 1))}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all duration-200"
            aria-label="Next photo"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      {/* Dots */}
      {hasPhotos && photos.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIdx(i)}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                i === currentIdx ? 'bg-white w-5' : 'bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`Go to photo ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
