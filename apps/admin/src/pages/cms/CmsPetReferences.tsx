import { useState, useEffect } from 'react';
import { Database, Plus, Search, Edit, Trash2, Filter, Upload, Eye, EyeOff } from 'lucide-react';
import api from '../../lib/api';

interface PetReference {
  _id: string;
  type: string;
  petSpecies?: string;
  label: string;
  value: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const REFERENCE_TYPES = [
  { value: 'pet_type', label: 'Pet Types' },
  { value: 'breed', label: 'Breeds' },
  { value: 'color', label: 'Colors' },
  { value: 'pattern', label: 'Patterns' },
  { value: 'gender', label: 'Genders' },
  { value: 'vaccine', label: 'Vaccines' },
];

const PET_SPECIES = ['Dog', 'Cat', 'Rabbit', 'Hamster', 'Guinea Pig', 'Bird'];

export default function CmsPetReferences() {
  const [references, setReferences] = useState<PetReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('');
  const [search, setSearch] = useState('');
  const [editingRef, setEditingRef] = useState<PetReference | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [form, setForm] = useState({
    type: 'pet_type', petSpecies: '', label: '', value: '', order: 0, isActive: true,
  });
  const [bulkForm, setBulkForm] = useState({
    type: 'breed', petSpecies: 'Dog', items: '',
  });

  const fetchReferences = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      if (speciesFilter) params.set('petSpecies', speciesFilter);
      const res = await api.get(`/admin/cms/pet-refs/pet-references?${params}`);
      setReferences(res.data.data);
    } catch (err) {
      console.error('Failed to fetch pet references', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReferences(); }, [typeFilter, speciesFilter]);

  const handleSave = async () => {
    try {
      if (editingRef) {
        await api.put(`/admin/cms/pet-refs/pet-references/${editingRef._id}`, form);
      } else {
        await api.post('/admin/cms/pet-refs/pet-references', form);
      }
      setShowForm(false);
      setEditingRef(null);
      resetForm();
      fetchReferences();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save reference');
    }
  };

  const handleBulkSave = async () => {
    try {
      const items = bulkForm.items.split('\n').filter(Boolean).map(line => ({
        type: bulkForm.type,
        petSpecies: bulkForm.petSpecies || undefined,
        label: line.trim(),
        value: line.trim().toLowerCase().replace(/\s+/g, '_'),
      }));
      await api.post('/admin/cms/pet-refs/pet-references/bulk', { items });
      setShowBulkForm(false);
      fetchReferences();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to bulk create references');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this reference?')) return;
    try {
      await api.delete(`/admin/cms/pet-refs/pet-references/${id}`);
      fetchReferences();
    } catch (err) {
      console.error('Failed to delete reference', err);
    }
  };

  const handleToggleActive = async (ref: PetReference) => {
    try {
      await api.put(`/admin/cms/pet-refs/pet-references/${ref._id}`, { isActive: !ref.isActive });
      fetchReferences();
    } catch (err) {
      console.error('Failed to update reference', err);
    }
  };

  const resetForm = () => {
    setForm({ type: 'pet_type', petSpecies: '', label: '', value: '', order: 0, isActive: true });
  };

  const startEdit = (ref: PetReference) => {
    setForm({
      type: ref.type,
      petSpecies: ref.petSpecies || '',
      label: ref.label,
      value: ref.value,
      order: ref.order,
      isActive: ref.isActive,
    });
    setEditingRef(ref);
    setShowForm(true);
  };

  const filteredReferences = references.filter(ref => {
    if (search) {
      const searchLower = search.toLowerCase();
      return ref.label.toLowerCase().includes(searchLower) || ref.value.toLowerCase().includes(searchLower);
    }
    return true;
  });

  // Group by type and species for display
  const grouped = filteredReferences.reduce((acc, ref) => {
    const key = ref.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(ref);
    return acc;
  }, {} as Record<string, PetReference[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pet Reference Data</h1>
          <p className="text-gray-500 text-sm mt-1">{references.length} references</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowBulkForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Upload size={16} /> Bulk Import
          </button>
          <button
            onClick={() => { resetForm(); setEditingRef(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={16} /> Add Reference
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
          <option value="">All Types</option>
          {REFERENCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={speciesFilter} onChange={(e) => setSpeciesFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
          <option value="">All Species</option>
          {PET_SPECIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search references..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold">{editingRef ? 'Edit Reference' : 'New Reference'}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  {REFERENCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {form.type !== 'pet_type' && form.type !== 'gender' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pet Species *</label>
                  <select value={form.petSpecies} onChange={(e) => setForm({ ...form, petSpecies: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="">Select species</option>
                    {PET_SPECIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label *</label>
                <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Value *</label>
                <input type="text" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-500 mt-1">Lowercase, underscores for spaces</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                <input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <label className="text-sm text-gray-700">Active</label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => { setShowForm(false); setEditingRef(null); }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {editingRef ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold">Bulk Import References</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select value={bulkForm.type} onChange={(e) => setBulkForm({ ...bulkForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    {REFERENCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pet Species</label>
                  <select value={bulkForm.petSpecies} onChange={(e) => setBulkForm({ ...bulkForm, petSpecies: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="">None</option>
                    {PET_SPECIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Items (one per line) *</label>
                <textarea rows={10} value={bulkForm.items} onChange={(e) => setBulkForm({ ...bulkForm, items: e.target.value })}
                  placeholder="Labrador Retriever&#10;German Shepherd&#10;Golden Retriever&#10;Bulldog"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm" />
                <p className="text-xs text-gray-500 mt-1">Enter one item per line. Values will be auto-generated from labels.</p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowBulkForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleBulkSave}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* References List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12">
          <Database size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No pet references found</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, refs]) => (
            <div key={type} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">
                  {REFERENCE_TYPES.find(t => t.value === type)?.label || type}
                  <span className="ml-2 text-sm font-normal text-gray-500">({refs.length})</span>
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {refs.map((ref) => (
                  <div key={ref._id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="font-medium text-gray-900">{ref.label}</span>
                        <span className="ml-2 text-sm text-gray-500">{ref.value}</span>
                        {ref.petSpecies && (
                          <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">{ref.petSpecies}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Order: {ref.order}</span>
                      <button onClick={() => handleToggleActive(ref)}
                        className={`p-1.5 rounded-lg ${ref.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                        {ref.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <button onClick={() => startEdit(ref)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(ref._id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
