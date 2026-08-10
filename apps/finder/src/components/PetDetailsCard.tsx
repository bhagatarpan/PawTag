import { Syringe, Cpu, PawPrint, User, UtensilsCrossed } from 'lucide-react';
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
    return `${origin === 'Designer Breed' ? 'Designer' : 'Mixed'} (${breed} x ${secondary})`;
  }
  if (origin === 'Landrace') return `${breed} (Landrace)`;
  return breed;
}

function VaccinationBadge({ vax }: { vax: Vaccination }) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-medium">
      <Syringe size={12} />
      <span>{vax.vaccine}</span>
      {vax.vaccineType && vax.vaccineType !== 'core' && (
        <span className="bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded text-[10px]">
          {vax.vaccineType === 'non-core' ? 'Non-core' : 'Other'}
        </span>
      )}
    </div>
  );
}

function MicrochipBadge({ chip }: { chip: Microchip }) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-medium">
      <Cpu size={12} />
      <span className="font-mono">{chip.chipNumber}</span>
      {chip.brand && (
        <span className="text-blue-500 text-[10px]">({chip.brand})</span>
      )}
    </div>
  );
}

export default function PetDetailsCard({ data }: PetDetailsCardProps) {
  const { pet } = data;
  const vaccinations = pet.vaccinations || [];
  const microchips = pet.microchips || [];

  return (
    <div className="relative -mt-8 mx-4">
      {/* Floating Card */}
      <div className="bg-white rounded-2xl shadow-xl shadow-black/5 p-5 space-y-4">
        {/* Pet Name & ID */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{pet.name}</h2>
            {pet.petId && (
              <p className="text-xs font-mono text-gray-400 mt-0.5">ID: {pet.petId}</p>
            )}
          </div>
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
            <PawPrint size={20} className="text-gray-400" />
          </div>
        </div>

        {/* Breed Info */}
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-sm text-gray-700">
            <span className="font-semibold">{pet.petType || pet.species}</span>
            <span className="mx-1.5 text-gray-300">|</span>
            {formatBreed(data)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {pet.color}{pet.pattern ? `, ${pet.pattern}` : ''}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2">
          {pet.gender && pet.gender !== 'unknown' && (
            <div className="bg-gray-50 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Gender</p>
              <p className="text-sm font-semibold text-gray-700 mt-0.5">
                {pet.gender === 'male' ? 'Male' : 'Female'}
              </p>
            </div>
          )}
          {pet.age != null && (
            <div className="bg-gray-50 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Age</p>
              <p className="text-sm font-semibold text-gray-700 mt-0.5">{pet.age} yrs</p>
            </div>
          )}
          {pet.favouriteFood && (
            <div className="bg-gray-50 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Food</p>
              <p className="text-sm font-semibold text-gray-700 mt-0.5 truncate">{pet.favouriteFood}</p>
            </div>
          )}
        </div>

        {/* Owner */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center">
            <User size={14} className="text-gray-500" />
          </div>
          <span>Owner: <span className="font-medium text-gray-800">{data.ownerName}</span></span>
        </div>

        {/* Vaccinations */}
        {vaccinations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <Syringe size={12} />
              Vaccinations
            </div>
            <div className="flex flex-wrap gap-1.5">
              {vaccinations.map((vax, i) => (
                <VaccinationBadge key={i} vax={vax} />
              ))}
            </div>
          </div>
        )}

        {/* Microchips */}
        {microchips.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <Cpu size={12} />
              Microchip
            </div>
            <div className="flex flex-wrap gap-1.5">
              {microchips.map((chip, i) => (
                <MicrochipBadge key={i} chip={chip} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
