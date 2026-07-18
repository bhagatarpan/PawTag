import { useEffect, useState } from 'react';
import api, { PaginatedData } from '../lib/api';
import { Search, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

export default function Pets() {
  const [data, setData] = useState<PaginatedData<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [petName, setPetName] = useState('');
  const [petBreed, setPetBreed] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');

  const buildParams = () => {
    const params: any = { page, limit: 20 };
    if (petName) params.petName = petName;
    if (petBreed) params.petBreed = petBreed;
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
    setPetName('');
    setPetBreed('');
    setStatusFilter('');
    setOwnerName('');
    setOwnerEmail('');
    setOwnerPhone('');
    setPage(1);
  };

  const hasActiveFilters = petName || petBreed || statusFilter || ownerName || ownerEmail || ownerPhone;

  const deletePet = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pet?')) return;
    await api.delete(`/admin/pets/${id}`);
    fetchPets();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pet Management</h1>

      {/* Filter Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <form onSubmit={handleSearch}>
          {/* Primary search */}
          <div className="flex gap-3 items-end">
            <div className="flex-1 max-w-xs">
              <label className="block text-xs font-medium text-gray-500 mb-1">Pet Name</label>
              <input
                type="text"
                placeholder="e.g. Bella"
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex-1 max-w-xs">
              <label className="block text-xs font-medium text-gray-500 mb-1">Breed</label>
              <input
                type="text"
                placeholder="e.g. Golden Retriever"
                value={petBreed}
                onChange={(e) => setPetBreed(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
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
            {showFilters ? 'Hide' : 'Show'} Owner Filters
          </button>

          {/* Owner filters */}
          {showFilters && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-gray-100">
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
          {petName && <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full">Pet: {petName}</span>}
          {petBreed && <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full">Breed: {petBreed}</span>}
          {statusFilter && <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full">Status: {statusFilter}</span>}
          {ownerName && <span className="bg-purple-100 text-purple-700 text-xs px-2.5 py-1 rounded-full">Owner: {ownerName}</span>}
          {ownerEmail && <span className="bg-purple-100 text-purple-700 text-xs px-2.5 py-1 rounded-full">Email: {ownerEmail}</span>}
          {ownerPhone && <span className="bg-purple-100 text-purple-700 text-xs px-2.5 py-1 rounded-full">Phone: {ownerPhone}</span>}
        </div>
      )}

      {/* Results table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Species</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Breed</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Owner</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Owner Contact</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-500">No pets found matching your filters</td></tr>
            ) : (
              data?.items.map((pet: any) => (
                <tr key={pet._id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium">{pet.name}</td>
                  <td className="px-5 py-3 text-gray-600">{pet.species}</td>
                  <td className="px-5 py-3 text-gray-600">{pet.breed}</td>
                  <td className="px-5 py-3 text-gray-600">{pet.ownerId?.fullName || 'N/A'}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    <div>{pet.ownerId?.email || ''}</div>
                    <div>{pet.ownerId?.phoneNumber || ''}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                      pet.status === 'safe' ? 'bg-green-100 text-green-700' :
                      pet.status === 'lost' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {pet.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <button onClick={() => deletePet(pet._id)} className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1">
                      <Trash2 size={12} /> Delete
                    </button>
                  </td>
                </tr>
              ))
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
