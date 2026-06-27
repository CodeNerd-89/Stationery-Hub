import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { checkoutAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { HiOutlineArrowLeft, HiOutlineShieldCheck, HiOutlineCheckCircle } from 'react-icons/hi';
import './Checkout.css';

const Checkout = () => {
  const { items: cart, totalAmount, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    shippingAddress: '',
    shippingCity: '',
    shippingPhone: user?.phone || '',
    notes: '',
  });

  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subtotal = totalAmount;
  const discount = promoResult ? promoResult.discount : 0;
  const shippingFee = subtotal >= 5000 ? 0 : 150;
  const total = subtotal - discount + shippingFee;

  useEffect(() => {
    if (cart.length === 0) {
      navigate('/catalog');
    }
  }, [cart, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyPromo = async () => {
    if (!promoCode) return;
    try {
      setIsApplyingPromo(true);
      const { data } = await checkoutAPI.validatePromo({ code: promoCode, subtotal });
      setPromoResult(data);
      toast.success(data.message);
    } catch (err) {
      setPromoResult(null);
      toast.error(err.response?.data?.error || 'Invalid promo code');
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.shippingAddress || !formData.shippingCity || !formData.shippingPhone) {
      toast.error('Please fill in all required shipping fields');
      return;
    }

    try {
      setIsSubmitting(true);

      if (paymentMethod === 'BKASH') {
        // bKash flow: save order data, create payment, redirect to bKash
        const orderData = {
          items: cart.map(item => ({ productId: item.productId, quantity: item.quantity })),
          shippingAddress: formData.shippingAddress,
          shippingCity: formData.shippingCity,
          shippingPhone: formData.shippingPhone,
          notes: formData.notes,
          promoCode: promoResult ? promoResult.code : '',
        };

        // Save order data to sessionStorage for the callback
        sessionStorage.setItem('bkash_order_data', JSON.stringify(orderData));

        // Create bKash payment
        const { data } = await checkoutAPI.bkashCreate({ amount: total });

        // Redirect to bKash payment page
        window.location.href = data.bkashURL;
      } else {
        // COD flow: place order directly
        const orderData = {
          items: cart.map(item => ({ productId: item.productId, quantity: item.quantity })),
          shippingAddress: formData.shippingAddress,
          shippingCity: formData.shippingCity,
          shippingPhone: formData.shippingPhone,
          notes: formData.notes,
          promoCode: promoResult ? promoResult.code : null,
          paymentMethod: 'COD',
        };

        const { data } = await checkoutAPI.placeOrder(orderData);
        clearCart(true);
        toast.success('🎉 Order placed successfully!');
        navigate(`/order-confirmation/${data.order.id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to process payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (cart.length === 0) return null;

  return (
    <div className="checkout-page">
      <div className="checkout-header">
        <Link to="/cart" className="back-link">
          <HiOutlineArrowLeft /> Back to Cart
        </Link>
        <h1>Secure Checkout</h1>
      </div>

      <div className="checkout-content">
        {/* Left Form */}
        <div className="checkout-form-section">
          <form onSubmit={handleSubmit} id="checkout-form">
            
            <div className="form-card">
              <h2>1. Shipping Information</h2>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>Full Name</label>
                  <input type="text" value={user?.name || ''} disabled className="disabled-input" />
                </div>
                
                <div className="form-group full-width">
                  <label>Phone Number *</label>
                  <input 
                    type="tel" 
                    name="shippingPhone"
                    value={formData.shippingPhone}
                    onChange={handleInputChange}
                    placeholder="+8801XXXXXXXXX"
                    required 
                  />
                </div>

                <div className="form-group full-width">
                  <label>Delivery Address *</label>
                  <textarea 
                    name="shippingAddress"
                    value={formData.shippingAddress}
                    onChange={handleInputChange}
                    placeholder="House, Road, Area..."
                    rows="3"
                    required
                  ></textarea>
                </div>

                <div className="form-group full-width">
                  <label>City/District *</label>
                  <input 
                    type="text" 
                    name="shippingCity"
                    value={formData.shippingCity}
                    onChange={handleInputChange}
                    placeholder="e.g. Dhaka"
                    required 
                  />
                </div>
              </div>
            </div>

            <div className="form-card">
              <h2>2. Payment Method</h2>
              <div className="payment-methods">
                <label className={`payment-option ${paymentMethod === 'COD' ? 'selected' : ''}`}>
                  <input 
                    type="radio" 
                    name="paymentMethod" 
                    value="COD" 
                    checked={paymentMethod === 'COD'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  />
                  <div className="payment-info">
                    <div className="payment-title-row">
                      <span className="payment-icon cod-icon">💵</span>
                      <span className="payment-title">Cash on Delivery</span>
                    </div>
                    <span className="payment-desc">Pay with cash when your order is delivered.</span>
                  </div>
                </label>

                <label className={`payment-option bkash-option ${paymentMethod === 'BKASH' ? 'selected bkash-selected' : ''}`}>
                  <input 
                    type="radio" 
                    name="paymentMethod" 
                    value="BKASH" 
                    checked={paymentMethod === 'BKASH'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  />
                  <div className="payment-info">
                    <div className="payment-title-row">
                      <span className="payment-icon bkash-icon-badge">
                        <svg viewBox="0 0 40 40" width="28" height="28">
                          <rect x="2" y="2" width="36" height="36" rx="8" fill="#E2136E" />
                          <text x="20" y="28" textAnchor="middle" fill="white" fontSize="22" fontWeight="bold" fontFamily="Arial">b</text>
                        </svg>
                      </span>
                      <span className="payment-title">bKash</span>
                      <span className="bkash-badge">Mobile Payment</span>
                    </div>
                    <span className="payment-desc">Pay securely with your bKash mobile wallet.</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="form-card">
              <h2>3. Order Notes (Optional)</h2>
              <div className="form-group">
                <textarea 
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Special instructions for delivery..."
                  rows="2"
                ></textarea>
              </div>
            </div>

          </form>
        </div>

        {/* Right Summary */}
        <div className="checkout-summary-section">
          <div className="summary-card">
            <h2>Order Summary</h2>
            
            <div className="summary-items">
              {cart.map((item) => (
                <div key={item.productId} className="summary-item">
                  <div className="item-details">
                    <span className="item-name">{item.productName}</span>
                    <span className="item-qty">Qty: {item.quantity}</span>
                  </div>
                  <div className="item-price">
                    ৳{(item.price * item.quantity).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            <div className="promo-section">
              <div className="promo-input-group">
                <input 
                  type="text" 
                  placeholder="Promo Code" 
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  disabled={isApplyingPromo || promoResult}
                />
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={handleApplyPromo}
                  disabled={!promoCode || isApplyingPromo || promoResult}
                >
                  {isApplyingPromo ? '...' : 'Apply'}
                </button>
              </div>
              {promoResult && (
                <div className="promo-success">
                  <HiOutlineCheckCircle /> {promoResult.message}
                </div>
              )}
            </div>

            <div className="summary-totals">
              <div className="total-row">
                <span>Subtotal</span>
                <span>৳{subtotal.toLocaleString()}</span>
              </div>
              {discount > 0 && (
                <div className="total-row discount">
                  <span>Discount ({promoResult?.code})</span>
                  <span>-৳{discount.toLocaleString()}</span>
                </div>
              )}
              <div className="total-row">
                <span>Shipping</span>
                <span>{shippingFee === 0 ? 'Free' : `৳${shippingFee}`}</span>
              </div>
              <div className="total-row grand-total">
                <span>Total</span>
                <span>৳{total.toLocaleString()}</span>
              </div>
            </div>

            <button 
              type="submit" 
              form="checkout-form"
              className={`btn place-order-btn ${paymentMethod === 'BKASH' ? 'bkash-pay-btn' : 'btn-primary'}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="spinner-small"></div>
              ) : paymentMethod === 'BKASH' ? (
                <>
                  <svg viewBox="0 0 40 40" width="20" height="20" style={{ marginRight: 8 }}>
                    <rect x="2" y="2" width="36" height="36" rx="8" fill="white" />
                    <text x="20" y="28" textAnchor="middle" fill="#E2136E" fontSize="22" fontWeight="bold" fontFamily="Arial">b</text>
                  </svg>
                  Pay with bKash — ৳{total.toLocaleString()}
                </>
              ) : (
                'Place Order'
              )}
            </button>

            <div className="trust-badge">
              <HiOutlineShieldCheck />
              <span>Secure Encrypted Checkout</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
