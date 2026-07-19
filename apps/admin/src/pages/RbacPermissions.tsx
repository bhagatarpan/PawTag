import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Plus, X, Save, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

interface PermissionGroup {
  _id: string;
  name: string;
  displayName: string;
}

interface Permission {
  _id: string;
  name: string;
  displayName: string;
  description?: string;
  resource: string;
  action: string;
  permissionGroupId: any;
  isActive: boolean;
}

export default function RbacPermissions() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', displayName: '', description: '', resource: '', action: '', permissionGroupId: '' });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const fetch = () => {
    setLoading(true);
    const params: any = {};
    if (groupFilter) params.groupId = groupFilter;
    Promise.all([
      api.get('/admin/rbac/permissions', { params }),
      api.get('/admin/rbac/permission-groups'),
    ]).then(([pRes, gRes]) => {
      setPermissions(pRes.data.data);
      setGroups(gRes.data.data);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [groupFilter]);

  const createPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      await api.post('/admin/rbac/permissions', form);
      setFormSuccess('Permission created!');
      setForm({ name: '', displayName: '', description: '', resource: '', action: '', permissionGroupId: '' });
      setShowCreate(false);
      fetch();
      setTimeout(() => setFormSuccess(''), 3000);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to create permission');
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await api.put(`/admin/rbac/permissions/${id}`, { isActive: !current });
      fetch();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update permission');
    }
  };

  const deletePermission = async (perm: Permission) => {
    if (!window.confirm(`Delete permission "${perm.displayName}"?`)) return;
    try {
      await api.delete(`/admin/rbac/permissions/${perm._id}`);
      fetch();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete permission');
    }
  };

  const groupName = (groupRef: any): string => {
    if (!groupRef) return '—';
    const groupId = typeof groupRef === 'string' ? groupRef : groupRef?._id;
    if (!groupId) return '—';
    return groups.find((g) => g._id === groupId)?.displayName || (typeof groupRef === 'string' ? groupRef : groupRef?.name || groupId);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Permission Management</h1>
        <button onClick={() => setShowCreate(!showCreate)} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm flex items-center gap-1.5 hover:bg-primary-700">
          <Plus size={14} /> Create Permission
        </button>
      </div>

      {formSuccess && <div className="bg-green-50 text-green-600 text-sm p-3 rounded">{formSuccess}</div>}

      {showCreate && (
        <form onSubmit={createPermission} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Create New Permission</h2>
            <button type="button" onClick={() => { setShowCreate(false); setFormError(''); }} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
          </div>
          {formError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{formError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name (lowercase: resource.action) *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase() })} className="w-full border rounded-md px-3 py-2 text-sm font-mono" required placeholder="e.g. pet.read" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Display Name *</label>
              <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required placeholder="e.g. Read Pets" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Resource *</label>
              <input value={form.resource} onChange={(e) => setForm({ ...form, resource: e.target.value.toLowerCase() })} className="w-full border rounded-md px-3 py-2 text-sm font-mono" required placeholder="e.g. pet" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Action *</label>
              <input value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value.toLowerCase() })} className="w-full border rounded-md px-3 py-2 text-sm font-mono" required placeholder="e.g. read" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Permission Group *</label>
              <select value={form.permissionGroupId} onChange={(e) => setForm({ ...form, permissionGroupId: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required>
                <option value="">Select group...</option>
                {groups.sort((a, b) => a.name.localeCompare(b.name)).map((g) => (
                  <option key={g._id} value={g._id}>{g.displayName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" maxLength={500} placeholder="What this permission allows..." />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 flex items-center gap-1"><Save size={14} /> Create Permission</button>
            <button type="button" onClick={() => setShowCreate(false)} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="flex gap-4 items-center">
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
          <option value="">All Groups</option>
          {groups.sort((a, b) => a.name.localeCompare(b.name)).map((g) => (
            <option key={g._id} value={g._id}>{g.displayName}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500">{permissions.length} permissions</span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Permission</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Display Name</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Group</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Resource</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Action</th>
              <th className="text-center px-5 py-3 font-medium text-gray-500">Active</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : permissions.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-500">No permissions found</td></tr>
            ) : permissions.map((perm) => (
              <tr key={perm._id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-mono text-sm">{perm.name}</td>
                <td className="px-5 py-3">{perm.displayName}</td>
                <td className="px-5 py-3 text-xs text-gray-500">{groupName(perm.permissionGroupId)}</td>
                <td className="px-5 py-3 font-mono text-xs">{perm.resource}</td>
                <td className="px-5 py-3 font-mono text-xs">{perm.action}</td>
                <td className="px-5 py-3 text-center">
                  <button onClick={() => toggleActive(perm._id, perm.isActive)} className="text-gray-500 hover:text-primary-600">
                    {perm.isActive ? <ToggleRight size={18} className="text-green-600" /> : <ToggleLeft size={18} />}
                  </button>
                </td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => deletePermission(perm)} title="Delete permission" className="p-1.5 rounded hover:bg-red-100 text-red-500"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
