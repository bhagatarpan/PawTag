import { useEffect, useState } from 'react';
import api from '../lib/api';

interface FeatureFlag {
  _id: string;
  key: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  allowedRoles?: string[];
  percentage?: number;
}

export default function FeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ key: '', name: '', description: '', isEnabled: false });

  const fetchFlags = () => {
    setLoading(true);
    api
      .get('/admin/feature-flags')
      .then((res) => setFlags(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchFlags(); }, []);

  const toggleFlag = async (key: string, isEnabled: boolean) => {
    await api.put(`/admin/feature-flags/${key}`, { isEnabled: !isEnabled });
    fetchFlags();
  };

  const createFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/admin/feature-flags', form);
    setShowForm(false);
    setForm({ key: '', name: '', description: '', isEnabled: false });
    fetchFlags();
  };

  const deleteFlag = async (key: string) => {
    if (!confirm('Delete this feature flag?')) return;
    await api.delete(`/admin/feature-flags/${key}`);
    fetchFlags();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Feature Flags</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700">
          {showForm ? 'Cancel' : 'Add Flag'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createFlag} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key</label>
              <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm font-mono" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700">Create Flag</button>
        </form>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Flag</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Key</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Description</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Enabled</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : flags.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">No feature flags</td></tr>
            ) : (
              flags.map((f) => (
                <tr key={f._id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium">{f.name}</td>
                  <td className="px-5 py-3 font-mono text-gray-600">{f.key}</td>
                  <td className="px-5 py-3 text-gray-500">{f.description || '---'}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleFlag(f.key, f.isEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        f.isEnabled ? 'bg-primary-600' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        f.isEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <button onClick={() => deleteFlag(f.key)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
