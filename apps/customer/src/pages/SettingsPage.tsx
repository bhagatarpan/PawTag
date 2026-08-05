import { useState, useEffect } from 'react';
import { Bell, Lock, Shield, Save } from 'lucide-react';
import { useAuth } from '../lib/auth';
import api from '../lib/api';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [prefs, setPrefs] = useState({ emailNotifications: true, smsNotifications: false, lostPetAlerts: true, finderNotifications: true });
  const [msg, setMsg] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaMsg, setMfaMsg] = useState('');
  const [mfaError, setMfaError] = useState('');

  useEffect(() => {
    if (user) {
      setMfaEnabled(user.mfaEnabled !== false);
    }
  }, [user]);

  const handleSave = () => {
    setMsg('Settings saved (local only for now — will connect to backend when settings API is ready)');
    setTimeout(() => setMsg(''), 3000);
  };

  const handleMfaToggle = async () => {
    setMfaLoading(true);
    setMfaMsg('');
    setMfaError('');
    try {
      await api.put('/customer/settings/mfa', { enabled: !mfaEnabled });
      setMfaEnabled(!mfaEnabled);
      setMfaMsg(mfaEnabled ? 'Two-factor authentication has been disabled.' : 'Two-factor authentication has been enabled.');
      if (refreshUser) refreshUser();
      setTimeout(() => setMfaMsg(''), 5000);
    } catch (err: any) {
      setMfaError(err.response?.data?.error || 'Failed to update MFA settings');
    } finally {
      setMfaLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      {msg && <div className="bg-green-50 text-green-700 text-sm p-3 rounded mb-4">{msg}</div>}

      {/* MFA Section */}
      <div className="bg-white rounded-lg border p-6 space-y-4 mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Shield size={18} /> Two-Factor Authentication (MFA)</h2>
        <p className="text-sm text-gray-500">
          Add an extra layer of security to your account. When enabled, you'll need to enter a verification code sent to your email each time you sign in.
        </p>

        {mfaMsg && <div className="bg-green-50 text-green-700 text-sm p-3 rounded">{mfaMsg}</div>}
        {mfaError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{mfaError}</div>}

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium">Enable Two-Factor Authentication</p>
            <p className="text-xs text-gray-500">
              {mfaEnabled ? 'Currently enabled — you will receive a verification code when signing in.' : 'Currently disabled — sign in with just your password.'}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={mfaEnabled}
              onChange={handleMfaToggle}
              disabled={mfaLoading}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
        </div>

        {mfaEnabled && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-xs text-blue-700">
              <strong>How it works:</strong> When you sign in, after entering your password, you'll receive a 6-digit code via email. Enter this code to complete your login.
            </p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border p-6 space-y-4 mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Bell size={18} /> Notification Preferences</h2>
        {[
          { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive notifications via email' },
          { key: 'smsNotifications', label: 'SMS Notifications', desc: 'Receive notifications via text message' },
          { key: 'lostPetAlerts', label: 'Lost Pet Alerts', desc: 'Get alerted when your pet\'s tag is scanned' },
          { key: 'finderNotifications', label: 'Finder Notifications', desc: 'Get notified when someone finds your pet' },
        ].map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between py-2">
            <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-gray-500">{desc}</p></div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={(prefs as any)[key]} onChange={() => setPrefs({ ...prefs, [key]: !(prefs as any)[key] })} className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border p-6 space-y-4 mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Lock size={18} /> Account</h2>
        <div className="flex items-center justify-between py-2">
          <div><p className="text-sm font-medium">Email</p><p className="text-xs text-gray-500">{user?.email}</p></div>
        </div>
        <div className="flex items-center justify-between py-2">
          <div><p className="text-sm font-medium">Account Status</p><p className="text-xs text-gray-500">{user?.status || 'active'}</p></div>
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Active</span>
        </div>
      </div>

      <button onClick={handleSave} className="bg-primary-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-primary-700 flex items-center gap-2"><Save size={14} /> Save Settings</button>
    </div>
  );
}
