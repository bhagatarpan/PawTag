import { useState } from 'react';
import { Bell, Lock, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState({ emailNotifications: true, smsNotifications: false, lostPetAlerts: true, finderNotifications: true });
  const [msg, setMsg] = useState('');

  const handleSave = () => {
    setMsg('Settings saved (local only for now — will connect to backend when settings API is ready)');
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      {msg && <div className="bg-green-50 text-green-700 text-sm p-3 rounded mb-4">{msg}</div>}
      <div className="bg-white rounded-lg border p-6 space-y-4 mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Bell size={18} /> Notification Preferences</h2>
        {[
          { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive notifications via email' },
          { key: 'smsNotifications', label: 'SMS Notifications', desc: 'Receive notifications via text message' },
          { key: 'lostPetAlerts', label: 'Lost Pet Alerts', desc: "Get alerted when your pet's tag is scanned" },
          { key: 'finderNotifications', label: 'Finder Notifications', desc: 'Get notified when someone finds your pet' },
        ].map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between py-2">
            <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-gray-500">{desc}</p></div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={(prefs as any)[key]} onChange={() => setPrefs({ ...prefs, [key]: !(prefs as any)[key] })} className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
            </label>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg border p-6 space-y-4 mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Lock size={18} /> Account</h2>
        <div className="flex items-center justify-between py-2"><div><p className="text-sm font-medium">Email</p><p className="text-xs text-gray-500">{user?.email}</p></div></div>
        <div className="flex items-center justify-between py-2"><div><p className="text-sm font-medium">Account Status</p><p className="text-xs text-gray-500">{user?.status || 'active'}</p></div><span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Active</span></div>
      </div>
      <button onClick={handleSave} className="bg-teal-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-teal-700 flex items-center gap-2"><Save size={14} /> Save Settings</button>
    </div>
  );
}
