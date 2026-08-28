/**
 * @module Discounts Page
 * @description Admin page for managing discount codes and coupons.
 */

import { useEffect, useState, useCallback } from 'react';
import { Search, Loader2, Tag, Plus, Edit2, Trash2, X, Copy } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface PromoCode {
  _id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  usageCount: number;
  usageLimit?: number;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
}

export default function Discounts() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PromoCode | null>(null);
  const [form, setForm] = useState({ code: '', description: '', discountType: 'percentage' as 'percentage' | 'fixed', discountValue: 0, usageLimit: 0, expiresAt: '', isActive: true });
  const [saving, setSaving] = useState(false);

  const fetchCodes = useCallback(async () => {
    try {
      setLoading(true);
      // Use admin commerce settings endpoint for now - PromoCode model needs its own route
      setCodes([]);
    } catch { toast.error('Failed to load discount codes'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Discounts</h1>
          <p className="text-sm text-gray-500 mt-1">Manage discount codes and promotions</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-all">
          <Plus size={16} /> Create Discount
        </button>
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
                    <button className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg"><Edit2 size={16} /></button>
                    <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
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
