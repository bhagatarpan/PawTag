import { useEffect, useState, FormEvent } from 'react';
import {
  Plus,
  Pencil,
  Check,
  X,
  Globe,
  Building2,
  Headset,
  Search,
  Share2,
  Link2,
  Mail,
  ShoppingBag,
  ShieldCheck,
  Folder,
  Trash2,
  KeyRound,
} from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';
import { validatePassword } from '@pawtag/shared';

interface Setting {
  _id: string;
  key: string;
  value: string;
  category: string;
  description?: string;
}

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  site: { label: 'Site', icon: Globe, description: 'Brand identity and marketing copy shown across the site.' },
  company: { label: 'Company', icon: Building2, description: 'Your business contact and legal details.' },
  contact: { label: 'Contact', icon: Headset, description: 'Customer-facing hours and support details.' },
  seo: { label: 'SEO', icon: Search, description: 'Search-engine metadata for public pages.' },
  social: { label: 'Social', icon: Share2, description: 'Social media profile links.' },
  urls: { label: 'URLs', icon: Link2, description: 'Internal URLs used by the platform.' },
  emails: { label: 'Email', icon: Mail, description: 'Sender and support email addresses.' },
  checkout: { label: 'Checkout', icon: ShoppingBag, description: 'Defaults used during checkout.' },
  mfa: { label: 'Security', icon: ShieldCheck, description: 'Two-factor and verification behavior.' },
};

function humanizeKey(key: string) {
  const label = key.split('.').pop() || key;
  return label
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase());
}

function isBooleanValue(value: string) {
  return value === 'true' || value === 'false';
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
        on ? 'bg-primary-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
          on ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function ToggleRow({
  setting,
  onSave,
  onDelete,
}: {
  setting: Setting;
  onSave: (key: string, value: string) => Promise<void>;
  onDelete: (key: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const isOn = setting.value === 'true';

  const toggle = async () => {
    setSaving(true);
    try {
      await onSave(setting.key, String(!isOn));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50/70 transition-colors">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-gray-900">{humanizeKey(setting.key)}</p>
          <p className="text-xs text-gray-500 mt-0.5">{setting.description || setting.key}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {saving ? (
          <span className="text-xs text-gray-400">Saving…</span>
        ) : (
          <Toggle on={isOn} onToggle={toggle} />
        )}
        <button
          onClick={() => onDelete(setting.key)}
          className="text-gray-400 hover:text-red-500 transition-colors"
          title="Delete setting"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function TextRow({
  setting,
  onSave,
  onDelete,
}: {
  setting: Setting;
  onSave: (key: string, value: string) => Promise<void>;
  onDelete: (key: string) => void;
}) {
  const [value, setValue] = useState(setting.value);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(setting.value);
    setEditing(false);
  }, [setting.value]);

  const commit = async () => {
    if (value === setting.value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(setting.key, value);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50/70 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{humanizeKey(setting.key)}</p>
        <p className="text-xs text-gray-500 mt-0.5">{setting.description || setting.key}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {editing ? (
          <>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commit()}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary-500"
              autoFocus
            />
            <button
              onClick={commit}
              disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setValue(setting.value);
                setEditing(false);
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <span className="text-sm text-gray-700 bg-gray-100 rounded-lg px-3 py-1.5 max-w-[280px] truncate">
              {setting.value || <span className="text-gray-400">—</span>}
            </span>
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg transition-colors"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </>
        )}
        <button
          onClick={() => onDelete(setting.key)}
          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
          title="Delete setting"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('site');
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState('site');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const fetchSettings = () => {
    setLoading(true);
    api
      .get('/admin/settings')
      .then((res) => setSettings(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const saveSetting = async (key: string, value: string) => {
    await api.put(`/admin/settings/${key}`, { value });
    fetchSettings();
  };

  const createSetting = async () => {
    if (!newKey.trim() || !newValue.trim()) {
      setError('Key and value are required');
      return;
    }
    if (!/^[a-z]+\.[a-z0-9.]+$/.test(newKey.trim())) {
      setError('Key must be in format: category.name (e.g. contact.businessHours)');
      return;
    }
    setCreating(true);
    setError('');
    try {
      await api.post('/admin/settings', {
        key: newKey.trim(),
        value: newValue.trim(),
        category: newCategory,
        description: newDescription.trim() || undefined,
      });
      setShowCreate(false);
      setNewKey('');
      setNewValue('');
      setNewCategory('site');
      setNewDescription('');
      setActiveCategory(newCategory);
      fetchSettings();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create setting');
    } finally {
      setCreating(false);
    }
  };

  const deleteSetting = async (key: string) => {
    if (!confirm(`Delete setting "${key}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/settings/${key}`);
      fetchSettings();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete setting');
    }
  };

  const categories = [...new Set(settings.map((s) => s.category))];
  const activeMeta = CATEGORY_META[activeCategory] || {
    label: activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1),
    icon: Folder,
    description: 'Settings in this category.',
  };
  const ActiveIcon = activeMeta.icon;
  const activeSettings = settings.filter((s) => s.category === activeCategory);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Site Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage platform configuration. Changes save instantly.</p>
        </div>
        <button
          onClick={() => {
            setNewCategory(activeCategory);
            setShowCreate(!showCreate);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          {showCreate ? 'Cancel' : 'New Setting'}
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-sm text-gray-900">Create New Setting</h2>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key *</label>
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g. contact.businessHours"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-xs text-gray-400 mt-1">Format: category.name (lowercase, dot-separated)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_META[cat]?.label || cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Value *</label>
            <input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Setting value"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What this setting controls"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={createSetting}
              disabled={creating}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {creating ? 'Creating…' : 'Create Setting'}
            </button>
            <button
              onClick={() => {
                setShowCreate(false);
                setError('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 items-start">
        {/* Category rail */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Categories</p>
          </div>
          <nav className="p-2 space-y-0.5">
            {categories.map((cat) => {
              const meta = CATEGORY_META[cat];
              const Icon = meta?.icon || Folder;
              const count = settings.filter((s) => s.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    activeCategory === cat
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left capitalize">{meta?.label || cat}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${
                      activeCategory === cat ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Category panel */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <ActiveIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold text-gray-900">{activeMeta.label}</h2>
              <p className="text-xs text-gray-500">{activeMeta.description}</p>
            </div>
          </div>
          {loading ? (
            <div className="px-5 py-10 text-center text-gray-500">Loading…</div>
          ) : activeSettings.length === 0 ? (
            <div className="px-5 py-10 text-center text-gray-500">
              No settings in this category yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {activeSettings.map((s) =>
                isBooleanValue(s.value) ? (
                  <ToggleRow key={s._id} setting={s} onSave={saveSetting} onDelete={deleteSetting} />
                ) : (
                  <TextRow key={s._id} setting={s} onSave={saveSetting} onDelete={deleteSetting} />
                ),
              )}
            </div>
          )}
        </div>
      </div>

      <ChangePasswordSection />
    </div>
  );
}

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      setError(passwordValidation.error!);
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
          <KeyRound className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold text-gray-900">Security</h2>
          <p className="text-xs text-gray-500">Update your account password.</p>
        </div>
      </div>
      <form onSubmit={handleChangePassword} className="p-6 space-y-4">
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}
        <div className="grid grid-cols-1 gap-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
              minLength={8}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Changing…' : 'Change Password'}
        </button>
      </form>
    </div>
  );
}