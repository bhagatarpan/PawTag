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
import About from './pages/About';
import MyPets from './pages/account/MyPets';
import Profile from './pages/account/Profile';
import Orders from './pages/account/Orders';
import Notifications from './pages/account/Notifications';
import Settings from './pages/account/Settings';

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
      <Route path="/about" element={<div className="min-h-screen flex flex-col"><Navbar /><main className="flex-1"><About /></main><Footer /><EmergencyLostPet /></div>} />

      {/* Account routes — no public Navbar/Footer, uses AccountLayout sidebar */}
      <Route path="/account" element={<ProtectedRoute><AccountLayout><MyPets /></AccountLayout></ProtectedRoute>} />
      <Route path="/account/profile" element={<ProtectedRoute><AccountLayout><Profile /></AccountLayout></ProtectedRoute>} />
      <Route path="/account/orders" element={<ProtectedRoute><AccountLayout><Orders /></AccountLayout></ProtectedRoute>} />
      <Route path="/account/notifications" element={<ProtectedRoute><AccountLayout><Notifications /></AccountLayout></ProtectedRoute>} />
      <Route path="/account/settings" element={<ProtectedRoute><AccountLayout><Settings /></AccountLayout></ProtectedRoute>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
