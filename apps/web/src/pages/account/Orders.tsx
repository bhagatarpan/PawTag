import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ChevronRight, Clock, Package, Truck, CheckCircle, Ban, RefreshCw } from 'lucide-react';
import { StatusBadge, EmptyState, OrderProgressStepper, OrderStatusBanner, formatRefundDestinationShort } from '@pawtag/ui';
import {
  ORDER_STATUS_LABELS,
  getStatusBadgeVariant,
  getStatusBorderColor,
  isTerminalStatus,
  getOrderRefundDisplay,
  getRefundDisplayLabel,
  getRefundDisplayBadgeVariant,
} from '@pawtag/shared';
import { API } from '@pawtag/shared/api';
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
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="h-5 bg-gray-200 rounded-full w-16" />
          <div className="h-4 bg-gray-200 rounded w-16" />
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-1">
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
      const r = await api.get(API.customer.orders.list);
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
        <p className="text-sm text-gray-500 mt-1">Track your orders and see past purchases.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          {error}
          <button onClick={() => { setError(null); setLoading(true); api.get(API.customer.orders.list).then((r) => setOrders(r.data.data)).catch((err) => setError(err.response?.data?.error || 'Failed to load orders')).finally(() => setLoading(false)); }} className="underline hover:no-underline ml-2">Try Again</button>
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
            const firstItem = order.items?.[0];
            const itemCount = order.items?.length || 0;
            return (
              <Link
                key={order._id}
                to={`/account/orders/${order._id}`}
                className={`block bg-white rounded-2xl border border-gray-200 border-l-4 ${getStatusBorderColor(order.status)} p-4 hover:border-primary-300 hover:shadow-md transition-all`}
              >
                {/* Row 1: identity + state (board 24) — number/date left,
                    status + refund pills right; amount moved to the footer */}
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-gray-900 truncate">
                      {order.orderNumber || `#${order._id.slice(-8).toUpperCase()}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(order.createdAt)} at {formatTime(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                    <StatusBadge
                      label={ORDER_STATUS_LABELS[order.status] || order.status}
                      variant={getStatusBadgeVariant(order.status)}
                      icon={getStatusIcon(order.status)}
                    />
                    {(() => {
                      const refundDisplay = getOrderRefundDisplay(order as any);
                      if (refundDisplay === 'none') return null;
                      return (
                        <StatusBadge
                          label={getRefundDisplayLabel(refundDisplay, (order as any).refundStatus)}
                          variant={getRefundDisplayBadgeVariant(refundDisplay)}
                        />
                      );
                    })()}
                  </div>
                </div>

                {/* Row 2: short item summary — secondary payment/address/
                    invoice metadata moved to order details (plan §5.2) */}
                {firstItem && (
                  <div className="mt-3 flex items-center gap-3 min-w-0">
                    {firstItem.image ? (
                      <img src={firstItem.image} alt="" className="w-14 h-14 rounded-xl object-cover bg-gray-100 shrink-0" />
                    ) : (
                      <span aria-hidden="true" className="w-14 h-14 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                        <ShoppingBag size={20} />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{firstItem.productName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[
                          firstItem.variantName,
                          `Qty ${firstItem.quantity}`,
                          itemCount > 1 ? `+${itemCount - 1} more` : '',
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Progress stepper or status banner */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  {isTerminalStatus(order.status) || order.refundStatus ? (
                    <OrderStatusBanner
                      status={order.status}
                      amount={order.payment?.amount}
                      refundStatus={order.refundStatus}
                      refundAmount={order.refundAmount}
                      destinationLabel={formatRefundDestinationShort(order.payment?.cardBrand, order.payment?.cardLast4) || undefined}
                    />
                  ) : (
                    <OrderProgressStepper
                      status={order.status}
                      variant="compact"
                      refundStatus={order.refundStatus}
                      refundAmount={order.refundAmount}
                    />
                  )}
                  {(order.status === 'cancelled' || order.status === 'refunded' || order.refundStatus) && order.refundStatus && (
                    <p className="mt-1.5 text-xs text-gray-600">
                      {order.refundStatus === 'failed'
                        ? 'Refund failed — support will arrange an alternative method'
                        : formatRefundDestinationShort(order.payment?.cardBrand, order.payment?.cardLast4)
                          || 'Refund to original payment method'}
                    </p>
                  )}
                  {getOrderRefundDisplay(order) === 'partial' && (
                    <p className="mt-1.5 text-xs text-amber-700 font-medium">
                      Partially refunded{order.refundAmount != null ? ` · $${Number(order.refundAmount).toFixed(2)}` : ''}
                    </p>
                  )}
                </div>

                {/* Row 4: total + explicit detail affordance (board 24) */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-lg font-bold text-gray-900">${(order.payment?.amount ?? 0).toFixed(2)}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 border border-primary-200 text-primary-700 rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap">
                    View order
                    <ChevronRight size={14} aria-hidden="true" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
