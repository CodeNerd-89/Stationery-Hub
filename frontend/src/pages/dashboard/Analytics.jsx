import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { dashboardAPI } from '../../services/api';
import {
  HiOutlineTrendingUp,
  HiOutlineTrendingDown,
  HiOutlineUserGroup,
  HiOutlineDocumentText,
  HiOutlineShoppingBag,
  HiOutlineRefresh,
  HiOutlineClock,
  HiOutlineChartBar,
  HiOutlineTrash,
  HiOutlineEyeOff,
  HiOutlineEye,
} from 'react-icons/hi';
import './Analytics.css';

const Analytics = () => {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hiddenProducts, setHiddenProducts] = useState(() => JSON.parse(localStorage.getItem('hiddenTopProducts') || '[]'));

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, analyticsRes] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getAnalytics(),
      ]);
      setStats(statsRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="loading-screen">
          <div className="spinner" />
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-page">
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--danger-500)', marginBottom: 16 }}>{error}</p>
          <button className="btn btn-primary" onClick={fetchData}><HiOutlineRefresh /> Retry</button>
        </div>
      </div>
    );
  }

  const s = stats?.stats || {};
  const a = analytics || {};
  const maxQuotation = Math.max(...(a.dailyQuotations || []).map(d => d.count), 1);
  const maxUser = Math.max(...(a.dailyUsers || []).map(d => d.count), 1);

  const statusColors = {
    DRAFT: '#94a3b8', SENT: '#3b82f6', ACCEPTED: '#10b981',
    REJECTED: '#ef4444', EXPIRED: '#f59e0b', PENDING: '#8b5cf6',
    PROCESSING: '#3b82f6', COMPLETED: '#10b981', CANCELLED: '#ef4444',
    CUSTOMER: '#8b5cf6', ADMIN: '#ef4444', STAFF: '#3b82f6',
  };

  const formatTime = (t) => {
    const d = new Date(t);
    const now = new Date();
    const diff = Math.floor((now - d) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="analytics-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Business performance overview</p>
        </div>
        <button className="btn btn-ghost" onClick={fetchData}><HiOutlineRefresh /> Refresh</button>
      </div>

      {/* ─── KPI Cards ─────────────────────── */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-revenue">
          <div className="kpi-icon"><HiOutlineTrendingUp /></div>
          <div className="kpi-body">
            <span className="kpi-label">Total Revenue</span>
            <span className="kpi-value">Tk. {Number(s.revenue || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>
        <div className="kpi-card kpi-quotations">
          <div className="kpi-icon"><HiOutlineDocumentText /></div>
          <div className="kpi-body">
            <span className="kpi-label">Quotations</span>
            <span className="kpi-value">{s.totalQuotations || 0}</span>
            <span className="kpi-sub">{a.conversionRate || 0}% converted</span>
          </div>
        </div>
        <div className="kpi-card kpi-orders">
          <div className="kpi-icon"><HiOutlineShoppingBag /></div>
          <div className="kpi-body">
            <span className="kpi-label">Orders</span>
            <span className="kpi-value">{s.totalOrders || 0}</span>
          </div>
        </div>
        <div className="kpi-card kpi-users">
          <div className="kpi-icon"><HiOutlineUserGroup /></div>
          <div className="kpi-body">
            <span className="kpi-label">Users</span>
            <span className="kpi-value">{s.totalUsers || 0}</span>
            <span className="kpi-sub">+{a.newUsersWeek || 0} this week</span>
          </div>
        </div>
      </div>

      {/* ─── Charts Row ───────────────────── */}
      <div className="chart-row">
        {/* Quotation Trend */}
        <div className="chart-card">
          <div className="chart-header">
            <h3><HiOutlineChartBar /> Quotations (7 Days)</h3>
          </div>
          <div className="bar-chart">
            {(a.dailyQuotations || []).map((d, i) => (
              <div className="bar-col" key={i}>
                <div className="bar-wrapper">
                  <div
                    className="bar"
                    style={{ height: `${Math.max((d.count / maxQuotation) * 100, 4)}%` }}
                  >
                    {d.count > 0 && <span className="bar-val">{d.count}</span>}
                  </div>
                </div>
                <span className="bar-label">{d.date.split(',')[0].split(' ').pop()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* User Registration Trend */}
        <div className="chart-card">
          <div className="chart-header">
            <h3><HiOutlineUserGroup /> New Users (7 Days)</h3>
          </div>
          <div className="bar-chart bar-chart-users">
            {(a.dailyUsers || []).map((d, i) => (
              <div className="bar-col" key={i}>
                <div className="bar-wrapper">
                  <div
                    className="bar bar-user"
                    style={{ height: `${Math.max((d.count / maxUser) * 100, 4)}%` }}
                  >
                    {d.count > 0 && <span className="bar-val">{d.count}</span>}
                  </div>
                </div>
                <span className="bar-label">{d.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Status Breakdown + Category ──── */}
      <div className="breakdown-row">
        {/* Quotation Status */}
        <div className="chart-card">
          <div className="chart-header"><h3>Quotation Status</h3></div>
          <div className="status-list">
            {Object.entries(stats?.quotationsByStatus || {}).length > 0 ? (
              Object.entries(stats.quotationsByStatus).map(([status, count]) => {
                const total = Object.values(stats.quotationsByStatus).reduce((s, c) => s + c, 0);
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div className="status-row" key={status}>
                    <div className="status-info">
                      <span className="status-dot" style={{ background: statusColors[status] || '#94a3b8' }} />
                      <span className="status-name">{status}</span>
                      <span className="status-count">{count}</span>
                    </div>
                    <div className="status-bar-bg">
                      <div className="status-bar-fill" style={{ width: `${pct}%`, background: statusColors[status] || '#94a3b8' }} />
                    </div>
                    <span className="status-pct">{pct}%</span>
                  </div>
                );
              })
            ) : (
              <p className="empty-text">No quotations yet</p>
            )}
          </div>
        </div>

        {/* Order Status */}
        <div className="chart-card">
          <div className="chart-header"><h3>Order Status</h3></div>
          <div className="status-list">
            {Object.entries(stats?.ordersByStatus || {}).length > 0 ? (
              Object.entries(stats.ordersByStatus).map(([status, count]) => {
                const total = Object.values(stats.ordersByStatus).reduce((s, c) => s + c, 0);
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div className="status-row" key={status}>
                    <div className="status-info">
                      <span className="status-dot" style={{ background: statusColors[status] || '#94a3b8' }} />
                      <span className="status-name">{status}</span>
                      <span className="status-count">{count}</span>
                    </div>
                    <div className="status-bar-bg">
                      <div className="status-bar-fill" style={{ width: `${pct}%`, background: statusColors[status] || '#94a3b8' }} />
                    </div>
                    <span className="status-pct">{pct}%</span>
                  </div>
                );
              })
            ) : (
              <p className="empty-text">No orders yet</p>
            )}
          </div>
        </div>

        {/* Category Distribution */}
        <div className="chart-card">
          <div className="chart-header"><h3>Product Categories</h3></div>
          <div className="status-list">
            {(a.categories || []).length > 0 ? (
              a.categories.map((cat, i) => {
                const total = a.categories.reduce((s, c) => s + c.count, 0);
                const pct = total > 0 ? Math.round((cat.count / total) * 100) : 0;
                const colors = ['#4f46e5', '#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];
                return (
                  <div className="status-row" key={i}>
                    <div className="status-info">
                      <span className="status-dot" style={{ background: colors[i % colors.length] }} />
                      <span className="status-name">{cat.name}</span>
                      <span className="status-count">{cat.count}</span>
                    </div>
                    <div className="status-bar-bg">
                      <div className="status-bar-fill" style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
                    </div>
                    <span className="status-pct">{pct}%</span>
                  </div>
                );
              })
            ) : (
              <p className="empty-text">No categories yet</p>
            )}
          </div>
        </div>
      </div>

      {/* ─── Bottom Row ───────────────────── */}
      <div className="bottom-row">
        {/* Top Products */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>🔥 Top Requested Products</h3>
            {hiddenProducts.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setHiddenProducts([]); localStorage.removeItem('hiddenTopProducts'); toast.success('All hidden products restored'); }}>
                <HiOutlineEye /> Show All ({hiddenProducts.length} hidden)
              </button>
            )}
          </div>
          {(() => {
            const visibleProducts = (a.topProducts || []).filter(p => !hiddenProducts.includes(p.name));
            return visibleProducts.length > 0 ? (
              <div className="top-products-list">
                {visibleProducts.map((p, i) => {
                  const maxQty = Math.max(...visibleProducts.map(x => x.totalQty), 1);
                  return (
                    <div className="top-product-row" key={i}>
                      <span className="top-rank">#{i + 1}</span>
                      <div className="top-product-info">
                        <span className="top-product-name">{p.name}</span>
                        <div className="top-product-bar-bg">
                          <div className="top-product-bar" style={{ width: `${(p.totalQty / maxQty) * 100}%` }} />
                        </div>
                      </div>
                      <div className="top-product-stats">
                        <span className="top-qty">{p.totalQty} qty</span>
                        <span className="top-times">{p.timesOrdered}x</span>
                      </div>
                      <div className="top-product-actions">
                        <button
                          className="top-action-btn hide-btn"
                          title="Hide from list"
                          onClick={() => {
                            const updated = [...hiddenProducts, p.name];
                            setHiddenProducts(updated);
                            localStorage.setItem('hiddenTopProducts', JSON.stringify(updated));
                            toast.success(`"${p.name}" hidden from list`);
                          }}
                        >
                          <HiOutlineEyeOff />
                        </button>
                        <button
                          className="top-action-btn delete-btn"
                          title="Delete permanently"
                          onClick={async () => {
                            if (!window.confirm(`Permanently delete all quotation items for "${p.name}"? This cannot be undone.`)) return;
                            try {
                              await dashboardAPI.deleteTopProduct(p.name);
                              toast.success(`Deleted "${p.name}" from top products`);
                              fetchData();
                            } catch (err) {
                              toast.error('Failed to delete');
                            }
                          }}
                        >
                          <HiOutlineTrash />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="empty-text">{hiddenProducts.length > 0 ? 'All products are hidden' : 'No product data yet'}</p>
            );
          })()}
        </div>

        {/* Recent Activity */}
        <div className="chart-card">
          <div className="chart-header"><h3><HiOutlineClock /> Recent Activity</h3></div>
          {(a.recentActivity || []).length > 0 ? (
            <div className="activity-list">
              {a.recentActivity.map((act, i) => (
                <div className="activity-row" key={i}>
                  <div className={`activity-icon ${act.type === 'quotation' ? 'activity-icon-qt' : 'activity-icon-user'}`}>
                    {act.type === 'quotation' ? <HiOutlineDocumentText /> : <HiOutlineUserGroup />}
                  </div>
                  <div className="activity-info">
                    <span className="activity-text">{act.text}</span>
                    <span className="activity-detail">{act.detail}</span>
                  </div>
                  <div className="activity-meta">
                    <span className="activity-badge" style={{ background: `${statusColors[act.status] || '#94a3b8'}18`, color: statusColors[act.status] || '#94a3b8' }}>
                      {act.status}
                    </span>
                    <span className="activity-time">{formatTime(act.time)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-text">No recent activity</p>
          )}
        </div>
      </div>

      {/* ─── Low Stock Alert ──────────────── */}
      {(stats?.lowStockProducts || []).length > 0 && (
        <div className="chart-card low-stock-card">
          <div className="chart-header">
            <h3><HiOutlineTrendingDown /> Low Stock Alert</h3>
            <span className="low-stock-badge">{stats.lowStockProducts.length} items</span>
          </div>
          <div className="low-stock-grid">
            {stats.lowStockProducts.map((p) => (
              <div className="low-stock-item" key={p.id}>
                <div className="low-stock-info">
                  <span className="low-stock-name">{p.name}</span>
                  <span className="low-stock-cat">{p.category?.name}</span>
                </div>
                <span className={`low-stock-qty ${p.stock === 0 ? 'out' : ''}`}>
                  {p.stock === 0 ? 'OUT' : p.stock}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
