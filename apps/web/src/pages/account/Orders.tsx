import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ChevronRight, Clock, Package, Truck, CheckCircle, Ban, RefreshCw } from 'lucide-react';
import { StatusBadge, EmptyState } from '@pawtag/ui';
import api from '../../lib/api';
import type { Order } from '../../types';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getStatusVariant(status: string): 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'primary' {
  switch (status) {
    case 'delivered': return 'success';
    case 'shipped': return 'primary';
    case 'paid': return 'info';
    case 'packing': return 'info';
    case 'pending': return 'warning';
    case 'pending_payment': return 'warning';
    case 'cancelled': return 'danger';
    case 'refunded': return 'danger';
    default: return 'neutral';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'delivered': return <CheckCircle size={13} />;
    case 'shipped': return <Truck size={13} />;
    case 'paid': return <Package size={13} />;
    case 'packing': return <Package size={13} />;
    case 'pending': return <Clock size={13} />;
    case 'pending_payment': return <Clock size={13} />;
    case 'cancelled': return <Ban size={13} />;
    case 'refunded': return <RefreshCw size={13} />;
    default: return <Clock size={13} />;
  }
}

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function SkeletonRow() {
  return (
    <div className="bg-white rounded-lg border p-4 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-16 mb-1" />
          <div className="h-3 bg-gray-200 rounded w-12" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-5 bg-gray-200 rounded-full w-16" />
          <div className="h-4 bg-gray-200 rounded w-16" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/customer/orders')
      .then((r) => setOrders(r.data.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load orders'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
        <p className="text-sm text-gray-500 mt-1">View and track your orders.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          {error}
          <button onClick={() => { setError(null); setLoading(true); api.get('/customer/orders').then((r) => setOrders(r.data.data)).catch((err) => setError(err.response?.data?.error || 'Failed to load orders')).finally(() => setLoading(false)); }} className="underline hover:no-underline ml-2">Try Again</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={20} className="text-gray-400" />}
          message="No orders yet"
          description="Your orders will appear here after purchasing tags or products."
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order._id}
              to={`/account/orders/${order._id}`}
              className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-teal-300 hover:shadow-sm transition-all"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                    <ShoppingBag size={18} className="text-teal-600" />
                  </div>
                  <div>
                    <p className="font-mono text-sm font-medium text-gray-900">
                      {order.orderNumber || `#${order._id.slice(-8).toUpperCase()}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.createdAt)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge
                    label={STATUS_LABELS[order.status] || order.status}
                    variant={getStatusVariant(order.status)}
                    icon={getStatusIcon(order.status)}
                  />
                  <span className="text-sm font-semibold text-gray-900">
                    ${order.payment?.amount?.toFixed(2) || '0.00'}
                  </span>
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
