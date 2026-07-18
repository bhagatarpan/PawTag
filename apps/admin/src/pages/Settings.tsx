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

  const categories = [...new Set(settings.map((s) => s.category))];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Site Settings</h1>
      <p className="text-sm text-gray-500">Manage site configuration. Changes take effect immediately.</p>

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
