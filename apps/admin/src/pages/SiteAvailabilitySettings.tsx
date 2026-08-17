import { useEffect, useState } from 'react';
import { Settings, AlertTriangle, Shield, Wifi, WifiOff } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface SiteStatus {
  status: string;
  maintenanceMode: boolean;
  offlineMode: boolean;
}

function Toggle({ enabled, onToggle, disabled, label }: { enabled: boolean; onToggle: () => void; disabled: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 ${enabled ? 'bg-primary-600' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function SiteAvailabilitySettings() {
  const [siteStatus, setSiteStatus] = useState<SiteStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ type: 'maintenance' | 'offline'; enable: boolean } | null>(null);

  const fetchStatus = () => {
    setLoading(true);
    api.get('/admin/site-availability/status')
      .then((res) => setSiteStatus(res.data.data))
      .catch(() => toast.error('Failed to load site availability status'))
      .finally(() => setLoading(false));
  };

  useEffect(fetchStatus, []);

  const updateStatus = async (maintenanceMode: boolean, offlineMode: boolean) => {
    setSaving(true);
    try {
      const res = await api.put('/admin/site-availability/status', { maintenanceMode, offlineMode });
      setSiteStatus(res.data.data);
      toast.success('Site availability updated');
    } catch {
      toast.error('Failed to update site availability');
    } finally {
      setSaving(false);
      setConfirmModal(null);
    }
  };

  const handleToggleMaintenance = () => {
    if (!siteStatus) return;
    const newMaintenance = !siteStatus.maintenanceMode;
    if (newMaintenance) {
      setConfirmModal({ type: 'maintenance', enable: true });
    } else {
      updateStatus(false, siteStatus.offlineMode);
    }
  };

  const handleToggleOffline = () => {
    if (!siteStatus) return;
    const newOffline = !siteStatus.offlineMode;
    if (newOffline) {
      setConfirmModal({ type: 'offline', enable: true });
    } else {
      updateStatus(siteStatus.maintenanceMode, false);
    }
  };

  const confirmAction = () => {
    if (!confirmModal || !siteStatus) return;
    if (confirmModal.type === 'offline') {
      // Enabling offline always takes precedence
      updateStatus(siteStatus.maintenanceMode, true);
    } else {
      // Enabling maintenance
      updateStatus(true, siteStatus.offlineMode);
    }
  };

  const getStatusDisplay = () => {
    if (!siteStatus) return { label: 'Loading...', color: 'text-gray-500', bg: 'bg-gray-100', icon: Settings };
    switch (siteStatus.status) {
      case 'OFFLINE':
        return { label: 'Site Offline', color: 'text-red-700', bg: 'bg-red-100', icon: WifiOff };
      case 'MAINTENANCE':
        return { label: 'Under Maintenance', color: 'text-amber-700', bg: 'bg-amber-100', icon: AlertTriangle };
      default:
        return { label: 'Online', color: 'text-green-700', bg: 'bg-green-100', icon: Wifi };
    }
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="h-48 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Site Availability</h1>
          <p className="text-sm text-gray-500 mt-1">Control site maintenance and offline modes</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${statusDisplay.bg}`}>
          <StatusIcon size={18} className={statusDisplay.color} />
          <span className={`text-sm font-medium ${statusDisplay.color}`}>{statusDisplay.label}</span>
        </div>
      </div>

      {/* Settings Cards */}
      <div className="space-y-6">
        {/* Maintenance Mode */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <AlertTriangle size={20} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Site Under Maintenance</h3>
                  <p className="text-sm text-gray-500">Allow visitors to browse while temporarily disabling actions</p>
                </div>
              </div>
              <div className="mt-4 ml-11">
                <p className="text-sm text-gray-600">
                  When enabled, visitors can still browse the website, but actions such as login, shopping,
                  checkout, contact forms and account changes will be unavailable. A maintenance banner
                  will be displayed across the public site.
                </p>
              </div>
            </div>
            <Toggle
              enabled={siteStatus?.maintenanceMode ?? false}
              onToggle={handleToggleMaintenance}
              disabled={saving}
              label="Toggle maintenance mode"
            />
          </div>
        </div>

        {/* Offline Mode */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <WifiOff size={20} className="text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Site Offline</h3>
                  <p className="text-sm text-gray-500">Make the site unavailable to all visitors</p>
                </div>
              </div>
              <div className="mt-4 ml-11">
                <p className="text-sm text-gray-600">
                  When enabled, the website, finder portal and mobile application will be unavailable to
                  all visitors. Only authorized administrators will retain access to the administration
                  system to manage this setting.
                </p>
              </div>
            </div>
            <Toggle
              enabled={siteStatus?.offlineMode ?? false}
              onToggle={handleToggleOffline}
              disabled={saving}
              label="Toggle offline mode"
            />
          </div>
        </div>

        {/* Status Legend */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Effective State Logic</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span><strong>Online</strong> — Both Maintenance and Offline are disabled</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span><strong>Maintenance</strong> — Maintenance enabled, Offline disabled</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span><strong>Offline</strong> — Offline enabled (takes precedence over Maintenance)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              {confirmModal.type === 'offline' ? (
                <div className="p-2 bg-red-100 rounded-lg">
                  <Shield size={24} className="text-red-600" />
                </div>
              ) : (
                <div className="p-2 bg-amber-100 rounded-lg">
                  <AlertTriangle size={24} className="text-amber-600" />
                </div>
              )}
              <h3 className="text-lg font-semibold text-gray-900">
                {confirmModal.type === 'offline' ? 'Take PawTag Offline?' : 'Enable Maintenance Mode?'}
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              {confirmModal.type === 'offline'
                ? 'This will make the website, finder portal and mobile application unavailable to users. Only authorized administrators will retain access to the administration system.'
                : 'Visitors will still be able to browse PawTag, but actions such as login, shopping, checkout, contact forms and account changes will be unavailable.'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAction}
                disabled={saving}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
                  confirmModal.type === 'offline'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {saving ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
