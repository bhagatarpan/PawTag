import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Package, Truck, CheckCircle, Clock, XCircle, MapPin, CreditCard, Loader2 } from 'lucide-react';
import api from '../../lib/api';

const ORDER_STATUS_STEPS = ['pending', 'paid', 'shipped', 'delivered'];

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
  notes?: string;
  createdAt: string;
  updatedAt: string;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.get(`/customer/orders/${id}`)
      .then((res) => setOrder(res.data.data))
      .catch((err) => setError(err.response?.data?.error || 'Order not found'))
      .finally(() => setLoading(false));
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

      {/* Status Timeline */}
      {!isCancelled && (
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Order Status</h2>
          <div className="flex items-center">
            {ORDER_STATUS_STEPS.map((step, i) => {
              const StepIcon = statusConfig[step]?.icon || Clock;
              return (
                <div key={step} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      i <= currentStep ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {i <= currentStep ? <CheckCircle className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                    </div>
                    <span className={`text-xs mt-2 font-medium capitalize ${i <= currentStep ? 'text-teal-700' : 'text-gray-500'}`}>
                      {step}
                    </span>
                  </div>
                  {i < ORDER_STATUS_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-3 ${i < currentStep ? 'bg-teal-600' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
          {order.trackingNumber && (
            <div className="mt-4 p-3 bg-teal-50 border border-teal-200 rounded-lg flex items-center gap-2">
              <Truck className="h-4 w-4 text-teal-600" />
              <span className="text-sm text-teal-700">Tracking: <strong>{order.trackingNumber}</strong></span>
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
              <div className="flex justify-between">
                <span className="text-gray-500">Shipping</span>
                <span className="text-green-600">Free</span>
              </div>
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
        </div>
      </div>
    </div>
  );
}
