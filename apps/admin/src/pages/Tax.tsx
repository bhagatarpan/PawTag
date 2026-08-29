/**
 * @module Tax Page
 * @description Admin page for managing tax configuration.
 */

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Save, Receipt } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface TaxSetting {
  key: string;
  value: string;
  default: string;
  description: string;
}

export default function Tax() {
  const [settings, setSettings] = useState<TaxSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/commerce/settings');
      const all = res.data?.data || [];
      const taxSettings = all.filter((s: TaxSetting) => s.key.startsWith('commerce.tax.'));
      setSettings(taxSettings);
      setEditedValues(Object.fromEntries(taxSettings.map((s: TaxSetting) => [s.key, s.value])));
    } catch { toast.error('Failed to load tax settings'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const changed: Record<string, string> = {};
      for (const [key, value] of Object.entries(editedValues)) {
        const original = settings.find(s => s.key === key);
        if (original && original.value !== value) changed[key] = value;
      }
      if (Object.keys(changed).length === 0) { toast.info('No changes to save'); setSaving(false); return; }
      await api.put('/admin/commerce/settings', { settings: changed });
      toast.success('Tax settings updated');
      fetchSettings();
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tax Configuration</h1>
          <p className="text-sm text-gray-500 mt-1">Configure NZ GST and tax settings</p>
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
              <Receipt size={20} className="text-teal-600" />
              <h2 className="font-semibold text-gray-900">Tax Settings</h2>
            </div>
            <p className="text-sm text-gray-500 mt-1">Configure GST rate, tax-inclusive pricing, and tax labels</p>
          </div>
          <div className="divide-y divide-gray-100">
            {settings.map((s) => (
              <div key={s.key} className="px-6 py-4 flex items-center justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <label className="text-sm font-medium text-gray-700 block">{s.key.replace('commerce.tax.', '')}</label>
                  <p className="text-xs text-gray-400 mt-0.5">{s.description}</p>
                </div>
                <div className="flex-shrink-0">
                  {s.key.includes('enabled') || s.key.includes('inclusive') ? (
                    <select value={editedValues[s.key] ?? s.value} onChange={(e) => setEditedValues({ ...editedValues, [s.key]: e.target.value })}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  ) : (
                    <input type="text" value={editedValues[s.key] ?? s.value}
                      onChange={(e) => setEditedValues({ ...editedValues, [s.key]: e.target.value })}
                      className="w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
