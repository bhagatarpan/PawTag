import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Users, PawPrint, QrCode, ShoppingBag, AlertTriangle, Activity, TrendingUp, Package, Repeat } from 'lucide-react';

interface AnalyticsData {
  revenue: { today: number; thisWeek: number; thisMonth: number };
  orders: { today: number; thisWeek: number; thisMonth: number };
  tags: { active: number; gracePeriod: number; expired: number; total: number };
  scansThisWeek: number;
  reunionsThisWeek: number;
  lowStockProducts: Array<{ _id: string; name: string; stock: number; price: number }>;
  dailyOrders: Array<{ _id: string; count: number; revenue: number }>;
}

function StatCard({ label, value, icon: Icon, color, subtext }: { label: string; value: string | number; icon: any; color: string; subtext?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtext && <p className="text-xs text-gray-400 mt-0.5">{subtext}</p>}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/analytics/overview')
      .then((res) => setAnalytics(res.data.data))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-gray-500">Loading dashboard...</div>;
  if (error) return <div className="text-center py-12 text-red-500">{error}</div>;
  if (!analytics) return <div className="text-center py-12 text-red-500">No data available</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Revenue Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Revenue Today"
          value={`$${analytics.revenue.today.toLocaleString('en-NZ', { minimumFractionDigits: 2 })}`}
          icon={TrendingUp}
          color="bg-green-500"
          subtext={`${analytics.orders.today} order${analytics.orders.today !== 1 ? 's' : ''}`}
        />
        <StatCard
          label="Revenue This Week"
          value={`$${analytics.revenue.thisWeek.toLocaleString('en-NZ', { minimumFractionDigits: 2 })}`}
          icon={TrendingUp}
          color="bg-emerald-500"
          subtext={`${analytics.orders.thisWeek} order${analytics.orders.thisWeek !== 1 ? 's' : ''}`}
        />
        <StatCard
          label="Revenue This Month"
          value={`$${analytics.revenue.thisMonth.toLocaleString('en-NZ', { minimumFractionDigits: 2 })}`}
          icon={TrendingUp}
          color="bg-teal-500"
          subtext={`${analytics.orders.thisMonth} order${analytics.orders.thisMonth !== 1 ? 's' : ''}`}
        />
      </div>

      {/* Integration Status */}
      {/* Commerce Status */}

      {/* Operations Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Active Tags"
          value={analytics.tags.active}
          icon={QrCode}
          color="bg-purple-500"
          subtext={`${analytics.tags.total} total`}
        />
        <StatCard
          label="Scans This Week"
          value={analytics.scansThisWeek}
          icon={Activity}
          color="bg-cyan-500"
        />
        <StatCard
          label="Reunions This Week"
          value={analytics.reunionsThisWeek}
          icon={Repeat}
          color="bg-pink-500"
        />
        <StatCard
          label="Tags at Risk"
          value={analytics.tags.gracePeriod}
          icon={AlertTriangle}
          color="bg-amber-500"
          subtext={`${analytics.tags.expired} expired`}
        />
      </div>

      {/* Charts & Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Orders Chart (simple bar visualization) */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Daily Orders (30 days)</h2>
          </div>
          <div className="p-5">
            {analytics.dailyOrders.length === 0 ? (
              <div className="text-center text-gray-400 py-8">No order data yet</div>
            ) : (
              <div className="space-y-2">
                {analytics.dailyOrders.slice(-14).map((day) => {
                  const maxCount = Math.max(...analytics.dailyOrders.map((d) => d.count));
                  const width = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                  return (
                    <div key={day._id} className="flex items-center gap-3 text-sm">
                      <span className="w-20 text-gray-500 font-mono text-xs">
                        {new Date(day._id).toLocaleDateString('en-NZ', { month: 'short', day: 'numeric' })}
                      </span>
                      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div
                          className="bg-primary-500 h-full rounded-full transition-all"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <span className="w-16 text-right font-medium text-gray-700">{day.count}</span>
                      <span className="w-20 text-right text-gray-400 text-xs">
                        ${day.revenue.toFixed(0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Warning */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Package size={18} className="text-amber-500" />
              Low Stock Alerts
            </h2>
          </div>
          <div className="overflow-x-auto">
            {analytics.lowStockProducts.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400">All products well stocked</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Product</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500">Stock</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {analytics.lowStockProducts.map((product) => (
                    <tr key={product._id}>
                      <td className="px-5 py-3 font-medium">{product.name}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-medium ${product.stock <= 3 ? 'text-red-600' : 'text-amber-600'}`}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">${product.price.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Tag Health Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-lg font-semibold mb-4">Tag Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{analytics.tags.active}</p>
            <p className="text-sm text-gray-500">Active</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-amber-500">{analytics.tags.gracePeriod}</p>
            <p className="text-sm text-gray-500">Grace Period</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-red-500">{analytics.tags.expired}</p>
            <p className="text-sm text-gray-500">Expired</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-700">{analytics.tags.total}</p>
            <p className="text-sm text-gray-500">Total</p>
          </div>
        </div>
      </div>
    </div>
  );
}
