import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PetPhoto } from '../types';

interface PetPhotoCarouselProps {
  photos: PetPhoto[];
  fallbackUrl?: string;
  petName: string;
}

export default function PetPhotoCarousel({ photos, fallbackUrl, petName }: PetPhotoCarouselProps) {
  // null = show the main photo; arrows/dots set an explicit index.
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const hasPhotos = photos.length > 0;
  const mainPhoto = hasPhotos ? (photos.find((p) => p.isMain) || photos[0]) : null;
  const defaultIdx = mainPhoto ? photos.indexOf(mainPhoto) : 0;
  const currentIdx = selectedIdx ?? defaultIdx;
  const currentPhoto = hasPhotos ? photos[currentIdx] : null;
  const displayUrl = currentPhoto?.url || fallbackUrl;

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
            onClick={() => setSelectedIdx((i) => { const cur = i ?? defaultIdx; return cur === 0 ? photos.length - 1 : cur - 1; })}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition-colors"
            aria-label="Previous photo"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setSelectedIdx((i) => { const cur = i ?? defaultIdx; return cur === photos.length - 1 ? 0 : cur + 1; })}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition-colors"
            aria-label="Next photo"
          >
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-1.5 max-w-[80%]">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setSelectedIdx(i)}
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
