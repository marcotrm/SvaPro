import { catalog, orders, inventory, customers, employees, loyalty, stores, audit, rolesPermissions, reports, invoices } from './api.jsx';

const routeLoaders = {
  '/': () => import('./pages/DashboardPage.jsx'),
  '/catalog': () => import('./pages/CatalogPage.jsx'),
  '/orders': () => import('./pages/OrdersPage.jsx'),
  '/inventory': () => import('./pages/InventoryPage.jsx'),
  '/inventory/smart-reorder': () => import('./pages/SmartReorderPage.jsx'),
  '/customers': () => import('./pages/CustomersPage.jsx'),
  '/employees': () => import('./pages/EmployeesPage.jsx'),
  '/analytics/loyalty': () => import('./pages/LoyaltyAnalyticsPage.jsx'),
  '/analytics/loyalty/push-monitor': () => import('./pages/LoyaltyPushMonitoringPage.jsx'),
  '/control-tower': () => import('./pages/ControlTowerPage.jsx'),
  '/audit-log': () => import('./pages/AuditLogPage.jsx'),
  '/settings': () => import('./pages/SettingsPage.jsx'),
  '/roles-permissions': () => import('./pages/RolesPermissionsPage.jsx'),
  '/invoices': () => import('./pages/InvoicesPage.jsx'),
  '/reports': () => import('./pages/ReportsPage.jsx'),
};

/* Map routes to the API calls they'll make on mount.
   These fire into the cachedGet layer so data is ready by navigation time. */
const routeDataLoaders = {
  '/': () => {
    orders.getOrders({ limit: 20 });
    inventory.getStock({ limit: 80 });
    customers.getCustomers({ limit: 50 });
    employees.getEmployees({ limit: 50 });
  },
  '/catalog': () => {
    catalog.getProducts({ limit: 60 });
  },
  '/orders': () => {
    orders.getOrders({});
  },
  '/inventory': () => {
    inventory.getStock({ limit: 80 });
    inventory.getMovements({ limit: 80 });
  },
  '/inventory/smart-reorder': () => {
    inventory.getSmartReorderPreview({});
  },
  '/customers': () => {
    customers.getCustomers({ limit: 60 });
    customers.getReturnAnalytics({});
  },
  '/employees': () => {
    employees.getEmployees({ limit: 60 });
    employees.getTopPerformers({});
  },
  '/analytics/loyalty/push-monitor': () => {
    loyalty.getPushMonitoringStats({});
  },
  '/control-tower': () => {
    stores.getTenantHealth();
  },
  '/audit-log': () => {
    audit.getLogs({});
  },
  '/settings': () => {
    stores.getTenantSettings();
  },
  '/roles-permissions': () => {
    rolesPermissions.getMatrix();
  },
  '/invoices': () => {
    invoices.list({});
  },
  '/reports': () => {
    reports.summary({});
    reports.revenueTrend({ period: 'daily', days: 30 });
  },
};

const prefetched = new Set();
const dataPrefetched = new Set();

export const prefetchRoute = (path) => {
  // Code chunk prefetch
  const loader = routeLoaders[path];
  if (loader && !prefetched.has(path)) {
    prefetched.add(path);
    loader().catch(() => { prefetched.delete(path); });
  }

  // Data prefetch (warm SWR cache — stale data is already returned instantly,
  // this just ensures the cache is populated ahead of navigation)
  const dataLoader = routeDataLoaders[path];
  if (dataLoader && !dataPrefetched.has(path)) {
    dataPrefetched.add(path);
    try { dataLoader(); } catch { /* swallow */ }
    // With SWR cache (30s fresh) we can re-prefetch less often
    setTimeout(() => { dataPrefetched.delete(path); }, 30000);
  }
};

/**
 * Eagerly prefetch code + data for the most common routes.
 * Call once shortly after layout mount to warm JS chunks in the background.
 */
const EAGER_ROUTES = ['/', '/catalog', '/orders', '/inventory', '/customers', '/employees'];
let eagerDone = false;
export const eagerPrefetchAll = () => {
  if (eagerDone) return;
  eagerDone = true;
  // Stagger loads to avoid blocking the main thread
  EAGER_ROUTES.forEach((path, i) => {
    setTimeout(() => prefetchRoute(path), 50 + i * 80);
  });
};
