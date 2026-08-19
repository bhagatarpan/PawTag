import { Routes, Route, Navigate } from 'react-router-dom';
import { ReactNode, useEffect } from 'react';
import { SiteAvailabilityStatus } from '@pawtag/shared';
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
import CheckoutVerificationGate from './components/CheckoutVerificationGate';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyAccount from './pages/VerifyAccount';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import About from './pages/About';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Faq from './pages/Faq';
import Contact from './pages/Contact';
import Refer from './pages/Refer';
import NotFound from './pages/NotFound';
import MyPets from './pages/account/MyPets';
import Profile from './pages/account/Profile';
import Orders from './pages/account/Orders';
import OrderDetail from './pages/account/OrderDetail';
import Notifications from './pages/account/Notifications';
import Settings from './pages/account/Settings';
import Subscriptions from './pages/account/Subscriptions';
import RedeemTag from './pages/account/RedeemTag';
import Referrals from './pages/account/Referrals';
import NotificationPreferences from './pages/account/NotificationPreferences';
import InvoiceView from './pages/InvoiceView';
import AccountDashboard from './pages/account/Dashboard';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = localStorage.getItem('pawtag_token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicLayout({ children, showEmergency = true }: { children: ReactNode; showEmergency?: boolean }) {
  return (
    <div className="min-h-screen flex flex-col">
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
      <Routes>
        {/* Public routes with Navbar + Footer */}
        <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
        <Route path="/shop" element={<PublicLayout><Shop /></PublicLayout>} />
        <Route path="/shop/:id" element={<PublicLayout><ProductDetail /></PublicLayout>} />
        <Route path="/checkout" element={<PublicLayout><CheckoutVerificationGate><Checkout /></CheckoutVerificationGate></PublicLayout>} />
        <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
        <Route path="/register" element={<PublicLayout><Register /></PublicLayout>} />
        <Route path="/verify-account" element={<VerifyAccount />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
        <Route path="/privacy" element={<PublicLayout><Privacy /></PublicLayout>} />
        <Route path="/terms" element={<PublicLayout><Terms /></PublicLayout>} />
        <Route path="/faq" element={<PublicLayout><Faq /></PublicLayout>} />
        <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
        <Route path="/refer" element={<PublicLayout showEmergency={false}><Refer /></PublicLayout>} />

        {/* Account routes */}
        <Route path="/account" element={<ProtectedRoute><AccountLayout><AccountDashboard /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/pets" element={<ProtectedRoute><AccountLayout><MyPets /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/profile" element={<ProtectedRoute><AccountLayout><Profile /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/orders" element={<ProtectedRoute><AccountLayout><Orders /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/orders/:id" element={<ProtectedRoute><AccountLayout><OrderDetail /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/subscriptions" element={<ProtectedRoute><AccountLayout><Subscriptions /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/notifications" element={<ProtectedRoute><AccountLayout><Notifications /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/notification-preferences" element={<ProtectedRoute><AccountLayout><NotificationPreferences /></AccountLayout></ProtectedRoute>} />
        <Route path="/account/redeem-tag" element={<ProtectedRoute><AccountLayout><RedeemTag /></AccountLayout></ProtectedRoute>} />
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
