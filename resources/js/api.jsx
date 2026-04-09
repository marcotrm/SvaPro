import axios from 'axios';

// API configuration
const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim();
export const API_URL = configuredApiUrl || '/api';

// Risolve i path /storage/... con l'URL base del backend (Railway ha backend e frontend separati)
export const BACKEND_URL = configuredApiUrl ? configuredApiUrl.replace('/api', '').replace(/\/$/, '') : '';
export const getImageUrl = (path) => {
  if (!path) return null;
  // base64 data URL — già assoluto, usato direttamente
  if (path.startsWith('data:')) return path;
  // URL HTTP assoluto
  if (path.startsWith('http')) return path;
  // Path relativo: prefissa con backend URL (cross-domain Railway)
  return BACKEND_URL ? `${BACKEND_URL}${path}` : path;
};

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Gestione errori personalizzata globale
const errorMap = [
  {
    match: msg => msg.includes('The POST method is not supported for route'),
    userMessage: 'Operazione non consentita: azione non supportata su questa pagina.'
  },
  {
    match: msg => msg.includes('Unauthenticated'),
    userMessage: 'Sessione scaduta. Effettua di nuovo il login.'
  },
  {
    match: msg => msg.includes('permission'),
    userMessage: 'Non hai i permessi necessari per questa operazione.'
  },
  {
    match: msg => msg.includes('Network Error'),
    userMessage: 'Errore di rete: controlla la connessione internet.'
  },
  {
    match: msg => msg.includes('timeout'),
    userMessage: 'Timeout della richiesta: il server non ha risposto in tempo.'
  },
  {
    match: msg => msg.includes('404'),
    userMessage: 'Risorsa non trovata.'
  },
  {
    match: msg => msg.includes('422'),
    userMessage: 'Dati non validi o mancanti. Controlla i campi e riprova.'
  },
];

api.interceptors.response.use(
  response => response,
  error => {
    let msg = error?.response?.data?.message || error?.message || 'Errore sconosciuto.';
    for (const rule of errorMap) {
      if (msg && rule.match(msg)) {
        error.userFriendlyMessage = rule.userMessage;
        break;
      }
    }
    return Promise.reject(error);
  }
);


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

const OFFLINE_SALES_QUEUE_KEY = 'svapro.offline.sales.queue.v1';
const OFFLINE_SALES_QUEUE_EVENT = 'svapro-offline-sales-queue-updated';
let offlineSyncInitialized = false;
let offlineSyncInProgress = false;

const readOfflineSalesQueue = () => {
  try {
    const raw = localStorage.getItem(OFFLINE_SALES_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeOfflineSalesQueue = (items) => {
  localStorage.setItem(OFFLINE_SALES_QUEUE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(OFFLINE_SALES_QUEUE_EVENT, {
    detail: { size: items.length },
  }));
};

const isOfflineSalesRequest = (config) => {
  const method = (config?.method || 'get').toLowerCase();
  const url = String(config?.url || '');
  return method === 'post' && /\/orders\/place(?:\?|$)/.test(url);
};

const queueOfflineSale = (config) => {
  const queue = readOfflineSalesQueue();
  const id = `ofs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const item = {
    id,
    url: String(config?.url || '/orders/place'),
    method: 'post',
    data: config?.data ?? null,
    params: config?.params ?? {},
    headers: {
      'X-Tenant-Code': config?.headers?.['X-Tenant-Code'] || getTenantCode(),
      'X-Store-Id': config?.headers?.['X-Store-Id'] || '',
    },
    created_at: new Date().toISOString(),
  };

  queue.push(item);
  writeOfflineSalesQueue(queue);

  return item;
};

const buildOfflineQueuedResponse = (config, queueItem) => ({
  status: 202,
  statusText: 'Accepted (offline queued)',
  headers: {},
  config,
  data: {
    offline_queued: true,
    offline_queue_id: queueItem.id,
    message: 'Vendita salvata offline. Verra sincronizzata automaticamente al ritorno della connessione.',
  },
});

export const getOfflineSalesQueueSize = () => readOfflineSalesQueue().length;

export const onOfflineSalesQueueChanged = (callback) => {
  const handler = (event) => {
    callback?.(event?.detail?.size ?? getOfflineSalesQueueSize());
  };
  window.addEventListener(OFFLINE_SALES_QUEUE_EVENT, handler);
  return () => window.removeEventListener(OFFLINE_SALES_QUEUE_EVENT, handler);
};

export const syncOfflineSalesNow = async () => {
  if (offlineSyncInProgress) {
    return { synced: 0, failed: 0, remaining: getOfflineSalesQueueSize() };
  }

  if (!navigator.onLine) {
    return { synced: 0, failed: 0, remaining: getOfflineSalesQueueSize() };
  }

  offlineSyncInProgress = true;

  let queue = readOfflineSalesQueue();
  let synced = 0;
  let failed = 0;
  const nextQueue = [];

  for (const item of queue) {
    try {
      await api.request({
        url: item.url,
        method: item.method,
        data: item.data,
        params: item.params,
        headers: {
          ...(item.headers || {}),
          'X-Sync-Source': 'offline-queue',
        },
        __skipOfflineQueue: true,
      });
      synced += 1;
    } catch (error) {
      // Network errors keep the remaining queue for next retry.
      if (!error?.response) {
        nextQueue.push(item, ...queue.slice(queue.indexOf(item) + 1));
        failed += 1;
        break;
      }

      // Validation/business failures are dropped to avoid permanent blocking.
      failed += 1;
      console.error('Offline sale dropped after sync failure:', item.id, error?.response?.status);
    }
  }

  writeOfflineSalesQueue(nextQueue);
  offlineSyncInProgress = false;

  return {
    synced,
    failed,
    remaining: nextQueue.length,
  };
};

export const initOfflineSalesSync = () => {
  if (offlineSyncInitialized) {
    return;
  }

  offlineSyncInitialized = true;

  window.addEventListener('online', () => {
    syncOfflineSalesNow().catch(() => {});
  });
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
    if (!cached.revalidating) {
      cached.revalidating = true;
      api.get(path, { params }).then(res => {
        responseCache.set(key, { promise: Promise.resolve(res), fetchedAt: Date.now(), resolved: res });
      }).catch(() => {}).finally(() => { const e = responseCache.get(key); if (e) e.revalidating = false; });
    }
    return Promise.resolve(cached.resolved);
  }

  // 3. EXPIRED or MISS — deduplicate in-flight requests
  if (cached && cached.promise && !cached.resolved && cached.fetchedAt + 5000 > now) {
    return cached.promise;
  }

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

  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }

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

    if (!error.response && isOfflineSalesRequest(originalRequest) && !originalRequest.__skipOfflineQueue) {
      const queued = queueOfflineSale(originalRequest);
      return Promise.resolve(buildOfflineQueuedResponse(originalRequest, queued));
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
  updateProduct: (id, data) => {
    if (data instanceof FormData) {
      data.append('_method', 'PUT');
      return api.post(`/catalog/products/${id}`, data);
    }
    return api.put(`/catalog/products/${id}`, data);
  },
  importProducts: (formData) => api.post('/catalog/products/import', formData),
  getBrands: () => api.get('/catalog/brands'),
  getCategories: () => api.get('/catalog/categories'),
  createCategory: (data) => api.post('/catalog/categories', data),
  deleteCategory: (id) => api.delete(`/catalog/categories/${id}`),
  getTaxClasses: () => api.get('/catalog/tax-classes'),
};

export const stores = {
  getTenants: () => cachedGet('/tenants', {}, 60000, 600000),
  getTenantHealth: () => cachedGet('/tenants/health', {}, 20000, 120000),
  getStores: () => api.get('/stores'),  // no cache — sempre aggiornato
  getStore: (id) => api.get(`/stores/${id}`),
  createStore: (data) => api.post('/stores', data),
  updateStore: (id, data) => api.put(`/stores/${id}`, data),
  deleteStore: (id) => api.delete(`/stores/${id}`),
  getTenantSettings: () => cachedGet('/tenant-settings', {}, 30000, 300000),
  updateTenantSettings: (data) => api.put('/tenant-settings', data),
};

// Order APIs
export const orders = {
  getOptions: (params = {}) => cachedGet('/orders/options', params, 30000, 120000),
  getOrders: (params = {}) => cachedGet('/orders', params, 15000, 120000),
  getOrder: (id) => api.get(`/orders/${id}`),
  quote: (data) => api.post('/orders/quote', data),
  place: (data) => api.post('/orders/place', data),
  getStockAlerts: (params = {}) => cachedGet('/orders/stock-alerts', params, 10000, 60000),
  resolveStockAlert: (alertId) => api.post(`/orders/stock-alerts/${alertId}/resolve`),
};

// Inventory APIs
export const inventory = {
  getStock: (params = {}) => cachedGet('/inventory/stock', params, 15000, 120000),
  getMovements: (params = {}) => cachedGet('/inventory/movements', params, 10000, 120000),
  adjustStock: (data) => api.post('/inventory/adjust', data),
  getSmartReorderPreview: (params = {}) => cachedGet('/inventory/smart-reorder/preview', params, 20000, 180000),
  runSmartReorder: (data = {}) => api.post('/inventory/smart-reorder/run', data),
  runSmartReorderAuto: (data = {}) => api.post('/inventory/smart-reorder/run-auto', data),
  getHealthScan: () => api.get('/health-scan'),
  getForecast: () => api.get('/inventory/forecast'),
};

// Customer APIs
export const customers = {
  getCustomers: (params = {}) => cachedGet('/customers', params, 30000, 300000),
  getCustomer: (id) => api.get(`/customers/${id}`),
  createCustomer: (data) => api.post('/customers', data),
  updateCustomer: (id, data) => api.put(`/customers/${id}`, data),
  getReturnAnalytics: (params = {}) => cachedGet('/customers/analytics/return-frequency', params, 30000, 300000),
  sendEmailOtp: (customerId, email) => api.post(`/customers/${customerId}/email-otp/send`, { email }),
  verifyEmailOtp: (customerId, otp) => api.post(`/customers/${customerId}/email-otp/verify`, { otp }),
  uploadVisura: (customerId, formData) => api.post(`/customers/${customerId}/visura`, formData),
  downloadVisura: (customerId) => api.get(`/customers/${customerId}/visura/download`, { responseType: 'blob' }),
  // Metodo generico POST per usi avanzati
  post_: (path, data) => api.post(path, data),
};

// Employee APIs
export const employees = {
  getEmployees: (params = {}) => cachedGet('/employees', params, 30000, 300000),
  getEmployee: (id) => api.get(`/employees/${id}`),
  createEmployee: (data) => api.post('/employees', data),
  updateEmployee: (id, data) => api.put(`/employees/${id}`, data),
  getTopPerformers: (params = {}) => cachedGet('/employees/analytics/top-performers', params, 30000, 300000),
  getKpiDashboard: (params = {}) => cachedGet('/employees/kpi-dashboard', params, 15000, 120000),
  setKpiTarget: (employeeId, data) => api.post(`/employees/${employeeId}/kpi-target`, data),
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
  // Tiers
  getTiers: (params = {}) => cachedGet('/loyalty/tiers', params, 30000, 300000),
  createTier: (data) => api.post('/loyalty/tiers', data),
  updateTier: (id, data) => api.put(`/loyalty/tiers/${id}`, data),
  deleteTier: (id) => api.delete(`/loyalty/tiers/${id}`),
  // Redemptions
  redeemPoints: (customerId, points) => api.post(`/loyalty/customers/${customerId}/redeem`, { points }),
  getRedemptionHistory: (params = {}) => cachedGet('/loyalty/redemptions', params, 15000, 120000),
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

// Export APIs
export const exports_ = {
  orders: (params = {}) => api.get('/export/orders', { params, responseType: 'blob' }),
  customers: (params = {}) => api.get('/export/customers', { params, responseType: 'blob' }),
  inventory: (params = {}) => api.get('/export/inventory', { params, responseType: 'blob' }),
  download: (promise, filename) => {
    return promise.then(res => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    });
  },
};

// Invoice APIs
export const invoices = {
  list: (params = {}) => cachedGet('/invoices', params, 15000, 120000),
  generate: (orderId) => api.post('/invoices/generate', { order_id: orderId }),
  download: (id) => api.get(`/invoices/${id}/download`, { responseType: 'blob' }),
};

// Supplier APIs
export const suppliers = {
  getAll: (params = {}) => cachedGet('/suppliers', params, 30000, 300000),
  getOne: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  remove: (id) => api.delete(`/suppliers/${id}`),
};

// Purchase Order APIs
export const purchaseOrders = {
  getAll: (params = {}) => cachedGet('/purchase-orders', params, 15000, 120000),
  getOne: (id) => api.get(`/purchase-orders/${id}`),
  create: (data) => api.post('/purchase-orders', data),
  update: (id, data) => api.put(`/purchase-orders/${id}`, data),
  send: (id) => api.post(`/purchase-orders/${id}/send`),
  receive: (id) => api.post(`/purchase-orders/${id}/receive`),
  cancel: (id) => api.post(`/purchase-orders/${id}/cancel`),
};

// Returns APIs
export const returns = {
  getAll: (params = {}) => cachedGet('/returns', params, 15000, 120000),
  create: (data) => api.post('/returns', data),
  updateStatus: (id, status) => api.post(`/returns/${id}/status`, { status }),
  getAnalytics: (params = {}) => cachedGet('/returns/analytics', params, 30000, 300000),
};

// Supplier Invoice APIs
export const supplierInvoices = {
  getAll: (params = {}) => cachedGet('/supplier-invoices', params, 15000, 120000),
  getOne: (id) => api.get(`/supplier-invoices/${id}`),
  create: (data) => api.post('/supplier-invoices', data),
  update: (id, data) => api.put(`/supplier-invoices/${id}`, data),
  markPaid: (id) => api.post(`/supplier-invoices/${id}/mark-paid`),
  remove: (id) => api.delete(`/supplier-invoices/${id}`),
};

// POS APIs
export const pos = {
  getActive: () => api.get('/pos/active'),
  getSessions: (params = {}) => cachedGet('/pos/sessions', params, 10000, 60000),
  open: (data = {}) => api.post('/pos/open', data),
  close: (sessionId) => api.post(`/pos/sessions/${sessionId}/close`),
};

// Promotion APIs
export const promotions = {
  getAll: (params = {}) => cachedGet('/promotions', params, 15000, 120000),
  getOne: (id) => api.get(`/promotions/${id}`),
  create: (data) => api.post('/promotions', data),
  update: (id, data) => api.put(`/promotions/${id}`, data),
  toggle: (id) => api.post(`/promotions/${id}/toggle`),
  remove: (id) => api.delete(`/promotions/${id}`),
};

// Inventory Count APIs
export const inventoryCount = {
  getSessions: (params = {}) => cachedGet('/inventory-counts', params, 10000, 60000),
  getSessionDetail: (id) => api.get(`/inventory-counts/${id}`),
  createSession: (data) => api.post('/inventory-counts', data),
  addCount: (sessionId, data) => api.post(`/inventory-counts/${sessionId}/count`, data),
  finalize: (sessionId, data = {}) => api.post(`/inventory-counts/${sessionId}/finalize`, data),
};

// Report APIs
export const reports = {
  revenueTrend: (params = {}) => cachedGet('/reports/revenue-trend', params, 30000, 300000),
  topProducts: (params = {}) => cachedGet('/reports/top-products', params, 30000, 300000),
  customerAcquisition: (params = {}) => cachedGet('/reports/customer-acquisition', params, 30000, 300000),
  summary: (params = {}) => cachedGet('/reports/summary', params, 30000, 300000),
};

// Attendance APIs (timbrature dipendenti)
export const attendance = {
  getList:           (params = {}) => api.get('/attendance', { params }),
  getLive:           (params = {}) => api.get('/attendance/live', { params }),
  getEmployeesKiosk: (params = {}) => api.get('/attendance/employees-for-kiosk', { params }),
  checkIn:           (data)        => api.post('/attendance/checkin', data),
  checkOut:          (data)        => api.post('/attendance/checkout', data),
};

export default api;

export { clearApiCache };
