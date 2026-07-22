import { useEffect, useState } from 'react';
import api, { PaginatedData } from '../../lib/api';
import { Plus, Trash2 } from 'lucide-react';

interface Announcement {
  _id: string;
  title: string;
  message: string;
  type: string;
  priority: number;
  status: string;
  startsAt?: string;
  endsAt?: string;
  link?: string;
  linkText?: string;
  dismissible: boolean;
  visible: boolean;
  targetAudience: string;
  createdAt: string;
}

export default function CmsAnnouncements() {
  const [data, setData] = useState<PaginatedData<Announcement> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState({
    title: '', message: '', type: 'banner', priority: 0, status: 'draft',
    startsAt: '', endsAt: '', link: '', linkText: '', dismissible: true, visible: true, targetAudience: 'all',
  });

  const fetchData = () => {
    setLoading(true);
    api.get('/admin/cms/announcements', { params: { page, limit: 20 } })
      .then((res) => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [page]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', message: '', type: 'banner', priority: 0, status: 'draft', startsAt: '', endsAt: '', link: '', linkText: '', dismissible: true, visible: true, targetAudience: 'all' });
    setShowForm(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setForm({
      title: a.title, message: a.message, type: a.type, priority: a.priority, status: a.status,
      startsAt: a.startsAt ? new Date(a.startsAt).toISOString().slice(0, 16) : '',
      endsAt: a.endsAt ? new Date(a.endsAt).toISOString().slice(0, 16) : '',
      link: a.link || '', linkText: a.linkText || '', dismissible: a.dismissible, visible: a.visible, targetAudience: a.targetAudience,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        startsAt: form.startsAt || undefined,
        endsAt: form.endsAt || undefined,
      };
      if (editing) {
        await api.put(`/admin/cms/announcements/${editing._id}`, payload);
      } else {
        await api.post('/admin/cms/announcements', payload);
      }
      setShowForm(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    await api.delete(`/admin/cms/announcements/${id}`);
    fetchData();
  };

  const typeColors: Record<string, string> = {
    banner: 'bg-blue-100 text-blue-700',
    popup: 'bg-purple-100 text-purple-700',
    maintenance: 'bg-red-100 text-red-700',
    promotion: 'bg-green-100 text-green-700',
    support: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Announcements</h1>
          <p className="text-sm text-gray-500 mt-1">Manage banners, popups, and maintenance notices</p>
        </div>
        <button onClick={openCreate} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700">+ New Announcement</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit Announcement' : 'New Announcement'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm">
                  <option value="banner">Banner</option>
                  <option value="popup">Popup</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="promotion">Promotion</option>
                  <option value="support">Support</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
              <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" rows={3} required />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
                <input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Target</label>
                <select value={form.targetAudience} onChange={(e) => setForm({ ...form, targetAudience: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm">
                  <option value="all">Everyone</option>
                  <option value="logged_in">Logged In</option>
                  <option value="logged_out">Not Logged In</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Link URL</label>
                <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="https://..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Link Text</label>
                <input value={form.linkText} onChange={(e) => setForm({ ...form, linkText: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Learn More" />
              </div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.dismissible} onChange={(e) => setForm({ ...form, dismissible: e.target.checked })} /> Dismissible</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.visible} onChange={(e) => setForm({ ...form, visible: e.target.checked })} /> Visible</label>
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
              <th className="text-left px-5 py-3 font-medium text-gray-500">Title</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Type</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Priority</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Schedule</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">No announcements</td></tr>
            ) : data?.items.map((a) => (
              <tr key={a._id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium">{a.title}</td>
                <td className="px-5 py-3"><span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${typeColors[a.type] || 'bg-gray-100'}`}>{a.type}</span></td>
                <td className="px-5 py-3 text-gray-500">{a.priority}</td>
                <td className="px-5 py-3 text-xs text-gray-500">
                  {a.startsAt ? new Date(a.startsAt).toLocaleDateString() : 'No start'}
                  {a.endsAt ? ` - ${new Date(a.endsAt).toLocaleDateString()}` : ''}
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${a.status === 'published' ? 'bg-green-100 text-green-700' : a.status === 'draft' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>{a.status}</span>
                </td>
                <td className="px-5 py-3 flex gap-2">
                  <button onClick={() => openEdit(a)} className="text-primary-600 hover:text-primary-800 text-xs">Edit</button>
                  <button onClick={() => handleDelete(a._id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.totalPages > 1 && (
          <div className="flex justify-between items-center px-5 py-3 border-t border-gray-200">
            <span className="text-xs text-gray-500">Page {data.page} of {data.totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 text-xs border rounded disabled:opacity-50">Previous</button>
              <button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 text-xs border rounded disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
