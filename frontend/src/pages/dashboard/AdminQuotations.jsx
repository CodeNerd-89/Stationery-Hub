import { useState, useEffect } from 'react';
import { quotationsAPI, customersAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineSearch, HiOutlineDocumentDownload, HiOutlineSwitchHorizontal, HiOutlineTrash, HiOutlineEye } from 'react-icons/hi';

const statusBadge = (s) => ({ DRAFT: 'badge-gray', SENT: 'badge-info', ACCEPTED: 'badge-success', REJECTED: 'badge-danger', EXPIRED: 'badge-warning' }[s] || 'badge-gray');

const AdminQuotations = () => {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const navigate = useNavigate();

  useEffect(() => { fetchQuotations(); }, [search, filterStatus, page]);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const { data } = await quotationsAPI.getAll({ search: search || undefined, status: filterStatus || undefined, page, limit: 20 });
      setQuotations(data.quotations);
      setPagination(data.pagination);
    } catch (err) { toast.error('Failed to load quotations'); }
    finally { setLoading(false); }
  };

  const updateStatus = async (id, status) => {
    try { await quotationsAPI.update(id, { status }); toast.success(`Status updated to ${status}`); fetchQuotations(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to update status'); }
  };

  const downloadPDF = async (q) => {
    try {
      const { data } = await quotationsAPI.downloadPDF(q.id);
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${q.quotationNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded!');
    } catch (err) { toast.error('Failed to download PDF'); }
  };

  const convertToOrder = async (q) => {
    try { await quotationsAPI.convert(q.id, {}); toast.success('Order created!'); fetchQuotations(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to convert'); }
  };

  const deleteQuotation = async (q) => {
    if (!confirm(`Delete quotation ${q.quotationNumber}?`)) return;
    try { await quotationsAPI.delete(q.id); toast.success('Quotation deleted'); fetchQuotations(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="page-header">
        <div><h1 className="page-title">Quotations</h1><p className="page-subtitle">Manage quotations • {pagination.total || 0} total</p></div>
        <button className="btn btn-primary" onClick={() => navigate('/admin/quotations/new')}><HiOutlinePlus /> New Quotation</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 250 }}>
          <HiOutlineSearch className="search-icon" />
          <input type="text" placeholder="Search quotation # or customer..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="form-select" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} style={{ maxWidth: 180 }}>
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="REJECTED">Rejected</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      {loading ? <div className="loading-screen"><div className="spinner" /><p>Loading quotations...</p></div> : quotations.length > 0 ? (
        <>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Quotation #</th><th>Customer</th><th>Status</th><th>Items</th><th>Total (৳)</th><th>Created By</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {quotations.map((q) => (
                  <tr key={q.id}>
                    <td><strong>{q.quotationNumber}</strong></td>
                    <td>{q.customer?.contactPerson || <span style={{ color: 'var(--text-tertiary)' }}>Walk-in</span>}</td>
                    <td>
                      <select className="form-select" value={q.status} onChange={(e) => updateStatus(q.id, e.target.value)}
                        style={{ padding: '4px 8px', fontSize: '0.75rem', minWidth: 100, borderRadius: 'var(--radius-full)' }}>
                        {['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>{q._count?.items || 0}</td>
                    <td style={{ fontWeight: 700 }}>৳{Number(q.total).toLocaleString()}</td>
                    <td style={{ fontSize: '0.8125rem' }}>{q.createdBy?.name}</td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>{new Date(q.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon" title="Edit" onClick={() => navigate(`/admin/quotations/new?id=${q.id}`)}><HiOutlineEye /></button>
                        <button className="btn btn-ghost btn-icon" title="Download PDF" onClick={() => downloadPDF(q)}><HiOutlineDocumentDownload /></button>
                        {q.status === 'ACCEPTED' && <button className="btn btn-ghost btn-icon" title="Convert to Order" onClick={() => convertToOrder(q)} style={{ color: 'var(--success-500)' }}><HiOutlineSwitchHorizontal /></button>}
                        <button className="btn btn-ghost btn-icon" title="Delete" onClick={() => deleteQuotation(q)} style={{ color: 'var(--danger-500)' }}><HiOutlineTrash /></button>
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
        <div className="card"><div className="empty-state"><div className="empty-state-icon">📄</div><h3>No quotations found</h3><p>{search || filterStatus ? 'Try different filters.' : 'Create your first quotation.'}</p>
          <button className="btn btn-primary" onClick={() => navigate('/admin/quotations/new')} style={{ marginTop: 16 }}><HiOutlinePlus /> New Quotation</button></div></div>
      )}
    </div>
  );
};

export default AdminQuotations;
