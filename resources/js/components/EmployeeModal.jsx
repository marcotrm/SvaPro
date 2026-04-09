import React, { useEffect, useState, useRef } from 'react';
import { X, Loader, Shield, ScanBarcode } from 'lucide-react';
import { employees } from '../api.jsx';
import DatePicker from './DatePicker.jsx';

const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition";
const labelClass = "block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide";

export default function EmployeeModal({ employee, storesList = [], selectedStoreId = '', onClose, onSave }) {
  const [formData, setFormData] = useState({
    store_id: employee?.store_id || selectedStoreId || '',
    first_name: employee?.first_name || '',
    last_name: employee?.last_name || '',
    barcode: employee?.barcode || '',
    hire_date: employee?.hire_date || '',
    status: employee?.status || 'active',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    setFormData({
      store_id: employee?.store_id || selectedStoreId || '',
      first_name: employee?.first_name || '',
      last_name: employee?.last_name || '',
      barcode: employee?.barcode || '',
      hire_date: employee?.hire_date || '',
      status: employee?.status || 'active',
    });
    setFieldErrors({});
    setError('');
  }, [employee, selectedStoreId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors(prev => ({ ...prev, [name]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      setFieldErrors({});

      if (employee?.id) {
        await employees.updateEmployee(employee.id, formData);
      } else {
        await employees.createEmployee(formData);
      }
      onSave();
    } catch (err) {
      const serverErrors = err.response?.data?.errors;
      if (serverErrors) {
        setFieldErrors(serverErrors);
        setError('Controlla i campi evidenziati.');
      } else {
        setError(err.response?.data?.message || err.userFriendlyMessage || err.message || 'Errore sconosciuto.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fe = (field) => fieldErrors[field]?.[0];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {employee ? 'Modifica Dipendente' : 'Nuovo Dipendente'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
              <Shield size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className={labelClass}>Store *</label>
            <select
              name="store_id"
              value={formData.store_id}
              onChange={handleChange}
              className={`${inputClass} ${fe('store_id') ? 'border-red-400' : ''}`}
              required
            >
              <option value="">Seleziona store</option>
              {storesList.map((store) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
            {fe('store_id') && <p className="mt-1 text-xs text-red-500">{fe('store_id')}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Nome *</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className={`${inputClass} ${fe('first_name') ? 'border-red-400' : ''}`}
                required
              />
              {fe('first_name') && <p className="mt-1 text-xs text-red-500">{fe('first_name')}</p>}
            </div>
            <div>
              <label className={labelClass}>Cognome *</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className={`${inputClass} ${fe('last_name') ? 'border-red-400' : ''}`}
                required
              />
              {fe('last_name') && <p className="mt-1 text-xs text-red-500">{fe('last_name')}</p>}
            </div>
          </div>

          <div>
            <label className={labelClass}>Data Assunzione <span className="text-gray-400 font-normal normal-case">(opzionale)</span></label>
            <DatePicker
              name="hire_date"
              value={formData.hire_date}
              onChange={handleChange}
              placeholder="Seleziona data assunzione"
            />
            {fe('hire_date') && <p className="mt-1 text-xs text-red-500">{fe('hire_date')}</p>}
          </div>

          {/* Barcode Operatore */}
          <div>
            <label className={labelClass} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ScanBarcode size={13} /> Cod. A Barre Operatore
              <span className="text-gray-400 font-normal normal-case">(scanner POS)</span>
            </label>
            <input
              type="text"
              name="barcode"
              value={formData.barcode}
              onChange={handleChange}
              placeholder="Scansiona o digita il codice..."
              className={`${inputClass} font-mono tracking-widest ${fe('barcode') ? 'border-red-400' : ''}`}
              autoComplete="off"
            />
            {fe('barcode') && <p className="mt-1 text-xs text-red-500">{fe('barcode')}</p>}
          </div>

          <div>
            <label className={labelClass}>Stato</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="active">Attivo</option>
              <option value="inactive">Inattivo</option>
            </select>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 shadow-sm"
            >
              {loading && <Loader size={16} className="animate-spin" />}
              {employee ? 'Salva Modifiche' : 'Crea Dipendente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
