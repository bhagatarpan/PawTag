/**
 * @module Return Request Page
 * @description Customer page for requesting order returns.
 *
 * Allows customers to:
 * - Select items to return
 * - Provide a return reason
 * - Submit a return request
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Package, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../../lib/api';

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface Order {
  _id: string;
  orderNumber: string;
  status: string;
  items: OrderItem[];
}

const RETURN_REASONS = [
  'Product damaged or defective',
  'Wrong product received',
  'Changed my mind',
  'Product not as described',
  'Better price found elsewhere',
  'Other',
];

export default function ReturnRequest() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  useEffect(() => {
    if (!id) return;
    api.get(`/customer/orders/${id}`)
      .then((res) => setOrder(res.data.data))
      .catch(() => setError('Order not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const toggleItem = (productId: string) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[productId]) {
        delete next[productId];
      } else {
        const item = order?.items.find((i) => i.productId === productId);
        next[productId] = item?.quantity || 1;
      }
      return next;
    });
  };

  const updateQuantity = (productId: string, qty: number) => {
    const item = order?.items.find((i) => i.productId === productId);
    if (!item) return;
    const clamped = Math.max(1, Math.min(qty, item.quantity));
    setSelectedItems((prev) => ({ ...prev, [productId]: clamped }));
  };

  const handleSubmit = async () => {
    if (!id || !reason || Object.keys(selectedItems).length === 0) return;

    setSubmitting(true);
    setError('');

    try {
      const returnReason = reason === 'Other' ? customReason : reason;
      const items = Object.entries(selectedItems).map(([orderItemId, quantity]) => ({
        orderItemId,
        quantity,
      }));

      await api.post('/customer/returns', {
        orderId: id,
        reason: returnReason,
        items,
      });

      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit return request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-teal-500" size={24} />
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center">
        <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Return Request Submitted</h1>
        <p className="text-gray-600 mb-6">
          We've received your return request. Our team will review it within 1-2 business days.
          You'll receive an email with return shipping instructions once approved.
        </p>
        <div className="flex gap-3 justify-center">
          <Link to="/account/orders" className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            View Orders
          </Link>
          <Link to="/account" className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center">
        <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h1>
        <Link to="/account/orders" className="text-teal-600 hover:text-teal-700">
          Back to Orders
        </Link>
      </div>
    );
  }

  const totalRefund = Object.entries(selectedItems).reduce((sum, [pid, qty]) => {
    const item = order.items.find((i) => i.productId === pid);
    return sum + (item?.unitPrice || 0) * qty;
  }, 0);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Link to={`/account/orders/${id}`} className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 mb-4">
        <ArrowLeft size={16} />
        Back to Order {order.orderNumber}
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Request Return</h1>
      <p className="text-sm text-gray-500 mb-6">Select the items you'd like to return from order {order.orderNumber}</p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Items */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h3 className="font-medium text-gray-900 mb-3">Order Items</h3>
        <div className="space-y-3">
          {order.items.map((item) => (
            <label
              key={item.productId}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedItems[item.productId]
                  ? 'border-teal-300 bg-teal-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={!!selectedItems[item.productId]}
                onChange={() => toggleItem(item.productId)}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{item.productName}</div>
                <div className="text-xs text-gray-500">${item.unitPrice.toFixed(2)} × {item.quantity}</div>
              </div>
              {selectedItems[item.productId] && item.quantity > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); updateQuantity(item.productId, selectedItems[item.productId] - 1); }}
                    className="w-6 h-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 text-sm"
                  >
                    -
                  </button>
                  <span className="text-sm w-6 text-center">{selectedItems[item.productId]}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); updateQuantity(item.productId, selectedItems[item.productId] + 1); }}
                    className="w-6 h-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 text-sm"
                  >
                    +
                  </button>
                </div>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Reason */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h3 className="font-medium text-gray-900 mb-3">Return Reason</h3>
        <div className="space-y-2">
          {RETURN_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-700">{r}</span>
            </label>
          ))}
        </div>
        {reason === 'Other' && (
          <textarea
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Please describe your reason..."
            className="mt-3 w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-teal-500"
            rows={3}
          />
        )}
      </div>

      {/* Summary & Submit */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-600">Estimated refund</span>
          <span className="text-lg font-bold text-gray-900">${totalRefund.toFixed(2)} NZD</span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting || !reason || Object.keys(selectedItems).length === 0}
          className="w-full py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              Submitting...
            </>
          ) : (
            'Submit Return Request'
          )}
        </button>
      </div>
    </div>
  );
}
