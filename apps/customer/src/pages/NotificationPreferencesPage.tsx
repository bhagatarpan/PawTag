import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import api from '../lib/api';

interface Prefs {
  email: boolean;
  push: boolean;
  inApp: boolean;
  channels: {
    petFound: boolean;
    orderUpdate: boolean;
    subscriptionReminder: boolean;
    referral: boolean;
    marketing: boolean;
  };
}

const defaultPrefs: Prefs = {
  email: true, push: true, inApp: true,
  channels: { petFound: true, orderUpdate: true, subscriptionReminder: true, referral: true, marketing: false },
};

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/customer/notification-preferences')
      .then(r => setPrefs(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      await api.put('/customer/notification-preferences', prefs);
      setMsg('Preferences saved');
      setTimeout(() => setMsg(''), 3000);
    } catch {
      setMsg('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notification Preferences</h1>
        <p className="text-sm text-gray-500">Choose how you want to be notified.</p>
      </div>

      {msg && <div className={`text-sm p-3 rounded ${msg.includes('Failed') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{msg}</div>}

      <div className="bg-white rounded-lg border p-6 space-y-6">
        <h2 className="font-semibold">Delivery Channels</h2>
        <div className="space-y-3">
          {[
            { key: 'email' as const, label: 'Email Notifications', desc: 'Receive notifications via email' },
            { key: 'push' as const, label: 'Push Notifications', desc: 'Receive push notifications on your devices' },
            { key: 'inApp' as const, label: 'In-App Notifications', desc: 'Show notifications inside the app' },
          ].map(({ key, label, desc }) => (
            <label key={key} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
              <div>
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
              <div className="relative">
                <input type="checkbox" checked={prefs[key]} onChange={e => setPrefs({ ...prefs, [key]: e.target.checked })} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-primary-600 transition-colors" />
                <div className="absolute left-[2px] top-[2px] w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-full transition-transform" />
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6 space-y-6">
        <h2 className="font-semibold">Notification Types</h2>
        <div className="space-y-3">
          {[
            { key: 'petFound' as const, label: 'Pet Found Alerts', desc: 'When someone finds your pet' },
            { key: 'orderUpdate' as const, label: 'Order Updates', desc: 'Order confirmations and shipping updates' },
            { key: 'subscriptionReminder' as const, label: 'Subscription Reminders', desc: 'Expiry and renewal reminders' },
            { key: 'referral' as const, label: 'Referral Rewards', desc: 'When you earn referral rewards' },
            { key: 'marketing' as const, label: 'Marketing', desc: 'New features and promotions' },
          ].map(({ key, label, desc }) => (
            <label key={key} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
              <div>
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
              <div className="relative">
                <input type="checkbox" checked={prefs.channels[key]} onChange={e => setPrefs({ ...prefs, channels: { ...prefs.channels, [key]: e.target.checked } })} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-primary-600 transition-colors" />
                <div className="absolute left-[2px] top-[2px] w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-full transition-transform" />
              </div>
            </label>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={saving} className="bg-primary-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
        <Save size={16} /> {saving ? 'Saving...' : 'Save Preferences'}
      </button>
    </div>
  );
}
