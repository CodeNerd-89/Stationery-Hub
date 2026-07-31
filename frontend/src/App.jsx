import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { useState, lazy, Suspense } from 'react';

// Layout (always needed — keep eager)
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';

// ─── Lazy-loaded Pages (code splitting) ────────────────
// Auth Pages
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const VerifyOTP = lazy(() => import('./pages/auth/VerifyOTP'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));

// Catalog Pages
const Catalog = lazy(() => import('./pages/catalog/Catalog'));
const Cart = lazy(() => import('./pages/catalog/Cart'));
const ProductDetail = lazy(() => import('./pages/catalog/ProductDetail'));
const Checkout = lazy(() => import('./pages/catalog/Checkout'));
const MyOrders = lazy(() => import('./pages/catalog/MyOrders'));
const MyOrderDetail = lazy(() => import('./pages/catalog/MyOrderDetail'));
const OrderConfirmation = lazy(() => import('./pages/catalog/OrderConfirmation'));
const BkashCallback = lazy(() => import('./pages/catalog/BkashCallback'));
const Wishlist = lazy(() => import('./pages/catalog/Wishlist'));
const Profile = lazy(() => import('./pages/catalog/Profile'));
const CustomerDashboard = lazy(() => import('./pages/catalog/CustomerDashboard'));

// Admin/Staff Dashboard Pages
const AdminDashboard = lazy(() => import('./pages/dashboard/AdminDashboard'));
const AdminProducts = lazy(() => import('./pages/dashboard/AdminProducts'));
const AdminCategories = lazy(() => import('./pages/dashboard/AdminCategories'));
const AdminCustomers = lazy(() => import('./pages/dashboard/AdminCustomers'));
const AdminQuotations = lazy(() => import('./pages/dashboard/AdminQuotations'));
const QuotationBuilder = lazy(() => import('./pages/dashboard/QuotationBuilder'));
const AdminOrders = lazy(() => import('./pages/dashboard/AdminOrders'));
const ScanPO = lazy(() => import('./pages/dashboard/ScanPO'));
const AdminUsers = lazy(() => import('./pages/dashboard/AdminUsers'));
const Analytics = lazy(() => import('./pages/dashboard/Analytics'));
const AdminPromos = lazy(() => import('./pages/admin/AdminPromos'));

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

        <Suspense fallback={<div className="loading-screen" style={{ minHeight: '100vh' }}><div className="spinner" /><p>Loading...</p></div>}>
        <Routes>
          {/* Auth (no layout) */}
          <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
          <Route path="/verify-email" element={<VerifyOTP />} />
          <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />

          {/* Public pages */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Navigate to="/catalog" />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/product/:slug" element={<ProductDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout/bkash/callback" element={<PrivateRoute><BkashCallback /></PrivateRoute>} />
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
        </Suspense>
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

