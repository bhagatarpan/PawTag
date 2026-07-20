import { useState, useEffect, FormEvent } from 'react';
import { User, MapPin, Phone, Lock, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', phoneNumber: '', address: { line1: '', line2: '', city: '', state: '', zip: '', country: '' }, emergencyContact: { name: '', phone: '', email: '', relationship: '' } });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [responsibility, setResponsibility] = useState<any>(null);

  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName || '', email: user.email || '', phoneNumber: user.phoneNumber || '',
        address: { line1: user.address?.line1 || '', line2: user.address?.line2 || '', city: user.address?.city || '', state: user.address?.state || '', zip: user.address?.zip || '', country: user.address?.country || '' },
        emergencyContact: { name: user.emergencyContact?.name || '', phone: user.emergencyContact?.phone || '', email: user.emergencyContact?.email || '', relationship: user.emergencyContact?.relationship || '' },
      });
    }
    api.get('/customer/responsibility').then((r) => setResponsibility(r.data.data)).catch(() => {});
  }, [user]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setMsg(''); setError('');
    try { await api.put('/auth/profile', form); setMsg('Profile updated successfully'); refreshUser(); }
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
      {msg && <div className="bg-green-50 text-green-700 text-sm p-3 rounded mb-4">{msg}</div>}
      {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded mb-4">{error}</div>}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><User size={18} /> Personal Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs text-gray-500 mb-1">Full Name</label><input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Phone Number</label><input type="tel" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="+64 21 123 4567" /></div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><MapPin size={18} /> Address</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">Street Address</label><input value={form.address.line1} onChange={(e) => setForm({ ...form, address: { ...form.address, line1: e.target.value } })} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
            <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">Address Line 2</label><input value={form.address.line2} onChange={(e) => setForm({ ...form, address: { ...form.address, line2: e.target.value } })} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">City</label><input value={form.address.city} onChange={(e) => setForm({ ...form, address: { ...form.address, city: e.target.value } })} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">State / Region</label><input value={form.address.state} onChange={(e) => setForm({ ...form, address: { ...form.address, state: e.target.value } })} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Postal Code</label><input value={form.address.zip} onChange={(e) => setForm({ ...form, address: { ...form.address, zip: e.target.value } })} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Country</label><input value={form.address.country} onChange={(e) => setForm({ ...form, address: { ...form.address, country: e.target.value } })} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Phone size={18} /> Emergency Contact</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs text-gray-500 mb-1">Contact Name</label><input value={form.emergencyContact.name} onChange={(e) => setForm({ ...form, emergencyContact: { ...form.emergencyContact, name: e.target.value } })} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Relationship</label><input value={form.emergencyContact.relationship} onChange={(e) => setForm({ ...form, emergencyContact: { ...form.emergencyContact, relationship: e.target.value } })} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="e.g. Spouse, Parent" /></div>
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
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault(); setMsg(''); setError('');
    if (newPassword !== confirmPassword) { setError('New passwords do not match'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    setSaving(true);
    try { await api.post('/auth/change-password', { currentPassword, newPassword }); setMsg('Password changed successfully'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }
    catch (err: any) { setError(err.response?.data?.error || 'Failed to change password'); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleChangePassword} className="bg-white rounded-lg border p-6 space-y-4 mt-6">
      <h2 className="text-lg font-semibold flex items-center gap-2"><Lock size={18} /> Change Password</h2>
      {msg && <div className="bg-green-50 text-green-700 text-sm p-3 rounded">{msg}</div>}
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
