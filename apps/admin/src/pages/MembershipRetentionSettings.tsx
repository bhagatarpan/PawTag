import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Settings, Percent, DollarSign, Calendar, Hash } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';
import PageHeader from '../components/PageHeader';

interface RetentionSettings {
  discountPercent: number;
  maxDiscountAmount: number;
  usageLimit: number;
  perUserLimit: number;
  expiryDays: number;
}

const DEFAULT_SETTINGS: RetentionSettings = {
  discountPercent: 15,
  maxDiscountAmount: 50,
  usageLimit: 1,
  perUserLimit: 1,
  expiryDays: 90,
};

export default function MembershipRetentionSettings() {
  const [settings, setSettings] = useState<RetentionSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await api.get(API.admin.membership.retentionSettings);
      setSettings({ ...DEFAULT_SETTINGS, ...res.data.data });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.put(API.admin.membership.retentionSettings, settings);
      setSuccess('Retention settings saved successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="h-64 bg-gray-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Settings size={20} className="text-primary-600" />}
        title="Retention Settings"
        subtitle="Configure the retention offer given to members when they cancel"
        actions={
          <>
            <Link
              to="/membership"
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back to Membership
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </>
        }
      />

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Retention Discount Settings */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Retention Discount</h2>
        <p className="text-sm text-gray-500 mb-6">
          When a member cancels, a one-time promo code is generated with the configured discount.
          The code is sent via email and appears in their cancellation confirmation.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Percent size={14} className="text-gray-400" />
              Discount Percentage
            </label>
            <div className="relative">
              <input
                type="number"
                value={settings.discountPercent}
                onChange={(e) => setSettings({ ...settings, discountPercent: Number(e.target.value) })}
                min={0}
                max={100}
                className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <span className="absolute right-3 top-2.5 text-gray-400 text-sm">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Discount applied to next purchase (0–100)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <DollarSign size={14} className="text-gray-400" />
              Maximum Discount Amount
            </label>
            <div className="relative">
              <input
                type="number"
                value={settings.maxDiscountAmount}
                onChange={(e) => setSettings({ ...settings, maxDiscountAmount: Number(e.target.value) })}
                min={0}
                className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <span className="absolute right-3 top-2.5 text-gray-400 text-sm">NZD</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Maximum discount cap in dollars</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Hash size={14} className="text-gray-400" />
              Usage Limit per Code
            </label>
            <input
              type="number"
              value={settings.usageLimit}
              onChange={(e) => setSettings({ ...settings, usageLimit: Number(e.target.value) })}
              min={1}
              max={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Total times the code can be used (1–10)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Hash size={14} className="text-gray-400" />
              Usage Limit per User
            </label>
            <input
              type="number"
              value={settings.perUserLimit}
              onChange={(e) => setSettings({ ...settings, perUserLimit: Number(e.target.value) })}
              min={1}
              max={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Times each customer can use the code (1–10)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Calendar size={14} className="text-gray-400" />
              Code Expiry (days)
            </label>
            <input
              type="number"
              value={settings.expiryDays}
              onChange={(e) => setSettings({ ...settings, expiryDays: Number(e.target.value) })}
              min={1}
              max={365}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Days until the promo code expires (1–365)</p>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Preview</h2>
        <p className="text-sm text-gray-500 mb-4">This is what the customer will see in their cancellation email:</p>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-700">
            As a thank you, you'll receive a one-time{' '}
            <strong>{settings.discountPercent}% discount code</strong>
            {settings.maxDiscountAmount > 0 && <> (up to ${settings.maxDiscountAmount} off)</>}
            {' '}for your next purchase.
            {settings.expiryDays > 0 && <> Valid for {settings.expiryDays} days.</>}
          </p>
        </div>
      </div>
    </div>
  );
}
