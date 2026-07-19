import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Plus, X, Save, Trash2 } from 'lucide-react';

interface Scope {
  _id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export default function RbacScopes() {
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', description: '' });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const fetch = () => {
    setLoading(true);
    api.get('/admin/rbac/scopes').then((res) => setScopes(res.data.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const createScope = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      await api.post('/admin/rbac/scopes', form);
      setFormSuccess('Scope created!');
      setForm({ code: '', name: '', description: '' });
      setShowCreate(false);
      fetch();
      setTimeout(() => setFormSuccess(''), 3000);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to create scope');
    }
  };

  const deleteScope = async (scope: Scope) => {
    if (!window.confirm(`Delete scope "${scope.code}"?`)) return;
    try {
      await api.delete(`/admin/rbac/scopes/${scope._id}`);
      fetch();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete scope');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Access Scopes</h1>
        <button onClick={() => setShowCreate(!showCreate)} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm flex items-center gap-1.5 hover:bg-primary-700">
          <Plus size={14} /> Create Scope
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
        <strong>What are scopes?</strong> Scopes define <em>which</em> resources a permission applies to.
        For example, <code className="bg-blue-100 px-1 rounded">OWN</code> means a user can only act on their own records,
        while <code className="bg-blue-100 px-1 rounded">ALL</code> means they can act on any record.
      </div>

      {formSuccess && <div className="bg-green-50 text-green-600 text-sm p-3 rounded">{formSuccess}</div>}

      {showCreate && (
        <form onSubmit={createScope} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Create Access Scope</h2>
            <button type="button" onClick={() => { setShowCreate(false); setFormError(''); }} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
          </div>
          {formError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{formError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Code (uppercase) *</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="w-full border rounded-md px-3 py-2 text-sm font-mono" required maxLength={20} placeholder="e.g. OWN" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required maxLength={50} placeholder="e.g. Own Records" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" rows={2} maxLength={200} />
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
              <th className="text-left px-5 py-3 font-medium text-gray-500">Code</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Description</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : scopes.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">No scopes defined</td></tr>
            ) : scopes.map((scope) => (
              <tr key={scope._id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-mono font-medium">{scope.code}</td>
                <td className="px-5 py-3">{scope.name}</td>
                <td className="px-5 py-3 text-gray-500 text-xs">{scope.description || '—'}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${scope.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {scope.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => deleteScope(scope)} title="Delete scope" className="p-1.5 rounded hover:bg-red-100 text-red-500"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
