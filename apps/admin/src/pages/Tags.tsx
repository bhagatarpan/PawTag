import { useEffect, useState } from 'react';
import api, { PaginatedData } from '../lib/api';

export default function Tags() {
  const [data, setData] = useState<PaginatedData<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const fetchTags = () => {
    setLoading(true);
    const params: any = { page, limit: 20 };
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    api
      .get('/admin/tags', { params })
      .then((res) => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTags(); }, [page, statusFilter]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tag Management</h1>

      <div className="flex gap-4 items-center">
        <input
          type="text"
          placeholder="Search by tag ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchTags()}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="lost">Lost</option>
        </select>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Tag ID</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Pet</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Owner</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Last Scanned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">No tags found</td></tr>
            ) : (
              data?.items.map((tag: any) => (
                <tr key={tag._id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono font-medium">{tag.tagId}</td>
                  <td className="px-5 py-3">{tag.petId?.name || 'N/A'}</td>
                  <td className="px-5 py-3 text-gray-600">{tag.ownerId?.fullName || 'N/A'}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                      tag.status === 'active' ? 'bg-green-100 text-green-700' :
                      tag.status === 'lost' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {tag.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {tag.lastScannedAt ? new Date(tag.lastScannedAt).toLocaleString() : 'Never'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">{data.total} total tags</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
            <span className="px-3 py-1">Page {page} of {data.totalPages}</span>
            <button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
