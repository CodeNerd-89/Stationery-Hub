import { useState, useEffect } from 'react';
import { ordersAPI } from '../../services/api';
import toast from 'react-hot-toast';
import {
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineBell,
  HiOutlineLocationMarker,
  HiOutlinePhone,
  HiOutlineCreditCard,
  HiOutlineClock,
  HiOutlineCheckCircle,
} from 'react-icons/hi';

const ALL_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

const statusConfig = {
  PENDING: { badge: 'badge-warning', icon: '⏳', label: 'Pending' },
  CONFIRMED: { badge: 'badge-info', icon: '✅', label: 'Confirmed' },
  PROCESSING: { badge: 'badge-primary', icon: '⚙️', label: 'Processing' },
  SHIPPED: { badge: 'badge-info', icon: '🚚', label: 'Shipped' },
  DELIVERED: { badge: 'badge-success', icon: '📦', label: 'Delivered' },
  COMPLETED: { badge: 'badge-success', icon: '✨', label: 'Completed' },
  CANCELLED: { badge: 'badge-danger', icon: '❌', label: 'Cancelled' },
};

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [expandedData, setExpandedData] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => { fetchOrders(); }, [filterStatus, page]);

  // Poll for new pending orders every 30s
  useEffect(() => {
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPendingCount = async () => {
    try {
      const { data } = await ordersAPI.getAll({ status: 'PENDING', limit: 1 });
      setPendingCount(data.pagination?.total || 0);
    } catch (err) { /* silent */ }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data } = await ordersAPI.getAll({ status: filterStatus || undefined, page, limit: 20 });
      setOrders(data.orders);
      setPagination(data.pagination);
    } catch (err) { toast.error('Failed to load orders'); }
    finally { setLoading(false); }
  };

  const updateStatus = async (id, status) => {
    try {
      await ordersAPI.updateStatus(id, status);
      toast.success(`Status updated to ${status}`);
      fetchOrders();
      fetchPendingCount();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update'); }
  };

  const toggleExpand = async (orderId) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
      setExpandedData(null);
      return;
    }
    setExpandedOrder(orderId);
    try {
      const { data } = await ordersAPI.getById(orderId);
      setExpandedData(data.order);
    } catch (err) {
      toast.error('Failed to load order details');
      setExpandedOrder(null);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            Orders
            {pendingCount > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff',
                fontSize: '0.75rem', fontWeight: 700, minWidth: '24px', height: '24px',
                borderRadius: '12px', padding: '0 8px',
                animation: 'pulse 2s infinite',
              }}>{pendingCount} new</span>
            )}
          </h1>
          <p className="page-subtitle">Track and manage customer orders • {pagination.total || 0} total</p>
        </div>
      </div>

      {/* New orders alert banner */}
      {pendingCount > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fef3c7, #fde68a)', border: '1px solid #f59e0b',
          borderRadius: '12px', padding: '14px 20px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '12px', animation: 'fadeIn 0.3s ease',
        }}>
          <HiOutlineBell style={{ fontSize: '1.25rem', color: '#d97706' }} />
          <span style={{ fontWeight: 600, color: '#92400e', fontSize: '0.875rem' }}>
            You have {pendingCount} pending order{pendingCount !== 1 ? 's' : ''} awaiting confirmation.
          </span>
          <button
            onClick={() => { setFilterStatus('PENDING'); setPage(1); }}
            style={{
              marginLeft: 'auto', padding: '6px 16px', borderRadius: '8px',
              border: 'none', background: '#f59e0b', color: '#fff',
              fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer',
            }}
          >View Pending</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <select className="form-select" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} style={{ maxWidth: 200 }}>
          <option value="">All Status</option>
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{statusConfig[s]?.label || s}</option>
          ))}
        </select>
      </div>

      {loading ? <div className="loading-screen"><div className="spinner" /><p>Loading orders...</p></div> : orders.length > 0 ? (
        <>
          <div className="table-container">
            <table className="table">
              <thead><tr>
                <th style={{ width: 40 }}></th>
                <th>Order #</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Status</th>
                <th>Items</th>
                <th>Total (৳)</th>
                <th>Date</th>
                <th>Update Status</th>
              </tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} style={{ cursor: 'pointer' }}>
                    {/* Main row - clickable to expand */}
                    <td style={{ padding: '8px' }} onClick={() => toggleExpand(o.id)}>
                      {expandedOrder === o.id ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />}
                    </td>
                    <td onClick={() => toggleExpand(o.id)}><strong>{o.orderNumber}</strong></td>
                    <td onClick={() => toggleExpand(o.id)}>{o.customer?.contactPerson || '-'}</td>
                    <td onClick={() => toggleExpand(o.id)}><span className="badge badge-gray" style={{ fontSize: '0.6875rem' }}>{o.orderType || 'B2C'}</span></td>
                    <td onClick={() => toggleExpand(o.id)}><span className={`badge ${statusConfig[o.status]?.badge || 'badge-gray'}`}>{o.status}</span></td>
                    <td onClick={() => toggleExpand(o.id)} style={{ fontSize: '0.8125rem' }}>{o.items?.length || 0}</td>
                    <td onClick={() => toggleExpand(o.id)} style={{ fontWeight: 700 }}>৳{Number(o.total).toLocaleString()}</td>
                    <td onClick={() => toggleExpand(o.id)} style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td>
                      <select className="form-select" value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)}
                        style={{ padding: '4px 8px', fontSize: '0.75rem', minWidth: 130, borderRadius: 'var(--radius-full)' }}>
                        {ALL_STATUSES.map(s => <option key={s} value={s}>{statusConfig[s]?.icon} {s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
                {/* Expanded detail row - rendered outside the map to avoid nesting issues */}
                {orders.map((o) => (
                  expandedOrder === o.id && expandedData ? (
                    <tr key={`${o.id}-detail`}>
                      <td colSpan="9" style={{ padding: 0, borderTop: 'none' }}>
                        <div style={{
                          background: 'var(--gray-50)', borderTop: '2px solid var(--primary-200)',
                          padding: '24px', animation: 'fadeIn 0.3s ease',
                        }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            {/* Items */}
                            <div>
                              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>Order Items</h4>
                              <div style={{ background: 'var(--bg-primary)', borderRadius: '10px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                  <thead><tr style={{ background: 'var(--gray-100)' }}>
                                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Product</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Qty</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Price</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Total</th>
                                  </tr></thead>
                                  <tbody>
                                    {expandedData.items?.map((item) => (
                                      <tr key={item.id} style={{ borderTop: '1px solid var(--gray-100)' }}>
                                        <td style={{ padding: '10px 12px', fontWeight: 500 }}>{item.productName}</td>
                                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>{item.quantity}</td>
                                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>৳{Number(item.unitPrice).toLocaleString()}</td>
                                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>৳{Number(item.lineTotal).toLocaleString()}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              {/* Summary */}
                              <div style={{ marginTop: '12px', background: 'var(--bg-primary)', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '6px' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span><span>৳{Number(expandedData.subtotal).toLocaleString()}</span>
                                </div>
                                {Number(expandedData.discount) > 0 && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '6px', color: '#16a34a' }}>
                                    <span>Discount {expandedData.promoCode && `(${expandedData.promoCode})`}</span><span>-৳{Number(expandedData.discount).toLocaleString()}</span>
                                  </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '6px' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Shipping</span><span>{Number(expandedData.shippingFee) === 0 ? 'Free' : `৳${Number(expandedData.shippingFee).toLocaleString()}`}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.9375rem', borderTop: '1px solid var(--gray-200)', paddingTop: '8px', marginTop: '4px' }}>
                                  <span>Total</span><span style={{ color: 'var(--primary-600)' }}>৳{Number(expandedData.total).toLocaleString()}</span>
                                </div>
                              </div>
                            </div>

                            {/* Right side: Shipping + Timeline */}
                            <div>
                              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>Shipping Details</h4>
                              <div style={{ background: 'var(--bg-primary)', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '16px', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '0.8125rem' }}>
                                  <HiOutlineLocationMarker style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
                                  <span>{expandedData.shippingAddress || '-'}, {expandedData.shippingCity || '-'}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '0.8125rem' }}>
                                  <HiOutlinePhone style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
                                  <span>{expandedData.shippingPhone || '-'}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem' }}>
                                  <HiOutlineCreditCard style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
                                  <span>{expandedData.paymentMethod === 'COD' ? 'Cash on Delivery' : expandedData.paymentMethod}</span>
                                </div>
                                {expandedData.notes && (
                                  <div style={{ marginTop: '12px', padding: '10px', background: 'var(--gray-50)', borderRadius: '8px', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                                    <strong>Notes:</strong> {expandedData.notes}
                                  </div>
                                )}
                              </div>

                              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>Timeline</h4>
                              <div style={{ background: 'var(--bg-primary)', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '16px' }}>
                                {expandedData.timeline?.map((t, i) => (
                                  <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: i < expandedData.timeline.length - 1 ? '12px' : 0, paddingBottom: i < expandedData.timeline.length - 1 ? '12px' : 0, borderBottom: i < expandedData.timeline.length - 1 ? '1px solid var(--gray-100)' : 'none' }}>
                                    <div style={{
                                      width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                                      background: i === expandedData.timeline.length - 1 ? 'var(--primary-500)' : 'var(--success-500)',
                                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem',
                                    }}>
                                      {i === expandedData.timeline.length - 1 ? <HiOutlineClock /> : <HiOutlineCheckCircle />}
                                    </div>
                                    <div>
                                      <span className={`badge ${statusConfig[t.status]?.badge || 'badge-gray'}`} style={{ fontSize: '0.6875rem', marginBottom: '4px' }}>{t.status}</span>
                                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>{t.note}</p>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{new Date(t.createdAt).toLocaleString()}</span>
                                    </div>
                                  </div>
                                ))}
                                {(!expandedData.timeline || expandedData.timeline.length === 0) && (
                                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', margin: 0 }}>No timeline entries</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null
                ))}
              </tbody>
            </table>
          </div>
          {pagination.pages > 1 && (
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
                <button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </>
      ) : (
        <div className="card"><div className="empty-state"><div className="empty-state-icon">📦</div><h3>No orders found</h3><p>Orders will appear here when customers place orders.</p></div></div>
      )}
    </div>
  );
};

export default AdminOrders;
