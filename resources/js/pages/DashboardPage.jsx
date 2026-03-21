import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { orders, inventory, customers, employees, loyalty } from '../api.jsx';
import { TrendingUp, AlertCircle, ShoppingCart, Package, Users, Briefcase, Zap } from 'lucide-react';
import StatCard from '../components/StatCard.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    lowStockItems: 0,
    activeCustomers: 0,
    activeEmployees: 0,
    recentOrders: [],
  });
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch all data in parallel
      const [ordersRes, inventoryRes, customersRes, employeesRes, smartResRes] = await Promise.all([
        orders.getOrders().catch(() => ({})),
        inventory.getStock().catch(() => ({})),
        customers.getCustomers().catch(() => ({})),
        employees.getEmployees().catch(() => ({})),
        inventory.getSmartReorderPreview().catch(() => ({})),
      ]);

      // Calculate totals
      const ordersList = ordersRes.data?.data || [];
      const stockList = inventoryRes.data?.data || [];
      const customersList = customersRes.data?.data || [];
      const employeesList = employeesRes.data?.data || [];
      const smartAlerts = smartResRes.data?.alerts || [];

      const totalRevenue = ordersList.reduce((sum, order) => sum + (order.grand_total || 0), 0);
      const lowStockItems = stockList.filter(item => item.on_hand < item.reorder_point).length;

      setData({
        totalOrders: ordersList.length,
        totalRevenue: totalRevenue,
        lowStockItems: lowStockItems,
        activeCustomers: customersList.length,
        activeEmployees: employeesList.length,
        recentOrders: ordersList.slice(0, 5),
      });

      setAlerts(smartAlerts || []);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento dei dati');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Benvenuto nel gestionale SvaPro</p>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold text-amber-900">Stock Bassi</h3>
              <p className="text-sm text-amber-800 mt-1">
                {alerts.length} prodotto/i hanno stock inferiore alla soglia di riordino
              </p>
              <button
                onClick={() => navigate('/inventory/smart-reorder')}
                className="mt-2 text-sm font-medium text-amber-600 hover:text-amber-700"
              >
                Visualizza Smart Reorder →
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <ErrorAlert message={error} onRetry={fetchDashboardData} />}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Ordini Totali"
          value={data.totalOrders}
          icon={ShoppingCart}
          color="blue"
        />
        <StatCard
          title="Ricavi"
          value={`€${data.totalRevenue.toFixed(2)}`}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Stock Basso"
          value={data.lowStockItems}
          icon={Zap}
          color="red"
          onClick={() => navigate('/inventory')}
        />
        <StatCard
          title="Clienti"
          value={data.activeCustomers}
          icon={Users}
          color="purple"
          onClick={() => navigate('/customers')}
        />
        <StatCard
          title="Dipendenti"
          value={data.activeEmployees}
          icon={Briefcase}
          color="indigo"
          onClick={() => navigate('/employees')}
        />
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Ordini Recenti</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-700">ID</th>
                <th className="px-6 py-3 text-left font-medium text-gray-700">Cliente</th>
                <th className="px-6 py-3 text-left font-medium text-gray-700">Totale</th>
                <th className="px-6 py-3 text-left font-medium text-gray-700">Stato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.recentOrders.length > 0 ? (
                data.recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">#{order.id}</td>
                    <td className="px-6 py-3 text-gray-600">
                      {order.customer?.first_name} {order.customer?.last_name}
                    </td>
                    <td className="px-6 py-3 font-medium text-gray-900">
                      €{order.grand_total?.toFixed(2)}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        order.status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : order.status === 'draft'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {order.status === 'paid' ? 'Pagato' : order.status === 'draft' ? 'Bozza' : 'Pendente'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                    Nessun ordine trovato
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/orders')}
          className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition text-left"
        >
          <h3 className="font-semibold text-indigo-900">Crea Nuovo Ordine</h3>
          <p className="text-sm text-indigo-700 mt-1">Aggiungi un nuovo ordine di vendita</p>
        </button>
        <button
          onClick={() => navigate('/inventory/smart-reorder')}
          className="p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition text-left"
        >
          <h3 className="font-semibold text-purple-900">Smart Reorder</h3>
          <p className="text-sm text-purple-700 mt-1">Gestisci ordini automatici di magazzino</p>
        </button>
      </div>
    </div>
  );
}
