import { useEffect, useState, useCallback } from 'react';
import { SiteAvailabilityStatus } from '@pawtag/shared';
import { StatusBadge, ConfirmDialog } from '@pawtag/ui';
import { Globe, AlertTriangle, WifiOff } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface AvailabilityData {
  status: SiteAvailabilityStatus;
  maintenanceMode: boolean;
  offlineMode: boolean;
  messages: {
    maintenanceTitle: string;
    maintenanceMessage: string;
    offlineTitle: string;
    offlineMessage: string;
  };
  pollingInterval: number;
}

function Toggle({ enabled, onToggle, disabled }: { enabled: boolean; onToggle: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 ${enabled ? 'bg-red-600' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function SiteAvailabilitySettings() {
  const [data, setData] = useState<AvailabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: 'warning' | 'danger';
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', variant: 'warning', onConfirm: () => {} });

  // Editable fields
  const [maintenanceTitle, setMaintenanceTitle] = useState('');
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [offlineTitle, setOfflineTitle] = useState('');
  const [offlineMessage, setOfflineMessage] = useState('');
  const [pollingInterval, setPollingInterval] = useState(30);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/admin/site-availability/status');
      const d = res.data.data;
      setData(d);
      setMaintenanceTitle(d.messages.maintenanceTitle);
      setMaintenanceMessage(d.messages.maintenanceMessage);
      setOfflineTitle(d.messages.offlineTitle);
      setOfflineMessage(d.messages.offlineMessage);
      setPollingInterval(d.pollingInterval);
    } catch {
      toast.error('Failed to load site availability settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const updateField = async (field: string, value: boolean | string | number) => {
    setSaving(true);
    try {
      const res = await api.put('/admin/site-availability/status', { [field]: value });
      setData(res.data.data);
      toast.success('Setting updated');
    } catch {
      toast.error('Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  const handleMaintenanceToggle = () => {
    if (!data) return;
    if (data.maintenanceMode) {
      // Turning off — no confirmation needed
      updateField('maintenanceMode', false);
    } else {
      // Turning on — confirm
      setConfirmDialog({
        open: true,
        title: 'Enable Maintenance Mode?',
        message: 'Visitors will still be able to browse PawTag, but actions such as login, shopping, checkout, contact forms and account changes will be unavailable.',
        variant: 'warning',
        onConfirm: () => updateField('maintenanceMode', true),
      });
    }
  };

  const handleOfflineToggle = () => {
    if (!data) return;
    if (data.offlineMode) {
      // Turning off — no confirmation needed
      updateField('offlineMode', false);
    } else {
      // Turning on — stronger confirmation
      setConfirmDialog({
        open: true,
        title: 'Take PawTag Offline?',
        message: 'This will make the website, finder portal and mobile application unavailable to users. Only authorized administrators will retain access to the administration system.',
        variant: 'danger',
        onConfirm: () => updateField('offlineMode', true),
      });
    }
  };

  const handleSaveMessages = async () => {
    setSaving(true);
    try {
      await api.put('/admin/site-availability/status', {
        maintenanceTitle,
        maintenanceMessage,
        offlineTitle,
        offlineMessage,
      });
      toast.success('Messages updated');
    } catch {
      toast.error('Failed to update messages');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePollingInterval = async () => {
    setSaving(true);
    try {
      await api.put('/admin/site-availability/status', { pollingInterval });
      toast.success('Polling interval updated');
    } catch {
      toast.error('Failed to update polling interval');
    } finally {
      setSaving(false);
    }
  };

  const statusVariant = (status: SiteAvailabilityStatus) => {
    switch (status) {
      case SiteAvailabilityStatus.ONLINE: return 'success';
      case SiteAvailabilityStatus.MAINTENANCE: return 'warning';
      case SiteAvailabilityStatus.OFFLINE: return 'danger';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Globe size={28} className="text-primary-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Site Availability</h1>
          <p className="text-gray-500">Control maintenance and offline modes for your website</p>
        </div>
      </div>

      {/* Current Status */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Status</h2>
        <div className="flex items-center gap-3">
          <StatusBadge
            label={data.status}
            variant={statusVariant(data.status)}
            size="md"
          />
          {data.status === SiteAvailabilityStatus.MAINTENANCE && (
            <span className="text-sm text-amber-600 flex items-center gap-1">
              <AlertTriangle size={14} /> Actions are disabled, browsing allowed
            </span>
          )}
          {data.status === SiteAvailabilityStatus.OFFLINE && (
            <span className="text-sm text-red-600 flex items-center gap-1">
              <WifiOff size={14} /> Site is unavailable to visitors
            </span>
          )}
        </div>
      </div>

      {/* Toggles */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Availability Controls</h2>

        <div className="space-y-6">
          {/* Maintenance Toggle */}
          <div className="flex items-start justify-between pb-6 border-b border-gray-100">
            <div>
              <h3 className="font-medium text-gray-900">Site Under Maintenance</h3>
              <p className="text-sm text-gray-500 mt-1">
                Visitors can browse the website, but actions and transactions are temporarily unavailable.
              </p>
            </div>
            <Toggle
              enabled={data.maintenanceMode}
              onToggle={handleMaintenanceToggle}
              disabled={saving}
            />
          </div>

          {/* Offline Toggle */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Site Offline</h3>
              <p className="text-sm text-gray-500 mt-1">
                Take PawTag offline for visitors and disable normal website, finder and mobile functionality.
              </p>
            </div>
            <Toggle
              enabled={data.offlineMode}
              onToggle={handleOfflineToggle}
              disabled={saving}
            />
          </div>
        </div>
      </div>

      {/* Maintenance Messages */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Maintenance Messages</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Banner Title</label>
            <input
              type="text"
              value={maintenanceTitle}
              onChange={(e) => setMaintenanceTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Banner Message</label>
            <textarea
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={handleSaveMessages}
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            Save Maintenance Messages
          </button>
        </div>
      </div>

      {/* Offline Messages */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Offline Messages</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Offline Page Title</label>
            <input
              type="text"
              value={offlineTitle}
              onChange={(e) => setOfflineTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Offline Page Message</label>
            <textarea
              value={offlineMessage}
              onChange={(e) => setOfflineMessage(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={handleSaveMessages}
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            Save Offline Messages
          </button>
        </div>
      </div>

      {/* Polling Interval */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Polling Interval</h2>
        <p className="text-sm text-gray-500 mb-4">
          How often the website and mobile app check for availability status changes (in seconds).
        </p>
        <div className="flex items-center gap-4">
          <input
            type="number"
            min={5}
            max={300}
            value={pollingInterval}
            onChange={(e) => setPollingInterval(parseInt(e.target.value, 10) || 30)}
            className="w-32 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
          />
          <span className="text-sm text-gray-500">seconds</span>
          <button
            type="button"
            onClick={handleSavePollingInterval}
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      {/* Precedence Info */}
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">How Precedence Works</h2>
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>OFFLINE</strong> always takes precedence over <strong>MAINTENANCE</strong>.</p>
          <p>If both are enabled, the site behaves as <strong>OFFLINE</strong>.</p>
          <p>If only Maintenance is enabled, visitors can browse but cannot perform actions.</p>
          <p>If neither is enabled, the site is <strong>ONLINE</strong> and fully functional.</p>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        loading={saving}
      />
    </div>
  );
}
