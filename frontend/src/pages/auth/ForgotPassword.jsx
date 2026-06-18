import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeOff, HiOutlineCheck, HiOutlineArrowLeft } from 'react-icons/hi';
import './Auth.css';


const ForgotPassword = () => {
  const [step, setStep] = useState(1); // 1=email, 2=otp, 3=newPassword
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const otpRefs = useRef([]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Redirect after success
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => navigate('/login'), 3000);
      return () => clearTimeout(timer);
    }
  }, [success, navigate]);

  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!email) { toast.error('Please enter your email'); return; }
    setLoading(true);
    try {
      await authAPI.forgotPassword({ email });
      toast.success('Reset code sent to your email!');
      setStep(2);
      setCountdown(600); // 10 minutes
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/^\d$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      otpRefs.current[5]?.focus();
      e.preventDefault();
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otpString = otp.join('');
    if (otpString.length !== 6) { toast.error('Please enter the 6-digit code'); return; }
    setLoading(true);
    try {
      await authAPI.verifyResetOTP({ email, otp: otpString });
      toast.success('Code verified!');
      setStep(3);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 540) { toast.error('Please wait before requesting a new code'); return; }
    setLoading(true);
    try {
      await authAPI.forgotPassword({ email });
      toast.success('New reset code sent!');
      setCountdown(600);
      setOtp(['', '', '', '', '', '']);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) { toast.error('Please fill in all fields'); return; }
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      await authAPI.resetPassword({ email, otp: otp.join(''), newPassword });
      toast.success('Password reset successfully!');
      setSuccess(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-visual">
            <div className="auth-visual-content">
              <div className="auth-visual-icon">🔒</div>
              <h1>Password Recovery</h1>
              <p>Don't worry, we'll help you get back in</p>
            </div>
          </div>
          <div className="auth-form-container">
            <div className="auth-form-header" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
              <h2>Password Reset Complete</h2>
              <p>Your password has been reset successfully. Redirecting to login...</p>
            </div>
            <Link to="/login" className="btn btn-primary btn-lg auth-submit" style={{ textAlign: 'center', textDecoration: 'none', display: 'block', marginTop: 24 }}>Go to Login</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-visual">
          <div className="auth-visual-content">
            <div className="auth-visual-icon">🔒</div>
            <h1>Password Recovery</h1>
            <p>Don't worry, we'll help you get back in</p>
            <div className="auth-visual-features">
              <div className="feature-item">✓ Secure OTP verification</div>
              <div className="feature-item">✓ Email-based recovery</div>
              <div className="feature-item">✓ Reset in minutes</div>
            </div>
          </div>
        </div>

        <div className="auth-form-container">
          {/* Step indicator */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{
                width: s === step ? 32 : 10,
                height: 10,
                borderRadius: 5,
                background: s <= step ? 'var(--primary-500)' : 'var(--gray-200)',
                transition: 'all 0.3s ease',
              }} />
            ))}
          </div>

          {step === 1 && (
            <>
              <div className="auth-form-header">
                <h2>Forgot Password?</h2>
                <p>Enter your email and we'll send you a reset code</p>
              </div>
              <form onSubmit={handleSendCode} className="auth-form">
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <div className="input-with-icon">
                    <HiOutlineMail className="input-icon" />
                    <input
                      type="email"
                      className="form-input"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
                  {loading ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : 'Send Reset Code'}
                </button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <div className="auth-form-header">
                <h2>Enter Reset Code</h2>
                <p>We sent a 6-digit code to <strong>{email}</strong></p>
              </div>
              <form onSubmit={handleVerifyOtp} className="auth-form">
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, margin: '16px 0 24px' }}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => otpRefs.current[i] = el}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      onPaste={i === 0 ? handleOtpPaste : undefined}
                      style={{
                        width: 48, height: 56, textAlign: 'center', fontSize: '1.5rem',
                        fontWeight: 700, border: '2px solid var(--gray-200)', borderRadius: 12,
                        outline: 'none', transition: 'border-color 0.2s',
                        borderColor: digit ? 'var(--primary-500)' : 'var(--gray-200)',
                        color: 'var(--primary-600)',
                      }}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>
                {countdown > 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem', marginBottom: 16 }}>
                    Code expires in <strong style={{ color: countdown < 60 ? 'var(--danger-500)' : 'var(--primary-500)' }}>{formatTime(countdown)}</strong>
                  </p>
                )}
                <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
                  {loading ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : 'Verify Code'}
                </button>
                <button type="button" onClick={handleResendCode} disabled={loading || countdown > 540}
                  style={{ background: 'none', border: 'none', color: 'var(--primary-500)', cursor: 'pointer', fontSize: '0.875rem', marginTop: 12, textAlign: 'center', width: '100%' }}>
                  Didn't receive the code? Resend
                </button>
              </form>
            </>
          )}

          {step === 3 && (
            <>
              <div className="auth-form-header">
                <h2>Set New Password</h2>
                <p>Choose a strong password for your account</p>
              </div>
              <form onSubmit={handleResetPassword} className="auth-form">
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <div className="input-with-icon">
                    <HiOutlineLockClosed className="input-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      autoFocus
                    />
                    <button type="button" className="input-icon-right" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <HiOutlineEyeOff /> : <HiOutlineEye />}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <div className="input-with-icon">
                    <HiOutlineCheck className="input-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
                  {loading ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : 'Reset Password'}
                </button>
              </form>
            </>
          )}

          <p className="auth-footer">
            <Link to="/login"><HiOutlineArrowLeft style={{ verticalAlign: 'middle', marginRight: 4 }} />Back to Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
