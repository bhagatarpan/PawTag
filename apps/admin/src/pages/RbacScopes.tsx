import { useEffect, useState, useMemo } from 'react';
import api from '../lib/api';
import { toast } from '../lib/toast';
import {
  Plus, X, Save, Trash2, Search, Globe, Loader2,
  Pencil, Info, Layers,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Scope {
  _id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function RbacScopes() {
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingScope, setEditingScope] = useState<Scope | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchScopes = () => {
    setLoading(true);
    api.get('/admin/rbac/scopes')
      .then((res) => setScopes(res.data.data))
      .catch(() => toast.error('Failed to load scopes'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchScopes(); }, []);

  /* Summary */
  const summary = useMemo(() => ({
    total: scopes.length,
    active: scopes.filter((s) => s.isActive).length,
    inactive: scopes.filter((s) => !s.isActive).length,
  }), [scopes]);

  /* Filtered */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return scopes.filter((s) =>
      !q ||
      s.code.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.description?.toLowerCase().includes(q)
    );
  }, [scopes, search]);

  /* CRUD */
  const createScope = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await api.post('/admin/rbac/scopes', form);
      toast.success('Scope created');
      setForm({ code: '', name: '', description: '' });
      setShowCreate(false);
      fetchScopes();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  const updateScope = async () => {
    if (!editingScope) return;
    setSaving(true);
    try {
      await api.put(`/admin/rbac/scopes/${editingScope._id}`, form);
      toast.success('Scope updated');
      setEditingScope(null);
      fetchScopes();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (scope: Scope) => {
    try {
      await api.put(`/admin/rbac/scopes/${scope._id}`, { isActive: !scope.isActive });
      toast.success(scope.isActive ? 'Deactivated' : 'Activated');
      fetchScopes();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to toggle');
    }
  };

  const deleteScope = async (scope: Scope) => {
    if (!window.confirm(`Delete scope "${scope.code}"? This cannot be undone.`)) return;
    setDeleting(scope._id);
    try {
      await api.delete(`/admin/rbac/scopes/${scope._id}`);
      toast.success(`"${scope.code}" deleted`);
      fetchScopes();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete — scope may be in use');
    } finally {
      setDeleting(null);
    }
  };

  const openEdit = (scope: Scope) => {
    setForm({ code: scope.code, name: scope.name, description: scope.description || '' });
    setEditingScope(scope);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Access Scopes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{summary.total} scope{summary.total !== 1 ? 's' : ''} configured</p>
        </div>
        <button onClick={() => { setShowCreate(!showCreate); setFormError(''); }} className="bg-primary-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-primary-700 shadow-sm transition-all">
          <Plus size={16} /> Create Scope
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Info size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-800 mb-1">What are scopes?</p>
            <p className="text-sm text-blue-700">Scopes define <em>which</em> resources a permission applies to. For example, <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">OWN</code> means a user can only act on their own records, while <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">ALL</code> means they can act on any record.</p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Scopes', value: summary.total, color: 'bg-white border-gray-200' },
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
        <form onSubmit={createScope} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4 animate-slide-up">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Create Access Scope</h2>
            <button type="button" onClick={() => { setShowCreate(false); setFormError(''); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <X size={18} />
            </button>
          </div>
          {formError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">{formError}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Code (uppercase) *</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" required maxLength={20} placeholder="e.g. OWN" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" required maxLength={50} placeholder="e.g. Own Records" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" rows={2} maxLength={200} placeholder="What does this scope mean?" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-700 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Create Scope
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="border border-gray-200 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Search */}
      {!showCreate && !editingScope && (
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search scopes..."
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
              <th className="text-left px-5 py-3 font-medium text-gray-500">Code</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Description</th>
              <th className="text-center px-5 py-3 font-medium text-gray-500 w-20">Active</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500 w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-8 bg-gray-100 rounded-lg animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                        <div className="h-3 w-48 bg-gray-50 rounded animate-pulse" />
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center">
                  <Layers size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">{search ? 'No scopes match your search' : 'No scopes defined'}</p>
                  <p className="text-gray-400 text-sm mt-1">{search ? 'Try a different search term' : 'Create your first scope to define permission boundaries'}</p>
                </td>
              </tr>
            ) : filtered.map((scope) => (
              <tr key={scope._id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 font-mono text-sm font-bold text-gray-800">
                    {scope.code}
                  </span>
                </td>
                <td className="px-5 py-3 font-medium text-gray-900">{scope.name}</td>
                <td className="px-5 py-3 text-gray-500 text-sm max-w-xs truncate">{scope.description || '—'}</td>
                <td className="px-5 py-3 text-center">
                  <button
                    onClick={() => toggleActive(scope)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${scope.isActive ? 'bg-primary-600' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${scope.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(scope)} className="p-2 rounded-lg hover:bg-yellow-50 text-gray-400 hover:text-yellow-600 transition-colors" title="Edit">
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => deleteScope(scope)}
                      disabled={deleting === scope._id}
                      className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      {deleting === scope._id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingScope && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Edit: {editingScope.code}</h3>
              <button onClick={() => setEditingScope(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Code</label>
              <input value={form.code} disabled className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono bg-gray-50 text-gray-500 cursor-not-allowed" />
              <p className="text-[11px] text-gray-400 mt-1">Code cannot be changed after creation</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" rows={2} maxLength={200} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={updateScope} disabled={saving} className="bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-700 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Changes
              </button>
              <button onClick={() => setEditingScope(null)} className="border border-gray-200 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
