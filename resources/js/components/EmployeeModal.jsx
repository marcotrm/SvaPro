import React, { useEffect, useState, useRef } from 'react';
import { X, Loader, Shield, ScanBarcode, Camera, Upload } from 'lucide-react';
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
    photo_url: employee?.photo_url || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [photoPreview, setPhotoPreview] = useState(employee?.photo_url || null);
  const photoInputRef = useRef(null);

  useEffect(() => {
    setFormData({
      store_id: employee?.store_id || selectedStoreId || '',
      first_name: employee?.first_name || '',
      last_name: employee?.last_name || '',
      barcode: employee?.barcode || '',
      hire_date: employee?.hire_date || '',
      status: employee?.status || 'active',
      photo_url: employee?.photo_url || '',
    });
    setPhotoPreview(employee?.photo_url || null);
    setFieldErrors({});
    setError('');
  }, [employee, selectedStoreId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors(prev => ({ ...prev, [name]: null }));
  };

  // Ridimensiona e comprime l'immagine a max 200x200px, qualità 0.80
  const compressImage = (file) => new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.80));
    };
    img.src = url;
  });

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Foto troppo grande. Max 5MB.');
      return;
    }
    try {
      const compressed = await compressImage(file);
      setPhotoPreview(compressed);
      setFormData(prev => ({ ...prev, photo_url: compressed }));
    } catch {
      setError('Errore nella lettura della foto.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      setFieldErrors({});

      const isNew = !employee?.id;
      const payload = { ...formData }; // photo_url base64 incluso

      if (employee?.id) {
        await employees.updateEmployee(employee.id, payload);
        onSave(isNew, { ...payload, id: employee.id });
      } else {
        await employees.createEmployee(payload);
        onSave(isNew, null);
      }
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
  const initials = `${formData.first_name?.[0] || ''}${formData.last_name?.[0] || ''}`.toUpperCase() || '?';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
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

          {/* ── FOTO PROFILO ── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingBottom: 8 }}>
            {/* Avatar / preview */}
            <div
              onClick={() => photoInputRef.current?.click()}
              style={{
                width: 96, height: 96, borderRadius: '50%', cursor: 'pointer',
                background: photoPreview ? 'transparent' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '3px solid #e5e7eb', overflow: 'hidden', position: 'relative',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)', transition: 'transform 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 32, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{initials}</span>
              )}
              {/* Camera overlay on hover */}
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0, transition: 'opacity 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0'}
              >
                <Camera size={24} color="#fff" />
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb',
                  background: '#f9fafb', color: '#4b5563', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <Upload size={13} />
                {photoPreview ? 'Cambia foto' : 'Carica foto'}
              </button>
              {photoPreview && (
                <button
                  type="button"
                  onClick={() => { setPhotoPreview(null); setPhotoFile(null); setFormData(p => ({ ...p, photo_url: '' })); }}
                  style={{
                    marginLeft: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid #fecaca',
                    background: '#fef2f2', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Rimuovi
                </button>
              )}
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>JPG, PNG — max 2MB. La foto appare nel profilo e nelle timbrature.</p>
            </div>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoChange}
            />
          </div>

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
              <span className="text-gray-400 font-normal normal-case">(scanner POS / timbra)</span>
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
