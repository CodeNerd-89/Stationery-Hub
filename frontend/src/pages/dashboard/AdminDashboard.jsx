import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  HiOutlineCube,
  HiOutlineDocumentText,
  HiOutlineClipboardList,
  HiOutlineUsers,
  HiOutlineCurrencyBangladeshi,
  HiOutlineExclamation,
  HiOutlineBell,
  HiOutlineArrowRight,
} from 'react-icons/hi';
import './Dashboard.css';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await dashboardAPI.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  /* Time-based greeting */
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good morning', emoji: '☀️' };
    if (hour < 17) return { text: 'Good afternoon', emoji: '🌤️' };
    return { text: 'Good evening', emoji: '🌙' };
  };

  const greeting = getGreeting();

  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const statusBadge = (status) => {
    const map = {
      DRAFT: 'badge-gray',
      SENT: 'badge-info',
      ACCEPTED: 'badge-success',
      REJECTED: 'badge-danger',
      EXPIRED: 'badge-warning',
      PENDING: 'badge-warning',
      CONFIRMED: 'badge-info',
      PROCESSING: 'badge-primary',
      COMPLETED: 'badge-success',
      CANCELLED: 'badge-danger',
    };
    return map[status] || 'badge-gray';
  };

  /* Accent class for left border based on status */
  const accentClass = (status) => {
    const map = {
      DRAFT: 'accent-draft',
      SENT: 'accent-sent',
      ACCEPTED: 'accent-accepted',
      REJECTED: 'accent-rejected',
      EXPIRED: 'accent-expired',
      PENDING: 'accent-pending',
      CONFIRMED: 'accent-confirmed',
      PROCESSING: 'accent-processing',
      COMPLETED: 'accent-completed',
      CANCELLED: 'accent-cancelled',
    };
    return map[status] || 'accent-draft';
  };

  /* Status bar color class */
  const barClass = (status) => {
    return `bar-${status.toLowerCase()}`;
  };

  /* Low stock pill class */
  const stockPillClass = (stock) => {
    if (stock <= 3) return 'stock-pill stock-pill-critical';
    if (stock <= 7) return 'stock-pill stock-pill-low';
    return 'stock-pill stock-pill-warn';
  };

  return (
    <div className="dashboard-page">
      {/* Premium Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <span className="greeting-emoji">{greeting.emoji}</span>
            {greeting.text}, {user?.name}!
          </h1>
          <p className="page-subtitle">Here's your business overview at a glance.</p>
          <span className="header-date">{formatDate()}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card stat-products">
          <div className="stat-icon purple">
            <HiOutlineCube />
          </div>
          <div className="stat-info">
            <h3>{stats?.stats?.activeProducts || 0}</h3>
            <p>Active Products</p>
          </div>
        </div>

        <div className="stat-card stat-quotations">
          <div className="stat-icon blue">
            <HiOutlineDocumentText />
          </div>
          <div className="stat-info">
            <h3>{stats?.stats?.totalQuotations || 0}</h3>
            <p>Total Quotations</p>
          </div>
        </div>

        <div className="stat-card stat-orders" style={{ position: 'relative' }}>
          <div className="stat-icon green">
            <HiOutlineClipboardList />
          </div>
          <div className="stat-info">
            <h3>{stats?.stats?.totalOrders || 0}</h3>
            <p>Total Orders</p>
          </div>
          {stats?.stats?.pendingOrders > 0 && (
            <span style={{
              position: 'absolute', top: '12px', right: '12px',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff',
              fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px',
              borderRadius: '10px', animation: 'pulse 2s infinite',
              zIndex: 2,
            }}>{stats.stats.pendingOrders} pending</span>
          )}
        </div>

        <div className="stat-card stat-customers">
          <div className="stat-icon orange">
            <HiOutlineUsers />
          </div>
          <div className="stat-info">
            <h3>{stats?.stats?.totalCustomers || 0}</h3>
            <p>Customers</p>
          </div>
        </div>

        <div className="stat-card stat-revenue">
          <div className="stat-icon green">
            <HiOutlineCurrencyBangladeshi />
          </div>
          <div className="stat-info">
            <h3>৳{Number(stats?.stats?.revenue || 0).toLocaleString()}</h3>
            <p>Total Revenue</p>
          </div>
        </div>

        <div className="stat-card stat-lowstock">
          <div className="stat-icon red">
            <HiOutlineExclamation />
          </div>
          <div className="stat-info">
            <h3>{stats?.lowStockProducts?.length || 0}</h3>
            <p>Low Stock Items</p>
          </div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Recent Quotations */}
        <div className="card">
          <div className="card-header-gradient card-header-quotations">
            <h3 className="card-title">
              <HiOutlineDocumentText />
              Recent Quotations
            </h3>
          </div>
          {stats?.recentQuotations?.length > 0 ? (
            <div className="recent-list">
              {stats.recentQuotations.map((q) => (
                <div key={q.id} className={`recent-item ${accentClass(q.status)}`}>
                  <div className="recent-item-info">
                    <strong>{q.quotationNumber}</strong>
                    <span className="recent-item-meta">
                      {q.customer?.contactPerson || 'No customer'} • by {q.createdBy?.name}
                    </span>
                  </div>
                  <div className="recent-item-right">
                    <span className={`badge ${statusBadge(q.status)}`}>{q.status}</span>
                    <span className="recent-item-amount">৳{Number(q.total).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No quotations yet</p>
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="card">
          <div className="card-header-gradient card-header-orders">
            <h3 className="card-title">
              <HiOutlineClipboardList />
              Recent Orders
              {stats?.stats?.pendingOrders > 0 && (
                <span className="pending-badge">
                  <span className="pulse-dot"></span>
                  {stats.stats.pendingOrders} new
                </span>
              )}
            </h3>
            <Link to="/admin/orders" className="header-link">
              View All <HiOutlineArrowRight />
            </Link>
          </div>
          {stats?.recentOrders?.length > 0 ? (
            <div className="recent-list">
              {stats.recentOrders.map((o) => (
                <div key={o.id} className={`recent-item ${accentClass(o.status)}`}>
                  <div className="recent-item-info">
                    <strong>{o.orderNumber}</strong>
                    <span className="recent-item-meta">
                      {o.customer?.contactPerson || 'Unknown'}
                    </span>
                  </div>
                  <div className="recent-item-right">
                    <span className={`badge ${statusBadge(o.status)}`}>{o.status}</span>
                    <span className="recent-item-amount">৳{Number(o.total).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No orders yet</p>
            </div>
          )}
        </div>

        {/* Low Stock Alert */}
        <div className="card">
          <div className="card-header-gradient card-header-lowstock">
            <h3 className="card-title">
              <HiOutlineBell />
              Low Stock Alert
            </h3>
          </div>
          {stats?.lowStockProducts?.length > 0 ? (
            <div className="recent-list">
              {stats.lowStockProducts.map((p) => (
                <div
                  key={p.id}
                  className={`recent-item ${p.stock <= 3 ? 'accent-rejected' : p.stock <= 7 ? 'accent-expired' : 'accent-pending'}`}
                >
                  <div className="recent-item-info">
                    <strong>{p.name}</strong>
                    <span className="recent-item-meta">{p.category?.name} • {p.sku}</span>
                  </div>
                  <div className="recent-item-right">
                    <span className={stockPillClass(p.stock)}>
                      {p.stock} left
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>All products are well stocked 👍</p>
            </div>
          )}
        </div>

        {/* Quotation Status Breakdown */}
        <div className="card">
          <div className="card-header-gradient card-header-breakdown">
            <h3 className="card-title">
              <HiOutlineDocumentText />
              Quotation Breakdown
            </h3>
          </div>
          <div className="status-breakdown">
            {Object.entries(stats?.quotationsByStatus || {}).map(([status, count]) => (
              <div key={status} className="status-row">
                <span className={`badge ${statusBadge(status)}`}>{status}</span>
                <div className="status-bar-container">
                  <div
                    className={`status-bar ${barClass(status)}`}
                    style={{
                      width: `${Math.max(5, (count / (stats?.stats?.totalQuotations || 1)) * 100)}%`,
                    }}
                  />
                </div>
                <span className="status-count">{count}</span>
              </div>
            ))}
            {Object.keys(stats?.quotationsByStatus || {}).length === 0 && (
              <div className="empty-state"><p>No data yet</p></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
