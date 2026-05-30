import { useState, useEffect } from 'react';
import { dashboardAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlineSearch, HiOutlineX } from 'react-icons/hi';

const roleBadge = (r) => ({ ADMIN: 'badge-danger', STAFF: 'badge-info', CUSTOMER: 'badge-gray' }[r] || 'badge-gray');

const AdminUsers = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [roleModal, setRoleModal] = useState(null);
  const [newRole, setNewRole] = useState('');

  useEffect(() => { fetchUsers(); }, [search, filterRole, page]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await dashboardAPI.getUsers({ search: search || undefined, role: filterRole || undefined, page, limit: 20 });
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err) { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  const handleRoleChange = async () => {
    if (!roleModal || !newRole) return;
    try {
      await dashboardAPI.updateUserRole(roleModal.id, newRole);
      toast.success(`Role updated to ${newRole}`);
      setRoleModal(null);
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update role'); }
  };

  const handleDelete = async (u) => {
    if (u.id === currentUser?.id) { toast.error("You can't delete your own account"); return; }
    if (!confirm(`Delete user ${u.name} (${u.email})?`)) return;
    try { await dashboardAPI.deleteUser(u.id); toast.success('User deleted'); fetchUsers(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="page-header">
        <div><h1 className="page-title">User Management</h1><p className="page-subtitle">Manage user accounts and roles • {pagination.total || 0} total users</p></div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 250 }}>
          <HiOutlineSearch className="search-icon" />
          <input type="text" placeholder="Search by name or email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="form-select" value={filterRole} onChange={(e) => { setFilterRole(e.target.value); setPage(1); }} style={{ maxWidth: 160 }}>
          <option value="">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="STAFF">Staff</option>
          <option value="CUSTOMER">Customer</option>
        </select>
      </div>

      {loading ? <div className="loading-screen"><div className="spinner" /><p>Loading users...</p></div> : users.length > 0 ? (
        <>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Verified</th><th>Phone</th><th>Joined</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.name}</strong>{u.id === currentUser?.id && <span style={{ fontSize: '0.6875rem', color: 'var(--primary-500)', marginLeft: 6 }}>(You)</span>}</td>
                    <td style={{ fontSize: '0.8125rem' }}>{u.email}</td>
                    <td><span className={`badge ${roleBadge(u.role)}`}>{u.role}</span></td>
                    <td><span className={`badge ${u.emailVerified ? 'badge-success' : 'badge-warning'}`}>{u.emailVerified ? 'Yes' : 'No'}</span></td>
                    <td style={{ fontSize: '0.8125rem' }}>{u.phone || '-'}</td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setRoleModal(u); setNewRole(u.role); }}>Change Role</button>
                        {u.id !== currentUser?.id && <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(u)} style={{ color: 'var(--danger-500)' }}>Delete</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination.pages > 1 && (
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
                <button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </>
      ) : (
        <div className="card"><div className="empty-state"><div className="empty-state-icon">👤</div><h3>No users found</h3></div></div>
      )}

      {roleModal && (
        <div className="modal-overlay" onClick={() => setRoleModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-header"><h2>Change Role</h2><button className="btn btn-ghost btn-icon" onClick={() => setRoleModal(null)}><HiOutlineX /></button></div>
            <div className="modal-body">
              <p style={{ marginBottom: 16 }}>Change role for <strong>{roleModal.name}</strong></p>
              <select className="form-select" value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{ width: '100%' }}>
                <option value="ADMIN">Admin</option>
                <option value="STAFF">Staff</option>
                <option value="CUSTOMER">Customer</option>
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRoleModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRoleChange}>Update Role</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
