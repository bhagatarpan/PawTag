import { useEffect, useState, useMemo } from 'react';
import api from '../lib/api';
import { toast } from '../lib/toast';
import {
  Shield, Plus, X, Save, Copy, Trash2, Check, ChevronDown, ChevronRight,
  Search, Loader2, Users, Crown, Settings, Key, Eye, EyeOff, Pencil,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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
  icon?: string;
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

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function RbacRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: '', displayName: '', description: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [cloning, setCloning] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Permission assignment state
  const [permRole, setPermRole] = useState<Role | null>(null);
  const [permGroups, setPermGroups] = useState<PermissionGroup[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [rolePerms, setRolePerms] = useState<RolePermission[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [permSearch, setPermSearch] = useState('');
  const [permLoading, setPermLoading] = useState(false);

  const fetchRoles = () => {
    setLoading(true);
    api.get('/admin/rbac/roles')
      .then((res) => setRoles(res.data.data))
      .catch(() => toast.error('Failed to load roles'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRoles(); }, []);

  /* Summary */
  const summary = useMemo(() => ({
    total: roles.length,
    active: roles.filter((r) => r.isActive).length,
    system: roles.filter((r) => r.isSystemRole).length,
    custom: roles.filter((r) => !r.isSystemRole).length,
  }), [roles]);

  /* Filtered */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return roles.filter((r) =>
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.displayName.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q)
    );
  }, [roles, search]);

  /* CRUD */
  const resetForm = () => setForm({ name: '', displayName: '', description: '' });

  const createRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await api.post('/admin/rbac/roles', form);
      toast.success('Role created');
      resetForm();
      setShowCreate(false);
      fetchRoles();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  const updateRole = async (id: string, data: any) => {
    try {
      await api.put(`/admin/rbac/roles/${id}`, data);
      toast.success(data.isActive !== undefined ? (data.isActive ? 'Activated' : 'Deactivated') : 'Role updated');
      fetchRoles();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update');
    }
  };

  const deleteRole = async (role: Role) => {
    if (!window.confirm(`Delete "${role.displayName}"? This cannot be undone.`)) return;
    setDeleting(role._id);
    try {
      await api.delete(`/admin/rbac/roles/${role._id}`);
      toast.success(`"${role.displayName}" deleted`);
      fetchRoles();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const cloneRole = async (role: Role) => {
    setCloning(role._id);
    try {
      await api.post(`/admin/rbac/roles/${role._id}/clone`);
      toast.success(`"${role.displayName}" cloned`);
      fetchRoles();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to clone');
    } finally {
      setCloning(null);
    }
  };

  /* Permission Assignment */
  const openPermManager = async (role: Role) => {
    setPermRole(role);
    setPermLoading(true);
    setPermSearch('');
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
      // Auto-expand groups that have assigned permissions
      const assignedGroupIds = new Set<string>(
        rpRes.data.data.map((rp: RolePermission) => {
          const perm = permissions.find((p) => p._id === rp.permissionId._id);
          return perm?.permissionGroupId;
        }).filter((id: string | undefined): id is string => Boolean(id))
      );
      setExpandedGroups(assignedGroupIds);
    } catch {
      toast.error('Failed to load permissions');
    } finally {
      setPermLoading(false);
    }
  };

  const togglePermission = async (permissionId: string, scopeId?: string) => {
    if (!permRole) return;
    const existing = rolePerms.find((rp) => rp.permissionId._id === permissionId);
    try {
      if (existing) {
        await api.delete(`/admin/rbac/roles/${permRole._id}/permissions/${permissionId}`);
      } else {
        await api.post(`/admin/rbac/roles/${permRole._id}/permissions`, { permissionId, scopeId });
      }
      const rpRes = await api.get(`/admin/rbac/roles/${permRole._id}/permissions`);
      setRolePerms(rpRes.data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update permission');
    }
  };

  const toggleGroup = (groupId: string) => {
    const next = new Set(expandedGroups);
    if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
    setExpandedGroups(next);
  };

  const expandAll = () => {
    const allGroupIds = new Set(filteredPermGroups.map((g) => g._id));
    setExpandedGroups(allGroupIds);
  };

  const collapseAll = () => setExpandedGroups(new Set());

  const permsByGroup = (groupId: string) => {
    const q = permSearch.toLowerCase();
    return permissions.filter((p) =>
      p.permissionGroupId === groupId &&
      (!q || p.name.toLowerCase().includes(q) || p.displayName.toLowerCase().includes(q) || p.resource.toLowerCase().includes(q))
    );
  };

  const filteredPermGroups = useMemo(() => {
    if (!permSearch) return permGroups.sort((a, b) => a.sortOrder - b.sortOrder);
    const q = permSearch.toLowerCase();
    const matchingGroupIds = new Set(
      permissions.filter((p) => p.name.toLowerCase().includes(q) || p.displayName.toLowerCase().includes(q) || p.resource.toLowerCase().includes(q))
        .map((p) => p.permissionGroupId)
    );
    return permGroups.filter((g) => matchingGroupIds.has(g._id)).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [permGroups, permissions, permSearch]);

  const getPermissionScope = (permId: string): string | undefined => {
    const rp = rolePerms.find((r) => r.permissionId._id === permId);
    return rp?.scopeId?._id;
  };

  const hasPermission = (permId: string) =>
    rolePerms.some((rp) => rp.permissionId._id === permId);

  const totalAssigned = rolePerms.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Role Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{summary.total} role{summary.total !== 1 ? 's' : ''} configured</p>
        </div>
        <button onClick={() => { setShowCreate(!showCreate); resetForm(); setFormError(''); }} className="bg-primary-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-primary-700 shadow-sm transition-all">
          <Plus size={16} /> Create Role
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Roles', value: summary.total, color: 'bg-white border-gray-200' },
          { label: 'Active', value: summary.active, color: 'bg-emerald-50 border-emerald-200', textColor: 'text-emerald-700' },
          { label: 'System', value: summary.system, color: 'bg-purple-50 border-purple-200', textColor: 'text-purple-700' },
          { label: 'Custom', value: summary.custom, color: 'bg-blue-50 border-blue-200', textColor: 'text-blue-700' },
        ].map((s) => (
          <div key={s.label} className={`${s.color} border rounded-xl p-4`}>
            <p className="text-xs text-gray-500 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.textColor || 'text-gray-900'}`}>
              {loading ? <span className="inline-block w-8 h-7 bg-gray-200 rounded animate-pulse" /> : s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Create Form */}
      {showCreate && (
        <form onSubmit={createRole} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4 animate-slide-up">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Create New Role</h2>
            <button type="button" onClick={() => { setShowCreate(false); setFormError(''); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <X size={18} />
            </button>
          </div>
          {formError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">{formError}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Name (uppercase, no spaces) *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase().replace(/\s+/g, '_') })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" required maxLength={50} placeholder="e.g. EDITOR" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Display Name *</label>
              <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" required maxLength={100} placeholder="e.g. Editor" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" rows={2} maxLength={500} placeholder="What this role can do..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-700 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Create Role
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="border border-gray-200 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Search */}
      {!showCreate && !editingRole && !permRole && (
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search roles..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Role</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Type</th>
              <th className="text-center px-5 py-3 font-medium text-gray-500 w-20">Active</th>
              <th className="text-center px-5 py-3 font-medium text-gray-500 w-24">Super Admin</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500 w-36">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 bg-gray-100 rounded-lg animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
                        <div className="h-3 w-48 bg-gray-50 rounded animate-pulse" />
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center">
                  <Shield size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">{search ? 'No roles match your search' : 'No roles yet'}</p>
                  <p className="text-gray-400 text-sm mt-1">{search ? 'Try a different search term' : 'Create your first role to get started'}</p>
                </td>
              </tr>
            ) : filtered.map((role) => (
              <tr key={role._id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${role.isActive ? 'bg-primary-50' : 'bg-gray-100'}`}>
                      {role.isSuperAdmin ? <Crown size={18} className={role.isActive ? 'text-amber-600' : 'text-gray-400'} /> : <Shield size={18} className={role.isActive ? 'text-primary-600' : 'text-gray-400'} />}
                    </div>
                    <div>
                      <p className={`font-semibold text-sm ${role.isActive ? 'text-gray-900' : 'text-gray-400'}`}>{role.displayName}</p>
                      <p className="text-xs text-gray-400 font-mono">{role.name}</p>
                      {role.description && <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{role.description}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${
                    role.roleType === 'system' ? 'bg-purple-50 text-purple-700 ring-purple-200' : 'bg-blue-50 text-blue-700 ring-blue-200'
                  }`}>
                    {role.roleType === 'system' ? 'System' : 'Custom'}
                  </span>
                </td>
                <td className="px-5 py-3 text-center">
                  <button
                    onClick={() => updateRole(role._id, { isActive: !role.isActive })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${role.isActive ? 'bg-primary-600' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${role.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </td>
                <td className="px-5 py-3 text-center">
                  {role.isSuperAdmin ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                      <Crown size={14} /> Yes
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openPermManager(role)} className="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors" title="Manage permissions">
                      <Key size={15} />
                    </button>
                    <button onClick={() => { setEditingRole(role); setForm({ name: role.name, displayName: role.displayName, description: role.description || '' }); }} className="p-2 rounded-lg hover:bg-yellow-50 text-gray-400 hover:text-yellow-600 transition-colors" title="Edit">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => cloneRole(role)} disabled={cloning === role._id} className="p-2 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50" title="Clone role">
                      {cloning === role._id ? <Loader2 size={15} className="animate-spin" /> : <Copy size={15} />}
                    </button>
                    {!role.isSystemRole && (
                      <button onClick={() => deleteRole(role)} disabled={deleting === role._id} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50" title="Delete">
                        {deleting === role._id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Manage Permissions</h3>
                <p className="text-sm text-gray-500">{permRole.displayName} <span className="font-mono text-gray-400">({permRole.name})</span></p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">{totalAssigned} assigned</span>
                <button onClick={() => setPermRole(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Search & Controls */}
            <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={permSearch}
                    onChange={(e) => setPermSearch(e.target.value)}
                    placeholder="Search permissions..."
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
                <button onClick={expandAll} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors whitespace-nowrap">Expand All</button>
                <button onClick={collapseAll} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors whitespace-nowrap">Collapse All</button>
              </div>
            </div>

            {/* Permission Groups */}
            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {permLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="border border-gray-200 rounded-xl p-4">
                      <div className="h-5 w-40 bg-gray-100 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : filteredPermGroups.length === 0 ? (
                <div className="text-center py-12">
                  <Key size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500 text-sm">{permSearch ? 'No permissions match your search' : 'No permission groups found'}</p>
                </div>
              ) : (
                filteredPermGroups.map((group) => {
                  const groupPerms = permsByGroup(group._id);
                  if (groupPerms.length === 0) return null;
                  const enabledCount = groupPerms.filter((p) => hasPermission(p._id)).length;
                  const allEnabled = enabledCount === groupPerms.length;
                  const someEnabled = enabledCount > 0 && !allEnabled;
                  return (
                    <div key={group._id} className="border border-gray-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleGroup(group._id)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/80 hover:bg-gray-100/80 text-left transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {expandedGroups.has(group._id) ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
                          <span className="font-semibold text-sm text-gray-900">{group.displayName}</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${allEnabled ? 'bg-green-100 text-green-700' : someEnabled ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                              {enabledCount}/{groupPerms.length}
                            </span>
                          </div>
                        </div>
                      </button>
                      {expandedGroups.has(group._id) && (
                        <div className="divide-y divide-gray-100">
                          {groupPerms.map((perm) => (
                            <div key={perm._id} className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 transition-colors ${hasPermission(perm._id) ? 'bg-primary-50/30' : ''}`}>
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <button
                                  onClick={() => togglePermission(perm._id)}
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${hasPermission(perm._id) ? 'bg-primary-600 border-primary-600' : 'border-gray-300 hover:border-primary-400'}`}
                                >
                                  {hasPermission(perm._id) && <Check size={12} className="text-white" />}
                                </button>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-900">{perm.displayName}</span>
                                    <span className="text-[10px] font-mono text-gray-400">{perm.name}</span>
                                  </div>
                                  {perm.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{perm.description}</p>}
                                </div>
                              </div>
                              {hasPermission(perm._id) && scopes.length > 0 && (
                                <select
                                  value={getPermissionScope(perm._id) || ''}
                                  onChange={(e) => togglePermission(perm._id, e.target.value || undefined)}
                                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none ml-3"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <option value="">No scope</option>
                                  {scopes.map((s) => (
                                    <option key={s._id} value={s._id}>{s.code} — {s.name}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
              <button onClick={() => setPermRole(null)} className="bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-700 shadow-sm transition-all">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editingRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Edit: {editingRole.displayName}</h3>
              <button onClick={() => setEditingRole(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            {editingRole.isSystemRole && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs p-3 rounded-lg flex items-center gap-2">
                <Eye size={14} /> System role — name cannot be changed.
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Name</label>
              <input value={form.name} disabled className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono bg-gray-50 text-gray-500 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Display Name *</label>
              <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" rows={3} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={async () => {
                setSaving(true);
                try {
                  await api.put(`/admin/rbac/roles/${editingRole._id}`, { displayName: form.displayName, description: form.description });
                  toast.success('Role updated');
                  setEditingRole(null);
                  fetchRoles();
                } catch (err: any) {
                  toast.error(err.response?.data?.error || 'Failed to update');
                } finally {
                  setSaving(false);
                }
              }} disabled={saving} className="bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-700 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Changes
              </button>
              <button onClick={() => setEditingRole(null)} className="border border-gray-200 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
