import { useEffect, useState } from 'react';
import api, { PaginatedData } from '../lib/api';
import { Search, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

// --- Pet attribute options (mirrors shared/src/constants.ts) ---
const PET_TYPES = ['Dog', 'Cat', 'Rabbit', 'Hamster', 'Guinea Pig', 'Bird'] as const;

const PET_COLORS: Record<string, string[]> = {
  Dog: ['Black', 'White', 'Brown', 'Cream', 'Golden', 'Red', 'Blue (Gray)', 'Fawn', 'Brindle', 'Merle', 'Sable', 'Chocolate', 'Liver', 'Tan', 'Silver'],
  Cat: ['Black', 'White', 'Gray', 'Blue', 'Orange (Ginger)', 'Cream', 'Brown', 'Chocolate', 'Lilac', 'Cinnamon', 'Fawn'],
  Rabbit: ['White', 'Black', 'Blue', 'Chocolate', 'Lilac', 'Chestnut', 'Chinchilla', 'Sable', 'Tortoise', 'Agouti'],
  Hamster: ['Golden', 'White', 'Black', 'Gray', 'Cream', 'Cinnamon', 'Sable', 'Silver'],
  'Guinea Pig': ['White', 'Black', 'Brown', 'Red', 'Cream', 'Buff', 'Chocolate', 'Lilac', 'Slate'],
  Bird: ['Green', 'Blue', 'Yellow', 'White', 'Gray', 'Black', 'Red', 'Violet', 'Turquoise', 'Lutino', 'Albino'],
};

const PET_PATTERNS: Record<string, string[]> = {
  Dog: ['Solid', 'Merle', 'Brindle', 'Sable', 'Tan Points', 'Tricolor', 'Piebald', 'Tuxedo', 'Harlequin', 'Spotted', 'Roan'],
  Cat: ['Solid', 'Tabby', 'Calico', 'Tortoiseshell', 'Bicolor', 'Tricolor', 'Colorpoint', 'Ticked', 'Spotted', 'Mackerel', 'Classic Tabby'],
  Rabbit: ['Solid', 'Broken', 'Dutch', 'Himalayan', 'Otter', 'Chinchilla', 'Fox', 'Steel', 'Butterfly', 'Magpie'],
  Hamster: ['Solid', 'Banded', 'Sanded', 'Ticked', 'Agouti', 'Spotted'],
  'Guinea Pig': ['Solid', 'Roan', 'Dalmatian', 'Brindle', 'Himalayan', 'Dutch', 'Orange', 'Ticked', 'Agouti'],
  Bird: ['Solid', 'Pied', 'Lutino', 'Albino', 'Opaline', 'Spangle', 'Clearwing', 'Crested', 'Dominant Pied'],
};

const PET_BREEDS: Record<string, string[]> = {
  Dog: [
    'Mixed Breed', 'Labrador Retriever', 'German Shepherd', 'Golden Retriever', 'French Bulldog',
    'Bulldog', 'Poodle', 'Beagle', 'Rottweiler', 'Dachshund', 'German Shorthaired Pointer',
    'Pembroke Welsh Corgi', 'Australian Shepherd', 'Yorkshire Terrier', 'Cavalier King Charles Spaniel',
    'Doberman Pinscher', 'Boxer', 'Miniature Schnauzer', 'Cocker Spaniel', 'Shih Tzu',
    'Border Collie', 'Belgian Malinois', 'Alaskan Malamute', 'Siberian Husky',
    'Bernese Mountain Dog', 'Great Dane', 'Saint Bernard', 'Old English Sheepdog',
    'Samoyed', 'Akita', 'Mastiff', 'Newfoundland',
    'West Highland White Terrier', 'Scottish Terrier', 'Bull Terrier', 'Jack Russell Terrier',
    'Staffordshire Bull Terrier', 'Airedale Terrier',
    'Chihuahua', 'Pomeranian', 'Maltese', 'Pug', 'Papillon',
    'Italian Greyhound', 'Chinese Crested',
    'Basset Hound', 'Bloodhound', 'Greyhound', 'Whippet',
    'Rhodesian Ridgeback', 'Afghan Hound', 'Basenji',
    'Shiba Inu', 'Shar Pei', 'Chow Chow', 'Lhasa Apso',
    'Sheltie', 'Collie', 'Dalmatian', 'Weimaraner',
    'Vizsla', 'Brittany Spaniel', 'Setter (Irish)', 'Setter (English)',
    'Pointer', 'Havanese', 'Bichon Frise', 'Maltepoo',
    'Goldendoodle', 'Labradoodle', 'Cockapoo', 'Pomsky',
  ],
  Cat: [
    'Mixed Breed', 'Domestic Shorthair', 'Domestic Longhair', 'Ragdoll', 'Maine Coon',
    'Persian', 'British Shorthair', 'Bengal', 'Abyssinian',
    'Siamese', 'Russian Blue', 'Scottish Fold', 'Sphynx',
    'Birman', 'Norwegian Forest Cat', 'Ragamuffin', 'Himalayan',
    'American Shorthair', 'Exotic Shorthair', 'Oriental Shorthair',
    'Tonkinese', 'Burmese', 'Cornish Rex', 'Devon Rex', 'Selkirk Rex',
    'Somali', 'Balinese', 'Chartreux', 'Korat',
    'LaPerm', 'Manx', 'Munchkin', 'Singapura',
    'Snowshoe', 'Turkish Angora', 'Turkish Van',
  ],
  Rabbit: [
    'Mixed Breed', 'Holland Lop', 'Mini Lop', 'English Lop', 'French Lop',
    'Netherland Dwarf', 'Mini Rex', 'Standard Rex', 'Velveteen Lop',
    'Himalayan', 'Dutch', 'English Spot', 'Checkered Giant',
    'Flemish Giant', 'Lionhead', 'Angora', 'Jersey Wooly',
    'Californian', 'New Zealand', 'American', 'Chinchilla',
    'Argente', 'Belgian Hare', 'English Angora', 'French Angora',
  ],
  Hamster: ['Syrian (Golden)', 'Dwarf Campbell', 'Dwarf Winter White', 'Roborovski', 'Chinese'],
  'Guinea Pig': [
    'American', 'Peruvian', 'Silkie (Sheltie)', 'Teddy',
    'Texel', 'Rex', 'American Crested', 'Peruvian Crested',
    'Skinny Pig', 'Baldwin', 'Sheba', 'White Crested', 'Merino', 'Lunkarya',
  ],
  Bird: [
    'Budgerigar (Budgie)', 'Cockatiel', 'Lovebird', 'African Grey',
    'Amazon Parrot', 'Macaw', 'Cockatoo', 'Conure',
    'Canary', 'Finch', 'Parrotlet', 'Quaker Parrot',
    'Ringneck Dove', 'Pionus', 'Caique', 'Lorikeet',
    'Mynah', 'Bourke\'s Parakeet', 'Lineolated Parakeet',
  ],
};

export default function Pets() {
  const [data, setData] = useState<PaginatedData<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [petType, setPetType] = useState('');
  const [petName, setPetName] = useState('');
  const [petBreed, setPetBreed] = useState('');
  const [petColor, setPetColor] = useState('');
  const [petPattern, setPetPattern] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');

  // Reset dependent filters when pet type changes
  const handleTypeChange = (type: string) => {
    setPetType(type);
    setPetBreed('');
    setPetColor('');
    setPetPattern('');
  };

  const buildParams = () => {
    const params: any = { page, limit: 20 };
    if (petType) params.petType = petType;
    if (petName) params.petName = petName;
    if (petBreed) params.petBreed = petBreed;
    if (petColor) params.petColor = petColor;
    if (petPattern) params.petPattern = petPattern;
    if (statusFilter) params.status = statusFilter;
    if (ownerName) params.ownerName = ownerName;
    if (ownerEmail) params.ownerEmail = ownerEmail;
    if (ownerPhone) params.ownerPhone = ownerPhone;
    return params;
  };

  const fetchPets = () => {
    setLoading(true);
    api
      .get('/admin/pets', { params: buildParams() })
      .then((res) => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPets(); }, [page, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPets();
  };

  const clearFilters = () => {
    setPetType('');
    setPetName('');
    setPetBreed('');
    setPetColor('');
    setPetPattern('');
    setStatusFilter('');
    setOwnerName('');
    setOwnerEmail('');
    setOwnerPhone('');
    setPage(1);
  };

  const hasActiveFilters = petType || petName || petBreed || petColor || petPattern || statusFilter || ownerName || ownerEmail || ownerPhone;

  const deletePet = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pet?')) return;
    await api.delete(`/admin/pets/${id}`);
    fetchPets();
  };

  // Dynamic options based on selected pet type
  const availableColors = petType ? PET_COLORS[petType] || [] : [];
  const availablePatterns = petType ? PET_PATTERNS[petType] || [] : [];
  const availableBreeds = petType ? PET_BREEDS[petType] || [] : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pet Management</h1>

      {/* Filter Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <form onSubmit={handleSearch}>
          {/* Primary filters row */}
          <div className="flex gap-3 items-end flex-wrap">
            <div className="w-44">
              <label className="block text-xs font-medium text-gray-500 mb-1">Pet Type</label>
              <select
                value={petType}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">All Types</option>
                {PET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[180px] max-w-xs">
              <label className="block text-xs font-medium text-gray-500 mb-1">Pet Name</label>
              <input
                type="text"
                placeholder="e.g. Bella"
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="w-48">
              <label className="block text-xs font-medium text-gray-500 mb-1">Breed</label>
              <select
                value={petBreed}
                onChange={(e) => setPetBreed(e.target.value)}
                disabled={!petType}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">{petType ? 'All Breeds' : 'Select type first'}</option>
                {availableBreeds.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">All Status</option>
                <option value="safe">Safe</option>
                <option value="lost">Lost</option>
                <option value="found">Found</option>
              </select>
            </div>
            <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 flex items-center gap-1.5">
              <Search size={14} /> Search
            </button>
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="text-gray-500 hover:text-red-600 text-sm px-3 py-2">
                Clear All
              </button>
            )}
          </div>

          {/* Advanced filters toggle */}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="mt-3 text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1"
          >
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showFilters ? 'Hide' : 'Show'} More Filters
          </button>

          {/* Advanced filters */}
          {showFilters && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Color</label>
                <select
                  value={petColor}
                  onChange={(e) => setPetColor(e.target.value)}
                  disabled={!petType}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:opacity-50"
                >
                  <option value="">{petType ? 'All Colors' : 'Select type first'}</option>
                  {availableColors.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Pattern</label>
                <select
                  value={petPattern}
                  onChange={(e) => setPetPattern(e.target.value)}
                  disabled={!petType}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:opacity-50"
                >
                  <option value="">{petType ? 'All Patterns' : 'Select type first'}</option>
                  {availablePatterns.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Owner Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Smith"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Owner Email</label>
                <input
                  type="text"
                  placeholder="e.g. john@example.com"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Owner Phone</label>
                <input
                  type="text"
                  placeholder="e.g. +6421"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {petType && <span className="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-1 rounded-full">Type: {petType}</span>}
          {petName && <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full">Name: {petName}</span>}
          {petBreed && <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full">Breed: {petBreed}</span>}
          {petColor && <span className="bg-amber-100 text-amber-700 text-xs px-2.5 py-1 rounded-full">Color: {petColor}</span>}
          {petPattern && <span className="bg-amber-100 text-amber-700 text-xs px-2.5 py-1 rounded-full">Pattern: {petPattern}</span>}
          {statusFilter && <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full">Status: {statusFilter}</span>}
          {ownerName && <span className="bg-purple-100 text-purple-700 text-xs px-2.5 py-1 rounded-full">Owner: {ownerName}</span>}
          {ownerEmail && <span className="bg-purple-100 text-purple-700 text-xs px-2.5 py-1 rounded-full">Email: {ownerEmail}</span>}
          {ownerPhone && <span className="bg-purple-100 text-purple-700 text-xs px-2.5 py-1 rounded-full">Phone: {ownerPhone}</span>}
        </div>
      )}

      {/* Results table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-12">Photo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Breed</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Color</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Pattern</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Owner</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Contact</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={10} className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={10} className="px-5 py-8 text-center text-gray-500">No pets found matching your filters</td></tr>
            ) : (
              data?.items.map((pet: any) => {
                const mainPhoto = pet.photos?.length > 0
                  ? (pet.photos.find((p: any) => p.isMain) || pet.photos[0])?.url
                  : pet.photoUrl;
                const breedDisplay = pet.breed === 'Mixed Breed' && pet.secondaryBreed
                  ? `Mixed (${pet.secondaryBreed})`
                  : pet.breed;
                return (
                  <tr key={pet._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {mainPhoto ? (
                        <img src={mainPhoto} alt="" className="w-9 h-9 rounded-full object-cover border" onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><rect width="36" height="36" fill="%23f3f4f6" rx="18"/><text x="18" y="21" text-anchor="middle" fill="%239ca3af" font-size="10">?</text></svg>'; }} />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">?</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {pet.name}
                      {pet.photos && pet.photos.length > 1 && (
                        <span className="text-gray-400 text-xs ml-1">({pet.photos.length} photos)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{pet.petType}</td>
                    <td className="px-4 py-3 text-gray-600">{breedDisplay}</td>
                    <td className="px-4 py-3 text-gray-600">{pet.color}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{pet.pattern || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{pet.ownerId?.fullName || 'N/A'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      <div>{pet.ownerId?.email || ''}</div>
                      <div>{pet.ownerId?.phoneNumber || ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        pet.status === 'safe' ? 'bg-green-100 text-green-700' :
                        pet.status === 'lost' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {pet.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => deletePet(pet._id)} className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1">
                        <Trash2 size={12} /> Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">{data.total} total pets</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
            <span className="px-3 py-1">Page {page} of {data.totalPages}</span>
            <button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
