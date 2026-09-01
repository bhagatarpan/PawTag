import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ChevronRight, Clock, Package, Truck, CheckCircle, Ban, RefreshCw, ExternalLink, FileText, CreditCard, MapPin, Eye } from 'lucide-react';
import { StatusBadge, EmptyState, OrderProgressStepper, OrderStatusBanner } from '@pawtag/ui';
import { ORDER_STATUS_LABELS, getStatusBadgeVariant, getStatusBorderColor, getTrackingUrl, isTerminalStatus } from '@pawtag/shared';
import api from '../../lib/api';
import type { Order } from '../../types';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getStatusIcon(status: string) {
  switch (status) {
    case 'delivered': return <CheckCircle size={13} />;
    case 'shipped': return <Truck size={13} />;
    case 'paid': return <Package size={13} />;
    case 'packing': return <Package size={13} />;
    case 'pending': return <Clock size={13} />;
    case 'pending_payment': return <Clock size={13} />;
    case 'cancelled': return <Ban size={13} />;
    case 'refund_initiated': return <RefreshCw size={13} />;
    case 'refunded': return <CheckCircle size={13} />;
    default: return <Clock size={13} />;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' });
}

function getRelativeTime(iso: string): string {
  const now = new Date();
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(iso);
}

const MILESTONE_ACTIVITY_TYPES = ['order_placed', 'payment_confirmed', 'packing', 'shipped', 'delivered', 'cancelled', 'refunded', 'refund_initiated'];

function getLatestMilestone(order: Order): { type: string; message: string; timestamp: string } | null {
  if (!order.activity || order.activity.length === 0) return null;
  const milestones = order.activity
    .filter((a) => MILESTONE_ACTIVITY_TYPES.includes(a.type))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return milestones[0] || null;
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'order_placed': return <Package size={12} />;
    case 'payment_confirmed': return <CheckCircle size={12} />;
    case 'shipped': return <Truck size={12} />;
    case 'delivered': return <CheckCircle size={12} />;
    case 'cancelled': return <Ban size={12} />;
    case 'refunded': return <RefreshCw size={12} />;
    default: return <Clock size={12} />;
  }
}

function getActivityColor(type: string): string {
  switch (type) {
    case 'order_placed': return 'text-gray-500';
    case 'payment_confirmed': return 'text-blue-500';
    case 'shipped': return 'text-purple-500';
    case 'delivered': return 'text-green-500';
    case 'cancelled': return 'text-red-500';
    case 'refunded': return 'text-orange-500';
    default: return 'text-gray-400';
  }
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function SkeletonRow() {
  return (
    <div className="bg-white rounded-lg border border-l-4 border-l-gray-200 p-4 animate-shimmer">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200" />
          <div>
            <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-32" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-5 bg-gray-200 rounded-full w-16" />
          <div className="h-4 bg-gray-200 rounded w-16" />
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4">
        <div className="h-3 bg-gray-200 rounded w-28" />
        <div className="h-3 bg-gray-200 rounded w-20" />
        <div className="h-3 bg-gray-200 rounded w-16" />
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <div className="h-3 bg-gray-200 rounded w-48" />
        <div className="h-3 bg-gray-200 rounded w-24" />
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

  const fetchOrders = async () => {
    try {
      const r = await api.get('/customer/orders');
      setOrders(r.data.data);
      setError(null);
    } catch (err: any) {
      if (!orders.length) {
        setError(err.response?.data?.error || 'Failed to load orders');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // 30s polling — pauses when tab is hidden
  useEffect(() => {
    const POLL_INTERVAL = 30_000;
    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchOrders();
        }
      }, POLL_INTERVAL);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchOrders();
        startPolling();
      } else if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    startPolling();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (interval) clearInterval(interval);
    };
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
          {orders.map((order) => {
            const latestActivity = getLatestMilestone(order);
            return (
              <Link
                key={order._id}
                to={`/account/orders/${order._id}`}
                className={`block bg-white rounded-lg border border-gray-200 border-l-4 ${getStatusBorderColor(order.status)} p-4 hover:border-teal-300 hover:shadow-md transition-all`}
              >
                {/* Row 1: Order number, status, price */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                      <ShoppingBag size={18} className="text-teal-600" />
                    </div>
                    <div>
                      <p className="font-mono text-sm font-semibold text-gray-900">
                        {order.orderNumber || `#${order._id.slice(-8).toUpperCase()}`}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDate(order.createdAt)} at {formatTime(order.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge
                      label={ORDER_STATUS_LABELS[order.status] || order.status}
                      variant={getStatusBadgeVariant(order.status)}
                      icon={getStatusIcon(order.status)}
                    />
                    <span className="text-sm font-bold text-gray-900">
                      ${(order.payment?.amount ?? 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Progress stepper or status banner */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  {isTerminalStatus(order.status) ? (
                    <OrderStatusBanner status={order.status} amount={order.payment?.amount} />
                  ) : (
                    <OrderProgressStepper status={order.status} variant="compact" />
                  )}
                </div>

                {/* Row 2: Info row - Payment, Shipping, Items */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
                  {order.payment?.cardBrand && (
                    <span className="flex items-center gap-1.5">
                      <CreditCard size={12} className="text-gray-400" />
                      {order.payment.cardBrand.charAt(0).toUpperCase() + order.payment.cardBrand.slice(1)} •••• {order.payment.cardLast4 || '****'}
                    </span>
                  )}
                  {!order.payment?.cardBrand && order.payment?.method && (
                    <span className="flex items-center gap-1.5">
                      <CreditCard size={12} className="text-gray-400" />
                      {order.payment.method}
                    </span>
                  )}
                  {order.shippingAddress?.city && (
                    <span className="flex items-center gap-1.5">
                      <MapPin size={12} className="text-gray-400" />
                      {order.shippingAddress.city}
                      {order.shippingAddress.country ? `, ${order.shippingAddress.country}` : ''}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Package size={12} className="text-gray-400" />
                    {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
                  </span>
                  {order.latestInvoice && (
                    <span className="flex items-center gap-1.5">
                      <FileText size={12} className="text-gray-400" />
                      {order.latestInvoice.invoiceNumber}
                    </span>
                  )}
                </div>

                {/* Row 3: Activity + View Details button */}
                {latestActivity && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={getActivityColor(latestActivity.type)}>
                        {getActivityIcon(latestActivity.type)}
                      </span>
                      <span className="text-xs text-gray-600 truncate">{latestActivity.message}</span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">· {getRelativeTime(latestActivity.timestamp)}</span>
                      {latestActivity.type === 'shipped' && order.trackingNumber && (
                        <span className="text-xs text-teal-600 font-medium whitespace-nowrap flex items-center gap-0.5">
                          Track <ExternalLink size={10} />
                        </span>
                      )}
                    </div>
                    <span className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 whitespace-nowrap ml-3">
                      <Eye size={13} />
                      View Details
                      <ChevronRight size={14} />
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
