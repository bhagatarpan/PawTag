/**
 * @module Shipments Page
 * @description Admin page for managing shipments and tracking.
 *
 * Shows all shipments with status filtering, search, and tracking details.
 * Allows creating shipments from orders and updating shipment status.
 */

import { useEffect, useState, useCallback } from 'react';
import { Search, Loader2, Truck, Package, CheckCircle, Clock, AlertTriangle, ExternalLink, RefreshCw, Filter } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface Shipment {
  _id: string;
  orderId: { _id: string; orderNumber: string; status: string } | string;
  orderNumber: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  labelUrl?: string;
  status: string;
  shippingAddress: { line1: string; city: string; state: string; zip: string; country: string };
  items: Array<{ productName: string; quantity: number }>;
  estimatedDelivery?: string;
  actualDelivery?: string;
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  label_created: { label: 'Label Created', color: 'bg-blue-100 text-blue-700', icon: Package },
  picked_up: { label: 'Picked Up', color: 'bg-indigo-100 text-indigo-700', icon: Truck },
  in_transit: { label: 'In Transit', color: 'bg-yellow-100 text-yellow-700', icon: Truck },
  out_for_delivery: { label: 'Out for Delivery', color: 'bg-orange-100 text-orange-700', icon: Truck },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  returned: { label: 'Returned', color: 'bg-gray-100 text-gray-700', icon: Package },
  exception: { label: 'Exception', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  delayed: { label: 'Delayed', color: 'bg-orange-100 text-orange-700', icon: Clock },
};

const STATUS_OPTIONS = ['all', 'label_created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'];

export default function Shipments() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [trackingEvents, setTrackingEvents] = useState<any[]>([]);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [polling, setPolling] = useState(false);

  const fetchShipments = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = { page, limit: 20 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search) params.search = search;
      const res = await api.get('/admin/commerce/shipments', { params });
      const data = res.data?.data;
      setShipments(data?.items || []);
      setTotalPages(data?.totalPages || 1);
      setTotal(data?.total || 0);
    } catch {
      toast.error('Failed to load shipments');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  const viewTracking = async (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setLoadingTracking(true);
    setTrackingEvents([]);
    try {
      const res = await api.get(`/admin/commerce/shipments/${shipment._id}/tracking`);
      setTrackingEvents(res.data?.data || []);
    } catch {
      toast.error('Failed to load tracking events');
    } finally {
      setLoadingTracking(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.put(`/admin/commerce/shipments/${id}/status`, { status });
      toast.success(`Shipment marked as ${STATUS_CONFIG[status]?.label || status}`);
      fetchShipments();
      if (selectedShipment?._id === id) {
        setSelectedShipment({ ...selectedShipment, status });
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  const pollTracking = async () => {
    try {
      setPolling(true);
      const res = await api.post('/admin/commerce/shipments/poll-tracking');
      const data = res.data?.data;
      toast.success(`Tracking updated: ${data?.updated || 0} shipments, ${data?.errors || 0} errors`);
      fetchShipments();
    } catch {
      toast.error('Failed to poll tracking updates');
    } finally {
      setPolling(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
          <p className="text-sm text-gray-500 mt-1">Track and manage shipments ({total} total)</p>
        </div>
        <button
          onClick={pollTracking}
          disabled={polling}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm"
        >
          <RefreshCw size={16} className={polling ? 'animate-spin' : ''} />
          {polling ? 'Polling...' : 'Poll Tracking'}
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by tracking number or order..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={16} className="text-gray-400" />
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === s
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Shipment list */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="animate-spin text-teal-500" size={24} />
            </div>
          ) : shipments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Truck size={32} className="mb-2" />
              <p>No shipments found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Order</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Carrier</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tracking</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Shipped</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shipments.map((shipment) => {
                  const statusConf = STATUS_CONFIG[shipment.status] || STATUS_CONFIG.label_created;
                  const StatusIcon = statusConf.icon;
                  return (
                    <tr
                      key={shipment._id}
                      className={`hover:bg-gray-50 cursor-pointer ${selectedShipment?._id === shipment._id ? 'bg-teal-50' : ''}`}
                      onClick={() => viewTracking(shipment)}
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {typeof shipment.orderId === 'object' ? shipment.orderId.orderNumber : shipment.orderNumber}
                        </div>
                        <div className="text-xs text-gray-500">{shipment.items.length} item(s)</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{shipment.carrier}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-gray-900">{shipment.trackingNumber}</span>
                          {shipment.trackingUrl && (
                            <a
                              href={shipment.trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-teal-600 hover:text-teal-700"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConf.color}`}>
                          <StatusIcon size={12} />
                          {statusConf.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {shipment.shippedAt
                          ? new Date(shipment.shippedAt).toLocaleDateString('en-NZ')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {shipment.status !== 'delivered' && shipment.status !== 'failed' && shipment.status !== 'returned' && (
                            <select
                              className="text-xs border border-gray-300 rounded px-2 py-1"
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                if (e.target.value) updateStatus(shipment._id, e.target.value);
                                e.target.value = '';
                              }}
                              defaultValue=""
                            >
                              <option value="" disabled>Update...</option>
                              {Object.entries(STATUS_CONFIG)
                                .filter(([key]) => key !== shipment.status)
                                .map(([key, conf]) => (
                                  <option key={key} value={key}>{conf.label}</option>
                                ))}
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Tracking detail panel */}
        {selectedShipment && (
          <div className="w-96 bg-white rounded-xl border border-gray-200 p-4 h-fit sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Tracking Details</h3>
              <button
                onClick={() => setSelectedShipment(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <span className="text-xs text-gray-500">Order</span>
                <div className="text-sm font-medium">
                  {typeof selectedShipment.orderId === 'object' ? selectedShipment.orderId.orderNumber : selectedShipment.orderNumber}
                </div>
              </div>
              <div>
                <span className="text-xs text-gray-500">Carrier</span>
                <div className="text-sm">{selectedShipment.carrier}</div>
              </div>
              <div>
                <span className="text-xs text-gray-500">Tracking Number</span>
                <div className="text-sm font-mono">{selectedShipment.trackingNumber}</div>
              </div>
              <div>
                <span className="text-xs text-gray-500">Destination</span>
                <div className="text-sm">
                  {selectedShipment.shippingAddress.line1}, {selectedShipment.shippingAddress.city}
                </div>
              </div>
              {selectedShipment.labelUrl && (
                <div>
                  <a
                    href={`/api/admin/commerce/shipments/${selectedShipment._id}/label`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700"
                  >
                    <Package size={14} />
                    Download Label
                  </a>
                </div>
              )}
            </div>

            <h4 className="font-medium text-gray-900 mb-2 text-sm">Tracking Events</h4>
            {loadingTracking ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="animate-spin text-teal-500" size={20} />
              </div>
            ) : trackingEvents.length === 0 ? (
              <p className="text-sm text-gray-400">No tracking events</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {trackingEvents.map((event, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-teal-500" />
                      {idx < trackingEvents.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                    </div>
                    <div className="pb-3">
                      <div className="text-xs text-gray-500">
                        {new Date(event.timestamp).toLocaleString('en-NZ')}
                      </div>
                      <div className="text-sm text-gray-900">{event.description}</div>
                      {event.location && (
                        <div className="text-xs text-gray-400">{event.location}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
