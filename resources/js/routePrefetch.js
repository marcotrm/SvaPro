import { catalog, orders, inventory, customers, employees, loyalty, stores } from './api.jsx';

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

  // Data prefetch (warm API cache)
  const dataLoader = routeDataLoaders[path];
  if (dataLoader && !dataPrefetched.has(path)) {
    dataPrefetched.add(path);
    try { dataLoader(); } catch { /* swallow - cache will miss, page will fetch normally */ }
    // Allow re-prefetch after 10s (cache TTL is 4-10s)
    setTimeout(() => { dataPrefetched.delete(path); }, 10000);
  }
};
