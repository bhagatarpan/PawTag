import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Users, PawPrint, QrCode, ShoppingBag, AlertTriangle, Activity } from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  totalPets: number;
  totalTags: number;
  totalOrders: number;
  totalRevenue: number;
  lostPets: number;
  recentScans: number;
  recentOrders: any[];
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/admin/dashboard')
      .then((res) => setStats(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-gray-500">Loading dashboard...</div>;
  if (!stats) return <div className="text-center py-12 text-red-500">Failed to load dashboard</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats.totalUsers} icon={Users} color="bg-blue-500" />
        <StatCard label="Total Pets" value={stats.totalPets} icon={PawPrint} color="bg-primary-500" />
        <StatCard label="Active Tags" value={stats.totalTags} icon={QrCode} color="bg-purple-500" />
        <StatCard label="Total Orders" value={stats.totalOrders} icon={ShoppingBag} color="bg-amber-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Revenue"
          value={`$${stats.totalRevenue.toLocaleString()}`}
          icon={ShoppingBag}
          color="bg-green-500"
        />
        <StatCard
          label="Lost Pets"
          value={stats.lostPets}
          icon={AlertTriangle}
          color="bg-red-500"
        />
        <StatCard
          label="Scans (7 days)"
          value={stats.recentScans}
          icon={Activity}
          color="bg-cyan-500"
        />
      </div>

      {stats.recentOrders.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Recent Orders</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Order #</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Customer</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Amount</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.recentOrders.map((order: any) => (
                  <tr key={order._id}>
                    <td className="px-5 py-3 font-medium">{order.orderNumber}</td>
                    <td className="px-5 py-3 text-gray-600">{order.userId?.fullName || 'N/A'}</td>
                    <td className="px-5 py-3">${order.payment?.amount?.toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        order.status === 'delivered'
                          ? 'bg-green-100 text-green-700'
                          : order.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
