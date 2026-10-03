/**
 * @module Returns Page
 * @description Admin page for managing return requests and processing Stripe refunds.
 */

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API } from '@pawtag/shared/api';
import { Search, Loader2, RotateCcw, Eye, AlertTriangle } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface ReturnRequest {
  _id: string;
  orderNumber: string;
  userId: { fullName: string; email: string; phoneNumber?: string } | string;
  status: 'pending' | 'approved' | 'rejected' | 'received' | 'refunded' | 'refund_failed';
  reason: string;
  items: Array<{ productName: string; quantity: number; reason?: string; unitPrice?: number; refundedQuantity?: number }>;
  refundAmount?: number;
  refundId?: string;
  refundStatus?: string;
  refundArn?: string;
  refundWithoutReturn?: boolean;
  refundExceptionReason?: string;
  refundFailureReason?: string;
  returnShipProvider?: string;
  returnTrackingNumber?: string;
  returnTrackingUrl?: string;
  returnTrackingSubmittedAt?: string;
  returnTrackingSource?: string;
  createdAt: string;
  orderId?: {
    _id?: string;
    status?: string;
    payment?: { amount?: number; currency?: string; cardBrand?: string; cardLast4?: string };
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Approved', color: 'bg-blue-100 text-blue-700' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  received: { label: 'Received', color: 'bg-purple-100 text-purple-700' },
  refunded: { label: 'Refunded', color: 'bg-green-100 text-green-700' },
  refund_failed: { label: 'Refund failed', color: 'bg-red-100 text-red-700' },
};

export default function Returns() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || 'all';
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [selected, setSelected] = useState<ReturnRequest | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [exceptionReason, setExceptionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchReturns = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = { limit: 50 };
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get(API.admin.commerce.returns.list, { params });
      setReturns(res.data?.data?.items || []);
    } catch { toast.error('Failed to load returns'); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchReturns(); }, [fetchReturns]);

  const handleStatusFilterChange = (s: string) => {
    setStatusFilter(s);
    if (s === 'all') setSearchParams({});
    else setSearchParams({ status: s });
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.put(API.admin.commerce.returns.setStatus(id), { status });
      toast.success(`Return ${status}`);
      setSelected(null);
      fetchReturns();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  };

  const openDetail = (r: ReturnRequest) => {
    setSelected(r);
    setRefundAmount(r.refundAmount ? String(r.refundAmount) : '');
    setRefundReason('');
    setExceptionReason('');
  };

  const processRefund = async (mode: 'normal' | 'without-return') => {
    if (!selected) return;
    if (!refundReason.trim()) {
      toast.error('Refund reason is required');
      return;
    }
    if (mode === 'without-return' && !exceptionReason.trim()) {
      toast.error('Exception reason is required for refund without return');
      return;
    }
    setProcessing(true);
    try {
      const endpoint = mode === 'without-return'
        ? API.admin.commerce.returns.refundWithoutReturn(selected._id)
        : API.admin.commerce.returns.refund(selected._id);
      const body: Record<string, any> = { reason: refundReason.trim() };
      if (refundAmount) body.amount = Number(refundAmount);
      if (mode === 'without-return') body.exceptionReason = exceptionReason.trim();
      const res = await api.post(endpoint, body);
      const data = res.data?.data || {};
      toast.success(data.message || 'Refund processed');
      setSelected(null);
      fetchReturns();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to process refund');
    } finally {
      setProcessing(false);
    }
  };

  const getUserName = (r: ReturnRequest) => typeof r.userId === 'object' ? r.userId.fullName : 'Unknown';
  const getUserPhone = (r: ReturnRequest) => typeof r.userId === 'object' ? r.userId.phoneNumber : undefined;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Returns</h1>
        <p className="text-sm text-gray-500 mt-1">Manage return requests. Money refunds use Stripe via Process Refund — status alone does not move funds.</p>
      </div>
      <div className="flex flex-wrap gap-3 mb-6">
        {['all', 'pending', 'approved', 'rejected', 'received', 'refunded', 'refund_failed'].map((s) => (
          <button key={s} onClick={() => handleStatusFilterChange(s)}
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
                  <td className="px-4 py-3 text-center"><span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_CONFIG[r.status]?.color || 'bg-gray-100'}`}>{STATUS_CONFIG[r.status]?.label || r.status}</span></td>
                  <td className="px-4 py-3 text-right"><button onClick={() => openDetail(r)} className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg"><Eye size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Return Request</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Order</span><span className="font-mono">{selected.orderNumber}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Customer</span><span>{getUserName(selected)}</span></div>
              {getUserPhone(selected) && (
                <div className="flex justify-between"><span className="text-gray-500">Phone</span><span>{getUserPhone(selected)}</span></div>
              )}
              <div className="flex justify-between"><span className="text-gray-500">Reason</span><span>{selected.reason}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_CONFIG[selected.status]?.color || 'bg-gray-100'}`}>{STATUS_CONFIG[selected.status]?.label || selected.status}</span></div>
              <div><span className="text-gray-500">Items:</span>
                <ul className="mt-1 space-y-1">
                  {selected.items.map((item, i) => (
                    <li key={i} className="text-gray-700">• {item.productName} × {item.quantity}{item.unitPrice != null ? ` — $${Number(item.unitPrice).toFixed(2)}` : ''}</li>
                  ))}
                </ul>
              </div>
              {selected.refundAmount != null && (
                <div className="flex justify-between"><span className="text-gray-500">Default refund amount</span><span className="font-semibold">${Number(selected.refundAmount).toFixed(2)}</span></div>
              )}
              {selected.returnTrackingNumber && (
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Return tracking</span>
                  <span className="font-mono text-xs text-right">
                    {selected.returnShipProvider} {selected.returnTrackingNumber}
                    {selected.returnTrackingUrl && (
                      <>
                        {' · '}
                        <a href={selected.returnTrackingUrl} target="_blank" rel="noopener noreferrer" className="text-teal-600 underline">
                          Track
                        </a>
                      </>
                    )}
                    {selected.returnTrackingSubmittedAt && (
                      <span className="block text-gray-400 font-normal">
                        {new Date(selected.returnTrackingSubmittedAt).toLocaleString('en-NZ')} · {selected.returnTrackingSource || 'customer'}
                      </span>
                    )}
                  </span>
                </div>
              )}
              {selected.orderId?.payment?.amount != null && (
                <div className="pt-2 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Order captured</span>
                    <span>${Number(selected.orderId.payment.amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Return default amount</span>
                    <span>${Number(selected.refundAmount || 0).toFixed(2)}</span>
                  </div>
                  <p>Remaining refundable is re-checked server-side when Process Refund runs.</p>
                </div>
              )}
              {selected.refundId && (
                <div className="flex justify-between"><span className="text-gray-500">Stripe refund</span><span className="font-mono text-xs">{selected.refundId}</span></div>
              )}
              {selected.refundArn && (
                <div className="flex justify-between"><span className="text-gray-500">ARN</span><span className="font-mono text-xs">{selected.refundArn}</span></div>
              )}
              {selected.refundWithoutReturn && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  Refund without return — {selected.refundExceptionReason || 'exception approved'}
                </div>
              )}
              {selected.refundFailureReason && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {selected.refundFailureReason}
                </div>
              )}
            </div>

            {selected.status === 'pending' && (
              <div className="flex gap-2 mt-4">
                <button onClick={() => updateStatus(selected._id, 'approved')} className="flex-1 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700">Approve</button>
                <button onClick={() => updateStatus(selected._id, 'rejected')} className="flex-1 px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700">Reject</button>
              </div>
            )}
            {selected.status === 'approved' && (
              <button onClick={() => updateStatus(selected._id, 'received')} className="w-full mt-4 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">Mark as Received</button>
            )}

            {(selected.status === 'received' || selected.status === 'refund_failed' || selected.status === 'approved') && (
              <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
                <div className="flex items-center gap-2 text-xs text-amber-700">
                  <AlertTriangle size={14} />
                  {selected.status !== 'received'
                    ? 'Normal refunds require warehouse receipt. Use refund without return only with an approved exception.'
                    : 'Process refund sends money via Stripe to the original payment method.'}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Refund amount (optional — defaults to return amount)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder={selected.refundAmount != null ? String(selected.refundAmount) : '0.00'}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Refund reason *</label>
                  <input
                    type="text"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Why is this refund being processed?"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Exception reason (refund without return)</label>
                  <input
                    type="text"
                    value={exceptionReason}
                    onChange={(e) => setExceptionReason(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Required only for refund without return"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => processRefund('normal')}
                    disabled={processing || selected.status !== 'received'}
                    className="w-full px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {processing ? 'Processing…' : 'Process Refund (Stripe)'}
                  </button>
                  <button
                    onClick={() => processRefund('without-return')}
                    disabled={processing}
                    className="w-full px-4 py-2 text-sm text-amber-800 bg-amber-50 border border-amber-300 rounded-lg hover:bg-amber-100 disabled:opacity-50"
                  >
                    Approve Refund Without Return + Process
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
