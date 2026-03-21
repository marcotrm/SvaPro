import React, { useState, useEffect } from 'react';
import { orders, customers, inventory } from '../api.jsx';
import { Plus } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import OrderModal from '../components/OrderModal.jsx';

export default function OrdersPage() {
  const [ordersList, setOrdersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await orders.getOrders();
      setOrdersList(response.data.data || []);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento degli ordini');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    setSelectedOrder(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedOrder(null);
  };

  const handleSaveOrder = async () => {
    await fetchOrders();
    handleCloseModal();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Ordini</h1>
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus size={20} />
          Nuovo Ordine
        </button>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchOrders} />}

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-700">ID</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Cliente</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Magazzino</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Totale</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Punti Loyalty</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Stato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {ordersList.length > 0 ? (
              ordersList.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">#{order.id}</td>
                  <td className="px-6 py-3 text-gray-600">
                    {order.customer?.first_name} {order.customer?.last_name}
                  </td>
                  <td className="px-6 py-3 text-gray-600">{order.warehouse?.name || '-'}</td>
                  <td className="px-6 py-3 font-medium text-gray-900">€{order.grand_total?.toFixed(2)}</td>
                  <td className="px-6 py-3">{order.loyalty_points_awarded || 0}</td>
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
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  Nessun ordine trovato
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <OrderModal
          order={selectedOrder}
          onClose={handleCloseModal}
          onSave={handleSaveOrder}
        />
      )}
    </div>
  );
}
