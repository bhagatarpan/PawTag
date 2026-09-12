import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PawPrint, LogOut, User, ShoppingBag, Bell, Settings, ChevronRight, CreditCard, QrCode, Gift, LayoutDashboard, Home, Shield, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../hooks/useCms';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';
import AvatarUpload from './AvatarUpload';
import OnboardingWizard from './OnboardingWizard';

const NAV_ITEMS = [
  { path: '/account', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/account/pets', label: 'My Pets', icon: PawPrint },
  { path: '/account/profile', label: 'Profile', icon: User },
  { path: '/account/orders', label: 'Orders', icon: ShoppingBag },
  { path: '/account/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { path: '/account/guardian', label: 'Guardian', icon: Shield },
  { path: '/account/upgrade', label: 'Go Gold', icon: Crown },
  { path: '/account/redeem-tag', label: 'Activate Tag', icon: QrCode },
  { path: '/account/notifications', label: 'Notifications', icon: Bell },
  { path: '/account/referrals', label: 'Referrals', icon: Gift },
  { path: '/account/settings', label: 'Settings', icon: Settings },
];

function formatLastLogin(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AccountLayout({ children }: { children: ReactNode }) {
  const { user, logout, refreshUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [guardianData, setGuardianData] = useState<any>(null);

  useEffect(() => {
    api.get(API.customer.notifications.unreadCount).then((r) => setUnreadCount(r.data.data.count)).catch(() => {});
    const interval = setInterval(() => {
      api.get(API.customer.notifications.unreadCount).then((r) => setUnreadCount(r.data.data.count)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Guardian data
  useEffect(() => {
    if (!user) return;
    const fetchGuardianData = async () => {
      try {
        const [pointsRes, rewardsRes, tierRes] = await Promise.all([
          api.get('/customer/guardian/points').catch(() => ({ data: { data: null } })),
          api.get('/customer/guardian/rewards').catch(() => ({ data: { data: null } })),
          api.get('/customer/guardian/tier').catch(() => ({ data: { data: null } })),
        ]);
        if (pointsRes.data.data) {
          setGuardianData({
            points: pointsRes.data.data.points || 0,
            tier: pointsRes.data.data.tier,
            pawRewardsBalance: rewardsRes.data.data?.balance || 0,
            ...tierRes.data.data,
          });
        }
      } catch { /* ignore */ }
    };
    fetchGuardianData();
  }, [user]);

  const handleLogout = () => { logout(); navigate('/'); };

  const isActive = (path: string) => path === '/account' ? location.pathname === '/account' : location.pathname.startsWith(path);

  const currentLabel = NAV_ITEMS.find((n) => isActive(n.path))?.label || 'Account';

  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';

  // Show onboarding wizard for users who haven't completed or dismissed it.
  const shouldShowWizard = user?.onboardingCompleted === false && user?.onboardingSkipped !== true;
  if (shouldShowWizard) {
    return <OnboardingWizard />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col sticky top-16">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <PawPrint size={24} className="text-teal-600" />
            <span className="font-bold text-lg text-gray-900">My {companyName}</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = isActive(path);
            const isNotif = path === '/account/notifications';
            return (
              <Link key={path} to={path} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                <div className="relative">
                  <Icon size={18} />
                  {isNotif && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{unreadCount > 99 ? '99+' : unreadCount}</span>
                  )}
                </div>
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        {/* Header Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto flex items-center justify-end gap-4">
            {/* Home Button */}
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
            >
              <Home size={18} />
              <span className="hidden sm:inline">Home</span>
            </a>

            {/* Notification Bell */}
            <Link to="/account/notifications" className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Avatar + User Info */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{user?.fullName}</p>
                {user?.lastLogin && (
                  <p className="text-xs text-gray-400">Last login: {formatLastLogin(user.lastLogin)}</p>
                )}
              </div>

              {/* Avatar Dropdown */}
              <div className="relative group">
                <AvatarUpload
                  currentPicture={user?.profilePicture}
                  userName={user?.fullName || ''}
                  onUploadComplete={() => refreshUser()}
                  size="sm"
                />

                {/* Dropdown Menu */}
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  {/* User Info Header */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{user?.fullName}</p>
                    <p className="text-xs text-gray-400">{user?.email}</p>
                  </div>

                  {/* Guardian Info */}
                  {guardianData && (
                    <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Guardian Tier:</span>
                        <span className={`font-semibold ${guardianData.tier === 'GOLD' || guardianData.isGoldMember ? 'text-amber-600' : 'text-teal-600'}`}>
                          {guardianData.tier === 'GOLD' || guardianData.isGoldMember ? 'GOLD' : guardianData.tier}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Points:</span>
                        <span className="text-teal-600 font-semibold">{guardianData.points || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">PawRewards:</span>
                        <span className="text-amber-600 font-semibold">${(guardianData.pawRewardsBalance || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Menu Links */}
                  <Link to="/account/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <User size={16} /> Profile
                  </Link>
                  <Link to="/account/guardian" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <Shield size={16} /> Guardian
                  </Link>
                  <Link to="/account/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <Settings size={16} /> Settings
                  </Link>
                  <hr className="my-1 border-gray-100" />
                  <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full">
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <Link to="/" className="hover:text-teal-600">Home</Link>
            <ChevronRight size={14} />
            <span className="text-gray-900 font-medium">{currentLabel}</span>
          </div>
          <div key={location.pathname} className="animate-fade-in">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
