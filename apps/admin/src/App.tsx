import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Pets from './pages/Pets';
import Tags from './pages/Tags';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Content from './pages/Content';
import Settings from './pages/Settings';
import FeatureFlags from './pages/FeatureFlags';
import AuditTrail from './pages/AuditTrail';
import AuditSettings from './pages/AuditSettings';
import Statistics from './pages/Statistics';
import RbacRoles from './pages/RbacRoles';
import RbacPermissions from './pages/RbacPermissions';
import RbacPermissionGroups from './pages/RbacPermissionGroups';
import RbacScopes from './pages/RbacScopes';
import CmsPages from './pages/cms/CmsPages';
import CmsPageEditor from './pages/cms/CmsPageEditor';
import CmsNavigationPage from './pages/cms/CmsNavigation';
import CmsFooterPage from './pages/cms/CmsFooter';
import CmsMediaPage from './pages/cms/CmsMedia';
import CmsAnnouncementsPage from './pages/cms/CmsAnnouncements';
import CmsRedirectsPage from './pages/cms/CmsRedirects';
import CmsEmailTemplatesPage from './pages/cms/CmsEmailTemplates';
import CmsSmsTemplatesPage from './pages/cms/CmsSmsTemplates';
import CmsPetReferencesPage from './pages/cms/CmsPetReferences';
import CmsHomepageSectionsPage from './pages/cms/CmsHomepageSections';
import CmsShopPagesPage from './pages/cms/CmsShopPages';
import CmsAuthPagesPage from './pages/cms/CmsAuthPages';
import CmsInvoiceTemplatePage from './pages/cms/CmsInvoiceTemplate';
import CmsOnboardingStepsPage from './pages/cms/CmsOnboardingSteps';
import SubscriptionsPage from './pages/SubscriptionsPage';
import SubscriptionDetailPage from './pages/SubscriptionDetailPage';
import Referrals from './pages/Referrals';
import TagExpiryNotifications from './pages/TagExpiryNotifications';
import Notifications from './pages/Notifications';
import WriteNfcTag from './pages/WriteNfcTag';
import SupportRequests from './pages/SupportRequests';
import SystemLogs from './pages/SystemLogs';
import SystemLogSettings from './pages/SystemLogSettings';
import SiteAvailabilitySettings from './pages/SiteAvailabilitySettings';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/forgot-password" element={user ? <Navigate to="/" replace /> : <ForgotPassword />} />
      <Route path="/reset-password" element={user ? <Navigate to="/" replace /> : <ResetPassword />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <Users />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pets"
        element={
          <ProtectedRoute>
            <Pets />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tags"
        element={
          <ProtectedRoute>
            <Tags />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products"
        element={
          <ProtectedRoute>
            <Products />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders"
        element={
          <ProtectedRoute>
            <Orders />
          </ProtectedRoute>
        }
      />
      <Route
        path="/content"
        element={
          <ProtectedRoute>
            <Content />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/feature-flags"
        element={
          <ProtectedRoute>
            <FeatureFlags />
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit-trail"
        element={
          <ProtectedRoute>
            <AuditTrail />
          </ProtectedRoute>
        }
      />
      <Route path="/audit-logs" element={<Navigate to="/audit-trail" replace />} />
      <Route
        path="/audit-settings"
        element={
          <ProtectedRoute>
            <AuditSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/statistics"
        element={
          <ProtectedRoute>
            <Statistics />
          </ProtectedRoute>
        }
      />
      <Route path="/rbac/roles" element={<ProtectedRoute><RbacRoles /></ProtectedRoute>} />
      <Route path="/rbac/permissions" element={<ProtectedRoute><RbacPermissions /></ProtectedRoute>} />
      <Route path="/rbac/permission-groups" element={<ProtectedRoute><RbacPermissionGroups /></ProtectedRoute>} />
      <Route path="/rbac/scopes" element={<ProtectedRoute><RbacScopes /></ProtectedRoute>} />
      <Route path="/cms/pages" element={<ProtectedRoute><CmsPages /></ProtectedRoute>} />
      <Route path="/cms/pages/:id" element={<ProtectedRoute><CmsPageEditor /></ProtectedRoute>} />
      <Route path="/cms/navigation" element={<ProtectedRoute><CmsNavigationPage /></ProtectedRoute>} />
      <Route path="/cms/footer" element={<ProtectedRoute><CmsFooterPage /></ProtectedRoute>} />
      <Route path="/cms/media" element={<ProtectedRoute><CmsMediaPage /></ProtectedRoute>} />
      <Route path="/cms/announcements" element={<ProtectedRoute><CmsAnnouncementsPage /></ProtectedRoute>} />
      <Route path="/cms/redirects" element={<ProtectedRoute><CmsRedirectsPage /></ProtectedRoute>} />
      <Route path="/cms/email-templates" element={<ProtectedRoute><CmsEmailTemplatesPage /></ProtectedRoute>} />
      <Route path="/cms/sms-templates" element={<ProtectedRoute><CmsSmsTemplatesPage /></ProtectedRoute>} />
      <Route path="/cms/pet-references" element={<ProtectedRoute><CmsPetReferencesPage /></ProtectedRoute>} />
      <Route path="/cms/homepage" element={<ProtectedRoute><CmsHomepageSectionsPage /></ProtectedRoute>} />
      <Route path="/cms/shop-pages" element={<ProtectedRoute><CmsShopPagesPage /></ProtectedRoute>} />
      <Route path="/cms/auth-pages" element={<ProtectedRoute><CmsAuthPagesPage /></ProtectedRoute>} />
      <Route path="/cms/invoice-template" element={<ProtectedRoute><CmsInvoiceTemplatePage /></ProtectedRoute>} />
      <Route path="/cms/onboarding" element={<ProtectedRoute><CmsOnboardingStepsPage /></ProtectedRoute>} />
      <Route path="/subscriptions" element={<ProtectedRoute><SubscriptionsPage /></ProtectedRoute>} />
      <Route path="/subscriptions/:id" element={<ProtectedRoute><SubscriptionDetailPage /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/referrals" element={<ProtectedRoute><Referrals /></ProtectedRoute>} />
      <Route path="/tag-expiry-notifications" element={<ProtectedRoute><TagExpiryNotifications /></ProtectedRoute>} />
      <Route path="/write-nfc" element={<ProtectedRoute><WriteNfcTag /></ProtectedRoute>} />
      <Route path="/support-requests" element={<ProtectedRoute><SupportRequests /></ProtectedRoute>} />
      <Route path="/system-logs" element={<ProtectedRoute><SystemLogs /></ProtectedRoute>} />
      <Route path="/system-log-settings" element={<ProtectedRoute><SystemLogSettings /></ProtectedRoute>} />
      <Route path="/site-availability" element={<ProtectedRoute><SiteAvailabilitySettings /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
