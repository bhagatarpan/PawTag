/**
 * @module Shipping Rates Page
 * @description Admin page for managing shipping rate rules.
 *
 * Rates define the pricing rules for shipping methods:
 * - Free shipping threshold
 * - Flat rate costs
 * - Weight-based pricing
 * - Price-based pricing
 *
 * These are global settings configured via CMS, not per-method.
 * Individual shipping methods use these rules.
 */

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Save, DollarSign, Percent, Weight, Tag } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface CommerceSetting {
  key: string;
  value: string;
  default: string;
  description: string;
}

const RATE_RULES = [
  { key: 'commerce.shipping.freeEnabled', label: 'Enable Free Shipping', type: 'toggle', description: 'Offer free shipping on all orders' },
  { key: 'commerce.shipping.freeThreshold', label: 'Free Shipping Threshold ($)', type: 'number', description: 'Minimum order amount for free shipping (0 = always free)' },
  { key: 'commerce.shipping.flatRate', label: 'Flat Rate Cost ($)', type: 'number', description: 'Flat rate shipping cost (0 = free)' },
  { key: 'commerce.shipping.taxEnabled', label: 'Apply Tax to Shipping', type: 'toggle', description: 'Include shipping in tax calculation' },
  { key: 'commerce.shipping.enabled', label: 'Shipping Enabled', type: 'toggle', description: 'Enable/disable shipping calculation' },
];

export default function ShippingRates() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/commerce/settings');
      const all: CommerceSetting[] = res.data?.data || [];
      const map: Record<string, string> = {};
      for (const s of all) {
        if (s.key.startsWith('commerce.shipping.')) {
          map[s.key] = s.value;
        }
      }
      setSettings(map);
    } catch { toast.error('Failed to load shipping settings'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/admin/commerce/settings', { settings });
      toast.success('Shipping rates saved');
      fetchSettings();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shipping Rates</h1>
          <p className="text-sm text-gray-500 mt-1">Configure shipping pricing rules</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 disabled:opacity-50 transition-all">
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          Save Changes
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-teal-500" size={24} /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <DollarSign size={20} className="text-teal-600" />
              <h2 className="font-semibold text-gray-900">Rate Rules</h2>
            </div>
            <p className="text-sm text-gray-500 mt-1">Define how shipping costs are calculated</p>
          </div>
          <div className="divide-y divide-gray-100">
            {RATE_RULES.map((rule) => (
              <div key={rule.key} className="px-6 py-4 flex items-center justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <label className="text-sm font-medium text-gray-700 block">{rule.label}</label>
                  <p className="text-xs text-gray-400 mt-0.5">{rule.description}</p>
                </div>
                <div className="flex-shrink-0">
                  {rule.type === 'toggle' ? (
                    <select value={settings[rule.key] ?? 'true'} onChange={(e) => setSettings({ ...settings, [rule.key]: e.target.value })}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  ) : (
                    <input type="number" step="0.01" min="0"
                      value={settings[rule.key] ?? '0'}
                      onChange={(e) => setSettings({ ...settings, [rule.key]: e.target.value })}
                      className="w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview Card */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Rate Preview</h3>
        <div className="text-sm text-gray-600 space-y-2">
          {settings['commerce.shipping.freeEnabled'] === 'true' && (
            <p>✓ Free shipping is {settings['commerce.shipping.freeThreshold'] === '0' ? 'always enabled' : `enabled for orders over $${settings['commerce.shipping.freeThreshold']}`}</p>
          )}
          {settings['commerce.shipping.flatRate'] !== '0' && settings['commerce.shipping.freeEnabled'] !== 'true' && (
            <p>✓ Flat rate shipping: ${settings['commerce.shipping.flatRate']}</p>
          )}
          {settings['commerce.shipping.taxEnabled'] === 'true' && (
            <p>✓ Shipping costs include tax</p>
          )}
        </div>
      </div>
    </div>
  );
}
