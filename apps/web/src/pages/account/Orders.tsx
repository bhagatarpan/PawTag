import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import api from '../../lib/api';

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get('/customer/orders').then((r) => setOrders(r.data.data)).catch(console.error).finally(() => setLoading(false)); }, []);

  const statusColor = (s: string) => {
    const m: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-700', paid: 'bg-blue-100 text-blue-700', shipped: 'bg-purple-100 text-purple-700', delivered: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700', refunded: 'bg-gray-100 text-gray-700' };
    return m[s] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Orders</h1>
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="bg-white rounded-lg border p-4 animate-pulse h-24" />)}</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center">
          <ShoppingBag size={48} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No orders yet.</p>
          <p className="text-sm text-gray-400 mt-1">Your orders will appear here after purchasing tags.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order._id}
              to={`/account/orders/${order._id}`}
              className="block bg-white rounded-lg border p-4 hover:border-teal-300 hover:shadow-sm transition-all"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-mono text-sm font-medium">{order.orderNumber || `#${order._id.slice(-8).toUpperCase()}`}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(order.createdAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColor(order.status)}`}>{order.status}</span>
                  <span className="text-sm font-semibold">${order.payment?.amount?.toFixed(2) || order.totalAmount?.toFixed(2) || '0.00'}</span>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
