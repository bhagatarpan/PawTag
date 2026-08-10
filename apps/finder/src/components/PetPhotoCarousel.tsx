import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

  if (!displayUrl) return null;

  return (
    <div className="relative">
      <img
        src={displayUrl}
        alt={petName}
        className="w-full h-56 object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      {hasPhotos && photos.length > 1 && (
        <>
          <button
            onClick={() => setCurrentIdx((i) => (i === 0 ? photos.length - 1 : i - 1))}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition-colors"
            aria-label="Previous photo"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setCurrentIdx((i) => (i === photos.length - 1 ? 0 : i + 1))}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition-colors"
            aria-label="Next photo"
          >
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIdx(i)}
                className={`w-2 h-2 rounded-full transition-colors ${i === currentIdx ? 'bg-white' : 'bg-white/50'}`}
                aria-label={`Go to photo ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
