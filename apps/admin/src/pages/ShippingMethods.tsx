/**
 * @module Shipping Methods Page
 * @description Admin page for managing shipping methods.
 */

import { useEffect, useState, useCallback } from 'react';
import { Search, Loader2, Plus, Edit2, Trash2, Truck, X } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface ShippingMethod {
  _id: string;
  name: string;
  description?: string;
  rate: number;
  rateType: string;
  estimatedDays?: string;
  carrier?: string;
  isActive: boolean;
  zones: string[];
  sortOrder: number;
}

const RATE_TYPES = [
  { value: 'free', label: 'Free' },
  { value: 'flat_rate', label: 'Flat Rate' },
  { value: 'weight_based', label: 'Weight Based' },
  { value: 'price_based', label: 'Price Based' },
];

export default function ShippingMethods() {
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ShippingMethod | null>(null);
  const [form, setForm] = useState({ name: '', description: '', rate: 0, rateType: 'free', estimatedDays: '', carrier: '', isActive: true, sortOrder: 0, zones: [] as string[] });
  const [saving, setSaving] = useState(false);

  const fetchMethods = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/commerce/shipping-methods', { params: { search, limit: 100 } });
      setMethods(res.data?.data?.items || []);
    } catch { toast.error('Failed to load shipping methods'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchMethods(); }, [fetchMethods]);

  const handleSave = async () => {
    if (!form.name) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/commerce/shipping-methods/${editing._id}`, form);
        toast.success('Shipping method updated');
      } else {
        await api.post('/admin/commerce/shipping-methods', form);
        toast.success('Shipping method created');
      }
      setShowForm(false);
      setEditing(null);
      setForm({ name: '', description: '', rate: 0, rateType: 'free', estimatedDays: '', carrier: '', isActive: true, sortOrder: 0, zones: [] });
      fetchMethods();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this shipping method?')) return;
    try { await api.delete(`/admin/commerce/shipping-methods/${id}`); toast.success('Deleted'); fetchMethods(); }
    catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shipping Methods</h1>
          <p className="text-sm text-gray-500 mt-1">{methods.length} methods configured</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ name: '', description: '', rate: 0, rateType: 'free', estimatedDays: '', carrier: '', isActive: true, sortOrder: 0, zones: [] }); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-all">
          <Plus size={16} /> Add Method
        </button>
      </div>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Search methods..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-teal-500" size={24} /></div>
        ) : methods.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Truck size={32} className="mb-2" /><p>No shipping methods configured</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rate Type</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Rate</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Est. Days</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {methods.map((m) => (
                <tr key={m._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{RATE_TYPES.find(r => r.value === m.rateType)?.label || m.rateType}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                    {m.rateType === 'free' ? 'Free' : `$${m.rate.toFixed(2)}`}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{m.estimatedDays || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${m.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {m.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setEditing(m); setForm({ name: m.name, description: m.description || '', rate: m.rate, rateType: m.rateType, estimatedDays: m.estimatedDays || '', carrier: m.carrier || '', isActive: m.isActive, sortOrder: m.sortOrder, zones: m.zones || [] }); setShowForm(true); }}
                      className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg"><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(m._id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit' : 'Add'} Shipping Method</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rate Type</label>
                  <select value={form.rateType} onChange={(e) => setForm({ ...form, rateType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">
                    {RATE_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                {form.rateType !== 'free' && (
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rate ($)</label>
                    <input type="number" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
                  </div>
                )}
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Est. Days</label>
                  <input type="text" value={form.estimatedDays} onChange={(e) => setForm({ ...form, estimatedDays: e.target.value })}
                    placeholder="e.g. 3-5 business days"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Carrier</label>
                  <input type="text" value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })}
                    placeholder="e.g. NZ Post"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50">
                  {saving ? <Loader2 className="animate-spin" size={16} /> : null}
                  {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
