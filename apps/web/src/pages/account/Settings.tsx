import { useState } from 'react';
import { Bell, ChevronRight, Lock, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import SaveToast from '../../components/SaveToast';

export default function Settings() {
  const { user } = useAuth();
  const [showSaved, setShowSaved] = useState(false);

  const handleSave = () => {
    setShowSaved(true);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      {showSaved && <SaveToast message="Settings saved successfully" onDone={() => setShowSaved(false)} />}
      <Link
        to="/account/notification-preferences"
        className="bg-white rounded-lg border p-6 mb-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Bell size={18} className="text-teal-600" />
          <div>
            <p className="font-medium text-sm">Notification Preferences</p>
            <p className="text-xs text-gray-500">Choose how and when you want to be notified</p>
          </div>
        </div>
        <ChevronRight size={18} className="text-gray-400" />
      </Link>
      <div className="bg-white rounded-lg border p-6 space-y-4 mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Lock size={18} /> Account</h2>
        <div className="flex items-center justify-between py-2"><div><p className="text-sm font-medium">Email</p><p className="text-xs text-gray-500">{user?.email}</p></div></div>
        <div className="flex items-center justify-between py-2"><div><p className="text-sm font-medium">Account Status</p><p className="text-xs text-gray-500">{user?.status || 'active'}</p></div><span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Active</span></div>
      </div>
      <button onClick={handleSave} className="bg-teal-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-teal-700 flex items-center gap-2"><Save size={14} /> Save Settings</button>
    </div>
  );
}
