import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  HiOutlineHome,
  HiOutlineCube,
  HiOutlineTag,
  HiOutlineUsers,
  HiOutlineDocumentText,
  HiOutlineClipboardList,
  HiOutlineDocumentSearch,
  HiOutlineChartBar,
  HiOutlineCog,
  HiOutlineX,
} from 'react-icons/hi';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose }) => {
  const { isAdmin, isStaff } = useAuth();

  const adminLinks = [
    { to: '/admin', icon: <HiOutlineHome />, label: 'Dashboard', end: true },
    { to: '/admin/products', icon: <HiOutlineCube />, label: 'Products' },
    { to: '/admin/categories', icon: <HiOutlineTag />, label: 'Categories' },
    { to: '/admin/customers', icon: <HiOutlineUsers />, label: 'Customers' },
    { to: '/admin/quotations', icon: <HiOutlineDocumentText />, label: 'Quotations' },
    { to: '/admin/orders', icon: <HiOutlineClipboardList />, label: 'Orders' },
    { to: '/admin/scan', icon: <HiOutlineDocumentSearch />, label: 'Scan PO' },
  ];

  const adminOnlyLinks = [
    { to: '/admin/users', icon: <HiOutlineUsers />, label: 'Users' },
    { to: '/admin/analytics', icon: <HiOutlineChartBar />, label: 'Analytics' },
  ];

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <h3>
            {isAdmin ? '🛡️ Admin Panel' : '📋 Staff Panel'}
          </h3>
          <button className="sidebar-close" onClick={onClose}>
            <HiOutlineX />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <span className="nav-section-title">Main</span>
            {adminLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <span className="sidebar-link-icon">{link.icon}</span>
                <span>{link.label}</span>
              </NavLink>
            ))}
          </div>

          {isAdmin && (
            <div className="nav-section">
              <span className="nav-section-title">Admin Only</span>
              {adminOnlyLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={onClose}
                >
                  <span className="sidebar-link-icon">{link.icon}</span>
                  <span>{link.label}</span>
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <p>Stationery Hub v1.0</p>
          <p>Basundhara, Dhaka</p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
