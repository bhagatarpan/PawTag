import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Lock, CreditCard, PawPrint, CheckCircle, Truck, Tag, Loader2,
  Mail, Smartphone, Shield, ChevronRight, Edit3, Check, Package, Clock,
  ShieldCheck, Headphones, RefreshCw
} from 'lucide-react';
import { AddressAutocomplete } from '@pawtag/ui';
import type { AddressComponents } from '@pawtag/ui';
import api from '../lib/api';
import { sdk } from '../lib/medusa';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../hooks/useCms';
import CheckoutAuth from '../components/CheckoutAuth';
import StripePaymentForm from '../components/StripePaymentForm';

type Step = 'cart' | 'checkout' | 'payment' | 'confirmed';

const STEPS = [
  { key: 'cart' as Step, label: 'Cart', icon: Package },
  { key: 'checkout' as Step, label: 'Checkout', icon: Truck },
  { key: 'payment' as Step, label: 'Payment', icon: CreditCard },
  { key: 'confirmed' as Step, label: 'Confirmed', icon: CheckCircle },
];

export default function Checkout() {
  const { items, total, cart, clearCart, refreshCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Step management
  const [currentStep, setCurrentStep] = useState<Step>(() => {
    // Restore step from sessionStorage (survives refresh)
    const savedStep = sessionStorage.getItem('pawtag_checkout_step') as Step;
    return savedStep || 'cart';
  });

  // Form state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState(() => sessionStorage.getItem('pawtag_checkout_order') || '');
  const [success, setSuccess] = useState(() => sessionStorage.getItem('pawtag_checkout_success') === 'true');
  const [paymentClientSecret, setPaymentClientSecret] = useState('');

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
    if (!cart?.id || !form.line1) return;
    setShippingLoading(true);
    sdk.store.fulfillment.listCartOptions({ cart_id: cart.id })
      .then(({ shipping_options }) => {
        setShippingOptions(shipping_options || []);
        // Auto-select first option if none selected
        if (shipping_options?.length > 0 && !selectedShippingOption) {
          setSelectedShippingOption(shipping_options[0].id);
        }
      })
      .catch(() => setShippingOptions([]))
      .finally(() => setShippingLoading(false));
  }, [cart?.id, form.line1]);

  // Sync shipping method to Medusa cart when selection changes (updates cart totals in real time)
  const prevShippingRef = useRef(selectedShippingOption);
  useEffect(() => {
    if (!cart?.id || !selectedShippingOption) return;
    // Skip initial mount — only sync on user-initiated changes
    if (prevShippingRef.current === selectedShippingOption) return;
    prevShippingRef.current = selectedShippingOption;
    sdk.store.cart.addShippingMethod(cart.id, { option_id: selectedShippingOption })
      .then(() => refreshCart())
      .catch(() => {});
  }, [selectedShippingOption, cart?.id]);

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

  // Derived values — all from Medusa cart (single source of truth)
  const selectedShippingPrice = shippingOptions.find(o => o.id === selectedShippingOption)?.amount || 0;
  const shippingCost = cart?.shipping_total || selectedShippingPrice;
  const taxAmount = cart?.tax_total || 0;
  const discountAmount = cart?.discount_total || promoDiscount;
  const orderTotal = cart?.total || total;

  const canProceedToCheckout = items.length > 0;
  const canProceedToPayment = emailVerified && mobileVerified && form.line1 && form.city && form.zip;

  // Step navigation
  const goToStep = (step: Step) => {
    if (step === 'checkout' && !canProceedToCheckout) return;
    if (step === 'payment' && !canProceedToPayment) return;
    setCurrentStep(step);
    sessionStorage.setItem('pawtag_checkout_step', step);
    setError(null);
  };

  // Promo code handlers
  const applyPromoCode = async () => {
    if (!promoCode || !cart) return;
    setPromoLoading(true);
    try {
      const { cart: updated } = await sdk.store.cart.addPromotions(cart.id, { promo_codes: [promoCode] } as any);
      if (updated) {
        // Reconcile local cart with server (discount applied, totals updated)
        await refreshCart();
      }
      setPromoApplied(true);
      setPromoDiscount(updated?.discount_total || 0);
    } catch (err: any) {
      setError(err.message || 'Invalid promo code');
    } finally {
      setPromoLoading(false);
    }
  };

  const removePromoCode = async () => {
    if (!cart) return;
    try {
      await sdk.store.cart.removePromotions(cart.id, { promo_codes: [promoCode] } as any);
      setPromoApplied(false);
      setPromoDiscount(0);
      setPromoCode('');
      // Reconcile local cart with server (discount removed, totals updated)
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

  // Payment handler — uses Medusa SDK checkout flow
  const handlePayment = async () => {
    if (!user || !cart) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Ensure customer is associated with cart (non-blocking — fire-and-forget)
      if (!cart.customer_id) {
        api.post('/customer/medusa-sync').then((res) => {
          const medusaCustomerId = res.data?.data?.medusaCustomerId;
          if (medusaCustomerId) {
            sdk.store.cart.update(cart.id, { customer_id: medusaCustomerId } as any).catch(() => {});
          }
        }).catch(() => {}); // Non-blocking — sync failure should not block checkout
      }

      // 2. Pass referral code to cart metadata (if present)
      const referralCode = localStorage.getItem('pawtag_referral_code');
      if (referralCode && !cart.metadata?.referralCode) {
        await sdk.store.cart.update(cart.id, {
          metadata: { referralCode },
        } as any);
        localStorage.removeItem('pawtag_referral_code');
      }

      // 3. Add shipping address to cart
      try {
        await sdk.store.cart.update(cart.id, {
          shipping_address: {
            first_name: user.fullName?.split(' ')[0] || 'Customer',
            last_name: user.fullName?.split(' ').slice(1).join(' ') || '',
            address_1: form.line1,
            address_2: form.line2 || undefined,
            city: form.city,
            province: form.state || undefined,
            postal_code: form.zip,
            country_code: (form.country || 'nz').toLowerCase(),
            phone: user.phoneNumber || undefined,
          },
        } as any);
      } catch (addrErr: any) {
        console.warn('Address update failed, retrying with minimal fields:', addrErr?.message);
        await sdk.store.cart.update(cart.id, {
          shipping_address: {
            first_name: user.fullName?.split(' ')[0] || 'Customer',
            last_name: user.fullName?.split(' ').slice(1).join(' ') || '',
            address_1: form.line1,
            city: form.city,
            postal_code: form.zip,
            country_code: (form.country || 'nz').toLowerCase(),
          },
        } as any);
      }

      // 4. Add selected shipping method
      if (selectedShippingOption) {
        try {
          await sdk.store.cart.addShippingMethod(cart.id, {
            option_id: selectedShippingOption,
          });
          console.log('[Checkout] Shipping method added:', selectedShippingOption);
        } catch (shipErr: any) {
          console.error('[Checkout] Shipping method error:', shipErr?.message);
        }
      }

      // 5. Initiate payment session and get client secret for Stripe Elements
      await sdk.store.payment.initiatePaymentSession(cart, {
        provider_id: 'pp_stripe_stripe',
      });

      // Re-fetch cart to get payment session with client_secret
      const { cart: refreshedCart } = await sdk.store.cart.retrieve(cart.id);
      const cartAny = refreshedCart as any;
      const clientSecret = cartAny?.payment_sessions?.[0]?.data?.client_secret;

      if (!clientSecret) {
        throw new Error('Payment session could not be created');
      }

      // Store client secret — StripePaymentForm will use it to confirm payment
      setPaymentClientSecret(clientSecret);
      setCurrentStep('payment');
    } catch (err: any) {
      setError(err?.message || err?.response?.data?.error || 'Payment failed. Please try again.');
      // Refresh cart to reconcile any server-side mutations from the failed payment attempt
      await refreshCart();
    } finally {
      setLoading(false);
    }
  };

  // Called by StripePaymentForm after Stripe confirms payment client-side
  const handlePaymentSuccess = async (paymentIntentId: string) => {
    if (!cart) return;
    setLoading(true);
    setError(null);
    try {
      const result = await sdk.store.cart.complete(cart.id);

      if (result.type === 'cart') {
        throw new Error(result.error?.message || result.error?.name || 'Order creation failed — cart could not be completed');
      }

      const medusaOrder = result.order;
      const orderDisplay = medusaOrder.display_id?.toString() || medusaOrder.id || 'Processing';
      setOrderNumber(orderDisplay);
      setSuccess(true);
      setCurrentStep('confirmed');
      sessionStorage.setItem('pawtag_checkout_success', 'true');
      sessionStorage.setItem('pawtag_checkout_order', orderDisplay);
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

  // Empty cart
  if (items.length === 0 && !success) {
    // Clean up checkout session state
    sessionStorage.removeItem('pawtag_checkout_success');
    sessionStorage.removeItem('pawtag_checkout_order');
    sessionStorage.removeItem('pawtag_checkout_step');
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
                      <tr key={item.variantId} className="border-b border-gray-50">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-14 w-14 bg-primary-50 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                              {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <PawPrint className="h-6 w-6 text-primary-300" />}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{item.name}</p>
                              <p className="text-xs text-gray-500">{item.quantity > 1 ? `Qty: ${item.quantity}` : ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-right text-sm text-gray-600">NZ${item.price.toFixed(2)}</td>
                        <td className="text-center text-sm text-gray-600">{item.quantity}</td>
                        <td className="text-right text-sm font-semibold text-gray-900">NZ${(item.price * item.quantity).toFixed(2)}</td>
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
                  <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>NZ${total.toFixed(2)}</span></div>
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
                  <span className="flex items-center gap-1">Powered by medusa</span>
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

                  {/* Shipping Method — only shown after address is entered */}
                  {form.line1 && shippingOptions.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                        <Truck className="h-4 w-4 text-primary-600" /> Shipping Method
                      </h3>
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
                            <span className={`text-sm font-semibold ${option.amount === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                              {option.amount === 0 ? 'FREE' : `NZ$${(option.amount || 0).toFixed(2)}`}
                            </span>
                          </label>
                        ))}
                      </div>
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
                    <div key={item.variantId} className="flex gap-3 mb-4 pb-4 border-b border-gray-100 last:border-0">
                      <div className="h-14 w-14 bg-primary-50 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <PawPrint className="h-6 w-6 text-primary-300" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-semibold text-gray-900">NZ${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                  <div className="space-y-2 pt-4">
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Subtotal</span><span className="text-gray-900">NZ${total.toFixed(2)}</span></div>
                    {discountAmount > 0 && <div className="flex justify-between text-sm"><span className="text-green-600">Discount</span><span className="text-green-600">-NZ${discountAmount.toFixed(2)}</span></div>}
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Shipping</span><span className={`font-medium ${shippingCost === 0 ? 'text-green-600' : 'text-gray-900'}`}>{shippingCost === 0 ? 'FREE' : `NZ$${shippingCost.toFixed(2)}`}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Tax (Included)</span><span className="text-gray-900">NZ${taxAmount.toFixed(2)}</span></div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-100"><span>Total (NZD)</span><span className="text-primary-700">NZ${orderTotal.toFixed(2)}</span></div>
                  </div>
                </div>
              </div>

              {/* Right: Payment Method */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h2>
                  {paymentClientSecret ? (
                    <StripePaymentForm
                      clientSecret={paymentClientSecret}
                      onPaymentSuccess={handlePaymentSuccess}
                      onPaymentError={handlePaymentError}
                      disabled={loading}
                    />
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

        {/* Step 4: Confirmed */}
        {currentStep === 'confirmed' && (
          <div className="max-w-lg mx-auto py-12 text-center">
            <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle className="h-12 w-12 text-green-600" /></div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Confirmed!</h1>
            <p className="text-gray-500 mb-2">Thank you for your order.</p>
            <p className="text-xl font-mono font-bold text-primary-700 mb-4">{orderNumber}</p>
            <p className="text-sm text-gray-400 mb-8">We'll send you an email confirmation shortly.</p>
            <div className="flex gap-3 justify-center">
              <Link to="/" className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-all">Back to Home</Link>
              <Link to="/shop" className="px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-all">Continue Shopping</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
