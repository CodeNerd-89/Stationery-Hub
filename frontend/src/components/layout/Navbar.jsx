import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import {
  HiOutlineMenu,
  HiOutlineX,
  HiOutlineLogout,
  HiOutlineShoppingCart,
  HiOutlineShoppingBag,
  HiOutlineHome,
  HiOutlineViewGrid,
  HiOutlineUser,
  HiOutlineDocumentText,
} from 'react-icons/hi';
import './Navbar.css';

const Navbar = ({ onMenuToggle }) => {
  const { user, logout, isAdmin, isStaff, isAdminOrStaff } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate('/login');
  };

  const handleMenuClick = () => {
    // If we're in admin layout (has onMenuToggle), toggle admin sidebar
    if (onMenuToggle) {
      onMenuToggle();
    } else {
      // Otherwise toggle mobile navigation menu
      setMobileMenuOpen(!mobileMenuOpen);
    }
  };

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <nav className="navbar">
        <div className="navbar-left">
          <button className="navbar-menu-btn" onClick={handleMenuClick}>
            {mobileMenuOpen ? <HiOutlineX /> : <HiOutlineMenu />}
          </button>
          <Link to="/" className="navbar-brand">
            <span className="brand-icon">📦</span>
            <span className="brand-text">Stationery Hub</span>
          </Link>
        </div>

        <div className="navbar-center">
          <Link to="/catalog" className={`nav-link ${location.pathname === '/catalog' ? 'nav-link-active' : ''}`}>
            <HiOutlineShoppingBag /> Browse Products
          </Link>
          {user && !isAdminOrStaff && (
            <Link to="/dashboard" className={`nav-link ${location.pathname === '/dashboard' ? 'nav-link-active' : ''}`}>
              <HiOutlineHome /> My Dashboard
            </Link>
          )}
        </div>

        <div className="navbar-right">
          {/* Cart icon */}
          <Link to="/cart" className="navbar-cart" title="Cart">
            <HiOutlineShoppingCart />
            {totalItems > 0 && <span className="navbar-cart-badge">{totalItems}</span>}
          </Link>

          {user ? (
            <div className="navbar-user">
              <div className="user-info">
                <span className="user-name">{user.name}</span>
                <span className="user-role">{user.role}</span>
              </div>
              <div className="user-avatar">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout} title="Logout">
                <HiOutlineLogout />
              </button>
            </div>
          ) : (
            <div className="navbar-actions">
              <Link to="/login" className="btn btn-ghost btn-sm">Log In</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Sign Up</Link>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Navigation Menu (only when not in admin layout) */}
      {!onMenuToggle && mobileMenuOpen && (
        <>
          <div className="mobile-menu-overlay" onClick={closeMenu} />
          <div className="mobile-menu">
            <div className="mobile-menu-header">
              <span className="mobile-menu-title">Menu</span>
              <button className="btn btn-ghost btn-icon" onClick={closeMenu}>
                <HiOutlineX />
              </button>
            </div>

            <nav className="mobile-menu-nav">
              <Link to="/catalog" className="mobile-menu-link" onClick={closeMenu}>
                <HiOutlineShoppingBag /> Browse Products
              </Link>
              <Link to="/cart" className="mobile-menu-link" onClick={closeMenu}>
                <HiOutlineShoppingCart /> Cart
                {totalItems > 0 && <span className="mobile-menu-badge">{totalItems}</span>}
              </Link>
              {user && !isAdminOrStaff && (
                <>
                  <Link to="/dashboard" className="mobile-menu-link" onClick={closeMenu}>
                    <HiOutlineHome /> My Dashboard
                  </Link>
                  <Link to="/my-orders" className="mobile-menu-link" onClick={closeMenu}>
                    <HiOutlineShoppingBag /> My Orders
                  </Link>
                </>
              )}

              {isAdminOrStaff && (
                <>
                  <div className="mobile-menu-divider" />
                  <span className="mobile-menu-section">Admin Panel</span>
                  <Link to="/admin" className="mobile-menu-link" onClick={closeMenu}>
                    <HiOutlineHome /> Dashboard
                  </Link>
                  <Link to="/admin/products" className="mobile-menu-link" onClick={closeMenu}>
                    <HiOutlineViewGrid /> Products
                  </Link>
                  <Link to="/admin/quotations" className="mobile-menu-link" onClick={closeMenu}>
                    <HiOutlineDocumentText /> Quotations
                  </Link>
                  <Link to="/admin/users" className="mobile-menu-link" onClick={closeMenu}>
                    <HiOutlineUser /> Users
                  </Link>
                </>
              )}

              {!user && (
                <>
                  <div className="mobile-menu-divider" />
                  <Link to="/login" className="mobile-menu-link" onClick={closeMenu}>
                    <HiOutlineUser /> Log In
                  </Link>
                  <Link to="/register" className="mobile-menu-link mobile-menu-link-primary" onClick={closeMenu}>
                    <HiOutlineUser /> Sign Up
                  </Link>
                </>
              )}
            </nav>

            {user && (
              <div className="mobile-menu-footer">
                <div className="mobile-menu-user">
                  <div className="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <span className="mobile-user-name">{user.name}</span>
                    <span className="mobile-user-role">{user.role}</span>
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ color: 'var(--danger-500)' }}>
                  <HiOutlineLogout /> Logout
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};

export default Navbar;
