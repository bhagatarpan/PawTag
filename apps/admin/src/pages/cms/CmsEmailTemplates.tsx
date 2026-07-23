import { useState, useEffect } from 'react';
import { Mail, Plus, Search, Edit, Trash2, Eye, EyeOff, Copy } from 'lucide-react';
import api from '../../lib/api';

interface EmailTemplate {
  _id: string;
  name: string;
  slug: string;
  subject: string;
  title: string;
  subtitle?: string;
  senderEmail: string;
  senderName: string;
  variables: string[];
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  createdBy?: { fullName: string };
}

export default function CmsEmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', slug: '', subject: '', title: '', subtitle: '',
    body: '', ctaText: '', ctaUrl: '', preheader: '', footerText: '',
    senderEmail: 'no-reply@pawtag.co.nz', senderName: 'PawTag',
    variables: [] as string[], status: 'active' as 'active' | 'inactive',
  });

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(`/admin/cms/email/email-templates?${params}`);
      setTemplates(res.data.data.items);
      setTotalPages(res.data.data.totalPages);
      setTotal(res.data.data.total);
    } catch (err) {
      console.error('Failed to fetch email templates', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, [page, search, statusFilter]);

  const handleSave = async () => {
    try {
      if (editingTemplate) {
        await api.put(`/admin/cms/email/email-templates/${editingTemplate._id}`, form);
      } else {
        await api.post('/admin/cms/email/email-templates', form);
      }
      setShowForm(false);
      setEditingTemplate(null);
      resetForm();
      fetchTemplates();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save template');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await api.delete(`/admin/cms/email/email-templates/${id}`);
      fetchTemplates();
    } catch (err) {
      console.error('Failed to delete template', err);
    }
  };

  const handleDuplicate = async (template: EmailTemplate) => {
    setForm({
      name: `${template.name} (Copy)`,
      slug: `${template.slug}-copy`,
      subject: template.subject,
      title: template.title,
      subtitle: template.subtitle || '',
      body: '',
      ctaText: '',
      ctaUrl: '',
      preheader: '',
      footerText: '',
      senderEmail: template.senderEmail,
      senderName: template.senderName,
      variables: template.variables,
      status: 'inactive',
    });
    setEditingTemplate(null);
    setShowForm(true);
  };

  const resetForm = () => {
    setForm({
      name: '', slug: '', subject: '', title: '', subtitle: '',
      body: '', ctaText: '', ctaUrl: '', preheader: '', footerText: '',
      senderEmail: 'no-reply@pawtag.co.nz', senderName: 'PawTag',
      variables: [], status: 'active',
    });
  };

  const startEdit = (template: EmailTemplate) => {
    setForm({
      name: template.name,
      slug: template.slug,
      subject: template.subject,
      title: template.title,
      subtitle: template.subtitle || '',
      body: '',
      ctaText: '',
      ctaUrl: '',
      preheader: '',
      footerText: '',
      senderEmail: template.senderEmail,
      senderName: template.senderName,
      variables: template.variables,
      status: template.status,
    });
    setEditingTemplate(template);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
          <p className="text-gray-500 text-sm mt-1">{total} templates</p>
        </div>
        <button
          onClick={() => { resetForm(); setEditingTemplate(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} /> New Template
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold">{editingTemplate ? 'Edit Template' : 'New Template'}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                  <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
                  <input type="text" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body (HTML) *</label>
                <textarea rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CTA Text</label>
                  <input type="text" value={form.ctaText} onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CTA URL</label>
                  <input type="text" value={form.ctaUrl} onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preheader</label>
                <input type="text" value={form.preheader} onChange={(e) => setForm({ ...form, preheader: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sender Email *</label>
                  <input type="email" value={form.senderEmail} onChange={(e) => setForm({ ...form, senderEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sender Name *</label>
                  <input type="text" value={form.senderName} onChange={(e) => setForm({ ...form, senderName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Variables (comma-separated)</label>
                <input type="text" value={form.variables.join(', ')} onChange={(e) => setForm({ ...form, variables: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => { setShowForm(false); setEditingTemplate(null); }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {editingTemplate ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12">
          <Mail size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No email templates found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Template</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sender</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {templates.map((t) => (
                <tr key={t._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{t.name}</div>
                    <div className="text-sm text-gray-500">{t.slug}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{t.subject}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{t.senderName} &lt;{t.senderEmail}&gt;</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      t.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {t.status === 'active' ? <Eye size={12} /> : <EyeOff size={12} />}
                      {t.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => startEdit(t)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDuplicate(t)} className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50">
                        <Copy size={16} />
                      </button>
                      <button onClick={() => handleDelete(t._id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50">Previous</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
