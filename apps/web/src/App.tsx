import { Routes, Route, Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import EmergencyLostPet from './components/EmergencyLostPet';
import AccountLayout from './components/AccountLayout';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import Checkout from './pages/Checkout';
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

export default function App() {
  return (
    <Routes>
      {/* Public routes with Navbar + Footer */}
      <Route path="/" element={<div className="min-h-screen flex flex-col"><Navbar /><main className="flex-1"><Home /></main><Footer /><EmergencyLostPet /></div>} />
      <Route path="/shop" element={<div className="min-h-screen flex flex-col"><Navbar /><main className="flex-1"><Shop /></main><Footer /><EmergencyLostPet /></div>} />
      <Route path="/shop/:id" element={<div className="min-h-screen flex flex-col"><Navbar /><main className="flex-1"><ProductDetail /></main><Footer /><EmergencyLostPet /></div>} />
      <Route path="/checkout" element={<div className="min-h-screen flex flex-col"><Navbar /><main className="flex-1"><Checkout /></main><Footer /><EmergencyLostPet /></div>} />
      <Route path="/login" element={<div className="min-h-screen flex flex-col"><Navbar /><main className="flex-1"><Login /></main><Footer /></div>} />
      <Route path="/register" element={<div className="min-h-screen flex flex-col"><Navbar /><main className="flex-1"><Register /></main><Footer /></div>} />
      <Route path="/verify-account" element={<VerifyAccount />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/about" element={<div className="min-h-screen flex flex-col"><Navbar /><main className="flex-1"><About /></main><Footer /><EmergencyLostPet /></div>} />
      <Route path="/privacy" element={<div className="min-h-screen flex flex-col"><Navbar /><main className="flex-1"><Privacy /></main><Footer /><EmergencyLostPet /></div>} />
      <Route path="/terms" element={<div className="min-h-screen flex flex-col"><Navbar /><main className="flex-1"><Terms /></main><Footer /><EmergencyLostPet /></div>} />
      <Route path="/faq" element={<div className="min-h-screen flex flex-col"><Navbar /><main className="flex-1"><Faq /></main><Footer /><EmergencyLostPet /></div>} />
      <Route path="/contact" element={<div className="min-h-screen flex flex-col"><Navbar /><main className="flex-1"><Contact /></main><Footer /><EmergencyLostPet /></div>} />
      <Route path="/refer" element={<div className="min-h-screen flex flex-col"><Navbar /><main className="flex-1"><Refer /></main><Footer /></div>} />

      {/* Account routes — no public Navbar/Footer, uses AccountLayout sidebar */}
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

      {/* Invoice view — no Navbar/Footer, standalone page */}
      <Route path="/invoice/:token" element={<InvoiceView />} />

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
