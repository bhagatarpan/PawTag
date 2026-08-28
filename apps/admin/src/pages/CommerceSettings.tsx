/**
 * @module CommerceSettings Page
 * @description Admin page for managing all PawTag Commerce settings.
 *
 * Provides a comprehensive settings interface for:
 * - Payment configuration (provider, test mode)
 * - Shipping configuration (free/flat-rate)
 * - Tax configuration (GST rate, inclusive/exclusive)
 * - Inventory settings (thresholds, policies)
 * - Checkout settings (guest, verification, expiry)
 * - Order settings (auto-cancel, number format)
 * - Subscription pricing (annual, monthly, free period, grace)
 * - Refund policy (enabled, max days, partial)
 * - Feature flags (signature verification, orphan detection)
 *
 * All settings are CMS-driven — changes take effect immediately.
 * No code changes required for business rule adjustments.
 *
 * @example
 * ```tsx
 * // Route: /commerce-settings
 * // Requires: setting.read, setting.update permissions
 * <CommerceSettings />
 * ```
 */

import { useEffect, useState, useCallback } from 'react';
import { Save, Loader2, RefreshCcw, CreditCard, Truck, Receipt, Package, ShoppingCart, Clock, RotateCcw, Settings, Shield, Bell } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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
  settings: CommerceSetting[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseSettings(all: CommerceSetting[]): SettingGroup[] {
  const groups: SettingGroup[] = [
    { name: 'Payment', icon: <CreditCard size={20} />, description: 'Payment provider and processing', settings: [] },
    { name: 'Shipping', icon: <Truck size={20} />, description: 'Shipping methods and rates', settings: [] },
    { name: 'Tax', icon: <Receipt size={20} />, description: 'GST and tax calculation', settings: [] },
    { name: 'Inventory', icon: <Package size={20} />, description: 'Stock management', settings: [] },
    { name: 'Checkout', icon: <ShoppingCart size={20} />, description: 'Checkout flow', settings: [] },
    { name: 'Orders', icon: <RotateCcw size={20} />, description: 'Order management', settings: [] },
    { name: 'Subscriptions', icon: <Clock size={20} />, description: 'Subscription pricing', settings: [] },
    { name: 'Refunds', icon: <RotateCcw size={20} />, description: 'Refund policy', settings: [] },
    { name: 'Notifications', icon: <Bell size={20} />, description: 'Email notifications', settings: [] },
    { name: 'Feature Flags', icon: <Shield size={20} />, description: 'Commerce features', settings: [] },
  ];

  for (const setting of all) {
    const category = setting.key.split('.')[1]; // e.g., 'payment' from 'commerce.payment.provider'
    const group = groups.find(g => g.name.toLowerCase() === category);
    if (group) {
      group.settings.push(setting);
    } else {
      // Fallback: add to first group
      groups[0].settings.push(setting);
    }
  }

  return groups.filter(g => g.settings.length > 0);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CommerceSettings() {
  const [settings, setSettings] = useState<CommerceSetting[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/commerce/settings');
      const data = res.data?.data || res.data;
      setSettings(data);
      setEditedValues(Object.fromEntries(data.map((s: CommerceSetting) => [s.key, s.value])));
      setHasChanges(false);
    } catch (err) {
      toast.error('Failed to load commerce settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleChange = (key: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // Only send changed settings
      const changed: Record<string, string> = {};
      for (const [key, value] of Object.entries(editedValues)) {
        const original = settings.find(s => s.key === key);
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
    } catch (err) {
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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commerce Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure payment, shipping, tax, inventory, and other commerce rules.
            Changes take effect immediately.
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

      {/* Settings Groups */}
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
                    <label className="text-sm font-medium text-gray-700 block">
                      {setting.key.replace('commerce.' + group.name.toLowerCase() + '.', '')}
                    </label>
                    <p className="text-xs text-gray-400 mt-0.5">{setting.description}</p>
                  </div>
                  <div className="flex-shrink-0">
                    {setting.key.includes('Enabled') || setting.key.includes('enabled') || setting.key.includes('Required') || setting.key.includes('required') || setting.key.includes('testMode') || setting.key.includes('Verification') ? (
                      <select
                        value={editedValues[setting.key] ?? setting.value}
                        onChange={(e) => handleChange(setting.key, e.target.value)}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                    ) : setting.key.includes('policy') || setting.key.includes('Policy') ? (
                      <select
                        value={editedValues[setting.key] ?? setting.value}
                        onChange={(e) => handleChange(setting.key, e.target.value)}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      >
                        <option value="deny">Deny checkout when out of stock</option>
                        <option value="allow">Allow backorders</option>
                      </select>
                    ) : (
                      <input
                        type={setting.key.includes('rate') || setting.key.includes('Price') || setting.key.includes('Threshold') || setting.key.includes('Minutes') || setting.key.includes('Days') || setting.key.includes('Months') || setting.key.includes('Weeks') || setting.key.includes('max') || setting.key.includes('Length') || setting.key.includes('perCode') ? 'number' : 'text'}
                        value={editedValues[setting.key] ?? setting.value}
                        onChange={(e) => handleChange(setting.key, e.target.value)}
                        step={setting.key.includes('rate') ? '0.01' : '1'}
                        min={setting.key.includes('rate') ? '0' : undefined}
                        max={setting.key.includes('rate') ? '1' : undefined}
                        className="w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
