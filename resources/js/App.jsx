import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './api.jsx';

// Pages
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const CatalogPage = lazy(() => import('./pages/CatalogPage.jsx'));
const OrdersPage = lazy(() => import('./pages/OrdersPage.jsx'));
const InventoryPage = lazy(() => import('./pages/InventoryPage.jsx'));
const CustomersPage = lazy(() => import('./pages/CustomersPage.jsx'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage.jsx'));
const SmartReorderPage = lazy(() => import('./pages/SmartReorderPage.jsx'));
const LoyaltyAnalyticsPage = lazy(() => import('./pages/LoyaltyAnalyticsPage.jsx'));
const LoyaltyPushMonitoringPage = lazy(() => import('./pages/LoyaltyPushMonitoringPage.jsx'));
const ControlTowerPage = lazy(() => import('./pages/ControlTowerPage.jsx'));

// Components
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const routeFallback = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
      <div style={{ width: 28, height: 28, border: '3px solid #243450', borderTopColor: '#c9a227', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
    </div>
  );

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const token = localStorage.getItem('authToken');
      if (token) {
        try {
          const response = await auth.me();
          setUser(response.data);
          localStorage.setItem('user', JSON.stringify(response.data));
          if (response.data?.tenant_code) {
            localStorage.setItem('tenantCode', response.data.tenant_code);
          }
        } catch (error) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          localStorage.removeItem('tenantCode');
          localStorage.removeItem('selectedStoreId');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600 font-medium">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Suspense fallback={routeFallback}>
        <Routes>
          <Route path="/login" element={<LoginPage setUser={setUser} />} />
          
          <Route element={<ProtectedRoute user={user} />}>
            <Route element={<Layout user={user} setUser={setUser} />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/inventory/smart-reorder" element={<SmartReorderPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/employees" element={<EmployeesPage />} />
              <Route path="/analytics/loyalty" element={<LoyaltyAnalyticsPage />} />
              <Route path="/analytics/loyalty/push-monitor" element={<LoyaltyPushMonitoringPage />} />
              <Route path="/control-tower" element={<ControlTowerPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
