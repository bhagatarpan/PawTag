/**
 * @module Returns Page
 * @description Admin page for managing return requests.
 */

import { useEffect, useState, useCallback } from 'react';
import { Search, Loader2, RotateCcw, Filter, Eye } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface ReturnRequest {
  _id: string;
  orderNumber: string;
  userId: { fullName: string; email: string } | string;
  status: 'pending' | 'approved' | 'rejected' | 'received' | 'refunded';
  reason: string;
  items: Array<{ productName: string; quantity: number; reason?: string }>;
  refundAmount?: number;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Approved', color: 'bg-blue-100 text-blue-700' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  received: { label: 'Received', color: 'bg-purple-100 text-purple-700' },
  refunded: { label: 'Refunded', color: 'bg-green-100 text-green-700' },
};

export default function Returns() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<ReturnRequest | null>(null);

  const fetchReturns = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = { limit: 50 };
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get('/admin/commerce/returns', { params });
      setReturns(res.data?.data?.items || []);
    } catch { toast.error('Failed to load returns'); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchReturns(); }, [fetchReturns]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.put(`/admin/commerce/returns/${id}/status`, { status });
      toast.success(`Return ${status}`);
      setSelected(null);
      fetchReturns();
    } catch { toast.error('Failed to update status'); }
  };

  const getUserName = (r: ReturnRequest) => typeof r.userId === 'object' ? r.userId.fullName : 'Unknown';

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Returns</h1>
        <p className="text-sm text-gray-500 mt-1">Manage return requests</p>
      </div>
      <div className="flex flex-wrap gap-3 mb-6">
        {['all', 'pending', 'approved', 'rejected', 'received', 'refunded'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === s ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-teal-500" size={24} /></div>
        ) : returns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400"><RotateCcw size={32} className="mb-2" /><p>No return requests</p></div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reason</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {returns.map((r) => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900">{r.orderNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{getUserName(r)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-[200px]">{r.reason}</td>
                  <td className="px-4 py-3 text-center"><span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_CONFIG[r.status].color}`}>{STATUS_CONFIG[r.status].label}</span></td>
                  <td className="px-4 py-3 text-right"><button onClick={() => setSelected(r)} className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg"><Eye size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Return Request</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Order</span><span className="font-mono">{selected.orderNumber}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Customer</span><span>{getUserName(selected)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Reason</span><span>{selected.reason}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_CONFIG[selected.status].color}`}>{STATUS_CONFIG[selected.status].label}</span></div>
              <div><span className="text-gray-500">Items:</span><ul className="mt-1 space-y-1">{selected.items.map((item, i) => (<li key={i} className="text-gray-700">• {item.productName} x {item.quantity}</li>))}</ul></div>
            </div>
            {selected.status === 'pending' && (
              <div className="flex gap-2 mt-4">
                <button onClick={() => updateStatus(selected._id, 'approved')} className="flex-1 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700">Approve</button>
                <button onClick={() => updateStatus(selected._id, 'rejected')} className="flex-1 px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700">Reject</button>
              </div>
            )}
            {selected.status === 'approved' && <button onClick={() => updateStatus(selected._id, 'received')} className="w-full mt-4 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">Mark as Received</button>}
            {selected.status === 'received' && <button onClick={() => updateStatus(selected._id, 'refunded')} className="w-full mt-4 px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700">Process Refund</button>}
          </div>
        </div>
      )}
    </div>
  );
}
