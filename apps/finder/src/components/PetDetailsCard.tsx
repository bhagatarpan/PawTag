import { User, Bone, PawPrint } from 'lucide-react';
import type { FinderData } from '../types';

interface PetDetailsCardProps {
  data: FinderData;
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="text-primary-600 mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-gray-800">{value}</p>
      </div>
    </div>
  );
}

export default function PetDetailsCard({ data }: PetDetailsCardProps) {
  const gender = data.pet.gender && data.pet.gender !== 'unknown'
    ? (data.pet.gender === 'male' ? 'Male' : 'Female')
    : null;

  return (
    <div className="p-6">
      {/* Identity header (board 2): avatar + name + reassurance pill + chips */}
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 shrink-0 rounded-full bg-primary-50 overflow-hidden flex items-center justify-center">
          {data.pet.photos?.[0]?.url ? (
            <img
              src={data.pet.photos.find((p: { isMain?: boolean }) => p.isMain)?.url || data.pet.photos[0].url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <PawPrint size={22} className="text-primary-500" aria-hidden="true" />
          )}
        </span>
        <div className="flex-1 min-w-0 flex items-start justify-between gap-3">
          <h2 className="text-2xl font-bold truncate">{data.pet.name}</h2>
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary-50 text-primary-700 px-3 py-1 text-xs font-semibold">
            Helping me get home
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {data.pet.breed && (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            {data.pet.breed}
          </span>
        )}
        {gender && (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            {gender}
          </span>
        )}
        {typeof data.pet.age === 'number' && (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            {data.pet.age === 0 ? 'Under 1 year' : data.pet.age === 1 ? '1 year' : `${data.pet.age} years`}
          </span>
        )}
        {data.pet.color && (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            {data.pet.color}{data.pet.pattern ? `, ${data.pet.pattern}` : ''}
          </span>
        )}
      </div>

      <div className="divide-y divide-gray-100 mt-4">

        {/* Row 3: Favourite food — helps a finder comfort the pet */}
        {data.pet.favouriteFood && (
          <DetailRow
            icon={<Bone size={18} />}
            label="Favourite Food"
            value={data.pet.favouriteFood}
          />
        )}

        {/* Owner — hidden when masked (safe pet in production) */}
        {(data.ownerName || data.ownerLocation) && (
          <div className="mt-4 p-3 bg-purple-50 rounded-xl border border-purple-200">
            <div className="flex items-center gap-2 mb-1">
              <User size={16} className="text-purple-600" />
              <span className="text-sm font-semibold text-purple-800">Owner</span>
            </div>
            <p className="text-sm text-purple-700">
              {data.ownerName
                ? data.ownerLocation
                  ? `${data.ownerName}, ${data.ownerLocation}`
                  : data.ownerName
                : data.ownerLocation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
