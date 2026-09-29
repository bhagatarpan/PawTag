import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Shield, ShoppingCart, FileText, Gift, Settings, Loader2, MapPin, ChevronRight } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface UserData {
  _id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  role: string;
  status: string;
  address?: { line1?: string; city?: string; state?: string; zip?: string; country?: string };
  createdAt: string;
  lastLoginAt?: string;
  loginCount?: number;
  rbacRoles?: Array<{ roleId: { _id: string; name: string; displayName: string } }>;
}

const TABS = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'orders', label: 'Orders', icon: ShoppingCart },
  { key: 'subscriptions', label: 'Subscriptions', icon: Shield },
  { key: 'invoices', label: 'Invoices', icon: FileText },
  { key: 'referrals', label: 'Referrals', icon: Gift },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [referrals, setReferrals] = useState<any>(null);
  const [referralsLoading, setReferralsLoading] = useState(false);

  const fetchUser = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(API.admin.users.get(id));
      setUser(res.data.data);
    } catch {
      toast.error('Failed to load user');
      navigate('/users/customers');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  useEffect(() => {
    if (!id) return;
    if (activeTab === 'orders') {
      setOrdersLoading(true);
      api.get(API.admin.users.orders(id), { params: { limit: 50 } })
        .then(r => setOrders(r.data.data?.items || []))
        .catch(() => {})
        .finally(() => setOrdersLoading(false));
    }
    if (activeTab === 'subscriptions') {
      setSubscriptionsLoading(true);
      api.get(API.admin.users.subscriptions(id), { params: { limit: 50 } })
        .then(r => setSubscriptions(r.data.data?.items || []))
        .catch(() => {})
        .finally(() => setSubscriptionsLoading(false));
    }
    if (activeTab === 'invoices') {
      setInvoicesLoading(true);
      api.get(`/admin/users/${id}/invoices`, { params: { limit: 50 } })
        .then(r => setInvoices(r.data.data?.items || []))
        .catch(() => {})
        .finally(() => setInvoicesLoading(false));
    }
    if (activeTab === 'referrals') {
      setReferralsLoading(true);
      api.get(API.admin.users.referrals(id))
        .then(r => setReferrals(r.data.data))
        .catch(() => {})
        .finally(() => setReferralsLoading(false));
    }
  }, [id, activeTab]);

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-NZ', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary-600" />
        <span className="ml-3 text-gray-500">Loading user...</span>
      </div>
    );
  }

  if (!user) return null;

  const sc: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-600',
    suspended: 'bg-red-100 text-red-700',
    pending_verification: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate('/users/customers')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-3"
        >
          <ArrowLeft size={16} /> Back to Users
        </button>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center">
            <User size={24} className="text-primary-600" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{user.fullName}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${sc[user.status] || 'bg-gray-100 text-gray-600'}`}>
                {user.status}
              </span>
            </div>
            <p className="text-gray-500 mt-0.5">{user.email}</p>
            {user.phoneNumber && <p className="text-sm text-gray-400 mt-0.5">{user.phoneNumber}</p>}
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User size={16} className="text-gray-400" /> Account Details
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Email</span><span className="text-gray-900 font-medium">{user.email}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Phone</span><span className="text-gray-900 font-medium">{user.phoneNumber || '\u2014'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Role</span><span className="text-gray-900 font-medium capitalize">{user.role}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Joined</span><span className="text-gray-900 font-medium">{formatDate(user.createdAt)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Last Login</span><span className="text-gray-900 font-medium">{user.lastLoginAt ? formatDate(user.lastLoginAt) : '\u2014'}</span></div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin size={16} className="text-gray-400" /> Address
              </h3>
              {user.address ? (
                <div className="text-sm text-gray-700 space-y-1">
                  {user.address.line1 && <p>{user.address.line1}</p>}
                  {(user.address.city || user.address.state || user.address.zip) && <p>{[user.address.city, user.address.state, user.address.zip].filter(Boolean).join(', ')}</p>}
                  {user.address.country && <p>{user.address.country}</p>}
                </div>
              ) : <p className="text-sm text-gray-400">No address on file</p>}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Shield size={16} className="text-gray-400" /> Roles
              </h3>
              {user.rbacRoles && user.rbacRoles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {user.rbacRoles.map((r: any) => (
                    <span key={r.roleId._id} className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium">{r.roleId.displayName}</span>
                  ))}
                </div>
              ) : <p className="text-sm text-gray-400">No roles assigned</p>}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          ordersLoading ? <LoadingSpinner /> : orders.length === 0 ? <EmptyState icon={ShoppingCart} message="No orders yet" /> : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3"></th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((o: any) => (
                    <tr key={o._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/orders/${o._id}`)}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{o.orderNumber || o._id.slice(-8).toUpperCase()}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(o.createdAt)}</td>
                      <td className="px-6 py-4"><StatusBadge status={o.status} /></td>
                      <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">${o.total?.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right"><ChevronRight size={16} className="text-gray-400" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === 'subscriptions' && (
          subscriptionsLoading ? <LoadingSpinner /> : subscriptions.length === 0 ? <EmptyState icon={Shield} message="No subscriptions yet" /> : (
            <div className="space-y-3">
              {subscriptions.map((s: any) => (
                <div key={s._id} className="bg-white rounded-xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer" onClick={() => navigate(`/customer-subscriptions/${s._id}`)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.status === 'active' ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                        <Shield size={18} className={s.status === 'active' ? 'text-emerald-600' : 'text-gray-400'} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-gray-900 text-sm">{s.planName || s.planId?.name || 'Subscription'}</span>
                          <StatusBadge status={s.status} />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(s.startDate)} \u2014 {formatDate(s.currentPeriodEnd)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">${s.price?.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'invoices' && (
          invoicesLoading ? <LoadingSpinner /> : invoices.length === 0 ? <EmptyState icon={FileText} message="No invoices yet" /> : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Invoice</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3"></th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map((inv: any) => (
                    <tr key={inv._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-mono font-medium text-gray-900">{inv.invoiceNumber}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(inv.createdAt)}</td>
                      <td className="px-6 py-4"><StatusBadge status={inv.status} /></td>
                      <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">${inv.amount?.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const r = await api.get(`/admin/invoices/${inv._id}/view`);
                              if (r.data.data?.secureUrl) window.open(r.data.data.secureUrl, '_blank');
                            } catch { toast.error('Failed to open invoice'); }
                          }}
                          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === 'referrals' && (
          referralsLoading ? <LoadingSpinner /> : !referrals ? <EmptyState icon={Gift} message="No referral data" /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Referral Code</h3>
                {referrals.code ? (
                  <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl p-5 text-white">
                    <p className="text-xs text-white/70 uppercase tracking-wider mb-2">Customer Referral Code</p>
                    <p className="font-mono text-2xl font-bold tracking-wider">{referrals.code}</p>
                  </div>
                ) : <p className="text-sm text-gray-400">No referral code</p>}
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Referral Stats</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-2xl font-bold text-gray-900">{referrals.stats?.totalReferrals || 0}</p><p className="text-xs text-gray-500">Total Referrals</p></div>
                  <div><p className="text-2xl font-bold text-gray-900">{referrals.stats?.successfulReferrals || 0}</p><p className="text-xs text-gray-500">Successful</p></div>
                </div>
              </div>
            </div>
          )
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Account Settings</h3>
            <div className="mt-4 flex gap-3">
              <button
                onClick={async () => {
                  const ns = user.status === 'active' ? 'suspended' : 'active';
                  if (!confirm(`Are you sure you want to ${ns === 'suspended' ? 'suspend' : 'activate'} this user?`)) return;
                  try { await api.put(API.admin.users.update(user._id), { status: ns }); toast.success(`User ${ns}`); fetchUser(); } catch { toast.error('Failed'); }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${user.status === 'active' ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
              >
                {user.status === 'active' ? 'Suspend User' : 'Activate User'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = { active: 'bg-green-100 text-green-700', paid: 'bg-green-100 text-green-700', completed: 'bg-green-100 text-green-700', pending: 'bg-amber-100 text-amber-700', pending_payment: 'bg-amber-100 text-amber-700', grace_period: 'bg-amber-100 text-amber-700', failed: 'bg-red-100 text-red-700', cancelled: 'bg-gray-100 text-gray-600', expired: 'bg-red-100 text-red-700', suspended: 'bg-red-100 text-red-700' };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${c[status] || 'bg-gray-100 text-gray-600'}`}>{status.replace('_', ' ')}</span>;
}
function LoadingSpinner() { return <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin text-gray-400" /><span className="ml-2 text-sm text-gray-500">Loading...</span></div>; }
function EmptyState({ icon: Icon, message }: { icon: any; message: string }) { return <div className="text-center py-12 bg-white rounded-xl border border-gray-100"><Icon size={32} className="mx-auto mb-2 text-gray-300" /><p className="text-gray-500 font-medium">{message}</p></div>; }
