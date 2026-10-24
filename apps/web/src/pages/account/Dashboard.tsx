import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PawPrint, Tag, CreditCard, ShoppingBag, Bell, AlertTriangle,
  CheckCircle, Clock, ChevronRight, Shield, QrCode, Forward, X, Crown,
} from 'lucide-react';
import {
  SummaryCards, EmptyState, StatusBadge, CopyButton, TagUsageIndicator,
  PhotoHero, InfoCard, Button, buttonClassName,
} from '@pawtag/ui';
import { API } from '@pawtag/shared/api';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type { Pet, Tag as TagType, Subscription, Order, Notification } from '../../types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface GuardianData {
  points: number;
  tier: string;
  pawRewardsBalance: number;
}

interface DashboardData {
  pets: Pet[];
  tags: TagType[];
  subscriptions: Subscription[];
  recentOrders: Order[];
  notifications: Notification[];
  escalations: EscalationRecord[];
  guardian: GuardianData | null;
  membership: {
    hasMembership: boolean;
    membership: any;
    tier: any;
    entitlements?: Record<string, { enabled: boolean; value: any; name?: string; description?: string }>;
    /** Tag activation usage from /membership/status (docs/TAG-ACTIVATION-LIMIT.md) */
    tagUsage?: { activeCount: number; purchasedCount: number; limit: number };
  } | null;
}

interface EscalationRecord {
  _id: string;
  petId: { name: string; petId: string; photos?: Array<{ url: string }> };
  tagId: { tagId: string };
  status: 'pending' | 'owner_responded' | 'escalated' | 'forwarded' | 'resolved';
  foundAt: string;
  escalationDeadline: string;
  finderName?: string;
  finderPhone?: string;
  finderEmail?: string;
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

/** Main photo for a pet, or null when the pet has no images. */
function petPhotoUrl(pet: Pet): string | null {
  return pet.photos?.find((p) => p.isMain)?.url || pet.mainPhoto || pet.photos?.[0]?.url || null;
}

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 shadow-sm animate-shimmer">
      <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
      <div className="h-7 bg-gray-200 rounded w-12" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="bg-white rounded-lg border p-4 animate-shimmer">
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [howItWorksDismissed, setHowItWorksDismissed] = useState(false);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [petsRes, tagsRes, subsRes, ordersRes, notifsRes, escRes, guardianRes, membershipRes] = await Promise.all([
          api.get(API.customer.pets.list).catch(() => ({ data: { data: [] } })),
          api.get(API.customer.tags.list).catch(() => ({ data: { data: [] } })),
          api.get(API.customer.subscriptions.list).catch(() => ({ data: { data: [] } })),
          api.get(API.customer.orders.list).catch(() => ({ data: { data: [] } })),
          api.get(API.customer.notifications.list).catch(() => ({ data: { data: [] } })),
          api.get(`${API.customer.escalations.list}?status=pending`).catch(() => ({ data: { data: [] } })),
          api.get(API.customer.guardian.points).catch(() => ({ data: { data: null } })),
          api.get(API.customer.membership.status).catch(() => ({ data: { data: null } })),
        ]);
        setData({
          pets: petsRes.data.data || [],
          tags: tagsRes.data.data || [],
          subscriptions: subsRes.data.data || [],
          recentOrders: (ordersRes.data.data || []).slice(0, 5),
          notifications: notifsRes.data.data || [],
          escalations: escRes.data.data || [],
          guardian: guardianRes.data.data || null,
          membership: membershipRes.data.data || null,
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
  const guardianPoints = data?.guardian?.points || 0;
  const guardianTier = data?.guardian?.tier || 'CARE';
  // Server-computed usage/limit (same service the CSR drawer uses) — falls
  // back to the local count when membership/status failed to load
  const tagUsage = data?.membership?.tagUsage;
  const activeTagCount = tagUsage?.activeCount ?? activeTags;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 bg-gray-200 rounded w-48 mb-2 animate-shimmer" />
          <div className="h-4 bg-gray-200 rounded w-64 animate-shimmer" />
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

  const heroPhoto = data?.pets.map(petPhotoUrl).find(Boolean) || null;
  const firstName = user?.fullName?.split(' ')[0] || 'there';
  const greetingTitle = `${greetingForNow()}, ${firstName}!`;
  const greetingSubtitle =
    lostPets > 0
      ? `${lostPets} ${lostPets === 1 ? 'pet is' : 'pets are'} in Lost Mode — here's how to bring them home.`
      : 'Healthy pets. Happier tomorrows.';

  return (
    <div className="space-y-6">
      {/* Greeting hero — photography-led per the concept boards; teal
          gradient fallback when no pet photo exists yet. */}
      {heroPhoto ? (
        <PhotoHero
          src={heroPhoto}
          alt=""
          title={greetingTitle}
          subtitle={greetingSubtitle}
          className="rounded-2xl"
          aspectClassName="aspect-[16/9] sm:aspect-[21/6]"
        />
      ) : (
        <div className="rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 p-5 sm:p-6 text-white">
          <h1 className="text-xl font-bold text-white sm:text-2xl">{greetingTitle}</h1>
          <div className="mt-1 text-sm text-white/90">{greetingSubtitle}</div>
        </div>
      )}

      {/* Lost pets surface immediately — calm, restrained, actionable */}
      {lostPets > 0 && (
        <InfoCard
          tone="danger"
          icon={<AlertTriangle size={18} />}
          title={`${lostPets} ${lostPets === 1 ? 'pet is' : 'pets are'} in Lost Mode`}
          trailing={
            <Link to="/account/pets" className={buttonClassName({ variant: 'secondary' })}>
              View
            </Link>
          }
        >
          Finders can scan the tag and notify you. Keep notifications on for sightings.
        </InfoCard>
      )}

      {/* Pending escalations — time-critical, so they sit above the fold */}
      {data?.escalations && data.escalations.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-amber-200 bg-amber-100">
            <h2 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
              <AlertTriangle size={16} /> Pending Pet Found Alerts
            </h2>
          </div>
          <div className="divide-y divide-amber-200">
            {data.escalations.map((esc) => {
              const timeLeft = Math.max(0, Math.floor((new Date(esc.escalationDeadline).getTime() - Date.now()) / 60000));
              return (
                <div key={esc._id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      {esc.petId?.photos?.[0]?.url ? (
                        <img src={esc.petId.photos[0].url} alt="" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <PawPrint size={18} className="text-amber-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {esc.petId?.name || 'Pet'} was found!
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {esc.finderName ? `By ${esc.finderName}` : 'Finder notified you'}
                        {esc.finderPhone && ` · ${esc.finderPhone}`}
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        <Clock size={10} className="inline mr-1" />
                        {timeLeft > 0 ? `${timeLeft} min until emergency contact is notified` : 'Emergency contact will be notified soon'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        variant="success"
                        icon={<CheckCircle size={14} />}
                        onClick={async () => {
                          if (confirm('Mark as resolved? This means you have made contact with the finder.')) {
                            await api.post(API.customer.escalations.resolve(esc._id));
                            setData((prev) => prev ? { ...prev, escalations: prev.escalations.filter((e) => e._id !== esc._id) } : prev);
                          }
                        }}
                      >
                        I Made Contact
                      </Button>
                      <Button
                        variant="secondary"
                        icon={<Forward size={14} />}
                        onClick={async () => {
                          if (confirm('Forward this alert to your emergency contact now?')) {
                            await api.post(API.customer.escalations.forward(esc._id));
                            setData((prev) => prev ? { ...prev, escalations: prev.escalations.filter((e) => e._id !== esc._id) } : prev);
                          }
                        }}
                      >
                        Forward to EC
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Onboarding Nudge Banner */}
      {user?.onboardingSkipped && !user?.onboardingCompleted && !nudgeDismissed && (
        <div className="bg-gradient-to-r from-primary-50 to-teal-50 border border-primary-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle size={18} className="text-primary-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Your profile is incomplete</p>
            <p className="text-sm text-gray-600 mt-0.5">
              Complete your profile so finders can reach you faster when your pet is found. It only takes 2 minutes.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <Button size="md" onClick={() => navigate('/account/profile')}>
                Complete Now
              </Button>
              <Button size="md" variant="ghost" onClick={() => setNudgeDismissed(true)}>
                Dismiss for today
              </Button>
            </div>
          </div>
          <button
            onClick={() => setNudgeDismissed(true)}
            className="p-1 text-gray-400 hover:text-gray-600 shrink-0"
            aria-label="Dismiss profile reminder"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Your pets — photo-led status card (concept board 1) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Your pets</h2>
            <p className="text-xs text-gray-500">
              {data?.pets.length || 0} {data?.pets.length === 1 ? 'pet' : 'pets'}
            </p>
          </div>
        </div>
        {data?.pets.length === 0 ? (
          <EmptyState
            icon={<PawPrint size={20} className="text-gray-400" />}
            message="No pets yet"
            description="Add your first pet to get started"
            action={{ label: 'Add Pet', onClick: () => navigate('/account/pets') }}
          />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {data?.pets.slice(0, 3).map((pet) => {
                const photo = petPhotoUrl(pet);
                return (
                  <Link key={pet._id} to="/account/pets" className="min-w-0 group">
                    <div className="aspect-square rounded-xl bg-primary-50 overflow-hidden flex items-center justify-center">
                      {photo ? (
                        <img
                          src={photo}
                          alt={pet.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <PawPrint size={24} className="text-primary-400" />
                      )}
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold text-gray-900">{pet.name}</p>
                    <div className="mt-0.5">
                      <StatusBadge label={pet.status} variant={getPetStatusVariant(pet.status)} size="sm" />
                    </div>
                  </Link>
                );
              })}
            </div>
            <Link
              to="/account/pets"
              className={`mt-4 ${buttonClassName({ full: true, size: 'lg' })}`}
            >
              <PawPrint size={18} />
              Manage my pets
            </Link>
          </>
        )}
      </div>

      {/* Summary Cards */}
      <SummaryCards cards={[
        { label: 'My Pets', value: activePets, icon: <PawPrint size={20} />, color: 'primary' },
        { label: 'Lost Pets', value: lostPets, icon: <AlertTriangle size={20} />, color: lostPets > 0 ? 'danger' : 'default' },
        { label: 'Active Tags', value: activeTagCount, icon: <Tag size={20} />, color: 'primary', sub: tagUsage ? <TagUsageIndicator activeCount={tagUsage.activeCount} limit={tagUsage.limit} ownedCount={tagUsage.purchasedCount} variant="block" /> : undefined },
        { label: 'Subscriptions', value: activeSubs, icon: <CreditCard size={20} />, color: 'success' },
        { label: 'Notifications', value: unreadNotifs, icon: <Bell size={20} />, color: unreadNotifs > 0 ? 'warning' : 'default' },
        ...(guardianPoints > 0 ? [{ label: `${guardianTier} Points`, value: guardianPoints, icon: <Shield size={20} />, color: 'primary' as const }] : []),
      ]} />

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
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
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-medium text-gray-900 font-mono">{order.orderNumber}</p>
                      <CopyButton text={order.orderNumber} size={10} />
                    </div>
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
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
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
                    <p className="text-xs text-gray-500">Tag: {sub.tagId?.tagId || 'N/A'} {sub.tagId?.tagId && <CopyButton text={sub.tagId.tagId} size={10} />}</p>
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
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
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

      {/* How PawTag Works */}
      {!howItWorksDismissed && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">How PawTag Works</h3>
            <button
              onClick={() => setHowItWorksDismissed(true)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Dismiss how PawTag works"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <InfoCard tone="primary" icon={<PawPrint size={18} />} title="Attach Tag">
              Tie the PawTag to your pet's collar.
            </InfoCard>
            <InfoCard tone="primary" icon={<QrCode size={18} />} title="Someone Finds Them">
              They scan the QR code on the tag.
            </InfoCard>
            <InfoCard tone="primary" icon={<Bell size={18} />} title="You're Notified">
              Instant alert via push notification + email.
            </InfoCard>
          </div>
        </div>
      )}

      {/* Guardian + Membership — 2-column row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Guardian Status Card */}
        {data?.guardian ? (
          <InfoCard
            tone="primary"
            icon={<Shield size={20} />}
            title={`Guardian ${data.guardian.tier} Member`}
            trailing={
              <Link to="/account/guardian" className={buttonClassName({ variant: 'secondary' })}>
                View Dashboard
              </Link>
            }
          >
            {data.guardian.points} points · ${(data.guardian.pawRewardsBalance || 0).toFixed(2)} PawRewards
          </InfoCard>
        ) : (
          <InfoCard
            tone="amber"
            icon={<Shield size={20} />}
            title="Join Guardian — It's Free"
            trailing={
              <Link to="/account/guardian" className={buttonClassName({ variant: 'secondary' })}>
                Learn More
              </Link>
            }
          >
            Earn points on every purchase and unlock exclusive rewards
          </InfoCard>
        )}

        {/* Membership Status Card */}
        {data?.membership?.hasMembership && data.membership.tier ? (
          <div className={`bg-gradient-to-r rounded-2xl border p-5 ${
            data.membership.tier.tier === 'platinum' ? 'from-gray-100 to-gray-200 border-gray-300' :
            data.membership.tier.tier === 'black' ? 'from-gray-800 to-black border-gray-700' :
            'from-amber-50 to-yellow-50 border-amber-200'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  data.membership.tier.tier === 'platinum' ? 'bg-gray-500' :
                  data.membership.tier.tier === 'black' ? 'bg-gray-900' :
                  'bg-amber-500'
                }`}>
                  <Crown size={24} className="text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className={`font-semibold ${
                    data.membership.tier.tier === 'black' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {data.membership.tier.displayName} Member
                  </h3>
                  <p className={`text-sm ${
                    data.membership.tier.tier === 'black' ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {data.membership.entitlements?.points_multiplier?.value || data.membership.tier.entitlements?.points_multiplier?.value || 1}× points · Renews {new Date(data.membership.membership.currentPeriodEnd).toLocaleDateString('en-NZ', { dateStyle: 'medium' })}
                  </p>
                </div>
              </div>
              <Link
                to="/account/membership"
                className={`shrink-0 ${buttonClassName({
                  variant: data.membership.tier.tier === 'black' ? 'secondary' : 'primary',
                })}`}
              >
                Manage
              </Link>
            </div>
          </div>
        ) : data?.membership && !data.membership.hasMembership ? (
          <div className="bg-gradient-to-r from-primary-50 to-teal-50 rounded-2xl border border-primary-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center shrink-0">
                  <Crown size={24} className="text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-primary-900">Upgrade to Gold — $89/year</h3>
                  <p className="text-sm text-primary-700">
                    Get 3× tag coverage, 2× points, and exclusive benefits
                  </p>
                </div>
              </div>
              <Link
                to="/membership"
                className={`shrink-0 ${buttonClassName({ variant: 'primary' })}`}
              >
                View Plans
              </Link>
            </div>
          </div>
        ) : null}
      </div>

    </div>
  );
}
