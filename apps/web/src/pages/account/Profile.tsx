import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { User, MapPin, Phone, Lock, Save, Gift, CheckCircle, AlertCircle } from 'lucide-react';
import { AddressAutocomplete } from '@pawtag/ui';
import type { AddressComponents } from '@pawtag/ui';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import SaveToast from '../../components/SaveToast';
import { validatePassword } from '@pawtag/shared';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', phoneNumber: '', address: { line1: '', line2: '', city: '', state: '', zip: '', country: '' }, emergencyContact: { name: '', phone: '', email: '', relationship: '' } });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const [responsibility, setResponsibility] = useState<any>(null);
  const [relationshipOptions, setRelationshipOptions] = useState<string[]>([]);
  const [referredBy, setReferredBy] = useState<any>(null);

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
      await api.put('/auth/profile', payload); setShowSaved(true); refreshUser();
    }
    catch (err: any) { setError(err.response?.data?.error || 'Update failed'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Profile & Personal Details</h1>
      {responsibility && (
        <div className={`rounded-lg border p-4 mb-6 flex items-center gap-4 ${responsibility.color === 'green' ? 'bg-green-50 border-green-200' : responsibility.color === 'amber' ? 'bg-amber-50 border-amber-200' : responsibility.color === 'orange' ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'}`}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${responsibility.color === 'green' ? 'bg-green-500' : responsibility.color === 'amber' ? 'bg-amber-500' : responsibility.color === 'orange' ? 'bg-orange-500' : 'bg-red-500'}`}>{responsibility.score}</div>
          <div><p className="font-semibold">{responsibility.rating}</p><p className="text-sm text-gray-600">Pet Responsibility Score — {responsibility.pets?.length || 0} pets registered</p></div>
        </div>
      )}
      {showSaved && <SaveToast message="Profile updated successfully" onDone={() => setShowSaved(false)} />}
      {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded mb-4">{error}</div>}
      {referredBy && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-6 flex items-center gap-3">
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
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><User size={18} /> Personal Information</h2>
          <div className="grid grid-cols-2 gap-4">
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
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><MapPin size={18} /> Address</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-xs text-blue-700">
              <strong>Privacy:</strong> Your street address is never shown to finders. Only your suburb and city are visible when someone finds your pet.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Street Address</label>
              <AddressAutocomplete
                value={form.address.line1}
                onChange={(val) => setForm(prev => ({ ...prev, address: { ...prev.address, line1: val } }))}
                onAddressSelect={handleAddressSelect}
                placeholder="123 Main St"
              />
            </div>
            <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">Suburb</label><input value={form.address.line2} onChange={(e) => setForm({ ...form, address: { ...form.address, line2: e.target.value } })} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="e.g. Ponsonby" /><p className="text-xs text-gray-400 mt-1">Shown to finders when your pet is found</p></div>
            <div><label className="block text-xs text-gray-500 mb-1">City</label><input value={form.address.city} onChange={(e) => setForm({ ...form, address: { ...form.address, city: e.target.value } })} className="w-full border rounded-md px-3 py-2 text-sm" /><p className="text-xs text-gray-400 mt-1">Shown to finders when your pet is found</p></div>
            <div><label className="block text-xs text-gray-500 mb-1">State / Region</label><input value={form.address.state} onChange={(e) => setForm({ ...form, address: { ...form.address, state: e.target.value } })} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Postal Code</label><input value={form.address.zip} onChange={(e) => setForm({ ...form, address: { ...form.address, zip: e.target.value } })} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Country</label><input value={form.address.country} onChange={(e) => setForm({ ...form, address: { ...form.address, country: e.target.value } })} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Phone size={18} /> Emergency Contact</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs text-gray-500 mb-1">Contact Name</label><input value={form.emergencyContact.name} onChange={(e) => setForm({ ...form, emergencyContact: { ...form.emergencyContact, name: e.target.value } })} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Relationship</label><select value={form.emergencyContact.relationship} onChange={(e) => setForm({ ...form, emergencyContact: { ...form.emergencyContact, relationship: e.target.value } })} className="w-full border rounded-md px-3 py-2 text-sm"><option value="">Select...</option>{relationshipOptions.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
            <div><label className="block text-xs text-gray-500 mb-1">Phone</label><input type="tel" value={form.emergencyContact.phone} onChange={(e) => setForm({ ...form, emergencyContact: { ...form.emergencyContact, phone: e.target.value } })} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Email</label><input type="email" value={form.emergencyContact.email} onChange={(e) => setForm({ ...form, emergencyContact: { ...form.emergencyContact, email: e.target.value } })} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          </div>
        </div>
        <button type="submit" disabled={saving} className="bg-teal-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-teal-700 flex items-center gap-2 disabled:opacity-50"><Save size={14} /> {saving ? 'Saving...' : 'Save Profile'}</button>
      </form>
      <ChangePasswordForm />
    </div>
  );
}

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [error, setError] = useState('');

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    if (newPassword !== confirmPassword) { setError('New passwords do not match'); return; }
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) { setError(passwordValidation.error!); return; }
    setSaving(true);
    try { await api.post('/auth/change-password', { currentPassword, newPassword }); setShowSaved(true); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }
    catch (err: any) { setError(err.response?.data?.error || 'Failed to change password'); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleChangePassword} className="bg-white rounded-lg border p-6 space-y-4 mt-6">
      <h2 className="text-lg font-semibold flex items-center gap-2"><Lock size={18} /> Change Password</h2>
      {showSaved && <SaveToast message="Password changed successfully" onDone={() => setShowSaved(false)} />}
      {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{error}</div>}
      <div className="grid grid-cols-1 gap-4 max-w-md">
        <div><label className="block text-xs text-gray-500 mb-1">Current Password</label><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required /></div>
        <div><label className="block text-xs text-gray-500 mb-1">New Password</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required minLength={8} /></div>
        <div><label className="block text-xs text-gray-500 mb-1">Confirm New Password</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" required minLength={8} /></div>
      </div>
      <button type="submit" disabled={saving} className="bg-teal-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-teal-700 flex items-center gap-2 disabled:opacity-50"><Lock size={14} /> {saving ? 'Changing...' : 'Change Password'}</button>
    </form>
  );
}
