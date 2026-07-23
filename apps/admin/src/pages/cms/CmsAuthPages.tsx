import { useState, useEffect, useCallback } from 'react';
import { Edit2, Save, X, Eye, EyeOff } from 'lucide-react';
import api from '../../lib/api';

interface AuthPage {
  _id: string;
  pageType: string;
  title: string;
  subtitle?: string;
  content: Record<string, unknown>;
  isActive: boolean;
}

const PAGE_TYPES: Record<string, string> = {
  login: 'Login',
  register: 'Register',
  forgot_password: 'Forgot Password',
  reset_password: 'Reset Password',
  verify_email: 'Verify Email',
};

export default function CmsAuthPages() {
  const [pages, setPages] = useState<AuthPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', subtitle: '', content: '{}' as string, isActive: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchPages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/cms/auth-pages');
      setPages(res.data.data || []);
    } catch {
      setError('Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  const handleEdit = (page: AuthPage) => {
    setEditingId(page._id);
    setForm({
      title: page.title,
      subtitle: page.subtitle || '',
      content: JSON.stringify(page.content || {}, null, 2),
      isActive: page.isActive,
    });
    setError('');
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({ title: '', subtitle: '', content: '{}', isActive: true });
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

      await api.put(`/admin/cms/auth-pages/${editingId}`, {
        title: form.title,
        subtitle: form.subtitle || undefined,
        content,
        isActive: form.isActive,
      });
      setEditingId(null);
      fetchPages();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading && pages.length === 0) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Auth Pages</h1>
        <p className="text-sm text-gray-500 mt-1">Manage content for login, register, forgot password, and other auth pages.</p>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

      {/* Edit Form */}
      {editingId && (
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Edit {PAGE_TYPES[pages.find(p => p._id === editingId)?.pageType || ''] || 'Page'}</h2>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
              <input type="text" value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })}
                className="w-full border rounded-lg px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content (JSON)</label>
            <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
              rows={10} className="w-full border rounded-lg px-3 py-2 font-mono text-sm" />
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
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Page Type</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Title</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Status</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page._id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
                    {PAGE_TYPES[page.pageType] || page.pageType}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-medium">{page.title}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 text-xs ${page.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                    {page.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                    {page.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end">
                    <button onClick={() => handleEdit(page)} className="p-1 hover:bg-gray-100 rounded" title="Edit"><Edit2 size={14} /></button>
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