import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../lib/api';
import { Code, Layout } from 'lucide-react';
import JsonEditor from '../../components/JsonEditor';
import PuckPageBuilder from '../../components/puck/PuckPageBuilder';
import type { PageSection } from '../../components/puck/PuckPageBuilder';

export default function CmsPageEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new' || !id;
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [editorMode, setEditorMode] = useState<'visual' | 'json'>('visual');

  const [form, setForm] = useState({
    slug: '',
    title: '',
    description: '',
    template: 'default',
    metaTitle: '',
    metaDescription: '',
    metaKeywords: [] as string[],
    canonicalUrl: '',
    ogImage: '',
    ogTitle: '',
    ogDescription: '',
    status: 'draft' as string,
  });

  const [sections, setSections] = useState<PageSection[]>([]);

  useEffect(() => {
    if (!isNew && id) {
      api.get(`/admin/cms/pages/${id}`)
        .then((res) => {
          const page = res.data.data;
          setForm({
            slug: page.slug || '',
            title: page.title || '',
            description: page.description || '',
            template: page.template || 'default',
            metaTitle: page.metaTitle || '',
            metaDescription: page.metaDescription || '',
            metaKeywords: page.metaKeywords || [],
            canonicalUrl: page.canonicalUrl || '',
            ogImage: page.ogImage || '',
            ogTitle: page.ogTitle || '',
            ogDescription: page.ogDescription || '',
            status: page.status || 'draft',
          });
          setSections(page.sections || []);
        })
        .catch(() => navigate('/cms/pages'))
        .finally(() => setLoading(false));
    }
  }, [id, isNew, navigate]);

  const handleSave = async (publishAfter = false) => {
    if (!form.slug || !form.title) {
      alert('Slug and Title are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        sections,
        ...(publishAfter ? { status: 'published' } : {}),
      };
      if (isNew) {
        const res = await api.post('/admin/cms/pages', payload);
        navigate(`/cms/pages/${res.data.data._id}`);
      } else {
        await api.put(`/admin/cms/pages/${id}`, payload);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save page');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <button onClick={() => navigate('/cms/pages')} className="text-sm text-gray-500 hover:text-gray-700 mb-1">&larr; Back to Pages</button>
          <h1 className="text-2xl font-bold">{isNew ? 'New Page' : 'Edit Page'}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleSave(false)} disabled={saving} className="border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button onClick={() => handleSave(true)} disabled={saving} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>

      {/* Page Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Page Settings</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
            <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono" placeholder="my-page" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
            <select value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              <option value="default">Default</option>
              <option value="landing">Landing Page</option>
              <option value="full-width">Full Width</option>
              <option value="sidebar">With Sidebar</option>
            </select>
          </div>
        </div>

        {/* SEO */}
        <div className="border-t border-gray-200 mt-4 pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">SEO</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Meta Title</label>
              <input value={form.metaTitle} onChange={(e) => setForm({ ...form, metaTitle: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="Page title for search engines" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Meta Description</label>
              <input value={form.metaDescription} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="Brief description for search results" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Canonical URL</label>
              <input value={form.canonicalUrl} onChange={(e) => setForm({ ...form, canonicalUrl: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">OG Image URL</label>
              <input value={form.ogImage} onChange={(e) => setForm({ ...form, ogImage: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="https://...image.jpg" />
            </div>
          </div>
        </div>
      </div>

      {/* Page Sections */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Page Sections</h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-100 border border-gray-200 rounded-lg p-0.5">
              <button
                onClick={() => setEditorMode('visual')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${editorMode === 'visual' ? 'bg-primary-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                <Layout size={12} /> Visual Builder
              </button>
              <button
                onClick={() => setEditorMode('json')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${editorMode === 'json' ? 'bg-primary-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                <Code size={12} /> JSON Source
              </button>
            </div>
          </div>
        </div>

        {editorMode === 'visual' ? (
          <PuckPageBuilder sections={sections} onChange={setSections} />
        ) : (
          <div>
            <p className="text-xs text-gray-500 mb-3">Edit the raw section data as JSON. Switch to Visual Builder for drag-and-drop editing.</p>
            <JsonEditor
              value={JSON.stringify(sections, null, 2)}
              onChange={(val) => {
                try { setSections(JSON.parse(val)); } catch {}
              }}
              height="500px"
            />
          </div>
        )}
      </div>
    </div>
  );
}
