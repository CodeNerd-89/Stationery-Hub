import { useState, useEffect } from 'react';
import { customersAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineSearch, HiOutlineX } from 'react-icons/hi';

const AdminCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ contactPerson: '', companyName: '', phone: '', email: '', address: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => { fetchCustomers(); }, [search, page]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data } = await customersAPI.getAll({ search: search || undefined, page, limit: 20 });
      setCustomers(data.customers);
      setPagination(data.pagination);
    } catch (err) { toast.error('Failed to load customers'); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditing(null); setForm({ contactPerson: '', companyName: '', phone: '', email: '', address: '', notes: '' }); setShowModal(true); };
  const openEdit = (c) => { setEditing(c); setForm({ contactPerson: c.contactPerson, companyName: c.companyName || '', phone: c.phone || '', email: c.email || '', address: c.address || '', notes: c.notes || '' }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.contactPerson) { toast.error('Contact person is required'); return; }
    setSaving(true);
    try {
      if (editing) { await customersAPI.update(editing.id, form); toast.success('Customer updated!'); }
      else { await customersAPI.create(form); toast.success('Customer created!'); }
      setShowModal(false); fetchCustomers();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (c) => {
    try { await customersAPI.delete(c.id); toast.success('Customer deleted'); setDeleteTarget(null); fetchCustomers(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="page-header">
        <div><h1 className="page-title">Customers</h1><p className="page-subtitle">Manage your customer database • {pagination.total || 0} total</p></div>
        <button className="btn btn-primary" onClick={openCreate}><HiOutlinePlus /> Add Customer</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div className="search-bar" style={{ flex: 1 }}>
          <HiOutlineSearch className="search-icon" />
          <input type="text" placeholder="Search by name, company, phone..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      {loading ? <div className="loading-screen"><div className="spinner" /><p>Loading customers...</p></div> : customers.length > 0 ? (
        <>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Contact Person</th><th>Company</th><th>Phone</th><th>Email</th><th>Quotations</th><th>Orders</th><th>Actions</th></tr></thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.contactPerson}</strong></td>
                    <td>{c.companyName || <span style={{ color: 'var(--text-tertiary)' }}>-</span>}</td>
                    <td>{c.phone || '-'}</td>
                    <td style={{ fontSize: '0.8125rem' }}>{c.email || '-'}</td>
                    <td><span className="badge badge-info">{c._count?.quotations || 0}</span></td>
                    <td><span className="badge badge-success">{c._count?.orders || 0}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon" onClick={() => openEdit(c)}><HiOutlinePencil /></button>
                        <button className="btn btn-ghost btn-icon" onClick={() => setDeleteTarget(c)} style={{ color: 'var(--danger-500)' }}><HiOutlineTrash /></button>
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
        <div className="card"><div className="empty-state"><div className="empty-state-icon">👥</div><h3>No customers found</h3><p>{search ? 'Try a different search term.' : 'Add your first customer.'}</p></div></div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header"><h2>{editing ? 'Edit Customer' : 'Add Customer'}</h2><button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><HiOutlineX /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Contact Person *</label><input type="text" className="form-input" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} required /></div>
                <div className="form-group"><label className="form-label">Company Name</label><input type="text" className="form-input" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group"><label className="form-label">Phone</label><input type="tel" className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                </div>
                <div className="form-group"><label className="form-label">Address</label><textarea className="form-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows="2" /></div>
                <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows="2" /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>⚠️</div>
              <h3>Delete Customer?</h3>
              <p style={{ color: 'var(--text-secondary)', margin: '8px 0 24px' }}><strong>{deleteTarget.contactPerson}</strong> will be permanently deleted.</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => handleDelete(deleteTarget)}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCustomers;
