import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Bell } from 'lucide-react';
import api from '../lib/api';

export default function TagExpiryNotifications() {
  const [data, setData] = useState<any>({ items: [], total: 0 });
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showAcknowledged, setShowAcknowledged] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get('/admin/tag-expiry-notifications', { params: { page, limit: 20, acknowledged: showAcknowledged } }),
      api.get('/admin/tag-expiry-notifications/stats'),
    ]).then(([listRes, statsRes]) => {
      setData(listRes.data.data);
      setStats(statsRes.data.data);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [page, showAcknowledged]);

  const acknowledge = async (id: string) => {
    await api.put(`/admin/tag-expiry-notifications/${id}/acknowledge`);
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tag Expiry Notifications</h1>
        <p className="text-sm text-gray-500">Tags with subscriptions expiring soon.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Bell size={16} /> Unacknowledged</div>
          <p className="text-2xl font-bold">{stats?.unacknowledged || 0}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-amber-600 text-sm mb-1"><AlertTriangle size={16} /> Critical (≤7 days)</div>
          <p className="text-2xl font-bold text-amber-600">{stats?.critical || 0}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><CheckCircle size={16} /> Total</div>
          <p className="text-2xl font-bold">{stats?.total || 0}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setShowAcknowledged(false)} className={`px-3 py-1.5 rounded-md text-sm ${!showAcknowledged ? 'bg-primary-600 text-white' : 'bg-white border text-gray-700'}`}>Unacknowledged</button>
        <button onClick={() => setShowAcknowledged(true)} className={`px-3 py-1.5 rounded-md text-sm ${showAcknowledged ? 'bg-primary-600 text-white' : 'bg-white border text-gray-700'}`}>All</button>
      </div>

      <div className="bg-white rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Tag</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Owner</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Plan</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Days Left</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Notified</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : data.items.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">No expiring tags</td></tr>
            ) : data.items.map((n: any) => (
              <tr key={n._id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-mono text-xs">{n.tagId?.tagId || 'N/A'}</td>
                <td className="px-5 py-3">
                  <p className="font-medium">{n.ownerId?.fullName || 'Unknown'}</p>
                  <p className="text-xs text-gray-400">{n.ownerId?.email}</p>
                </td>
                <td className="px-5 py-3 text-sm">{n.subscriptionId?.planName || 'N/A'}</td>
                <td className="px-5 py-3">
                  <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                    n.daysUntilExpiry <= 7 ? 'bg-red-100 text-red-700' :
                    n.daysUntilExpiry <= 14 ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>{n.daysUntilExpiry}d</span>
                </td>
                <td className="px-5 py-3 text-xs text-gray-500">{new Date(n.notifiedAt).toLocaleDateString()}</td>
                <td className="px-5 py-3 text-right">
                  {!n.acknowledged && (
                    <button onClick={() => acknowledge(n._id)} className="text-primary-600 hover:text-primary-800 text-sm font-medium">Acknowledge</button>
                  )}
                  {n.acknowledged && <span className="text-green-600 text-xs">Done</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
