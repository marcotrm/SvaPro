import React, { useState, useEffect } from 'react';
import { inventory } from '../api.jsx';
import { AlertCircle } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';

export default function InventoryPage() {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);

  useEffect(() => {
    fetchStock();
  }, []);

  const fetchStock = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await inventory.getStock();
      setStock(response.data.data || []);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento dello stock');
    } finally {
      setLoading(false);
    }
  };

  const filteredStock = filterLowStock
    ? stock.filter(item => item.on_hand < item.reorder_point)
    : stock;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Magazzino</h1>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterLowStock}
              onChange={(e) => setFilterLowStock(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium text-gray-700">Mostra solo stock basso</span>
          </label>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchStock} />}

      {/* Alerts */}
      {stock.filter(item => item.on_hand < item.reorder_point).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="text-amber-600 flex-shrink-0" size={20} />
          <div>
            <h3 className="font-semibold text-amber-900">Articoli in Stock Basso</h3>
            <p className="text-sm text-amber-800">
              {stock.filter(item => item.on_hand < item.reorder_point).length} articolo/i sotto il punto di riordino
            </p>
          </div>
        </div>
      )}

      {/* Stock Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Prodotto</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Magazzino</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Disponibile</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Riservato</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Punto Riordino</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Stato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredStock.length > 0 ? (
              filteredStock.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">
                    {item.product_variant?.product?.name}
                    {item.product_variant?.name && ` - ${item.product_variant.name}`}
                  </td>
                  <td className="px-6 py-3 text-gray-600">{item.warehouse?.name}</td>
                  <td className="px-6 py-3 font-medium text-gray-900">{item.on_hand}</td>
                  <td className="px-6 py-3 text-gray-600">{item.reserved || 0}</td>
                  <td className="px-6 py-3 text-gray-600">{item.reorder_point}</td>
                  <td className="px-6 py-3">
                    {item.on_hand < item.reorder_point ? (
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Stock Basso
                      </span>
                    ) : (
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  {filterLowStock ? 'Nessun articolo in stock basso' : 'Nessun articolo trovato'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
