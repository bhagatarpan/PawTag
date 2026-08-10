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

export default function PetDetailsCard({ data }: PetDetailsCardProps) {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-1">{data.pet.name}</h2>
      {data.pet.petId && (
        <p className="text-sm font-mono text-gray-400 mb-1">ID: {data.pet.petId}</p>
      )}
      <p className="text-base text-gray-600 mb-2">
        {data.pet.petType || data.pet.species} — {formatBreed(data)} ({data.pet.color}{data.pet.pattern ? `, ${data.pet.pattern}` : ''})
      </p>
      <div className="flex flex-wrap gap-2 mb-4 text-base text-gray-500">
        {data.pet.gender && data.pet.gender !== 'unknown' && (
          <span>Gender: {data.pet.gender === 'male' ? 'Male' : 'Female'}</span>
        )}
        {data.pet.age != null && <span>Age: {data.pet.age} yrs</span>}
        {data.pet.favouriteFood && <span>Fav Food: {data.pet.favouriteFood}</span>}
      </div>
      <p className="text-base text-gray-500">Owner: {data.ownerName}</p>

      {/* Vaccinations */}
      <VaccinationInfo vaccinations={data.pet.vaccinations || []} />

      {/* Microchips */}
      <MicrochipInfo microchips={data.pet.microchips || []} />
    </div>
  );
}
