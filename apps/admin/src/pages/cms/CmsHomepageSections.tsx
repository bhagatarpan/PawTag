import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Save, X, GripVertical, Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react';
import api from '../../lib/api';
import SectionContentEditor from '../../components/SectionContentEditor';

interface HomepageSection {
  _id: string;
  sectionType: string;
  title: string;
  subtitle?: string;
  content: Record<string, unknown>;
  order: number;
  isActive: boolean;
}

const SECTION_TYPES = [
  { value: 'hero_slide', label: 'Hero Slide' },
  { value: 'how_it_works', label: 'How It Works' },
  { value: 'trust', label: 'Trust Section' },
  { value: 'testimonial', label: 'Testimonial' },
  { value: 'responsibility_score', label: 'Responsibility Score' },
  { value: 'banner', label: 'Banner' },
  { value: 'faq', label: 'FAQ' },
];

const emptyForm = {
  sectionType: 'hero_slide',
  title: '',
  subtitle: '',
  content: {} as Record<string, unknown>,
  order: 0,
  isActive: true,
};

export default function CmsHomepageSections() {
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterType, setFilterType] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchSections = useCallback(async () => {
    try {
      setLoading(true);
      const params = filterType ? `?sectionType=${filterType}` : '';
      const res = await api.get(`/admin/cms/homepage${params}`);
      setSections(res.data.data || []);
    } catch {
      setError('Failed to load sections');
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => { fetchSections(); }, [fetchSections]);

  const handleCreate = () => {
    setEditingId('new');
    setForm(emptyForm);
    setError('');
  };

  const handleEdit = (section: HomepageSection) => {
    setEditingId(section._id);
    setForm({
      sectionType: section.sectionType,
      title: section.title,
      subtitle: section.subtitle || '',
      content: section.content || {},
      order: section.order,
      isActive: section.isActive,
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

      const payload = {
        sectionType: form.sectionType,
        title: form.title,
        subtitle: form.subtitle || undefined,
        content: form.content,
        order: form.order,
        isActive: form.isActive,
      };

      if (editingId === 'new') {
        await api.post('/admin/cms/homepage', payload);
      } else {
        await api.put(`/admin/cms/homepage/${editingId}`, payload);
      }
      setEditingId(null);
      setForm(emptyForm);
      fetchSections();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this section?')) return;
    try {
      await api.delete(`/admin/cms/homepage/${id}`);
      fetchSections();
    } catch {
      setError('Failed to delete');
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.put(`/admin/cms/homepage/${id}/toggle`);
      fetchSections();
    } catch {
      setError('Failed to toggle');
    }
  };

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    const idx = sections.findIndex(s => s._id === id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sections.length) return;
    const a = sections[idx], b = sections[swapIdx];
    try {
      await api.put(`/admin/cms/homepage/${a._id}`, { order: b.order });
      await api.put(`/admin/cms/homepage/${b._id}`, { order: a.order });
      fetchSections();
    } catch {
      setError('Failed to reorder');
    }
  };

  if (loading && sections.length === 0) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Homepage Sections</h1>
          <p className="text-sm text-gray-500 mt-1">Manage hero slides, how-it-works steps, testimonials, and more.</p>
        </div>
        <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={16} /> Add Section
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

      {/* Filter */}
      <div className="flex gap-2">
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Types</option>
          {SECTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Create/Edit Form */}
      {editingId && (
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{editingId === 'new' ? 'New Section' : 'Edit Section'}</h2>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section Type *</label>
              <select value={form.sectionType} onChange={e => setForm({ ...form, sectionType: e.target.value })}
                className="w-full border rounded-lg px-3 py-2" disabled={editingId !== 'new'}>
                {SECTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
              <input type="number" value={form.order} onChange={e => setForm({ ...form, order: Number(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
            <input type="text" value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })}
              className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <SectionContentEditor sectionType={form.sectionType} value={form.content} onChange={(val) => setForm({ ...form, content: val })} />
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

      {/* Sections List */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500 w-8"></th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Type</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Title</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Order</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Status</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <tr key={section._id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3"><GripVertical size={14} className="text-gray-300" /></td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                    {SECTION_TYPES.find(t => t.value === section.sectionType)?.label || section.sectionType}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-medium">{section.title}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{section.order}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleToggle(section._id)} className="flex items-center gap-1">
                    {section.isActive
                      ? <><Eye size={14} className="text-green-600" /><span className="text-xs text-green-600">Active</span></>
                      : <><EyeOff size={14} className="text-gray-400" /><span className="text-xs text-gray-400">Inactive</span></>
                    }
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleMove(section._id, 'up')} className="p-1 hover:bg-gray-100 rounded" title="Move up"><ArrowUp size={14} /></button>
                    <button onClick={() => handleMove(section._id, 'down')} className="p-1 hover:bg-gray-100 rounded" title="Move down"><ArrowDown size={14} /></button>
                    <button onClick={() => handleEdit(section)} className="p-1 hover:bg-gray-100 rounded" title="Edit"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(section._id)} className="p-1 hover:bg-red-50 rounded text-red-600" title="Delete"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {sections.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No sections found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}