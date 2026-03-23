import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './api.jsx';

// Pages
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import EmployeesPage from './pages/EmployeesPage.jsx';
import SmartReorderPage from './pages/SmartReorderPage.jsx';
import LoyaltyAnalyticsPage from './pages/LoyaltyAnalyticsPage.jsx';
import LoyaltyPushMonitoringPage from './pages/LoyaltyPushMonitoringPage.jsx';

// Components
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const token = localStorage.getItem('authToken');
      if (token) {
        try {
          const response = await auth.me();
          setUser(response.data);
          localStorage.setItem('user', JSON.stringify(response.data));
        } catch (error) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          localStorage.removeItem('tenantCode');
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
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
