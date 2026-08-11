import { Syringe, Cpu } from 'lucide-react';
import type { FinderData, Vaccination, Microchip } from '../types';

interface PetDetailsCardProps {
  data: FinderData;
}

function formatBreed(data: FinderData): string {
  const origin = data.pet.breedOrigin || 'Pure breed';
  const breed = data.pet.breed || '';
  const secondary = data.pet.secondaryBreed || '';
  if (origin === 'Unknown') return 'Unknown';
  if ((origin === 'Mixed Breed' || origin === 'Designer Breed') && secondary && secondary !== 'Unknown') {
    return `${origin === 'Designer Breed' ? 'Designer' : 'Mixed'} (${breed} × ${secondary})`;
  }
  if (origin === 'Landrace') return `${breed} (Landrace)`;
  return breed;
}

function VaccinationInfo({ vaccinations }: { vaccinations: Vaccination[] }) {
  if (!vaccinations || vaccinations.length === 0) return null;

  return (
    <div className="mt-4 p-3 bg-green-50 rounded-xl border border-green-200">
      <div className="flex items-center gap-2 mb-2">
        <Syringe size={16} className="text-green-600" />
        <span className="text-sm font-semibold text-green-800">Vaccinations</span>
      </div>
      <div className="space-y-1.5">
        {vaccinations.map((vax, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span className="text-green-700">{vax.vaccine}</span>
            {vax.vaccineType && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-600">
                {vax.vaccineType === 'core' ? 'Core' : vax.vaccineType === 'non-core' ? 'Non-core' : 'Other'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MicrochipInfo({ microchips }: { microchips: Microchip[] }) {
  if (!microchips || microchips.length === 0) return null;

  return (
    <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
      <div className="flex items-center gap-2 mb-2">
        <Cpu size={16} className="text-blue-600" />
        <span className="text-sm font-semibold text-blue-800">Microchip</span>
      </div>
      <div className="space-y-1.5">
        {microchips.map((chip, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span className="font-mono text-blue-700">{chip.chipNumber}</span>
            {chip.brand && (
              <span className="text-xs text-blue-500">({chip.brand})</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
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
      {data.pet.petId && (
        <p className="text-sm font-mono text-gray-400 mb-4">ID: {data.pet.petId}</p>
      )}

      <div className="divide-y divide-gray-100">
        {/* Row 1: Breed | Color */}
        <div className="grid grid-cols-2 gap-x-4">
          <DetailRow
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5"/><path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"/><path d="M8 14v.5"/><path d="M16 14v.5"/><path d="M11.25 16.25h1.5L12 17l-.75-.75Z"/><path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309"/></svg>}
            label="Breed"
            value={formatBreed(data)}
          />
          <DetailRow
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>}
            label="Color"
            value={`${data.pet.color}${data.pet.pattern ? `, ${data.pet.pattern}` : ''}`}
          />
        </div>

        {/* Row 2: Gender | Age */}
        <div className="grid grid-cols-2 gap-x-4">
          {gender && (
            <DetailRow
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>}
              label="Gender"
              value={gender}
            />
          )}
          {data.pet.age != null && (
            <DetailRow
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>}
              label="Age"
              value={`${data.pet.age} yrs`}
            />
          )}
        </div>

        {/* Row 3: Owner */}
        <DetailRow
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
          label="Owner"
          value={data.ownerName}
        />
      </div>

      {/* Vaccinations */}
      <VaccinationInfo vaccinations={data.pet.vaccinations || []} />

      {/* Microchips */}
      <MicrochipInfo microchips={data.pet.microchips || []} />
    </div>
  );
}
