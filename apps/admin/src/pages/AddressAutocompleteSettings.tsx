import { useEffect, useState } from 'react';
import { MapPin, Key, Globe, Info, Save, Loader2, CheckCircle, Shield } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface SettingsData {
  provider: string;
  nzpostClientId: string;
  nzpostClientSecret: string;
  defaultCountry: string;
}

export default function AddressAutocompleteSettings() {
  const [settings, setSettings] = useState<SettingsData>({
    provider: 'nzpost',
    nzpostClientId: '',
    nzpostClientSecret: '',
    defaultCountry: 'NZ',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingProvider, setTestingProvider] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      const settingsList = res.data.data || [];
      const map: Record<string, string> = {};
      for (const s of settingsList) {
        if (s.key.startsWith('addressAutocomplete.')) {
          map[s.key.replace('addressAutocomplete.', '')] = s.value;
        }
      }
      setSettings({
        provider: map.provider || 'nzpost',
        nzpostClientId: map.nzpostClientId || '',
        nzpostClientSecret: map.nzpostClientSecret || '',
        defaultCountry: map.defaultCountry || 'NZ',
      });
    } catch {
      toast.error('Failed to load address autocomplete settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const saveSetting = async (key: string, value: string) => {
    setSaving(true);
    try {
      await api.put(`/admin/settings/addressAutocomplete.${key}`, { value });
      // Invalidate backend cache
      await api.post('/address/invalidate-cache');
      toast.success('Setting updated');
    } catch {
      toast.error('Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  const handleProviderChange = async (provider: string) => {
    setSettings((s) => ({ ...s, provider }));
    await saveSetting('provider', provider);
  };

  const handleCredentialsSave = async () => {
    await saveSetting('nzpostClientId', settings.nzpostClientId);
    await saveSetting('nzpostClientSecret', settings.nzpostClientSecret);
  };

  const handleCountrySave = async () => {
    await saveSetting('defaultCountry', settings.defaultCountry);
  };

  const testProvider = async () => {
    setTestingProvider(true);
    try {
      const params = new URLSearchParams({ q: '1 Queen Street Auckland', limit: '1' });
      const res = await fetch(`/api/address/suggest?${params}`);
      const data = await res.json();
      if (data.success && data.addresses?.length > 0) {
        toast.success(`Test successful! Found: ${data.addresses[0].line1}, ${data.addresses[0].city}`);
      } else {
        toast.error('Test failed: No results returned');
      }
    } catch {
      toast.error('Test failed: Could not reach API');
    } finally {
      setTestingProvider(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-teal-100 rounded-lg">
            <MapPin className="w-6 h-6 text-teal-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Address Autocomplete</h1>
        </div>
        <p className="text-sm text-gray-500 ml-11">
          Configure how address autocomplete works across the platform.
        </p>
      </div>

      {/* Provider Selection */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Globe className="w-5 h-5 text-gray-400" />
            Address Provider
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Choose which service to use for address autocomplete suggestions.
          </p>
        </div>
        <div className="p-6 space-y-4">
          {/* NZ Post Option */}
          <label
            className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
              settings.provider === 'nzpost'
                ? 'border-teal-500 bg-teal-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <input
              type="radio"
              name="provider"
              value="nzpost"
              checked={settings.provider === 'nzpost'}
              onChange={() => handleProviderChange('nzpost')}
              className="mt-1 h-4 w-4 text-teal-600 focus:ring-teal-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">NZ Post API</span>
                <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">Default</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Recommended for NZ</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Authoritative New Zealand address data from NZ Post's National Postal Address Dataset (NPAD).
                Free for up to 1,000 lookups per month.
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  Most accurate for NZ
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  Free 1,000/month
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  NZ addresses only
                </span>
              </div>
            </div>
          </label>

          {/* Photon Option */}
          <label
            className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
              settings.provider === 'photon'
                ? 'border-teal-500 bg-teal-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <input
              type="radio"
              name="provider"
              value="photon"
              checked={settings.provider === 'photon'}
              onChange={() => handleProviderChange('photon')}
              className="mt-1 h-4 w-4 text-teal-600 focus:ring-teal-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">Photon API (OpenStreetMap)</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Global</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Free, open-source address data from OpenStreetMap. Good for international addresses.
                Community-contributed data may have gaps in accuracy.
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  Completely free
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  Global coverage
                </span>
                <span className="flex items-center gap-1">
                  <Info className="w-3 h-3 text-yellow-500" />
                  ~80-85% accuracy for NZ
                </span>
              </div>
            </div>
          </label>

          {/* Test Button */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={testProvider}
              disabled={testingProvider}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-700 bg-teal-100 rounded-lg hover:bg-teal-200 transition-colors disabled:opacity-50"
            >
              {testingProvider ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MapPin className="w-4 h-4" />
              )}
              {testingProvider ? 'Testing...' : 'Test Provider'}
            </button>
            <span className="text-xs text-gray-500">
              Tests with "1 Queen Street Auckland"
            </span>
          </div>
        </div>
      </div>

      {/* NZ Post Credentials */}
      {settings.provider === 'nzpost' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-gray-400" />
              NZ Post OAuth 2.0 Credentials
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Required for NZ Post address lookup. Uses OAuth 2.0 Client Credentials flow.
              Get your credentials from the{' '}
              <a
                href="https://www.nzpost.co.nz/business/ecommerce/developer-resource-centre/get-started"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-600 hover:underline"
              >
                NZ Post Developer Centre
              </a>.
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
              <input
                type="text"
                value={settings.nzpostClientId}
                onChange={(e) => setSettings((s) => ({ ...s, nzpostClientId: e.target.value }))}
                placeholder="Enter your NZ Post Client ID"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
              <input
                type="password"
                value={settings.nzpostClientSecret}
                onChange={(e) => setSettings((s) => ({ ...s, nzpostClientSecret: e.target.value }))}
                placeholder="Enter your NZ Post Client Secret"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCredentialsSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Credentials
              </button>
              {settings.nzpostClientId && settings.nzpostClientSecret && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  Credentials configured
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Default Country */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Globe className="w-5 h-5 text-gray-400" />
            Default Country
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Default country code for address suggestions. Used to bias results.
          </p>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={settings.defaultCountry}
              onChange={(e) => setSettings((s) => ({ ...s, defaultCountry: e.target.value.toUpperCase() }))}
              placeholder="NZ"
              maxLength={2}
              className="w-24 border border-gray-300 rounded-lg px-4 py-2 text-sm font-mono uppercase focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
            <button
              onClick={handleCountrySave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
            <span className="text-xs text-gray-500">
              ISO 3166-1 alpha-2 (e.g., NZ, AU, US, GB)
            </span>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">How it works</p>
            <p className="text-blue-700">
              The autocomplete feature helps users fill in address forms faster. When a user selects
              a suggested address, all fields (street, city, state, postcode, country) are
              auto-filled. Users can always edit the fields manually if the suggestion is incorrect.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
