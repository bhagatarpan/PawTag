import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Plus, X, Save, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

interface PermissionGroup {
  _id: string;
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
}

export default function RbacPermissionGroups() {
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PermissionGroup | null>(null);
  const [form, setForm] = useState({ name: '', displayName: '', description: '', icon: '', sortOrder: 0 });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const fetch = () => {
    setLoading(true);
    api.get('/admin/rbac/permission-groups').then((res) => setGroups(res.data.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      await api.post('/admin/rbac/permission-groups', form);
      setFormSuccess('Permission group created!');
      setForm({ name: '', displayName: '', description: '', icon: '', sortOrder: 0 });
      setShowCreate(false);
      fetch();
      setTimeout(() => setFormSuccess(''), 3000);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to create permission group');
    }
  };

  const updateGroup = async () => {
    if (!editingGroup) return;
    try {
      await api.put(`/admin/rbac/permission-groups/${editingGroup._id}`, form);
      setEditingGroup(null);
      fetch();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update permission group');
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await api.put(`/admin/rbac/permission-groups/${id}`, { isActive: !current });
      fetch();
    } catch (err: any) { console.error(err); }
  };

  const deleteGroup = async (group: PermissionGroup) => {
    if (!window.confirm(`Delete permission group "${group.displayName}"?`)) return;
    try {
      await api.delete(`/admin/rbac/permission-groups/${group._id}`);
      fetch();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete permission group');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Permission Groups</h1>
        <button onClick={() => setShowCreate(!showCreate)} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm flex items-center gap-1.5 hover:bg-primary-700">
          <Plus size={14} /> Create Group
        </button>
      </div>

      {formSuccess && <div className="bg-green-50 text-green-600 text-sm p-3 rounded">{formSuccess}</div>}

      {showCreate && (
        <form onSubmit={createGroup} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Create Permission Group</h2>
            <button type="button" onClick={() => { setShowCreate(false); setFormError(''); }} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
          </div>
          {formError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{formError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name (uppercase, underscores) *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })} className="w-full border rounded-md px-3 py-2 text-sm font-mono" required placeholder="e.g. PET_MANAGEMENT" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Display Name *</label>
              <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required placeholder="e.g. Pet Management" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Icon (lucide icon name)</label>
              <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="e.g. PawPrint" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sort Order</label>
              <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} className="w-full border rounded-md px-3 py-2 text-sm" min={0} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" rows={2} maxLength={500} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700"><Save size={14} /> Create</button>
            <button type="button" onClick={() => setShowCreate(false)} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Order</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Display Name</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Icon</th>
              <th className="text-center px-5 py-3 font-medium text-gray-500">Active</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : groups.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">No permission groups</td></tr>
            ) : groups.sort((a, b) => a.sortOrder - b.sortOrder).map((group) => (
              <tr key={group._id} className="hover:bg-gray-50">
                <td className="px-5 py-3 text-gray-400 text-xs">{group.sortOrder}</td>
                <td className="px-5 py-3 font-mono text-sm">{group.name}</td>
                <td className="px-5 py-3">{group.displayName}</td>
                <td className="px-5 py-3 text-gray-400 font-mono text-xs">{group.icon || '—'}</td>
                <td className="px-5 py-3 text-center">
                  <button onClick={() => toggleActive(group._id, group.isActive)}>
                    {group.isActive ? <ToggleRight size={18} className="text-green-600" /> : <ToggleLeft size={18} className="text-gray-400" />}
                  </button>
                </td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => { setEditingGroup(group); setForm({ name: group.name, displayName: group.displayName, description: group.description || '', icon: group.icon || '', sortOrder: group.sortOrder }); }} className="p-1.5 rounded hover:bg-yellow-100 text-yellow-600"><Save size={14} /></button>
                  <button onClick={() => deleteGroup(group)} className="p-1.5 rounded hover:bg-red-100 text-red-500"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Edit: {editingGroup.displayName}</h3>
              <button onClick={() => setEditingGroup(null)} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Display Name</label>
              <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Icon</label>
                <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Sort Order</label>
                <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={updateGroup} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm"><Save size={14} /> Save</button>
              <button onClick={() => setEditingGroup(null)} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
