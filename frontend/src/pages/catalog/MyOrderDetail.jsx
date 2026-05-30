import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ordersAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { 
  HiOutlineArrowLeft,
  HiOutlineX,
  HiOutlineCheck,
  HiOutlineLocationMarker,
  HiOutlinePhone,
  HiOutlineCreditCard
} from 'react-icons/hi';
import './MyOrderDetail.css';

const ORDER_STEPS = [
  { id: 'PENDING', label: 'Order Placed' },
  { id: 'CONFIRMED', label: 'Confirmed' },
  { id: 'PROCESSING', label: 'Processing' },
  { id: 'SHIPPED', label: 'Shipped' },
  { id: 'DELIVERED', label: 'Delivered' }
];

const MyOrderDetail = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const { data } = await ordersAPI.getById(id);
      setOrder(data.order);
    } catch (err) {
      toast.error('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    try {
      setCancelling(true);
      await ordersAPI.cancel(id);
      toast.success('Order cancelled successfully');
      fetchOrder(); // refresh
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="order-detail-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const isCancelled = order.status === 'CANCELLED';
  const currentStepIndex = isCancelled ? -1 : ORDER_STEPS.findIndex(s => s.id === order.status);

  return (
    <div className="order-detail-page">
      <div className="page-header">
        <Link to="/my-orders" className="back-link">
          <HiOutlineArrowLeft /> Back to Orders
        </Link>
        <div className="header-flex">
          <h1>Order #{order.orderNumber}</h1>
          {order.status === 'PENDING' && (
            <button 
              className="btn btn-danger cancel-btn"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? '...' : <><HiOutlineX /> Cancel Order</>}
            </button>
          )}
        </div>
        <p className="order-date">
          Placed on {new Date(order.createdAt).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
          })}
        </p>
      </div>

      <div className="detail-grid">
        {/* Left Col - Timeline & Items */}
        <div className="main-col">
          <div className="detail-card timeline-card">
            <h2>Order Status</h2>
            
            {isCancelled ? (
              <div className="cancelled-state">
                <div className="cancelled-icon"><HiOutlineX /></div>
                <h3>Order Cancelled</h3>
                <p>This order was cancelled and will not be processed.</p>
              </div>
            ) : (
              <div className="stepper">
                {ORDER_STEPS.map((step, index) => {
                  const isCompleted = index <= currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  
                  // Find timeline entry for this step if it exists
                  const timelineEntry = order.timeline.find(t => t.status === step.id);
                  
                  return (
                    <div key={step.id} className={`step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}>
                      <div className="step-indicator">
                        <div className="step-circle">
                          {isCompleted ? <HiOutlineCheck /> : ''}
                        </div>
                        {index < ORDER_STEPS.length - 1 && <div className="step-line"></div>}
                      </div>
                      <div className="step-content">
                        <h4>{step.label}</h4>
                        {timelineEntry ? (
                          <>
                            <span className="step-time">
                              {new Date(timelineEntry.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {timelineEntry.note && <p className="step-note">{timelineEntry.note}</p>}
                          </>
                        ) : (
                          <span className="step-time future">Pending</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="detail-card">
            <h2>Items Ordered</h2>
            <div className="ordered-items">
              {order.items.map(item => (
                <div key={item.id} className="ordered-item">
                  <div className="item-image">
                    {item.product?.imageUrl ? (
                      <img src={item.product.imageUrl} alt={item.productName} />
                    ) : (
                      <div className="placeholder">📦</div>
                    )}
                  </div>
                  <div className="item-info">
                    <Link to={`/product/${item.product?.slug}`} className="item-name">
                      {item.productName}
                    </Link>
                    <div className="item-meta">
                      <span className="item-price">৳{Number(item.unitPrice).toLocaleString()}</span>
                      <span className="item-qty">Qty: {item.quantity}</span>
                    </div>
                  </div>
                  <div className="item-total">
                    ৳{Number(item.lineTotal).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col - Summary & Info */}
        <div className="side-col">
          <div className="detail-card summary-card">
            <h2>Order Summary</h2>
            <div className="summary-rows">
              <div className="row">
                <span>Subtotal ({order.items.length} items)</span>
                <span>৳{Number(order.subtotal).toLocaleString()}</span>
              </div>
              {Number(order.discount) > 0 && (
                <div className="row discount">
                  <span>Discount {order.promoCode && `(${order.promoCode})`}</span>
                  <span>-৳{Number(order.discount).toLocaleString()}</span>
                </div>
              )}
              <div className="row">
                <span>Shipping Fee</span>
                <span>{Number(order.shippingFee) === 0 ? 'Free' : `৳${Number(order.shippingFee).toLocaleString()}`}</span>
              </div>
              <div className="row grand-total">
                <span>Total Amount</span>
                <span>৳{Number(order.total).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="detail-card info-card">
            <h2>Shipping & Billing</h2>
            
            <div className="info-section">
              <h3><HiOutlineLocationMarker /> Shipping Address</h3>
              <p className="info-name">{order.customer.contactPerson}</p>
              <p>{order.shippingAddress}</p>
              <p>{order.shippingCity}</p>
            </div>

            <div className="info-section">
              <h3><HiOutlinePhone /> Contact Info</h3>
              <p>{order.shippingPhone}</p>
            </div>

            <div className="info-section">
              <h3><HiOutlineCreditCard /> Payment Method</h3>
              <p>{order.paymentMethod === 'COD' ? 'Cash on Delivery' : order.paymentMethod}</p>
            </div>

            {order.notes && (
              <div className="info-section">
                <h3>Order Notes</h3>
                <p className="notes-text">{order.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyOrderDetail;
