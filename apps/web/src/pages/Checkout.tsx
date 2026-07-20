import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, CreditCard, PawPrint, CheckCircle } from 'lucide-react';
import api from '../lib/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [form, setForm] = useState({
    line1: '',
    line2: '',
    city: '',
    state: '',
    zip: '',
    country: 'NZ',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { navigate('/login'); return; }
    if (items.length === 0) return;

    setLoading(true);
    try {
      const res = await api.post('/customer/orders', {
        shippingAddress: form,
        paymentMethod: 'card',
      });
      setOrderNumber(res.data.data.orderNumber);
      setSuccess(true);
      clearCart();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h1>
          <p className="text-gray-500 mb-4">Thank you for your order.</p>
          <p className="text-lg font-mono font-semibold text-teal-700 mb-6">{orderNumber}</p>
          <p className="text-sm text-gray-400 mb-6">We'll send you an email confirmation shortly.</p>
          <div className="flex gap-3">
            <Link to="/" className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-all text-center">
              Back to Home
            </Link>
            <Link to="/shop" className="flex-1 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-all text-center">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-4">
        <PawPrint className="h-16 w-16 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-700">Your cart is empty</h2>
        <Link to="/shop" className="text-teal-600 hover:text-teal-700 font-medium">← Back to Shop</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/shop" className="inline-flex items-center gap-2 text-gray-500 hover:text-teal-600 mb-8">
          <ArrowLeft className="h-4 w-4" /> Back to Shop
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Shipping Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-8 space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Lock className="h-5 w-5 text-teal-600" /> Shipping Address
              </h2>

              {!user && (
                <p className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
                  Please <Link to="/login" className="underline font-medium">sign in</Link> to complete your order.
                </p>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
                  <input type="text" required value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="123 Main Street" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                  <input type="text" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="Apartment, suite, etc." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                    <input type="text" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Region *</label>
                    <input type="text" required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="e.g. Auckland" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
                    <input type="text" required value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="e.g. 6011" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <input type="text" value={form.country} disabled className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-500" />
                  </div>
                </div>
              </div>

              <button type="submit" disabled={loading || !user || items.length === 0} className="w-full py-4 bg-teal-600 text-white rounded-xl font-semibold text-lg hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                <CreditCard className="h-5 w-5" />
                {loading ? 'Placing Order...' : `Place Order — $${total.toFixed(2)}`}
              </button>

              <p className="text-xs text-gray-400 text-center">
                Demo checkout — no real payment is processed.
              </p>
            </form>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
              <div className="space-y-4 mb-6">
                {items.map((item) => (
                  <div key={item.productId} className="flex gap-3">
                    <div className="h-16 w-16 bg-teal-50 rounded-lg flex-shrink-0 flex items-center justify-center">
                      {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover rounded-lg" /> : <PawPrint className="h-6 w-6 text-teal-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      {item.petName && <p className="text-xs text-teal-600">For: {item.petName}</p>}
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 pt-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Shipping</span>
                  <span className="text-green-600 font-medium">Free</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-100">
                  <span>Total</span>
                  <span className="text-teal-700">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
