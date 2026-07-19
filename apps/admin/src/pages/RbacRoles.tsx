import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Shield, Plus, X, Save, Copy, Trash2, Check, ChevronDown, ChevronRight } from 'lucide-react';

interface Role {
  _id: string;
  name: string;
  displayName: string;
  description?: string;
  roleType: string;
  isSystemRole: boolean;
  isSuperAdmin: boolean;
  isActive: boolean;
}

interface PermissionGroup {
  _id: string;
  name: string;
  displayName: string;
  sortOrder: number;
}

interface Permission {
  _id: string;
  name: string;
  displayName: string;
  description?: string;
  resource: string;
  action: string;
  permissionGroupId: string;
}

interface Scope {
  _id: string;
  code: string;
  name: string;
}

interface RolePermission {
  _id: string;
  roleId: string;
  permissionId: Permission;
  scopeId?: Scope;
}

export default function RbacRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: '', displayName: '', description: '' });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Permission assignment state
  const [permRole, setPermRole] = useState<Role | null>(null);
  const [permGroups, setPermGroups] = useState<PermissionGroup[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [rolePerms, setRolePerms] = useState<RolePermission[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const fetchRoles = () => {
    setLoading(true);
    api.get('/admin/rbac/roles').then((res) => setRoles(res.data.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchRoles(); }, []);

  const createRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      await api.post('/admin/rbac/roles', form);
      setFormSuccess('Role created successfully!');
      setForm({ name: '', displayName: '', description: '' });
      setShowCreate(false);
      fetchRoles();
      setTimeout(() => setFormSuccess(''), 3000);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to create role');
    }
  };

  const updateRole = async (id: string, data: any) => {
    try {
      await api.put(`/admin/rbac/roles/${id}`, data);
      fetchRoles();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update role');
    }
  };

  const deleteRole = async (role: Role) => {
    if (!window.confirm(`Delete role "${role.displayName}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/rbac/roles/${role._id}`);
      fetchRoles();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete role');
    }
  };

  const cloneRole = async (id: string) => {
    try {
      await api.post(`/admin/rbac/roles/${id}/clone`);
      fetchRoles();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to clone role');
    }
  };

  // Permission assignment
  const openPermManager = async (role: Role) => {
    setPermRole(role);
    try {
      const [pgRes, pRes, sRes, rpRes] = await Promise.all([
        api.get('/admin/rbac/permission-groups'),
        api.get('/admin/rbac/permissions'),
        api.get('/admin/rbac/scopes'),
        api.get(`/admin/rbac/roles/${role._id}/permissions`),
      ]);
      setPermGroups(pgRes.data.data);
      setPermissions(pRes.data.data);
      setScopes(sRes.data.data);
      setRolePerms(rpRes.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const togglePermission = async (permissionId: string, scopeId?: string) => {
    if (!permRole) return;
    const existing = rolePerms.find((rp) => rp.permissionId._id === permissionId);
    if (existing) {
      await api.delete(`/admin/rbac/roles/${permRole._id}/permissions/${permissionId}`);
    } else {
      await api.post(`/admin/rbac/roles/${permRole._id}/permissions`, { permissionId, scopeId });
    }
    const rpRes = await api.get(`/admin/rbac/roles/${permRole._id}/permissions`);
    setRolePerms(rpRes.data.data);
  };

  const toggleGroup = (groupId: string) => {
    const next = new Set(expandedGroups);
    if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
    setExpandedGroups(next);
  };

  const permsByGroup = (groupId: string) =>
    permissions.filter((p) => p.permissionGroupId === groupId);

  const getPermissionScope = (permId: string): string | undefined => {
    const rp = rolePerms.find((r) => r.permissionId._id === permId);
    return rp?.scopeId?._id;
  };

  const hasPermission = (permId: string) =>
    rolePerms.some((rp) => rp.permissionId._id === permId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Role Management</h1>
        <button onClick={() => setShowCreate(!showCreate)} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm flex items-center gap-1.5 hover:bg-primary-700">
          <Plus size={14} /> Create Role
        </button>
      </div>

      {formSuccess && <div className="bg-green-50 text-green-600 text-sm p-3 rounded">{formSuccess}</div>}

      {showCreate && (
        <form onSubmit={createRole} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Create New Role</h2>
            <button type="button" onClick={() => { setShowCreate(false); setFormError(''); }} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
          </div>
          {formError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{formError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name (uppercase, no spaces) *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })} className="w-full border rounded-md px-3 py-2 text-sm font-mono" required maxLength={50} placeholder="e.g. EDITOR" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Display Name *</label>
              <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required maxLength={100} placeholder="e.g. Editor" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" rows={2} maxLength={500} placeholder="What this role can do..." />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 flex items-center gap-1"><Save size={14} /> Create Role</button>
            <button type="button" onClick={() => setShowCreate(false)} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Role Name</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Display Name</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Type</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Super Admin</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : roles.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">No roles found</td></tr>
            ) : roles.map((role) => (
              <tr key={role._id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-mono font-medium">{role.name}</td>
                <td className="px-5 py-3">{role.displayName}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${role.roleType === 'system' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {role.roleType}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => updateRole(role._id, { isActive: !role.isActive })}
                    className={`text-xs px-2 py-0.5 rounded-full ${role.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                  >
                    {role.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-5 py-3">
                  {role.isSuperAdmin ? <Check size={16} className="text-green-600" /> : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openPermManager(role)} title="Manage permissions" className="p-1.5 rounded hover:bg-blue-100 text-blue-600"><Shield size={14} /></button>
                    {!role.isSystemRole && (
                      <>
                        <button onClick={() => { setEditingRole(role); setForm({ name: role.name, displayName: role.displayName, description: role.description || '' }); }} title="Edit role" className="p-1.5 rounded hover:bg-yellow-100 text-yellow-600"><Save size={14} /></button>
                        <button onClick={() => cloneRole(role._id)} title="Clone role" className="p-1.5 rounded hover:bg-green-100 text-green-600"><Copy size={14} /></button>
                        <button onClick={() => deleteRole(role)} title="Delete role" className="p-1.5 rounded hover:bg-red-100 text-red-500"><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Permission Assignment Modal */}
      {permRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <div>
                <h3 className="text-lg font-semibold">Manage Permissions</h3>
                <p className="text-sm text-gray-500">{permRole.displayName} ({permRole.name})</p>
              </div>
              <button onClick={() => setPermRole(null)} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {permGroups.sort((a, b) => a.sortOrder - b.sortOrder).map((group) => {
                const groupPerms = permsByGroup(group._id);
                if (groupPerms.length === 0) return null;
                const enabledCount = groupPerms.filter((p) => hasPermission(p._id)).length;
                return (
                  <div key={group._id} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleGroup(group._id)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
                    >
                      <div className="flex items-center gap-2">
                        {expandedGroups.has(group._id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span className="font-medium">{group.displayName}</span>
                        <span className="text-xs text-gray-400">({enabledCount}/{groupPerms.length})</span>
                      </div>
                    </button>
                    {expandedGroups.has(group._id) && (
                      <div className="divide-y">
                        {groupPerms.map((perm) => (
                          <div key={perm._id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                            <div className="flex items-center gap-3 flex-1">
                              <input
                                type="checkbox"
                                checked={hasPermission(perm._id)}
                                onChange={() => togglePermission(perm._id)}
                                className="rounded"
                              />
                              <div>
                                <span className="text-sm font-medium">{perm.displayName}</span>
                                <span className="text-xs text-gray-400 ml-2 font-mono">{perm.name}</span>
                                {perm.description && <p className="text-xs text-gray-500 mt-0.5">{perm.description}</p>}
                              </div>
                            </div>
                            {hasPermission(perm._id) && scopes.length > 0 && (
                              <select
                                value={getPermissionScope(perm._id) || ''}
                                onChange={(e) => togglePermission(perm._id, e.target.value || undefined)}
                                className="border border-gray-200 rounded px-2 py-1 text-xs"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="">No scope</option>
                                {scopes.map((s) => (
                                  <option key={s._id} value={s._id}>{s.code} - {s.name}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="border-t p-4 flex justify-end">
              <button onClick={() => setPermRole(null)} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editingRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Edit Role: {editingRole.displayName}</h3>
              <button onClick={() => setEditingRole(null)} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Display Name</label>
              <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" rows={3} />
            </div>
            <div className="flex gap-2">
              <button onClick={async () => {
                try {
                  await api.put(`/admin/rbac/roles/${editingRole._id}`, { displayName: form.displayName, description: form.description });
                  setEditingRole(null);
                  fetchRoles();
                } catch (err: any) { alert(err.response?.data?.error || 'Failed to update role'); }
              }} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700">Save</button>
              <button onClick={() => setEditingRole(null)} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
