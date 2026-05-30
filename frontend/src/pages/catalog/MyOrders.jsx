import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ordersAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { 
  HiOutlineShoppingBag, 
  HiOutlineChevronRight,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineTruck,
  HiOutlineInbox
} from 'react-icons/hi';
import './MyOrders.css';

const STATUS_CONFIG = {
  PENDING: { color: 'var(--warning-500)', bg: 'rgba(245, 158, 11, 0.1)', icon: HiOutlineClock, label: 'Pending' },
  CONFIRMED: { color: 'var(--primary-400)', bg: 'rgba(129, 140, 248, 0.1)', icon: HiOutlineCheckCircle, label: 'Confirmed' },
  PROCESSING: { color: 'var(--primary-600)', bg: 'rgba(79, 70, 229, 0.1)', icon: HiOutlineInbox, label: 'Processing' },
  SHIPPED: { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)', icon: HiOutlineTruck, label: 'Shipped' },
  DELIVERED: { color: 'var(--success-500)', bg: 'rgba(34, 197, 94, 0.1)', icon: HiOutlineCheckCircle, label: 'Delivered' },
  COMPLETED: { color: 'var(--success-500)', bg: 'rgba(34, 197, 94, 0.1)', icon: HiOutlineCheckCircle, label: 'Completed' },
  CANCELLED: { color: 'var(--danger-500)', bg: 'rgba(239, 68, 68, 0.1)', icon: HiOutlineXCircle, label: 'Cancelled' }
};

const TABS = [
  { id: 'ALL', label: 'All Orders' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'CONFIRMED', label: 'Confirmed' },
  { id: 'PROCESSING', label: 'Processing' },
  { id: 'SHIPPED', label: 'Shipped' },
  { id: 'DELIVERED', label: 'Delivered' },
  { id: 'CANCELLED', label: 'Cancelled' }
];

const MyOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });

  const fetchOrders = async (status = activeTab, page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: pagination.limit };
      if (status !== 'ALL') params.status = status;
      
      const { data } = await ordersAPI.getMyOrders(params);
      setOrders(data.orders);
      setPagination(data.pagination);
    } catch (err) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(activeTab, 1);
  }, [activeTab]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      fetchOrders(activeTab, newPage);
    }
  };

  return (
    <div className="my-orders-page">
      <div className="page-header">
        <h1>My Orders</h1>
        <p className="subtitle">View and track your orders</p>
      </div>

      <div className="orders-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <HiOutlineShoppingBag className="empty-icon" />
          <h2>No orders found</h2>
          <p>You haven't placed any orders {activeTab !== 'ALL' ? `with status "${activeTab.toLowerCase()}"` : 'yet'}.</p>
          <Link to="/catalog" className="btn btn-primary">Start Shopping</Link>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => {
            const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
            const StatusIcon = statusCfg.icon;
            
            return (
              <div key={order.id} className="order-card">
                <div className="order-header">
                  <div className="order-meta">
                    <span className="order-number">{order.orderNumber}</span>
                    <span className="order-date">
                      {new Date(order.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                    <span className="order-type-badge">{order.orderType}</span>
                  </div>
                  
                  <div 
                    className="order-status-badge"
                    style={{ color: statusCfg.color, backgroundColor: statusCfg.bg }}
                  >
                    <StatusIcon /> {statusCfg.label}
                  </div>
                </div>

                <div className="order-body">
                  <div className="order-items-preview">
                    {order.items.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="preview-item">
                        {item.product?.imageUrl ? (
                          <img src={item.product.imageUrl} alt={item.productName} />
                        ) : (
                          <div className="preview-placeholder">📦</div>
                        )}
                        <span className="preview-qty">x{item.quantity}</span>
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <div className="preview-more">+{order.items.length - 3}</div>
                    )}
                  </div>
                  
                  <div className="order-total-section">
                    <span className="total-label">Total Amount</span>
                    <span className="total-value">৳{Number(order.total).toLocaleString()}</span>
                  </div>
                </div>

                <div className="order-footer">
                  <span className="items-count">{order.items.length} items</span>
                  <Link to={`/my-orders/${order.id}`} className="view-details-btn">
                    View Details <HiOutlineChevronRight />
                  </Link>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="pagination">
              <button 
                disabled={pagination.page === 1}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                Previous
              </button>
              <span className="page-info">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button 
                disabled={pagination.page === pagination.pages}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MyOrders;
