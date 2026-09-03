import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import {
  Search,
  Plus,
  Filter,
  DollarSign,
  Calendar,
  Zap,
  Tag as TagIcon,
  CreditCard,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SubscriptionPlan {
  _id: string;
  name: string;
  sku: string;
  description: string;
  shortDescription?: string;
  price: number;
  salePrice?: number;
  compareAtPrice?: number;
  currency: string;
  images: string[];
  category: string;
  tags: string[];
  isActive: boolean;
  isPublished: boolean;
  stock: number;
  reserved: number;
  lowStockThreshold: number;
  stockPolicy: 'deny' | 'allow';
  weight?: number;
  dimensions?: { length: number; width: number; height: number; unit: 'cm' | 'in' };
  variants: Array<{
    name: string;
    sku: string;
    price: number;
    salePrice?: number;
    stock: number;
    reserved: number;
    image?: string;
    attributes: Record<string, string>;
  }>;
  customizable: boolean;
  customizationPrice: number;
  shippingCost: number;
  warrantyMonths: number;
  isSubscription: boolean;
  isTagProduct: boolean;
  subscriptionConfig?: {
    type: 'annual' | 'monthly';
    freePeriodMonths: number;
    gracePeriodWeeks: number;
    monthlyPrice?: number;
    stripePriceId?: string;
    features: string[];
  };
  sortOrder: number;
  badge?: string;
  createdAt: string;
  updatedAt: string;
}

interface PlanStats {
  total: number;
  active: number;
  inactive: number;
  annual: number;
  monthly: number;
  totalMrr: number;
}

const TYPE_COLORS: Record<string, string> = {
  annual: 'bg-blue-100 text-blue-700',
  monthly: 'bg-green-100 text-green-700',
};

const TYPE_LABELS: Record<string, string> = {
  annual: 'Annual',
  monthly: 'Monthly',
};

const STATUS_COLORS: Record<string, string> = {
  true: 'bg-green-100 text-green-700',
  false: 'bg-gray-100 text-gray-700',
};

const STATUS_LABELS: Record<string, string> = {
  true: 'Active',
  false: 'Inactive',
};

export default function SubscriptionPlans() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [stats, setStats] = useState<PlanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [statusFilter, typeFilter, page, search]);

  async function fetchStats() {
    try {
      const res = await api.get('/admin/products', { params: { isSubscription: 'true', limit: 1000 } });
      const items = res.data.data.items || [];
      const total = items.length;
      const active = items.filter((p: SubscriptionPlan) => p.isActive).length;
      const inactive = items.filter((p: SubscriptionPlan) => !p.isActive).length;
      const annual = items.filter((p: SubscriptionPlan) => p.subscriptionConfig?.type === 'annual').length;
      const monthly = items.filter((p: SubscriptionPlan) => p.subscriptionConfig?.type === 'monthly').length;
      const totalMrr = items
        .filter((p: SubscriptionPlan) => p.isActive)
        .reduce((sum: number, p: SubscriptionPlan) => {
          const monthlyPrice = p.subscriptionConfig?.monthlyPrice || p.price / (p.subscriptionConfig?.type === 'annual' ? 12 : 1);
          return sum + monthlyPrice;
        }, 0);
      setStats({ total, active, inactive, annual, monthly, totalMrr });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }

  async function fetchPlans() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('isSubscription', 'true');
      if (statusFilter) params.set('isActive', statusFilter);
      if (typeFilter) params.set('subscriptionType', typeFilter);
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('limit', '20');
      params.set('sortBy', 'sortOrder');
      params.set('sortDir', 'asc');

      const res = await api.get(`/admin/products?${params.toString()}`);
      setPlans(res.data.data.items || []);
      setTotalPages(res.data.data.totalPages || 1);
    } catch (err) {
      console.error('Failed to fetch subscription plans:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchPlans();
  }

  function formatPrice(price: number, currency = 'NZD') {
    return new Intl.NumberFormat('en-NZ', { style: 'currency', currency }).format(price);
  }

  function getMonthlyPrice(plan: SubscriptionPlan): number {
    if (plan.subscriptionConfig?.monthlyPrice) return plan.subscriptionConfig.monthlyPrice;
    if (plan.subscriptionConfig?.type === 'annual') return plan.price / 12;
    return plan.price;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription Plans</h1>
          <p className="mt-1 text-sm text-gray-500">Manage subscription products and pricing</p>
        </div>
        <button
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus size={16} /> Add Plan
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Total Plans" value={stats.total} color="text-gray-900" icon={<CreditCard size={20} />} />
          <StatCard label="Active" value={stats.active} color="text-green-600" icon={<CreditCard size={20} />} />
          <StatCard label="Inactive" value={stats.inactive} color="text-gray-600" icon={<CreditCard size={20} />} />
          <StatCard label="Annual" value={stats.annual} color="text-blue-600" icon={<Calendar size={20} />} />
          <StatCard label="Monthly" value={stats.monthly} color="text-green-600" icon={<Zap size={20} />} />
          <StatCard label="MRR" value={formatPrice(stats.totalMrr)} color="text-blue-600" icon={<DollarSign size={20} />} />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, SKU..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </form>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Billing Cycle</label>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Types</option>
              <option value="annual">Annual</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monthly Equiv.</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Free Period</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grace Period</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Published</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-500">Loading...</td>
              </tr>
            ) : plans.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                  No subscription plans found
                </td>
              </tr>
            ) : (
              plans.map((plan) => (
                <tr key={plan._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {plan.images?.[0] && (
                        <img
                          src={plan.images[0]}
                          alt={plan.name}
                          className="w-10 h-10 rounded-lg object-cover border border-gray-200"
                        />
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">{plan.name}</div>
                        <div className="text-xs text-gray-500 font-mono">{plan.sku}</div>
                        {plan.badge && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                            {plan.badge}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${plan.subscriptionConfig?.type ? TYPE_COLORS[plan.subscriptionConfig.type] : 'bg-gray-100 text-gray-700'}`}>
                      {plan.subscriptionConfig?.type ? TYPE_LABELS[plan.subscriptionConfig.type] : '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {formatPrice(plan.price, plan.currency)}
                      {plan.salePrice && plan.salePrice < plan.price && (
                        <span className="ml-2 text-sm text-gray-400 line-through">
                          {formatPrice(plan.price, plan.currency)}
                        </span>
                      )}
                    </div>
                    {plan.compareAtPrice && plan.compareAtPrice > plan.price && (
                      <div className="text-xs text-gray-500">Was {formatPrice(plan.compareAtPrice, plan.currency)}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-green-700">
                    {formatPrice(getMonthlyPrice(plan), plan.currency)}/mo
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {plan.subscriptionConfig?.freePeriodMonths && plan.subscriptionConfig.freePeriodMonths > 0
                      ? `${plan.subscriptionConfig.freePeriodMonths} month${plan.subscriptionConfig.freePeriodMonths !== 1 ? 's' : ''} free`
                      : 'No free period'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {plan.subscriptionConfig?.gracePeriodWeeks && plan.subscriptionConfig.gracePeriodWeeks > 0
                      ? `${plan.subscriptionConfig.gracePeriodWeeks} week${plan.subscriptionConfig.gracePeriodWeeks !== 1 ? 's' : ''}`
                      : 'No grace period'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[String(plan.isActive)] || 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABELS[String(plan.isActive)] || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[String(plan.isPublished)] || 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABELS[String(plan.isPublished)] || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/products/${plan._id}`}
                        className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                      >
                        Edit
                      </Link>
                      <button
                        className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                      >
                        Duplicate
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="inline-flex items-center gap-1 px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-gray-500 uppercase">{label}</div>
        <div className="p-2 bg-gray-100 rounded-lg text-gray-600">{icon}</div>
      </div>
      <div className={`text-2xl font-bold mt-2 ${color}`}>{value}</div>
    </div>
  );
}