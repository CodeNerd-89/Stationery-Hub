import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { quotationsAPI, productsAPI, customersAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineSearch, HiOutlineSave, HiOutlinePaperAirplane, HiOutlineX } from 'react-icons/hi';
import './QuotationBuilder.css';

const QuotationBuilder = () => {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const navigate = useNavigate();

  // Data
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);

  // Product search
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // New customer inline
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ contactPerson: '', companyName: '', phone: '', email: '' });

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);

  useEffect(() => {
    fetchCustomers();
    if (editId) loadQuotation();
  }, [editId]);

  const fetchCustomers = async () => {
    try {
      const { data } = await customersAPI.getAll({ limit: 100 });
      setCustomers(data.customers);
    } catch (err) { console.error(err); }
  };

  const loadQuotation = async () => {
    try {
      const { data } = await quotationsAPI.getById(editId);
      const q = data.quotation;
      setSelectedCustomer(q.customerId || '');
      setNotes(q.notes || '');
      setValidUntil(q.validUntil ? q.validUntil.slice(0, 10) : '');
      setDiscountAmount(Number(q.discountAmount) || 0);
      setItems(q.items.map(i => ({
        id: crypto.randomUUID(),
        productId: i.productId,
        productName: i.productName,
        sku: i.product?.sku || '',
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        discountPercent: Number(i.discountPercent),
      })));
    } catch (err) { toast.error('Failed to load quotation'); }
    finally { setLoading(false); }
  };

  // Debounced product search
  useEffect(() => {
    if (productSearch.length < 2) { setProductResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const { data } = await productsAPI.getAll({ search: productSearch, limit: 8 });
        setProductResults(data.products);
        setShowProductDropdown(true);
      } catch (err) { console.error(err); }
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const addProductItem = (product) => {
    // Check if already added
    if (items.find(i => i.productId === product.id)) {
      toast.error('Product already added');
      return;
    }
    setItems([...items, {
      id: crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: 1,
      unitPrice: Number(product.price),
      discountPercent: 0,
    }]);
    setProductSearch('');
    setShowProductDropdown(false);
  };

  const addManualItem = () => {
    setItems([...items, {
      id: crypto.randomUUID(),
      productId: null,
      productName: '',
      sku: '',
      quantity: 1,
      unitPrice: 0,
      discountPercent: 0,
    }]);
  };

  const updateItem = (id, field, value) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removeItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const lineTotal = (item) => {
    return item.quantity * item.unitPrice * (1 - item.discountPercent / 100);
  };

  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const total = subtotal - (discountAmount || 0);

  const handleCreateCustomer = async () => {
    if (!newCustomer.contactPerson) { toast.error('Contact person is required'); return; }
    try {
      const { data } = await customersAPI.create(newCustomer);
      toast.success('Customer created!');
      await fetchCustomers();
      setSelectedCustomer(data.customer.id);
      setShowNewCustomer(false);
      setNewCustomer({ contactPerson: '', companyName: '', phone: '', email: '' });
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to create customer'); }
  };

  const handleSave = async (status = 'DRAFT') => {
    if (items.length === 0) { toast.error('Add at least one item'); return; }
    if (items.some(i => !i.productName)) { toast.error('All items must have a name'); return; }

    setSaving(true);
    try {
      const payload = {
        customerId: selectedCustomer || null,
        items: items.map(i => ({
          productId: i.productId,
          productName: i.productName,
          quantity: parseInt(i.quantity),
          unitPrice: parseFloat(i.unitPrice),
          discountPercent: parseFloat(i.discountPercent) || 0,
        })),
        notes: notes || null,
        validUntil: validUntil || null,
        discountAmount: parseFloat(discountAmount) || 0,
      };

      if (status === 'SENT') payload.status = 'SENT';

      if (editId) {
        await quotationsAPI.update(editId, payload);
        toast.success('Quotation updated!');
      } else {
        await quotationsAPI.create(payload);
        toast.success(status === 'SENT' ? 'Quotation sent!' : 'Quotation saved as draft!');
      }
      navigate('/admin/quotations');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading quotation...</p></div>;

  return (
    <div className="qb-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{editId ? 'Edit Quotation' : 'New Quotation'}</h1>
          <p className="page-subtitle">Build your quotation by adding products and setting prices</p>
        </div>
      </div>

      <div className="qb-layout">
        {/* Left: Main builder */}
        <div className="qb-main">
          {/* Product Search */}
          <div className="card">
            <div className="card-header"><h3 className="card-title">Add Products</h3></div>
            <div className="qb-product-search">
              <div className="search-bar" style={{ flex: 1 }}>
                <HiOutlineSearch className="search-icon" />
                <input type="text" placeholder="Search products by name or SKU..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} onFocus={() => productResults.length > 0 && setShowProductDropdown(true)} />
              </div>
              <button className="btn btn-secondary" onClick={addManualItem}><HiOutlinePlus /> Manual Item</button>
            </div>

            {showProductDropdown && productResults.length > 0 && (
              <div className="qb-dropdown">
                {productResults.map(p => (
                  <div key={p.id} className="qb-dropdown-item" onClick={() => addProductItem(p)}>
                    <div><strong>{p.name}</strong><span className="qb-dropdown-sku">{p.sku}</span></div>
                    <div className="qb-dropdown-right">
                      <span className="qb-dropdown-price">৳{Number(p.price).toLocaleString()}</span>
                      <span className="qb-dropdown-stock">{p.stock} in stock</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header"><h3 className="card-title">Items ({items.length})</h3></div>
            {items.length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr><th>Product</th><th style={{ width: 90 }}>QTY</th><th style={{ width: 100 }}>Unit Price</th><th style={{ width: 80 }}>Disc %</th><th style={{ width: 100 }}>Line Total</th><th style={{ width: 40 }}></th></tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {item.productId ? (
                            <div><strong>{item.productName}</strong><span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{item.sku}</span></div>
                          ) : (
                            <input type="text" className="form-input" value={item.productName} onChange={(e) => updateItem(item.id, 'productName', e.target.value)} placeholder="Item name" style={{ padding: '6px 10px', fontSize: '0.875rem' }} />
                          )}
                        </td>
                        <td><input type="number" className="form-input qb-qty-input" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)} min="1" style={{ padding: '8px 10px', textAlign: 'center', fontSize: '0.875rem', fontWeight: 600 }} /></td>
                        <td><input type="number" className="form-input" value={item.unitPrice} onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} min="0" step="0.01" style={{ padding: '8px 10px', textAlign: 'right', fontSize: '0.875rem' }} /></td>
                        <td><input type="number" className="form-input" value={item.discountPercent} onChange={(e) => updateItem(item.id, 'discountPercent', parseFloat(e.target.value) || 0)} min="0" max="100" style={{ padding: '8px 10px', textAlign: 'center', fontSize: '0.875rem' }} /></td>
                        <td style={{ fontWeight: 700, textAlign: 'right' }}>৳{lineTotal(item).toLocaleString()}</td>
                        <td><button className="btn btn-ghost btn-icon" onClick={() => removeItem(item.id)} style={{ color: 'var(--danger-500)' }}><HiOutlineTrash /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 32 }}>
                <div className="empty-state-icon">📝</div>
                <h3>No items yet</h3>
                <p>Search for products above or add a manual item.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Sidebar */}
        <div className="qb-sidebar">
          {/* Customer */}
          <div className="card">
            <div className="card-header"><h3 className="card-title">Customer</h3></div>
            <select className="form-select" value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
              <option value="">Select customer (optional)</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.contactPerson}{c.companyName ? ` - ${c.companyName}` : ''}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowNewCustomer(!showNewCustomer)} style={{ fontSize: '0.8125rem' }}>
              <HiOutlinePlus /> New Customer
            </button>
            {showNewCustomer && (
              <div className="qb-new-customer">
                <input type="text" className="form-input" placeholder="Contact person *" value={newCustomer.contactPerson} onChange={(e) => setNewCustomer({ ...newCustomer, contactPerson: e.target.value })} />
                <input type="text" className="form-input" placeholder="Company name" value={newCustomer.companyName} onChange={(e) => setNewCustomer({ ...newCustomer, companyName: e.target.value })} />
                <input type="tel" className="form-input" placeholder="Phone" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
                <button className="btn btn-primary btn-sm" onClick={handleCreateCustomer} style={{ width: '100%' }}>Create Customer</button>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header"><h3 className="card-title">Details</h3></div>
            <div className="form-group">
              <label className="form-label">Valid Until</label>
              <input type="date" className="form-input" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} rows="3" placeholder="Internal notes..." />
            </div>
          </div>

          {/* Totals */}
          <div className="card qb-totals" style={{ marginTop: 16 }}>
            <div className="qb-total-row"><span>Subtotal</span><span>৳{subtotal.toLocaleString()}</span></div>
            <div className="qb-total-row">
              <span>Discount</span>
              <input type="number" className="form-input" value={discountAmount} onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)} min="0" style={{ width: 100, padding: '4px 8px', textAlign: 'right' }} />
            </div>
            <div className="qb-total-row qb-grand-total"><span>Total</span><span>৳{total.toLocaleString()}</span></div>
          </div>

          {/* Actions */}
          <div className="qb-actions">
            <button className="btn btn-secondary" onClick={() => handleSave('DRAFT')} disabled={saving} style={{ flex: 1 }}>
              <HiOutlineSave /> {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button className="btn btn-primary" onClick={() => handleSave('SENT')} disabled={saving} style={{ flex: 1 }}>
              <HiOutlinePaperAirplane /> {saving ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotationBuilder;
