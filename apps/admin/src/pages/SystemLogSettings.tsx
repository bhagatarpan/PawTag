import { useEffect, useState } from 'react';
import { Terminal } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';
import {
  LEVEL_COLORS,
  LEVEL_DOT_COLORS,
  CATEGORY_COLORS,
  LEVEL_ICONS,
  CATEGORY_ICONS,
  LEVEL_DESCRIPTIONS,
  CATEGORY_DESCRIPTIONS,
} from '../lib/system-log-utils';

interface SettingItem { key: string; enabled: boolean }
interface SamplingItem { key: string; value: number }
interface SettingsData {
  enabled: boolean;
  levels: SettingItem[];
  categories: SettingItem[];
  sampling: SamplingItem[];
  retentionDays: number;
}

function Toggle({ enabled, onToggle, disabled }: { enabled: boolean; onToggle: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 ${enabled ? 'bg-primary-600' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function SystemLogSettings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchSettings = () => {
    setLoading(true);
    api.get('/admin/system-logs/settings')
      .then((res) => setSettings(res.data.data))
      .catch(() => toast.error('Failed to load system log settings'))
      .finally(() => setLoading(false));
  };

  useEffect(fetchSettings, []);

  const updateSetting = async (key: string, value: string) => {
    setSaving(key);
    try {
      await api.put(`/admin/system-logs/settings/${key}`, { value });
      toast.success('Setting updated');
    } catch {
      toast.error('Failed to update setting');
    } finally {
      setSaving(null);
    }
  };

  const toggleLevel = (item: SettingItem) => {
    const newVal = !item.enabled;
    updateSetting(`systemLog.level.${item.key}`, String(newVal));
    setSettings((s) => s && {
      ...s,
      levels: s.levels.map((l) => l.key === item.key ? { ...l, enabled: newVal } : l),
    });
  };

  const toggleCategory = (item: SettingItem) => {
    const newVal = !item.enabled;
    updateSetting(`systemLog.category.${item.key}`, String(newVal));
    setSettings((s) => s && {
      ...s,
      categories: s.categories.map((c) => c.key === item.key ? { ...c, enabled: newVal } : c),
    });
  };

  const updateSampling = (key: string, value: number) => {
    const clamped = Math.min(100, Math.max(0, value));
    updateSetting(`systemLog.sampling.${key}`, String(clamped));
    setSettings((s) => s && {
      ...s,
      sampling: s.sampling.map((sp) => sp.key === key ? { ...sp, value: clamped } : sp),
    });
  };

  const updateRetention = (value: number) => {
    const clamped = Math.max(1, value);
    updateSetting('systemLog.retentionDays', String(clamped));
    setSettings((s) => s && { ...s, retentionDays: clamped });
  };

  const toggleMaster = () => {
    if (!settings) return;
    const newVal = !settings.enabled;
    updateSetting('systemLog.enabled', String(newVal));
    setSettings((s) => s && { ...s, enabled: newVal });
  };

  if (loading || !settings) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600"><Terminal className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Log Settings</h1>
            <p className="text-sm text-gray-500 mt-1">Configure system log storage, levels, and retention.</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600"><Terminal className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Log Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Configure which application logs are stored in MongoDB. Changes take effect immediately.</p>
        </div>
      </div>

      {/* Master Toggle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Master Toggle</h2>
          <p className="text-xs text-gray-500 mt-1">Enable or disable all system log storage. When disabled, no logs are written to MongoDB.</p>
        </div>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">System Logging</p>
            <p className="text-xs text-gray-500 mt-0.5">{settings.enabled ? 'Logs are being stored in MongoDB' : 'Log storage is paused'}</p>
          </div>
          <Toggle enabled={settings.enabled} disabled={saving === 'systemLog.enabled'} onToggle={toggleMaster} />
        </div>
      </div>

      {/* Retention */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Retention</h2>
          <p className="text-xs text-gray-500 mt-1">How many days to keep logs before automatic deletion via MongoDB TTL.</p>
        </div>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Retention Period</p>
            <p className="text-xs text-gray-500 mt-0.5">Logs older than this are automatically deleted.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={365}
              value={settings.retentionDays}
              onChange={(e) => updateRetention(Number(e.target.value))}
              disabled={saving === 'systemLog.retentionDays'}
              className="w-20 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-center disabled:opacity-50"
            />
            <span className="text-sm text-gray-500">days</span>
          </div>
        </div>
      </div>

      {/* Log Levels */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Log Levels</h2>
          <p className="text-xs text-gray-500 mt-1">Choose which log severity levels are stored. Disabled levels are still written to stdout.</p>
        </div>
        <div className="divide-y divide-gray-100">
          {settings.levels.map((item) => {
            const Icon = LEVEL_ICONS[item.key];
            return (
              <div key={item.key} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${LEVEL_DOT_COLORS[item.key]}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 capitalize">{item.key}</p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${LEVEL_COLORS[item.key]}`}>
                        {Icon && <Icon size={10} className="mr-0.5" />}
                        {item.key}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{LEVEL_DESCRIPTIONS[item.key]}</p>
                  </div>
                </div>
                <Toggle enabled={item.enabled} disabled={saving === `systemLog.level.${item.key}`} onToggle={() => toggleLevel(item)} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Categories</h2>
          <p className="text-xs text-gray-500 mt-1">Choose which log categories are stored. Logs are auto-categorized based on context.</p>
        </div>
        <div className="divide-y divide-gray-100">
          {settings.categories.map((item) => {
            const Icon = CATEGORY_ICONS[item.key];
            return (
              <div key={item.key} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {Icon && <Icon size={16} className="text-gray-400" />}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{item.key}</p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${CATEGORY_COLORS[item.key]}`}>
                        {item.key}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{CATEGORY_DESCRIPTIONS[item.key]}</p>
                  </div>
                </div>
                <Toggle enabled={item.enabled} disabled={saving === `systemLog.category.${item.key}`} onToggle={() => toggleCategory(item)} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Sampling */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Sampling Rates</h2>
          <p className="text-xs text-gray-500 mt-1">Percentage of logs to store per level. 100% = store all. Useful for high-volume debug logs.</p>
        </div>
        <div className="divide-y divide-gray-100">
          {settings.sampling.map((item) => (
            <div key={item.key} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={`h-2 w-2 rounded-full ${LEVEL_DOT_COLORS[item.key]}`} />
                <div>
                  <p className="text-sm font-medium text-gray-900 capitalize">{item.key} Sampling</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Currently storing {item.value}% of {item.key} logs.
                    {item.value < 100 && ' Some logs will be discarded.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={item.value}
                  onChange={(e) => updateSampling(item.key, Number(e.target.value))}
                  disabled={saving === `systemLog.sampling.${item.key}`}
                  className="w-32 accent-primary-600"
                />
                <span className="w-12 text-right text-sm font-medium text-gray-700">{item.value}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
