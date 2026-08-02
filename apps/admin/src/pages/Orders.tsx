import { useEffect, useState } from 'react';
import api, { PaginatedData } from '../lib/api';

export default function Orders() {
  const [data, setData] = useState<PaginatedData<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

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
          <option value="paid">Paid</option>
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
                      value={order.status}
                      onChange={(e) => updateStatus(order._id, e.target.value)}
                      className="border border-gray-200 rounded px-2 py-1 text-xs"
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="refunded">Refunded</option>
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
                    {order.latestInvoice && (
                      <div className="flex items-center gap-1">
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
                      </div>
                    )}
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
    </div>
  );
}
