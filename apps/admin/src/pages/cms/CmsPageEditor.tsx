import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../lib/api';
import { GripVertical, Plus, Trash2, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';

interface Section {
  sectionId: string;
  type: string;
  title: string;
  subtitle: string;
  content: Record<string, unknown>;
  visible: boolean;
  order: number;
  status: 'draft' | 'published';
}

const SECTION_TYPES = [
  { value: 'hero', label: 'Hero Banner', defaults: { heading: '', subheading: '', buttonText: '', buttonUrl: '', backgroundUrl: '' } },
  { value: 'features', label: 'Features Grid', defaults: { heading: '', items: [] } },
  { value: 'rich_text', label: 'Rich Text', defaults: { html: '' } },
  { value: 'gallery', label: 'Image Gallery', defaults: { heading: '', images: [] } },
  { value: 'cards', label: 'Cards Grid', defaults: { heading: '', items: [] } },
  { value: 'pricing', label: 'Pricing Table', defaults: { heading: '', plans: [] } },
  { value: 'testimonials', label: 'Testimonials', defaults: { heading: '', items: [] } },
  { value: 'faq', label: 'FAQ Accordion', defaults: { heading: '', items: [] } },
  { value: 'timeline', label: 'Timeline', defaults: { heading: '', items: [] } },
  { value: 'statistics', label: 'Statistics Counter', defaults: { heading: '', stats: [] } },
  { value: 'video', label: 'Video Embed', defaults: { url: '', caption: '' } },
  { value: 'cta', label: 'Call to Action', defaults: { heading: '', subheading: '', buttonText: '', buttonUrl: '' } },
  { value: 'partners', label: 'Partners/Logos', defaults: { heading: '', logos: [] } },
  { value: 'map', label: 'Map', defaults: { latitude: 0, longitude: 0, zoom: 12 } },
  { value: 'custom', label: 'Custom HTML', defaults: { html: '' } },
];

function generateId() {
  return `section_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function CmsPageEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new' || !id;
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

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

  const [sections, setSections] = useState<Section[]>([]);

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

  const addSection = (type: string) => {
    const typeDef = SECTION_TYPES.find((t) => t.value === type);
    const newSection: Section = {
      sectionId: generateId(),
      type,
      title: '',
      subtitle: '',
      content: { ...(typeDef?.defaults || {}) },
      visible: true,
      order: sections.length,
      status: 'draft',
    };
    setSections([...sections, newSection]);
    setExpandedSection(newSection.sectionId);
  };

  const updateSection = (sectionId: string, updates: Partial<Section>) => {
    setSections(sections.map((s) => s.sectionId === sectionId ? { ...s, ...updates } : s));
  };

  const removeSection = (sectionId: string) => {
    if (!confirm('Remove this section?')) return;
    setSections(sections.filter((s) => s.sectionId !== sectionId));
  };

  const moveSection = (sectionId: string, direction: 'up' | 'down') => {
    const idx = sections.findIndex((s) => s.sectionId === sectionId);
    if (idx === -1) return;
    const newSections = [...sections];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newSections.length) return;
    [newSections[idx], newSections[swapIdx]] = [newSections[swapIdx], newSections[idx]];
    newSections.forEach((s, i) => { s.order = i; });
    setSections(newSections);
  };

  const toggleSectionVisibility = (sectionId: string) => {
    setSections(sections.map((s) => s.sectionId === sectionId ? { ...s, visible: !s.visible } : s));
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
          <div className="relative group">
            <button className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add Section
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 hidden group-hover:block w-56">
              {SECTION_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => addSection(type.value)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {sections.length === 0 ? (
          <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            <p>No sections yet. Click "Add Section" to start building your page.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sections.map((section, idx) => {
              const typeDef = SECTION_TYPES.find((t) => t.value === section.type);
              const isExpanded = expandedSection === section.sectionId;
              return (
                <div key={section.sectionId} className={`border rounded-lg ${section.visible ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-t-lg cursor-pointer" onClick={() => setExpandedSection(isExpanded ? null : section.sectionId)}>
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    <div className="flex-1">
                      <span className="text-sm font-medium">{typeDef?.label || section.type}</span>
                      {section.title && <span className="text-xs text-gray-500 ml-2">— {section.title}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); toggleSectionVisibility(section.sectionId); }} className="text-gray-400 hover:text-gray-600">
                        {section.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); moveSection(section.sectionId, 'up'); }} disabled={idx === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); moveSection(section.sectionId, 'down'); }} disabled={idx === sections.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); removeSection(section.sectionId); }} className="text-red-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="p-4 border-t border-gray-200">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Section Title</label>
                          <input value={section.title || ''} onChange={(e) => updateSection(section.sectionId, { title: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Subtitle</label>
                          <input value={section.subtitle || ''} onChange={(e) => updateSection(section.sectionId, { subtitle: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                        </div>
                      </div>
                      <div className="mt-4">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Section Content (JSON)</label>
                        <textarea
                          value={JSON.stringify(section.content || {}, null, 2)}
                          onChange={(e) => {
                            try {
                              updateSection(section.sectionId, { content: JSON.parse(e.target.value) });
                            } catch { /* ignore parse errors while typing */ }
                          }}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
                          rows={8}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
