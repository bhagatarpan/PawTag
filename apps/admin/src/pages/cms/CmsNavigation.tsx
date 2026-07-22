import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Plus, Trash2 } from 'lucide-react';

interface NavItem {
  label: string;
  url: string;
  target: '_self' | '_blank';
  visible: boolean;
  order: number;
}

interface NavMenu {
  _id: string;
  name: string;
  slug: string;
  location: string;
  items: NavItem[];
  status: string;
  updatedAt: string;
  createdBy?: { fullName: string };
}

export default function CmsNavigation() {
  const [menus, setMenus] = useState<NavMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<NavMenu | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', location: 'header', status: 'draft' });
  const [items, setItems] = useState<NavItem[]>([]);

  const fetchMenus = () => {
    setLoading(true);
    api.get('/admin/cms/navigation')
      .then((res) => setMenus(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchMenus(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', slug: '', location: 'header', status: 'draft' });
    setItems([]);
    setShowForm(true);
  };

  const openEdit = (menu: NavMenu) => {
    setEditing(menu);
    setForm({ name: menu.name, slug: menu.slug, location: menu.location, status: menu.status });
    setItems([...menu.items]);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...form, items };
      if (editing) {
        await api.put(`/admin/cms/navigation/${editing._id}`, payload);
      } else {
        await api.post('/admin/cms/navigation', payload);
      }
      setShowForm(false);
      fetchMenus();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save navigation');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await api.delete(`/admin/cms/navigation/${id}`);
      fetchMenus();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  };

  const addItem = () => {
    setItems([...items, { label: '', url: '/', target: '_self', visible: true, order: items.length }]);
  };

  const updateItem = (idx: number, updates: Partial<NavItem>) => {
    setItems(items.map((item, i) => i === idx ? { ...item, ...updates } : item));
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Navigation</h1>
          <p className="text-sm text-gray-500 mt-1">Manage header, footer, and sidebar navigation menus</p>
        </div>
        <button onClick={openCreate} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700">
          + New Menu
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit Menu' : 'New Menu'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Menu Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm font-mono" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <select value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm">
                  <option value="header">Header</option>
                  <option value="footer">Footer</option>
                  <option value="sidebar">Sidebar</option>
                  <option value="mobile">Mobile</option>
                </select>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Menu Items</h3>
                <button type="button" onClick={addItem} className="text-primary-600 hover:text-primary-800 text-sm flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Add Item
                </button>
              </div>
              {items.length === 0 ? (
                <p className="text-sm text-gray-400">No items yet</p>
              ) : (
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-start bg-gray-50 p-3 rounded-lg">
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        <input value={item.label} onChange={(e) => updateItem(idx, { label: e.target.value })} placeholder="Label" className="border rounded px-2 py-1 text-sm" />
                        <input value={item.url} onChange={(e) => updateItem(idx, { url: e.target.value })} placeholder="URL" className="border rounded px-2 py-1 text-sm font-mono" />
                        <select value={item.target} onChange={(e) => updateItem(idx, { target: e.target.value as '_self' | '_blank' })} className="border rounded px-2 py-1 text-sm">
                          <option value="_self">Same tab</option>
                          <option value="_blank">New tab</option>
                        </select>
                      </div>
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={item.visible} onChange={(e) => updateItem(idx, { visible: e.target.checked })} />
                        Visible
                      </label>
                      <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700">Save</button>
              <button type="button" onClick={() => setShowForm(false)} className="border border-gray-300 px-4 py-2 rounded-md text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Location</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Items</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Updated</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : menus.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">No navigation menus found</td></tr>
            ) : (
              menus.map((menu) => (
                <tr key={menu._id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium">{menu.name}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">{menu.location}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{menu.items?.length || 0} items</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                      menu.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>{menu.status}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{new Date(menu.updatedAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3 flex gap-2">
                    <button onClick={() => openEdit(menu)} className="text-primary-600 hover:text-primary-800 text-xs">Edit</button>
                    <button onClick={() => handleDelete(menu._id, menu.name)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
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
