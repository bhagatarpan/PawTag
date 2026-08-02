import { useState, useEffect } from 'react';
import { Users, CheckCircle, Clock, Gift, ExternalLink } from 'lucide-react';
import api from '../lib/api';

export default function Referrals() {
  const [data, setData] = useState<any>({ items: [], total: 0 });
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get('/admin/referrals', { params: { page, limit: 20 } }),
      api.get('/admin/referrals/stats'),
    ]).then(([listRes, statsRes]) => {
      setData(listRes.data.data);
      setStats(statsRes.data.data);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [page]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Referrals</h1>
        <p className="text-sm text-gray-500">Manage and track referral program performance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Users size={16} /> Total Referrals</div>
          <p className="text-2xl font-bold">{stats?.totalReferrals || 0}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><CheckCircle size={16} /> Completed</div>
          <p className="text-2xl font-bold text-green-600">{stats?.completedReferrals || 0}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Clock size={16} /> Pending</div>
          <p className="text-2xl font-bold text-amber-600">{stats?.pendingReferrals || 0}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Gift size={16} /> Active Codes</div>
          <p className="text-2xl font-bold text-primary-600">{stats?.totalCodes || 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Referrer</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Referred User</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Code</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Reward</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : data.items.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">No referrals yet</td></tr>
            ) : data.items.map((r: any) => (
              <tr key={r._id} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <p className="font-medium">{r.referrerId?.fullName || 'Unknown'}</p>
                  <p className="text-xs text-gray-400">{r.referrerId?.email}</p>
                </td>
                <td className="px-5 py-3">
                  <p className="font-medium">{r.refereeId?.fullName || 'Unknown'}</p>
                  <p className="text-xs text-gray-400">{r.refereeId?.email}</p>
                </td>
                <td className="px-5 py-3 font-mono text-xs">{r.referralCode}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.status === 'rewarded' ? 'bg-green-100 text-green-700' :
                    r.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>{r.status}</span>
                </td>
                <td className="px-5 py-3 text-sm">{r.referrerRewardMonths}mo + {r.refereeRewardMonths}mo</td>
                <td className="px-5 py-3 text-gray-500 text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.totalPages > 1 && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">{data.total} total referrals</span>
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
