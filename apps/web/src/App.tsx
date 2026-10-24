import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ReactNode, useEffect } from 'react';
import { SiteAvailabilityStatus } from '@pawtag/shared';
import { ToastHost } from '@pawtag/ui';
import { stashScrollBeforeLogin, takeScrollReturn } from './lib/scroll-return';
import { setReturnUrl } from './lib/return-url';
import { useSiteAvailability } from './components/SiteAvailabilityProvider';
import MaintenanceBanner from './components/MaintenanceBanner';
import OfflinePage from './pages/OfflinePage';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import EmergencyLostPet from './components/EmergencyLostPet';
import AccountLayout from './components/AccountLayout';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import Checkout from './pages/Checkout';
import Cart from './pages/Cart';
import Donate from './pages/Donate';
import DonationReceiptView from './pages/DonationReceiptView';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyAccount from './pages/VerifyAccount';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import About from './pages/About';
import PetRecovery from './pages/PetRecovery';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Faq from './pages/Faq';
import Contact from './pages/Contact';
import Refer from './pages/Refer';
import NotFound from './pages/NotFound';
import MyPets from './pages/account/MyPets';
import PetDetail from './pages/account/PetDetail';
import LostMode from './pages/account/LostMode';
import Profile from './pages/account/Profile';
import Orders from './pages/account/Orders';
import MyDonations from './pages/account/MyDonations';
import OrderDetail from './pages/account/OrderDetail';
import ReturnRequest from './pages/account/ReturnRequest';
import Notifications from './pages/account/Notifications';
import Settings from './pages/account/Settings';
import Subscriptions from './pages/account/Subscriptions';
import RedeemTag from './pages/account/RedeemTag';
import TagActivationFee from './pages/account/TagActivationFee';
import Referrals from './pages/account/Referrals';
import NotificationPreferences from './pages/account/NotificationPreferences';
import InvoiceView from './pages/InvoiceView';
import Invoices from './pages/account/Invoices';
import InvoiceDetail from './pages/account/InvoiceDetail';
import AccountDashboard from './pages/account/Dashboard';
import GuardianDashboard from './pages/account/GuardianDashboard';
import GuardianPoints from './pages/account/GuardianPoints';
import GuardianRewards from './pages/account/GuardianRewards';
import SubscriptionUpgrade from './pages/account/SubscriptionUpgrade';
import MembershipManage from './pages/account/MembershipManage';
import MembershipSubscribe from './pages/account/MembershipSubscribe';
// Floating membership/loyalty badges removed from public layout (Phase UX fix):
// they stacked on EmergencyLostPet in the bottom-right corner. Membership and
// Guardian remain primary header CTAs.
import GuardianLanding from './pages/GuardianLanding';
import Membership from './pages/Membership';
import AnnouncementBar from './components/AnnouncementBar';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const token = localStorage.getItem('pawtag_token');
  if (!token) {
    // Remember where the user was so signing in returns them to the same
    // place: the scroll offset for this path, and the path itself as the
    // post-login destination (deep links and expired-session bounces both
    // route through here). Plain navbar sign-in never passes through this
    // guard, so it still lands on /account by design.
    stashScrollBeforeLogin(location.pathname + location.search, window.scrollY);
    setReturnUrl(location.pathname + location.search);
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

/**
 * Context-aware scroll management. On route (pathname) change:
 * - restore the stashed position when returning from the login round-trip;
 * - scroll to a hash target when present;
 * - otherwise start the new page at the top (standard page-navigation
 *   behavior that SPAs otherwise lose — stale offsets never carry over).
 * Never scrolls during in-page state updates or auth changes.
 */
function ScrollManager() {
  const { pathname } = useLocation();
  useEffect(() => {
    const restoreY = takeScrollReturn(pathname);
    if (restoreY !== null) {
      window.scrollTo(0, restoreY);
      return;
    }
    const hash = window.location.hash;
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function PublicLayout({ children, showEmergency = true }: { children: ReactNode; showEmergency?: boolean }) {
  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      {showEmergency && <EmergencyLostPet />}
    </div>
  );
}

export default function App() {
  const { status, messages, loading } = useSiteAvailability();

  // Add/remove body class for maintenance banner offset
  useEffect(() => {
    if (status === SiteAvailabilityStatus.MAINTENANCE) {
      document.body.classList.add('has-maintenance-banner');
    } else {
      document.body.classList.remove('has-maintenance-banner');
    }
    return () => document.body.classList.remove('has-maintenance-banner');
  }, [status]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  // OFFLINE — show dedicated offline page for all routes
  if (status === SiteAvailabilityStatus.OFFLINE) {
    return <OfflinePage title={messages.offlineTitle} message={messages.offlineMessage} />;
  }

  return (
    <>
      {status === SiteAvailabilityStatus.MAINTENANCE && <MaintenanceBanner />}
      <ScrollManager />
      {/* Toasts mount at the app root — outside every layout/animation
          wrapper — so fixed positioning survives at any scroll depth. */}
      <ToastHost />
      <Routes>
        {/* Public routes with Navbar + Footer */}
        <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
        <Route path="/shop" element={<PublicLayout><Shop /></PublicLayout>} />
        <Route path="/shop/:id" element={<PublicLayout><ProductDetail /></PublicLayout>} />
        <Route path="/cart" element={<PublicLayout><Cart /></PublicLayout>} />
        <Route path="/checkout" element={<PublicLayout><Checkout /></PublicLayout>} />
        <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
        <Route path="/register" element={<PublicLayout><Register /></PublicLayout>} />
        <Route path="/verify-account" element={<VerifyAccount />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
        <Route path="/pet-recovery" element={<PublicLayout><PetRecovery /></PublicLayout>} />
        <Route path="/privacy" element={<PublicLayout><Privacy /></PublicLayout>} />
        <Route path="/terms" element={<PublicLayout><Terms /></PublicLayout>} />
        <Route path="/faq" element={<PublicLayout><Faq /></PublicLayout>} />
        <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
        <Route path="/refer" element={<PublicLayout showEmergency={false}><Refer /></PublicLayout>} />
        <Route path="/guardian" element={<PublicLayout><GuardianLanding /></PublicLayout>} />
        <Route path="/membership" element={<PublicLayout><Membership /></PublicLayout>} />
        <Route path="/donate" element={<PublicLayout showEmergency={false}><Donate /></PublicLayout>} />
        <Route path="/donations/receipt/:token" element={<DonationReceiptView />} />

        {/* Account routes */}
        <Route path="/account" element={<ProtectedRoute><AccountLayout><AccountDashboard /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/pets" element={<ProtectedRoute><AccountLayout><MyPets /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/pets/:id" element={<ProtectedRoute><AccountLayout><PetDetail /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/pets/:id/lost" element={<ProtectedRoute><AccountLayout><LostMode /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/profile" element={<ProtectedRoute><AccountLayout><Profile /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/orders" element={<ProtectedRoute><AccountLayout><Orders /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/orders/:id" element={<ProtectedRoute><AccountLayout><OrderDetail /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/orders/:id/return" element={<ProtectedRoute><AccountLayout><ReturnRequest /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/invoices" element={<ProtectedRoute><AccountLayout><Invoices /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/invoices/:id" element={<ProtectedRoute><AccountLayout><InvoiceDetail /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/donations" element={<ProtectedRoute><AccountLayout><MyDonations /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/subscriptions" element={<ProtectedRoute><AccountLayout><Subscriptions /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/guardian" element={<ProtectedRoute><AccountLayout><GuardianDashboard /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/guardian/points" element={<ProtectedRoute><AccountLayout><GuardianPoints /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/guardian/rewards" element={<ProtectedRoute><AccountLayout><GuardianRewards /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/upgrade" element={<ProtectedRoute><AccountLayout><SubscriptionUpgrade /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/membership" element={<ProtectedRoute><AccountLayout><MembershipManage /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/membership/subscribe" element={<ProtectedRoute><AccountLayout><MembershipSubscribe /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/notifications" element={<ProtectedRoute><AccountLayout><Notifications /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/notification-preferences" element={<ProtectedRoute><AccountLayout><NotificationPreferences /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/redeem-tag" element={<ProtectedRoute><AccountLayout><RedeemTag /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/tag-activation-fee" element={<ProtectedRoute><AccountLayout><TagActivationFee /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/referrals" element={<ProtectedRoute><AccountLayout><Referrals /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/settings" element={<ProtectedRoute><AccountLayout><Settings /></AccountLayout></ProtectedRoute>} />

        {/* Invoice view */}
        <Route path="/invoice/:token" element={<InvoiceView />} />

        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
