import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  PawPrint, Tag, CreditCard, ShoppingBag, Bell, AlertTriangle,
  CheckCircle, Clock, ChevronRight, Shield, QrCode,
} from 'lucide-react';
import { SummaryCards, EmptyState, StatusBadge } from '@pawtag/ui';
import api from '../../lib/api';
import type { Pet, Tag as TagType, Subscription, Order, Notification } from '../../types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DashboardData {
  pets: Pet[];
  tags: TagType[];
  subscriptions: Subscription[];
  recentOrders: Order[];
  notifications: Notification[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getPetStatusVariant(status: string): 'success' | 'danger' | 'warning' | 'info' | 'neutral' {
  switch (status) {
    case 'safe': return 'success';
    case 'lost': return 'danger';
    case 'found': return 'warning';
    case 'stolen': return 'danger';
    default: return 'neutral';
  }
}

function getOrderStatusVariant(status: string): 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'primary' {
  switch (status) {
    case 'delivered': return 'success';
    case 'shipped': return 'primary';
    case 'paid': return 'info';
    case 'pending': return 'warning';
    case 'pending_payment': return 'warning';
    case 'cancelled': return 'danger';
    case 'refunded': return 'danger';
    default: return 'neutral';
  }
}

function getNotifIcon(type: string) {
  switch (type) {
    case 'pet_lost': return <AlertTriangle size={16} className="text-red-500" />;
    case 'pet_found': return <CheckCircle size={16} className="text-green-500" />;
    case 'finder_reminder': return <Bell size={16} className="text-orange-500" />;
    case 'finder_scan': return <QrCode size={16} className="text-blue-500" />;
    default: return <Bell size={16} className="text-gray-400" />;
  }
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 shadow-sm animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
      <div className="h-7 bg-gray-200 rounded w-12" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="bg-white rounded-lg border p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200" />
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-32 mb-1" />
          <div className="h-3 bg-gray-200 rounded w-20" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function AccountDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [petsRes, tagsRes, subsRes, ordersRes, notifsRes] = await Promise.all([
          api.get('/customer/pets').catch(() => ({ data: { data: [] } })),
          api.get('/customer/tags').catch(() => ({ data: { data: [] } })),
          api.get('/customer/subscriptions').catch(() => ({ data: { data: [] } })),
          api.get('/customer/orders').catch(() => ({ data: { data: [] } })),
          api.get('/customer/notifications').catch(() => ({ data: { data: [] } })),
        ]);
        setData({
          pets: petsRes.data.data || [],
          tags: tagsRes.data.data || [],
          subscriptions: subsRes.data.data || [],
          recentOrders: (ordersRes.data.data || []).slice(0, 5),
          notifications: notifsRes.data.data || [],
        });
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  const activePets = data?.pets.filter((p) => p.status === 'safe' || p.status === 'lost' || p.status === 'found').length || 0;
  const lostPets = data?.pets.filter((p) => p.status === 'lost').length || 0;
  const activeTags = data?.tags.filter((t) => t.status === 'active').length || 0;
  const activeSubs = data?.subscriptions.filter((s) => s.status === 'active' || s.status === 'free_period' || s.status === 'grace_period').length || 0;
  const unreadNotifs = data?.notifications.filter((n) => !n.read).length || 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 bg-gray-200 rounded w-48 mb-2 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-64 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonRow key={i} />)}</div>
          <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonRow key={i} />)}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome back! Here's an overview of your pets and account.</p>
      </div>

      {/* Summary Cards */}
      <SummaryCards cards={[
        { label: 'My Pets', value: activePets, icon: <PawPrint size={20} />, color: 'primary' },
        { label: 'Lost Pets', value: lostPets, icon: <AlertTriangle size={20} />, color: lostPets > 0 ? 'danger' : 'default' },
        { label: 'Active Tags', value: activeTags, icon: <Tag size={20} />, color: 'primary' },
        { label: 'Subscriptions', value: activeSubs, icon: <CreditCard size={20} />, color: 'success' },
        { label: 'Notifications', value: unreadNotifs, icon: <Bell size={20} />, color: unreadNotifs > 0 ? 'warning' : 'default' },
      ]} />

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link to="/account/pets" className="bg-white rounded-lg border border-gray-200 p-4 hover:border-teal-300 hover:shadow-sm transition-all flex flex-col items-center gap-2 text-center">
          <PawPrint size={20} className="text-teal-600" />
          <span className="text-sm font-medium text-gray-700">My Pets</span>
        </Link>
        <Link to="/account/redeem-tag" className="bg-white rounded-lg border border-gray-200 p-4 hover:border-teal-300 hover:shadow-sm transition-all flex flex-col items-center gap-2 text-center">
          <QrCode size={20} className="text-teal-600" />
          <span className="text-sm font-medium text-gray-700">Activate Tag</span>
        </Link>
        <Link to="/account/orders" className="bg-white rounded-lg border border-gray-200 p-4 hover:border-teal-300 hover:shadow-sm transition-all flex flex-col items-center gap-2 text-center">
          <ShoppingBag size={20} className="text-teal-600" />
          <span className="text-sm font-medium text-gray-700">Orders</span>
        </Link>
        <Link to="/account/referrals" className="bg-white rounded-lg border border-gray-200 p-4 hover:border-teal-300 hover:shadow-sm transition-all flex flex-col items-center gap-2 text-center">
          <Shield size={20} className="text-teal-600" />
          <span className="text-sm font-medium text-gray-700">Referrals</span>
        </Link>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Pets */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <PawPrint size={16} className="text-teal-600" /> My Pets
            </h2>
            <Link to="/account" className="text-xs text-teal-600 hover:text-teal-800 font-medium flex items-center gap-1">
              View All <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {data?.pets.length === 0 ? (
              <EmptyState
                icon={<PawPrint size={20} className="text-gray-400" />}
                message="No pets yet"
                description="Add your first pet to get started"
                action={{ label: 'Add Pet', onClick: () => window.location.href = '/account/pets' }}
              />
            ) : (
              data?.pets.slice(0, 5).map((pet) => (
                <div key={pet._id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center overflow-hidden shrink-0">
                    {pet.photos?.[0]?.url || pet.mainPhoto ? (
                      <img src={pet.photos?.find((p) => p.isMain)?.url || pet.mainPhoto || pet.photos?.[0]?.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <PawPrint size={16} className="text-teal-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{pet.name}</p>
                    <p className="text-xs text-gray-500">{pet.petType} · {pet.breed}</p>
                  </div>
                  <StatusBadge
                    label={pet.status}
                    variant={getPetStatusVariant(pet.status)}
                    size="sm"
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <ShoppingBag size={16} className="text-teal-600" /> Recent Orders
            </h2>
            <Link to="/account/orders" className="text-xs text-teal-600 hover:text-teal-800 font-medium flex items-center gap-1">
              View All <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {data?.recentOrders.length === 0 ? (
              <EmptyState
                icon={<ShoppingBag size={20} className="text-gray-400" />}
                message="No orders yet"
                description="Your orders will appear here"
              />
            ) : (
              data?.recentOrders.map((order) => (
                <Link
                  key={order._id}
                  to={`/account/orders/${order._id}`}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <ShoppingBag size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 font-mono">{order.orderNumber}</p>
                    <p className="text-xs text-gray-500">{formatDate(order.createdAt)} · {order.items?.length || 0} item(s)</p>
                  </div>
                  <div className="text-right shrink-0">
                    <StatusBadge
                      label={order.status}
                      variant={getOrderStatusVariant(order.status)}
                      size="sm"
                    />
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">${order.payment?.amount?.toFixed(2)}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Subscriptions */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <CreditCard size={16} className="text-teal-600" /> Subscriptions
            </h2>
            <Link to="/account/subscriptions" className="text-xs text-teal-600 hover:text-teal-800 font-medium flex items-center gap-1">
              View All <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {data?.subscriptions.length === 0 ? (
              <EmptyState
                icon={<CreditCard size={20} className="text-gray-400" />}
                message="No subscriptions"
                description="Activate a tag to start a subscription"
              />
            ) : (
              data?.subscriptions.slice(0, 4).map((sub) => (
                <div key={sub._id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <CreditCard size={16} className="text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{sub.planName}</p>
                    <p className="text-xs text-gray-500">Tag: {sub.tagId?.tagId || 'N/A'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <StatusBadge
                      label={sub.status}
                      variant={sub.status === 'active' || sub.status === 'free_period' ? 'success' : sub.status === 'grace_period' ? 'warning' : 'neutral'}
                      size="sm"
                    />
                    <p className="text-xs text-gray-500 mt-0.5">
                      {sub.autoRenew ? 'Auto-renews' : 'Expires'} {formatDate(sub.currentPeriodEnd)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Notifications */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Bell size={16} className="text-teal-600" /> Notifications
              {unreadNotifs > 0 && (
                <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadNotifs}</span>
              )}
            </h2>
            <Link to="/account/notifications" className="text-xs text-teal-600 hover:text-teal-800 font-medium flex items-center gap-1">
              View All <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {data?.notifications.length === 0 ? (
              <EmptyState
                icon={<Bell size={20} className="text-gray-400" />}
                message="No notifications"
                description="You're all caught up!"
              />
            ) : (
              data?.notifications.slice(0, 5).map((n) => (
                <div key={n._id} className={`px-5 py-3 flex items-start gap-3 ${!n.read ? 'bg-teal-50/30' : ''}`}>
                  <div className="mt-0.5 shrink-0">{getNotifIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.read ? 'font-medium text-gray-900' : 'text-gray-500'}`}>{n.title || 'Notification'}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      <Clock size={10} className="inline mr-1" />
                      {formatDate(n.createdAt)}
                    </p>
                  </div>
                  {!n.read && <div className="w-2 h-2 rounded-full bg-teal-500 shrink-0 mt-2" />}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
