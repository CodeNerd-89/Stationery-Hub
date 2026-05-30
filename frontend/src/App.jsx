import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { useState } from 'react';

// Layout
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import VerifyOTP from './pages/auth/VerifyOTP';

// Catalog
import Catalog from './pages/catalog/Catalog';
import Cart from './pages/catalog/Cart';
import ProductDetail from './pages/catalog/ProductDetail';
import Checkout from './pages/catalog/Checkout';
import MyOrders from './pages/catalog/MyOrders';
import MyOrderDetail from './pages/catalog/MyOrderDetail';
import OrderConfirmation from './pages/catalog/OrderConfirmation';
import Wishlist from './pages/catalog/Wishlist';
import Profile from './pages/catalog/Profile';
import CustomerDashboard from './pages/catalog/CustomerDashboard';

// Admin/Staff Dashboard
import AdminDashboard from './pages/dashboard/AdminDashboard';
import AdminProducts from './pages/dashboard/AdminProducts';
import AdminCategories from './pages/dashboard/AdminCategories';
import AdminCustomers from './pages/dashboard/AdminCustomers';
import AdminQuotations from './pages/dashboard/AdminQuotations';
import QuotationBuilder from './pages/dashboard/QuotationBuilder';
import AdminOrders from './pages/dashboard/AdminOrders';
import ScanPO from './pages/dashboard/ScanPO';
import AdminUsers from './pages/dashboard/AdminUsers';
import Analytics from './pages/dashboard/Analytics';
import AdminPromos from './pages/admin/AdminPromos';

import './App.css';

// ─── Route Guards ──────────────────────────────────────
const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>;
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { isAdminOrStaff, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>;
  return isAdminOrStaff ? children : <Navigate to="/catalog" />;
};

const GuestRoute = ({ children }) => {
  const { isAuthenticated, loading, isAdminOrStaff } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>;
  if (isAuthenticated) {
    return isAdminOrStaff ? <Navigate to="/admin" /> : <Navigate to="/catalog" />;
  }
  return children;
};

// ─── Main Layout (with Navbar) ─────────────────────────
const MainLayout = () => {
  return (
    <div className="main-layout">
      <Navbar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

// ─── Admin Layout (with Sidebar) ───────────────────────
const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="admin-layout">
      <Navbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className={`admin-content ${sidebarOpen ? 'sidebar-active' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
};

// ─── App ───────────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <CartProvider>
      <Router>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1e293b',
              color: '#f8fafc',
              borderRadius: '10px',
              fontSize: '0.875rem',
              fontWeight: 500,
            },
          }}
        />

        <Routes>
          {/* Auth (no layout) */}
          <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
          <Route path="/verify-email" element={<VerifyOTP />} />

          {/* Public pages */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Navigate to="/catalog" />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/product/:slug" element={<ProductDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<PrivateRoute><Checkout /></PrivateRoute>} />
            <Route path="/my-orders" element={<PrivateRoute><MyOrders /></PrivateRoute>} />
            <Route path="/my-orders/:id" element={<PrivateRoute><MyOrderDetail /></PrivateRoute>} />
            <Route path="/order-confirmation/:id" element={<PrivateRoute><OrderConfirmation /></PrivateRoute>} />
            <Route path="/wishlist" element={<PrivateRoute><Wishlist /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/dashboard" element={<PrivateRoute><CustomerDashboard /></PrivateRoute>} />
          </Route>

          {/* Admin/Staff dashboard (separate layout with sidebar) */}
          <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/products" element={<AdminProducts />} />
            <Route path="/admin/categories" element={<AdminCategories />} />
            <Route path="/admin/customers" element={<AdminCustomers />} />
            <Route path="/admin/quotations" element={<AdminQuotations />} />
            <Route path="/admin/quotations/new" element={<QuotationBuilder />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/scan" element={<ScanPO />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/promos" element={<AdminPromos />} />
            <Route path="/admin/analytics" element={<Analytics />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={
            <div className="loading-screen" style={{ minHeight: '100vh' }}>
              <div style={{ fontSize: '4rem' }}>🔍</div>
              <h2>Page Not Found</h2>
              <p style={{ color: 'var(--text-secondary)' }}>The page you're looking for doesn't exist.</p>
              <a href="/" className="btn btn-primary" style={{ marginTop: 16 }}>Go Home</a>
            </div>
          } />
        </Routes>
      </Router>
      </CartProvider>
    </AuthProvider>
  );
}

// Placeholder for pages not yet built
const PlaceholderPage = ({ title, icon }) => (
  <div className="card" style={{ textAlign: 'center', padding: 48 }}>
    <div style={{ fontSize: '3rem', marginBottom: 12 }}>{icon}</div>
    <h2 style={{ marginBottom: 8 }}>{title}</h2>
    <p style={{ color: 'var(--text-secondary)' }}>This page will be built in the next phase.</p>
  </div>
);

export default App;

