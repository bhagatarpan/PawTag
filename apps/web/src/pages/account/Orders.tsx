import { useState, useEffect } from 'react';
import { ShoppingBag } from 'lucide-react';
import api from '../../lib/api';

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  useEffect(() => { api.get('/customer/orders').then((r) => setOrders(r.data.data)).catch(console.error).finally(() => setLoading(false)); }, []);

  const statusColor = (s: string) => {
    const m: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-700', paid: 'bg-blue-100 text-blue-700', shipped: 'bg-purple-100 text-purple-700', delivered: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700', refunded: 'bg-gray-100 text-gray-700' };
    return m[s] || 'bg-gray-100 text-gray-700';
  };

  const statusSteps = ['pending', 'paid', 'shipped', 'delivered'];
  const currentStep = selectedOrder ? statusSteps.indexOf(selectedOrder.status) : -1;

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
            <div key={order._id} className="bg-white rounded-lg border p-4 hover:border-teal-300 transition-colors cursor-pointer" onClick={() => setSelectedOrder(selectedOrder?._id === order._id ? null : order)}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-mono text-sm font-medium">{order.orderNumber || `#${order._id.slice(-8).toUpperCase()}`}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(order.createdAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColor(order.status)}`}>{order.status}</span>
                  <span className="text-sm font-semibold">${order.payment?.amount?.toFixed(2) || order.totalAmount?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
              {selectedOrder?._id === order._id && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                  {order.status !== 'cancelled' && order.status !== 'refunded' && (
                    <div className="flex items-center gap-0">
                      {statusSteps.map((step, i) => (
                        <div key={step} className="flex items-center flex-1">
                          <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${i <= currentStep ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{i <= currentStep ? '✓' : i + 1}</div>
                            <span className="text-xs mt-1 capitalize text-gray-600">{step}</span>
                          </div>
                          {i < statusSteps.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < currentStep ? 'bg-teal-600' : 'bg-gray-200'}`} />}
                        </div>
                      ))}
                    </div>
                  )}
                  {(order.status === 'cancelled' || order.status === 'refunded') && <div className={`px-3 py-2 rounded-lg text-sm font-medium ${order.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'}`}>This order has been {order.status}.</div>}
                  <div className="space-y-2">
                    {order.items?.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm">
                        <div>
                          <span className="text-gray-800">{item.productName || item.name || 'Item'}</span>
                          {item.variantName && <span className="text-gray-400 ml-1">({item.variantName})</span>}
                          {item.petName && <span className="text-teal-600 ml-1">— for {item.petName}</span>}
                          <span className="text-gray-400 ml-2">×{item.quantity}</span>
                        </div>
                        <span className="font-medium">${(item.totalPrice || item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  {order.shippingAddress && <div className="text-xs text-gray-500"><span className="font-medium">Shipping to:</span> {order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}, {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}</div>}
                  {order.trackingNumber && <div className="text-xs text-teal-600 font-medium">Tracking: {order.trackingNumber}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
