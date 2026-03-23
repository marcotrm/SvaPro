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

const responseCache = new Map();

const stableStringify = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  const keys = Object.keys(obj).sort();
  const sorted = {};
  for (const key of keys) {
    sorted[key] = obj[key];
  }
  return JSON.stringify(sorted);
};

const cacheKey = (path, params = {}) => {
  const tenantCode = localStorage.getItem('tenantCode') || 'DEMO';
  const selectedStoreId = localStorage.getItem('selectedStoreId') || '';
  return `${tenantCode}|${selectedStoreId}|${path}|${stableStringify(params)}`;
};

const clearApiCache = () => {
  responseCache.clear();
};

const cachedGet = (path, params = {}, ttlMs = 7000) => {
  const key = cacheKey(path, params);
  const now = Date.now();
  const cached = responseCache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = api.get(path, { params }).catch((error) => {
    responseCache.delete(key);
    throw error;
  });

  responseCache.set(key, { promise, expiresAt: now + ttlMs });
  return promise;
};

// Store tenant code (retrieve from localStorage or session)
const getTenantCode = () => {
  return localStorage.getItem('tenantCode') || 'DEMO';
};

const getSelectedStoreId = () => {
  const value = localStorage.getItem('selectedStoreId');
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// Get current auth token
const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

// Add token to requests
api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  if (method !== 'get' && method !== 'head' && method !== 'options') {
    clearApiCache();
  }

  const token = getAuthToken();
  const user = getStoredUser();
  let tenantCode = getTenantCode();
  const selectedStoreId = getSelectedStoreId();

  if (user && !(user.roles || []).includes('superadmin') && user.tenant_code) {
    tenantCode = user.tenant_code;
    localStorage.setItem('tenantCode', tenantCode);
  }
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-Tenant-Code'] = tenantCode;

  if (selectedStoreId) {
    config.headers['X-Store-Id'] = String(selectedStoreId);
    config.params = {
      ...(config.params || {}),
      store_id: config.params?.store_id ?? selectedStoreId,
    };
  }
  
  return config;
});

// Handle response errors
api.interceptors.response.use(
  response => response,
  error => {
    const status = error.response?.status;
    const message = String(error.response?.data?.message || '');
    const originalRequest = error.config || {};

    if (status === 403 && /Accesso tenant non consentito/i.test(message)) {
      const user = getStoredUser();
      let fallbackTenantCode = 'DEMO';
      try {
        if (user?.tenant_code) {
          fallbackTenantCode = user.tenant_code;
        }
      } catch {
        fallbackTenantCode = 'DEMO';
      }

      localStorage.setItem('tenantCode', fallbackTenantCode);
      localStorage.removeItem('selectedStoreId');
      if (!originalRequest.__contextRetry) {
        originalRequest.__contextRetry = true;
        originalRequest.headers = {
          ...(originalRequest.headers || {}),
          'X-Tenant-Code': fallbackTenantCode,
        };
        if (originalRequest.params?.store_id) {
          const { store_id, ...nextParams } = originalRequest.params;
          originalRequest.params = nextParams;
        }
        return api.request(originalRequest);
      }
    }

    if (status === 422 && /Store non valido per il tenant/i.test(message)) {
      localStorage.removeItem('selectedStoreId');
      if (!originalRequest.__contextRetry) {
        originalRequest.__contextRetry = true;
        if (originalRequest.params?.store_id) {
          const { store_id, ...nextParams } = originalRequest.params;
          originalRequest.params = nextParams;
        }
        return api.request(originalRequest);
      }
    }

    if (error.response?.status === 401) {
      // Clear auth and redirect to login
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('tenantCode');
      localStorage.removeItem('selectedStoreId');
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
  switchableUsers: (params = {}) => api.get('/auth/switchable-users', { params }),
  impersonate: (userId) => api.post('/auth/impersonate', { user_id: userId }),
};

// Catalog APIs
export const catalog = {
  getProducts: (params = {}) => cachedGet('/catalog/products', params, 8000),
  getProduct: (id) => api.get(`/catalog/products/${id}`),
  createProduct: (data) => api.post('/catalog/products', data),
  updateProduct: (id, data) => api.put(`/catalog/products/${id}`, data),
  getBrands: () => api.get('/catalog/brands'),
  getCategories: () => api.get('/catalog/categories'),
  getTaxClasses: () => api.get('/catalog/tax-classes'),
};

export const stores = {
  getTenants: () => cachedGet('/tenants', {}, 10000),
  getStores: () => cachedGet('/stores', {}, 10000),
};

// Order APIs
export const orders = {
  getOrders: (params = {}) => cachedGet('/orders', params, 6000),
  getOrder: (id) => api.get(`/orders/${id}`),
  quote: (data) => api.post('/orders/quote', data),
  place: (data) => api.post('/orders/place', data),
};

// Inventory APIs
export const inventory = {
  getStock: (params = {}) => cachedGet('/inventory/stock', params, 6000),
  getMovements: (params = {}) => cachedGet('/inventory/movements', params, 4000),
  adjustStock: (data) => api.post('/inventory/adjust', data),
  getSmartReorderPreview: (params = {}) => cachedGet('/inventory/smart-reorder/preview', params, 5000),
  runSmartReorder: (data = {}) => api.post('/inventory/smart-reorder/run', data),
  runSmartReorderAuto: (data = {}) => api.post('/inventory/smart-reorder/run-auto', data),
};

// Customer APIs
export const customers = {
  getCustomers: (params = {}) => cachedGet('/customers', params, 7000),
  getCustomer: (id) => api.get(`/customers/${id}`),
  createCustomer: (data) => api.post('/customers', data),
  updateCustomer: (id, data) => api.put(`/customers/${id}`, data),
  getReturnAnalytics: (params = {}) => cachedGet('/customers/analytics/return-frequency', params, 10000),
};

// Employee APIs
export const employees = {
  getEmployees: (params = {}) => cachedGet('/employees', params, 7000),
  getEmployee: (id) => api.get(`/employees/${id}`),
  createEmployee: (data) => api.post('/employees', data),
  updateEmployee: (id, data) => api.put(`/employees/${id}`, data),
  getTopPerformers: (params = {}) => cachedGet('/employees/analytics/top-performers', params, 9000),
};

// Loyalty APIs
export const loyalty = {
  getWallet: (customerId) => api.get(`/loyalty/customers/${customerId}/wallet`),
  registerDevice: (customerId, data) => api.post(`/loyalty/customers/${customerId}/devices`, data),
  getNotifications: (customerId, params = {}) => api.get(`/loyalty/customers/${customerId}/notifications`, { params }),
  markNotificationRead: (customerId, notificationId) => api.post(`/loyalty/customers/${customerId}/notifications/${notificationId}/read`),
  getPushMonitoringStats: (params = {}) => cachedGet('/loyalty/monitoring/push-stats', params, 6000),
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

export { clearApiCache };
