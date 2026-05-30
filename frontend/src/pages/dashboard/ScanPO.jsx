import { useState, useRef } from 'react';
import { scanAPI, customersAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiOutlineUpload, HiOutlineDocumentSearch, HiOutlineCheck, HiOutlineX, HiOutlineChevronDown, HiOutlineChevronUp } from 'react-icons/hi';
import './ScanPO.css';

const ScanPO = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [showRawText, setShowRawText] = useState(false);

  // Quotation creation
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [creating, setCreating] = useState(false);
  const [editedItems, setEditedItems] = useState([]);

  const fileInputRef = useRef(null);
  const dropRef = useRef(null);
  const navigate = useNavigate();

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(selectedFile.type)) {
      toast.error('Only JPEG, PNG, WebP, and PDF files are allowed');
      return;
    }
    setFile(selectedFile);
    setResult(null);
    if (selectedFile.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(selectedFile));
    } else {
      setPreview(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    dropRef.current?.classList.remove('drag-over');
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    dropRef.current?.classList.add('drag-over');
  };

  const handleDragLeave = () => {
    dropRef.current?.classList.remove('drag-over');
  };

  const handleScan = async () => {
    if (!file) { toast.error('Please select a file first'); return; }
    setScanning(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await scanAPI.upload(formData);
      setResult(data);
      setEditedItems(data.matchedItems.map((item, idx) => ({
        ...item,
        id: idx,
        selectedProductId: item.matchedProduct?.id || null,
        selectedProductName: item.matchedProduct?.name || item.extractedName,
        editedQty: item.quantity,
        editedPrice: item.unitPrice,
        include: true,
      })));
      // Fetch customers for quotation creation
      const custRes = await customersAPI.getAll({ limit: 100 });
      setCustomers(custRes.data.customers);
      toast.success(`Scan complete! ${data.stats.totalExtracted} items found`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const updateEditedItem = (id, field, value) => {
    setEditedItems(items => items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const selectSuggestion = (itemId, suggestion) => {
    setEditedItems(items => items.map(item => item.id === itemId ? {
      ...item,
      selectedProductId: suggestion.id,
      selectedProductName: suggestion.name,
      editedPrice: suggestion.price,
    } : item));
  };

  const handleCreateQuotation = async () => {
    const includedItems = editedItems.filter(i => i.include);
    if (includedItems.length === 0) { toast.error('Select at least one item'); return; }

    setCreating(true);
    try {
      const { data } = await scanAPI.createQuotation(result.scanJobId, {
        customerId: selectedCustomer || null,
        items: includedItems.map(i => ({
          productId: i.selectedProductId,
          productName: i.selectedProductName,
          quantity: parseInt(i.editedQty) || 1,
          unitPrice: parseFloat(i.editedPrice) || 0,
          discountPercent: 0,
        })),
      });
      toast.success('Quotation created from scan!');
      navigate('/admin/quotations');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create quotation');
    } finally {
      setCreating(false);
    }
  };

  const confidenceBadge = (conf) => {
    const pct = Math.round(conf * 100);
    if (pct >= 70) return <span className="badge badge-success">{pct}%</span>;
    if (pct >= 40) return <span className="badge badge-warning">{pct}%</span>;
    return <span className="badge badge-danger">{pct}%</span>;
  };

  return (
    <div className="scan-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Scan Purchase Order</h1>
          <p className="page-subtitle">Upload an image or PDF of a purchase order to automatically extract items</p>
        </div>
      </div>

      {!result ? (
        <>
          {/* Upload Area */}
          <div className="card">
            <div className="scan-upload" ref={dropRef} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onClick={() => fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => handleFileSelect(e.target.files[0])} style={{ display: 'none' }} />
              
              {file ? (
                <div className="scan-file-info">
                  {preview && <img src={preview} alt="Preview" className="scan-preview" />}
                  <div>
                    <h3>📄 {file.name}</h3>
                    <p>{(file.size / 1024).toFixed(1)} KB • {file.type}</p>
                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}>
                      <HiOutlineX /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="scan-upload-icon">📤</div>
                  <h3>Drop your file here or click to browse</h3>
                  <p>Supports JPEG, PNG, WebP images and PDF files (max 10MB)</p>
                </>
              )}
            </div>
          </div>

          <button className="btn btn-primary btn-lg" onClick={handleScan} disabled={!file || scanning} style={{ marginTop: 20, width: '100%', maxWidth: 400, margin: '20px auto', display: 'flex' }}>
            {scanning ? (
              <><div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, marginRight: 8 }} /> Scanning document...</>
            ) : (
              <><HiOutlineDocumentSearch /> Start Scan</>
            )}
          </button>
        </>
      ) : (
        <>
          {/* Scan Results */}
          <div className="scan-stats">
            <div className="scan-stat"><span className="scan-stat-num">{result.stats.totalExtracted}</span><span>Total Items</span></div>
            <div className="scan-stat"><span className="scan-stat-num scan-stat-green">{result.stats.autoMatched}</span><span>Auto-Matched</span></div>
            <div className="scan-stat"><span className="scan-stat-num scan-stat-yellow">{result.stats.needsReview}</span><span>Needs Review</span></div>
            <div className="scan-stat"><span className="scan-stat-num scan-stat-red">{result.stats.unmatched}</span><span>Unmatched</span></div>
          </div>

          {/* Raw Text Toggle */}
          <div className="card" style={{ marginBottom: 16 }}>
            <button className="btn btn-ghost" onClick={() => setShowRawText(!showRawText)} style={{ width: '100%', justifyContent: 'space-between' }}>
              <span>📝 Raw Extracted Text</span>
              {showRawText ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />}
            </button>
            {showRawText && (
              <pre className="scan-raw-text">{result.rawText}</pre>
            )}
          </div>

          {/* Matched Items Table */}
          <div className="card">
            <div className="card-header"><h3 className="card-title">Matched Items</h3></div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th style={{ width: 40 }}>✓</th><th>Extracted Name</th><th>Matched Product</th><th>Confidence</th><th style={{ width: 70 }}>Qty</th><th style={{ width: 100 }}>Price (৳)</th></tr>
                </thead>
                <tbody>
                  {editedItems.map((item) => (
                    <tr key={item.id} className={!item.matchedProduct && item.confidence < 0.4 ? 'scan-row-unmatched' : ''}>
                      <td>
                        <input type="checkbox" checked={item.include} onChange={(e) => updateEditedItem(item.id, 'include', e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--primary-500)' }} />
                      </td>
                      <td>
                        <strong>{item.extractedName}</strong>
                        <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>{item.rawLine}</span>
                      </td>
                      <td>
                        {item.selectedProductId ? (
                          <span style={{ color: 'var(--success-500)', fontWeight: 600 }}>{item.selectedProductName}</span>
                        ) : (
                          <div>
                            <span style={{ color: 'var(--danger-500)' }}>No match</span>
                            {item.suggestions?.length > 0 && (
                              <div className="scan-suggestions">
                                {item.suggestions.map((s) => (
                                  <button key={s.id} className="btn btn-ghost btn-sm" onClick={() => selectSuggestion(item.id, s)} style={{ fontSize: '0.75rem', padding: '2px 6px' }}>
                                    {s.name} ({Math.round(s.confidence * 100)}%)
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td>{confidenceBadge(item.confidence)}</td>
                      <td><input type="number" className="form-input" value={item.editedQty} onChange={(e) => updateEditedItem(item.id, 'editedQty', e.target.value)} min="1" style={{ padding: '4px 6px', textAlign: 'center' }} /></td>
                      <td><input type="number" className="form-input" value={item.editedPrice} onChange={(e) => updateEditedItem(item.id, 'editedPrice', e.target.value)} min="0" step="0.01" style={{ padding: '4px 6px', textAlign: 'right' }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Create Quotation */}
          <div className="card scan-create-section">
            <h3 style={{ marginBottom: 12 }}>Create Quotation from Scan</h3>
            <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
                <label className="form-label">Customer</label>
                <select className="form-select" value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)}>
                  <option value="">Select customer (optional)</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.contactPerson}{c.companyName ? ` - ${c.companyName}` : ''}</option>)}
                </select>
              </div>
              <button className="btn btn-primary btn-lg" onClick={handleCreateQuotation} disabled={creating}>
                {creating ? 'Creating...' : `Create Quotation (${editedItems.filter(i => i.include).length} items)`}
              </button>
            </div>
          </div>

          <button className="btn btn-secondary" onClick={() => { setResult(null); setFile(null); setPreview(null); }} style={{ marginTop: 16 }}>
            ← Scan Another Document
          </button>
        </>
      )}
    </div>
  );
};

export default ScanPO;
