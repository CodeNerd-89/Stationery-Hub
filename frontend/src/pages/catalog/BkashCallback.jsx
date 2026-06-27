import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { checkoutAPI } from '../../services/api';
import toast from 'react-hot-toast';
import './BkashCallback.css';

const BkashCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [status, setStatus] = useState('processing'); // processing | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const hasExecuted = useRef(false);

  useEffect(() => {
    if (hasExecuted.current) return;
    hasExecuted.current = true;

    const paymentID = searchParams.get('paymentID');
    const bkashStatus = searchParams.get('status');

    if (!paymentID || bkashStatus !== 'success') {
      setStatus('error');
      setErrorMsg(
        bkashStatus === 'cancel'
          ? 'Payment was cancelled.'
          : bkashStatus === 'failure'
          ? 'Payment failed. Please try again.'
          : 'Invalid payment response.'
      );
      return;
    }

    // Retrieve saved order data from sessionStorage
    const savedOrderData = sessionStorage.getItem('bkash_order_data');
    if (!savedOrderData) {
      setStatus('error');
      setErrorMsg('Order data not found. Please try again from checkout.');
      return;
    }

    const orderData = JSON.parse(savedOrderData);

    const executePayment = async () => {
      try {
        const { data } = await checkoutAPI.bkashExecute({
          paymentID,
          ...orderData,
        });

        sessionStorage.removeItem('bkash_order_data');
        clearCart(true);
        setStatus('success');
        toast.success('🎉 Payment successful! Order placed.');

        setTimeout(() => {
          navigate(`/order-confirmation/${data.order.id}`);
        }, 1500);
      } catch (err) {
        setStatus('error');
        setErrorMsg(err.response?.data?.error || 'Failed to execute payment.');
        sessionStorage.removeItem('bkash_order_data');
      }
    };

    executePayment();
  }, [searchParams, navigate, clearCart]);

  return (
    <div className="bkash-callback-page">
      <div className="bkash-callback-card">
        {/* bKash Logo */}
        <div className="bkash-callback-logo">
          <svg viewBox="0 0 100 40" className="bkash-logo-svg">
            <rect x="0" y="5" width="30" height="30" rx="6" fill="#E2136E" />
            <text x="15" y="26" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="Arial">b</text>
            <text x="48" y="28" fill="#E2136E" fontSize="22" fontWeight="bold" fontFamily="Arial">Kash</text>
          </svg>
        </div>

        {status === 'processing' && (
          <div className="bkash-callback-status">
            <div className="bkash-processing-spinner">
              <div className="bkash-spinner-ring"></div>
              <div className="bkash-spinner-icon">৳</div>
            </div>
            <h2>Processing Payment</h2>
            <p>Please wait while we confirm your bKash payment...</p>
            <div className="bkash-processing-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="bkash-callback-status bkash-success">
            <div className="bkash-success-check">
              <svg viewBox="0 0 52 52">
                <circle cx="26" cy="26" r="25" fill="none" stroke="#22c55e" strokeWidth="2" />
                <path fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M14 27l8 8 16-16" />
              </svg>
            </div>
            <h2>Payment Successful!</h2>
            <p>Redirecting to your order confirmation...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="bkash-callback-status bkash-error">
            <div className="bkash-error-icon">
              <svg viewBox="0 0 52 52">
                <circle cx="26" cy="26" r="25" fill="none" stroke="#ef4444" strokeWidth="2" />
                <path fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" d="M18 18l16 16M34 18l-16 16" />
              </svg>
            </div>
            <h2>Payment Failed</h2>
            <p>{errorMsg}</p>
            <button className="btn btn-primary bkash-retry-btn" onClick={() => navigate('/checkout')}>
              Return to Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BkashCallback;
