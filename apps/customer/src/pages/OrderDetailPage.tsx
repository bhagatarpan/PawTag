import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Package, Truck, CreditCard, MapPin, Tag, StickyNote, FileText } from 'lucide-react';
import api from '../lib/api';

interface OrderItem {
  productId?: string;
  productName: string;
  variantName?: string;
  petName?: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  customizationTotal?: number;
}

interface Order {
  _id: string;
  orderNumber: string;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  items: OrderItem[];
  payment?: {
    method: string;
    status: string;
    transactionId?: string;
    amount: number;
    currency: string;
    paidAt?: string;
  };
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
  };
  trackingNumber?: string;
  notes?: string;
  discount?: { percent: number; amount: number; reason: string };
  referredByCode?: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_STEPS = ['pending', 'paid', 'shipped', 'delivered'];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  paid: 'bg-blue-100 text-blue-700 border-blue-200',
  shipped: 'bg-purple-100 text-purple-700 border-purple-200',
  delivered: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
  refunded: 'bg-gray-100 text-gray-700 border-gray-200',
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invoice, setInvoice] = useState<{ _id: string; invoiceNumber: string; amount: number; status: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get(`/customer/orders/${id}`)
      .then((r) => setOrder(r.data.data))
      .catch((e) => setError(e.response?.data?.error || 'Order not found'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id || !order || order.status === 'pending') return;
    api.get(`/customer/orders/${id}/invoice`)
      .then((r) => setInvoice(r.data.data))
      .catch(() => {}); // No invoice yet — that's fine
  }, [id, order]);

  const handleViewInvoice = async () => {
    if (!invoice) return;
    try {
      const res = await api.post(`/customer/invoices/${invoice._id}/access`);
      const { secureUrl } = res.data.data;
      window.open(secureUrl, '_blank');
    } catch {
      alert('Failed to generate invoice link. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-white rounded-lg border p-6 h-48" />
        <div className="animate-pulse bg-white rounded-lg border p-6 h-32" />
        <div className="animate-pulse bg-white rounded-lg border p-6 h-24" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center">
        <Package size={48} className="text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">{error || 'Order not found'}</p>
        <Link to="/orders" className="text-sm text-primary-600 hover:underline mt-2 inline-block">Back to orders</Link>
      </div>
    );
  }

  const currentStep = STATUS_STEPS.indexOf(order.status);
  const isCancelled = order.status === 'cancelled' || order.status === 'refunded';
  const itemsSubtotal = order.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/orders')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors">
        <ArrowLeft size={16} /> Back to orders
      </button>

      <div className="bg-white rounded-lg border p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{order.orderNumber}</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Placed {new Date(order.createdAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full border ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-700'}`}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </span>
        </div>

        {invoice && order.status !== 'pending' && (
          <div className="mt-4">
            <button
              onClick={handleViewInvoice}
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              <FileText size={16} />
              View Invoice — {invoice.invoiceNumber}
            </button>
          </div>
        )}

        {!isCancelled && (
          <div className="mt-6">
            <div className="flex items-center">
              {STATUS_STEPS.map((step, i) => (
                <div key={step} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${i <= currentStep ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                      {i < currentStep ? '✓' : i === currentStep ? (i === currentStep ? '●' : i + 1) : i + 1}
                    </div>
                    <span className="text-xs mt-1.5 capitalize text-gray-600 font-medium">{step}</span>
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-3 ${i < currentStep ? 'bg-primary-600' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {isCancelled && (
          <div className={`mt-4 px-4 py-3 rounded-lg text-sm font-medium ${order.status === 'cancelled' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-gray-50 text-gray-700 border border-gray-200'}`}>
            This order has been {order.status}.
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Package size={16} /> Items
        </h2>
        <div className="divide-y divide-gray-100">
          {order.items.map((item, i) => (
            <div key={i} className="py-3 first:pt-0 last:pb-0">
              <div className="flex justify-between">
                <div>
                  <p className="font-medium text-gray-800">{item.productName}</p>
                  {item.variantName && <p className="text-sm text-gray-500">Variant: {item.variantName}</p>}
                  {item.petName && <p className="text-sm text-primary-600">For: {item.petName}</p>}
                  <p className="text-sm text-gray-400 mt-0.5">Qty: {item.quantity} × ${item.unitPrice.toFixed(2)}</p>
                </div>
                <p className="font-semibold text-gray-800">${(item.totalPrice || item.unitPrice * item.quantity).toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>${itemsSubtotal.toFixed(2)}</span>
          </div>
          {order.discount && (
            <div className="flex justify-between text-green-600">
              <span className="flex items-center gap-1"><Tag size={14} /> {order.discount.reason} ({order.discount.percent}% off)</span>
              <span>-${order.discount.amount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-100">
            <span>Total</span>
            <span>${order.payment?.amount?.toFixed(2) || itemsSubtotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {order.shippingAddress && (
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              <MapPin size={16} /> Shipping Address
            </h2>
            <p className="text-sm text-gray-700">{order.shippingAddress.line1}</p>
            {order.shippingAddress.line2 && <p className="text-sm text-gray-700">{order.shippingAddress.line2}</p>}
            <p className="text-sm text-gray-700">{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}</p>
            {order.shippingAddress.country && <p className="text-sm text-gray-500 mt-0.5">{order.shippingAddress.country}</p>}
          </div>
        )}

        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <CreditCard size={16} /> Payment
          </h2>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Method</span>
              <span className="text-gray-700 capitalize">{order.payment?.method?.replace('_', ' ') || 'Card'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className={`font-medium ${order.payment?.status === 'succeeded' ? 'text-green-600' : 'text-gray-700'}`}>
                {order.payment?.status || order.status}
              </span>
            </div>
            {order.payment?.transactionId && (
              <div className="flex justify-between">
                <span className="text-gray-500">Transaction ID</span>
                <span className="text-gray-700 font-mono text-xs">{order.payment.transactionId}</span>
              </div>
            )}
            {order.payment?.paidAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">Paid</span>
                <span className="text-gray-700">{new Date(order.payment.paidAt).toLocaleDateString('en-NZ')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {order.trackingNumber && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Truck size={16} /> Tracking
          </h2>
          <p className="text-sm font-mono text-primary-600 font-medium">{order.trackingNumber}</p>
        </div>
      )}

      {order.notes && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <StickyNote size={16} /> Notes
          </h2>
          <p className="text-sm text-gray-700">{order.notes}</p>
        </div>
      )}

      {order.referredByCode && (
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500">Referred with code: <span className="font-mono text-primary-600">{order.referredByCode}</span></p>
        </div>
      )}
    </div>
  );
}
