/**
 * @module Reports Page
 * @description Admin page for commerce reports and analytics.
 */

import { useEffect, useState, useCallback } from 'react';
import { Loader2, TrendingUp, DollarSign, ShoppingCart, Package, Users, BarChart3 } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface ReportSummary {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  totalCustomers: number;
  averageOrderValue: number;
  recentOrders: Array<{ orderNumber: string; amount: number; status: string; createdAt: string }>;
}

export default function Reports() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      const [ordersRes, analyticsRes] = await Promise.all([
        api.get('/admin/commerce/orders', { params: { limit: 100 } }),
        api.get('/admin/analytics/overview').catch(() => ({ data: { data: {} } })),
      ]);

      const orders = ordersRes.data?.data?.items || [];
      const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.payment?.amount || 0), 0);
      const paidOrders = orders.filter((o: any) => o.payment?.status === 'completed');

      setSummary({
        totalRevenue,
        totalOrders: orders.length,
        totalProducts: 0,
        totalCustomers: analyticsRes.data?.data?.users?.total || 0,
        averageOrderValue: paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0,
        recentOrders: orders.slice(0, 10).map((o: any) => ({
          orderNumber: o.orderNumber,
          amount: o.payment?.amount || 0,
          status: o.status,
          createdAt: o.createdAt,
        })),
      });
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-teal-500" size={24} /></div>;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg"><DollarSign size={20} className="text-green-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-xl font-bold text-gray-900">${(summary?.totalRevenue || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg"><ShoppingCart size={20} className="text-blue-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Total Orders</p>
              <p className="text-xl font-bold text-gray-900">{summary?.totalOrders || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg"><TrendingUp size={20} className="text-purple-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Avg Order Value</p>
              <p className="text-xl font-bold text-gray-900">${(summary?.averageOrderValue || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg"><Users size={20} className="text-amber-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Total Customers</p>
              <p className="text-xl font-bold text-gray-900">{summary?.totalCustomers || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Orders</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(summary?.recentOrders || []).map((o) => (
              <tr key={o.orderNumber} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900">{o.orderNumber}</td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">${o.amount.toFixed(2)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${o.status === 'paid' ? 'bg-green-100 text-green-700' : o.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
