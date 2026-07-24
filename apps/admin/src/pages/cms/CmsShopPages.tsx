import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Save, X, Eye, EyeOff } from 'lucide-react';
import api from '../../lib/api';
import JsonEditor from '../../components/JsonEditor';

interface ShopPage {
  _id: string;
  slug: string;
  title: string;
  subtitle?: string;
  content: Record<string, unknown>;
  metaTitle?: string;
  metaDescription?: string;
  isActive: boolean;
}

const emptyForm = {
  slug: '',
  title: '',
  subtitle: '',
  content: '{}' as string,
  metaTitle: '',
  metaDescription: '',
  isActive: true,
};

export default function CmsShopPages() {
  const [pages, setPages] = useState<ShopPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchPages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/cms/shop-pages');
      setPages(res.data.data || []);
    } catch {
      setError('Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  const handleCreate = () => {
    setEditingId('new');
    setForm(emptyForm);
    setError('');
  };

  const handleEdit = (page: ShopPage) => {
    setEditingId(page._id);
    setForm({
      slug: page.slug,
      title: page.title,
      subtitle: page.subtitle || '',
      content: JSON.stringify(page.content || {}, null, 2),
      metaTitle: page.metaTitle || '',
      metaDescription: page.metaDescription || '',
      isActive: page.isActive,
    });
    setError('');
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      let content: Record<string, unknown> = {};
      try {
        content = JSON.parse(form.content);
      } catch {
        setError('Invalid JSON in content field');
        setSaving(false);
        return;
      }

      const payload = {
        slug: form.slug,
        title: form.title,
        subtitle: form.subtitle || undefined,
        content,
        metaTitle: form.metaTitle || undefined,
        metaDescription: form.metaDescription || undefined,
        isActive: form.isActive,
      };

      if (editingId === 'new') {
        await api.post('/admin/cms/shop-pages', payload);
      } else {
        await api.put(`/admin/cms/shop-pages/${editingId}`, payload);
      }
      setEditingId(null);
      setForm(emptyForm);
      fetchPages();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this page?')) return;
    try {
      await api.delete(`/admin/cms/shop-pages/${id}`);
      fetchPages();
    } catch {
      setError('Failed to delete');
    }
  };

  if (loading && pages.length === 0) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shop Pages</h1>
          <p className="text-sm text-gray-500 mt-1">Manage shop content pages like sizing, shipping, etc.</p>
        </div>
        <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={16} /> Add Page
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

      {/* Create/Edit Form */}
      {editingId && (
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{editingId === 'new' ? 'New Page' : 'Edit Page'}</h2>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
              <input type="text" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })}
                className="w-full border rounded-lg px-3 py-2" placeholder="e.g. sizing-guide" disabled={editingId !== 'new'} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full border rounded-lg px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
            <input type="text" value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })}
              className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meta Title</label>
              <input type="text" value={form.metaTitle} onChange={e => setForm({ ...form, metaTitle: e.target.value })}
                className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
              <input type="text" value={form.metaDescription} onChange={e => setForm({ ...form, metaDescription: e.target.value })}
                className="w-full border rounded-lg px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content (JSON)</label>
            <JsonEditor value={form.content} onChange={(val) => setForm({ ...form, content: val })} height="350px" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
            <label className="text-sm text-gray-700">Active</label>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <Save size={16} /> {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={handleCancel} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {/* Pages List */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Slug</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Title</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Status</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page._id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono text-gray-600">{page.slug}</td>
                <td className="px-4 py-3 text-sm font-medium">{page.title}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 text-xs ${page.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                    {page.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                    {page.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleEdit(page)} className="p-1 hover:bg-gray-100 rounded" title="Edit"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(page._id)} className="p-1 hover:bg-red-50 rounded text-red-600" title="Delete"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {pages.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No pages found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}