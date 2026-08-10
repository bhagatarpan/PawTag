import { useEffect, useState, useMemo, useRef } from 'react';
import api from '../lib/api';
import { toast } from '../lib/toast';
import { ConfirmDialog } from '@pawtag/ui';
import {
  Plus, X, Save, Trash2, Search, Shield, Loader2,
  Key, Filter, Pencil, Eye,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
  return <>{parts.map((part, i) => 
    part.toLowerCase() === query.toLowerCase() 
      ? <mark key={i} className="bg-yellow-200 rounded px-0.5">{part}</mark>
      : part
  )}</>;
}

function groupName(groupRef: any, groups: PermissionGroup[]): string {
  if (!groupRef) return '—';
  const groupId = typeof groupRef === 'string' ? groupRef : groupRef?._id;
  if (!groupId) return '—';
  return groups.find((g) => g._id === groupId)?.displayName || (typeof groupRef === 'string' ? groupRef : groupRef?.name || groupId);
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  read: 'bg-blue-50 text-blue-700 ring-blue-200',
  update: 'bg-amber-50 text-amber-700 ring-amber-200',
  delete: 'bg-red-50 text-red-700 ring-red-200',
  assign_permission: 'bg-purple-50 text-purple-700 ring-purple-200',
  remove_permission: 'bg-orange-50 text-orange-700 ring-orange-200',
  generate_qr: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  generate_sticker: 'bg-pink-50 text-pink-700 ring-pink-200',
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function RbacPermissions() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingPerm, setEditingPerm] = useState<Permission | null>(null);
  const [form, setForm] = useState({ name: '', displayName: '', description: '', resource: '', action: '', permissionGroupId: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning';
    onConfirm: () => void;
    loading: boolean;
  }>({ open: false, title: '', message: '', variant: 'danger', onConfirm: () => {}, loading: false });

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K / Cmd+K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Escape to close modals
      if (e.key === 'Escape') {
        if (editingPerm) setEditingPerm(null);
        if (confirm.open) setConfirm(prev => ({ ...prev, open: false }));
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingPerm, confirm.open]);

  // Auto-focus first input when edit modal opens
  useEffect(() => {
    if (editingPerm) {
      setTimeout(() => document.getElementById('edit-display-name')?.focus(), 100);
    }
  }, [editingPerm]);

  const fetchData = () => {
    setLoading(true);
    const params: any = {};
    if (groupFilter) params.groupId = groupFilter;
    Promise.all([
      api.get('/admin/rbac/permissions', { params }),
      api.get('/admin/rbac/permission-groups'),
    ]).then(([pRes, gRes]) => {
      setPermissions(pRes.data.data);
      setGroups(gRes.data.data);
    }).catch(() => toast.error('Failed to load permissions'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [groupFilter]);

  /* Summary */
  const summary = useMemo(() => ({
    total: permissions.length,
    active: permissions.filter((p) => p.isActive).length,
    inactive: permissions.filter((p) => !p.isActive).length,
    resources: new Set(permissions.map((p) => p.resource)).size,
  }), [permissions]);

  /* Filtered */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return permissions.filter((p) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.displayName.toLowerCase().includes(q) ||
      p.resource.toLowerCase().includes(q) ||
      p.action.toLowerCase().includes(q)
    );
  }, [permissions, search]);

  /* CRUD */
  const resetForm = () => setForm({ name: '', displayName: '', description: '', resource: '', action: '', permissionGroupId: '' });

  const createPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await api.post('/admin/rbac/permissions', form);
      toast.success('Permission created');
      resetForm();
      setShowCreate(false);
      fetchData();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  const updatePermission = async () => {
    if (!editingPerm) return;
    setSaving(true);
    try {
      await api.put(`/admin/rbac/permissions/${editingPerm._id}`, {
        displayName: form.displayName,
        description: form.description,
        resource: form.resource,
        action: form.action,
        permissionGroupId: form.permissionGroupId,
      });
      toast.success('Permission updated');
      setEditingPerm(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await api.put(`/admin/rbac/permissions/${id}`, { isActive: !current });
      toast.success(current ? 'Deactivated' : 'Activated');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to toggle');
    }
  };

  const deletePermission = (perm: Permission) => {
    setConfirm({
      open: true,
      title: 'Delete Permission',
      message: `Are you sure you want to delete "${perm.displayName}"? This may affect roles that have this permission assigned.`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirm(prev => ({ ...prev, loading: true }));
        try {
          await api.delete(`/admin/rbac/permissions/${perm._id}`);
          toast.success(`"${perm.displayName}" deleted`);
          fetchData();
        } catch (err: any) {
          toast.error(err.response?.data?.error || 'Failed to delete — permission may be assigned to roles');
        } finally {
          setConfirm({ open: false, title: '', message: '', variant: 'danger', onConfirm: () => {}, loading: false });
        }
      },
      loading: false,
    });
  };

  const openEdit = (perm: Permission) => {
    const groupId = typeof perm.permissionGroupId === 'string' ? perm.permissionGroupId : perm.permissionGroupId?._id || '';
    setForm({ name: perm.name, displayName: perm.displayName, description: perm.description || '', resource: perm.resource, action: perm.action, permissionGroupId: groupId });
    setEditingPerm(perm);
  };

  const openCreate = () => {
    resetForm();
    setFormError('');
    setShowCreate(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Permission Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{summary.total} permission{summary.total !== 1 ? 's' : ''} across {summary.resources} resource{summary.resources !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openCreate} className="bg-primary-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-primary-700 shadow-sm transition-all">
          <Plus size={16} /> Create Permission
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: summary.total, color: 'bg-white border-gray-200' },
          { label: 'Active', value: summary.active, color: 'bg-emerald-50 border-emerald-200', textColor: 'text-emerald-700' },
          { label: 'Inactive', value: summary.inactive, color: 'bg-gray-50 border-gray-200', textColor: 'text-gray-500' },
          { label: 'Resources', value: summary.resources, color: 'bg-blue-50 border-blue-200', textColor: 'text-blue-700' },
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
        <form onSubmit={createPermission} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4 animate-slide-up">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Create New Permission</h2>
            <button type="button" onClick={() => { setShowCreate(false); setFormError(''); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <X size={18} />
            </button>
          </div>
          {formError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">{formError}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Name (lowercase: resource.action) *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase() })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" required placeholder="e.g. pet.read" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Display Name *</label>
              <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" required placeholder="e.g. Read Pets" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Resource *</label>
              <input value={form.resource} onChange={(e) => setForm({ ...form, resource: e.target.value.toLowerCase() })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" required placeholder="e.g. pet" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Action *</label>
              <input value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value.toLowerCase() })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" required placeholder="e.g. read" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Permission Group *</label>
              <select value={form.permissionGroupId} onChange={(e) => setForm({ ...form, permissionGroupId: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" required>
                <option value="">Select group...</option>
                {groups.sort((a, b) => a.name.localeCompare(b.name)).map((g) => (
                  <option key={g._id} value={g._id}>{g.displayName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" maxLength={500} placeholder="What this permission allows..." />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-700 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Create Permission
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="border border-gray-200 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      {!showCreate && !editingPerm && (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search permissions... (Ctrl+K)"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none">
              <option value="">All Groups</option>
              {groups.sort((a, b) => a.name.localeCompare(b.name)).map((g) => (
                <option key={g._id} value={g._id}>{g.displayName}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Permission</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Group</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Resource</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Action</th>
              <th className="text-center px-5 py-3 font-medium text-gray-500 w-20">Active</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500 w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-5 py-4">
                    <div className="flex items-center gap-4">
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
                <td colSpan={6} className="px-5 py-16 text-center">
                  <Key size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">{search || groupFilter ? 'No permissions match your filters' : 'No permissions yet'}</p>
                  <p className="text-gray-400 text-sm mt-1">{search || groupFilter ? 'Try adjusting your search or filters' : 'Create your first permission to get started'}</p>
                </td>
              </tr>
            ) : filtered.map((perm) => {
              const actionClass = ACTION_COLORS[perm.action] || 'bg-gray-50 text-gray-700 ring-gray-200';
              return (
                <tr key={perm._id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <div>
                      <p className="font-mono text-sm font-medium text-gray-900">
                        <HighlightText text={perm.name} query={search} />
                      </p>
                      <p className="text-xs text-gray-500">
                        <HighlightText text={perm.displayName} query={search} />
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">{groupName(perm.permissionGroupId, groups)}</td>
                  <td className="px-5 py-3 font-mono text-xs bg-gray-50/50 rounded-lg">{perm.resource}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${actionClass}`}>
                      {perm.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={() => toggleActive(perm._id, perm.isActive)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${perm.isActive ? 'bg-primary-600' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${perm.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(perm)} className="p-2 rounded-lg hover:bg-yellow-50 text-gray-400 hover:text-yellow-600 transition-colors" title="Edit">
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => deletePermission(perm)}
                        disabled={deleting === perm._id}
                        className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deleting === perm._id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingPerm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Edit: {editingPerm.displayName}</h3>
              <button onClick={() => setEditingPerm(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Name</label>
                <input value={form.name} disabled className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono bg-gray-50 text-gray-500 cursor-not-allowed" />
                <p className="text-[11px] text-gray-400 mt-1">Name cannot be changed after creation</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Display Name *</label>
                <input id="edit-display-name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Resource *</label>
                <input value={form.resource} onChange={(e) => setForm({ ...form, resource: e.target.value.toLowerCase() })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Action *</label>
                <input value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value.toLowerCase() })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Permission Group *</label>
                <select value={form.permissionGroupId} onChange={(e) => setForm({ ...form, permissionGroupId: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none">
                  <option value="">Select group...</option>
                  {groups.sort((a, b) => a.name.localeCompare(b.name)).map((g) => (
                    <option key={g._id} value={g._id}>{g.displayName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" maxLength={500} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={updatePermission} disabled={saving} className="bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-700 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Changes
              </button>
              <button onClick={() => setEditingPerm(null)} className="border border-gray-200 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false, title: '', message: '', variant: 'danger', onConfirm: () => {}, loading: false })}
        onConfirm={confirm.onConfirm}
        title={confirm.title}
        message={confirm.message}
        variant={confirm.variant}
        loading={confirm.loading}
        confirmLabel="Delete"
      />
    </div>
  );
}
