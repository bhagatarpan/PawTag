/**
 * @module Fulfilment Page
 * @description Admin page for managing order fulfilment workflow.
 *
 * Shows fulfilment status across all stages:
 * pending → picking → packing → fulfilled
 *
 * Staff can:
 * 1. View fulfilment details
 * 2. Assign Tag IDs to order items
 * 3. Confirm NFC writes
 * 4. Progress through fulfilment stages
 */

import { useEffect, useState, useCallback } from 'react';
import { API } from '@pawtag/shared/api';
import {
  Search, Loader2, ClipboardCheck, Clock, Package, CheckCircle, Filter,
  Eye, X, Copy, ExternalLink, Tag, Nfc, AlertTriangle, Check,
} from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface TagAssignment {
  tagId: string;
  productId: string;
  orderItemId: string;
  nfcWritten: boolean;
  assignedAt: string;
  assignedBy: string;
  confirmedAt?: string;
  confirmedBy?: string;
}

interface FulfilmentItem {
  orderItemId: string;
  productName: string;
  quantity: number;
  pickedQuantity: number;
  packedQuantity: number;
}

interface Fulfilment {
  _id: string;
  orderId: { _id: string; orderNumber: string; status: string; userId: { _id: string; fullName: string; email: string } } | string;
  orderNumber: string;
  status: 'pending' | 'picking' | 'packing' | 'fulfilled';
  items: FulfilmentItem[];
  tagAssignments: TagAssignment[];
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

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copied to clipboard'),
    () => toast.error('Failed to copy'),
  );
}

/* ------------------------------------------------------------------ */
/*  Detail Drawer                                                      */
/* ------------------------------------------------------------------ */

function FulfilmentDetailDrawer({
  fulfilment,
  onClose,
  onRefresh,
}: {
  fulfilment: Fulfilment | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [assigning, setAssigning] = useState<string | null>(null);
  const [confirmingNfc, setConfirmingNfc] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
    if (!fulfilment) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [fulfilment, onClose]);

  if (!fulfilment) return null;

  const handleAssignTag = async (orderItemId: string, productId: string) => {
    setAssigning(orderItemId);
    try {
      const res = await api.post(`/admin/commerce/fulfilments/${fulfilment._id}/assign-tag`, {
        orderItemId,
        productId,
      });
      toast.success(`Tag assigned: ${res.data.data.tagId}`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to assign tag');
    } finally {
      setAssigning(null);
    }
  };

  const handleConfirmNfc = async (tagId: string) => {
    setConfirmingNfc(tagId);
    try {
      await api.put(`/admin/commerce/fulfilments/${fulfilment._id}/confirm-nfc`, { tagId });
      toast.success('NFC write confirmed');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to confirm NFC');
    } finally {
      setConfirmingNfc(null);
    }
  };

  const handleStatusChange = async (status: string) => {
    setStatusLoading(true);
    try {
      const res = await api.put(`/admin/commerce/fulfilments/${fulfilment._id}/status`, { status });
      const trackingMissing = Boolean(res.data?.orderSync?.trackingMissing);
      if (status === 'fulfilled' && trackingMissing) {
        toast.success(`Fulfilment marked as ${status} — Create Shipment to generate tracking`);
      } else {
        toast.success(`Fulfilment marked as ${status}`);
      }
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    } finally {
      setStatusLoading(false);
    }
  };

  const owner = typeof fulfilment.orderId === 'object' ? fulfilment.orderId.userId : null;
  const allAssigned = fulfilment.items.every((item) =>
    fulfilment.tagAssignments.some((ta) => ta.orderItemId === item.orderItemId)
  );
  const allNfcWritten = fulfilment.tagAssignments.length > 0 &&
    fulfilment.tagAssignments.every((ta) => ta.nfcWritten);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{fulfilment.orderNumber}</h2>
            <p className="text-sm text-gray-500">Fulfilment Details</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Status */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Status</h3>
            <div className="flex items-center gap-2">
              {(['pending', 'picking', 'packing', 'fulfilled'] as const).map((s) => {
                const cfg = STATUS_CONFIG[s];
                const Icon = cfg.icon;
                const isActive = fulfilment.status === s;
                const isPast = ['pending', 'picking', 'packing', 'fulfilled'].indexOf(fulfilment.status) > ['pending', 'picking', 'packing', 'fulfilled'].indexOf(s);
                return (
                  <div key={s} className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    isActive ? cfg.color : isPast ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {isPast ? <Check size={12} /> : <Icon size={12} />}
                    {cfg.label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Owner */}
          {owner && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Customer</h3>
              <p className="text-sm font-medium text-gray-900">{owner.fullName}</p>
              <p className="text-xs text-gray-500">{owner.email}</p>
            </div>
          )}

          {/* Items + Tag Assignment */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Items & Tag Assignment</h3>
            <div className="space-y-3">
              {fulfilment.items.map((item, idx) => {
                const assignment = fulfilment.tagAssignments.find(
                  (ta) => ta.orderItemId === item.orderItemId
                );
                return (
                  <div key={idx} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      {assignment ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                          <Check size={12} /> Tag Assigned
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                          <AlertTriangle size={12} /> No Tag
                        </span>
                      )}
                    </div>

                    {assignment ? (
                      <div className="bg-gray-50 rounded-lg p-2 space-y-1">
                        <div className="flex items-center gap-2">
                          <Tag size={12} className="text-gray-400" />
                          <span className="font-mono text-sm font-medium text-gray-900">{assignment.tagId}</span>
                          <button onClick={() => copyToClipboard(assignment.tagId)} className="text-gray-400 hover:text-gray-600">
                            <Copy size={12} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {assignment.nfcWritten ? (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <Check size={12} /> NFC Written
                            </span>
                          ) : (
                            <button
                              onClick={() => handleConfirmNfc(assignment.tagId)}
                              disabled={confirmingNfc === assignment.tagId}
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 disabled:opacity-50"
                            >
                              {confirmingNfc === assignment.tagId ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Nfc size={12} />
                              )}
                              Confirm NFC Written
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAssignTag(item.orderItemId, item.orderItemId)}
                        disabled={assigning === item.orderItemId || fulfilment.status === 'fulfilled'}
                        className="mt-1 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50"
                      >
                        {assigning === item.orderItemId ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Tag size={12} />
                        )}
                        Assign Tag ID
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          {fulfilment.notes && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</h3>
              <p className="text-sm text-gray-600">{fulfilment.notes}</p>
            </div>
          )}

          {/* Status Actions */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Actions</h3>
            <div className="flex flex-wrap gap-2">
              {fulfilment.status === 'pending' && (
                <button
                  onClick={() => handleStatusChange('picking')}
                  disabled={statusLoading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg disabled:opacity-50"
                >
                  {statusLoading && <Loader2 size={12} className="animate-spin" />}
                  Start Picking
                </button>
              )}
              {fulfilment.status === 'picking' && (
                <>
                  <button
                    onClick={() => handleStatusChange('pending')}
                    disabled={statusLoading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                  >
                    {statusLoading && <Loader2 size={12} className="animate-spin" />}
                    Move Back to Pending
                  </button>
                  <button
                    onClick={() => handleStatusChange('packing')}
                    disabled={statusLoading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg disabled:opacity-50"
                  >
                    {statusLoading && <Loader2 size={12} className="animate-spin" />}
                    Start Packing
                  </button>
                </>
              )}
              {fulfilment.status === 'packing' && (
                <>
                  <button
                    onClick={() => handleStatusChange('picking')}
                    disabled={statusLoading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                  >
                    {statusLoading && <Loader2 size={12} className="animate-spin" />}
                    Move Back to Picking
                  </button>
                  <button
                    onClick={() => handleStatusChange('fulfilled')}
                    disabled={statusLoading || !allAssigned}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg disabled:opacity-50"
                    title={!allAssigned ? 'Assign tags to all items before fulfilling' : ''}
                  >
                    {statusLoading && <Loader2 size={12} className="animate-spin" />}
                    Mark Fulfilled
                  </button>
                </>
              )}
              {fulfilment.status === 'fulfilled' && (
                <>
                  <button
                    onClick={() => handleStatusChange('packing')}
                    disabled={statusLoading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                  >
                    {statusLoading && <Loader2 size={12} className="animate-spin" />}
                    Move Back to Packing
                  </button>
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg">
                    <CheckCircle size={12} /> Fulfilled
                  </span>
                </>
              )}
            </div>
            {!allAssigned && fulfilment.status === 'packing' && (
              <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle size={12} />
                Assign tags to all items before marking as fulfilled.
              </p>
            )}
            {fulfilment.status === 'fulfilled' && (
              <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle size={12} />
                Warehouse complete — if the order has no tracking yet, open Orders and use Create Shipment.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function Fulfilment() {
  const [fulfilments, setFulfilments] = useState<Fulfilment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedFulfilment, setSelectedFulfilment] = useState<Fulfilment | null>(null);

  const fetchFulfilments = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = { page, limit: 20 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search) params.search = search;
      const res = await api.get(API.admin.commerce.fulfilments.list, { params });
      const data = res.data?.data;
      setFulfilments(data?.items || []);
      setTotalPages(data?.totalPages || 1);
    } catch { toast.error('Failed to load fulfilments'); }
    finally { setLoading(false); }
  }, [page, statusFilter, search]);

  useEffect(() => { fetchFulfilments(); }, [fetchFulfilments]);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fulfilment</h1>
        <p className="text-sm text-gray-500 mt-1">Manage order fulfilment workflow — assign tags, confirm NFC, and ship</p>
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
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Tags</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fulfilments.map((f) => {
                const cfg = STATUS_CONFIG[f.status];
                const Icon = cfg.icon;
                const tagsAssigned = f.tagAssignments?.length || 0;
                const totalItems = f.items.reduce((sum, i) => sum + i.quantity, 0);
                return (
                  <tr key={f._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedFulfilment(f)}>
                    <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900">{f.orderNumber}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${cfg.color}`}>
                        <Icon size={12} /> {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{totalItems} item{totalItems !== 1 ? 's' : ''}</td>
                    <td className="px-4 py-3 text-center text-sm">
                      {tagsAssigned > 0 ? (
                        <span className="text-green-600 font-medium">{tagsAssigned}/{totalItems}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(f.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors">
                        <Eye size={16} />
                      </button>
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

      {/* Detail Drawer */}
      <FulfilmentDetailDrawer
        fulfilment={selectedFulfilment}
        onClose={() => setSelectedFulfilment(null)}
        onRefresh={() => {
          fetchFulfilments();
          if (selectedFulfilment) {
            api.get(`/admin/commerce/fulfilments/${selectedFulfilment._id}`).then((r) => {
              setSelectedFulfilment(r.data.data);
            }).catch(() => {});
          }
        }}
      />
    </div>
  );
}
