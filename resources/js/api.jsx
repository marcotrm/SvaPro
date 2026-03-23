import axios from 'axios';

// API configuration
export const API_URL = 'http://localhost:8000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Store tenant code (retrieve from localStorage or session)
const getTenantCode = () => {
  return localStorage.getItem('tenantCode') || 'DEMO';
};

// Get current auth token
const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

// Add token to requests
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  const tenantCode = getTenantCode();
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-Tenant-Code'] = tenantCode;
  
  return config;
});

// Handle response errors
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Clear auth and redirect to login
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('tenantCode');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const auth = {
  login: (email, password) => api.post('/login', { email, password }),
  logout: () => api.post('/logout'),
  me: () => api.get('/me'),
};

// Catalog APIs
export const catalog = {
  getProducts: () => api.get('/catalog/products'),
  getProduct: (id) => api.get(`/catalog/products/${id}`),
  createProduct: (data) => api.post('/catalog/products', data),
  updateProduct: (id, data) => api.put(`/catalog/products/${id}`, data),
  getBrands: () => api.get('/catalog/brands'),
  getCategories: () => api.get('/catalog/categories'),
  getTaxClasses: () => api.get('/catalog/tax-classes'),
};

// Order APIs
export const orders = {
  getOrders: () => api.get('/orders'),
  getOrder: (id) => api.get(`/orders/${id}`),
  quote: (data) => api.post('/orders/quote', data),
  place: (data) => api.post('/orders/place', data),
};

// Inventory APIs
export const inventory = {
  getStock: () => api.get('/inventory/stock'),
  adjustStock: (data) => api.post('/inventory/adjust', data),
  getSmartReorderPreview: () => api.get('/inventory/smart-reorder/preview'),
  runSmartReorder: () => api.post('/inventory/smart-reorder/run'),
  runSmartReorderAuto: () => api.post('/inventory/smart-reorder/run-auto'),
};

// Customer APIs
export const customers = {
  getCustomers: (params = {}) => api.get('/customers', { params }),
  getCustomer: (id) => api.get(`/customers/${id}`),
  createCustomer: (data) => api.post('/customers', data),
  updateCustomer: (id, data) => api.put(`/customers/${id}`, data),
  getReturnAnalytics: () => api.get('/customers/analytics/return-frequency'),
};

// Employee APIs
export const employees = {
  getEmployees: () => api.get('/employees'),
  getEmployee: (id) => api.get(`/employees/${id}`),
  createEmployee: (data) => api.post('/employees', data),
  updateEmployee: (id, data) => api.put(`/employees/${id}`, data),
  getTopPerformers: () => api.get('/employees/analytics/top-performers'),
};

// Loyalty APIs
export const loyalty = {
  getWallet: (customerId) => api.get(`/loyalty/customers/${customerId}/wallet`),
  getRedemptionPreview: (customerId, pointsToRedeem) => 
    api.post(`/loyalty/customers/${customerId}/redeem-preview`, { points_to_redeem: pointsToRedeem }),
};

// Shipping APIs
export const shipping = {
  getCarriers: () => api.get('/shipping/carriers'),
  createCarrier: (data) => api.post('/shipping/carriers', data),
  getShipments: () => api.get('/shipping/shipments'),
  createShipment: (data) => api.post('/shipping/shipments', data),
  updateShipment: (id, data) => api.put(`/shipping/shipments/${id}`, data),
};

export default api;
