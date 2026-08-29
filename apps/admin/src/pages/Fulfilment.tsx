/**
 * @module Fulfilment Page
 * @description Admin page for managing order fulfilment workflow.
 *
 * Shows fulfilment status across all stages:
 * pending → picking → packing → fulfilled
 */

import { useEffect, useState, useCallback } from 'react';
import { Search, Loader2, ClipboardCheck, Clock, Package, CheckCircle, Filter } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface Fulfilment {
  _id: string;
  orderId: { _id: string; orderNumber: string; status: string } | string;
  orderNumber: string;
  status: 'pending' | 'picking' | 'packing' | 'fulfilled';
  items: Array<{ productName: string; quantity: number; pickedQuantity: number; packedQuantity: number }>;
  notes?: string;
  createdAt: string;
  fulfilledAt?: string;
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  picking: { label: 'Picking', color: 'bg-blue-100 text-blue-700', icon: Package },
  packing: { label: 'Packing', color: 'bg-purple-100 text-purple-700', icon: Package },
  fulfilled: { label: 'Fulfilled', color: 'bg-green-100 text-green-700', icon: CheckCircle },
};

const STATUS_OPTIONS = ['all', 'pending', 'picking', 'packing', 'fulfilled'];

export default function Fulfilment() {
  const [fulfilments, setFulfilments] = useState<Fulfilment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchFulfilments = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = { page, limit: 20 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search) params.search = search;
      const res = await api.get('/admin/commerce/fulfilments', { params });
      const data = res.data?.data;
      setFulfilments(data?.items || []);
      setTotalPages(data?.totalPages || 1);
    } catch { toast.error('Failed to load fulfilments'); }
    finally { setLoading(false); }
  }, [page, statusFilter, search]);

  useEffect(() => { fetchFulfilments(); }, [fetchFulfilments]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.put(`/admin/commerce/fulfilments/${id}/status`, { status });
      toast.success(`Fulfilment marked as ${status}`);
      fetchFulfilments();
    } catch { toast.error('Failed to update status'); }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fulfilment</h1>
        <p className="text-sm text-gray-500 mt-1">Manage order fulfilment workflow</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by order number..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          {STATUS_OPTIONS.map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === s ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-teal-500" size={24} /></div>
        ) : fulfilments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <ClipboardCheck size={32} className="mb-2" /><p>No fulfilments found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Items</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fulfilments.map((f) => {
                const cfg = STATUS_CONFIG[f.status];
                const Icon = cfg.icon;
                return (
                  <tr key={f._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900">{f.orderNumber}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${cfg.color}`}>
                        <Icon size={12} /> {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                      {f.items.reduce((sum, i) => sum + i.quantity, 0)} items
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(f.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      {f.status !== 'fulfilled' && (
                        <div className="flex gap-1 justify-end">
                          {f.status === 'pending' && <button onClick={() => updateStatus(f._id, 'picking')} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Start Picking</button>}
                          {f.status === 'picking' && <button onClick={() => updateStatus(f._id, 'packing')} className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200">Start Packing</button>}
                          {f.status === 'packing' && <button onClick={() => updateStatus(f._id, 'fulfilled')} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">Mark Fulfilled</button>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
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
    </div>
  );
}
