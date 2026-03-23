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
};

const prefetched = new Set();

export const prefetchRoute = (path) => {
  const loader = routeLoaders[path];
  if (!loader || prefetched.has(path)) {
    return;
  }

  prefetched.add(path);
  loader().catch(() => {
    prefetched.delete(path);
  });
};
