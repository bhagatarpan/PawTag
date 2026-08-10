import type { FinderData } from '../types';

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
    </div>
  );
}
