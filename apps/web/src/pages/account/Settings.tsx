import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, ChevronRight, Lock, Shield, Mail, Phone, Download,
  Trash2, Loader2, CheckCircle, AlertTriangle, Eye, EyeOff,
  Key, Smartphone, Info,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialog, StatusBadge } from '@pawtag/ui';
import SaveToast from '../../components/SaveToast';
import api from '../../lib/api';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MFASettings {
  mfaEnabled: boolean;
  mfaMethod: 'email' | 'sms' | 'authenticator';
  phoneVerified: boolean;
  emailVerified: boolean;
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [showSaved, setShowSaved] = useState(false);
  const [mfa, setMfa] = useState<MFASettings | null>(null);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [mfaActionLoading, setMfaActionLoading] = useState(false);
  const [showDisableMfa, setShowDisableMfa] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [finderPrivacy, setFinderPrivacy] = useState<{ showOwnerNameInFinder: boolean } | null>(null);
  const [finderPrivacyLoading, setFinderPrivacyLoading] = useState(true);
  const [finderPrivacyActionLoading, setFinderPrivacyActionLoading] = useState(false);

  useEffect(() => {
    fetchMFA();
    fetchFinderPrivacy();
  }, []);

  async function fetchMFA() {
    try {
      const res = await api.get('/customer/settings/mfa');
      setMfa(res.data.data);
    } catch {
      // MFA endpoint may not exist yet — fail silently
    } finally {
      setMfaLoading(false);
    }
  }

  async function fetchFinderPrivacy() {
    try {
      const res = await api.get('/customer/settings/finder-privacy');
      setFinderPrivacy(res.data.data);
    } catch {
      // fail silently
    } finally {
      setFinderPrivacyLoading(false);
    }
  }

  async function handleToggleFinderPrivacy() {
    if (!finderPrivacy) return;
    setFinderPrivacyActionLoading(true);
    try {
      const newValue = !finderPrivacy.showOwnerNameInFinder;
      await api.put('/customer/settings/finder-privacy', { showOwnerNameInFinder: newValue });
      setFinderPrivacy({ showOwnerNameInFinder: newValue });
      setShowSaved(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update privacy setting');
    } finally {
      setFinderPrivacyActionLoading(false);
    }
  }

  async function handleToggleMFA() {
    if (!mfa) return;
    setMfaActionLoading(true);
    try {
      if (mfa.mfaEnabled) {
        setShowDisableMfa(true);
      } else {
        await api.put('/customer/settings/mfa', { mfaEnabled: true });
        setMfa({ ...mfa, mfaEnabled: true });
        await refreshUser();
        setShowSaved(true);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update MFA');
    } finally {
      setMfaActionLoading(false);
    }
  }

  async function handleDisableMFA() {
    setMfaActionLoading(true);
    try {
      await api.put('/customer/settings/mfa', { mfaEnabled: false });
      setMfa(mfa ? { ...mfa, mfaEnabled: false } : null);
      await refreshUser();
      setShowDisableMfa(false);
      setShowSaved(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to disable MFA');
    } finally {
      setMfaActionLoading(false);
    }
  }

  async function handleExportData() {
    setExportLoading(true);
    try {
      const res = await api.get('/customer/pets');
      const pets = res.data.data || [];
      const data = {
        exportDate: new Date().toISOString(),
        user: {
          fullName: user?.fullName,
          email: user?.email,
          phoneNumber: user?.phoneNumber,
        },
        pets,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pawtag-data-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setShowSaved(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to export data');
    } finally {
      setExportLoading(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== user?.email) return;
    setDeleteLoading(true);
    try {
      await api.delete('/auth/account');
      localStorage.removeItem('pawtag_token');
      window.location.href = '/';
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete account');
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {showSaved && <SaveToast message="Settings saved successfully" onDone={() => setShowSaved(false)} />}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account security and preferences.</p>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Lock size={16} className="text-teal-600" /> Account Information
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          <div className="px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail size={16} className="text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Email</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
            </div>
            <StatusBadge label="Verified" variant="success" size="sm" />
          </div>
          <div className="px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Phone size={16} className="text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Phone</p>
                <p className="text-xs text-gray-500">{user?.phoneNumber || 'Not provided'}</p>
              </div>
            </div>
            {user?.phoneNumber ? (
              <StatusBadge label="Set" variant="info" size="sm" />
            ) : (
              <Link to="/account/profile" className="text-xs text-teal-600 hover:text-teal-800 font-medium">Add</Link>
            )}
          </div>
          <div className="px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield size={16} className="text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Account Status</p>
                <p className="text-xs text-gray-500">Your account is in good standing</p>
              </div>
            </div>
            <StatusBadge
              label={user?.status || 'active'}
              variant={user?.status === 'active' ? 'success' : 'warning'}
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Key size={16} className="text-teal-600" /> Security
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {/* MFA */}
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone size={16} className="text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Two-Factor Authentication</p>
                <p className="text-xs text-gray-500">
                  {mfaLoading ? 'Loading...' : mfa?.mfaEnabled ? 'Enabled — extra layer of security is active' : 'Disabled — add an extra layer of security'}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleMFA}
              disabled={mfaLoading || mfaActionLoading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                mfa?.mfaEnabled ? 'bg-teal-600' : 'bg-gray-200'
              } disabled:opacity-50`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                mfa?.mfaEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* Change Password — link to profile */}
          <Link to="/account/profile" className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <Lock size={16} className="text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Change Password</p>
                <p className="text-xs text-gray-500">Update your account password</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </Link>
        </div>
      </div>

      {/* Preferences */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Bell size={16} className="text-teal-600" /> Preferences
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          <Link to="/account/notification-preferences" className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <Bell size={16} className="text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Notification Preferences</p>
                <p className="text-xs text-gray-500">Choose how and when you want to be notified</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </Link>
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye size={16} className="text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Show Pet Owner's Name When Lost Pet Is Found</p>
                <p className="text-xs text-gray-500">
                  {finderPrivacyLoading
                    ? 'Loading...'
                    : finderPrivacy?.showOwnerNameInFinder
                      ? 'ON: Your name is visible to finders. Your suburb and city will also be shown.'
                      : 'OFF: Your name is hidden — finders will see your suburb and city instead.'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Your street address, phone, and email are never shown to finders.
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleFinderPrivacy}
              disabled={finderPrivacyLoading || finderPrivacyActionLoading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                finderPrivacy?.showOwnerNameInFinder ? 'bg-teal-600' : 'bg-gray-200'
              } disabled:opacity-50`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                finderPrivacy?.showOwnerNameInFinder ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Data & Privacy */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Download size={16} className="text-teal-600" /> Data & Privacy
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Download size={16} className="text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Export Your Data</p>
                <p className="text-xs text-gray-500">Download a copy of your pet and account data</p>
              </div>
            </div>
            <button
              onClick={handleExportData}
              disabled={exportLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 disabled:opacity-50"
            >
              {exportLoading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              Export
            </button>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-start gap-3">
              <Trash2 size={16} className="text-red-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-700">Delete Account</p>
                <p className="text-xs text-gray-500 mb-3">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <button
                  onClick={() => setShowDeleteAccount(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                >
                  <Trash2 size={12} /> Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Disable MFA Confirmation */}
      <ConfirmDialog
        open={showDisableMfa}
        onClose={() => setShowDisableMfa(false)}
        onConfirm={handleDisableMFA}
        title="Disable Two-Factor Authentication"
        message="Your account will be less secure without 2FA. You can re-enable it at any time."
        confirmLabel="Disable 2FA"
        variant="warning"
        loading={mfaActionLoading}
      />

      {/* Delete Account Confirmation */}
      <ConfirmDialog
        open={showDeleteAccount}
        onClose={() => { setShowDeleteAccount(false); setDeleteConfirmText(''); }}
        onConfirm={handleDeleteAccount}
        title="Delete Your Account"
        message={`This will permanently delete your account and all data. Type "${user?.email}" to confirm.`}
        confirmLabel="Delete Account"
        variant="danger"
        loading={deleteLoading}
      />
      {showDeleteAccount && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowDeleteAccount(false); setDeleteConfirmText(''); }} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6 mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Deletion</h3>
            <p className="text-sm text-gray-500 mb-4">Type your email to confirm:</p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={user?.email || ''}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowDeleteAccount(false); setDeleteConfirmText(''); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== user?.email || deleteLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
