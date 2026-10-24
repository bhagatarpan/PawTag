import { useState, useEffect, FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { User, MapPin, Phone, Lock, Save, Gift, CheckCircle, AlertCircle, Mail, ShieldCheck } from 'lucide-react';
import { AddressAutocomplete, AddressManager, toast, StatusBadge, buttonClassName } from '@pawtag/ui';
import type { AddressComponents, SavedAddress } from '@pawtag/ui';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import { validatePassword } from '@pawtag/shared';
import { API } from '@pawtag/shared';
import AvatarUpload from '../../components/AvatarUpload';
import NotificationPreferences from './NotificationPreferences';

const PROFILE_TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
  { id: 'preferences', label: 'Preferences' },
] as const;

type ProfileTab = (typeof PROFILE_TABS)[number]['id'];

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ fullName: '', email: '', phoneNumber: '', address: { line1: '', line2: '', city: '', state: '', zip: '', country: '' }, emergencyContact: { name: '', phone: '', email: '', relationship: '' } });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [responsibility, setResponsibility] = useState<any>(null);
  const [relationshipOptions, setRelationshipOptions] = useState<string[]>([]);
  const [referredBy, setReferredBy] = useState<any>(null);

  // Segmented tabs are real URLs (?tab=) — deep links, back/forward and
  // notification emails all resolve to the right section (board 2).
  const rawTab = searchParams.get('tab');
  const tab: ProfileTab = rawTab === 'security' || rawTab === 'preferences' ? rawTab : 'profile';

  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName || '', email: user.email || '', phoneNumber: user.phoneNumber || '',
        address: { line1: user.address?.line1 || '', line2: user.address?.line2 || '', city: user.address?.city || '', state: user.address?.state || '', zip: user.address?.zip || '', country: user.address?.country || '' },
        emergencyContact: { name: user.emergencyContact?.name || '', phone: user.emergencyContact?.phone || '', email: user.emergencyContact?.email || '', relationship: user.emergencyContact?.relationship || '' },
      });
    }
    api.get('/customer/responsibility').then((r) => setResponsibility(r.data.data)).catch(() => {});
    api.get('/customer/referral/referred-by').then((r) => setReferredBy(r.data.data)).catch(() => {});
    api.get('/public/cms/onboarding').then((r) => {
      setRelationshipOptions(r.data.data?.globalSettings?.relationshipOptions || ['Spouse', 'Partner', 'Parent', 'Sibling', 'Child', 'Uncle', 'Aunt', 'Cousin', 'Friend', 'Neighbour', 'Work Colleague', 'Other']);
    }).catch(() => {});
  }, [user]);

  const handleAddressSelect = (address: AddressComponents) => {
    setForm(prev => ({
      ...prev,
      address: {
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        state: address.state,
        zip: address.zip,
        country: address.country || prev.address.country,
      },
    }));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload: any = { fullName: form.fullName, email: form.email };
      if (form.phoneNumber) payload.phoneNumber = form.phoneNumber;
      const addrRaw: Record<string, string> = { line1: form.address.line1, line2: form.address.line2, city: form.address.city, state: form.address.state, zip: form.address.zip, country: form.address.country };
      const addr = Object.fromEntries(Object.entries(addrRaw).filter(([_, v]) => v !== ''));
      if (Object.keys(addr).length > 0) payload.address = addr;
      const ecRaw: Record<string, string> = { name: form.emergencyContact.name, phone: form.emergencyContact.phone, email: form.emergencyContact.email, relationship: form.emergencyContact.relationship };
      const ec = Object.fromEntries(Object.entries(ecRaw).filter(([_, v]) => v !== ''));
      if (Object.keys(ec).length > 0) payload.emergencyContact = ec;
      await api.put(API.auth.profile, payload); toast.success('Profile updated successfully'); refreshUser();
    }
    catch (err: any) { setError(err.response?.data?.error || 'Update failed'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      {/* Identity row (board 2) — avatar + name + email */}
      <div className="flex items-center gap-4 mb-5">
        <AvatarUpload
          currentPicture={user?.profilePicture}
          userName={user?.fullName || ''}
          onUploadComplete={() => refreshUser()}
          size="md"
        />
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{user?.fullName || 'Your account'}</h1>
          <p className="text-sm text-gray-500 truncate">{user?.email}</p>
        </div>
      </div>

      {/* Segmented tabs (board 2): Profile / Security / Preferences */}
      <nav aria-label="Profile sections" className="border-b border-gray-200 mb-6 flex gap-6 overflow-x-auto">
        {PROFILE_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Link
              key={t.id}
              to={t.id === 'profile' ? '/account/profile' : `/account/profile?tab=${t.id}`}
              aria-current={active ? 'page' : undefined}
              className={`py-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-primary-600 text-primary-700 font-semibold'
                  : 'border-transparent text-gray-500 font-medium hover:text-gray-700'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{error}</div>}

      {/* ============================= PROFILE ============================= */}
      {tab === 'profile' && (
        <>
          {responsibility && (
            <div className={`rounded-2xl border p-4 mb-6 flex items-center gap-4 ${responsibility.color === 'green' ? 'bg-green-50 border-green-200' : responsibility.color === 'amber' ? 'bg-amber-50 border-amber-200' : responsibility.color === 'orange' ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'}`}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${responsibility.color === 'green' ? 'bg-green-500' : responsibility.color === 'amber' ? 'bg-amber-500' : responsibility.color === 'orange' ? 'bg-orange-500' : 'bg-red-500'}`}>{responsibility.score}</div>
              <div><p className="font-semibold">{responsibility.rating}</p><p className="text-sm text-gray-600">Pet Responsibility Score — {responsibility.pets?.length || 0} pets registered</p></div>
            </div>
          )}
          {referredBy && (
            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                <Gift size={18} className="text-teal-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-teal-800">Referred by {referredBy.fullName}</p>
                <p className="text-xs text-teal-600">You were invited to join PawTag</p>
              </div>
            </div>
          )}
          <form onSubmit={handleSave} className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2"><User size={18} /> Personal Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Full Name</label>
                  <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email</label>
                  <div className="flex items-center gap-2">
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required />
                    {user?.emailVerified ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 whitespace-nowrap"><CheckCircle size={14} /> Verified</span>
                    ) : (
                      <Link to="/verify-account" className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 whitespace-nowrap"><AlertCircle size={14} /> Verify</Link>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Phone Number</label>
                  <div className="flex items-center gap-2">
                    <input type="tel" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="+64 21 123 4567" />
                    {form.phoneNumber && (
                      user?.phoneVerified ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 whitespace-nowrap"><CheckCircle size={14} /> Verified</span>
                      ) : (
                        <Link to="/verify-account" className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 whitespace-nowrap"><AlertCircle size={14} /> Verify</Link>
                      )
                    )}
                  </div>
                  {form.phoneNumber && !user?.phoneVerified && (
                    <p className="text-xs text-amber-600 mt-1">Phone number needs verification</p>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2"><MapPin size={18} /> Addresses</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-blue-700">
                  <strong>Privacy:</strong> Your street address is never shown to finders. Only your suburb and city are visible when someone finds your pet.
                </p>
              </div>
              <p className="text-xs text-gray-500 mb-2">Manage up to 5 saved addresses. Set one as your preferred address for checkout.</p>
              {user && <AddressManager userId={user.id || ''} onChange={() => refreshUser?.()} apiClient={api} />}
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Phone size={18} /> Emergency Contact</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-blue-700">
                  <strong>Why this matters:</strong> If your pet is found and you don't respond within 30 minutes, PawTag will automatically notify your emergency contact via email so they can help reunite you with your pet. Your emergency contact details are never visible to finders — they are only used by PawTag's automatic escalation system.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs text-gray-500 mb-1">Contact Name</label><input value={form.emergencyContact.name} onChange={(e) => setForm({ ...form, emergencyContact: { ...form.emergencyContact, name: e.target.value } })} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs text-gray-500 mb-1">Relationship</label><select value={form.emergencyContact.relationship} onChange={(e) => setForm({ ...form, emergencyContact: { ...form.emergencyContact, relationship: e.target.value } })} className="w-full border rounded-md px-3 py-2 text-sm"><option value="">Select...</option>{relationshipOptions.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
                <div><label className="block text-xs text-gray-500 mb-1">Phone</label><input type="tel" value={form.emergencyContact.phone} onChange={(e) => setForm({ ...form, emergencyContact: { ...form.emergencyContact, phone: e.target.value } })} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs text-gray-500 mb-1">Email</label><input type="email" value={form.emergencyContact.email} onChange={(e) => setForm({ ...form, emergencyContact: { ...form.emergencyContact, email: e.target.value } })} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
              </div>
            </div>
            <button type="submit" disabled={saving} className={buttonClassName({ size: 'lg' })}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </>
      )}

      {/* ============================= SECURITY ============================ */}
      {tab === 'security' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 inline-flex items-center gap-2">
              <ShieldCheck size={18} className="text-primary-600" /> Account security
            </h2>
            <p className="text-sm text-gray-500 mt-1">Keep your account and pets safe.</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
            <div className="flex items-center gap-3 px-5 py-4">
              <span className="w-9 h-9 shrink-0 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                <Mail size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500">Email address</p>
                <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
              </div>
              {user?.emailVerified ? (
                <StatusBadge label="Verified" variant="success" />
              ) : (
                <Link to="/verify-account" className="text-xs font-semibold text-amber-600 hover:text-amber-800 whitespace-nowrap">
                  Verify now
                </Link>
              )}
            </div>
            <div className="flex items-center gap-3 px-5 py-4">
              <span className="w-9 h-9 shrink-0 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                <Phone size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500">Mobile number</p>
                <p className="text-sm font-medium text-gray-900 truncate">{user?.phoneNumber || 'Not added yet'}</p>
              </div>
              {!user?.phoneNumber ? (
                <Link to="/account/profile" className="text-xs font-semibold text-primary-600 hover:text-primary-700 whitespace-nowrap">
                  Add in Profile
                </Link>
              ) : user?.phoneVerified ? (
                <StatusBadge label="Verified" variant="success" />
              ) : (
                <Link to="/verify-account" className="text-xs font-semibold text-amber-600 hover:text-amber-800 whitespace-nowrap">
                  Verify now
                </Link>
              )}
            </div>
          </div>

          <ChangePasswordForm />
        </div>
      )}

      {/* =========================== PREFERENCES =========================== */}
      {tab === 'preferences' && <NotificationPreferences hideHeader />}
    </div>
  );
}

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    if (newPassword !== confirmPassword) { setError('New passwords do not match'); return; }
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) { setError(passwordValidation.error!); return; }
    setSaving(true);
    try { await api.post(API.auth.changePassword, { currentPassword, newPassword }); toast.success('Password changed successfully'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }
    catch (err: any) { setError(err.response?.data?.error || 'Failed to change password'); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleChangePassword} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2"><Lock size={18} /> Change Password</h2>
      {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl">{error}</div>}
      <div className="grid grid-cols-1 gap-4 max-w-md">
        <div><label className="block text-xs text-gray-500 mb-1">Current Password</label><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required /></div>
        <div><label className="block text-xs text-gray-500 mb-1">New Password</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required minLength={8} /></div>
        <div><label className="block text-xs text-gray-500 mb-1">Confirm New Password</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required minLength={8} /></div>
      </div>
      <button type="submit" disabled={saving} className={buttonClassName({ variant: 'secondary' })}>
        <Lock size={14} /> {saving ? 'Changing...' : 'Change Password'}
      </button>
    </form>
  );
}
