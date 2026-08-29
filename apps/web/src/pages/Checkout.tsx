import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Lock, CreditCard, PawPrint, CheckCircle, Truck, Tag, Loader2,
  Mail, Smartphone, Shield, ChevronRight, Edit3, Check, Package, Clock,
  ShieldCheck, Headphones, RefreshCw, FileText, Download, Printer, Share2, Home, ShoppingBag, ExternalLink
} from 'lucide-react';
import { AddressAutocomplete } from '@pawtag/ui';
import type { AddressComponents } from '@pawtag/ui';
import api from '../lib/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../hooks/useCms';
import CheckoutAuth from '../components/CheckoutAuth';
import StripePaymentForm from '../components/StripePaymentForm';
import CheckoutErrorBoundary from '../components/CheckoutErrorBoundary';

type Step = 'cart' | 'checkout' | 'payment' | 'confirmed';

const STEPS = [
  { key: 'cart' as Step, label: 'Cart', icon: Package },
  { key: 'checkout' as Step, label: 'Checkout', icon: Truck },
  { key: 'payment' as Step, label: 'Payment', icon: CreditCard },
  { key: 'confirmed' as Step, label: 'Confirmed', icon: CheckCircle },
];

export default function Checkout() {
  const { items, total, totals, clearCart, refreshCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Step management — always start at cart step on mount.
  // sessionStorage restoration caused a race condition: step restored before
  // cart loaded from server, rendering step 2/3 with empty items = blank screen.
  const [currentStep, setCurrentStep] = useState<Step>('cart');

  // Form state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState(() => sessionStorage.getItem('pawtag_checkout_order') || '');
  const [success, setSuccess] = useState(() => sessionStorage.getItem('pawtag_checkout_success') === 'true');
  const [paymentClientSecret, setPaymentClientSecret] = useState('');

  // Confirmed order data (preserved before clearCart for the confirmation page)
  const [confirmedItems, setConfirmedItems] = useState<any[]>([]);
  const [confirmedTotal, setConfirmedTotal] = useState(0);
  const [confirmedInvoice, setConfirmedInvoice] = useState<any>(null);
  const [confirmedPawTagOrder, setConfirmedPawTagOrder] = useState<any>(null);

  // Promo code
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);

  // Verification status
  const [emailVerified, setEmailVerified] = useState(false);
  const [mobileVerified, setMobileVerified] = useState(false);

  // Shipping address
  const [addressMode, setAddressMode] = useState<'saved' | 'custom'>('saved');
  const [form, setForm] = useState({
    line1: '', line2: '', city: '', state: '', zip: '', country: 'nz',
  });
  // Prepopulate from user profile on mount / login
  useEffect(() => {
    if (user?.address?.line1 && addressMode === 'saved') {
      setForm({
        line1: user.address.line1 || '',
        line2: user.address.line2 || '',
        city: user.address.city || '',
        state: user.address.state || '',
        zip: user.address.zip || '',
        country: user.address.country || 'NZ',
      });
    }
  }, [user, addressMode]);

  // Shipping options
  const [shippingOptions, setShippingOptions] = useState<any[]>([]);
  const [selectedShippingOption, setSelectedShippingOption] = useState<string>('');
  const [shippingLoading, setShippingLoading] = useState(false);

  // Fetch shipping options when address is entered
  useEffect(() => {
    if (!form.line1) return;
    setShippingLoading(true);
    api.get('/shipping/rates', {
      params: { line1: form.line1, city: form.city, state: form.state, zip: form.zip, country: form.country },
    })
      .then((res) => {
        const rates = res.data?.data || [];
        setShippingOptions(rates);
        // Auto-select first option if none selected
        if (rates.length > 0 && !selectedShippingOption) {
          setSelectedShippingOption(rates[0].id);
        }
      })
      .catch(() => setShippingOptions([]))
      .finally(() => setShippingLoading(false));
  }, [form.line1, form.city, form.state, form.zip, form.country]);

  // Sync shipping method to cart when selection changes
  const prevShippingRef = useRef(selectedShippingOption);
  useEffect(() => {
    if (!selectedShippingOption) return;
    // Skip initial mount — only sync on user-initiated changes
    if (prevShippingRef.current === selectedShippingOption) return;
    prevShippingRef.current = selectedShippingOption;
    const option = shippingOptions.find(o => o.id === selectedShippingOption);
    if (option) {
      api.post('/shipping/select', {
        methodId: option.id,
        methodName: option.name,
        cost: option.cost || 0,
      }).then(() => refreshCart()).catch(() => {});
    }
  }, [selectedShippingOption, shippingOptions]);

  // CMS settings for trust badges
  const { settings } = useSiteSettings();
  const trustBadgeTitle = settings?.['checkout.trustBadges.title'] || 'All PawTag devices come with';
  const trustBadgeItems: string[] = useMemo(() => {
    try {
      const raw = settings?.['checkout.trustBadges.items'];
      return raw ? JSON.parse(raw) : ['Lifetime activation', 'Replace if lost', '24/7 support'];
    } catch { return ['Lifetime activation', 'Replace if lost', '24/7 support']; }
  }, [settings]);

  // Check verification status on mount
  useEffect(() => {
    if (user) {
      setEmailVerified(!!user.emailVerified);
      setMobileVerified(!!user.phoneVerified);
    }
  }, [user]);

  // Save return URL for post-login/register redirect — only when not authenticated
  useEffect(() => {
    if (!user) {
      localStorage.setItem('pawtag_return_url', '/checkout');
    }
  }, [user]);

  // Derived values — use PawTag cart totals
  const selectedShippingPrice = shippingOptions.find(o => o.id === selectedShippingOption)?.cost || 0;
  const shippingCost = selectedShippingPrice;
  const taxAmount = totals.tax || 0;
  const discountAmount = totals.discount || promoDiscount;
  const itemsSubtotal = totals.subtotal || total;
  const orderTotal = totals.total || (itemsSubtotal + shippingCost + taxAmount - discountAmount);

  const canProceedToCheckout = items.length > 0;
  const canProceedToPayment = emailVerified && mobileVerified && form.line1 && form.city && form.zip;

  // Step navigation
  const goToStep = (step: Step) => {
    if (step === 'checkout' && !canProceedToCheckout) return;
    if (step === 'payment' && !canProceedToPayment) return;
    setCurrentStep(step);
    setError(null);
  };

  // Promo code handlers
  const applyPromoCode = async () => {
    if (!promoCode) return;
    setPromoLoading(true);
    try {
      await api.post('/cart/promo', { code: promoCode });
      await refreshCart();
      setPromoApplied(true);
      setPromoDiscount(totals.discount || 0);
    } catch (err: any) {
      setError(err.message || 'Invalid promo code');
    } finally {
      setPromoLoading(false);
    }
  };

  const removePromoCode = async () => {
    try {
      await api.delete('/cart/promo');
      setPromoApplied(false);
      setPromoDiscount(0);
      setPromoCode('');
      await refreshCart();
    } catch (err: any) {
      setError(err.message || 'Failed to remove promo code');
    }
  };

  // Address handler
  const handleAddressSelect = (address: AddressComponents) => {
    setForm(prev => ({
      ...prev,
      line1: address.line1, line2: address.line2 || '',
      city: address.city, state: address.state,
      zip: address.zip, country: address.country || 'NZ',
    }));
  };

  // Payment handler — uses PawTag checkout API
  const handlePayment = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Create payment intent via PawTag checkout API
      const checkoutRes = await api.post('/checkout/payment-intent');
      const { paymentIntentId, clientSecret, pendingOrderId } = checkoutRes.data?.data;

      if (!clientSecret) {
        throw new Error('Payment session could not be created');
      }

      // Store referral code for later
      const referralCode = localStorage.getItem('pawtag_referral_code');
      if (referralCode) localStorage.removeItem('pawtag_referral_code');

      // Store checkout state for payment confirmation
      sessionStorage.setItem('pawtag_checkout_payment_intent', paymentIntentId);
      sessionStorage.setItem('pawtag_checkout_pending_order', pendingOrderId);

      // 2. Store client secret — StripePaymentForm will use it to confirm payment
      setPaymentClientSecret(clientSecret);
      setCurrentStep('payment');
    } catch (err: any) {
      const msg = err?.response?.status === 401
        ? 'Your session expired. Please log in again to continue.'
        : err?.message || err?.response?.data?.error || 'Payment failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Called by StripePaymentForm after Stripe confirms payment client-side
  const handlePaymentSuccess = async (paymentIntentId: string) => {
    setLoading(true);
    setError(null);
    try {
      // Drive progress: "Payment Processing..."
      (window as any).__paymentProgress?.setProcessingStage?.('confirmed');

      // 1. Confirm checkout via PawTag API (creates Order + Invoice + sends emails)
      let pawtagOrder = null;
      let invoice = null;
      let invoiceUrl = '';
      try {
        const confirmRes = await api.post('/checkout/confirm', { paymentIntentId });
        pawtagOrder = confirmRes.data.data.order;
        invoice = confirmRes.data.data.invoice;
        invoiceUrl = confirmRes.data.data.invoiceUrl;
      } catch (confirmErr) {
        console.warn('[Checkout] Order confirmation failed, webhook will retry:', confirmErr);
      }

      // 2. Preserve cart data for confirmation page (before clearCart)
      setConfirmedItems([...items]);
      setConfirmedTotal(total);
      setConfirmedInvoice(invoice);
      setConfirmedPawTagOrder(pawtagOrder);
      setOrderNumber(pawtagOrder?.orderNumber || paymentIntentId.slice(-8));

      // Drive progress: "Payment Confirmed..." → "✓ Payment Confirmed"
      (window as any).__paymentProgress?.setProcessingStage?.('complete');

      // 3. Wait for green animation, then show confirmation
      await new Promise((r) => setTimeout(r, 600));

      setSuccess(true);
      setCurrentStep('confirmed');
      sessionStorage.setItem('pawtag_checkout_success', 'true');
      sessionStorage.setItem('pawtag_checkout_order', pawtagOrder?.orderNumber || paymentIntentId.slice(-8));
      clearCart();
    } catch (err: any) {
      setError(err?.message || 'Order confirmation failed. Your payment was received — please contact support.');
      await refreshCart();
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentError = (message: string) => {
    setError(message);
  };

  // Empty cart — but only show if we're not loading, not in payment flow, and not on confirmed step
  if (items.length === 0 && !success && !loading && currentStep === 'cart') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-4">
        <PawPrint className="h-16 w-16 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-700">Your cart is empty</h2>
        <Link to="/shop" className="text-primary-600 hover:text-primary-700 font-medium">← Back to Shop</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-8">
          {STEPS.map((step, i) => {
            const isActive = currentStep === step.key;
            const isComplete = STEPS.findIndex(s => s.key === currentStep) > i && currentStep !== 'cart';
            const StepIcon = step.icon;
            return (
              <div key={step.key} className="flex items-center">
                <button
                  onClick={() => goToStep(step.key)}
                  disabled={!isComplete && !isActive}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : isComplete
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isComplete ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 h-px mx-2 ${isComplete ? 'bg-primary-300' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between mb-6">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-medium">Dismiss</button>
          </div>
        )}

        {/* Step 1: Cart Review */}
        {currentStep === 'cart' && (
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Cart</h1>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                  <ShieldCheck className="h-4 w-4 text-primary-600 flex-shrink-0" />
                  <span>{trustBadgeTitle}</span>
                  {trustBadgeItems.map((item, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                      <span className="text-gray-600">{item}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Items Table */}
              <div className="px-6">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 text-sm font-semibold text-gray-500">Item</th>
                      <th className="text-right py-3 text-sm font-semibold text-gray-500">Price</th>
                      <th className="text-center py-3 text-sm font-semibold text-gray-500">Qty</th>
                      <th className="text-right py-3 text-sm font-semibold text-gray-500">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.productId || item.variantId} className="border-b border-gray-50">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-14 w-14 bg-primary-50 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                              {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <PawPrint className="h-6 w-6 text-primary-300" />}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{item.productName || item.name}</p>
                              <p className="text-xs text-gray-500">{item.quantity > 1 ? `Qty: ${item.quantity}` : ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-right text-sm text-gray-600">NZ${(item.unitPrice || item.price || 0).toFixed(2)}</td>
                        <td className="text-center text-sm text-gray-600">{item.quantity}</td>
                        <td className="text-right text-sm font-semibold text-gray-900">NZ${((item.unitPrice || item.price || 0) * item.quantity).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="px-6 py-4 border-t border-gray-100">
                {/* Promo code section */}
                {promoApplied ? (
                  <div className="flex items-center justify-between text-sm mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-700">{promoCode}</span>
                      <span className="text-green-600">applied — saved NZ${discountAmount.toFixed(2)}</span>
                    </div>
                    <button onClick={removePromoCode} className="text-xs text-gray-500 hover:text-red-500 font-medium ml-2">Remove</button>
                  </div>
                ) : (
                  <div className="flex gap-2 mb-4">
                    <input type="text" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder="Add promo code" disabled={promoApplied} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400" />
                    <button onClick={applyPromoCode} disabled={!promoCode || promoLoading || promoApplied} className="px-4 py-2 text-sm text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 disabled:opacity-50">
                      {promoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                    </button>
                  </div>
                )}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>NZ${itemsSubtotal.toFixed(2)}</span></div>
                  {discountAmount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span>-NZ${discountAmount.toFixed(2)}</span></div>}
                  <div className="flex justify-between text-sm text-gray-600"><span>Shipping</span><span className={`font-medium ${shippingCost === 0 ? 'text-green-600' : 'text-gray-900'}`}>{shippingCost === 0 ? 'FREE' : `NZ$${shippingCost.toFixed(2)}`}</span></div>
                  <div className="flex justify-between text-sm text-gray-600"><span>Tax (Included)</span><span>NZ${taxAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-100"><span>Total (NZD)</span><span className="text-primary-700">NZ${orderTotal.toFixed(2)}</span></div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                  <Lock className="h-4 w-4" /> <span>Secure & Trusted Checkout</span>
                </div>
                <p className="text-xs text-gray-400 mb-4">Your information is encrypted and safe with us. We never store your card details.</p>
                <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                  <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> SSL Encrypted</span>
                  <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> PCI DSS Compliant</span>
                  <span className="flex items-center gap-1">Powered by PawTag</span>
                </div>
                <button onClick={() => goToStep('checkout')} className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-all flex items-center justify-center gap-2">
                  Proceed to Checkout <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Checkout (Verification + Address) */}
        {currentStep === 'checkout' && (
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <Link to="/shop" className="inline-flex items-center gap-2 text-gray-500 hover:text-primary-600 text-sm"><ArrowLeft className="h-4 w-4" /> Back to Shop</Link>
              <button onClick={() => goToStep('cart')} className="text-sm text-primary-600 hover:text-primary-700">Edit Cart</button>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Checkout</h1>
            <p className="text-gray-500 mb-6">Verify your contact details and shipping address</p>

            {!user ? (
              <CheckoutAuth />
            ) : (
              <div className="max-w-2xl">
                {/* Welcome message for signed-in user */}
                <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 mb-4 flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-primary-600 flex-shrink-0" />
                  <p className="text-sm text-primary-700">
                    Welcome back, <span className="font-semibold">{user.fullName || 'there'}</span>! You're signed in and ready to checkout.
                  </p>
                </div>

                {/* Contact Verification — only shown for authenticated users */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Mail className="h-5 w-5 text-primary-600" /> Contact Verification</h2>

                  <div className={`flex items-center justify-between p-4 rounded-xl mb-3 ${emailVerified ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                    <div className="flex items-center gap-3">
                      <Mail className={`h-5 w-5 ${emailVerified ? 'text-green-600' : 'text-gray-400'}`} />
                      <div><p className="font-medium text-gray-900">Email Verification</p><p className="text-xs text-gray-500">{user.email}</p></div>
                    </div>
                    {emailVerified ? <span className="text-sm text-green-600 font-medium flex items-center gap-1"><Check className="h-4 w-4" /> Verified</span> : <span className="text-sm text-amber-600 font-medium">Not Verified</span>}
                  </div>

                  <div className={`flex items-center justify-between p-4 rounded-xl mb-4 ${mobileVerified ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                    <div className="flex items-center gap-3">
                      <Smartphone className={`h-5 w-5 ${mobileVerified ? 'text-green-600' : 'text-gray-400'}`} />
                      <div><p className="font-medium text-gray-900">Mobile Verification</p><p className="text-xs text-gray-500">{user.phoneNumber || 'Not set'}</p></div>
                    </div>
                    {mobileVerified ? <span className="text-sm text-green-600 font-medium flex items-center gap-1"><Check className="h-4 w-4" /> Verified</span> : <span className="text-sm text-amber-600 font-medium">Not Verified</span>}
                  </div>

                  {!emailVerified && <Link to="/verify-account" className="block w-full py-2 text-center text-sm text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 mb-2">Verify Email</Link>}
                  {!mobileVerified && <Link to="/verify-account" className="block w-full py-2 text-center text-sm text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50">Verify Mobile</Link>}

                  <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 mt-4">
                    <div className="flex items-start gap-2"><Shield className="h-4 w-4 text-primary-600 mt-0.5" /><p className="text-xs text-primary-700"><strong>Why do we verify?</strong> We use verified email & mobile to secure your account, send important updates and help reunite pets faster.</p></div>
                  </div>
                </div>

                {/* Shipping Address */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Truck className="h-5 w-5 text-primary-600" /> Shipping Address</h2>
                    {user?.address?.line1 && addressMode === 'saved' && (
                      <button onClick={() => { setAddressMode('custom'); }} className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
                        <Edit3 className="h-3 w-3" /> Change
                      </button>
                    )}
                  </div>

                  {addressMode === 'saved' && user?.address?.line1 ? (
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <p className="font-medium text-gray-900">{user.fullName}</p>
                      <p className="text-sm text-gray-600">{form.line1}{form.line2 ? `, ${form.line2}` : ''}</p>
                      <p className="text-sm text-gray-600">{form.city} {form.zip}</p>
                      <p className="text-sm text-gray-600">New Zealand</p>
                      {user.phoneNumber && <p className="text-sm text-gray-600 mt-1">{user.phoneNumber}</p>}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
                        <AddressAutocomplete value={form.line1} onChange={(val) => setForm(prev => ({ ...prev, line1: val }))} onAddressSelect={handleAddressSelect} placeholder="123 Main Street" />
                      </div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label><input type="text" value={form.line2} onChange={e => setForm({ ...form, line2: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm" placeholder="Apartment, suite, etc." /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">City *</label><input type="text" required value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 text-sm" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Postcode *</label><input type="text" required value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 text-sm" /></div>
                      </div>
                      {user?.address?.line1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setForm({
                              line1: user.address!.line1 || '',
                              line2: user.address!.line2 || '',
                              city: user.address!.city || '',
                              state: user.address!.state || '',
                              zip: user.address!.zip || '',
                              country: user.address!.country || 'NZ',
                            });
                            setAddressMode('saved');
                          }}
                          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          Use my saved address
                        </button>
                      )}
                    </div>
                  )}

                  {/* Shipping Method — shown after address is entered */}
                  {form.line1 && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                        <Truck className="h-4 w-4 text-primary-600" /> Shipping Method
                      </h3>
                      {shippingLoading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading shipping options...
                        </div>
                      ) : shippingOptions.length > 0 ? (
                        <div className="space-y-2">
                          {shippingOptions.map((option) => (
                            <label
                              key={option.id}
                              className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                selectedShippingOption === option.id
                                  ? 'border-primary-500 bg-primary-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="radio"
                                  name="shipping"
                                  value={option.id}
                                  checked={selectedShippingOption === option.id}
                                  onChange={() => setSelectedShippingOption(option.id)}
                                  className="text-primary-600"
                                />
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{option.name}</p>
                                  {option.type?.description && (
                                    <p className="text-xs text-gray-500">{option.type.description}</p>
                                  )}
                                </div>
                              </div>
                              <span className={`text-sm font-semibold ${(option.cost || 0) === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                                {(option.cost || 0) === 0 ? 'FREE' : `NZ$${(option.cost || 0).toFixed(2)}`}
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No shipping options available for this address.</p>
                      )}
                    </div>
                  )}

                  <button onClick={handlePayment} disabled={!canProceedToPayment || loading} className="w-full mt-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Setting up payment...</> : <><>Continue to Payment <ChevronRight className="h-4 w-4" /></></>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review & Pay */}
        {currentStep === 'payment' && (
          <div className="max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Review & Pay</h1>
            <p className="text-gray-500 mb-6">Review your order and complete payment</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: Order Summary */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
                  <button onClick={() => goToStep('cart')} className="text-sm text-primary-600 hover:text-primary-700 mb-4">Edit Cart</button>
                  {items.map((item) => (
                    <div key={item.productId || item.variantId} className="flex gap-3 mb-4 pb-4 border-b border-gray-100 last:border-0">
                      <div className="h-14 w-14 bg-primary-50 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <PawPrint className="h-6 w-6 text-primary-300" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.productName || item.name}</p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-semibold text-gray-900">NZ${(item.unitPrice || item.price || 0).toFixed(2)}</p>
                    </div>
                  ))}
                  <div className="space-y-2 pt-4">
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Subtotal</span><span className="text-gray-900">NZ${itemsSubtotal.toFixed(2)}</span></div>
                    {discountAmount > 0 && <div className="flex justify-between text-sm"><span className="text-green-600">Discount</span><span className="text-green-600">-NZ${discountAmount.toFixed(2)}</span></div>}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Shipping{selectedShippingOption ? ` — ${shippingOptions.find(o => o.id === selectedShippingOption)?.name || ''}` : ''}</span>
                      <span className={`font-medium ${shippingCost === 0 ? 'text-green-600' : 'text-gray-900'}`}>{shippingCost === 0 ? 'FREE' : `NZ$${shippingCost.toFixed(2)}`}</span>
                    </div>
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Tax (Included)</span><span className="text-gray-900">NZ${taxAmount.toFixed(2)}</span></div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-100"><span>Total (NZD)</span><span className="text-primary-700">NZ${orderTotal.toFixed(2)}</span></div>
                  </div>

                  {/* Shipping Address */}
                  {form.line1 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Shipping to</p>
                      <p className="text-sm text-gray-900">{user?.fullName || 'Customer'}</p>
                      <p className="text-sm text-gray-600">{form.line1}{form.line2 ? `, ${form.line2}` : ''}</p>
                      <p className="text-sm text-gray-600">{form.city} {form.zip}</p>
                      <p className="text-sm text-gray-600">New Zealand</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Payment Method */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h2>
                  {paymentClientSecret ? (
                    <CheckoutErrorBoundary onReset={() => setPaymentClientSecret('')}>
                      <StripePaymentForm
                        clientSecret={paymentClientSecret}
                        onPaymentSuccess={handlePaymentSuccess}
                        onPaymentError={handlePaymentError}
                        disabled={loading}
                      />
                    </CheckoutErrorBoundary>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                      <span className="ml-2 text-sm text-gray-500">Loading payment methods...</span>
                    </div>
                  )}
                </div>

                {/* Trust badges */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-xl"><RefreshCw className="h-5 w-5 text-primary-600 mx-auto mb-1" /><p className="text-xs font-medium text-gray-900">60-Day Returns</p><p className="text-xs text-gray-500">Easy returns & refunds</p></div>
                  <div className="text-center p-3 bg-gray-50 rounded-xl"><Lock className="h-5 w-5 text-primary-600 mx-auto mb-1" /><p className="text-xs font-medium text-gray-900">Secure Payments</p><p className="text-xs text-gray-500">100% secure checkout</p></div>
                  <div className="text-center p-3 bg-gray-50 rounded-xl"><Headphones className="h-5 w-5 text-primary-600 mx-auto mb-1" /><p className="text-xs font-medium text-gray-900">24/7 Support</p><p className="text-xs text-gray-500">We're here to help</p></div>
                </div>

                <p className="text-xs text-gray-400 text-center">By placing this order, you agree to our <Link to="/terms" className="underline">Terms of Service</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.</p>
                <p className="text-xs text-gray-400 text-center">Powered by Stripe</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Confirmed — Enterprise Order Confirmation */}
        {currentStep === 'confirmed' && (
          <div className="max-w-2xl mx-auto py-8 space-y-6">
            {/* Success Header */}
            <div className="text-center">
              <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-[pulse_2s_ease-in-out_1]">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Order Confirmed!</h1>
              <p className="text-lg text-gray-600">
                Thank you for your purchase{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}.
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Order <span className="font-mono font-semibold text-primary-700">{orderNumber}</span>
                {' · '}
                {new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>

            {/* Order Summary */}
            {confirmedItems.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Package className="h-4 w-4" /> Order Summary
                </h2>
                <div className="space-y-3">
                  {confirmedItems.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-primary-50 rounded-lg flex items-center justify-center">
                          <PawPrint className="h-5 w-5 text-primary-300" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.productName || item.name}</p>
                          <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">NZ${(item.unitPrice || 0).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal</span><span>NZ${confirmedTotal.toFixed(2)}</span>
                  </div>
                  {(() => {
                    const shippingItem = confirmedItems.find((i: any) => !i.variantId || i.name?.toLowerCase().includes('shipping'));
                    const shippingAmt = shippingItem?.price || 0;
                    return (
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Shipping</span>
                        <span className={shippingAmt === 0 ? 'text-green-600 font-medium' : 'text-gray-900 font-medium'}>
                          {shippingAmt === 0 ? 'FREE' : `NZ$${shippingAmt.toFixed(2)}`}
                        </span>
                      </div>
                    );
                  })()}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-100">
                    <span>Total Paid</span><span className="text-primary-700">NZ${confirmedTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Order Status Timeline */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Truck className="h-4 w-4" /> Order Status
              </h2>
              <div className="relative">
                <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200" />
                <div className="space-y-0">
                  {[
                    { label: 'Order Placed', time: 'Just now', done: true },
                    { label: 'Being Processed', time: 'Pending', done: false },
                    { label: confirmedPawTagOrder?.trackingNumber ? `Shipped — ${confirmedPawTagOrder.carrier || 'Courier'}` : 'Shipped (tracking will appear here)', time: confirmedPawTagOrder?.trackingNumber || 'Pending', done: !!confirmedPawTagOrder?.trackingNumber },
                    { label: 'Delivered', time: 'Pending', done: false },
                  ].map((step, i) => (
                    <div key={i} className="relative flex items-start gap-3 pb-5 last:pb-0">
                      <div className={`relative z-10 w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 ${
                        step.done ? 'bg-primary-600' : 'bg-gray-200'
                      } ${i === 0 ? 'ring-2 ring-offset-2 ring-green-200' : ''}`}>
                        {step.done ? <Check className="h-4 w-4 text-white" /> : <Clock className="h-4 w-4 text-gray-400" />}
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className={`text-sm ${i === 0 ? 'font-medium text-gray-900' : 'text-gray-700'}`}>{step.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{step.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Invoice Section */}
            {confirmedInvoice && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Invoice
                </h2>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-mono font-medium text-gray-900">{confirmedInvoice.invoiceNumber}</p>
                    <p className="text-sm text-gray-500">NZ${confirmedInvoice.amount.toFixed(2)} · <span className="text-green-600 font-medium">Paid</span></p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const res = await api.post(`/customer/invoices/${confirmedInvoice._id}/access`);
                        const { secureUrl } = res.data.data;
                        if (secureUrl) window.open(secureUrl, '_blank');
                      } catch { window.open(`/account/orders`, '_blank'); }
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-all"
                  >
                    <ExternalLink size={14} /> View
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await api.post(`/customer/invoices/${confirmedInvoice._id}/access`);
                        const { secureUrl } = res.data.data;
                        if (secureUrl) window.open(secureUrl, '_blank');
                      } catch {}
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-primary-600 text-primary-600 rounded-xl text-sm font-semibold hover:bg-primary-50 transition-all"
                  >
                    <Download size={14} /> Download
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await api.post(`/customer/invoices/${confirmedInvoice._id}/access`);
                        const { secureUrl } = res.data.data;
                        if (secureUrl) window.open(secureUrl, '_blank');
                      } catch {}
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all"
                  >
                    <Printer size={14} /> Print
                  </button>
                  <button
                    onClick={() => {
                      const url = window.location.origin + '/account/orders';
                      if (navigator.share) {
                        navigator.share({ title: `PawTag Order ${orderNumber}`, url });
                      } else {
                        navigator.clipboard.writeText(url);
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all"
                  >
                    <Share2 size={14} /> Share
                  </button>
                </div>
              </div>
            )}

            {/* Confirmation Sent */}
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-start gap-3">
              <Mail className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">Confirmation sent</p>
                <p className="text-sm text-green-700 mt-0.5">
                  Order confirmation and invoice have been sent to <strong>{user?.email}</strong>.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link to="/" className="flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-all">
                <Home size={18} /> Back to Home
              </Link>
              <Link to="/shop" className="flex items-center justify-center gap-2 px-6 py-3 border border-primary-600 text-primary-600 rounded-xl font-semibold hover:bg-primary-50 transition-all">
                <ShoppingBag size={18} /> Continue Shopping
              </Link>
              <Link to="/account/orders" className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all">
                View My Orders
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
