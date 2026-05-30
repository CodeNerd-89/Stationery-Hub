import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses (token expired)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth API ──────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  verifyEmail: (token) => api.get(`/auth/verify-email?token=${token}`),
  verifyOTP: (data) => api.post('/auth/verify-otp', data),
  resendOTP: (data) => api.post('/auth/resend-otp', data),
  resendVerification: () => api.post('/auth/resend-verification'),
  getMe: () => api.get('/auth/me'),
};

// ─── Products API ──────────────────────────────────────
export const productsAPI = {
  getAll: (params) => api.get('/products', { params }),
  getAllAdmin: (params) => api.get('/products/admin/all', { params }),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  deletePermanent: (id) => api.delete(`/products/${id}/permanent`),
};

// ─── Categories API ────────────────────────────────────
export const categoriesAPI = {
  getAll: () => api.get('/categories'),
  getById: (id) => api.get(`/categories/${id}`),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
};

// ─── Customers API ─────────────────────────────────────
export const customersAPI = {
  getAll: (params) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
};

// ─── Quotations API ────────────────────────────────────
export const quotationsAPI = {
  getAll: (params) => api.get('/quotations', { params }),
  getById: (id) => api.get(`/quotations/${id}`),
  create: (data) => api.post('/quotations', data),
  update: (id, data) => api.put(`/quotations/${id}`, data),
  delete: (id) => api.delete(`/quotations/${id}`),
  convert: (id, data) => api.post(`/quotations/${id}/convert`, data),
  downloadPDF: (id) => api.get(`/quotations/${id}/pdf`, { responseType: 'blob' }),
};

// ─── Orders API ────────────────────────────────────────
export const ordersAPI = {
  getAll: (params) => api.get('/orders', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  getMyOrders: (params) => api.get('/orders/my', { params }),
  getTimeline: (id) => api.get(`/orders/${id}/timeline`),
  updateStatus: (id, status) => api.put(`/orders/${id}/status`, { status }),
  cancel: (id) => api.put(`/orders/${id}/cancel`),
  getNewCount: () => api.get('/orders/new-count'),
};

// ─── Checkout API ──────────────────────────────────────
export const checkoutAPI = {
  placeOrder: (data) => api.post('/checkout', data),
  validatePromo: (data) => api.post('/checkout/validate-promo', data),
};

// ─── Reviews API ───────────────────────────────────────
export const reviewsAPI = {
  getByProduct: (productId, params) => api.get(`/reviews/product/${productId}`, { params }),
  create: (productId, data) => api.post(`/reviews/product/${productId}`, data),
  delete: (reviewId) => api.delete(`/reviews/${reviewId}`),
};

// ─── Wishlist API ──────────────────────────────────────
export const wishlistAPI = {
  getAll: () => api.get('/wishlist'),
  toggle: (productId) => api.post(`/wishlist/${productId}`),
  remove: (productId) => api.delete(`/wishlist/${productId}`),
};

// ─── Promo Codes API ───────────────────────────────────
export const promosAPI = {
  getAll: (params) => api.get('/promos', { params }),
  create: (data) => api.post('/promos', data),
  update: (id, data) => api.put(`/promos/${id}`, data),
  delete: (id) => api.delete(`/promos/${id}`),
};

// ─── Referrals API ─────────────────────────────────────
export const referralsAPI = {
  getMyCode: () => api.get('/referrals/my-code'),
};

// ─── Scan/OCR API ──────────────────────────────────────
export const scanAPI = {
  upload: (formData) => api.post('/scan/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  createQuotation: (scanJobId, data) => api.post(`/scan/${scanJobId}/create-quotation`, data),
};

// ─── Dashboard API ─────────────────────────────────────
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getAnalytics: () => api.get('/dashboard/analytics'),
  getUsers: (params) => api.get('/dashboard/users', { params }),
  updateUserRole: (id, role) => api.put(`/dashboard/users/${id}/role`, { role }),
  deleteUser: (id) => api.delete(`/dashboard/users/${id}`),
  deleteTopProduct: (productName) => api.delete('/dashboard/analytics/top-product', { data: { productName } }),
};

export default api;
