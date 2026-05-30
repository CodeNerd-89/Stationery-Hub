import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { HiOutlineLockClosed, HiOutlineCheckCircle } from 'react-icons/hi';
import './VerifyOTP.css';
import './Auth.css'; // Shared auth styles

const VerifyOTP = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get('email') || '';
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isError, setIsError] = useState(false);
  
  const inputRefs = useRef([]);

  useEffect(() => {
    if (!email) {
      navigate('/login');
    }
  }, [email, navigate]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const handleChange = (index, value) => {
    if (isNaN(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setIsError(false);

    // Auto-focus next
    if (value !== '' && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6).split('');
    if (pastedData.some(isNaN)) return;
    
    const newOtp = [...otp];
    pastedData.forEach((char, idx) => {
      if (idx < 6) newOtp[idx] = char;
    });
    setOtp(newOtp);
    
    // Focus last filled input
    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[focusIndex].focus();
  };

  const handleResend = async () => {
    try {
      setIsLoading(true);
      await authAPI.resendOTP({ email });
      toast.success('New OTP sent to your email');
      setTimeLeft(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0].focus();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to resend OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const otpString = otp.join('');
    
    if (otpString.length !== 6) {
      setIsError(true);
      toast.error('Please enter the complete 6-digit code');
      return;
    }

    try {
      setIsLoading(true);
      await authAPI.verifyOTP({ email, otp: otpString });
      
      setIsSuccess(true);
      toast.success('Email verified successfully!');
      
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setIsError(true);
      toast.error(err.response?.data?.error || 'Verification failed');
      // Shake animation class is triggered by isError state
      setTimeout(() => setIsError(false), 500); // Remove class after animation
    } finally {
      setIsLoading(false);
    }
  };

  const maskEmail = (emailStr) => {
    if (!emailStr) return '';
    const [name, domain] = emailStr.split('@');
    if (!name || !domain) return emailStr;
    const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : name;
    return `${maskedName}@${domain}`;
  };

  if (isSuccess) {
    return (
      <div className="auth-page">
        <div className="auth-container success-container">
          <div className="success-icon-wrapper scale-in">
            <HiOutlineCheckCircle className="success-icon" />
          </div>
          <h2 className="success-title">Verified Successfully!</h2>
          <p className="success-message">Your email has been verified. Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container otp-specific-container">
        
        {/* Left Side - Visual */}
        <div className="auth-visual">
          <div className="visual-content">
            <div className="visual-icon">
              <HiOutlineLockClosed />
            </div>
            <h2>Secure Verification</h2>
            <p>We've sent a 6-digit verification code to your email. This helps us keep your account secure.</p>
            <div className="visual-features">
              <div className="feature">
                <span className="feature-dot"></span>
                <span>Code expires in 5 minutes</span>
              </div>
              <div className="feature">
                <span className="feature-dot"></span>
                <span>Do not share this code</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="auth-form-side">
          <div className="auth-form-wrapper">
            <div className="auth-header">
              <h1>Enter OTP</h1>
              <p className="auth-subtitle">
                Sent to <strong className="highlight-text">{maskEmail(email)}</strong>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className={`otp-container ${isError ? 'shake' : ''}`}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => inputRefs.current[index] = el}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    className="otp-input"
                    autoFocus={index === 0}
                    disabled={isLoading}
                  />
                ))}
              </div>

              <button 
                type="submit" 
                className="btn btn-primary auth-btn"
                disabled={isLoading || otp.join('').length !== 6}
              >
                {isLoading ? <div className="spinner-small"></div> : 'Verify Email'}
              </button>

              <div className="otp-footer">
                {timeLeft > 0 ? (
                  <p className="otp-timer">Resend code in <span>00:{timeLeft.toString().padStart(2, '0')}</span></p>
                ) : (
                  <button 
                    type="button" 
                    className="resend-btn"
                    onClick={handleResend}
                    disabled={isLoading}
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VerifyOTP;
