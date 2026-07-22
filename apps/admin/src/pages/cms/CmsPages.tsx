import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { PaginatedData } from '../../lib/api';

interface CmsPageItem {
  _id: string;
  slug: string;
  title: string;
  template: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  publishedAt?: string;
  updatedAt: string;
  createdBy?: { fullName: string };
  sections?: Array<{ type: string; title?: string; visible: boolean }>;
}

export default function CmsPages() {
  const navigate = useNavigate();
  const [data, setData] = useState<PaginatedData<CmsPageItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const fetchData = () => {
    setLoading(true);
    api.get('/admin/cms/pages', { params: { page, limit: 20, search: search || undefined, status: statusFilter || undefined } })
      .then((res) => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [page, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/cms/pages/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete page');
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await api.put(`/admin/cms/pages/${id}/publish`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to publish page');
    }
  };

  const statusColor = (s: string) => {
    const m: Record<string, string> = {
      published: 'bg-green-100 text-green-700',
      draft: 'bg-yellow-100 text-yellow-700',
      archived: 'bg-gray-100 text-gray-700',
    };
    return m[s] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Pages</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your website pages with the visual page builder</p>
        </div>
        <button
          onClick={() => navigate('/cms/pages/new')}
          className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700"
        >
          + New Page
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <form onSubmit={handleSearch} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or slug..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <button type="submit" className="bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-200">
            Search
          </button>
        </form>
      </div>

      {/* Pages Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Title</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Slug</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Template</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Sections</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Version</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Updated</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-500">No pages found</td></tr>
            ) : (
              data?.items.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-gray-400">{p.createdBy?.fullName || 'Unknown'}</div>
                  </td>
                  <td className="px-5 py-3 font-mono text-gray-600 text-xs">/{p.slug}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">{p.template}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">{p.sections?.length || 0}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusColor(p.status)}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">v{p.version}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {new Date(p.updatedAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => navigate(`/cms/pages/${p._id}`)} className="text-primary-600 hover:text-primary-800 text-xs">Edit</button>
                      {p.status !== 'published' && (
                        <button onClick={() => handlePublish(p._id)} className="text-green-600 hover:text-green-800 text-xs">Publish</button>
                      )}
                      <button onClick={() => handleDelete(p._id, p.title)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {data && data.totalPages > 1 && (
          <div className="flex justify-between items-center px-5 py-3 border-t border-gray-200">
            <span className="text-xs text-gray-500">Page {data.page} of {data.totalPages} ({data.total} total)</span>
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
