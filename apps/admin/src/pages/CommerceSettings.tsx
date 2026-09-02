/**
 * @module CommerceSettings Page
 * @description Enterprise admin page for managing all PawTag Commerce settings.
 */

import { useEffect, useState, useCallback } from 'react';
import { Save, Loader2, RefreshCcw, CreditCard, Truck, Receipt, Package, ShoppingCart, Clock, RotateCcw, Settings, Shield, Bell, Info, Plus, Trash2, Ban, X, Database, Link2, Unlink } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface CommerceSetting {
  key: string;
  value: string;
  default: string;
  description: string;
}

interface SettingGroup {
  name: string;
  icon: React.ReactNode;
  description: string;
  category: string;
  settings: Array<CommerceSetting & { label: string; tooltip: string; type: 'toggle' | 'text' | 'number' | 'select'; options?: { value: string; label: string }[]; hint?: string }>;
}

/* Human-readable labels and tooltips for every setting */
const SETTING_META: Record<string, { label: string; tooltip: string; type: 'toggle' | 'text' | 'number' | 'select'; options?: { value: string; label: string }[]; hint?: string }> = {
  'commerce.payment.provider': { label: 'Payment Provider', tooltip: 'Which payment gateway processes your transactions', type: 'select', options: [{ value: 'stripe', label: 'Stripe' }] },
  'commerce.payment.currency': { label: 'Currency', tooltip: 'The currency all prices are displayed and charged in', type: 'text' },
  'commerce.payment.testMode': { label: 'Demo Mode', tooltip: 'When enabled, payments auto-succeed without contacting Stripe. Use this for testing checkout without real charges.', type: 'toggle', hint: 'Disable this before going live' },
  'commerce.shipping.enabled': { label: 'Enable Shipping', tooltip: 'Show shipping options and calculate shipping costs during checkout', type: 'toggle' },
  'commerce.shipping.provider': { label: 'Shipping Provider', tooltip: 'Which carrier integration calculates rates and creates labels', type: 'select', options: [{ value: 'nz-shipping', label: 'NZ Domestic Shipping' }] },
  'commerce.shipping.freeEnabled': { label: 'Offer Free Shipping', tooltip: 'Show a free shipping option to customers at checkout', type: 'toggle' },
  'commerce.shipping.freeThreshold': { label: 'Free Shipping Minimum Order ($)', tooltip: 'Minimum cart value for free shipping. Set to 0 to always offer free shipping.', type: 'number' },
  'commerce.shipping.flatRate': { label: 'Flat Rate Shipping Cost ($)', tooltip: 'Fixed shipping fee charged when free shipping does not apply', type: 'number' },
  'commerce.shipping.taxEnabled': { label: 'Apply Tax to Shipping', tooltip: 'Include shipping costs in GST calculation', type: 'toggle' },
  'commerce.shipping.defaultCarrier': { label: 'Default Carrier', tooltip: 'The carrier used when no specific carrier is selected for an order', type: 'text' },
  'commerce.shipping.rateTypes': { label: 'Available Rate Types', tooltip: 'Shipping calculation methods available (comma-separated)', type: 'text' },
  'commerce.shipping.carriers': { label: 'Available Carriers', tooltip: 'Shipping carriers available for selection (comma-separated)', type: 'text' },
  'commerce.shipping.nzpostClientId': { label: 'NZ Post Client ID', tooltip: 'OAuth client ID for NZ Post API. Leave empty to use demo mode with mock tracking numbers.', type: 'text' },
  'commerce.shipping.nzpostClientSecret': { label: 'NZ Post Client Secret', tooltip: 'OAuth client secret for NZ Post API', type: 'text' },
  'commerce.shipping.nzpostLive': { label: 'Use NZ Post Live API', tooltip: 'Use the production NZ Post API instead of the sandbox', type: 'toggle' },
  'commerce.tax.enabled': { label: 'Enable Tax Calculation', tooltip: 'Automatically calculate GST on orders', type: 'toggle' },
  'commerce.tax.provider': { label: 'Tax Provider', tooltip: 'Which tax engine calculates GST', type: 'select', options: [{ value: 'nz-gst', label: 'NZ GST (15%)' }] },
  'commerce.tax.rate': { label: 'Tax Rate (GST)', tooltip: 'New Zealand GST rate as a decimal (0.15 = 15%)', type: 'number', hint: 'Standard NZ GST is 15%' },
  'commerce.tax.label': { label: 'Tax Label', tooltip: 'How tax appears on receipts and invoices (e.g., "GST" or "Tax")', type: 'text' },
  'commerce.tax.inclusive': { label: 'Prices Include Tax', tooltip: 'When enabled, product prices shown to customers already include GST', type: 'toggle', hint: 'NZ standard is tax-inclusive pricing' },
  'commerce.inventory.enabled': { label: 'Enable Inventory Tracking', tooltip: 'Track stock quantities and prevent overselling', type: 'toggle' },
  'commerce.inventory.lowStockThreshold': { label: 'Low Stock Alert Level', tooltip: 'When stock drops below this number, admins receive a low-stock notification', type: 'number' },
  'commerce.inventory.outOfStockThreshold': { label: 'Out of Stock Level', tooltip: 'Stock level at which a product is considered sold out', type: 'number' },
  'commerce.inventory.defaultPolicy': { label: 'Out of Stock Behaviour', tooltip: 'What happens when a product has zero stock', type: 'select', options: [{ value: 'deny', label: 'Block checkout (prevent overselling)' }, { value: 'allow', label: 'Allow backorders (let customers order out-of-stock items)' }] },
  'commerce.inventory.reservationTtlMinutes': { label: 'Stock Reservation Hold (minutes)', tooltip: 'How long stock is reserved during checkout before being released', type: 'number' },
  'commerce.checkout.guestEnabled': { label: 'Allow Guest Checkout', tooltip: 'Let customers buy without creating an account', type: 'toggle' },
  'commerce.checkout.verificationRequired': { label: 'Require Identity Verification', tooltip: 'Customers must verify email and phone before payment', type: 'toggle' },
  'commerce.checkout.termsRequired': { label: 'Require Terms Acceptance', tooltip: 'Customers must accept terms and conditions before placing an order', type: 'toggle' },
  'commerce.checkout.pendingOrderTtlMinutes': { label: 'Pending Order Expiry (minutes)', tooltip: 'How long an unpaid order is held before being automatically cancelled', type: 'number' },
  'commerce.cart.ttlDays': { label: 'Cart Expiry (days)', tooltip: 'How long items stay in a customer\'s cart before being automatically removed', type: 'number', hint: 'Default 30 days' },
  'commerce.cart.priceRevalidation': { label: 'Re-validate Prices on Cart Load', tooltip: 'When a customer opens their cart, check if product prices have changed and update totals automatically', type: 'toggle', hint: 'Recommended for accuracy' },
  'commerce.cart.maxItems': { label: 'Maximum Cart Items', tooltip: 'Maximum number of unique products a customer can add to their cart', type: 'number', hint: 'Set to 50 by default' },
  'commerce.orders.autoCancelMinutes': { label: 'Auto-Cancel Unpaid Orders (minutes)', tooltip: 'Automatically cancel orders that remain unpaid after this duration', type: 'number' },
  'commerce.orders.numberPrefix': { label: 'Order Number Prefix', tooltip: 'The text prepended to every order number (e.g., "PT" produces "PT-000001")', type: 'text' },
  'commerce.orders.numberLength': { label: 'Order Number Length', tooltip: 'How many digits appear after the prefix in order numbers', type: 'number' },
  'commerce.subscriptions.annualPrice': { label: 'Annual Subscription Price ($)', tooltip: 'Price charged per year for subscription products', type: 'number' },
  'commerce.subscriptions.monthlyPrice': { label: 'Monthly Subscription Price ($)', tooltip: 'Price charged per month for subscription products', type: 'number' },
  'commerce.subscriptions.freePeriodMonths': { label: 'Free Period (months)', tooltip: 'Number of months of free subscription included with tag purchase', type: 'number' },
  'commerce.subscriptions.gracePeriodWeeks': { label: 'Grace Period (weeks)', tooltip: 'Weeks allowed after subscription expires before losing access', type: 'number' },
  'commerce.refunds.enabled': { label: 'Allow Refunds', tooltip: 'Enable customers to request refunds on their orders', type: 'toggle' },
  'commerce.refunds.maxDaysAfterPurchase': { label: 'Refund Window (days)', tooltip: 'Maximum number of days after purchase when a refund can be requested', type: 'number' },
  'commerce.refunds.partialEnabled': { label: 'Allow Partial Refunds', tooltip: 'Let admins refund part of an order instead of the full amount', type: 'toggle' },
  'commerce.notifications.orderConfirmation': { label: 'Send Order Confirmation Email', tooltip: 'Email the customer when their order is placed', type: 'toggle' },
  'commerce.notifications.invoiceEmail': { label: 'Send Invoice Email', tooltip: 'Attach and send the invoice with the order confirmation', type: 'toggle' },
  'commerce.notifications.adminAlert': { label: 'Notify Admin on New Order', tooltip: 'Send an email to the admin team when a new order is placed', type: 'toggle' },
  'commerce.notifications.shippingUpdate': { label: 'Send Shipping Updates', tooltip: 'Email the customer when their order ships', type: 'toggle' },
  'commerce.feature.stripeSignatureVerification': { label: 'Verify Stripe Webhook Signatures', tooltip: 'Validate that incoming Stripe webhooks are genuine (recommended for production)', type: 'toggle' },
  'commerce.feature.orphanPaymentDetection': { label: 'Detect Orphan Payments', tooltip: 'Automatically recover orders where payment succeeded but order creation failed', type: 'toggle' },
  'commerce.feature.priceValidation': { label: 'Server-Side Price Validation', tooltip: 'Verify product prices on the server during checkout (prevents price tampering)', type: 'toggle' },
  'commerce.promotions.enabled': { label: 'Enable Discount Codes', tooltip: 'Allow customers to apply promo codes at checkout for discounts', type: 'toggle' },
  'commerce.promotions.maxUsesPerCode': { label: 'Max Uses Per Discount Code', tooltip: 'Maximum number of times a single discount code can be used across all customers', type: 'number' },
  'commerce.promotions.bundle2Items': { label: 'Bundle Discount — 2 Items (%)', tooltip: 'Automatic percentage discount when a customer buys exactly 2 items', type: 'number' },
  'commerce.promotions.bundle3PlusItems': { label: 'Bundle Discount — 3+ Items (%)', tooltip: 'Automatic percentage discount when a customer buys 3 or more items', type: 'number' },
};

function getSettingMeta(key: string) {
  return SETTING_META[key] || {
    label: key.split('.').pop() || key,
    tooltip: '',
    type: 'text' as const,
  };
}

function parseSettings(all: CommerceSetting[]): SettingGroup[] {
  const groupDefs: Array<{ name: string; icon: React.ReactNode; description: string; category: string }> = [
    { name: 'Payment', icon: <CreditCard size={20} />, description: 'How customers pay and how you receive money', category: 'payment' },
    { name: 'Shipping', icon: <Truck size={20} />, description: 'How orders are shipped and what it costs', category: 'shipping' },
    { name: 'Tax', icon: <Receipt size={20} />, description: 'GST calculation and display', category: 'tax' },
    { name: 'Inventory', icon: <Package size={20} />, description: 'Stock levels and availability rules', category: 'inventory' },
    { name: 'Cart', icon: <ShoppingCart size={20} />, description: 'Shopping cart behaviour, expiry, and limits', category: 'cart' },
    { name: 'Checkout', icon: <ShoppingCart size={20} />, description: 'What happens during the checkout process', category: 'checkout' },
    { name: 'Orders', icon: <RotateCcw size={20} />, description: 'How orders are numbered and managed', category: 'orders' },
    { name: 'Subscriptions', icon: <Clock size={20} />, description: 'Subscription pricing and billing cycles', category: 'subscriptions' },
    { name: 'Refunds', icon: <RotateCcw size={20} />, description: 'Refund rules and policies', category: 'refunds' },
    { name: 'Notifications', icon: <Bell size={20} />, description: 'Email notifications sent to customers and admins', category: 'notifications' },
    { name: 'Feature Flags', icon: <Shield size={20} />, description: 'Toggle advanced commerce features on or off', category: 'feature' },
  ];

  const groups: SettingGroup[] = groupDefs.map((g) => ({ ...g, settings: [] }));

  for (const setting of all) {
    const category = setting.key.split('.')[1];
    const group = groups.find((g) => g.category === category);
    const meta = getSettingMeta(setting.key);
    const entry = { ...setting, ...meta };
    if (group) {
      group.settings.push(entry);
    } else {
      groups[0].settings.push(entry);
    }
  }

  return groups.filter((g) => g.settings.length > 0);
}

export default function CommerceSettings() {
  const [settings, setSettings] = useState<CommerceSetting[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [cancellationReasons, setCancellationReasons] = useState<string[]>([]);
  const [savingReasons, setSavingReasons] = useState(false);
  const [newReason, setNewReason] = useState('');
  const [xeroStatus, setXeroStatus] = useState<{ connected: boolean; tenantName?: string } | null>(null);
  const [xeroConnecting, setXeroConnecting] = useState(false);
  const [xeroDisconnecting, setXeroDisconnecting] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/commerce/settings');
      const data = res.data?.data || res.data;
      setSettings(data);
      setEditedValues(Object.fromEntries(data.map((s: CommerceSetting) => [s.key, s.value])));
      setHasChanges(false);
    } catch {
      toast.error('Failed to load commerce settings');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCancellationReasons = useCallback(async () => {
    try {
      const res = await api.get('/admin/commerce/cancellation-reasons');
      if (Array.isArray(res.data?.data)) {
        setCancellationReasons(res.data.data);
      }
    } catch {
      // non-critical
    }
  }, []);

  const saveCancellationReasons = async () => {
    setSavingReasons(true);
    try {
      const res = await api.put('/admin/commerce/cancellation-reasons', { reasons: cancellationReasons });
      if (Array.isArray(res.data?.data)) {
        setCancellationReasons(res.data.data);
      }
      toast.success('Cancellation reasons updated');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update cancellation reasons');
    } finally {
      setSavingReasons(false);
    }
  };

  const addReason = () => {
    const trimmed = newReason.trim();
    if (!trimmed) return;
    if (cancellationReasons.includes(trimmed)) {
      toast.error('This reason already exists');
      return;
    }
    setCancellationReasons((prev) => [...prev, trimmed]);
    setNewReason('');
  };

  const removeReason = (idx: number) => {
    setCancellationReasons((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveReason = (idx: number, dir: -1 | 1) => {
    setCancellationReasons((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  useEffect(() => { fetchSettings(); }, [fetchSettings]);
  useEffect(() => { fetchCancellationReasons(); }, [fetchCancellationReasons]);

  // Check for Xero connection status from URL params (after OAuth callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('xero') === 'connected') {
      toast.success('Xero connected successfully');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('xero') === 'error') {
      toast.error(params.get('message') || 'Xero connection failed');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchXeroStatus = useCallback(async () => {
    try {
      const res = await api.get('/admin/commerce/accounting/status');
      setXeroStatus(res.data.data.xero);
    } catch {
      setXeroStatus({ connected: false });
    }
  }, []);

  const handleConnectXero = async () => {
    setXeroConnecting(true);
    try {
      const res = await api.get('/admin/commerce/accounting/connect/xero');
      if (res.data.success && res.data.data.authUrl) {
        window.location.href = res.data.data.authUrl;
      } else {
        toast.error('Failed to get Xero authorisation URL');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to initiate Xero connection');
    } finally {
      setXeroConnecting(false);
    }
  };

  const handleDisconnectXero = async () => {
    if (!window.confirm('Disconnect Xero? You will need to reconnect to export refunds.')) return;
    setXeroDisconnecting(true);
    try {
      await api.delete('/admin/commerce/accounting/disconnect/xero');
      toast.success('Xero disconnected');
      fetchXeroStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to disconnect Xero');
    } finally {
      setXeroDisconnecting(false);
    }
  };

  useEffect(() => { fetchXeroStatus(); }, [fetchXeroStatus]);

  const handleChange = (key: string, value: string) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const changed: Record<string, string> = {};
      for (const [key, value] of Object.entries(editedValues)) {
        const original = settings.find((s) => s.key === key);
        if (original && original.value !== value) {
          changed[key] = value;
        }
      }
      if (Object.keys(changed).length === 0) {
        toast.info('No changes to save');
        return;
      }
      await api.put('/admin/commerce/settings', { settings: changed });
      toast.success(`Saved ${Object.keys(changed).length} setting(s)`);
      setHasChanges(false);
      fetchSettings();
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const groups = parseSettings(settings);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commerce Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure how your shop operates. Changes take effect immediately.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchSettings}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCcw size={16} />
            Refresh
          </button>
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Changes
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.name} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <span className="text-teal-600">{group.icon}</span>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{group.name}</h2>
                  <p className="text-sm text-gray-500">{group.description}</p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {group.settings.map((setting) => (
                <div key={setting.key} className="px-6 py-4 flex items-center justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <label className="text-sm font-medium text-gray-700">{setting.label}</label>
                      {setting.tooltip && (
                        <div className="group relative">
                          <Info size={14} className="text-gray-400 hover:text-gray-600 cursor-help" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                            {setting.tooltip}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{setting.description}</p>
                    {setting.hint && <p className="text-xs text-amber-600 mt-0.5">{setting.hint}</p>}
                  </div>
                  <div className="flex-shrink-0">
                    {setting.type === 'toggle' ? (
                      <select
                        value={editedValues[setting.key] ?? setting.value}
                        onChange={(e) => handleChange(setting.key, e.target.value)}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                    ) : setting.type === 'select' && setting.options ? (
                      <select
                        value={editedValues[setting.key] ?? setting.value}
                        onChange={(e) => handleChange(setting.key, e.target.value)}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      >
                        {setting.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={setting.type}
                        value={editedValues[setting.key] ?? setting.value}
                        onChange={(e) => handleChange(setting.key, e.target.value)}
                        step={setting.type === 'number' ? '0.01' : undefined}
                        className="w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-red-600"><Ban size={20} /></span>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Cancellation Reasons</h2>
                  <p className="text-sm text-gray-500">Manage the list of reasons customers and admins can select when cancelling an order.</p>
                </div>
              </div>
              <button
                onClick={saveCancellationReasons}
                disabled={savingReasons}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {savingReasons ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Reasons
              </button>
            </div>
          </div>
          <div className="p-6 space-y-3">
            {cancellationReasons.length === 0 && (
              <p className="text-sm text-gray-500">No reasons configured. Add a reason below.</p>
            )}
            {cancellationReasons.map((r, idx) => (
              <div key={`${r}-${idx}`} className="flex items-center gap-2">
                <span className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50">
                  {r}
                </span>
                <button
                  type="button"
                  onClick={() => moveReason(idx, -1)}
                  disabled={idx === 0}
                  className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveReason(idx, 1)}
                  disabled={idx === cancellationReasons.length - 1}
                  className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                  aria-label="Move down"
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => removeReason(idx)}
                  className="p-2 text-red-500 hover:text-red-700"
                  aria-label="Remove"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <input
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addReason(); } }}
                placeholder="Add a new reason"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              <button
                type="button"
                onClick={addReason}
                className="flex items-center gap-1 px-3 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
                disabled={!newReason.trim()}
              >
                <Plus size={14} />
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-primary-600"><Database size={20} /></span>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Accounting Integrations</h2>
                  <p className="text-sm text-gray-500">Connect to accounting software and export refunds for reconciliation.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${xeroStatus?.connected ? 'bg-green-100' : 'bg-gray-200'}`}>
                  {xeroStatus?.connected ? (
                    <span className="text-green-600 text-lg">✓</span>
                  ) : (
                    <Link2 size={18} className="text-gray-500" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">Xero</span>
                    {xeroStatus?.connected ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                        Not connected
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {xeroStatus?.connected
                      ? xeroStatus.tenantName || 'PawTag org connected'
                      : 'Push refunds as Manual Journals via OAuth 2.0'}
                  </div>
                </div>
              </div>
              <div>
                {xeroStatus?.connected ? (
                  <button
                    onClick={handleDisconnectXero}
                    disabled={xeroDisconnecting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
                  >
                    {xeroDisconnecting ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={handleConnectXero}
                    disabled={xeroConnecting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    {xeroConnecting ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                    Connect to Xero
                  </button>
                )}
              </div>
            </div>

            <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="font-medium text-blue-900 mb-1">Export options</p>
              <p>After connecting, you can push refunds directly to Xero from <a href="/refund-report" className="text-primary-600 hover:text-primary-700 underline font-medium">Refund Report</a>. CSV, GL, and configurable column exports are also available without Xero.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
