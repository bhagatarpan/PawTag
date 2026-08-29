import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Package, Truck, CheckCircle, Check, Clock, XCircle, MapPin, CreditCard, Loader2, ExternalLink, FileText, RefreshCw } from 'lucide-react';
import api from '../../lib/api';

const ORDER_STATUS_STEPS = ['pending', 'paid', 'packing', 'shipped', 'delivered'];

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', paid: 'Paid', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded',
};

function getOrderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] || status;
}

interface OrderItem {
  productName: string;
  variantName?: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  petName?: string;
  image?: string;
  customizationTotal?: number;
}

interface ActivityEntry {
  type: string;
  message: string;
  timestamp: string;
  actor: 'system' | 'admin' | 'customer';
  metadata?: Record<string, any>;
}

interface Order {
  _id: string;
  orderNumber?: string;
  status: string;
  items: OrderItem[];
  totalAmount: number;
  payment?: {
    amount: number;
    currency: string;
    status: string;
    method?: string;
    stripePaymentId?: string;
  };
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  trackingNumber?: string;
  carrier?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  activity?: ActivityEntry[];
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
}

function getTrackingUrl(carrier: string, trackingNumber: string): string {
  if (!trackingNumber || !carrier) return '';
  const c = carrier.toLowerCase();
  if (c.includes('nz post') || c.includes('nzpost')) return `https://www.nzpost.co.nz/tools/tracking/result?trackid=${encodeURIComponent(trackingNumber)}`;
  if (c.includes('courierpost') || c.includes('courier post')) return `https://www.courierpost.co.nz/tracking/${encodeURIComponent(trackingNumber)}`;
  if (c.includes('aramex')) return `https://www.aramex.co.nz/track/shipment?ShipmentNumber=${encodeURIComponent(trackingNumber)}`;
  if (c.includes('dhl')) return `https://www.dhl.com/nz-en/home/tracking.html?tracking-id=${encodeURIComponent(trackingNumber)}`;
  if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`;
  if (c.includes('ups')) return `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`;
  return '';
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'order_placed': return <Package size={16} />;
    case 'payment_confirmed': return <CreditCard size={16} />;
    case 'packing': return <Package size={16} />;
    case 'shipped': return <Truck size={16} />;
    case 'delivered': return <CheckCircle size={16} />;
    case 'cancelled': return <XCircle size={16} />;
    case 'refunded': return <XCircle size={16} />;
    default: return <Clock size={16} />;
  }
}

function getActivityDotColor(type: string): string {
  switch (type) {
    case 'order_placed': return 'bg-gray-400';
    case 'payment_confirmed': return 'bg-blue-500';
    case 'packing': return 'bg-amber-500';
    case 'shipped': return 'bg-purple-500';
    case 'delivered': return 'bg-green-500';
    case 'cancelled': return 'bg-red-500';
    case 'refunded': return 'bg-orange-500';
    default: return 'bg-gray-300';
  }
}

function getActivityIconColor(type: string): string {
  switch (type) {
    case 'order_placed': return 'text-gray-500';
    case 'payment_confirmed': return 'text-blue-600';
    case 'packing': return 'text-amber-600';
    case 'shipped': return 'text-purple-600';
    case 'delivered': return 'text-green-600';
    case 'cancelled': return 'text-red-600';
    case 'refunded': return 'text-orange-600';
    default: return 'text-gray-400';
  }
}

function formatActivityDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatActivityTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' });
}

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  pending: { color: 'text-yellow-600 bg-yellow-100', icon: Clock, label: getOrderStatusLabel('pending') },
  paid: { color: 'text-blue-600 bg-blue-100', icon: CreditCard, label: getOrderStatusLabel('paid') },
  shipped: { color: 'text-purple-600 bg-purple-100', icon: Truck, label: getOrderStatusLabel('shipped') },
  delivered: { color: 'text-green-600 bg-green-100', icon: CheckCircle, label: 'Delivered' },
  cancelled: { color: 'text-red-600 bg-red-100', icon: XCircle, label: 'Cancelled' },
  refunded: { color: 'text-gray-600 bg-gray-100', icon: XCircle, label: 'Refunded' },
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrder = async () => {
    if (!id) return;
    try {
      const res = await api.get(`/customer/orders/${id}`);
      setOrder(res.data.data);
      setError('');
    } catch (err: any) {
      if (!order) {
        setError(err.response?.data?.error || 'Order not found');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    fetchOrder();

    // Fetch invoice for this order
    api.get(`/customer/orders/${id}/invoice`)
      .then((res) => setInvoice(res.data.data))
      .catch(() => {}); // No invoice yet — non-critical
  }, [id]);

  // 30s polling — pauses when tab is hidden
  useEffect(() => {
    if (!id) return;
    const POLL_INTERVAL = 30_000;
    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchOrder();
        }
      }, POLL_INTERVAL);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchOrder();
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
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="text-center py-20">
        <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">{error || 'Order not found'}</h2>
        <Link to="/account/orders" className="text-teal-600 hover:text-teal-700 font-medium">
          ← Back to Orders
        </Link>
      </div>
    );
  }

  const currentStep = ORDER_STATUS_STEPS.indexOf(order.status);
  const isCancelled = order.status === 'cancelled' || order.status === 'refunded';
  const cfg = statusConfig[order.status] || statusConfig.pending;

  const handleViewInvoice = async () => {
    if (!invoice) return;
    try {
      const res = await api.post(`/customer/invoices/${invoice._id}/access`);
      const { secureUrl } = res.data.data;
      if (secureUrl) window.open(secureUrl, '_blank');
    } catch {
      // Fallback: open direct URL
      window.open(`/invoice/${invoice._id}`, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link to="/account/orders" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-teal-600 mb-3">
            <ArrowLeft className="h-4 w-4" /> Back to Orders
          </Link>
          <h1 className="text-2xl font-bold">Order {order.orderNumber || `#${order._id.slice(-8).toUpperCase()}`}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Placed on {new Date(order.createdAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <span className={`px-3 py-1.5 text-sm font-medium rounded-full ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>

      {/* Status Timeline — Two-Tier: Progress Stepper + Activity Feed */}
      {!isCancelled && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {/* Tier 1: Progress Stepper */}
          <h2 className="text-sm font-semibold text-gray-700 mb-5">Order Progress</h2>
          <div className="relative mb-8">
            {/* Progress track background */}
            <div className="absolute top-[15px] left-[15px] right-[15px] h-1 bg-gray-200 rounded-full" />
            {/* Progress fill */}
            <div
              className="absolute top-[15px] left-[15px] h-1 bg-primary-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `calc(${Math.min(currentStep, ORDER_STATUS_STEPS.length - 1)} / ${ORDER_STATUS_STEPS.length - 1} * (100% - 30px))` }}
            />
            {/* Steps */}
            <div className="relative flex justify-between">
              {ORDER_STATUS_STEPS.map((step, i) => {
                const isDone = i <= currentStep;
                const isCurrent = i === currentStep;
                const StepIcon = statusConfig[step]?.icon || Clock;
                return (
                  <div key={step} className="flex flex-col items-center" style={{ width: `${100 / ORDER_STATUS_STEPS.length}%` }}>
                    <div className={`w-[30px] h-[30px] rounded-full flex items-center justify-center z-10 transition-all ${
                      isDone ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-400'
                    } ${isCurrent ? 'ring-2 ring-offset-2 ring-primary-200' : ''}`}>
                      {isDone ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                    </div>
                    <span className={`text-xs mt-2 font-medium text-center capitalize ${isDone ? 'text-primary-700' : 'text-gray-400'}`}>
                      {step}
                    </span>
                    {/* Show timestamp for completed steps */}
                    {isDone && order.activity?.find(a => a.type === step) && (
                      <span className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(order.activity.find(a => a.type === step)!.timestamp).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tier 2: Detailed Activity Feed */}
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Activity Details</h2>
          {order.activity && order.activity.length > 0 ? (
            <div className="relative">
              <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200" />
              <div className="space-y-0">
                {[...order.activity]
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map((entry, i) => {
                    const isShipped = entry.type === 'shipped';
                    const trackingUrl = isShipped && order.trackingNumber && order.carrier
                      ? getTrackingUrl(order.carrier, order.trackingNumber)
                      : '';
                    return (
                      <div key={i} className="relative flex items-start gap-3 pb-5 last:pb-0">
                        <div className={`relative z-10 w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 ${getActivityDotColor(entry.type)} ${i === 0 ? 'ring-2 ring-offset-2 ring-primary-200' : ''}`}>
                          <span className="text-white">{getActivityIcon(entry.type)}</span>
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className={`text-sm ${i === 0 ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                            {entry.message}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-gray-400">
                              {formatActivityDate(entry.timestamp)} at {formatActivityTime(entry.timestamp)}
                            </p>
                            {entry.actor && (
                              <span className="text-xs text-gray-300 capitalize">· {entry.actor}</span>
                            )}
                          </div>
                          {/* Tracking link for shipped entries */}
                          {isShipped && order.trackingNumber && (
                            <div className="mt-2">
                              {trackingUrl ? (
                                <a
                                  href={trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 border border-primary-200 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100 transition-all"
                                >
                                  <Truck size={14} />
                                  Track: {order.trackingNumber}
                                  <ExternalLink size={12} />
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                                  <Truck size={14} />
                                  Tracking: {order.trackingNumber}
                                </span>
                              )}
                            </div>
                          )}
                          {/* Carrier badge for shipped entries */}
                          {isShipped && order.carrier && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                              {order.carrier}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-primary-50 rounded-lg">
              <CheckCircle className="h-5 w-5 text-primary-600" />
              <span className="text-sm text-primary-700 font-medium">{getOrderStatusLabel(order.status)}</span>
            </div>
          )}
        </div>
      )}

      {isCancelled && (
        <div className={`p-4 rounded-xl border ${
          order.status === 'cancelled' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-700'
        }`}>
          <p className="font-medium">This order has been {order.status}.</p>
        </div>
      )}

      {/* Shipping Tracking Card */}
      {order.trackingNumber && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Truck className="h-4 w-4" /> Shipping Tracking
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Carrier</span>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{order.carrier || 'Courier'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Tracking #</span>
                <span className="font-mono text-sm font-medium text-gray-900">{order.trackingNumber}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(order.trackingNumber!); }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Copy tracking number"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </button>
              </div>
            </div>
            {getTrackingUrl(order.carrier || '', order.trackingNumber) && (
              <a
                href={getTrackingUrl(order.carrier || '', order.trackingNumber)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-all"
              >
                <Truck size={16} />
                Track on {order.carrier || 'Carrier'}
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Order Items</h2>
            <div className="space-y-4">
              {order.items?.map((item, i) => (
                <div key={i} className="flex items-start gap-4 py-3 border-b border-gray-100 last:border-0">
                  {item.image ? (
                    <img src={item.image} alt={item.productName} className="w-16 h-16 rounded-lg object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-teal-50 flex items-center justify-center">
                      <Package className="h-6 w-6 text-teal-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900">{item.productName}</h3>
                    {item.variantName && <p className="text-sm text-gray-500">{item.variantName}</p>}
                    {item.petName && <p className="text-sm text-teal-600">For: {item.petName}</p>}
                    <p className="text-xs text-gray-400 mt-1">SKU: {item.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">${item.totalPrice.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">Qty: {item.quantity} × ${item.unitPrice.toFixed(2)}</p>
                    {item.customizationTotal ? (
                      <p className="text-xs text-teal-600">+${item.customizationTotal.toFixed(2)} engraving</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-4">
          {/* Payment Summary */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Payment Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span>${(order.payment?.amount || order.totalAmount).toFixed(2)}</span>
              </div>
              {(() => {
                // Calculate shipping from order items (shipping line items have no productId or "shipping" in name)
                const shippingItem = order.items?.find((i: any) => !i.productId || i.productName?.toLowerCase().includes('shipping'));
                const shippingCost = shippingItem?.totalPrice || 0;
                return (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Shipping</span>
                    <span className={shippingCost === 0 ? 'text-green-600' : 'text-gray-900'}>
                      {shippingCost === 0 ? 'Free' : `NZ$${shippingCost.toFixed(2)}`}
                    </span>
                  </div>
                );
              })()}
              <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold text-base">
                <span>Total</span>
                <span className="text-teal-700">${(order.payment?.amount || order.totalAmount).toFixed(2)} NZD</span>
              </div>
            </div>
            {order.payment && (
              <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                <p>Method: {order.payment.method || 'Card'}</p>
                <p>Status: <span className={order.payment.status === 'succeeded' ? 'text-green-600' : 'text-yellow-600'}>{order.payment.status}</span></p>
                {order.payment.stripePaymentId && <p>Ref: {order.payment.stripePaymentId}</p>}
              </div>
            )}
          </div>

          {/* Invoice */}
          {invoice && (
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Invoice
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Invoice #</span>
                  <span className="font-mono font-medium text-gray-900">{invoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-medium text-gray-900">${invoice.amount.toFixed(2)} NZD</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Status</span>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                    invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                    invoice.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    invoice.status === 'refunded' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </span>
                </div>
              </div>
              <button
                onClick={handleViewInvoice}
                className="w-full mt-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-all flex items-center justify-center gap-2"
              >
                <FileText size={14} />
                View Full Invoice
                <ExternalLink size={12} />
              </button>
            </div>
          )}

          {/* Shipping Address */}
          {order.shippingAddress && (
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Shipping Address
              </h2>
              <div className="text-sm text-gray-600 space-y-0.5">
                <p>{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}</p>
                <p>{order.shippingAddress.country}</p>
              </div>
            </div>
          )}

          {/* Order Actions */}
          {!isCancelled && (order.status === 'delivered') && (
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Need Help?</h2>
              <Link
                to={`/account/orders/${order._id}/return`}
                className="block w-full py-2.5 text-center border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all"
              >
                Request Return
              </Link>
            </div>
          )}
          {!isCancelled && (order.status === 'paid' || order.status === 'packing') && (
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Order Actions</h2>
              <div className="space-y-2">
                <Link
                  to={`/account/orders/${order._id}/return`}
                  className="block w-full py-2.5 text-center border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all"
                >
                  Request Return
                </Link>
                <button
                  onClick={async () => {
                    if (!confirm('Are you sure you want to cancel this order? A full refund will be processed.')) return;
                    try {
                      const res = await api.post(`/customer/returns/orders/${order._id}/cancel`, { reason: 'Cancelled by customer' });
                      if (res.data.success) {
                        alert('Order cancelled and refund initiated. You should see the refund in 5-10 business days.');
                        fetchOrder();
                      }
                    } catch (err: any) {
                      alert(err.response?.data?.error || 'Failed to cancel order');
                    }
                  }}
                  className="block w-full py-2.5 text-center border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-all"
                >
                  Cancel Order
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
