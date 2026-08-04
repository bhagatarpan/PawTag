import { useEffect, useState } from 'react';
import api, { PaginatedData } from '../lib/api';

const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['pending_payment', 'paid', 'cancelled'],
  pending_payment: ['paid', 'cancelled'],
  paid: ['packing', 'cancelled', 'refunded'],
  packing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  pending_payment: 'Pending Payment',
  paid: 'Paid',
  packing: 'Packing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export default function Orders() {
  const [data, setData] = useState<PaginatedData<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [actionModal, setActionModal] = useState<{ orderId: string; action: 'cancel' | 'refund' } | null>(null);
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrders = () => {
    setLoading(true);
    const params: any = { page, limit: 20 };
    if (statusFilter) params.status = statusFilter;
    api
      .get('/admin/orders', { params })
      .then((res) => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrders(); }, [page, statusFilter]);

  const updateStatus = async (id: string, status: string) => {
    await api.put(`/admin/orders/${id}/status`, { status });
    fetchOrders();
  };

  const executeAction = async () => {
    if (!actionModal || !reason.trim()) return;
    setActionLoading(true);
    try {
      await api.post(`/admin/orders/${actionModal.orderId}/${actionModal.action}`, { reason: reason.trim() });
      setActionModal(null);
      setReason('');
      fetchOrders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const canCancel = (status: string) => ORDER_STATUS_TRANSITIONS[status]?.includes('cancelled');
  const canRefund = (status: string) => ORDER_STATUS_TRANSITIONS[status]?.includes('refunded');
  const canShip = (status: string) => ORDER_STATUS_TRANSITIONS[status]?.includes('shipped');

  const createShipment = async (orderId: string) => {
    if (!confirm('Create shipment for this order?')) return;
    try {
      const res = await api.post(`/admin/orders/${orderId}/create-shipment`);
      alert(`Shipment created!\nTracking: ${res.data.data.trackingNumber}\nCarrier: ${res.data.data.carrier}`);
      fetchOrders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create shipment');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Order Management</h1>

      <div className="flex gap-4 items-center">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="pending_payment">Pending Payment</option>
          <option value="paid">Paid</option>
          <option value="packing">Packing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Order #</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Customer</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Items</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Amount</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Invoice</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-500">No orders found</td></tr>
            ) : (
              data?.items.map((order: any) => (
                <tr key={order._id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium font-mono">{order.orderNumber}</td>
                  <td className="px-5 py-3 text-gray-600">{order.userId?.fullName || 'N/A'}</td>
                  <td className="px-5 py-3 text-gray-600">{order.items?.length || 0} items</td>
                  <td className="px-5 py-3">${order.payment?.amount?.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <select
                      value=""
                      onChange={(e) => { if (e.target.value) updateStatus(order._id, e.target.value); }}
                      className="border border-gray-200 rounded px-2 py-1 text-xs"
                    >
                      <option value="" disabled>{STATUS_LABELS[order.status] || order.status}</option>
                      {(ORDER_STATUS_TRANSITIONS[order.status] || []).map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    {order.latestInvoice ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{order.latestInvoice.invoiceNumber}</span>
                        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          order.latestInvoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                          order.latestInvoice.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>{order.latestInvoice.status}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No invoice</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {order.latestInvoice && (
                        <>
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/admin/invoices/${order.latestInvoice._id}/view`, {
                                  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('admin_token') },
                                });
                                const data = await res.json();
                                if (data.success) window.open(data.data.secureUrl, '_blank');
                              } catch {}
                            }}
                            className="text-teal-600 hover:text-teal-700 text-xs font-medium border border-teal-200 px-2 py-1 rounded hover:bg-teal-50"
                          >View</button>
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/admin/invoices/${order.latestInvoice._id}/email`, {
                                  method: 'POST',
                                  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('admin_token'), 'Content-Type': 'application/json' },
                                });
                                const data = await res.json();
                                if (data.success) alert(data.data.message);
                                else alert(data.error || 'Failed');
                              } catch { alert('Failed to email'); }
                            }}
                            className="text-blue-600 hover:text-blue-700 text-xs font-medium border border-blue-200 px-2 py-1 rounded hover:bg-blue-50"
                          >Email</button>
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/admin/invoices/${order.latestInvoice._id}/print`, {
                                  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('admin_token') },
                                });
                                const html = await res.text();
                                const w = window.open('', '_blank');
                                if (w) { w.document.write(html); w.document.close(); }
                              } catch { alert('Failed to print invoice'); }
                            }}
                            className="text-gray-600 hover:text-gray-700 text-xs font-medium border border-gray-200 px-2 py-1 rounded hover:bg-gray-50"
                          >Print</button>
                        </>
                      )}
                      {canCancel(order.status) && (
                        <button
                          onClick={() => setActionModal({ orderId: order._id, action: 'cancel' })}
                          className="text-red-600 hover:text-red-700 text-xs font-medium border border-red-200 px-2 py-1 rounded hover:bg-red-50"
                        >Cancel</button>
                      )}
                      {canRefund(order.status) && (
                        <button
                          onClick={() => setActionModal({ orderId: order._id, action: 'refund' })}
                          className="text-orange-600 hover:text-orange-700 text-xs font-medium border border-orange-200 px-2 py-1 rounded hover:bg-orange-50"
                        >Refund</button>
                      )}
                      {canShip(order.status) && (
                        <button
                          onClick={() => createShipment(order._id)}
                          className="text-indigo-600 hover:text-indigo-700 text-xs font-medium border border-indigo-200 px-2 py-1 rounded hover:bg-indigo-50"
                        >Ship</button>
                      )}
                      {order.trackingNumber && (
                        <span className="text-xs text-gray-500 font-mono" title={order.carrier}>
                          {order.trackingNumber}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {actionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {actionModal.action === 'cancel' ? 'Cancel Order' : 'Refund Order'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {actionModal.action === 'cancel'
                ? 'This will cancel the order and restore stock. This action cannot be undone.'
                : 'This will refund the payment via Stripe and mark the order as refunded. This action cannot be undone.'}
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (required)"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setActionModal(null); setReason(''); }}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
              >Cancel</button>
              <button
                onClick={executeAction}
                disabled={!reason.trim() || actionLoading}
                className={`px-4 py-2 text-sm text-white rounded disabled:opacity-50 ${
                  actionModal.action === 'cancel' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {actionLoading ? 'Processing...' : actionModal.action === 'cancel' ? 'Cancel Order' : 'Refund Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
