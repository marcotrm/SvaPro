import React, { useState, useEffect } from 'react';
import { inventory } from '../api.jsx';
import { AlertCircle, Play, Eye } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';

export default function SmartReorderPage() {
  const [alerts, setAlerts] = useState([]);
  const [suggestedOrders, setSuggestedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRun, setLoadingRun] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchPreview();
  }, []);

  const fetchPreview = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await inventory.getSmartReorderPreview();
      setAlerts(response.data.alerts || []);
      setSuggestedOrders(response.data.suggested_orders || []);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento della preview');
    } finally {
      setLoading(false);
    }
  };

  const handleRunSmartReorder = async () => {
    try {
      setLoadingRun(true);
      setError('');
      setSuccess('');
      const response = await inventory.runSmartReorder();
      setSuccess(`${response.data.orders_created || 0} ordine/i creato/i con successo`);
      setTimeout(() => {
        fetchPreview();
        setSuccess('');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Errore nell\'esecuzione dello smart reorder');
    } finally {
      setLoadingRun(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Smart Inventory Reorder</h1>
          <p className="text-gray-500 mt-1">Gestione automatica degli ordini di magazzino</p>
        </div>
        <button
          onClick={handleRunSmartReorder}
          disabled={loadingRun || alerts.length === 0}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play size={20} />
          {loadingRun ? 'Esecuzione...' : 'Esegui Reorder'}
        </button>
      </div>

      {/* Messages */}
      {error && <ErrorAlert message={error} onRetry={fetchPreview} />}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <div className="text-green-600">✓</div>
          <p className="text-green-800 font-medium">{success}</p>
        </div>
      )}

      {/* Alerts Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-amber-900">Stock Basso Rilevato</h3>
            <p className="text-sm text-amber-800 mt-1">
              {alerts.length} prodotto/i con stock inferiore alla soglia di riordino
            </p>
          </div>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Avvisi Stock Basso</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Magazzino</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Prodotto</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Disponibile</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Soglia</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Venduto (30gg)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {alerts.length > 0 ? (
              alerts.map((alert, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{alert.store_name}</td>
                  <td className="px-6 py-3 text-gray-600">{alert.product_name}</td>
                  <td className="px-6 py-3">{alert.on_hand} unità</td>
                  <td className="px-6 py-3">{alert.reorder_point} unità</td>
                  <td className="px-6 py-3">{alert.sold_qty || 0} unità</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                  Nessun avviso stock basso
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Suggested Orders */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Ordini Suggeriti</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Magazzino</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Fornitore</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Prodotto</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Quantità</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Costo Unitario</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Totale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {suggestedOrders.length > 0 ? (
              suggestedOrders.map((order, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{order.store_name}</td>
                  <td className="px-6 py-3 text-gray-600">{order.supplier_name}</td>
                  <td className="px-6 py-3 text-gray-600">{order.product_name}</td>
                  <td className="px-6 py-3 font-medium text-gray-900">{order.suggested_qty}</td>
                  <td className="px-6 py-3">€{order.unit_cost?.toFixed(2)}</td>
                  <td className="px-6 py-3 font-medium text-gray-900">€{(order.suggested_qty * order.unit_cost)?.toFixed(2)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  Nessun ordine suggerito
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {suggestedOrders.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-indigo-900">Totale Investimento</h3>
              <p className="text-sm text-indigo-700 mt-1">Costo totale di tutti gli ordini suggeriti</p>
            </div>
            <div className="text-3xl font-bold text-indigo-600">
              €{suggestedOrders.reduce((sum, o) => sum + (o.suggested_qty * o.unit_cost), 0).toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
