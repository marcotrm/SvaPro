import React, { useEffect, useState, useRef } from 'react';
import { X, Loader, Shield, ScanBarcode, Camera, Upload, Link, UserCheck, Search } from 'lucide-react';
import { employees, rolesPermissions } from '../api.jsx';
import DatePicker from './DatePicker.jsx';

const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition";
const labelClass = "block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide";

export default function EmployeeModal({ employee, storesList = [], selectedStoreId = '', onClose, onSave }) {
  const [formData, setFormData] = useState({
    store_id: employee?.store_id || selectedStoreId || '',
    first_name: employee?.first_name || '',
    last_name: employee?.last_name || '',
    barcode: employee?.barcode || '',
    employee_code: employee?.employee_code || '',
    max_spending_limit: employee?.max_spending_limit || '',
    price_list_id: employee?.price_list_id || '',
    hire_date: employee?.hire_date || '',
    status: employee?.status || 'active',
    photo_url: employee?.photo_url || '',
    user_id: employee?.user_id || '',
  });
  const [usersList, setUsersList]     = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch]   = useState('');
  const [activeTab, setActiveTab] = useState('profilo');
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
      employee_code: employee?.employee_code || '',
      max_spending_limit: employee?.max_spending_limit || '',
      price_list_id: employee?.price_list_id || '',
      hire_date: employee?.hire_date || '',
      status: employee?.status || 'active',
      photo_url: employee?.photo_url || '',
      user_id: employee?.user_id || '',
    });
    setPhotoPreview(employee?.photo_url || null);
    setFieldErrors({});
    setError('');
    setUserSearch('');
  }, [employee, selectedStoreId]);

  // Carica lista utenti del tenant per il collegamento account
  useEffect(() => {
    setUsersLoading(true);
    rolesPermissions.listUsers()
      .then(res => setUsersList(res.data?.data || res.data || []))
      .catch(() => {})
      .finally(() => setUsersLoading(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors(prev => ({ ...prev, [name]: null }));
  };

  // Ridimensiona a max 200x200px, qualità JPEG 0.82 — funziona con qualsiasi dimensione
  const compressImage = (file) => new Promise((resolve, reject) => {
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
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Errore caricamento immagine')); };
    img.src = url;
  });

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Nessun limite di dimensione: comprimiamo sempre automaticamente
    try {
      const compressed = await compressImage(file);
      setPhotoPreview(compressed);
      setFormData(prev => ({ ...prev, photo_url: compressed }));
    } catch {
      setError('Impossibile leggere la foto. Prova un altro file.');
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
      // Normalizza user_id: stringa vuota → null, stringa numerica → intero
      payload.user_id = formData.user_id ? Number(formData.user_id) : null;

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
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '90vh' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <h2 className="text-xl font-bold text-gray-900">
              {employee ? 'Modifica Dipendente' : 'Nuovo Dipendente'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex border-b border-gray-100 px-6 shrink-0 pt-2 gap-6 relative">
            <button
              onClick={() => setActiveTab('profilo')}
              className={`pb-3 text-sm font-bold transition-colors relative ${activeTab === 'profilo' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Profilo
              {activeTab === 'profilo' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />}
            </button>
            <button
              onClick={() => setActiveTab('acquisti')}
              className={`pb-3 text-sm font-bold transition-colors relative ${activeTab === 'acquisti' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Impostazioni Acquisti
              {activeTab === 'acquisti' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />}
            </button>
            <button
              onClick={() => setActiveTab('account')}
              className={`pb-3 text-sm font-bold transition-colors relative flex items-center gap-1.5 ${activeTab === 'account' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Link size={12} />
              Account
              {formData.user_id && <span style={{ width:7, height:7, borderRadius:'50%', background:'#10B981', display:'inline-block', marginLeft:2 }} />}
              {activeTab === 'account' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
              <Shield size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {activeTab === 'profilo' && (
            <>
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
              onChange={(date) => setFormData(prev => ({...prev, hire_date: date}))}
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
            </>
          )}

          {activeTab === 'account' && (() => {
            const linkedUser = usersList.find(u => String(u.id) === String(formData.user_id));
            const filtered = usersList.filter(u => {
              const q = userSearch.toLowerCase();
              return !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
            });
            return (
              <>
                {/* Banner stato collegamento */}
                <div style={{
                  padding: '14px 16px', borderRadius: 14, marginBottom: 16,
                  background: linkedUser ? 'rgba(16,185,129,0.07)' : 'rgba(99,102,241,0.06)',
                  border: `1px solid ${linkedUser ? 'rgba(16,185,129,0.25)' : 'rgba(99,102,241,0.18)'}`,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: linkedUser ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <UserCheck size={20} color={linkedUser ? '#10B981' : '#6366F1'} />
                  </div>
                  <div>
                    {linkedUser ? (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#065F46' }}>Account collegato ✓</div>
                        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{linkedUser.name} — {linkedUser.email}</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#4338CA' }}>Nessun account collegato</div>
                        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Collega un account per abilitare il login come questo dipendente.</div>
                      </>
                    )}
                  </div>
                </div>

                {/* Search + Select utente */}
                <div className="space-y-3">
                  <label className={labelClass} style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <Link size={12} /> Collega Account di Accesso
                  </label>

                  {/* Campo ricerca */}
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'#9ca3af', pointerEvents:'none' }} />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      placeholder="Cerca per nome o email..."
                      className={inputClass}
                      style={{ paddingLeft: 34 }}
                    />
                  </div>

                  {usersLoading ? (
                    <div style={{ textAlign:'center', padding: '16px 0', color:'#9ca3af', fontSize:13 }}>
                      <Loader size={18} style={{ display:'inline', animation:'spin 1s linear infinite', marginRight:6 }} />
                      Caricamento utenti...
                    </div>
                  ) : (
                    <div style={{ maxHeight: 220, overflowY:'auto', border:'1px solid #e5e7eb', borderRadius:10, background:'#fafafa' }}>
                      {/* Opzione "Nessuno" */}
                      <button
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, user_id: '' }))}
                        style={{
                          width:'100%', padding:'10px 14px', textAlign:'left', display:'flex',
                          alignItems:'center', gap:10, background: !formData.user_id ? '#EEF2FF' : 'transparent',
                          border:'none', borderBottom:'1px solid #f3f4f6', cursor:'pointer',
                          color: !formData.user_id ? '#4338CA' : '#6B7280', fontWeight: !formData.user_id ? 700 : 400, fontSize:13,
                        }}
                      >
                        <span style={{ width:28, height:28, borderRadius:'50%', background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>—</span>
                        <span>Nessun account (non collegato)</span>
                        {!formData.user_id && <span style={{ marginLeft:'auto', fontSize:11, color:'#6366F1' }}>✓ selezionato</span>}
                      </button>

                      {filtered.map(u => {
                        const isSelected = String(u.id) === String(formData.user_id);
                        const initials = (u.name || u.email || '?').slice(0, 2).toUpperCase();
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => setFormData(p => ({ ...p, user_id: String(u.id) }))}
                            style={{
                              width:'100%', padding:'10px 14px', textAlign:'left', display:'flex',
                              alignItems:'center', gap:10, background: isSelected ? '#EEF2FF' : 'transparent',
                              border:'none', borderBottom:'1px solid #f9fafb', cursor:'pointer',
                              transition:'background 0.1s',
                            }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background='#f5f3ff'; }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background='transparent'; }}
                          >
                            <div style={{
                              width:28, height:28, borderRadius:'50%', background: isSelected ? '#6366F1' : '#e5e7eb',
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:11, fontWeight:800, color: isSelected ? '#fff' : '#6B7280', flexShrink:0,
                            }}>{initials}</div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:13, fontWeight:700, color: isSelected ? '#4338CA' : '#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.name}</div>
                              <div style={{ fontSize:11, color:'#9ca3af', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.email}</div>
                              {u.roles && <div style={{ fontSize:10, color:'#c4b5fd', marginTop:1 }}>{Array.isArray(u.roles) ? u.roles.map(r=>r.code||r.name||r).join(', ') : u.roles}</div>}
                            </div>
                            {isSelected && <span style={{ fontSize:11, color:'#6366F1', fontWeight:700, flexShrink:0 }}>✓</span>}
                          </button>
                        );
                      })}
                      {filtered.length === 0 && !usersLoading && (
                        <div style={{ padding:'16px', textAlign:'center', fontSize:13, color:'#9ca3af' }}>Nessun utente trovato</div>
                      )}
                    </div>
                  )}

                  <p style={{ fontSize: 11, color: '#9ca3af' }}>
                    💡 Collega l'account di login del dipendente per abilitare il riconoscimento automatico nel POS e nella pianificazione turni.
                  </p>
                </div>
              </>
            );
          })()}

          {activeTab === 'acquisti' && (
            <>
              <div>
                <label className={labelClass}>Codice Acquisto Operatore</label>
                <input
                  type="text"
                  name="employee_code"
                  value={formData.employee_code}
                  onChange={handleChange}
                  placeholder="Codice utilizzato in cassa"
                  className={`${inputClass} font-mono tracking-widest ${fe('employee_code') ? 'border-red-400' : ''}`}
                />
                {fe('employee_code') && <p className="mt-1 text-xs text-red-500">{fe('employee_code')}</p>}
                <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Un codice supplementare, utile per abilitare l'operatore agli acquisti a costo.</p>
              </div>

              <div>
                <label className={labelClass}>Limite di Spesa Massimo (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="max_spending_limit"
                  value={formData.max_spending_limit}
                  onChange={handleChange}
                  placeholder="Es. 150.00"
                  className={`${inputClass} ${fe('max_spending_limit') ? 'border-red-400' : ''}`}
                />
                {fe('max_spending_limit') && <p className="mt-1 text-xs text-red-500">{fe('max_spending_limit')}</p>}
              </div>

              <div>
                <label className={labelClass}>Listino Dipendenti</label>
                <input
                  type="number"
                  name="price_list_id"
                  value={formData.price_list_id}
                  onChange={handleChange}
                  placeholder="ID listino"
                  className={`${inputClass} ${fe('price_list_id') ? 'border-red-400' : ''}`}
                />
                {fe('price_list_id') && <p className="mt-1 text-xs text-red-500">{fe('price_list_id')}</p>}
                <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Specifica l'ID del listino prezzi decurtato da applicare.</p>
              </div>
            </>
          )}

          </div>

          <div className="flex gap-3 justify-end pt-6 px-6 pb-6 border-t border-gray-100 shrink-0">
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
