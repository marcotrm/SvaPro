import React, { useState, useEffect } from 'react';
import { employees } from '../api.jsx';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import EmployeeModal from '../components/EmployeeModal.jsx';

export default function EmployeesPage() {
  const [employeesList, setEmployeesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await employees.getEmployees();
      setEmployeesList(response.data.data || []);
    } catch (err) {
      setError(err.message || 'Erro nel caricamento dei dipendenti');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (employee = null) => {
    setSelectedEmployee(employee);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedEmployee(null);
  };

  const handleSaveEmployee = async () => {
    await fetchEmployees();
    handleCloseModal();
  };

  const filteredEmployees = employeesList.filter(e =>
    e.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dipendenti</h1>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus size={20} />
          Nuovo Dipendente
        </button>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchEmployees} />}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Cerca per nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Nome</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Magazzino</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Data Assunzione</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Stato</th>
              <th className="px-6 py-3 text-center font-medium text-gray-700">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">
                    {employee.first_name} {employee.last_name}
                  </td>
                  <td className="px-6 py-3 text-gray-600">{employee.store?.name || '-'}</td>
                  <td className="px-6 py-3 text-gray-600">
                    {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('it-IT') : '-'}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      employee.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {employee.status === 'active' ? 'Attivo' : 'Inattivo'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleOpenModal(employee)}
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
                  Nessun dipendente trovato
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <EmployeeModal
          employee={selectedEmployee}
          onClose={handleCloseModal}
          onSave={handleSaveEmployee}
        />
      )}
    </div>
  );
}
