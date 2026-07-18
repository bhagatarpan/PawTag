import { useEffect, useState } from 'react';
import api, { PaginatedData } from '../lib/api';

export default function AuditLogs() {
  const [data, setData] = useState<PaginatedData<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState('');

  const fetchLogs = () => {
    setLoading(true);
    const params: any = { page, limit: 50 };
    if (entityFilter) params.entity = entityFilter;
    api
      .get('/admin/audit-logs', { params })
      .then((res) => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLogs(); }, [page, entityFilter]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audit Logs</h1>
      <p className="text-sm text-gray-500">Track all changes made across the system.</p>

      <div className="flex gap-4 items-center">
        <select
          value={entityFilter}
          onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">All Entities</option>
          <option value="User">Users</option>
          <option value="Pet">Pets</option>
          <option value="Product">Products</option>
          <option value="Order">Orders</option>
          <option value="SiteContent">Content</option>
          <option value="Setting">Settings</option>
          <option value="FeatureFlag">Feature Flags</option>
        </select>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Time</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">User</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Action</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Entity</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Entity ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">No audit logs found</td></tr>
            ) : (
              data?.items.map((log: any) => (
                <tr key={log._id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-500 text-xs">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-5 py-3">{log.userId?.fullName || 'System'}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{log.entity}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{log.entityId}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">{data.total} total logs</span>
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
