import { useState, useEffect } from 'react';
import { categoriesAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX } from 'react-icons/hi';

const AdminCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', imageUrl: '', sortOrder: 0 });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const { data } = await categoriesAPI.getAll();
      setCategories(data.categories);
    } catch (err) { toast.error('Failed to load categories'); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', imageUrl: '', sortOrder: categories.length + 1 }); setShowModal(true); };
  const openEdit = (cat) => { setEditing(cat); setForm({ name: cat.name, description: cat.description || '', imageUrl: cat.imageUrl || '', sortOrder: cat.sortOrder }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) { toast.error('Category name is required'); return; }
    setSaving(true);
    try {
      if (editing) { await categoriesAPI.update(editing.id, form); toast.success('Category updated!'); }
      else { await categoriesAPI.create(form); toast.success('Category created!'); }
      setShowModal(false); fetchCategories();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (cat) => {
    try { await categoriesAPI.delete(cat.id); toast.success('Category deleted'); setDeleteTarget(null); fetchCategories(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading categories...</p></div>;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="page-header">
        <div><h1 className="page-title">Categories</h1><p className="page-subtitle">Manage product categories • {categories.length} total</p></div>
        <button className="btn btn-primary" onClick={openCreate}><HiOutlinePlus /> Add Category</button>
      </div>

      {categories.length > 0 ? (
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Name</th><th>Slug</th><th>Description</th><th>Products</th><th>Order</th><th>Actions</th></tr></thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id}>
                  <td><strong>{cat.name}</strong></td>
                  <td><code style={{ fontSize: '0.8125rem', background: 'var(--gray-100)', padding: '2px 8px', borderRadius: 4 }}>{cat.slug}</code></td>
                  <td style={{ color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.description || '-'}</td>
                  <td><span className="badge badge-primary">{cat._count?.products || 0}</span></td>
                  <td>{cat.sortOrder}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-icon" onClick={() => openEdit(cat)} title="Edit"><HiOutlinePencil /></button>
                      <button className="btn btn-ghost btn-icon" onClick={() => setDeleteTarget(cat)} title="Delete" style={{ color: 'var(--danger-500)' }}><HiOutlineTrash /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card"><div className="empty-state"><div className="empty-state-icon">🏷️</div><h3>No categories yet</h3><p>Create your first product category.</p></div></div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header"><h2>{editing ? 'Edit Category' : 'Add Category'}</h2><button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><HiOutlineX /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Name *</label><input type="text" className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="form-group"><label className="form-label">Description</label><textarea className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows="2" /></div>
                <div className="form-group"><label className="form-label">Image URL</label><input type="url" className="form-input" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." /></div>
                <div className="form-group"><label className="form-label">Sort Order</label><input type="number" className="form-input" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} /></div>
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
              <h3>Delete Category?</h3>
              <p style={{ color: 'var(--text-secondary)', margin: '8px 0 24px', fontSize: '0.9375rem' }}><strong>{deleteTarget.name}</strong> {(deleteTarget._count?.products || 0) > 0 ? `has ${deleteTarget._count.products} products. They will become uncategorized.` : 'will be permanently deleted.'}</p>
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

export default AdminCategories;
