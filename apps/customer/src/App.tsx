import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, Protected } from './lib/auth';
import DashboardLayout from './components/DashboardLayout';
import Login from './pages/Login';
import PetsPage from './pages/PetsPage';
import ProfilePage from './pages/ProfilePage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import ReferralsPage from './pages/ReferralsPage';
import NotificationPreferencesPage from './pages/NotificationPreferencesPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Protected><DashboardLayout><PetsPage /></DashboardLayout></Protected>} />
        <Route path="/profile" element={<Protected><DashboardLayout><ProfilePage /></DashboardLayout></Protected>} />
        <Route path="/orders" element={<Protected><DashboardLayout><OrdersPage /></DashboardLayout></Protected>} />
        <Route path="/orders/:id" element={<Protected><DashboardLayout><OrderDetailPage /></DashboardLayout></Protected>} />
        <Route path="/subscriptions" element={<Protected><DashboardLayout><SubscriptionsPage /></DashboardLayout></Protected>} />
        <Route path="/notifications" element={<Protected><DashboardLayout><NotificationsPage /></DashboardLayout></Protected>} />
        <Route path="/notification-preferences" element={<Protected><DashboardLayout><NotificationPreferencesPage /></DashboardLayout></Protected>} />
        <Route path="/referrals" element={<Protected><DashboardLayout><ReferralsPage /></DashboardLayout></Protected>} />
        <Route path="/settings" element={<Protected><DashboardLayout><SettingsPage /></DashboardLayout></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
