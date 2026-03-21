import React, { useState, useEffect } from 'react';
import { loyalty, customers } from '../api.jsx';
import { TrendingUp, Gift } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function LoyaltyAnalyticsPage() {
  const [customersList, setCustomersList] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await customers.getCustomers();
      setCustomersList(response.data.data || []);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento dei clienti');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCustomer = async (customer) => {
    setSelectedCustomer(customer);
    try {
      const response = await loyalty.getWallet(customer.id);
      setWallet(response.data.wallet);
    } catch (err) {
      console.error('Error fetching wallet:', err);
      setWallet(null);
    }
  };

  const COLORS = ['#4f46e5', '#06b6d4', '#ec4899', '#f59e0b'];

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Loyalty Analytics</h1>
        <p className="text-gray-500 mt-1">Gestione programma fedeltà e punti clienti</p>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchCustomers} />}

      {/* Customer Selection */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Seleziona Cliente</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {customersList.map((customer) => (
            <button
              key={customer.id}
              onClick={() => handleSelectCustomer(customer)}
              className={`p-3 rounded-lg border-2 transition text-left ${
                selectedCustomer?.id === customer.id
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-200 bg-white hover:border-indigo-300'
              }`}
            >
              <p className="font-medium text-gray-900">{customer.first_name} {customer.last_name}</p>
              <p className="text-xs text-gray-500">{customer.code}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Wallet Info */}
      {selectedCustomer && wallet && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Points */}
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg shadow-sm border border-indigo-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-700">Punti Totali</p>
                <p className="text-3xl font-bold text-indigo-600 mt-2">{wallet.current_points || 0}</p>
              </div>
              <Gift className="text-indigo-300" size={40} />
            </div>
          </div>

          {/* Monetary Value */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-sm border border-green-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">Valore Monetario</p>
                <p className="text-3xl font-bold text-green-600 mt-2">€{((wallet.current_points || 0) * 0.05).toFixed(2)}</p>
              </div>
              <TrendingUp className="text-green-300" size={40} />
            </div>
          </div>

          {/* Status */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow-sm border border-purple-200 p-6">
            <p className="text-sm font-medium text-purple-700">Stato Carta</p>
            <p className="text-lg font-bold text-purple-600 mt-2 capitalize">
              {wallet.card_status || 'Attiva'}
            </p>
            <p className="text-xs text-purple-600 mt-2">
              {wallet.card_number ? `•••• ${wallet.card_number.slice(-4)}` : 'Validazione richiesta'}
            </p>
          </div>
        </div>
      )}

      {/* Ledger */}
      {selectedCustomer && wallet && wallet.ledger && wallet.ledger.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Cronologia Punti</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">Data</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">Tipo</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">Punti</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {wallet.ledger.map((entry, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-600">
                      {new Date(entry.created_at).toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        entry.type === 'earn'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {entry.type === 'earn' ? 'Guadagna' : 'Utilizzo'}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-medium text-gray-900">{entry.points}</td>
                    <td className="px-6 py-3 text-gray-600">{entry.description || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Selection Message */}
      {!selectedCustomer && (
        <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <Gift className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-600 font-medium">Seleziona un cliente per vedere i dettagli del programma fedeltà</p>
        </div>
      )}
    </div>
  );
}
