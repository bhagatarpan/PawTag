import { User } from 'lucide-react';
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
      <h2 className="text-2xl font-bold mb-1">{data.pet.name}</h2>

      <div className="divide-y divide-gray-100">
        {/* Row 1: Breed | Color */}
        <div className="grid grid-cols-2 gap-x-4">
          <DetailRow
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5"/><path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"/><path d="M8 14v.5"/><path d="M16 14v.5"/><path d="M11.25 16.25h1.5L12 17l-.75-.75Z"/><path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309"/></svg>}
            label="Breed"
            value={data.pet.breed}
          />
          <DetailRow
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>}
            label="Color"
            value={`${data.pet.color}${data.pet.pattern ? `, ${data.pet.pattern}` : ''}`}
          />
        </div>

        {/* Row 2: Gender */}
        {gender && (
          <DetailRow
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>}
            label="Gender"
            value={gender}
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
