import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Lock, CreditCard, PawPrint, CheckCircle, Truck, Tag, Loader2,
  Mail, Smartphone, Shield, ChevronRight, Edit3, Check, Package, Clock,
  ShieldCheck, Headphones, RefreshCw, FileText, Download, Printer, Share2, Home, ExternalLink, Crown, ClipboardCheck
} from 'lucide-react';
import { AddressAutocomplete, InlineEditBanner } from '@pawtag/ui';
import type { AddressComponents } from '@pawtag/ui';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../hooks/useCms';
import CheckoutAuth from '../components/CheckoutAuth';
import StripePaymentForm from '../components/StripePaymentForm';
import CheckoutErrorBoundary from '../components/CheckoutErrorBoundary';
import CheckoutStepIndicator from '../components/checkout/CheckoutStepIndicator';
import CheckoutConfirmationStep from '../components/checkout/CheckoutConfirmationStep';
import PromoCodeControl from '../components/cart/PromoCodeControl';
import ShippingMethodSelect from '../components/cart/ShippingMethodSelect';
import AutoRenewToggle from '../components/cart/AutoRenewToggle';
import GuardianPointsPreview from '../components/cart/GuardianPointsPreview';
import analytics from '../lib/analytics';

// Confirmation page animations
const confirmationStyles = `
@keyframes scale-in { 0% { transform: scale(0); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
@keyframes check-draw { 0% { transform: scale(0) rotate(-45deg); opacity: 0; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
@keyframes fade-in-up { 0% { transform: translateY(12px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
`;

type Step = 'checkout' | 'review' | 'payment' | 'confirmed';

const STEPS = [
  { key: 'checkout' as Step, label: 'Delivery', icon: Truck },
  { key: 'review' as Step, label: 'Review', icon: ClipboardCheck },
  { key: 'payment' as Step, label: 'Payment', icon: CreditCard },
  { key: 'confirmed' as Step, label: 'Confirmed', icon: CheckCircle },
];

export default function Checkout() {
  const { items, total, totals, clearCart, refreshCart, updateQuantity, removeItem, updateItemTexts, toggleCustomisation, error: cartError, promoCode, promoApplied, setPromoCode: setPromoCodeCtx, setPromoApplied: setPromoAppliedCtx } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Step management — always start at cart step on mount.
  // sessionStorage restoration caused a race condition: step restored before
  // cart loaded from server, rendering step 2/3 with empty items = blank screen.
  const [currentStep, setCurrentStep] = useState<Step>('checkout');

  // Form state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState(() => sessionStorage.getItem('pawtag_checkout_order') || '');
  const [success, setSuccess] = useState(() => sessionStorage.getItem('pawtag_checkout_success') === 'true');
  const [paymentClientSecret, setPaymentClientSecret] = useState('');

  // Ref-based double-click protection for payment
  const paymentInProgressRef = useRef(false);

  // Payment state recovery on re-entry
  const [recoveringPayment, setRecoveringPayment] = useState(false);
  const storedPaymentIntentId = sessionStorage.getItem('pawtag_checkout_payment_intent');
  const storedPendingOrderId = sessionStorage.getItem('pawtag_checkout_pending_order');

  // Confirmed order data (preserved before clearCart for the confirmation page)
  const [confirmedItems, setConfirmedItems] = useState<any[]>([]);
  const [confirmedTotal, setConfirmedTotal] = useState(0);
  const [confirmedInvoice, setConfirmedInvoice] = useState<any>(null);
  const [confirmedPawTagOrder, setConfirmedPawTagOrder] = useState<any>(null);

  // Promo code — promoCode and promoApplied come from CartContext (persisted server-side)
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [guestPromoInfo, setGuestPromoInfo] = useState<any>(null);

  // PawRewards
  const [pawRewardsBalance, setPawRewardsBalance] = useState(0);
  const [pawRewardsRedemption, setPawRewardsRedemption] = useState(0);
  const [pawRewardsLoading, setPawRewardsLoading] = useState(false);

  // Guardian loyalty data
  const [guardianTier, setGuardianTier] = useState<string>('');
  const [guardianPoints, setGuardianPoints] = useState(0);
  const [pointsToNextTier, setPointsToNextTier] = useState<number | null>(null);
  const [nextTierName, setNextTierName] = useState<string>('');
  const [isGoldMember, setIsGoldMember] = useState(false);
  const [estimatedPoints, setEstimatedPoints] = useState(0);

  // Computed points earning for display
  const pointsEarning = useMemo(() => {
    if (!totals || totals.total <= 0) return null;
    return {
      points: Math.floor(totals.total * (isGoldMember ? 2 : 1)),
      isGoldMember,
    };
  }, [totals, isGoldMember]);

  // Verification status
  const [emailVerified, setEmailVerified] = useState(false);
  const [mobileVerified, setMobileVerified] = useState(false);

  // Engraving editing state — tracks texts being edited per cart item
  const [editingTexts, setEditingTexts] = useState<Record<string, string[]>>({});
  const [savingTexts, setSavingTexts] = useState<Record<string, boolean>>({});
  const [savedTexts, setSavedTexts] = useState<Record<string, boolean>>({});
  const [expandedEngraving, setExpandedEngraving] = useState<Record<string, boolean>>({});

  // Shipping address — persisted to sessionStorage
  const [addressMode, setAddressMode] = useState<'saved' | 'custom'>(() => {
    return (sessionStorage.getItem('pawtag_checkout_addressMode') as 'saved' | 'custom') || 'saved';
  });
  const [savedAddresses, setSavedAddresses] = useState<Array<{
    _id?: string;
    label: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    isDefault: boolean;
  }>>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    sessionStorage.getItem('pawtag_checkout_selectedAddressId') || ''
  );
  const [form, setForm] = useState(() => {
    const saved = sessionStorage.getItem('pawtag_checkout_address');
    return saved ? JSON.parse(saved) : { label: '', line1: '', line2: '', city: '', state: '', zip: '', country: 'nz' };
  });

  // Fetch saved addresses on mount
  useEffect(() => {
    if (user) {
      api.get(API.customer.addresses.list)
        .then((res) => {
          const addresses = res.data?.data || [];
          setSavedAddresses(addresses);
          // Select default address or first address
          const defaultAddr = addresses.find((a: any) => a.isDefault);
          if (defaultAddr) {
            setSelectedAddressId(defaultAddr._id);
            setForm({
              label: defaultAddr.label || '',
              line1: defaultAddr.line1 || '',
              line2: defaultAddr.line2 || '',
              city: defaultAddr.city || '',
              state: defaultAddr.state || '',
              zip: defaultAddr.zip || '',
              country: defaultAddr.country || 'NZ',
            });
            setAddressMode('saved');
          } else if (addresses.length > 0) {
            setSelectedAddressId(addresses[0]._id);
            setForm({
              label: addresses[0].label || '',
              line1: addresses[0].line1 || '',
              line2: addresses[0].line2 || '',
              city: addresses[0].city || '',
              state: addresses[0].state || '',
              zip: addresses[0].zip || '',
              country: addresses[0].country || 'NZ',
            });
            setAddressMode('saved');
          } else {
            setAddressMode('custom');
          }
        })
        .catch(() => setAddressMode('custom'));
    }
  }, [user]);

  // Persist address state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('pawtag_checkout_addressMode', addressMode);
    sessionStorage.setItem('pawtag_checkout_selectedAddressId', selectedAddressId);
    sessionStorage.setItem('pawtag_checkout_address', JSON.stringify(form));
  }, [addressMode, selectedAddressId, form]);

  // Prepopulate from user profile on mount / login
  useEffect(() => {
    if (user?.address?.line1 && addressMode === 'saved') {
      setForm({
        label: '',
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
    api.get(API.shipping.rates, {
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
      api.post(API.shipping.select, {
        methodId: option.id,
        methodName: option.name,
        cost: option.cost || 0,
      }).then(() => refreshCart()).catch((err) => {
        console.warn('[Checkout] Shipping select failed:', err?.response?.data || err.message);
      });
    }
  }, [selectedShippingOption, shippingOptions]);

  // CMS settings for trust badges
  const { settings } = useSiteSettings();
  const goldPrice = settings?.['guardian.goldPrice'] || '1.99';
  const checkoutUpsellText = settings?.['guardian.gold.checkoutUpsellText'] || 'Earn 2× points on this order with Gold';
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

  // Payment state recovery on re-entry
  // If user refreshes during payment, check if order was already created
  useEffect(() => {
    if (!user || success || currentStep !== 'checkout' || !storedPaymentIntentId) return;

    const recoverPayment = async () => {
      setRecoveringPayment(true);
      try {
        // Check if order already exists for this payment intent
        const res = await api.get(API.checkout.pending);
        const pending = res.data?.data;

        if (pending && pending.status === 'converted' && pending.convertedOrderId) {
          // Order was created — show confirmation
          setSuccess(true);
          setOrderNumber(pending.orderNumber || storedPaymentIntentId.slice(-8));
          sessionStorage.setItem('pawtag_checkout_success', 'true');
          sessionStorage.setItem('pawtag_checkout_order', pending.orderNumber || storedPaymentIntentId.slice(-8));
          setCurrentStep('confirmed');
        } else if (pending && pending.status === 'pending') {
          // Payment still pending — offer to retry
          setPaymentClientSecret(pending.stripeClientSecret || '');
          setCurrentStep('payment');
        } else {
          // Stale state — clear it
          sessionStorage.removeItem('pawtag_checkout_payment_intent');
          sessionStorage.removeItem('pawtag_checkout_pending_order');
        }
      } catch {
        // Recovery failed — clear stale state
        sessionStorage.removeItem('pawtag_checkout_payment_intent');
        sessionStorage.removeItem('pawtag_checkout_pending_order');
      } finally {
        setRecoveringPayment(false);
      }
    };

    recoverPayment();
  }, [user, success, currentStep, storedPaymentIntentId]);

  // Fetch PawRewards balance when user is logged in
  useEffect(() => {
    if (user) {
      api.get('/customer/guardian/rewards')
        .then(res => {
          setPawRewardsBalance(res.data.data.balance || 0);
        })
        .catch(() => {
          setPawRewardsBalance(0);
        });

      // Fetch Guardian tier and points
      Promise.all([
        api.get('/customer/guardian/tier').catch(() => ({ data: { data: {} } })),
        api.get('/customer/guardian/points').catch(() => ({ data: { data: {} } })),
      ]).then(([tierRes, pointsRes]) => {
        const tierData = tierRes.data.data;
        const pointsData = pointsRes.data.data;
        setGuardianTier(tierData.tier || 'CARE');
        setGuardianPoints(pointsData.balance || 0);
        setPointsToNextTier(tierData.pointsToNextTier || null);
        setNextTierName(tierData.nextTier || '');
        setIsGoldMember(tierData.isGoldMember || false);
      }).catch(() => {});
    }
  }, [user]);

  // Derived values — use PawTag cart totals
  const selectedShippingPrice = shippingOptions.find(o => o.id === selectedShippingOption)?.cost || 0;
  const shippingCost = selectedShippingPrice;
  const taxAmount = totals.tax || 0;
  const discountAmount = totals.discount || promoDiscount;
  const itemsSubtotal = totals.subtotal || total;
  const pawRewardsDiscount = Math.min(pawRewardsRedemption, itemsSubtotal + shippingCost + taxAmount - discountAmount);
  const orderTotal = totals.total || (itemsSubtotal + shippingCost + taxAmount - discountAmount - pawRewardsDiscount);
  
  // Check if cart has subscription products (for auto-renew toggle)
  const hasSubscriptionItems = items.some((item: any) => item.isSubscription || item.monthlyPrice);

  // Derive per-item auto-renew map from cart items
  const computedAutoRenewMap: Record<string, boolean> = {};
  items.forEach((item: any) => {
    const key = item._id || item.productId;
    if (key) computedAutoRenewMap[key] = item.autoRenew !== false;
  });
  const [editableAutoRenewMap, setEditableAutoRenewMap] = useState<Record<string, boolean>>(computedAutoRenewMap);

  // Fetch estimated points from backend when order total or membership changes
  useEffect(() => {
    if (orderTotal > 0) {
      api.get(API.public.points.estimate, { params: { total: orderTotal, isGoldMember: String(isGoldMember) } })
        .then(res => setEstimatedPoints(res.data.data.points || 0))
        .catch(() => setEstimatedPoints(0));
    } else {
      setEstimatedPoints(0);
    }
  }, [orderTotal, isGoldMember]);

  // --- Engraving helpers ---
  const getItemTexts = (itemId: string, item: any): string[] => {
    // Use editing state if available, otherwise fall back to saved texts
    if (editingTexts[itemId]) return editingTexts[itemId];
    const saved = item.customisationTexts || [];
    // Pad to quantity with empty strings
    return [...saved, ...Array(Math.max(0, (item.quantity || 1) - saved.length)).fill('')];
  };

  const handleToggleEngraving = async (itemId: string, item: any, enable: boolean) => {
    if (enable) {
      // Enable engraving — copy saved texts into editing state (or initialize empty)
      const saved = item.customisationTexts || [];
      const qty = item.quantity || 1;
      const texts = saved.length > 0
        ? [...saved, ...Array(Math.max(0, qty - saved.length)).fill('')]
        : Array(qty).fill('');
      setEditingTexts(prev => ({ ...prev, [itemId]: texts }));
      setExpandedEngraving(prev => ({ ...prev, [itemId]: true }));
    } else {
      // Disable engraving — clear texts and collapse
      setEditingTexts(prev => ({ ...prev, [itemId]: [] }));
      setExpandedEngraving(prev => ({ ...prev, [itemId]: false }));
    }
    // Toggle customisation flag (handles both guest and server)
    await toggleCustomisation(itemId, enable);
    await refreshCart();
  };

  const handleExpandEngraving = (itemId: string, item: any) => {
    setExpandedEngraving(prev => {
      const isExpanding = !prev[itemId];
      // When expanding, initialize editingTexts from saved texts if not already set
      if (isExpanding && !editingTexts[itemId]) {
        const saved = item.customisationTexts || [];
        const qty = item.quantity || 1;
        const texts = [...saved, ...Array(Math.max(0, qty - saved.length)).fill('')];
        setEditingTexts(prev2 => ({ ...prev2, [itemId]: texts }));
      }
      return { ...prev, [itemId]: isExpanding };
    });
  };

  const handleTextChange = (itemId: string, index: number, value: string) => {
    setEditingTexts(prev => {
      const current = prev[itemId] || [];
      const updated = [...current];
      updated[index] = value.slice(0, 16); // Max 16 chars
      return { ...prev, [itemId]: updated };
    });
  };

  const handleSaveTexts = async (itemId: string) => {
    const texts = editingTexts[itemId] || [];
    setSavingTexts(prev => ({ ...prev, [itemId]: true }));
    await updateItemTexts(itemId, texts);
    await refreshCart();
    setSavingTexts(prev => ({ ...prev, [itemId]: false }));
    // Show success state briefly
    setSavedTexts(prev => ({ ...prev, [itemId]: true }));
    setTimeout(() => setSavedTexts(prev => ({ ...prev, [itemId]: false })), 2000);
  };

  // Auto-save all unsaved texts before proceeding to payment
  const saveAllEngraving = async () => {
    for (const item of items) {
      const itemId = item._id || item.productId || '';
      if (item.customisation && editingTexts[itemId]) {
        await updateItemTexts(itemId, editingTexts[itemId]);
      }
    }
  };

  const canProceedToCheckout = items.length > 0;
  const canProceedToReview = emailVerified && mobileVerified && form.line1 && form.city && form.zip;
  const canProceedToPayment = canProceedToReview;

  // Step navigation
  const goToStep = (step: Step) => {
    if (step === 'checkout' && !canProceedToCheckout) return;
    if (step === 'review' && !canProceedToReview) return;
    if (step === 'payment' && !canProceedToPayment) return;
    setCurrentStep(step);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Promo code handlers
  const [promoError, setPromoError] = useState('');
  const applyPromoCode = async (code?: string) => {
    const promoCodeToUse = code || promoCode;
    if (!promoCodeToUse) return;
    setPromoLoading(true);
    setPromoError('');
    setGuestPromoInfo(null);

    // Guest: validate promo code via public endpoint (no auth required)
    if (!user) {
      try {
        const res = await api.post(API.public.promo.validate, { code: promoCodeToUse });
        const data = res.data.data;
        if (data.valid) {
          setGuestPromoInfo(data);
          setPromoError('');
          setPromoCodeCtx(promoCodeToUse);
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

    // Logged in: apply promo code to server-side cart
    try {
      await api.post(API.cart.promo.apply, { code: promoCodeToUse });
      setPromoCodeCtx(promoCodeToUse);
      await refreshCart();
      setPromoAppliedCtx(true);
      setPromoDiscount(totals.discount || 0);
      setPromoError('');
    } catch (err: any) {
      const msg = err?.response?.status === 401
        ? 'Your session expired. Please log in again to continue.'
        : err?.response?.data?.error || 'Invalid promo code';
      setPromoError(msg);
      setPromoCodeCtx('');
    } finally {
      setPromoLoading(false);
    }
  };

  const removePromoCode = async () => {
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
  };

  // PawRewards redemption handler
  const handlePawRewardsRedemption = async (amount: number) => {
    if (!user || amount < 0) return;
    
    // Validate minimum redemption
    if (amount > 0 && amount < 2) {
      setError('Minimum PawRewards redemption is $2');
      return;
    }
    
    // Validate maximum redemption (can't exceed order total)
    const maxRedemption = itemsSubtotal + shippingCost + taxAmount - discountAmount;
    if (amount > maxRedemption) {
      setError(`Cannot redeem more than order total ($${maxRedemption.toFixed(2)})`);
      return;
    }
    
    setPawRewardsLoading(true);
    try {
      // If redeeming, validate with server
      if (amount > 0) {
        await api.post('/customer/guardian/rewards/redeem', { amount });
      }
      setPawRewardsRedemption(amount);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to redeem PawRewards');
    } finally {
      setPawRewardsLoading(false);
    }
  };

  // Address handler
  const handleAddressSelect = (address: AddressComponents) => {
    setForm((prev: typeof form) => ({
      ...prev,
      line1: address.line1, line2: address.line2 || '',
      city: address.city, state: address.state,
      zip: address.zip, country: address.country || 'NZ',
    }));
  };

  // Payment handler — uses PawTag checkout API
  const handlePayment = async () => {
    // Ref-based double-click protection
    if (paymentInProgressRef.current) return;
    paymentInProgressRef.current = true;

    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // 0. Auto-save any unsaved engraving texts before payment
      await saveAllEngraving();

      // 1. Verify cart has items from server (not stale React state)
      const cartCheck = await api.get(API.cart.get);
      const serverItems = cartCheck.data?.data?.cart?.items || [];
      if (serverItems.length === 0) {
        setError('Your cart is empty. Please go back and add items before checking out.');
        setLoading(false);
        return;
      }

      // 1. Create payment intent via PawTag checkout API
      const checkoutRes = await api.post(API.checkout.paymentIntent, {
        shippingAddress: {
          line1: form.line1,
          line2: form.line2,
          city: form.city,
          state: form.state,
          zip: form.zip,
          country: (form.country || 'NZ').toUpperCase(),
        },
        autoRenew: editableAutoRenewMap,
        pawRewardsRedemption: pawRewardsRedemption || 0,
      });
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
      
      // Track checkout start
      analytics.trackCheckoutStart(
        orderTotal,
        items.length
      );
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('[Checkout] Payment intent creation failed:', err?.response?.data || err);
      const msg = err?.response?.status === 401
        ? 'Your session expired. Please log in again to continue.'
        : 'Payment setup failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
      paymentInProgressRef.current = false;
    }
  };

  // Called by StripePaymentForm after Stripe confirms payment client-side
  const handlePaymentSuccess = async (paymentIntentId: string) => {
    setLoading(true);
    setError(null);
    try {
      // Payment confirmed by Stripe — go to Review step
      // Order will be created when user clicks "Place Order" on Review step
      setPaymentClientSecret(paymentIntentId); // Store for reference
      setCurrentStep('review');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('[Checkout] Payment success handler failed:', err);
      setError('Something went wrong during payment processing. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle final order confirmation from Review step
  const handleConfirmOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const paymentIntentId = sessionStorage.getItem('pawtag_checkout_payment_intent');
      if (!paymentIntentId) {
        throw new Error('No payment session found. Please start checkout again.');
      }

      // 1. Confirm checkout via PawTag API (creates Order + Invoice + sends emails)
      let pawtagOrder = null;
      let invoice = null;
      let invoiceUrl = '';
      try {
        const confirmRes = await api.post(API.checkout.confirm, { paymentIntentId, portal: 'customer-web' });
        pawtagOrder = confirmRes.data.data.order;
        invoice = confirmRes.data.data.invoice;
        invoiceUrl = confirmRes.data.data.invoiceUrl;
      } catch (confirmErr: any) {
        console.error('[Checkout] Order confirmation failed:', confirmErr?.response?.data || confirmErr);

        // Recovery: Check if order was actually created despite the error
        try {
          const recoveryRes = await api.get(API.checkout.pending);
          const recoveryPending = recoveryRes.data?.data;
          if (recoveryPending && recoveryPending.status === 'converted' && recoveryPending.convertedOrderId) {
            pawtagOrder = { orderNumber: recoveryPending.orderNumber };
            invoice = recoveryPending.invoice || null;
          } else {
            setError('Your payment was received but we could not confirm your order. Please check your order history or contact support.');
            setLoading(false);
            return;
          }
        } catch {
          setError('Something went wrong confirming your order. Your payment was received — please contact support.');
          setLoading(false);
          return;
        }
      }

      // 2. Show confirmation
      setConfirmedItems([...items]);
      setConfirmedTotal(total);
      setConfirmedInvoice(invoice);
      setConfirmedPawTagOrder(pawtagOrder);
      setOrderNumber(pawtagOrder?.orderNumber || paymentIntentId.slice(-8));

      setSuccess(true);
      setCurrentStep('confirmed');
      
      analytics.trackCheckoutComplete(
        total,
        pawtagOrder?.orderNumber || paymentIntentId.slice(-8)
      );
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
      sessionStorage.setItem('pawtag_checkout_success', 'true');
      sessionStorage.setItem('pawtag_checkout_order', pawtagOrder?.orderNumber || paymentIntentId.slice(-8));
      clearCart();
    } catch (err: any) {
      console.error('[Checkout] Order confirmation failed:', err);
      setError('Something went wrong during order confirmation. Please try again.');
      await refreshCart();
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentError = (message: string) => {
    setError(message);
  };

  // Empty cart — redirect to cart page
  if (items.length === 0 && !success && !loading && currentStep === 'checkout') {
    navigate('/cart');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{confirmationStyles}</style>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Step Indicator */}
        <CheckoutStepIndicator currentStep={currentStep} onStepClick={goToStep} />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between mb-6">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-medium">Dismiss</button>
          </div>
        )}

        {/* Step 1: Checkout (Verification + Address) — 70/30 layout */}
        {currentStep === 'checkout' && (
          <div className="max-w-[1280px] mx-auto">
            <div className="flex items-center justify-between mb-6">
              <Link to="/cart" className="inline-flex items-center gap-2 text-gray-500 hover:text-primary-600 text-sm"><ArrowLeft className="h-4 w-4" /> Back to Cart</Link>
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
                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
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
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Truck className="h-5 w-5 text-primary-600" /> Shipping Address</h2>
                    {addressMode === 'saved' && (
                      <button onClick={() => { setAddressMode('custom'); }} className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
                        <Edit3 className="h-3 w-3" /> Add New
                      </button>
                    )}
                  </div>

                  {addressMode === 'saved' && savedAddresses.length > 0 ? (
                    <div className="space-y-3">
                      {savedAddresses.map((addr) => (
                        <div
                          key={addr._id}
                          onClick={() => {
                            setSelectedAddressId(addr._id || '');
                            setForm({
                              label: addr.label || '',
                              line1: addr.line1 || '',
                              line2: addr.line2 || '',
                              city: addr.city || '',
                              state: addr.state || '',
                              zip: addr.zip || '',
                              country: addr.country || 'NZ',
                            });
                          }}
                          className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            selectedAddressId === addr._id
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{addr.label}</span>
                              {addr.isDefault && <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">Preferred</span>}
                            </div>
                            <input
                              type="radio"
                              name="saved-address"
                              checked={selectedAddressId === addr._id}
                              onChange={() => {
                                setSelectedAddressId(addr._id || '');
                                setForm({
                                  label: addr.label || '',
                                  line1: addr.line1 || '',
                                  line2: addr.line2 || '',
                                  city: addr.city || '',
                                  state: addr.state || '',
                                  zip: addr.zip || '',
                                  country: addr.country || 'NZ',
                                });
                              }}
                              className="w-4 h-4 text-primary-600"
                            />
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{form.line1}{form.line2 ? `, ${form.line2}` : ''}</p>
                          <p className="text-sm text-gray-600">{addr.city} {addr.zip}</p>
                        </div>
                      ))}
                    </div>
                  ) : addressMode === 'saved' && savedAddresses.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500 mb-3">No saved addresses yet.</p>
                      <button onClick={() => setAddressMode('custom')} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                        Add your first address
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address Label *</label>
                        <input type="text" value={form.label || ''} onChange={e => setForm({ ...form, label: e.target.value } as any)} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 text-sm" placeholder="e.g., Home, Office" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
                        <AddressAutocomplete value={form.line1} onChange={(val: string) => setForm((prev: typeof form) => ({ ...prev, line1: val }))} onAddressSelect={handleAddressSelect} placeholder="123 Main Street" />
                      </div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label><input type="text" value={form.line2} onChange={e => setForm({ ...form, line2: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 text-sm" placeholder="Apartment, suite, etc." /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">City *</label><input type="text" required value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 text-sm" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Postcode *</label><input type="text" required value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 text-sm" /></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="saveAddress" className="w-4 h-4 text-primary-600 rounded" />
                        <label htmlFor="saveAddress" className="text-sm text-gray-700">Save this address to my account</label>
                      </div>
                      {savedAddresses.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const defaultAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
                            if (defaultAddr) {
                              setSelectedAddressId(defaultAddr._id || '');
                              setForm({
                                label: defaultAddr.label || '',
                                line1: defaultAddr.line1 || '',
                                line2: defaultAddr.line2 || '',
                                city: defaultAddr.city || '',
                                state: defaultAddr.state || '',
                                zip: defaultAddr.zip || '',
                                country: defaultAddr.country || 'NZ',
                              });
                              setAddressMode('saved');
                            }
                          }}
                          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          Use a saved address
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
                                  {option.description && (
                                    <p className="text-xs text-gray-500">{option.description}</p>
                                  )}
                                </div>
                              </div>
                              <span className={`text-sm font-semibold ${(option.cost || 0) === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                                {(option.cost || 0) === 0 ? 'FREE' : `$${(option.cost || 0).toFixed(2)}`}
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No shipping options available for this address.</p>
                      )}
                    </div>
                  )}

                  <button onClick={() => goToStep('review')} disabled={!canProceedToReview || loading} className="w-full mt-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                    Review Order <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review & Pay — 70/30 layout */}
        {currentStep === 'payment' && (
          <div className="max-w-[1280px] mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Review & Pay</h1>
            <p className="text-gray-500 mb-6">Review your order and complete payment</p>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left 67%: Order Summary */}
              <div className="lg:col-span-8 space-y-4">
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
                  <Link to="/cart" className="text-sm text-primary-600 hover:text-primary-700 mb-4 inline-block">Edit Cart</Link>
                  {items.map((item) => (
                    <div key={item.productId || item.variantId} className="flex gap-3 mb-4 pb-4 border-b border-gray-100 last:border-0">
                      <div className="h-14 w-14 bg-primary-50 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <PawPrint className="h-6 w-6 text-primary-300" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.productName || item.name}</p>
                        {item.customisationTexts && item.customisationTexts.length > 0 && item.customisationTexts.some(t => t) && (
                          <div className="text-xs text-primary-600">
                            {item.customisationTexts.filter(t => t).map((t, i) => (
                              <p key={i}>Pet name: {t}</p>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-semibold text-gray-900">${(item.unitPrice || item.price || 0).toFixed(2)}</p>
                    </div>
                  ))}
                  <div className="space-y-2 pt-4">
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Subtotal</span><span className="text-gray-900">${itemsSubtotal.toFixed(2)}</span></div>
                    {discountAmount > 0 && <div className="flex justify-between text-sm"><span className="text-green-600">Discount</span><span className="text-green-600">-${discountAmount.toFixed(2)}</span></div>}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Shipping{selectedShippingOption ? ` — ${shippingOptions.find(o => o.id === selectedShippingOption)?.name || ''}` : ''}</span>
                      <span className={`font-medium ${shippingCost === 0 ? 'text-green-600' : 'text-gray-900'}`}>{shippingCost === 0 ? 'FREE' : `$${shippingCost.toFixed(2)}`}</span>
                    </div>
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Tax (Included)</span><span className="text-gray-900">${taxAmount.toFixed(2)}</span></div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-100"><span>Estimated Total</span><span className="text-primary-700">${orderTotal.toFixed(2)}</span></div>
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

              {/* Right 33%: Payment Method */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-white rounded-xl border border-gray-200 p-6">
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

                {/* Guardian/Gold membership CTA — context-aware */}
                {isGoldMember ? (
                  /* Already Gold — show status */
                  <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <Crown className="h-5 w-5 text-amber-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-800">
                          <strong>You're earning 2× Gold Points on this order!</strong>
                        </p>
                        <p className="text-xs text-amber-600 mt-0.5">
                          Thank you for being a Gold member.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : guardianTier ? (
                  /* Guardian member — upsell Gold */
                  <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <Crown className="h-5 w-5 text-amber-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-800">
                          <strong>{checkoutUpsellText}.</strong>
                        </p>
                        <p className="text-xs text-amber-600 mt-0.5">
                          Just ${goldPrice}/month — less than a coffee. Upgrade anytime.
                        </p>
                      </div>
                      <Link to="/gold" className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors whitespace-nowrap">
                        Go Gold
                      </Link>
                    </div>
                  </div>
                ) : (
                  /* Not a Guardian member — promote free Guardian */
                  <div className="bg-gradient-to-r from-primary-50 to-amber-50 border border-primary-100 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-primary-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-primary-800">
                          <strong>Earn rewards on this order.</strong>
                        </p>
                        <p className="text-xs text-primary-600 mt-0.5">
                          Guardian members earn points on every purchase. Join free today.
                        </p>
                      </div>
                      <Link to="/guardian" className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 transition-colors whitespace-nowrap">
                        Join Free
                      </Link>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-400 text-center">By placing this order, you agree to our <Link to="/terms" className="underline">Terms of Service</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.</p>
                <p className="text-xs text-gray-400 text-center">Powered by Stripe</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Review — Fully editable summary before payment */}
        {currentStep === 'review' && (
          <div className="max-w-[1280px] mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Review Your Order</h1>
            <p className="text-gray-500 mb-6">Review and edit all details before continuing to payment</p>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left 67%: Editable Order Summary */}
              <div className="lg:col-span-8 space-y-4">
                {/* Items - Editable (quantity controls, remove) */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Items ({items.length})</h2>
                    <Link to="/cart" className="text-sm text-primary-600 hover:text-primary-700">Edit Cart</Link>
                  </div>
                  {items.map((item) => {
                    const itemId = item._id || item.productId || '';
                    return (
                      <div key={itemId} className="flex gap-3 mb-4 pb-4 border-b border-gray-100 last:border-0">
                        <div className="h-14 w-14 bg-primary-50 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                          {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <PawPrint className="h-6 w-6 text-primary-300" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">{item.productName || item.name}</p>
                          {item.customisationTexts && item.customisationTexts.length > 0 && item.customisationTexts.some(t => t) && (
                            <div className="text-xs text-primary-600 mt-1">
                              {item.customisationTexts.filter(t => t).map((t, i) => (
                                <p key={i}>Pet name: {t}</p>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center gap-1 border border-gray-200 rounded-lg">
                              <button onClick={() => updateQuantity(itemId, Math.max(1, (item.quantity || 1) - 1))} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-50 rounded-l-lg">-</button>
                              <span className="w-8 text-center text-sm font-medium">{item.quantity || 1}</span>
                              <button onClick={() => updateQuantity(itemId, (item.quantity || 1) + 1)} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-50 rounded-r-lg">+</button>
                            </div>
                            <button onClick={() => removeItem(itemId)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                          </div>
                        </div>
                        <p className="font-semibold text-gray-900">${((item.unitPrice || item.price || 0) * (item.quantity || 1)).toFixed(2)}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Promo Code - Editable */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Promo Code</h3>
                  <PromoCodeControl
                    promoCode={promoCode || undefined}
                    promoApplied={promoApplied}
                    promoError={promoError}
                    onApply={user ? applyPromoCode : undefined}
                    onRemove={user ? removePromoCode : undefined}
                    loading={promoLoading}
                  />
                </div>

                {/* Shipping Method - Editable */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Shipping Method</h3>
                  <ShippingMethodSelect
                    options={shippingOptions}
                    selected={selectedShippingOption}
                    onSelect={(option) => setSelectedShippingOption(option.id)}
                    loading={shippingLoading}
                  />
                </div>

                {/* Shipping Address - Editable */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Shipping Address</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <AddressAutocomplete
                        value={form.line1}
                        onAddressSelect={handleAddressSelect}
                         onChange={(val: string) => setForm((prev: typeof form) => ({ ...prev, line1: val }))}
                        placeholder="Start typing your address..."
                        className="w-full"
                      />
                    </div>
                    {form.line1 && (
                      <>
                         <input type="text" value={form.line2 || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((prev: typeof form) => ({ ...prev, line2: e.target.value }))} placeholder="Apartment, suite, etc. (optional)" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                        <div className="grid grid-cols-2 gap-3">
                           <input type="text" value={form.city} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((prev: typeof form) => ({ ...prev, city: e.target.value }))} placeholder="City" className="px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                           <input type="text" value={form.zip} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((prev: typeof form) => ({ ...prev, zip: e.target.value }))} placeholder="Postcode" className="px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Auto-Renew - Editable Toggle */}
                {items.some((item: any) => item.isSubscription || item.autoRenew) && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Subscription Auto-Renew</h3>
                    {items.filter((item: any) => item.isSubscription || item.autoRenew).map((item: any) => {
                      const key = item._id || item.productId;
                      const isOn = editableAutoRenewMap[key] !== false;
                      return (
                        <AutoRenewToggle
                          key={key}
                          enabled={isOn}
                          onChange={(enabled) => {
                            const newMap = { ...editableAutoRenewMap, [key]: enabled };
                            setEditableAutoRenewMap(newMap);
                          }}
                          productName={item.productName || item.name}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Guardian Points - Read-only (derived) */}
                <GuardianPointsPreview
                  points={pointsEarning?.points || 0}
                  isGoldMember={pointsEarning?.isGoldMember}
                  tier={guardianTier}
                  pointsToNextTier={pointsToNextTier}
                  nextTierName={nextTierName}
                />

                {/* Price Breakdown - Read-only (calculated) */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Order Total</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Subtotal</span><span className="text-gray-900">${itemsSubtotal.toFixed(2)}</span></div>
                    {discountAmount > 0 && <div className="flex justify-between text-sm"><span className="text-green-600">Discount</span><span className="text-green-600">-${discountAmount.toFixed(2)}</span></div>}
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Shipping</span><span className={`font-medium ${shippingCost === 0 ? 'text-green-600' : 'text-gray-900'}`}>{shippingCost === 0 ? 'FREE' : `$${shippingCost.toFixed(2)}`}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Tax (Included)</span><span className="text-gray-900">${taxAmount.toFixed(2)}</span></div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-100"><span>Estimated Total</span><span className="text-primary-700">${orderTotal.toFixed(2)}</span></div>
                  </div>
                </div>
              </div>

              {/* Right 33%: Continue to Payment */}
              <div className="lg:col-span-4">
                <div className="lg:sticky lg:top-24 lg:self-start">
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Continue to Payment</h2>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                        <span>All details verified</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Lock className="h-4 w-4 text-gray-400" />
                        <span>Secure checkout</span>
                      </div>
                    </div>

                    <button
                      onClick={handlePayment}
                      disabled={loading || !canProceedToPayment}
                      className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors disabled:opacity-50"
                    >
                      {loading ? (
                        <><Loader2 size={16} className="animate-spin" /> Setting up payment...</>
                      ) : (
                        <>Continue to Payment <ChevronRight size={16} /></>
                      )}
                    </button>

                    <p className="text-xs text-gray-400 text-center mt-3">By continuing, you agree to our <Link to="/terms" className="underline">Terms of Service</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Confirmed */}
        {currentStep === 'confirmed' && (
          <CheckoutConfirmationStep
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
    </div>
  );
}
