import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ordersAPI } from '../../services/api';
import toast from 'react-hot-toast';
import {
  HiOutlineShoppingBag,
  HiOutlineChevronRight,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineTruck,
  HiOutlineInbox,
  HiOutlineHeart,
  HiOutlineUser,
  HiOutlineCalendar,
  HiOutlineSparkles,
} from 'react-icons/hi';
import './CustomerDashboard.css';

// ─── Status Config (consistent with MyOrders) ────────────
const STATUS_CONFIG = {
  PENDING:    { color: 'var(--warning-500)', bg: 'rgba(245, 158, 11, 0.1)', icon: HiOutlineClock, label: 'Pending' },
  CONFIRMED:  { color: 'var(--primary-400)', bg: 'rgba(129, 140, 248, 0.1)', icon: HiOutlineCheckCircle, label: 'Confirmed' },
  PROCESSING: { color: 'var(--primary-600)', bg: 'rgba(79, 70, 229, 0.1)', icon: HiOutlineInbox, label: 'Processing' },
  SHIPPED:    { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)', icon: HiOutlineTruck, label: 'Shipped' },
  DELIVERED:  { color: 'var(--success-500)', bg: 'rgba(34, 197, 94, 0.1)', icon: HiOutlineCheckCircle, label: 'Delivered' },
  COMPLETED:  { color: 'var(--success-500)', bg: 'rgba(34, 197, 94, 0.1)', icon: HiOutlineCheckCircle, label: 'Completed' },
  CANCELLED:  { color: 'var(--danger-500)', bg: 'rgba(239, 68, 68, 0.1)', icon: HiOutlineXCircle, label: 'Cancelled' },
};

// ─── Stepper Steps ────────────────────────────────────────
const STEPPER_STEPS = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
const STEPPER_LABELS = {
  PENDING: 'Placed',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
};

// ─── Quick Links Data ─────────────────────────────────────
const QUICK_LINKS = [
  { to: '/catalog',   icon: HiOutlineShoppingBag, label: 'Browse Products', desc: 'Explore our full catalog', colorClass: 'indigo' },
  { to: '/my-orders', icon: HiOutlineInbox,       label: 'All Orders',      desc: 'Track all your orders', colorClass: 'violet' },
  { to: '/wishlist',  icon: HiOutlineHeart,       label: 'My Wishlist',     desc: 'Items you love',        colorClass: 'rose' },
  { to: '/profile',   icon: HiOutlineUser,        label: 'My Profile',      desc: 'Manage your account',   colorClass: 'teal' },
];

const CustomerDashboard = () => {
  const { user } = useAuth();
  const [latestOrder, setLatestOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLatestOrder = async () => {
      try {
        const { data } = await ordersAPI.getMyOrders({ limit: 1 });
        if (data.orders && data.orders.length > 0) {
          setLatestOrder(data.orders[0]);
        }
      } catch {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchLatestOrder();
  }, []);

  // ─── Stepper Logic ──────────────────────────────────────
  const getStepperProgress = (status) => {
    if (status === 'CANCELLED') return -1;
    const idx = STEPPER_STEPS.indexOf(status);
    return idx === -1 ? 0 : idx;
  };

  const getStepperFillWidth = (status) => {
    const idx = getStepperProgress(status);
    if (idx <= 0) return '0%';
    return `${(idx / (STEPPER_STEPS.length - 1)) * 100}%`;
  };

  // ─── Greeting based on time of day ─────────────────────
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = user?.name?.split(' ')[0] || 'there';

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (loading) {
    return (
      <div className="customer-dashboard">
        <div className="dashboard-loading">
          <div className="spinner" />
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-dashboard">
      {/* ─── Hero Section ───────────────────────────────── */}
      <section className="dashboard-hero">
        <div className="hero-content">
          <div className="hero-greeting">
            <span className="hero-wave">👋</span>
            <h1>{getGreeting()}, {firstName}!</h1>
          </div>
          <p className="hero-subtitle">Welcome back to your personal dashboard</p>
          <div className="hero-date">
            <HiOutlineCalendar /> {todayStr}
          </div>
        </div>
      </section>

      {/* ─── Latest Order Section ───────────────────────── */}
      <section className="latest-order-section">
        <div className="section-header">
          <h2 className="section-title">
            <HiOutlineSparkles /> Latest Order
          </h2>
          {latestOrder && (
            <Link to="/my-orders" className="section-link">
              View all orders <HiOutlineChevronRight />
            </Link>
          )}
        </div>

        {latestOrder ? (
          <LatestOrderCard order={latestOrder} getStepperFillWidth={getStepperFillWidth} getStepperProgress={getStepperProgress} />
        ) : (
          <div className="dashboard-empty-state">
            <div className="empty-illustration">🛒</div>
            <h2>No orders yet</h2>
            <p>Start exploring our catalog and place your first order. We've got amazing stationery waiting for you!</p>
            <Link to="/catalog" className="start-shopping-btn">
              <HiOutlineShoppingBag /> Start Shopping
            </Link>
          </div>
        )}
      </section>

      {/* ─── Quick Links ────────────────────────────────── */}
      <section className="quick-links-section">
        <div className="section-header">
          <h2 className="section-title">Quick Links</h2>
        </div>
        <div className="quick-links-grid">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.to} to={link.to} className="quick-link-card">
                <div className={`quick-link-icon ${link.colorClass}`}>
                  <Icon />
                </div>
                <span className="quick-link-label">{link.label}</span>
                <span className="quick-link-desc">{link.desc}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
};

// ─── Latest Order Card Component ──────────────────────────
const LatestOrderCard = ({ order, getStepperFillWidth, getStepperProgress }) => {
  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusCfg.icon;
  const isCancelled = order.status === 'CANCELLED';
  const currentStepIndex = getStepperProgress(order.status);

  return (
    <div className="latest-order-card">
      {/* Header */}
      <div className="order-card-header">
        <div className="order-number-group">
          <span className="order-number-label">Order Number</span>
          <span className="order-number-value">{order.orderNumber}</span>
        </div>
        <span className="order-date-placed">
          <HiOutlineCalendar />
          {new Date(order.createdAt).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
          })}
        </span>
        <span
          className="order-status-pill"
          style={{ color: statusCfg.color, backgroundColor: statusCfg.bg }}
        >
          <StatusIcon /> {statusCfg.label}
        </span>
      </div>

      {/* Stepper */}
      {!isCancelled && (
        <div className="order-stepper">
          <div className="stepper-track">
            <div className="stepper-line-bg" />
            <div className="stepper-line-fill" style={{ width: getStepperFillWidth(order.status) }} />
            {STEPPER_STEPS.map((step, idx) => {
              const isCompleted = idx <= currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              const StepIcon = isCompleted ? HiOutlineCheckCircle : STATUS_CONFIG[step]?.icon || HiOutlineClock;

              return (
                <div key={step} className="stepper-step">
                  <div className={`step-dot ${isCompleted ? 'completed' : ''} ${isCurrent && !isCompleted ? 'current' : ''}`}>
                    <StepIcon />
                  </div>
                  <span className={`step-label ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}>
                    {STEPPER_LABELS[step]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Body — Items + Total */}
      <div className="order-card-body">
        <div className="order-items-thumbnails">
          {order.items.slice(0, 3).map((item, idx) => (
            <div key={idx} className="item-thumb">
              {item.product?.imageUrl ? (
                <img src={item.product.imageUrl} alt={item.productName} />
              ) : (
                <div className="item-thumb-placeholder">📦</div>
              )}
            </div>
          ))}
          {order.items.length > 3 && (
            <div className="item-thumb-more">+{order.items.length - 3}</div>
          )}
        </div>
        <div className="order-total-display">
          <div className="order-total-label">Total Amount</div>
          <div className="order-total-amount">৳{Number(order.total).toLocaleString()}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="order-card-footer">
        <span className="order-items-count">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
        <Link to={`/my-orders/${order.id}`} className="view-details-link">
          View Full Details <HiOutlineChevronRight />
        </Link>
      </div>
    </div>
  );
};

export default CustomerDashboard;
