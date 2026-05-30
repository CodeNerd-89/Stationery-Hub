import { useState, useEffect } from 'react';
import { promosAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { 
  HiOutlineTag, 
  HiOutlinePlus, 
  HiOutlinePencilAlt, 
  HiOutlineTrash,
  HiOutlineX
} from 'react-icons/hi';
import './AdminPromos.css';

const AdminPromos = () => {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);

  const [formData, setFormData] = useState({
    code: '',
    discountType: 'PERCENTAGE',
    discountValue: '',
    validFrom: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0, 10),
    usageLimit: '',
    minOrderAmount: '',
    isActive: true
  });

  const fetchPromos = async () => {
    try {
      setLoading(true);
      const { data } = await promosAPI.getAll();
      setPromos(data.promos);
    } catch (err) {
      toast.error('Failed to load promo codes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromos();
  }, []);

  const openModal = (promo = null) => {
    if (promo) {
      setEditingPromo(promo);
      setFormData({
        code: promo.code,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        validFrom: promo.validFrom ? new Date(promo.validFrom).toISOString().slice(0, 10) : '',
        validUntil: promo.validUntil ? new Date(promo.validUntil).toISOString().slice(0, 10) : '',
        usageLimit: promo.usageLimit || '',
        minOrderAmount: promo.minOrderAmount || '',
        isActive: promo.isActive
      });
    } else {
      setEditingPromo(null);
      setFormData({
        code: '',
        discountType: 'PERCENTAGE',
        discountValue: '',
        validFrom: new Date().toISOString().slice(0, 10),
        validUntil: new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0, 10),
        usageLimit: '',
        minOrderAmount: '',
        isActive: true
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPromo(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPromo) {
        await promosAPI.update(editingPromo.id, formData);
        toast.success('Promo code updated');
      } else {
        await promosAPI.create(formData);
        toast.success('Promo code created');
      }
      closeModal();
      fetchPromos();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save promo code');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this promo code?')) return;
    try {
      await promosAPI.delete(id);
      toast.success('Promo code deactivated');
      fetchPromos();
    } catch (err) {
      toast.error('Failed to deactivate promo code');
    }
  };

  return (
    <div className="admin-promos-page">
      <div className="page-header">
        <div>
          <h1>Promo Codes</h1>
          <p className="subtitle">Manage discount codes for B2C orders</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <HiOutlinePlus /> Create Promo
        </button>
      </div>

      {loading ? (
        <div className="spinner-container"><div className="spinner"></div></div>
      ) : promos.length === 0 ? (
        <div className="empty-state">
          <HiOutlineTag className="empty-icon" />
          <h2>No Promo Codes</h2>
          <p>Create your first promo code to offer discounts.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Validity</th>
                <th>Usage</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {promos.map(promo => {
                const isValid = promo.isActive && new Date(promo.validUntil) >= new Date();
                return (
                  <tr key={promo.id}>
                    <td>
                      <span className="promo-code-badge">{promo.code}</span>
                      {promo.minOrderAmount && (
                        <div className="min-order">Min: ৳{promo.minOrderAmount}</div>
                      )}
                    </td>
                    <td>
                      {promo.discountType === 'PERCENTAGE' 
                        ? `${promo.discountValue}%` 
                        : `৳${promo.discountValue}`}
                    </td>
                    <td>
                      <div className="date-range">
                        {new Date(promo.validFrom).toLocaleDateString()} - <br/>
                        {new Date(promo.validUntil).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      {promo.usedCount} {promo.usageLimit ? `/ ${promo.usageLimit}` : ''}
                    </td>
                    <td>
                      <span className={`status-badge ${isValid ? 'active' : 'inactive'}`}>
                        {isValid ? 'Active' : 'Inactive/Expired'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button className="icon-btn edit" onClick={() => openModal(promo)}>
                        <HiOutlinePencilAlt />
                      </button>
                      {promo.isActive && (
                        <button className="icon-btn delete" onClick={() => handleDelete(promo.id)}>
                          <HiOutlineTrash />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content promo-modal">
            <div className="modal-header">
              <h2>{editingPromo ? 'Edit Promo Code' : 'Create Promo Code'}</h2>
              <button className="close-btn" onClick={closeModal}><HiOutlineX /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label>Promo Code *</label>
                <input 
                  type="text" 
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                  required
                  placeholder="e.g. SUMMER20"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Discount Type *</label>
                  <select 
                    value={formData.discountType}
                    onChange={(e) => setFormData({...formData, discountType: e.target.value})}
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed Amount (৳)</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Discount Value *</label>
                  <input 
                    type="number" 
                    value={formData.discountValue}
                    onChange={(e) => setFormData({...formData, discountValue: e.target.value})}
                    required
                    min="1"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Valid From *</label>
                  <input 
                    type="date" 
                    value={formData.validFrom}
                    onChange={(e) => setFormData({...formData, validFrom: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Valid Until *</label>
                  <input 
                    type="date" 
                    value={formData.validUntil}
                    onChange={(e) => setFormData({...formData, validUntil: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Usage Limit (Optional)</label>
                  <input 
                    type="number" 
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({...formData, usageLimit: e.target.value})}
                    placeholder="e.g. 100"
                    min="1"
                  />
                </div>
                
                <div className="form-group">
                  <label>Min Order Amount (Optional)</label>
                  <input 
                    type="number" 
                    value={formData.minOrderAmount}
                    onChange={(e) => setFormData({...formData, minOrderAmount: e.target.value})}
                    placeholder="e.g. 1000"
                    min="0"
                  />
                </div>
              </div>

              {editingPromo && (
                <div className="form-group checkbox-group">
                  <label>
                    <input 
                      type="checkbox" 
                      checked={formData.isActive}
                      onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                    />
                    Active
                  </label>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Promo Code</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPromos;
