import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './api.jsx';

// Pages
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const CatalogPage = lazy(() => import('./pages/CatalogPage.jsx'));
const OrdersPage = lazy(() => import('./pages/OrdersPage.jsx'));
const StockAlertsPage = lazy(() => import('./pages/StockAlertsPage.jsx'));
const InventoryPage = lazy(() => import('./pages/InventoryPage.jsx'));
const CustomersPage = lazy(() => import('./pages/CustomersPage.jsx'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage.jsx'));
const SmartReorderPage = lazy(() => import('./pages/SmartReorderPage.jsx'));
const LoyaltyAnalyticsPage = lazy(() => import('./pages/LoyaltyAnalyticsPage.jsx'));
const LoyaltyPushMonitoringPage = lazy(() => import('./pages/LoyaltyPushMonitoringPage.jsx'));
const ControlTowerPage = lazy(() => import('./pages/ControlTowerPage.jsx'));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const RolesPermissionsPage = lazy(() => import('./pages/RolesPermissionsPage.jsx'));
const InvoicesPage = lazy(() => import('./pages/InvoicesPage.jsx'));
const ReportsPage = lazy(() => import('./pages/ReportsPage.jsx'));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage.jsx'));
const PurchaseOrdersPage = lazy(() => import('./pages/PurchaseOrdersPage.jsx'));
const ReturnsPage = lazy(() => import('./pages/ReturnsPage.jsx'));
const SupplierInvoicesPage = lazy(() => import('./pages/SupplierInvoicesPage.jsx'));
const PosPage = lazy(() => import('./pages/PosPage.jsx'));
const ShippingPage = lazy(() => import('./pages/ShippingPage.jsx'));
import LoyaltyCardPage from './pages/LoyaltyCardPage.jsx';
const PromotionsPage = lazy(() => import('./pages/PromotionsPage.jsx'));
const LoyaltyTiersPage = lazy(() => import('./pages/LoyaltyTiersPage.jsx'));
const EmployeeKpiPage = lazy(() => import('./pages/EmployeeKpiPage.jsx'));
const InventoryCountPage = lazy(() => import('./pages/InventoryCountPage.jsx'));
const CategoryPage = lazy(() => import('./pages/CategoryPage.jsx'));

const EmployeePurchasesPage = lazy(() => import('./pages/EmployeePurchasesPage.jsx'));

// Components
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const token = localStorage.getItem('authToken');
      const raw = localStorage.getItem('user');
      if (token && raw) return JSON.parse(raw);
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(() => {
    return !(localStorage.getItem('authToken') && localStorage.getItem('user'));
  });

  const routeFallback = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
      <div style={{ width: 28, height: 28, border: '3px solid #0e1726', borderTopColor: '#c9a227', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
    </div>
  );

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('authToken');
      if (token) {
        try {
          // Timeout di 8 secondi per evitare caricamento infinito via tunnel
          const controller = new AbortController();
          const timerId = setTimeout(() => controller.abort(), 8000);
          
          const response = await auth.me();
          clearTimeout(timerId);
          setUser(response.data);
          localStorage.setItem('user', JSON.stringify(response.data));
          if (response.data?.tenant_code) {
            localStorage.setItem('tenantCode', response.data.tenant_code);
          }
        } catch (error) {
          // Se è un timeout o errore di rete, prova a usare l'utente salvato in cache
          const cachedUser = localStorage.getItem('user');
          if (cachedUser && error.name !== 'AuthenticationError') {
            try {
              setUser(JSON.parse(cachedUser));
            } catch {}
          } else {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            localStorage.removeItem('tenantCode');
            localStorage.removeItem('selectedStoreId');
            setUser(null);
          }
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--color-bg, #F5F5F7)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, border: '3px solid #E5E7EB', borderTopColor: '#0066FF', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#6B7280', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>Caricamento SvaPro...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Suspense fallback={routeFallback}>
        <Routes>
          <Route path="/loyalty-card/:uuid" element={<LoyaltyCardPage />} />
          <Route path="/login" element={<LoginPage setUser={setUser} />} />
          
          <Route element={<ProtectedRoute user={user} />}>
            <Route element={<Layout user={user} setUser={setUser} />}>
              <Route path="/" element={<PosPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/catalog/categories" element={<CategoryPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/stock-alerts" element={<StockAlertsPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/inventory/smart-reorder" element={<SmartReorderPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/employees" element={<EmployeesPage />} />
              <Route path="/employee-purchases" element={<EmployeePurchasesPage />} />
              <Route path="/analytics/loyalty" element={<LoyaltyAnalyticsPage />} />
              <Route path="/analytics/loyalty/push-monitor" element={<LoyaltyPushMonitoringPage />} />
              <Route path="/control-tower" element={<ControlTowerPage />} />
              <Route path="/audit-log" element={<AuditLogPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/roles-permissions" element={<RolesPermissionsPage />} />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
              <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
              <Route path="/returns" element={<ReturnsPage />} />
              <Route path="/supplier-invoices" element={<SupplierInvoicesPage />} />
              <Route path="/pos" element={<PosPage />} />
              <Route path="/shipping" element={<ShippingPage />} />
              <Route path="/promotions" element={<PromotionsPage />} />
              <Route path="/loyalty/tiers" element={<LoyaltyTiersPage />} />
              <Route path="/employees/kpi" element={<EmployeeKpiPage />} />
              <Route path="/inventory/count" element={<InventoryCountPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
