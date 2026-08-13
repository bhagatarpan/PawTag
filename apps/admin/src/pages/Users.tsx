import { useEffect, useState, useCallback, useRef } from 'react';
import api, { PaginatedData } from '../lib/api';
import { toast } from '../lib/toast';
import {
  Search,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Users as UsersIcon,
  Shield,
  ShieldOff,
  Lock,
  Unlock,
  Trash2,
  Edit2,
  Key,
  Plus,
  Save,
  Loader2,
  UserCheck,
  UserX,
  Clock,
  AlertTriangle,
  Copy,
  Settings,
  Activity,
  CheckCircle,
  AlertCircle,
  Info,
  Database,
  User,
  FileText,
  Check,
  ShieldCheck,
  RotateCcw,
  UserPlus,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface UserRecord {
  _id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  status: string;
  responsibilityScore?: number;
  mfaEnabled?: boolean;
  skipInvoiceOtp?: boolean;
  skipInvoiceOtpExpiresAt?: string;
  lockedUntil?: string;
  createdAt: string;
  rbacRoles: Array<{
    _id: string;
    roleId?: { _id: string; name: string; displayName: string; isSuperAdmin?: boolean };
    assignedBy?: { fullName: string; email: string };
  }>;
}

interface SummaryData {
  total: number;
  active: number;
  suspended: number;
  pendingVerification: number;
  locked: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copied to clipboard'),
    () => toast.error('Failed to copy'),
  );
}

function getStatusBadge(status: string): { className: string; icon: React.ReactNode } {
  switch (status) {
    case 'active': return { className: 'bg-emerald-100 text-emerald-700 border border-emerald-200', icon: <CheckCircle size={13} /> };
    case 'suspended': return { className: 'bg-red-100 text-red-700 border border-red-200', icon: <AlertCircle size={13} /> };
    case 'pending_verification': return { className: 'bg-amber-100 text-amber-700 border border-amber-200', icon: <Clock size={13} /> };
    case 'inactive': return { className: 'bg-gray-100 text-gray-600 border border-gray-200', icon: <AlertCircle size={13} /> };
    default: return { className: 'bg-gray-100 text-gray-600 border border-gray-200', icon: <Info size={13} /> };
  }
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-32" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-40" /></td>
      <td className="px-4 py-3 hidden lg:table-cell"><div className="h-5 bg-gray-200 rounded-full w-24" /></td>
      <td className="px-4 py-3 hidden md:table-cell"><div className="h-5 bg-gray-200 rounded-full w-20" /></td>
      <td className="px-4 py-3 hidden xl:table-cell"><div className="h-4 bg-gray-200 rounded w-16" /></td>
      <td className="px-4 py-3 hidden xl:table-cell"><div className="h-5 bg-gray-200 rounded-full w-16" /></td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail Drawer                                                      */
/* ------------------------------------------------------------------ */

function DetailDrawer({
  user,
  onClose,
  onRefresh,
  rbacRoles,
}: {
  user: UserRecord | null;
  onClose: () => void;
  onRefresh: () => void;
  rbacRoles: any[];
}) {
  const [activeTab, setActiveTab] = useState<'profile' | 'rbac' | 'settings'>('profile');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ fullName: '', email: '', phoneNumber: '', responsibilityScore: 0 });
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [resetPw, setResetPw] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [user, onClose]);

  useEffect(() => {
    if (user) {
      setEditForm({
        fullName: user.fullName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        responsibilityScore: user.responsibilityScore || 0,
      });
      setEditMode(false);
      setEditError('');
      setActiveTab('profile');
    }
  }, [user]);

  if (!user) return null;

  const handleEditSave = async () => {
    setEditSaving(true);
    setEditError('');
    try {
      await api.put(`/admin/users/${user._id}`, editForm);
      toast.success('User updated');
      setEditMode(false);
      onRefresh();
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Failed to update');
    } finally {
      setEditSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPw || resetPw.length < 8) return;
    setResetLoading(true);
    setResetMsg('');
    try {
      await api.post(`/admin/users/${user._id}/reset-password`, { newPassword: resetPw });
      setResetMsg('Password reset successfully');
      setResetPw('');
      toast.success('Password reset');
      setTimeout(() => setResetMsg(''), 3000);
    } catch (err: any) {
      setResetMsg(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  };

  const handleLock = async () => {
    setActionLoading('lock');
    try {
      await api.put(`/admin/users/${user._id}/lock`);
      toast.success('Account locked');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to lock');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnlock = async () => {
    setActionLoading('unlock');
    try {
      await api.put(`/admin/users/${user._id}/unlock`);
      toast.success('Account unlocked');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to unlock');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Soft-delete user "${user.fullName}"? They will be hidden from lists but data is preserved.`)) return;
    setActionLoading('delete');
    try {
      await api.delete(`/admin/users/${user._id}`);
      toast.success('User soft-deleted');
      onClose();
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleAssign = async (roleId: string) => {
    setActionLoading('role');
    try {
      await api.put(`/admin/users/${user._id}/role`, { roleId });
      toast.success('Role assigned');
      setRoleDropdownOpen(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to assign role');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusChange = async (status: string) => {
    setActionLoading('status');
    try {
      await api.put(`/admin/users/${user._id}/status`, { status });
      toast.success('Status updated');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleMfa = async () => {
    setActionLoading('mfa');
    try {
      await api.put(`/admin/users/${user._id}`, { mfaEnabled: user.mfaEnabled === false });
      toast.success(user.mfaEnabled === false ? 'MFA enabled' : 'MFA disabled');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to toggle MFA');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleSkipOtp = async (skip: boolean) => {
    setActionLoading('skipOtp');
    try {
      await api.put(`/admin/users/${user._id}/skip-invoice-otp`, { skip });
      toast.success(skip ? 'Skip OTP enabled for 24h' : 'Skip OTP disabled');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to toggle skip OTP');
    } finally {
      setActionLoading(null);
    }
  };

  const tabs = [
    { key: 'profile' as const, label: 'Profile' },
    { key: 'rbac' as const, label: `Roles (${user.rbacRoles?.length || 0})` },
    { key: 'settings' as const, label: 'Settings' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`User details: ${user.fullName}`}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div ref={drawerRef} className="relative w-full max-w-2xl bg-white shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
              <User size={20} className="text-primary-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate">{user.fullName}</h2>
              <p className="text-sm text-gray-500 truncate">{user.email}</p>
            </div>
            {(() => {
              const badge = getStatusBadge(user.status);
              return (
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badge.className}`}>
                  {badge.icon} {formatStatusLabel(user.status)}
                </span>
              );
            })()}
            {user.lockedUntil && new Date(user.lockedUntil) > new Date() && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">
                <Lock size={12} /> Locked
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Identity */}
              <Section title="Identity" icon={<User size={16} />}>
                {editMode ? (
                  <div className="space-y-3">
                    {editError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{editError}</div>}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Full Name</label>
                      <input value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Email</label>
                      <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Phone Number</label>
                      <input value={editForm.phoneNumber} onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Responsibility Score (0-10)</label>
                      <input type="number" min={0} max={10} value={editForm.responsibilityScore} onChange={(e) => setEditForm({ ...editForm, responsibilityScore: parseInt(e.target.value) || 0 })} className="w-full border rounded-md px-3 py-2 text-sm" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleEditSave} disabled={editSaving} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 flex items-center gap-1 disabled:opacity-50">
                        {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
                      </button>
                      <button onClick={() => { setEditMode(false); setEditError(''); }} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <DetailRow label="Full Name" value={user.fullName} />
                    <DetailRow label="Email" value={
                      <span className="flex items-center gap-2">
                        {user.email}
                        <button onClick={() => copyToClipboard(user.email)} className="text-gray-400 hover:text-gray-600"><Copy size={12} /></button>
                      </span>
                    } />
                    <DetailRow label="Phone" value={user.phoneNumber || '—'} />
                    <DetailRow label="ID" value={
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs">{user._id}</span>
                        <button onClick={() => copyToClipboard(user._id)} className="text-gray-400 hover:text-gray-600"><Copy size={12} /></button>
                      </span>
                    } />
                    <DetailRow label="Joined" value={formatDate(user.createdAt)} />
                    <button onClick={() => setEditMode(true)} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
                      <Edit2 size={13} /> Edit Profile
                    </button>
                  </>
                )}
              </Section>

              {/* Quick Status */}
              <Section title="Quick Status" icon={<Activity size={16} />}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <span className="text-sm text-gray-600">MFA</span>
                    <button
                      onClick={handleToggleMfa}
                      disabled={actionLoading === 'mfa'}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium disabled:opacity-50 ${
                        user.mfaEnabled === false ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      }`}
                    >
                      {actionLoading === 'mfa' ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />}
                      {user.mfaEnabled === false ? 'Off' : 'On'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <span className="text-sm text-gray-600">Skip Invoice OTP</span>
                    {user.skipInvoiceOtp && user.skipInvoiceOtpExpiresAt && new Date(user.skipInvoiceOtpExpiresAt) > new Date() ? (
                      <button
                        onClick={() => handleToggleSkipOtp(false)}
                        disabled={actionLoading === 'skipOtp'}
                        title={`Expires ${formatDateTime(user.skipInvoiceOtpExpiresAt!)}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                      >
                        {actionLoading === 'skipOtp' ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />}
                        Active
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleSkipOtp(true)}
                        disabled={actionLoading === 'skipOtp'}
                        title="Enable for 24 hours"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-50"
                      >
                        {actionLoading === 'skipOtp' ? <Loader2 size={12} className="animate-spin" /> : <ShieldOff size={12} />}
                        Off
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <span className="text-sm text-gray-600">Account</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      user.lockedUntil && new Date(user.lockedUntil) > new Date() ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {user.lockedUntil && new Date(user.lockedUntil) > new Date() ? <Lock size={12} /> : <Unlock size={12} />}
                      {user.lockedUntil && new Date(user.lockedUntil) > new Date() ? 'Locked' : 'Unlocked'}
                    </span>
                  </div>
                  {user.rbacRoles?.some((ur: any) => ur.roleId?.name === 'PET_OWNER') && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                      <span className="text-sm text-gray-600">Score</span>
                      <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                        (user.responsibilityScore || 0) === 0 ? 'bg-emerald-100 text-emerald-700' :
                        (user.responsibilityScore || 0) <= 2 ? 'bg-amber-100 text-amber-700' :
                        (user.responsibilityScore || 0) <= 4 ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-700'
                      }`}>{user.responsibilityScore || 0}</span>
                    </div>
                  )}
                </div>
              </Section>
            </div>
          )}

          {activeTab === 'rbac' && (
            <div className="space-y-6">
              <Section title="Assigned Roles" icon={<Shield size={16} />}>
                {user.rbacRoles && user.rbacRoles.length > 0 ? (
                  <div className="space-y-2">
                    {user.rbacRoles.map((ur) => (
                      <div key={ur._id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                            ur.roleId?.isSuperAdmin ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                          }`}>
                            {ur.roleId?.isSuperAdmin ? <ShieldCheck size={13} /> : <Shield size={13} />}
                            {ur.roleId?.displayName || ur.roleId?.name || 'Unknown'}
                          </span>
                          {ur.assignedBy && (
                            <span className="text-xs text-gray-400">
                              by {ur.assignedBy.fullName || ur.assignedBy.email}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No roles assigned</p>
                )}

                {/* Role assignment dropdown */}
                <div className="relative mt-3">
                  <button
                    onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                  >
                    <UserPlus size={13} /> Assign Role
                    <ChevronDown size={12} />
                  </button>
                  {roleDropdownOpen && (
                    <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[200px]">
                      {rbacRoles.map((r: any) => {
                        const assigned = user.rbacRoles?.some((ur: any) => ur.roleId?._id === r._id);
                        return (
                          <button
                            key={r._id}
                            onClick={() => handleRoleAssign(r._id)}
                            disabled={assigned}
                            className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 flex items-center justify-between ${assigned ? 'font-medium text-primary-600 opacity-60' : 'text-gray-700'}`}
                          >
                            <span>{r.displayName}</span>
                            {assigned && <Check size={14} className="text-green-500" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Section>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* Status Management */}
              <Section title="Status" icon={<Settings size={16} />}>
                <div className="flex flex-wrap gap-2">
                  {['active', 'inactive', 'suspended', 'pending_verification'].map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      disabled={user.status === s || actionLoading === 'status'}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                        user.status === s
                          ? 'bg-primary-100 text-primary-700 border border-primary-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {formatStatusLabel(s)}
                    </button>
                  ))}
                </div>
              </Section>

              {/* Password Reset */}
              <Section title="Reset Password" icon={<Key size={16} />}>
                {resetMsg && (
                  <div className={`text-sm p-3 rounded mb-3 ${resetMsg.includes('success') ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    {resetMsg}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={resetPw}
                    onChange={(e) => setResetPw(e.target.value)}
                    placeholder="New password (min 8 chars)"
                    className="flex-1 border rounded-md px-3 py-2 text-sm"
                    minLength={8}
                  />
                  <button
                    onClick={handleResetPassword}
                    disabled={!resetPw || resetPw.length < 8 || resetLoading}
                    className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 flex items-center gap-1 disabled:opacity-50"
                  >
                    {resetLoading ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />} Reset
                  </button>
                </div>
              </Section>

              {/* Lock / Unlock */}
              <Section title="Account Lock" icon={<Lock size={16} />}>
                {user.lockedUntil && new Date(user.lockedUntil) > new Date() ? (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-red-600">
                      Locked until {formatDateTime(user.lockedUntil)}
                    </span>
                    <button
                      onClick={handleUnlock}
                      disabled={actionLoading === 'unlock'}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg disabled:opacity-50"
                    >
                      {actionLoading === 'unlock' ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />} Unlock
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleLock}
                    disabled={actionLoading === 'lock'}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg disabled:opacity-50"
                  >
                    {actionLoading === 'lock' ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />} Lock Account
                  </button>
                )}
              </Section>

              {/* Soft Delete */}
              <Section title="Danger Zone" icon={<Trash2 size={16} />}>
                <p className="text-sm text-gray-500 mb-3">Soft-delete hides the user from lists but preserves all data.</p>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading === 'delete'}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg disabled:opacity-50"
                >
                  {actionLoading === 'delete' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Soft-Delete User
                </button>
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small reusable components for the drawer                           */
/* ------------------------------------------------------------------ */

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-gray-400">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="pl-6">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-1.5 text-sm">
      <span className="text-gray-400 w-28 shrink-0">{label}</span>
      <span className="text-gray-700 min-w-0">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function Users() {
  // Data state
  const [data, setData] = useState<PaginatedData<UserRecord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Summary
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [rbacRoles, setRbacRoles] = useState<any[]>([]);

  // UI state
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [search]);

  // Fetch roles
  useEffect(() => {
    api.get('/admin/rbac/roles').then((res) => setRbacRoles(res.data.data || [])).catch(console.error);
  }, []);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get('/admin/users', { params: { limit: 1000 } });
      const items = res.data.data.items || [];
      const total = res.data.data.total || 0;
      const active = items.filter((u: UserRecord) => u.status === 'active').length;
      const suspended = items.filter((u: UserRecord) => u.status === 'suspended').length;
      const pendingVerification = items.filter((u: UserRecord) => u.status === 'pending_verification').length;
      const locked = items.filter((u: UserRecord) => u.lockedUntil && new Date(u.lockedUntil) > new Date()).length;
      setSummary({ total, active, suspended, pendingVerification, locked });
    } catch {
      // Summary is non-critical
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page, limit: pageSize };
      if (debouncedSearch) params.search = debouncedSearch;
      if (roleFilter) params.roleId = roleFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/admin/users', { params });
      setData(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, roleFilter, statusFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Export
  const handleExport = async (format: 'csv' | 'json') => {
    setExportLoading(true);
    setShowExportMenu(false);
    try {
      const params: Record<string, unknown> = { format, limit: 10000 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (roleFilter) params.roleId = roleFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/admin/users', { params });
      const items = res.data.data.items || [];

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const headers = ['Name', 'Email', 'Phone', 'Status', 'Score', 'MFA', 'Locked', 'Joined'];
        const rows = items.map((u: UserRecord) => [
          u.fullName, u.email, u.phoneNumber || '', u.status,
          String(u.responsibilityScore || 0), u.mfaEnabled === false ? 'Off' : 'On',
          u.lockedUntil && new Date(u.lockedUntil) > new Date() ? 'Yes' : 'No',
          formatDate(u.createdAt),
        ]);
        const csv = [headers, ...rows].map((r) => r.map((c: string) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
      toast.success(`Exported ${items.length} users`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Export failed');
    } finally {
      setExportLoading(false);
    }
  };

  // Filter helpers
  const activeFilters: Array<{ key: string; label: string; clear: () => void }> = [];
  if (debouncedSearch) activeFilters.push({ key: 'search', label: `Search: "${debouncedSearch}"`, clear: () => { setSearch(''); setDebouncedSearch(''); } });
  if (roleFilter) {
    const role = rbacRoles.find((r: any) => r._id === roleFilter);
    activeFilters.push({ key: 'role', label: `Role: ${role?.displayName || roleFilter}`, clear: () => setRoleFilter('') });
  }
  if (statusFilter) activeFilters.push({ key: 'status', label: `Status: ${formatStatusLabel(statusFilter)}`, clear: () => setStatusFilter('') });

  const clearAllFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setRoleFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const startIdx = data && data.total > 0 ? (page - 1) * pageSize + 1 : 0;
  const endIdx = data ? Math.min(page * pageSize, data.total) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
              <p className="mt-1 text-sm text-gray-500">Manage user accounts, roles, and security settings.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={exportLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {exportLoading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  Export
                  <ChevronDown size={14} />
                </button>
                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                      <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2">
                        <FileText size={14} /> Export CSV
                      </button>
                      <button onClick={() => handleExport('json')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2">
                        <Database size={14} /> Export JSON
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <SummaryCard label="Total Users" value={summary.total} icon={<UsersIcon size={20} />} loading={summaryLoading} />
            <SummaryCard label="Active" value={summary.active} icon={<UserCheck size={20} />} color="emerald" loading={summaryLoading} onClick={() => setStatusFilter(statusFilter === 'active' ? '' : 'active')} active={statusFilter === 'active'} />
            <SummaryCard label="Suspended" value={summary.suspended} icon={<UserX size={20} />} color="red" loading={summaryLoading} onClick={() => setStatusFilter(statusFilter === 'suspended' ? '' : 'suspended')} active={statusFilter === 'suspended'} />
            <SummaryCard label="Pending" value={summary.pendingVerification} icon={<Clock size={20} />} color="amber" loading={summaryLoading} onClick={() => setStatusFilter(statusFilter === 'pending_verification' ? '' : 'pending_verification')} active={statusFilter === 'pending_verification'} />
            <SummaryCard label="Locked" value={summary.locked} icon={<Lock size={20} />} color="red" loading={summaryLoading} />
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <div className="relative flex-1 min-w-[280px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            {search && (
              <button onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Roles</option>
            {rbacRoles.map((r: any) => (
              <option key={r._id} value={r._id}>{r.displayName}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
            <option value="pending_verification">Pending Verification</option>
          </select>
        </div>

        {/* Filter Chips */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {activeFilters.map((f) => (
              <span key={f.key} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200">
                {f.label}
                <button onClick={f.clear} className="hover:bg-primary-200 rounded-full p-0.5 transition-colors" aria-label={`Remove filter: ${f.label}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
            <button onClick={clearAllFilters} className="text-xs text-gray-500 hover:text-gray-700 underline ml-1">
              Clear All
            </button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden xl:table-cell">Score</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden xl:table-cell">Joined</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <AlertTriangle size={32} className="text-red-400" />
                      <p className="text-sm text-red-600">{error}</p>
                      <button onClick={fetchUsers} className="text-sm text-primary-600 hover:underline flex items-center gap-1">
                        <RotateCcw size={14} /> Try Again
                      </button>
                    </div>
                  </td>
                </tr>
              ) : data?.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <UsersIcon size={32} className="text-gray-300" />
                      <p className="text-sm text-gray-500">No users found</p>
                      {activeFilters.length > 0 && (
                        <button onClick={clearAllFilters} className="text-sm text-primary-600 hover:underline">
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                data?.items.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSelectedUser(user)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                          <User size={14} className="text-primary-600" />
                        </div>
                        <span className="font-medium text-gray-900 truncate">{user.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 truncate max-w-[200px]">{user.email}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {user.rbacRoles && user.rbacRoles.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.rbacRoles.map((ur: any) => (
                            <span key={ur._id} className={`text-xs px-2 py-0.5 rounded-full ${
                              ur.roleId?.isSuperAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {ur.roleId?.displayName || ur.roleId?.name || 'Unknown'}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No role</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {(() => {
                        const badge = getStatusBadge(user.status);
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                            {badge.icon} {formatStatusLabel(user.status)}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {user.rbacRoles?.some((ur: any) => ur.roleId?.name === 'PET_OWNER') ? (
                        <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                          (user.responsibilityScore || 0) === 0 ? 'bg-emerald-100 text-emerald-700' :
                          (user.responsibilityScore || 0) <= 2 ? 'bg-amber-100 text-amber-700' :
                          (user.responsibilityScore || 0) <= 4 ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}>{user.responsibilityScore || 0}</span>
                      ) : <span className="text-gray-300 text-sm">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden xl:table-cell">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={(e) => { e.stopPropagation(); setSelectedUser(user); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-3">
            <span className="text-sm text-gray-500">
              Showing {startIdx}–{endIdx} of {data.total} users
            </span>
            <div className="flex items-center gap-3">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              >
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
              <div className="flex gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-3 py-1 text-sm text-gray-700">
                  Page {page} of {data.totalPages}
                </span>
                <button
                  disabled={page >= data.totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Detail Drawer */}
        <DetailDrawer
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onRefresh={() => { fetchUsers(); fetchSummary(); }}
          rbacRoles={rbacRoles}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary Card                                                       */
/* ------------------------------------------------------------------ */

function SummaryCard({
  label, value, icon, color = 'primary', loading, onClick, active,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: 'primary' | 'emerald' | 'red' | 'amber';
  loading?: boolean;
  onClick?: () => void;
  active?: boolean;
}) {
  const colorMap = {
    primary: { bg: 'bg-primary-50', text: 'text-primary-600', border: 'border-primary-200' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
    red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  };
  const c = colorMap[color];

  return (
    <button
      onClick={onClick}
      disabled={!onClick || loading}
      className={`text-left p-4 rounded-xl border transition-all ${
        active ? `${c.bg} ${c.border} ring-2 ring-offset-1 ring-${color === 'primary' ? 'primary' : color}-400` : 'bg-white border-gray-200 hover:border-gray-300'
      } ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-2xl font-bold ${loading ? 'text-gray-300' : 'text-gray-900'}`}>
          {loading ? '—' : value.toLocaleString()}
        </span>
        <span className={`${c.text}`}>{icon}</span>
      </div>
      <span className="text-sm text-gray-500 mt-1 block">{label}</span>
    </button>
  );
}
