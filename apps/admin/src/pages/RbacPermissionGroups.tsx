import { useEffect, useState, useMemo, useRef } from 'react';
import api from '../lib/api';
import { toast } from '../lib/toast';
import { ConfirmDialog } from '@pawtag/ui';
import {
  Plus, X, Save, Trash2, Search, Shield, Loader2,
  ChevronDown, ChevronUp, LayoutGrid, Package,
  PawPrint, Users, Settings, Tag, ShoppingBag,
  FileText, Bell, Heart, Activity, Lock, Globe,
  CreditCard, ClipboardList, BarChart3, Mail, Star,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PermissionGroup {
  _id: string;
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
}

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
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

/* ------------------------------------------------------------------ */
/*  Icon Picker                                                        */
/* ------------------------------------------------------------------ */

const ICON_OPTIONS = [
  { name: 'PawPrint', icon: PawPrint },
  { name: 'Users', icon: Users },
  { name: 'Settings', icon: Settings },
  { name: 'Tag', icon: Tag },
  { name: 'ShoppingBag', icon: ShoppingBag },
  { name: 'FileText', icon: FileText },
  { name: 'Bell', icon: Bell },
  { name: 'Heart', icon: Heart },
  { name: 'Activity', icon: Activity },
  { name: 'Lock', icon: Lock },
  { name: 'Globe', icon: Globe },
  { name: 'CreditCard', icon: CreditCard },
  { name: 'ClipboardList', icon: ClipboardList },
  { name: 'BarChart3', icon: BarChart3 },
  { name: 'Mail', icon: Mail },
  { name: 'Star', icon: Star },
  { name: 'Package', icon: Package },
  { name: 'Shield', icon: Shield },
];

function IconPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const SelectedIcon = ICON_OPTIONS.find((i) => i.name === value)?.icon;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm flex items-center gap-2 hover:border-gray-300 transition-colors"
      >
        {SelectedIcon ? <SelectedIcon size={16} className="text-primary-600" /> : <LayoutGrid size={16} className="text-gray-400" />}
        <span className="flex-1 text-left">{value || 'Select icon...'}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg p-2">
          <div className="grid grid-cols-6 gap-1">
            {ICON_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.name}
                  type="button"
                  onClick={() => { onChange(opt.name); setOpen(false); }}
                  className={`p-2 rounded-lg flex flex-col items-center gap-1 transition-colors ${
                    value === opt.name ? 'bg-primary-50 text-primary-600 ring-1 ring-primary-200' : 'hover:bg-gray-50 text-gray-600'
                  }`}
                  title={opt.name}
                >
                  <Icon size={18} />
                  <span className="text-[9px] leading-tight truncate w-full text-center">{opt.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function RbacPermissionGroups() {
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PermissionGroup | null>(null);
  const [form, setForm] = useState({ name: '', displayName: '', description: '', icon: '', sortOrder: 0 });
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
        if (editingGroup) setEditingGroup(null);
        if (confirm.open) setConfirm(prev => ({ ...prev, open: false }));
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingGroup, confirm.open]);

  // Auto-focus first input when edit modal opens
  useEffect(() => {
    if (editingGroup) {
      setTimeout(() => document.getElementById('edit-display-name')?.focus(), 100);
    }
  }, [editingGroup]);

  const fetchGroups = () => {
    setLoading(true);
    api.get('/admin/rbac/permission-groups')
      .then((res) => setGroups(res.data.data))
      .catch(() => toast.error('Failed to load permission groups'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchGroups(); }, []);

  /* Summary */
  const summary = useMemo(() => ({
    total: groups.length,
    active: groups.filter((g) => g.isActive).length,
    inactive: groups.filter((g) => !g.isActive).length,
  }), [groups]);

  /* Filtered & sorted */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return groups
      .filter((g) => !q || g.name.toLowerCase().includes(q) || g.displayName.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [groups, search]);

  /* CRUD */
  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await api.post('/admin/rbac/permission-groups', form);
      toast.success('Permission group created');
      setForm({ name: '', displayName: '', description: '', icon: '', sortOrder: 0 });
      setShowCreate(false);
      fetchGroups();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  const updateGroup = async () => {
    if (!editingGroup) return;
    setSaving(true);
    try {
      await api.put(`/admin/rbac/permission-groups/${editingGroup._id}`, form);
      toast.success('Permission group updated');
      setEditingGroup(null);
      fetchGroups();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await api.put(`/admin/rbac/permission-groups/${id}`, { isActive: !current });
      toast.success(current ? 'Deactivated' : 'Activated');
      fetchGroups();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to toggle');
    }
  };

  const deleteGroup = (group: PermissionGroup) => {
    setConfirm({
      open: true,
      title: 'Delete Permission Group',
      message: `Are you sure you want to delete "${group.displayName}"? This action cannot be undone and may affect assigned permissions.`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirm(prev => ({ ...prev, loading: true }));
        try {
          await api.delete(`/admin/rbac/permission-groups/${group._id}`);
          toast.success(`"${group.displayName}" deleted`);
          fetchGroups();
        } catch (err: any) {
          toast.error(err.response?.data?.error || 'Failed to delete — group may have permissions assigned');
        } finally {
          setConfirm({ open: false, title: '', message: '', variant: 'danger', onConfirm: () => {}, loading: false });
        }
      },
      loading: false,
    });
  };

  const openEdit = (group: PermissionGroup) => {
    setForm({ name: group.name, displayName: group.displayName, description: group.description || '', icon: group.icon || '', sortOrder: group.sortOrder });
    setEditingGroup(group);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Permission Groups</h1>
          <p className="text-sm text-gray-500 mt-0.5">{summary.total} group{summary.total !== 1 ? 's' : ''} configured</p>
        </div>
        <button
          onClick={() => { setShowCreate(!showCreate); setFormError(''); }}
          className="bg-primary-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-primary-700 shadow-sm transition-all"
        >
          <Plus size={16} /> Create Group
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Groups', value: summary.total, color: 'bg-white border-gray-200' },
          { label: 'Active', value: summary.active, color: 'bg-emerald-50 border-emerald-200', textColor: 'text-emerald-700' },
          { label: 'Inactive', value: summary.inactive, color: 'bg-gray-50 border-gray-200', textColor: 'text-gray-500' },
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
        <form onSubmit={createGroup} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4 animate-slide-up">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Create Permission Group</h2>
            <button type="button" onClick={() => { setShowCreate(false); setFormError(''); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <X size={18} />
            </button>
          </div>
          {formError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">{formError}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Internal Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase().replace(/\s+/g, '_') })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" required placeholder="e.g. PET_MANAGEMENT" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Display Name *</label>
              <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" required placeholder="e.g. Pet Management" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Icon</label>
              <IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Sort Order</label>
              <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" min={0} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" rows={2} maxLength={500} placeholder="What permissions belong to this group?" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-700 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Create Group
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="border border-gray-200 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Search */}
      {!showCreate && !editingGroup && (
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchInputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups... (Ctrl+K)"
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
              <th className="text-left px-5 py-3 font-medium text-gray-500 w-16">#</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Group</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Description</th>
              <th className="text-center px-5 py-3 font-medium text-gray-500 w-20">Active</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500 w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg animate-pulse" />
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
                  <LayoutGrid size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">{search ? 'No groups match your search' : 'No permission groups yet'}</p>
                  <p className="text-gray-400 text-sm mt-1">{search ? 'Try a different search term' : 'Create your first group to organize permissions'}</p>
                </td>
              </tr>
            ) : filtered.map((group) => {
              const GroupIcon = ICON_OPTIONS.find((i) => i.name === group.icon)?.icon;
              return (
                <tr key={group._id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 text-gray-400 text-xs font-mono">{group.sortOrder}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${group.isActive ? 'bg-primary-50' : 'bg-gray-100'}`}>
                        {GroupIcon ? <GroupIcon size={18} className={group.isActive ? 'text-primary-600' : 'text-gray-400'} /> : <Package size={18} className="text-gray-400" />}
                      </div>
                      <div>
                        <p className={`font-semibold text-sm ${group.isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                          <HighlightText text={group.displayName} query={search} />
                        </p>
                        <p className="text-xs text-gray-400 font-mono">{group.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-sm max-w-xs truncate">{group.description || '—'}</td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={() => toggleActive(group._id, group.isActive)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${group.isActive ? 'bg-primary-600' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${group.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(group)} className="p-2 rounded-lg hover:bg-yellow-50 text-gray-400 hover:text-yellow-600 transition-colors" title="Edit">
                        <Save size={15} />
                      </button>
                      <button
                        onClick={() => deleteGroup(group)}
                        disabled={deleting === group._id}
                        className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deleting === group._id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
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
      {editingGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Edit: {editingGroup.displayName}</h3>
              <button onClick={() => setEditingGroup(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Display Name</label>
              <input id="edit-display-name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Icon</label>
                <IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Sort Order</label>
                <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={updateGroup} disabled={saving} className="bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-700 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Changes
              </button>
              <button onClick={() => setEditingGroup(null)} className="border border-gray-200 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
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
