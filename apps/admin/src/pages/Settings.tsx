import { useEffect, useState } from 'react';
import api from '../lib/api';

interface Setting {
  _id: string;
  key: string;
  value: string;
  category: string;
  description?: string;
}

export default function Settings() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState('contact');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const fetchSettings = () => {
    setLoading(true);
    const params: any = {};
    if (categoryFilter) params.category = categoryFilter;
    api
      .get('/admin/settings', { params })
      .then((res) => setSettings(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSettings(); }, [categoryFilter]);

  const saveSetting = async (key: string) => {
    await api.put(`/admin/settings/${key}`, { value: editValue });
    setEditingKey(null);
    fetchSettings();
  };

  const createSetting = async () => {
    if (!newKey.trim() || !newValue.trim()) {
      setError('Key and value are required');
      return;
    }
    if (!/^[a-z]+\.[a-z0-9.]+$/.test(newKey.trim())) {
      setError('Key must be in format: category.name (e.g. contact.businessHours)');
      return;
    }
    setCreating(true);
    setError('');
    try {
      await api.post('/admin/settings', {
        key: newKey.trim(),
        value: newValue.trim(),
        category: newCategory,
        description: newDescription.trim() || undefined,
      });
      setShowCreate(false);
      setNewKey('');
      setNewValue('');
      setNewCategory('contact');
      setNewDescription('');
      fetchSettings();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create setting');
    } finally {
      setCreating(false);
    }
  };

  const deleteSetting = async (key: string) => {
    if (!confirm(`Delete setting "${key}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/settings/${key}`);
      fetchSettings();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete setting');
    }
  };

  const categories = [...new Set(settings.map((s) => s.category))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Site Settings</h1>
          <p className="text-sm text-gray-500">Manage site configuration. Changes take effect immediately.</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700"
        >
          {showCreate ? 'Cancel' : '+ New Setting'}
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-sm">Create New Setting</h2>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key *</label>
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g. contact.businessHours"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">Format: category.name (lowercase, dot-separated)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="e.g. contact"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Value *</label>
            <input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Setting value"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What this setting controls"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={createSetting}
              disabled={creating}
              className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Setting'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setError(''); }}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setCategoryFilter('')}
          className={`px-3 py-1.5 rounded-md text-sm ${!categoryFilter ? 'bg-primary-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-md text-sm capitalize ${categoryFilter === cat ? 'bg-primary-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="px-5 py-8 text-center text-gray-500">Loading...</div>
        ) : settings.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-500">No settings found</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {settings.map((s) => (
              <div key={s._id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{s.key}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{s.category}</span>
                  </div>
                  {s.description && <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {editingKey === s.key ? (
                    <>
                      <input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="border border-gray-300 rounded px-3 py-1.5 text-sm w-64"
                        autoFocus
                      />
                      <button onClick={() => saveSetting(s.key)} className="text-primary-600 hover:text-primary-800 text-sm font-medium">Save</button>
                      <button onClick={() => setEditingKey(null)} className="text-gray-500 hover:text-gray-700 text-sm">Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-gray-700 bg-gray-50 px-3 py-1.5 rounded border border-gray-200 min-w-[150px]">{s.value}</span>
                      <button
                        onClick={() => { setEditingKey(s.key); setEditValue(s.value); }}
                        className="text-primary-600 hover:text-primary-800 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteSetting(s.key)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
