import { useEffect, useState } from 'react';
import api, { PaginatedData } from '../../lib/api';
import { Plus, Trash2 } from 'lucide-react';

interface Redirect {
  _id: string;
  from: string;
  to: string;
  type: string;
  status: string;
  hitCount: number;
  createdAt: string;
  createdBy?: { fullName: string };
}

export default function CmsRedirects() {
  const [data, setData] = useState<PaginatedData<Redirect> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ from: '', to: '', type: 'permanent', status: 'active' });

  const fetchData = () => {
    setLoading(true);
    api.get('/admin/cms/redirects', { params: { page, limit: 20, search: search || undefined } })
      .then((res) => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [page]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/cms/redirects', form);
      setShowForm(false);
      setForm({ from: '', to: '', type: 'permanent', status: 'active' });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create redirect');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this redirect?')) return;
    await api.delete(`/admin/cms/redirects/${id}`);
    fetchData();
  };

  const handleToggle = async (redirect: Redirect) => {
    await api.put(`/admin/cms/redirects/${redirect._id}`, {
      status: redirect.status === 'active' ? 'inactive' : 'active',
    });
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Redirects</h1>
          <p className="text-sm text-gray-500 mt-1">Manage URL redirects for your website</p>
        </div>
        <button onClick={() => { setShowForm(true); setForm({ from: '', to: '', type: 'permanent', status: 'active' }); }} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700">+ New Redirect</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">New Redirect</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Path *</label>
                <input value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm font-mono" placeholder="/old-page" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Path *</label>
                <input value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm font-mono" placeholder="/new-page" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm">
                  <option value="permanent">Permanent (301)</option>
                  <option value="temporary">Temporary (302)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700">Create</button>
              <button type="button" onClick={() => setShowForm(false)} className="border border-gray-300 px-4 py-2 rounded-md text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchData()} placeholder="Search redirects..." className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500" />
          </div>
          <button onClick={fetchData} className="bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-200">Search</button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">From</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">To</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Type</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Hits</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">No redirects found</td></tr>
            ) : data?.items.map((r) => (
              <tr key={r._id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-mono text-xs">{r.from}</td>
                <td className="px-5 py-3 font-mono text-xs">{r.to}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${r.type === 'permanent' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {r.type === 'permanent' ? '301' : '302'}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">{r.hitCount}</td>
                <td className="px-5 py-3">
                  <button onClick={() => handleToggle(r)} className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full cursor-pointer ${r.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {r.status}
                  </button>
                </td>
                <td className="px-5 py-3">
                  <button onClick={() => handleDelete(r._id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
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
