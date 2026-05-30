import { useState, useEffect, useRef } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { quotationsAPI } from '../../services/api';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  HiOutlineTrash,
  HiOutlinePlus,
  HiOutlineMinus,
  HiOutlineShoppingBag,
  HiOutlineDocumentText,
  HiOutlineArrowLeft,
  HiOutlineHeart,
  HiOutlineTag,
  HiOutlineChevronDown,
  HiOutlineShieldCheck,
  HiOutlineBadgeCheck,
  HiOutlineLightningBolt,
  HiOutlineRefresh,
  HiOutlineTruck,
  HiOutlineClock,
  HiOutlineStar,
  HiOutlineShoppingCart,
  HiOutlinePencil,
} from 'react-icons/hi';
import './Cart.css';

// ─── Constants ──────────────────────────────────────────
const FREE_SHIPPING_THRESHOLD = 5000;

// ─── Helpers ────────────────────────────────────────────
const getDeliveryDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 5); // 3-5 business days
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const getStockStatus = (stock) => {
  if (stock === 0) return { label: 'Out of Stock', className: 'stock-out' };
  if (stock <= 10) return { label: `Only ${stock} left — order soon!`, className: 'stock-low' };
  return { label: 'In Stock', className: 'stock-in' };
};

// ─── Recommended Products (demo data for upsell) ───────
const recommendedProducts = [
  { id: 'rec-1', name: 'Premium A4 Paper (500 Sheets)', price: 650, unit: 'ream', icon: '📄' },
  { id: 'rec-2', name: 'Gel Pen Set (12 Colors)', price: 180, unit: 'set', icon: '🖊️' },
  { id: 'rec-3', name: 'Sticky Notes Neon Pack', price: 120, unit: 'pack', icon: '📝' },
  { id: 'rec-4', name: 'Desktop Organizer', price: 450, unit: 'piece', icon: '🗂️' },
];

// ─── Empty Cart SVG Illustration ────────────────────────
const EmptyCartIllustration = () => (
  <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="100" r="90" fill="#eef2ff" />
    <circle cx="100" cy="100" r="70" fill="#e0e7ff" opacity="0.5" />
    {/* Cart body */}
    <path d="M60 75 L70 130 L140 130 L150 85 L75 85" stroke="#6366f1" strokeWidth="3" fill="#c7d2fe" strokeLinecap="round" strokeLinejoin="round" />
    {/* Cart handle */}
    <path d="M55 75 L60 75" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />
    {/* Wheels */}
    <circle cx="85" cy="140" r="7" fill="#6366f1" />
    <circle cx="125" cy="140" r="7" fill="#6366f1" />
    {/* X mark */}
    <line x1="95" y1="100" x2="115" y2="115" stroke="#a5b4fc" strokeWidth="3" strokeLinecap="round" />
    <line x1="115" y1="100" x2="95" y2="115" stroke="#a5b4fc" strokeWidth="3" strokeLinecap="round" />
    {/* Sparkles */}
    <circle cx="145" cy="65" r="3" fill="#818cf8" opacity="0.6" />
    <circle cx="55" cy="60" r="2" fill="#818cf8" opacity="0.4" />
    <circle cx="160" cy="95" r="2.5" fill="#a5b4fc" opacity="0.5" />
  </svg>
);

// ─── Component ──────────────────────────────────────────
const Cart = () => {
  const { items, updateQuantity, removeFromCart, clearCart, addToCart, totalItems, totalAmount } = useCart();
  const { user, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponExpanded, setCouponExpanded] = useState(false);
  const [savedItems, setSavedItems] = useState([]);
  const [savedInitialized, setSavedInitialized] = useState(false);
  const [qtyAnimating, setQtyAnimating] = useState(null);

  const deliveryDate = getDeliveryDate();

  // Load saved items
  useEffect(() => {
    if (loading) return; // wait for auth
    const key = user ? `savedForLater_${user.id}` : 'savedForLater_guest';
    try {
      const saved = localStorage.getItem(key);
      setSavedItems(saved ? JSON.parse(saved) : []);
    } catch {
      setSavedItems([]);
    }
    setSavedInitialized(true);
  }, [user, loading]);

  // Persist saved items
  useEffect(() => {
    if (!savedInitialized) return;
    const key = user ? `savedForLater_${user.id}` : 'savedForLater_guest';
    localStorage.setItem(key, JSON.stringify(savedItems));
  }, [savedItems, user, savedInitialized]);

  // ─── Handlers ───────────────────────────────────────
  const handleRequestQuotation = async () => {
    if (!isAuthenticated) {
      toast.error('Please log in to request a quotation');
      navigate('/login');
      return;
    }
    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    setSubmitting(true);
    try {
      await quotationsAPI.create({
        items: items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.price,
          discountPercent: 0,
        })),
        notes: notes || `Quotation request from ${user?.name || 'customer'}`,
      });
      clearCart();
      toast.success('Quotation requested successfully! Our team will review and contact you.');
      navigate('/catalog');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit quotation request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQtyChange = (productId, newQty) => {
    updateQuantity(productId, newQty);
    setQtyAnimating(productId);
    setTimeout(() => setQtyAnimating(null), 250);
  };

  const handleSaveForLater = (item) => {
    setSavedItems((prev) => [...prev, item]);
    removeFromCart(item.productId);
    toast.success(`${item.productName} saved for later`);
  };

  const handleMoveToCart = (item) => {
    addToCart({
      id: item.productId,
      name: item.productName,
      sku: item.sku,
      price: item.price,
      unit: item.unit,
      stock: item.stock,
      category: { name: item.categoryName },
    }, item.quantity || 1);
    setSavedItems((prev) => prev.filter((s) => s.productId !== item.productId));
  };

  const handleRemoveSaved = (productId) => {
    setSavedItems((prev) => prev.filter((s) => s.productId !== productId));
    toast.success('Item removed');
  };

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) return;
    toast('Coupon codes will be validated in your quotation.', { icon: '🏷️' });
    setCouponExpanded(false);
  };

  // ─── Computed ───────────────────────────────────────
  const shippingProgress = Math.min((totalAmount / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const shippingAchieved = totalAmount >= FREE_SHIPPING_THRESHOLD;
  const remainingForFreeShipping = FREE_SHIPPING_THRESHOLD - totalAmount;
  const estimatedShipping = shippingAchieved ? 0 : 150;
  const estimatedTotal = totalAmount + estimatedShipping;

  // ═════════════════════════════════════════════════════
  // EMPTY CART STATE
  // ═════════════════════════════════════════════════════
  if (items.length === 0 && savedItems.length === 0) {
    return (
      <div className="cart-page">
        <div className="cart-empty">
          <div className="cart-empty-illustration">
            <EmptyCartIllustration />
          </div>
          <h2>Your cart is empty</h2>
          <p>Looks like you haven't added any products yet. Browse our catalog to find premium stationery and office supplies for your business.</p>
          <Link to="/catalog" className="cart-empty-cta">
            <HiOutlineShoppingBag /> Browse Products
          </Link>

          <div className="cart-empty-features">
            <div className="cart-empty-feature">
              <div className="cart-empty-feature-icon f1">📦</div>
              <span>Bulk Pricing</span>
            </div>
            <div className="cart-empty-feature">
              <div className="cart-empty-feature-icon f2">🚚</div>
              <span>Free Shipping</span>
            </div>
            <div className="cart-empty-feature">
              <div className="cart-empty-feature-icon f3">⭐</div>
              <span>Premium Quality</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════
  // CART WITH ITEMS
  // ═════════════════════════════════════════════════════
  return (
    <div className="cart-page">
      {/* ─── Header ──────────────────────────────────── */}
      <div className="cart-header">
        <div className="cart-header-left">
          <Link to="/catalog" className="cart-back-link">
            <HiOutlineArrowLeft /> Continue Shopping
          </Link>
          <h1>Shopping Cart</h1>
          <span className="cart-count">
            {totalItems} item{totalItems !== 1 ? 's' : ''} • ৳{totalAmount.toLocaleString()} total
          </span>
        </div>
        {items.length > 0 && (
          <div className="cart-header-actions">
            <button className="cart-clear-btn" onClick={clearCart}>
              <HiOutlineTrash /> Clear Cart
            </button>
          </div>
        )}
      </div>

      {/* ─── Free Shipping Progress ──────────────────── */}
      {items.length > 0 && (
        <div className={`shipping-progress ${shippingAchieved ? 'achieved' : ''}`}>
          <div className="shipping-progress-icon">
            {shippingAchieved ? '🎉' : '🚚'}
          </div>
          <div className="shipping-progress-content">
            <div className="shipping-progress-text">
              {shippingAchieved ? (
                <>Congratulations! You've unlocked <span>FREE shipping</span> on this order!</>
              ) : (
                <>Add <span>৳{remainingForFreeShipping.toLocaleString()}</span> more for <span>FREE shipping!</span></>
              )}
            </div>
            <div className="shipping-progress-bar">
              <div
                className="shipping-progress-fill"
                style={{ width: `${shippingProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Main Layout ────────────────────────────── */}
      <div className="cart-layout">
        {/* ────── LEFT: Cart Items ────── */}
        <div className="cart-items-section">
          {items.length > 0 && (
            <div className="cart-items-header">
              <span className="cart-items-title">Cart Items ({items.length})</span>
            </div>
          )}

          {items.map((item, index) => {
            const stockStatus = getStockStatus(item.stock);
            return (
              <div
                key={item.productId}
                className="cart-item cart-item-enter"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* Remove button - top right corner */}
                <button
                  className="cart-item-remove-top"
                  onClick={() => removeFromCart(item.productId)}
                  title="Remove from cart"
                >
                  <HiOutlineTrash />
                  <span>Remove</span>
                </button>

                <div className="cart-item-main">
                  {/* Thumbnail */}
                  <div className="cart-item-thumb">
                    <span className="thumb-placeholder">📦</span>
                  </div>

                  {/* Details */}
                  <div className="cart-item-details">
                    <h3 className="cart-item-name">{item.productName}</h3>
                    <div className="cart-item-badges">
                      <span className="cart-item-sku">{item.sku}</span>
                      {item.categoryName && (
                        <span className="cart-item-category">{item.categoryName}</span>
                      )}
                    </div>

                    {/* Stock Indicator */}
                    <div className={`stock-indicator ${stockStatus.className}`}>
                      <span className="stock-dot" />
                      {stockStatus.label}
                    </div>

                    {/* Delivery Estimate */}
                    <div className="delivery-estimate">
                      <HiOutlineTruck />
                      Est. delivery by {deliveryDate}
                    </div>
                  </div>
                </div>

                {/* Price + Quantity + Total */}
                <div className="cart-item-price-row">
                  <div className="cart-item-unit-price">
                    <strong>৳{item.price.toLocaleString()}</strong>
                    <span className="cart-item-unit-label"> / {item.unit}</span>
                  </div>

                  <div className="cart-qty-selector">
                    <button
                      className="qty-btn"
                      onClick={() => handleQtyChange(item.productId, item.quantity - 1)}
                      aria-label="Decrease quantity"
                    >
                      <HiOutlineMinus />
                    </button>
                    <span className={`qty-display ${qtyAnimating === item.productId ? 'qty-bump' : ''}`}>
                      {item.quantity}
                    </span>
                    <button
                      className="qty-btn"
                      onClick={() => handleQtyChange(item.productId, item.quantity + 1)}
                      disabled={item.quantity >= item.stock}
                      aria-label="Increase quantity"
                    >
                      <HiOutlinePlus />
                    </button>
                  </div>

                  <div className="cart-item-line-total">
                    ৳{(item.price * item.quantity).toLocaleString()}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="cart-item-actions">
                  <button
                    className="cart-action-btn save-btn"
                    onClick={() => handleSaveForLater(item)}
                  >
                    <HiOutlineHeart /> Save for Later
                  </button>
                </div>
              </div>
            );
          })}

          {/* ─── Saved for Later ────────────────────── */}
          {savedItems.length > 0 && (
            <div className="saved-section">
              <div className="saved-section-header">
                <HiOutlineHeart />
                <h3>Saved for Later</h3>
                <span className="saved-count">{savedItems.length}</span>
              </div>
              {savedItems.map((item) => (
                <div key={item.productId} className="saved-item">
                  <div className="saved-item-thumb">📦</div>
                  <div className="saved-item-info">
                    <h4>{item.productName}</h4>
                    <span>৳{item.price.toLocaleString()} / {item.unit}</span>
                  </div>
                  <div className="saved-item-actions">
                    <button className="saved-move-btn" onClick={() => handleMoveToCart(item)}>
                      Move to Cart
                    </button>
                    <button className="saved-remove-btn" onClick={() => handleRemoveSaved(item.productId)}>
                      <HiOutlineTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── Recommended Products ───────────────── */}
          <div className="recommended-section">
            <div className="recommended-header">
              <h3><HiOutlineStar /> You May Also Need</h3>
            </div>
            <div className="recommended-grid">
              {recommendedProducts.map((product) => (
                <div key={product.id} className="rec-product-card">
                  <div className="rec-product-thumb">{product.icon}</div>
                  <div className="rec-product-name">{product.name}</div>
                  <div className="rec-product-price">
                    ৳{product.price.toLocaleString()} <span>/ {product.unit}</span>
                  </div>
                  <Link to="/catalog" className="rec-add-btn">
                    <HiOutlineShoppingCart /> View
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ────── RIGHT: Order Summary ────── */}
        <div className="cart-summary">
          {/* Coupon Section */}
          <div className="coupon-section">
            <button
              className={`coupon-toggle ${couponExpanded ? 'expanded' : ''}`}
              onClick={() => setCouponExpanded(!couponExpanded)}
            >
              <span className="coupon-toggle-left">
                <HiOutlineTag /> Have a promo code?
              </span>
              <HiOutlineChevronDown />
            </button>
            {couponExpanded && (
              <div className="coupon-body">
                <input
                  type="text"
                  placeholder="Enter code..."
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                />
                <button className="coupon-apply-btn" onClick={handleApplyCoupon}>
                  Apply
                </button>
              </div>
            )}
          </div>

          {/* Summary Card */}
          <div className="cart-summary-card">
            <h3><HiOutlineDocumentText /> Order Summary</h3>

            <div className="summary-rows">
              <div className="cart-summary-row">
                <span className="label">Subtotal ({totalItems} items)</span>
                <span className="value">৳{totalAmount.toLocaleString()}</span>
              </div>

              <div className="cart-summary-row shipping">
                <span className="label">Shipping</span>
                <span className="value">
                  {shippingAchieved ? 'FREE' : `৳${estimatedShipping}`}
                </span>
              </div>

              <div className="cart-summary-row tax">
                <span className="label">Tax / VAT</span>
                <span className="value">Calculated at quotation</span>
              </div>

              <hr className="summary-divider" />

              <div className="cart-summary-total">
                <span className="label">Estimated Total</span>
                <span className="value">৳{estimatedTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="cart-notes">
              <label>
                <HiOutlinePencil /> Order Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special requirements, delivery instructions, bulk pricing requests..."
                rows="3"
              />
            </div>

            {/* CTAs */}
            {isAuthenticated ? (
              <div className="cart-cta-group" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Link
                  to="/checkout"
                  className="cart-submit-btn"
                  style={{ textDecoration: 'none', textAlign: 'center', background: 'var(--primary-600)' }}
                >
                  <HiOutlineShoppingCart />
                  Proceed to Checkout
                </Link>
                <button
                  className="btn btn-secondary"
                  onClick={handleRequestQuotation}
                  disabled={submitting || items.length === 0}
                  style={{ width: '100%', padding: '16px', fontWeight: '600' }}
                >
                  {submitting ? (
                    <>
                      <span className="btn-spinner" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <HiOutlineDocumentText />
                      Request B2B Quotation
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="cart-login-prompt">
                <p>Please log in to place an order or request a quote</p>
                <Link to="/login" className="cart-submit-btn">
                  Log In to Continue
                </Link>
              </div>
            )}

            <p className="cart-note-text">
              <strong>B2C Customers:</strong> Proceed to checkout for instant order placement.<br/>
              <strong>B2B Clients:</strong> Request a quotation for bulk pricing and specialized billing.
            </p>
          </div>

          {/* Trust Badges */}
          <div className="trust-badges">
            <div className="trust-badges-grid">
              <div className="trust-badge">
                <div className="trust-badge-icon secure">
                  <HiOutlineShieldCheck />
                </div>
                <span className="trust-badge-text">Secure Checkout</span>
              </div>
              <div className="trust-badge">
                <div className="trust-badge-icon verified">
                  <HiOutlineBadgeCheck />
                </div>
                <span className="trust-badge-text">Verified Supplier</span>
              </div>
              <div className="trust-badge">
                <div className="trust-badge-icon fast">
                  <HiOutlineLightningBolt />
                </div>
                <span className="trust-badge-text">Fast Delivery</span>
              </div>
              <div className="trust-badge">
                <div className="trust-badge-icon returns">
                  <HiOutlineRefresh />
                </div>
                <span className="trust-badge-text">Easy Returns</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Mobile Sticky Checkout Bar ──────────────── */}
      {items.length > 0 && (
        <div className="mobile-checkout-bar">
          <div className="mobile-checkout-info">
            <span className="mobile-total-label">Total</span>
            <span className="mobile-total-value">৳{estimatedTotal.toLocaleString()}</span>
          </div>
          {isAuthenticated ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Link
                to="/checkout"
                className="mobile-checkout-btn"
                style={{ flex: 1, textAlign: 'center', textDecoration: 'none', background: 'var(--primary-600)' }}
              >
                Checkout
              </Link>
              <button
                className="mobile-checkout-btn"
                onClick={handleRequestQuotation}
                disabled={submitting}
                style={{ flex: 1, background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
              >
                {submitting ? 'Submitting...' : 'Quote'}
              </button>
            </div>
          ) : (
            <Link to="/login" className="mobile-checkout-btn">
              Log In
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

export default Cart;
