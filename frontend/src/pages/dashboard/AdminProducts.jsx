import { useState, useEffect } from 'react';
import { productsAPI, categoriesAPI } from '../../services/api';
import toast from 'react-hot-toast';
import {
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineSearch,
  HiOutlineX,
} from 'react-icons/hi';
import './AdminProducts.css';

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', sku: '', categoryId: '', description: '',
    price: '', stock: '', unit: 'pc', imageUrl: '', isActive: true,
  });
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [search, filterCategory, page]);

  const fetchCategories = async () => {
    try {
      const { data } = await categoriesAPI.getAll();
      setCategories(data.categories);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data } = await productsAPI.getAllAdmin({
        search: search || undefined,
        category: filterCategory || undefined,
        page,
        limit: 20,
      });
      setProducts(data.products);
      setPagination(data.pagination);
    } catch (err) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditing(null);
    setForm({
      name: '', sku: '', categoryId: categories[0]?.id || '', description: '',
      price: '', stock: '0', unit: 'pc', imageUrl: '', isActive: true,
    });
    setShowModal(true);
  };

  const openEditModal = (product) => {
    setEditing(product);
    setForm({
      name: product.name,
      sku: product.sku,
      categoryId: product.categoryId,
      description: product.description || '',
      price: String(product.price),
      stock: String(product.stock),
      unit: product.unit,
      imageUrl: product.imageUrl || '',
      isActive: product.isActive,
    });
    setShowModal(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.sku || !form.categoryId || !form.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await productsAPI.update(editing.id, form);
        toast.success('Product updated!');
      } else {
        await productsAPI.create(form);
        toast.success('Product created!');
      }
      setShowModal(false);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product) => {
    try {
      await productsAPI.delete(product.id);
      toast.success('Product deactivated');
      setDeleteTarget(null);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const units = ['pc', 'pack', 'box', 'ream', 'set', 'roll', 'dozen'];

  return (
    <div className="admin-products-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">
            Manage your product catalog • {pagination.total || 0} total products
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal} id="add-product-btn">
          <HiOutlinePlus /> Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-bar">
          <HiOutlineSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            id="product-search"
          />
        </div>
        <select
          className="form-select"
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
          style={{ maxWidth: 220 }}
          id="category-filter"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {/* Products Table */}
      {loading ? (
        <div className="loading-screen">
          <div className="spinner" />
          <p>Loading products...</p>
        </div>
      ) : products.length > 0 ? (
        <>
          <div className="table-container">
            <table className="table" id="products-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Price (৳)</th>
                  <th>Stock</th>
                  <th>Unit</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="product-name-cell">
                        <div className="product-thumb">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} />
                          ) : (
                            <span>📦</span>
                          )}
                        </div>
                        <div>
                          <strong>{product.name}</strong>
                          {product.description && (
                            <span className="product-desc-preview">{product.description.substring(0, 50)}...</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td><code className="sku-code">{product.sku}</code></td>
                    <td>{product.category?.name || '-'}</td>
                    <td className="price-cell">৳{Number(product.price).toLocaleString()}</td>
                    <td>
                      <span className={product.stock <= 10 ? 'stock-low' : 'stock-ok'}>
                        {product.stock}
                      </span>
                    </td>
                    <td>{product.unit}</td>
                    <td>
                      <span className={`badge ${product.isActive ? 'badge-success' : 'badge-gray'}`}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="action-btns">
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => openEditModal(product)}
                          title="Edit"
                        >
                          <HiOutlinePencil />
                        </button>
                        <button
                          className="btn btn-ghost btn-icon danger-icon"
                          onClick={() => setDeleteTarget(product)}
                          title="Deactivate"
                        >
                          <HiOutlineTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
                <button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>
                  {p}
                </button>
              ))}
              <button disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <h3>No products found</h3>
            <p>
              {search || filterCategory
                ? 'Try adjusting your search or filters.'
                : 'Start by adding your first product.'}
            </p>
            {!search && !filterCategory && (
              <button className="btn btn-primary" onClick={openCreateModal} style={{ marginTop: 16 }}>
                <HiOutlinePlus /> Add Product
              </button>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Product' : 'Add New Product'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                <HiOutlineX />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Product Name *</label>
                    <input type="text" name="name" className="form-input" placeholder="e.g. A4 Paper (500 sheets)" value={form.name} onChange={handleChange} required id="product-name" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">SKU *</label>
                    <input type="text" name="sku" className="form-input" placeholder="e.g. PAP-A4-500" value={form.sku} onChange={handleChange} required id="product-sku" />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select name="categoryId" className="form-select" value={form.categoryId} onChange={handleChange} required id="product-category">
                      <option value="">Select category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <select name="unit" className="form-select" value={form.unit} onChange={handleChange} id="product-unit">
                      {units.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Price (৳) *</label>
                    <input type="number" name="price" className="form-input" placeholder="0.00" value={form.price} onChange={handleChange} required min="0" step="0.01" id="product-price" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Stock</label>
                    <input type="number" name="stock" className="form-input" placeholder="0" value={form.stock} onChange={handleChange} min="0" id="product-stock" />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea name="description" className="form-input" placeholder="Product description..." value={form.description} onChange={handleChange} rows="3" id="product-description" />
                </div>

                <div className="form-group">
                  <label className="form-label">Image URL</label>
                  <input type="url" name="imageUrl" className="form-input" placeholder="https://..." value={form.imageUrl} onChange={handleChange} id="product-image" />
                  {form.imageUrl && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <img
                        src={form.imageUrl}
                        alt="Preview"
                        style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-color)' }}
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                      />
                      <span style={{ display: 'none', fontSize: '0.8125rem', color: 'var(--danger-500)' }}>⚠️ Image failed to load. Check the URL.</span>
                    </div>
                  )}
                </div>

                <label className="checkbox-label" id="product-active">
                  <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} />
                  <span>Active (visible to customers)</span>
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving} id="save-product-btn">
                  {saving ? 'Saving...' : editing ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>⚠️</div>
              <h3 style={{ marginBottom: 8 }}>Deactivate Product?</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.9375rem' }}>
                <strong>{deleteTarget.name}</strong> will be hidden from customers. You can reactivate it later.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => handleDelete(deleteTarget)}>
                  Deactivate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProducts;
