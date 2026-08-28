/**
 * @module Collections Page
 * @description Admin page for managing product collections.
 *
 * Collections group products for marketing purposes (e.g., "Summer Sale", "New Arrivals").
 * Unlike categories, collections are flat and products can belong to multiple collections.
 */

import { useEffect, useState, useCallback } from 'react';
import { Search, Loader2, Plus, Edit2, Trash2, Database, X } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface Collection {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  createdAt: string;
}

export default function Collections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '', sortOrder: 0, isActive: true });
  const [saving, setSaving] = useState(false);

  const fetchCollections = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/commerce/collections', { params: { search, limit: 100 } });
      setCollections(res.data?.data?.items || []);
    } catch { toast.error('Failed to load collections'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchCollections(); }, [fetchCollections]);

  const handleSave = async () => {
    if (!form.name || !form.slug) { toast.error('Name and slug are required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/commerce/collections/${editing._id}`, form);
        toast.success('Collection updated');
      } else {
        await api.post('/admin/commerce/collections', form);
        toast.success('Collection created');
      }
      setShowForm(false);
      setEditing(null);
      setForm({ name: '', slug: '', description: '', sortOrder: 0, isActive: true });
      fetchCollections();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete collection "${name}"?`)) return;
    try {
      await api.delete(`/admin/commerce/collections/${id}`);
      toast.success('Collection deleted');
      fetchCollections();
    } catch { toast.error('Failed to delete'); }
  };

  const startEdit = (c: Collection) => {
    setEditing(c);
    setForm({ name: c.name, slug: c.slug, description: c.description || '', sortOrder: c.sortOrder, isActive: c.isActive });
    setShowForm(true);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Collections</h1>
          <p className="text-sm text-gray-500 mt-1">Group products for marketing purposes</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ name: '', slug: '', description: '', sortOrder: 0, isActive: true }); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm">
          <Plus size={16} /> Add Collection
        </button>
      </div>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Search collections..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{editing ? 'Edit Collection' : 'New Collection'}</h3>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500" rows={2} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
              <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
              <label className="text-sm text-gray-700">Active</label>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50">
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-teal-500" size={24} /></div>
        ) : collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Database size={32} className="mb-2" /><p>No collections found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Slug</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Products</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {collections.map((c) => (
                <tr key={c._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">{c.slug}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.productCount}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => startEdit(c)} className="text-gray-400 hover:text-teal-600"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(c._id, c.name)} className="text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
