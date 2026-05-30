import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ordersAPI } from '../../services/api';
import {
  HiOutlineCheckCircle,
  HiOutlineTruck,
  HiOutlineLocationMarker,
  HiOutlinePhone,
  HiOutlineCreditCard,
  HiOutlineShoppingBag,
  HiOutlineClipboardList,
  HiOutlineArrowRight,
  HiOutlineMail,
  HiOutlineClock,
} from 'react-icons/hi';
import './OrderConfirmation.css';

const TIMELINE_STEPS = [
  { status: 'PENDING', label: 'Order Placed' },
  { status: 'CONFIRMED', label: 'Confirmed' },
  { status: 'PROCESSING', label: 'Processing' },
  { status: 'SHIPPED', label: 'Shipped' },
  { status: 'DELIVERED', label: 'Delivered' },
];

const OrderConfirmation = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const { data } = await ordersAPI.getById(id);
        setOrder(data.order);
      } catch (err) {
        setError('Order not found or access denied.');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  if (loading) {
    return (
      <div className="oc-page">
        <div className="oc-loading">
          <div className="spinner" />
          <p>Loading your order...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="oc-page">
        <div className="oc-error">
          <div className="oc-error-icon">📦</div>
          <h2>Order Not Found</h2>
          <p>{error || 'We couldn\'t find this order.'}</p>
          <Link to="/my-orders" className="oc-btn oc-btn-primary" style={{ display: 'inline-flex' }}>
            <HiOutlineClipboardList /> Go to My Orders
          </Link>
        </div>
      </div>
    );
  }

  const currentStepIndex = TIMELINE_STEPS.findIndex(s => s.status === order.status);
  const timelineMap = {};
  order.timeline?.forEach(t => {
    timelineMap[t.status] = t;
  });

  return (
    <div className="oc-page">
      {/* ─── Success Header ─────────────────── */}
      <div className="oc-success-header">
        <div className="oc-confetti">
          <span className="oc-confetti-dot" />
          <span className="oc-confetti-dot" />
          <span className="oc-confetti-dot" />
          <span className="oc-confetti-dot" />
          <span className="oc-confetti-dot" />
          <span className="oc-confetti-dot" />
          <span className="oc-confetti-dot" />
          <span className="oc-confetti-dot" />
        </div>

        <div className="oc-check-wrap">
          <svg className="oc-check-svg" viewBox="0 0 38 38">
            <polyline points="8 20 16 28 30 12" />
          </svg>
        </div>

        <h1 className="oc-success-title">Order Confirmed!</h1>
        <p className="oc-order-number">
          Order <strong>#{order.orderNumber}</strong>
        </p>
        <p className="oc-order-date">
          {new Date(order.createdAt).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>

        <div className="oc-email-msg">
          <HiOutlineMail />
          A confirmation email has been sent to your email.
        </div>
      </div>

      {/* ─── Two Column Layout ──────────────── */}
      <div className="oc-grid">
        {/* LEFT COLUMN */}
        <div className="oc-main-col">
          {/* Order Items */}
          <div className="oc-card">
            <h3 className="oc-card-title">
              <HiOutlineShoppingBag /> Order Items ({order.items?.length || 0})
            </h3>
            <div className="oc-items-list">
              {order.items?.map((item) => (
                <div key={item.id} className="oc-item">
                  <div className="oc-item-img">
                    {item.product?.imageUrl ? (
                      <img src={item.product.imageUrl} alt={item.productName} />
                    ) : (
                      <div className="oc-item-img-placeholder">📦</div>
                    )}
                  </div>
                  <div className="oc-item-body">
                    <p className="oc-item-name">{item.productName}</p>
                    <div className="oc-item-meta">
                      <span>Qty: {item.quantity}</span>
                      <span>৳{Number(item.unitPrice).toLocaleString()} each</span>
                    </div>
                  </div>
                  <div className="oc-item-total">
                    ৳{Number(item.lineTotal).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping Info */}
          <div className="oc-card">
            <h3 className="oc-card-title">
              <HiOutlineTruck /> Shipping & Payment
            </h3>

            <div className="oc-info-section">
              <p className="oc-info-label">
                <HiOutlineLocationMarker /> Delivery Address
              </p>
              <p className="oc-info-value">
                {order.shippingAddress}
              </p>
              <p className="oc-info-value" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                {order.shippingCity}
              </p>
            </div>

            <div className="oc-info-section">
              <p className="oc-info-label">
                <HiOutlinePhone /> Contact Phone
              </p>
              <p className="oc-info-value">{order.shippingPhone}</p>
            </div>

            <div className="oc-info-section">
              <p className="oc-info-label">
                <HiOutlineCreditCard /> Payment Method
              </p>
              <p className="oc-info-value">
                {order.paymentMethod === 'COD' ? 'Cash on Delivery' : order.paymentMethod}
              </p>
            </div>

            {order.notes && (
              <div className="oc-info-section">
                <p className="oc-info-label">📝 Order Notes</p>
                <div className="oc-notes-box">{order.notes}</div>
              </div>
            )}
          </div>

          {/* Timeline Stepper */}
          <div className="oc-card">
            <h3 className="oc-card-title">
              <HiOutlineClock /> Order Timeline
            </h3>
            <div className="oc-timeline">
              {TIMELINE_STEPS.map((step, i) => {
                const isActive = i === currentStepIndex;
                const isCompleted = i < currentStepIndex;
                const entry = timelineMap[step.status];

                return (
                  <div key={step.status} className={`oc-step ${isActive ? 'oc-active' : ''} ${isCompleted ? 'oc-completed' : ''}`}>
                    <div className="oc-step-indicator">
                      <div className="oc-step-circle">
                        {isCompleted || isActive ? <HiOutlineCheckCircle style={{ fontSize: 14 }} /> : (i + 1)}
                      </div>
                      {i < TIMELINE_STEPS.length - 1 && <div className="oc-step-line" />}
                    </div>
                    <div className="oc-step-content">
                      <h4>{step.label}</h4>
                      {entry ? (
                        <span className="oc-step-time">
                          {new Date(entry.createdAt).toLocaleString()}
                        </span>
                      ) : (
                        <span className="oc-step-time oc-future">Upcoming</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="oc-side-col">
          <div className="oc-card">
            <h3 className="oc-card-title">Order Summary</h3>
            <div className="oc-summary-rows">
              <div className="oc-summary-row">
                <span>Subtotal</span>
                <span>৳{Number(order.subtotal).toLocaleString()}</span>
              </div>

              {Number(order.discount) > 0 && (
                <div className="oc-summary-row oc-discount">
                  <span>
                    Discount
                    {order.promoCode && (
                      <span className="oc-promo-badge">{order.promoCode}</span>
                    )}
                  </span>
                  <span>-৳{Number(order.discount).toLocaleString()}</span>
                </div>
              )}

              <div className="oc-summary-row">
                <span>Shipping</span>
                <span style={{ color: Number(order.shippingFee) === 0 ? 'var(--success-500)' : undefined, fontWeight: Number(order.shippingFee) === 0 ? 600 : undefined }}>
                  {Number(order.shippingFee) === 0 ? 'Free' : `৳${Number(order.shippingFee).toLocaleString()}`}
                </span>
              </div>

              <div className="oc-summary-row oc-grand-total">
                <span>Total</span>
                <span>৳{Number(order.total).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="oc-actions">
            <Link to="/my-orders" className="oc-btn oc-btn-primary">
              <HiOutlineClipboardList /> View My Orders
            </Link>
            <Link to="/catalog" className="oc-btn oc-btn-secondary">
              Continue Shopping <HiOutlineArrowRight />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmation;
