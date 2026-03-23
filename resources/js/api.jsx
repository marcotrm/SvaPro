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

/**
 * Stale-While-Revalidate GET cache.
 *
 * freshMs  – return cached without any network call (default 30s)
 * staleMs  – return cached instantly, refetch in background (default 5min)
 * Beyond staleMs the entry is discarded and a fresh fetch is made.
 */
const cachedGet = (path, params = {}, freshMs = 30000, staleMs = 300000) => {
  const key = cacheKey(path, params);
  const now = Date.now();
  const cached = responseCache.get(key);

  // 1. FRESH — return immediately, no network
  if (cached && cached.fetchedAt + freshMs > now) {
    return cached.resolved
      ? Promise.resolve(cached.resolved)
      : cached.promise;
  }

  // 2. STALE — return cached data instantly, refresh in background
  if (cached && cached.resolved && cached.fetchedAt + staleMs > now) {
    api.get(path, { params }).then(res => {
      responseCache.set(key, { promise: Promise.resolve(res), fetchedAt: Date.now(), resolved: res });
    }).catch(() => {});
    return Promise.resolve(cached.resolved);
  }

  // 3. EXPIRED or MISS — fresh fetch
  const promise = api.get(path, { params }).then(res => {
    const entry = responseCache.get(key);
    if (entry) entry.resolved = res;
    return res;
  }).catch(err => {
    responseCache.delete(key);
    throw err;
  });

  responseCache.set(key, { promise, fetchedAt: now, resolved: null });
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
    // Surgical cache invalidation: only clear entries whose path shares a prefix
    // with the mutated resource (e.g. POST /catalog/products clears /catalog/*)
    const mutatedPath = (config.url || '').replace(API_URL, '').split('?')[0];
    const prefix = mutatedPath.split('/').slice(0, 3).join('/'); // e.g. "/catalog/products" → "/catalog/products"
    for (const [key] of responseCache) {
      if (key.includes(prefix)) {
        responseCache.delete(key);
      }
    }
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
      clearApiCache();
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
      clearApiCache();
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
  updateProfile: (data) => api.put('/profile', data),
  switchableUsers: (params = {}) => api.get('/auth/switchable-users', { params }),
  impersonate: (userId) => api.post('/auth/impersonate', { user_id: userId }),
};

// Catalog APIs
export const catalog = {
  getProducts: (params = {}) => cachedGet('/catalog/products', params, 30000, 300000),
  getProduct: (id) => api.get(`/catalog/products/${id}`),
  createProduct: (data) => api.post('/catalog/products', data),
  updateProduct: (id, data) => api.put(`/catalog/products/${id}`, data),
  getBrands: () => api.get('/catalog/brands'),
  getCategories: () => api.get('/catalog/categories'),
  getTaxClasses: () => api.get('/catalog/tax-classes'),
};

export const stores = {
  getTenants: () => cachedGet('/tenants', {}, 60000, 600000),
  getTenantHealth: () => cachedGet('/tenants/health', {}, 20000, 120000),
  getStores: () => cachedGet('/stores', {}, 60000, 600000),
  getTenantSettings: () => cachedGet('/tenant-settings', {}, 30000, 300000),
  updateTenantSettings: (data) => api.put('/tenant-settings', data),
};

// Order APIs
export const orders = {
  getOrders: (params = {}) => cachedGet('/orders', params, 15000, 120000),
  getOrder: (id) => api.get(`/orders/${id}`),
  quote: (data) => api.post('/orders/quote', data),
  place: (data) => api.post('/orders/place', data),
};

// Inventory APIs
export const inventory = {
  getStock: (params = {}) => cachedGet('/inventory/stock', params, 15000, 120000),
  getMovements: (params = {}) => cachedGet('/inventory/movements', params, 10000, 120000),
  adjustStock: (data) => api.post('/inventory/adjust', data),
  getSmartReorderPreview: (params = {}) => cachedGet('/inventory/smart-reorder/preview', params, 20000, 180000),
  runSmartReorder: (data = {}) => api.post('/inventory/smart-reorder/run', data),
  runSmartReorderAuto: (data = {}) => api.post('/inventory/smart-reorder/run-auto', data),
};

// Customer APIs
export const customers = {
  getCustomers: (params = {}) => cachedGet('/customers', params, 30000, 300000),
  getCustomer: (id) => api.get(`/customers/${id}`),
  createCustomer: (data) => api.post('/customers', data),
  updateCustomer: (id, data) => api.put(`/customers/${id}`, data),
  getReturnAnalytics: (params = {}) => cachedGet('/customers/analytics/return-frequency', params, 30000, 300000),
};

// Employee APIs
export const employees = {
  getEmployees: (params = {}) => cachedGet('/employees', params, 30000, 300000),
  getEmployee: (id) => api.get(`/employees/${id}`),
  createEmployee: (data) => api.post('/employees', data),
  updateEmployee: (id, data) => api.put(`/employees/${id}`, data),
  getTopPerformers: (params = {}) => cachedGet('/employees/analytics/top-performers', params, 30000, 300000),
};

// Loyalty APIs
export const loyalty = {
  getWallet: (customerId) => api.get(`/loyalty/customers/${customerId}/wallet`),
  registerDevice: (customerId, data) => api.post(`/loyalty/customers/${customerId}/devices`, data),
  getNotifications: (customerId, params = {}) => api.get(`/loyalty/customers/${customerId}/notifications`, { params }),
  markNotificationRead: (customerId, notificationId) => api.post(`/loyalty/customers/${customerId}/notifications/${notificationId}/read`),
  getPushMonitoringStats: (params = {}) => cachedGet('/loyalty/monitoring/push-stats', params, 15000, 120000),
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

// Audit APIs
export const audit = {
  getLogs: (params = {}) => cachedGet('/audit-logs', params, 10000, 120000),
};

// Roles & Permissions APIs
export const rolesPermissions = {
  getMatrix: () => cachedGet('/roles-permissions', {}, 60000, 600000),
  toggle: (roleId, permissionId) => api.post('/roles-permissions/toggle', { role_id: roleId, permission_id: permissionId }),
};

export default api;

export { clearApiCache };
