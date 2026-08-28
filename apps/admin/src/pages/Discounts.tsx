/**
 * @module Discounts Page
 * @description Admin page for managing discount codes and coupons.
 */

import { useEffect, useState, useCallback } from 'react';
import { Search, Loader2, Tag, Plus, Edit2, Trash2, X } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface PromoCode {
  _id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  usageCount: number;
  usageLimit?: number;
  perUserLimit?: number;
  isActive: boolean;
  startsAt?: string;
  expiresAt?: string;
  createdAt: string;
}

const EMPTY_FORM = { code: '', description: '', discountType: 'percentage' as 'percentage' | 'fixed', discountValue: 0, maxDiscountAmount: 0, minOrderAmount: 0, usageLimit: 0, perUserLimit: 0, isActive: true, startsAt: '', expiresAt: '' };

export default function Discounts() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PromoCode | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchCodes = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = { page, limit: 20 };
      if (search) params.search = search;
      const res = await api.get('/admin/commerce/promo-codes', { params });
      const data = res.data?.data;
      setCodes(data?.items || []);
      setTotalPages(data?.totalPages || 1);
      setTotal(data?.total || 0);
    } catch { toast.error('Failed to load discount codes'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  const handleSave = async () => {
    if (!form.code || !form.discountType || form.discountValue <= 0) {
      toast.error('Code, type, and value are required'); return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/commerce/promo-codes/${editing._id}`, form);
        toast.success('Discount code updated');
      } else {
        await api.post('/admin/commerce/promo-codes', form);
        toast.success('Discount code created');
      }
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      fetchCodes();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Delete discount code "${code}"?`)) return;
    try {
      await api.delete(`/admin/commerce/promo-codes/${id}`);
      toast.success('Discount code deleted');
      fetchCodes();
    } catch { toast.error('Failed to delete'); }
  };

  const startEdit = (c: PromoCode) => {
    setEditing(c);
    setForm({
      code: c.code, description: c.description || '', discountType: c.discountType,
      discountValue: c.discountValue, maxDiscountAmount: c.maxDiscountAmount || 0,
      minOrderAmount: c.minOrderAmount || 0, usageLimit: c.usageLimit || 0,
      perUserLimit: c.perUserLimit || 0, isActive: c.isActive,
      startsAt: c.startsAt ? new Date(c.startsAt).toISOString().slice(0, 10) : '',
      expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 10) : '',
    });
    setShowForm(true);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Discounts</h1>
          <p className="text-sm text-gray-500 mt-1">{total} discount codes</p>
        </div>
        <button onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-all">
          <Plus size={16} /> Create Discount
        </button>
      </div>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Search by code..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-teal-500" size={24} /></div>
        ) : codes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Tag size={32} className="mb-2" /><p>No discount codes yet</p>
            <p className="text-sm mt-1">Create your first discount code to get started</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Value</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Usage</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {codes.map((c) => (
                <tr key={c._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900">{c.code}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">{c.description || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{c.discountType === 'percentage' ? 'Percentage' : 'Fixed'}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                    {c.discountType === 'percentage' ? `${c.discountValue}%` : `$${c.discountValue.toFixed(2)}`}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">
                    {c.usageCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => startEdit(c)} className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg"><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(c._id, c.code)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Previous</button>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit' : 'Create'} Discount Code</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. WELCOME10" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. Welcome discount for new customers" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Value {form.discountType === 'percentage' ? '(%)' : '($)'}</label>
                  <input type="number" step="0.01" min="0" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Order Amount ($)</label>
                  <input type="number" step="0.01" min="0" value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usage Limit</label>
                  <input type="number" min="0" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: Number(e.target.value) })}
                    placeholder="0 = unlimited" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Per-User Limit</label>
                  <input type="number" min="0" value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: Number(e.target.value) })}
                    placeholder="0 = unlimited" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Starts At</label>
                  <input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expires At</label>
                  <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                <label className="text-sm text-gray-700">Active</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
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
