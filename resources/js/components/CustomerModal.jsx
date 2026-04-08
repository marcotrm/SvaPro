import React, { useState } from 'react';
import { X, Loader, User, Building2, MapPin, Mail, Phone, Calendar, Shield } from 'lucide-react';
import { customers } from '../api.jsx';

const TAB_PRIVATO = 'privato';
const TAB_AZIENDA = 'azienda';

const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition";
const labelClass = "block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide";

function FormField({ label, error, children }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function CustomerModal({ customer, onClose, onSave }) {
  const initialType = customer?.customer_type || TAB_PRIVATO;

  const [tab, setTab] = useState(initialType);
  const [formData, setFormData] = useState({
    customer_type: initialType,
    code: customer?.code || '',
    // Privato
    first_name: customer?.first_name || '',
    last_name: customer?.last_name || '',
    codice_fiscale: customer?.codice_fiscale || '',
    birth_date: customer?.birth_date || '',
    // Azienda
    company_name: customer?.company_name || '',
    vat_number: customer?.vat_number || '',
    sdi_code: customer?.sdi_code || '',
    pec_email: customer?.pec_email || '',
    contact_person: customer?.contact_person || '',
    // Comuni
    email: customer?.email || '',
    phone: customer?.phone || '',
    marketing_consent: customer?.marketing_consent || false,
    // Indirizzo
    address: customer?.address || '',
    city: customer?.city || '',
    province: customer?.province || '',
    zip_code: customer?.zip_code || '',
    country: customer?.country || 'IT',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (fieldErrors[name]) setFieldErrors(prev => ({ ...prev, [name]: null }));
  };

  const handleTabSwitch = (newTab) => {
    setTab(newTab);
    setFormData(prev => ({ ...prev, customer_type: newTab }));
    setFieldErrors({});
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      setFieldErrors({});

      const payload = { ...formData, customer_type: tab };

      if (customer?.id) {
        await customers.updateCustomer(customer.id, payload);
      } else {
        await customers.createCustomer(payload);
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {customer ? 'Modifica Cliente' : 'Nuovo Cliente'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {tab === TAB_PRIVATO ? 'Cliente privato' : 'Cliente aziendale'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
            <X size={20} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 px-6 pt-4">
          <button
            type="button"
            onClick={() => handleTabSwitch(TAB_PRIVATO)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === TAB_PRIVATO
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <User size={15} />
            Privato
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch(TAB_AZIENDA)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === TAB_AZIENDA
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Building2 size={15} />
            Azienda
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
              <Shield size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {/* ──── PRIVATO ──── */}
          {tab === TAB_PRIVATO && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Nome *" error={fe('first_name')}>
                  <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} className={`${inputClass} ${fe('first_name') ? 'border-red-400' : ''}`} required />
                </FormField>
                <FormField label="Cognome *" error={fe('last_name')}>
                  <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} className={`${inputClass} ${fe('last_name') ? 'border-red-400' : ''}`} required />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Codice Fiscale" error={fe('codice_fiscale')}>
                  <input type="text" name="codice_fiscale" value={formData.codice_fiscale} onChange={handleChange} className={`${inputClass} uppercase ${fe('codice_fiscale') ? 'border-red-400' : ''}`} maxLength={16} placeholder="RSSMRA85T10A562S" />
                </FormField>
                <FormField label="Data di Nascita" error={fe('birth_date')}>
                  <div className="relative">
                    <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="date" name="birth_date" value={formData.birth_date} onChange={handleChange} className={`${inputClass} pl-9 ${fe('birth_date') ? 'border-red-400' : ''}`} />
                  </div>
                </FormField>
              </div>
            </>
          )}

          {/* ──── AZIENDA ──── */}
          {tab === TAB_AZIENDA && (
            <>
              <FormField label="Ragione Sociale *" error={fe('company_name')}>
                <div className="relative">
                  <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" name="company_name" value={formData.company_name} onChange={handleChange} className={`${inputClass} pl-9 ${fe('company_name') ? 'border-red-400' : ''}`} required placeholder="Acme Srl" />
                </div>
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Partita IVA" error={fe('vat_number')}>
                  <input type="text" name="vat_number" value={formData.vat_number} onChange={handleChange} className={`${inputClass} ${fe('vat_number') ? 'border-red-400' : ''}`} placeholder="IT12345678901" />
                </FormField>
                <FormField label="Codice SDI" error={fe('sdi_code')}>
                  <input type="text" name="sdi_code" value={formData.sdi_code} onChange={handleChange} className={`${inputClass} uppercase ${fe('sdi_code') ? 'border-red-400' : ''}`} maxLength={7} placeholder="XXXXXXX" />
                </FormField>
              </div>

              <FormField label="PEC" error={fe('pec_email')}>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" name="pec_email" value={formData.pec_email} onChange={handleChange} className={`${inputClass} pl-9 ${fe('pec_email') ? 'border-red-400' : ''}`} placeholder="azienda@pec.it" />
                </div>
              </FormField>

              <FormField label="Referente" error={fe('contact_person')}>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" name="contact_person" value={formData.contact_person} onChange={handleChange} className={`${inputClass} pl-9 ${fe('contact_person') ? 'border-red-400' : ''}`} placeholder="Mario Rossi" />
                </div>
              </FormField>
            </>
          )}

          {/* ──── COMUNI ──── */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Contatti</p>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Email" error={fe('email')}>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" name="email" value={formData.email} onChange={handleChange} className={`${inputClass} pl-9 ${fe('email') ? 'border-red-400' : ''}`} placeholder="email@esempio.it" />
                </div>
              </FormField>
              <FormField label="Telefono" error={fe('phone')}>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className={`${inputClass} pl-9 ${fe('phone') ? 'border-red-400' : ''}`} placeholder="+39 333 1234567" />
                </div>
              </FormField>
            </div>

            <FormField label="Codice Cliente" error={fe('code')}>
              <input type="text" name="code" value={formData.code} onChange={handleChange} className={`${inputClass} ${fe('code') ? 'border-red-400' : ''}`} placeholder="Lascia vuoto per auto-generazione" />
            </FormField>
          </div>

          {/* ──── INDIRIZZO ──── */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin size={12} /> Indirizzo
            </p>

            <FormField label="Via / Indirizzo" error={fe('address')}>
              <input type="text" name="address" value={formData.address} onChange={handleChange} className={`${inputClass} ${fe('address') ? 'border-red-400' : ''}`} placeholder="Via Roma 1" />
            </FormField>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <FormField label="CAP" error={fe('zip_code')}>
                  <input type="text" name="zip_code" value={formData.zip_code} onChange={handleChange} className={`${inputClass} ${fe('zip_code') ? 'border-red-400' : ''}`} maxLength={5} placeholder="80100" />
                </FormField>
              </div>
              <div className="col-span-1">
                <FormField label="Città" error={fe('city')}>
                  <input type="text" name="city" value={formData.city} onChange={handleChange} className={`${inputClass} ${fe('city') ? 'border-red-400' : ''}`} placeholder="Napoli" />
                </FormField>
              </div>
              <div className="col-span-1">
                <FormField label="Prov." error={fe('province')}>
                  <input type="text" name="province" value={formData.province} onChange={handleChange} className={`${inputClass} uppercase ${fe('province') ? 'border-red-400' : ''}`} maxLength={2} placeholder="NA" />
                </FormField>
              </div>
            </div>
          </div>

          {/* ──── CONSENSO ──── */}
          <div className="border-t border-gray-100 pt-4">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  name="marketing_consent"
                  checked={formData.marketing_consent}
                  onChange={handleChange}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  formData.marketing_consent
                    ? 'bg-indigo-600 border-indigo-600'
                    : 'border-gray-300 group-hover:border-indigo-400'
                }`}>
                  {formData.marketing_consent && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-gray-700">Consenso marketing (SMS, Email, WhatsApp)</span>
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-100 transition">
            Annulla
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 shadow-sm"
          >
            {loading ? <Loader size={16} className="animate-spin" /> : null}
            {customer ? 'Salva Modifiche' : 'Crea Cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}
