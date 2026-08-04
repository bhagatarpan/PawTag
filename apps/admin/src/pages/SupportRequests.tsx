import { useEffect, useState } from 'react';
import axios from 'axios';

interface SupportRequest {
  _id: string;
  name: string;
  email: string;
  message: string;
  resolved: boolean;
  resolvedAt?: string;
  notes?: string;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function SupportRequests() {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');

  const fetchRequests = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (filter === 'pending') params.resolved = 'false';
      if (filter === 'resolved') params.resolved = 'true';
      const { data } = await axios.get('/api/admin/support-requests', { params });
      if (data.success) {
        setRequests(data.data.requests);
        setPagination(data.data.pagination);
      }
    } catch {
      setError('Failed to load support requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, [filter]);

  const handleResolve = async (id: string) => {
    try {
      await axios.patch(`/api/admin/support-requests/${id}/resolve`, { notes: resolveNotes });
      setSelectedRequest(null);
      setResolveNotes('');
      fetchRequests(pagination.page);
    } catch {
      setError('Failed to resolve request');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Support Requests</h1>
        <div className="flex gap-2">
          {(['all', 'pending', 'resolved'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === f ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)} {f === 'pending' && `(${pagination.total})`}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No support requests found.</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">From</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Message</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map((req) => (
                <tr key={req._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{req.name}</div>
                    <div className="text-xs text-gray-500">{req.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-700 max-w-md truncate">{req.message}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(req.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${req.resolved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {req.resolved ? 'Resolved' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setSelectedRequest(req)} className="text-teal-600 hover:text-teal-800 text-sm font-medium">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <button onClick={() => fetchRequests(pagination.page - 1)} disabled={pagination.page <= 1} className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40">Previous</button>
              <span className="text-sm text-gray-500">Page {pagination.page} of {pagination.totalPages}</span>
              <button onClick={() => fetchRequests(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40">Next</button>
            </div>
          )}
        </div>
      )}

      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Support Request</h2>
              <button onClick={() => setSelectedRequest(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-3 mb-4">
              <div><span className="text-sm font-medium text-gray-500">Name:</span> <span className="text-sm text-gray-900">{selectedRequest.name}</span></div>
              <div><span className="text-sm font-medium text-gray-500">Email:</span> <span className="text-sm text-gray-900">{selectedRequest.email}</span></div>
              <div><span className="text-sm font-medium text-gray-500">Date:</span> <span className="text-sm text-gray-900">{new Date(selectedRequest.createdAt).toLocaleString()}</span></div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-sm font-medium text-gray-500">Message:</span>
                <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{selectedRequest.message}</p>
              </div>
            </div>
            {!selectedRequest.resolved ? (
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Notes (optional)</label>
                <textarea value={resolveNotes} onChange={(e) => setResolveNotes(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3" placeholder="Internal notes about this request..." />
                <button onClick={() => handleResolve(selectedRequest._id)} className="w-full bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700">Mark as Resolved</button>
              </div>
            ) : (
              <div className="border-t pt-4">
                <span className="inline-flex px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-700">Resolved</span>
                {selectedRequest.notes && <p className="text-sm text-gray-600 mt-2">Notes: {selectedRequest.notes}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
