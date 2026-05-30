import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineUser, HiOutlinePhone, HiOutlineEye, HiOutlineEyeOff } from 'react-icons/hi';
import './Auth.css';

const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', phone: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, email, password, confirmPassword, phone } = form;

    if (!name || !email || !password) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await register({ name, email, password, phone });
      toast.success('Account created successfully!');
      navigate('/catalog');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-visual">
          <div className="auth-visual-content">
            <div className="auth-visual-icon">🚀</div>
            <h1>Join Stationery Hub</h1>
            <p>Create your account and start browsing our complete stationery catalog</p>
            <div className="auth-visual-features">
              <div className="feature-item">✓ Free account</div>
              <div className="feature-item">✓ Quick quotations</div>
              <div className="feature-item">✓ Order tracking</div>
            </div>
          </div>
        </div>

        <div className="auth-form-container">
          <div className="auth-form-header">
            <h2>Create Account</h2>
            <p>Fill in your details to get started</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <div className="input-with-icon">
                <HiOutlineUser className="input-icon" />
                <input type="text" name="name" className="form-input" placeholder="Your full name" value={form.name} onChange={handleChange} required id="register-name" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email *</label>
              <div className="input-with-icon">
                <HiOutlineMail className="input-icon" />
                <input type="email" name="email" className="form-input" placeholder="you@example.com" value={form.email} onChange={handleChange} required id="register-email" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Phone (optional)</label>
              <div className="input-with-icon">
                <HiOutlinePhone className="input-icon" />
                <input type="tel" name="phone" className="form-input" placeholder="+880 1XXXXXXXXX" value={form.phone} onChange={handleChange} id="register-phone" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Password *</label>
                <div className="input-with-icon">
                  <HiOutlineLockClosed className="input-icon" />
                  <input type={showPassword ? 'text' : 'password'} name="password" className="form-input" placeholder="Min 6 characters" value={form.password} onChange={handleChange} required id="register-password" />
                  <button type="button" className="input-icon-right" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <HiOutlineEyeOff /> : <HiOutlineEye />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password *</label>
                <div className="input-with-icon">
                  <HiOutlineLockClosed className="input-icon" />
                  <input type="password" name="confirmPassword" className="form-input" placeholder="Repeat password" value={form.confirmPassword} onChange={handleChange} required id="register-confirm" />
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading} id="register-submit">
              {loading ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : 'Create Account'}
            </button>
          </form>

          <p className="auth-footer">
            Already have an account? <Link to="/login">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
