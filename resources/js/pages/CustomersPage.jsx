import React, { useState, useEffect } from 'react';
import { customers } from '../api.jsx';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import CustomerModal from '../components/CustomerModal.jsx';

export default function CustomersPage() {
  const [customersList, setCustomersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  const handleOpenModal = (customer = null) => {
    setSelectedCustomer(customer);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedCustomer(null);
  };

  const handleSaveCustomer = async () => {
    await fetchCustomers();
    handleCloseModal();
  };

  const filteredCustomers = customersList.filter(c =>
    c.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Clienti</h1>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus size={20} />
          Nuovo Cliente
        </button>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchCustomers} />}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Cerca per nome, email o codice..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Codice</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Nome</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Email</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Telefono</th>
              <th className="px-6 py-3 text-center font-medium text-gray-700">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{customer.code}</td>
                  <td className="px-6 py-3 text-gray-600">{customer.first_name} {customer.last_name}</td>
                  <td className="px-6 py-3 text-gray-600">{customer.email}</td>
                  <td className="px-6 py-3 text-gray-600">{customer.phone || '-'}</td>
                  <td className="px-6 py-3 text-center flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleOpenModal(customer)}
                      className="text-indigo-600 hover:text-indigo-700"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button className="text-red-600 hover:text-red-700">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                  Nessun cliente trovato
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <CustomerModal
          customer={selectedCustomer}
          onClose={handleCloseModal}
          onSave={handleSaveCustomer}
        />
      )}
    </div>
  );
}
