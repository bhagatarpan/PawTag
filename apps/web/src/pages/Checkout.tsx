import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import type { AddressComponents } from '@pawtag/ui';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';
import axios from 'axios';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../hooks/useCms';
import StripePaymentForm from '../components/StripePaymentForm';
import CheckoutErrorBoundary from '../components/CheckoutErrorBoundary';
import CheckoutHeader from '../components/checkout/CheckoutHeader';
import CheckoutSkeleton from '../components/checkout/CheckoutSkeleton';
import CheckoutEmptyState from '../components/checkout/CheckoutEmptyState';
import CartReviewStep from '../components/checkout/steps/CartReviewStep';
import ShippingStep from '../components/checkout/steps/ShippingStep';
import PaymentStep from '../components/checkout/steps/PaymentStep';
import ConfirmationStep from '../components/checkout/steps/ConfirmationStep';
import CheckoutBanners from '../components/checkout/shared/CheckoutBanners';
import CheckoutAuth from '../components/CheckoutAuth';
import analytics from '../lib/analytics';

type Step = 'cart' | 'checkout' | 'payment' | 'confirmed';

export default function Checkout() {
  const { items, total, totals, clearCart, refreshCart, updateItemTexts, toggleCustomisation, error: cartError, promoCode, promoApplied, setPromoCode: setPromoCodeCtx, setPromoApplied: setPromoAppliedCtx } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Step management
  const [currentStep, setCurrentStep] = useState<Step>('cart');

  // Form state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState(() => sessionStorage.getItem('pawtag_checkout_order') || '');
  const [success, setSuccess] = useState(() => sessionStorage.getItem('pawtag_checkout_success') === 'true');
  const [paymentClientSecret, setPaymentClientSecret] = useState('');
  const [recoveringPayment, setRecoveringPayment] = useState(false);

  // Confirmed order data
  const [confirmedItems, setConfirmedItems] = useState<any[]>([]);
  const [confirmedTotal, setConfirmedTotal] = useState(0);
  const [confirmedInvoice, setConfirmedInvoice] = useState<any>(null);
  const [confirmedPawTagOrder, setConfirmedPawTagOrder] = useState<any>(null);

  // Promo code
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [guestPromoInfo, setGuestPromoInfo] = useState<any>(null);
  const [promoError, setPromoError] = useState('');

  // PawRewards
  const [pawRewardsBalance, setPawRewardsBalance] = useState(0);
  const [pawRewardsRedemption, setPawRewardsRedemption] = useState(0);

  // Guardian loyalty data
  const [guardianTier, setGuardianTier] = useState<string>('');
  const [pointsToNextTier, setPointsToNextTier] = useState<number | null>(null);
  const [nextTierName, setNextTierName] = useState<string>('');
  const [isGoldMember, setIsGoldMember] = useState(false);
  const [estimatedPoints, setEstimatedPoints] = useState(0);

  // Verification status
  const [emailVerified, setEmailVerified] = useState(false);
  const [mobileVerified, setMobileVerified] = useState(false);

  // Shipping address
  const [form, setForm] = useState<AddressComponents>({
    line1: '', line2: '', city: '', state: '', zip: '', country: 'NZ',
  });

  // Shipping options
  const [shippingOptions, setShippingOptions] = useState<any[]>([]);
  const [selectedShippingOption, setSelectedShippingOption] = useState<string>('');
  const [shippingLoading, setShippingLoading] = useState(false);

  // CMS settings
  const { settings } = useSiteSettings();
  const goldPrice = settings?.['guardian.goldPrice'] || '1.99';

  // ─── Effects ───────────────────────────────────────────────────────────────

  // Prepopulate address from user profile
  useEffect(() => {
    if (user?.address?.line1) {
      setForm({
        line1: user.address.line1 || '',
        line2: user.address.line2 || '',
        city: user.address.city || '',
        state: user.address.state || '',
        zip: user.address.zip || '',
        country: user.address.country || 'NZ',
      });
    }
  }, [user]);

  // Check verification status
  useEffect(() => {
    if (user) {
      setEmailVerified(!!user.emailVerified);
      setMobileVerified(!!user.phoneVerified);
    }
  }, [user]);

  // Save return URL for post-login redirect
  useEffect(() => {
    if (!user) {
      localStorage.setItem('pawtag_return_url', '/checkout');
    }
  }, [user]);

  // Fetch shipping options
  useEffect(() => {
    if (!form.line1) return;
    setShippingLoading(true);
    api.get(API.shipping.rates, {
      params: { line1: form.line1, city: form.city, state: form.state, zip: form.zip, country: form.country },
    })
      .then((res) => {
        const rates = res.data?.data || [];
        setShippingOptions(rates);
        if (rates.length > 0 && !selectedShippingOption) {
          setSelectedShippingOption(rates[0].id);
        }
      })
      .catch(() => setShippingOptions([]))
      .finally(() => setShippingLoading(false));
  }, [form.line1, form.city, form.state, form.zip, form.country]);

  // Sync shipping method to cart
  useEffect(() => {
    if (!selectedShippingOption) return;
    const option = shippingOptions.find(o => o.id === selectedShippingOption);
    if (option) {
      api.post(API.shipping.select, {
        methodId: option.id,
        methodName: option.name,
        cost: option.cost || 0,
      }).then(() => refreshCart()).catch(() => {});
    }
  }, [selectedShippingOption, shippingOptions]);

  // Fetch Guardian data
  useEffect(() => {
    if (user) {
      api.get('/customer/guardian/rewards')
        .then(res => setPawRewardsBalance(res.data.data.balance || 0))
        .catch(() => setPawRewardsBalance(0));

      Promise.all([
        api.get('/customer/guardian/tier').catch(() => ({ data: { data: {} } })),
        api.get('/customer/guardian/points').catch(() => ({ data: { data: {} } })),
      ]).then(([tierRes, pointsRes]) => {
        const tierData = tierRes.data.data;
        setGuardianTier(tierData.tier || 'CARE');
        setPointsToNextTier(tierData.pointsToNextTier || null);
        setNextTierName(tierData.nextTier || '');
        setIsGoldMember(tierData.isGoldMember || false);
      }).catch(() => {});
    }
  }, [user]);

  // Fetch estimated points
  useEffect(() => {
    const orderTotal = totals?.total || total;
    if (orderTotal > 0) {
      api.get(API.public.points.estimate, { params: { total: orderTotal, isGoldMember: String(isGoldMember) } })
        .then(res => setEstimatedPoints(res.data.data.points || 0))
        .catch(() => setEstimatedPoints(0));
    }
  }, [totals?.total, total, isGoldMember]);

  // Payment state recovery
  useEffect(() => {
    if (!user || success || currentStep !== 'cart') return;
    const storedPaymentIntentId = sessionStorage.getItem('pawtag_checkout_payment_intent');
    if (!storedPaymentIntentId) return;

    const recoverPayment = async () => {
      setRecoveringPayment(true);
      try {
        const res = await api.get('/api/checkout/pending');
        const pending = res.data?.data;
        if (pending && pending.status === 'converted' && pending.convertedOrderId) {
          setSuccess(true);
          setOrderNumber(pending.orderNumber || storedPaymentIntentId.slice(-8));
          sessionStorage.setItem('pawtag_checkout_success', 'true');
          sessionStorage.setItem('pawtag_checkout_order', pending.orderNumber || storedPaymentIntentId.slice(-8));
          setCurrentStep('confirmed');
        } else if (pending && pending.status === 'pending') {
          setPaymentClientSecret(pending.stripeClientSecret || '');
          setCurrentStep('payment');
        } else {
          sessionStorage.removeItem('pawtag_checkout_payment_intent');
          sessionStorage.removeItem('pawtag_checkout_pending_order');
        }
      } catch {
        sessionStorage.removeItem('pawtag_checkout_payment_intent');
        sessionStorage.removeItem('pawtag_checkout_pending_order');
      } finally {
        setRecoveringPayment(false);
      }
    };
    recoverPayment();
  }, [user, success, currentStep]);

  // ─── Derived Values ─────────────────────────────────────────────────────────

  const orderTotal = totals?.total || total;
  const canProceedToCheckout = items.length > 0;
  const canProceedToPayment = emailVerified && mobileVerified && form.line1 && form.city && form.zip;
  const hasSubscriptionItems = items.some((item: any) => item.isSubscription || item.monthlyPrice);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const goToStep = useCallback((step: Step) => {
    setCurrentStep(step);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleBackToShop = useCallback(() => navigate('/shop'), [navigate]);

  const handleAddressChange = useCallback((address: AddressComponents) => {
    setForm(address);
    setSelectedShippingOption('');
  }, []);

  const handleSelectShipping = useCallback((methodId: string, cost: number) => {
    setSelectedShippingOption(methodId);
  }, []);

  // Promo code handlers
  const applyPromoCode = useCallback(async (code: string) => {
    setPromoLoading(true);
    setPromoError('');

    if (!user) {
      try {
        const res = await axios.post(`/api${API.public.promo.validate}`, { code });
        const data = res.data.data;
        if (data.valid) {
          setGuestPromoInfo(data);
        } else {
          setPromoError(data.error || 'Invalid promo code');
          setPromoCodeCtx('');
        }
      } catch {
        setPromoError('Failed to validate promo code');
        setPromoCodeCtx('');
      } finally {
        setPromoLoading(false);
      }
      return;
    }

    try {
      await api.post(API.cart.promo.apply, { code });
      await refreshCart();
      setPromoAppliedCtx(true);
      setPromoDiscount(totals?.discount || 0);
    } catch (err: any) {
      setPromoError(err?.response?.data?.error || 'Invalid promo code');
      setPromoCodeCtx('');
    } finally {
      setPromoLoading(false);
    }
  }, [user, refreshCart, setPromoCodeCtx, setPromoAppliedCtx, totals?.discount]);

  const removePromoCode = useCallback(async () => {
    try {
      if (user) await api.delete(API.cart.promo.remove);
      setPromoAppliedCtx(false);
      setPromoDiscount(0);
      setPromoCodeCtx('');
      setGuestPromoInfo(null);
      if (user) await refreshCart();
    } catch (err: any) {
      setError(err.message || 'Failed to remove promo code');
    }
  }, [user, refreshCart, setPromoCodeCtx, setPromoAppliedCtx]);

  // Proceed to checkout (step 1 → step 2)
  const handleProceedToCheckout = useCallback(async () => {
    goToStep('checkout');
  }, [goToStep]);

  // Proceed to payment (step 2 → step 3)
  const handleProceedToPayment = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const cartCheck = await api.get(API.cart.get);
      const serverItems = cartCheck.data?.data?.cart?.items || [];
      if (serverItems.length === 0) {
        setError('Your cart is empty. Please go back and add items.');
        setLoading(false);
        return;
      }

      const checkoutRes = await api.post(API.checkout.paymentIntent, {
        shippingAddress: {
          line1: form.line1,
          line2: form.line2,
          city: form.city,
          state: form.state,
          zip: form.zip,
          country: form.country || 'NZ',
        },
      });
      const { paymentIntentId, clientSecret, pendingOrderId } = checkoutRes.data?.data;

      if (!clientSecret) throw new Error('Payment session could not be created');

      sessionStorage.setItem('pawtag_checkout_payment_intent', paymentIntentId);
      sessionStorage.setItem('pawtag_checkout_pending_order', pendingOrderId);

      setPaymentClientSecret(clientSecret);
      goToStep('payment');
      analytics.trackCheckoutStart(orderTotal, items.length);
    } catch (err: any) {
      setError(err?.response?.status === 401 ? 'Your session expired.' : 'Payment setup failed.');
    } finally {
      setLoading(false);
    }
  }, [user, form, orderTotal, items.length, goToStep]);

  // Payment success handler
  const handlePaymentSuccess = useCallback(async (paymentIntentId: string) => {
    setLoading(true);
    setError(null);
    try {
      let pawtagOrder = null;
      let invoice = null;

      try {
        const confirmRes = await api.post(API.checkout.confirm, { paymentIntentId, portal: 'customer-web' });
        pawtagOrder = confirmRes.data.data.order;
        invoice = confirmRes.data.data.invoice;
      } catch (confirmErr: any) {
        // Recovery: check if order was created despite error
        try {
          const recoveryRes = await api.get('/api/checkout/pending');
          const recoveryPending = recoveryRes.data?.data;
          if (recoveryPending?.status === 'converted' && recoveryPending.convertedOrderId) {
            pawtagOrder = { orderNumber: recoveryPending.orderNumber };
            invoice = recoveryPending.invoice || null;
          } else {
            setError('Payment received but order not confirmed. Check order history or contact support.');
            setLoading(false);
            return;
          }
        } catch {
          setError('Something went wrong. Your payment was received — please contact support.');
          setLoading(false);
          return;
        }
      }

      setConfirmedItems([...items]);
      setConfirmedTotal(total);
      setConfirmedInvoice(invoice);
      setConfirmedPawTagOrder(pawtagOrder);
      setOrderNumber(pawtagOrder?.orderNumber || paymentIntentId.slice(-8));

      await new Promise(r => setTimeout(r, 600));
      setSuccess(true);
      setCurrentStep('confirmed');

      sessionStorage.setItem('pawtag_checkout_success', 'true');
      sessionStorage.setItem('pawtag_checkout_order', pawtagOrder?.orderNumber || paymentIntentId.slice(-8));
      sessionStorage.removeItem('pawtag_checkout_payment_intent');
      sessionStorage.removeItem('pawtag_checkout_pending_order');

      await clearCart();
      analytics.trackCheckoutComplete(orderTotal, orderNumber);
    } catch (err: any) {
      setError('Something went wrong confirming your order. Please contact support.');
    } finally {
      setLoading(false);
    }
  }, [items, total, orderTotal, clearCart]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (recoveringPayment) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <CheckoutHeader currentStep={currentStep} itemCount={items.length} />
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-primary-600" />
            <span className="ml-3 text-gray-600">Recovering your order...</span>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0 && !success && currentStep !== 'confirmed') {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <CheckoutHeader currentStep={currentStep} itemCount={0} onBackToShop={handleBackToShop} />
          <CheckoutEmptyState />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 pb-24 lg:pb-8">
      <div className="max-w-6xl mx-auto">
        <CheckoutHeader
          currentStep={currentStep}
          itemCount={items.length}
          onBackToShop={currentStep === 'cart' ? handleBackToShop : undefined}
        />

        <CheckoutBanners
          priceChanged={!!cartError}
          inventoryIssue={undefined}
          onRefresh={refreshCart}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-600 hover:text-red-800 underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Step 1: Cart Review */}
        {currentStep === 'cart' && (
          <CartReviewStep
            items={items}
            subtotal={totals?.subtotal || 0}
            discount={totals?.discount || promoDiscount}
            shipping={totals?.shipping || 0}
            tax={totals?.tax || 0}
            total={totals?.total || total}
            currency={totals?.currency || 'NZD'}
            onUpdateQuantity={(id, qty) => {}} // Read-only in checkout
            onRemove={(id) => {}}
            onContinue={handleProceedToCheckout}
          />
        )}

        {/* Step 2: Shipping */}
        {currentStep === 'checkout' && (
          <>
            {!user ? (
              <CheckoutAuth onLoginSuccess={() => goToStep('checkout')} />
            ) : (
              <ShippingStep
                shippingAddress={form}
                onAddressChange={handleAddressChange}
                shippingMethods={shippingOptions}
                selectedShipping={selectedShippingOption}
                onSelectShipping={handleSelectShipping}
                isGoldMember={isGoldMember}
                onContinue={handleProceedToPayment}
                onBack={() => goToStep('cart')}
              />
            )}
          </>
        )}

        {/* Step 3: Payment */}
        {currentStep === 'payment' && (
          <PaymentStep
            subtotal={totals?.subtotal || 0}
            discount={totals?.discount || promoDiscount}
            shipping={totals?.shipping || 0}
            tax={totals?.tax || 0}
            total={totals?.total || total}
            currency={totals?.currency || 'NZD'}
            itemCount={items.length}
            shippingAddress={form}
            onBack={() => goToStep('checkout')}
          >
            <CheckoutErrorBoundary>
              <StripePaymentForm
                clientSecret={paymentClientSecret}
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentError={(msg: string) => setError(msg)}
              />
            </CheckoutErrorBoundary>
          </PaymentStep>
        )}

        {/* Step 4: Confirmation */}
        {currentStep === 'confirmed' && (
          <ConfirmationStep
            orderNumber={orderNumber}
            confirmedItems={confirmedItems}
            confirmedTotal={confirmedTotal}
            confirmedInvoice={confirmedInvoice}
            confirmedPawTagOrder={confirmedPawTagOrder}
            user={user}
            guardianTier={guardianTier}
            isGoldMember={isGoldMember}
            estimatedPoints={estimatedPoints}
            pointsToNextTier={pointsToNextTier}
            nextTierName={nextTierName}
            goldPrice={goldPrice}
          />
        )}
      </div>

      {/* Mobile sticky checkout bar */}
      {currentStep !== 'confirmed' && items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-white border-t border-gray-200 px-4 py-3 z-40">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</p>
              <p className="text-lg font-bold text-gray-900">${(totals?.total || total).toFixed(2)}</p>
            </div>
            <button
              onClick={currentStep === 'cart' ? handleProceedToCheckout : handleProceedToPayment}
              disabled={loading || (currentStep === 'checkout' && !canProceedToPayment)}
              className="flex-shrink-0 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'Continue'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
