import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { customers } from '../api.jsx';
import { CustomersSkeleton } from '../components/Skeleton.jsx';
import VirtualTable from '../components/VirtualTable.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import CustomerModal from '../components/CustomerModal.jsx';
import { 
  Users, CreditCard, RefreshCcw, Smartphone, Clock, 
  Search, Plus, Filter, Download, MoreHorizontal,
  Edit2, Trash2, Mail, Phone, MapPin, ToggleLeft, ToggleRight
} from 'lucide-react';

export default function CustomersPage() {
  const { selectedStoreId, selectedStore, user } = useOutletContext();
  const navigate = useNavigate();
  
  // Controllo ruolo: i dipendenti vedono solo il form inserimento nuovo cliente
  const isDipendente = (user?.roles || []).includes('dipendente') || user?.role === 'dipendente';
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(isDipendente);
  const [customersList, setCustomersList] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');

  useEffect(() => { fetchCustomers(); }, [selectedStoreId]);

  const fetchCustomers = async () => {
    try {
      setLoading(true); setError('');
      const customersResponse = await customers.getCustomers(
        selectedStoreId ? { store_id: selectedStoreId, limit: 100 } : { limit: 100 }
      );
      setCustomersList(customersResponse.data.data || []);

      // Analytics solo per admin — il dipendente riceve 403, ignoriamo silenziosamente
      try {
        const analyticsResponse = await customers.getReturnAnalytics(
          selectedStoreId ? { store_id: selectedStoreId } : {}
        );
        setAnalytics(analyticsResponse.data || null);
      } catch { setAnalytics(null); }

    } catch (err) {
      setError(err.message || 'Errore nel caricamento dei clienti');
    } finally { setLoading(false); }
  };

  const handleOpenModal = (customer = null) => { setSelectedCustomer(customer); setShowModal(true); };
  const handleCloseModal = () => { setShowModal(false); setSelectedCustomer(null); };
  const handleSaveCustomer = async () => { await fetchCustomers(); handleCloseModal(); };

  const handleToggleStatus = async (customer, e) => {
    e.stopPropagation();
    const newStatus = customer.status === 'active' ? 'inactive' : 'active';
    try {
      await customers.updateCustomer(customer.id, { ...customer, status: newStatus });
      setCustomersList(prev => prev.map(c => c.id === customer.id ? { ...c, status: newStatus } : c));
    } catch (error) {
      console.error('Toggle status error:', error);
    }
  };

  const filtered = customersList.filter(c =>
    (
      c.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.city?.toLowerCase().includes(searchTerm.toLowerCase())
    ) &&
    (!cityFilter || c.city === cityFilter)
  );

  const initials = c => `${c.first_name?.[0] || ''}${c.last_name?.[0] || ''}`.toUpperCase();
  const cityOptions = analytics?.city_breakdown || [];

  const formatDate = value => value ? new Date(value).toLocaleDateString('it-IT') : '-';
  const formatReturnDays = value => value ? `${value} gg` : 'Nuovo';
  
  if (loading) return <CustomersSkeleton />;

  // ─── VISTA DIPENDENTE: solo inserimento cliente ───────────
  if (isDipendente) {
    return (
      <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 16px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
          borderRadius: 20, padding: '28px 32px', marginBottom: 24, color: '#fff',
        }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 4px' }}>Registra Nuovo Cliente</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
            Inserisci i dati del nuovo cliente da registrare
          </p>
        </div>
        <div className="card-v3" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #818cf8, #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
          }}>
            <Users size={32} color="#fff" />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px', color: '#1a1a2e' }}>Nuovo Cliente</h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px' }}>
            Premi il pulsante per aprire il modulo di registrazione
          </p>
          <button
            onClick={() => setShowNewCustomerModal(true)}
            className="sp-btn sp-btn-primary"
            style={{ padding: '12px 32px', fontSize: 15, fontWeight: 700 }}
          >
            <Plus size={16} /> Registra Cliente
          </button>
        </div>
        {showNewCustomerModal && (
          <CustomerModal
            customer={null}
            onClose={() => setShowNewCustomerModal(false)}
            onSave={() => { setShowNewCustomerModal(false); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="animate-v3 space-y-10 px-2 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Anagrafica Clienti</h1>
          <p className="text-slate-400 font-bold flex items-center gap-2">
            <Users size={16} className="text-indigo-500" />
            {customersList.length} clienti registrati{selectedStore ? ` • ${selectedStore.name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
           <button className="btn-v3 flex items-center gap-2 px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl text-slate-600 font-black hover:border-indigo-500 hover:text-indigo-500 transition-all shadow-sm">
             <Download size={18} /> Esporta
           </button>
           <button className="btn-v3-primary flex items-center gap-2 px-8 py-4 rounded-2xl shadow-xl shadow-indigo-100" onClick={() => handleOpenModal()}>
             <Plus size={20} strokeWidth={3} /> Nuovo Cliente
           </button>
        </div>
      </div>

      {/* KPI Section (Next-Gen) */}
      {analytics && (
        <div className="kpi-v3-grid">
          <div className="kpi-v3-card group">
            <div className="kpi-v3-icon bg-indigo-50 text-indigo-600">
              <Users size={24} />
            </div>
            <div>
              <div className="kpi-v3-label">Clienti Totali</div>
              <div className="kpi-v3-value">{analytics.overview?.total_customers ?? 0}</div>
              <div className="flex items-center gap-1 mt-1 text-[10px] font-black text-emerald-500 uppercase">
                <Plus size={10} /> 12% Mese Scorso
              </div>
            </div>
          </div>
          <div className="kpi-v3-card">
            <div className="kpi-v3-icon bg-amber-50 text-amber-600">
              <CreditCard size={24} />
            </div>
            <div>
              <div className="kpi-v3-label">Fidelity Attive</div>
              <div className="kpi-v3-value">{analytics.overview?.loyalty_card_customers ?? 0}</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">
                Copertura: {Math.round((analytics.overview?.loyalty_card_customers / analytics.overview?.total_customers) * 100)}%
              </div>
            </div>
          </div>
          <div className="kpi-v3-card">
            <div className="kpi-v3-icon bg-emerald-50 text-emerald-600">
              <RefreshCcw size={24} />
            </div>
            <div>
              <div className="kpi-v3-label">Retention Rate</div>
              <div className="kpi-v3-value">{analytics.overview?.returning_customers ?? 0}</div>
              <div className="text-[10px] font-black text-red-400 uppercase tracking-wider mt-1">
                Inattivi: {analytics.overview?.inactive_customers_30d ?? 0}
              </div>
            </div>
          </div>
          <div className="kpi-v3-card">
            <div className="kpi-v3-icon bg-purple-50 text-purple-600">
              <Smartphone size={24} />
            </div>
            <div>
              <div className="kpi-v3-label">App Collegata</div>
              <div className="kpi-v3-value">{analytics.overview?.app_ready_customers ?? 0}</div>
              <div className="text-[10px] font-black text-emerald-500 uppercase tracking-wider mt-1">
                Push Inviati: {analytics.overview?.push_sent_7d ?? 0}
              </div>
            </div>
          </div>
          <div className="kpi-v3-card">
            <div className="kpi-v3-icon bg-slate-100 text-slate-600">
              <Clock size={24} />
            </div>
            <div>
              <div className="kpi-v3-label">Ciclo Ritorno</div>
              <div className="kpi-v3-value text-slate-900">{analytics.overview?.avg_return_days ?? '-'} <span className="text-sm">gg</span></div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">
                Media Ponderata
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <ErrorAlert message={error} onRetry={fetchCustomers} />}

      {/* Main Content Card */}
      <div className="card-v3 overflow-hidden border-[#F1F5F9] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.06)]">
        {/* Tactical Search Toolbar */}
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center gap-6 bg-white/50 backdrop-blur-xl">
           <div className="relative flex-1 group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
              <input 
                type="text" 
                placeholder="Cerca per nome, email, telefono o codice..."
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-16 pr-8 py-4 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all outline-none"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
           
           <div className="flex items-center gap-4">
              <div className="relative">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <select 
                  className="bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-10 py-4 font-bold text-slate-600 focus:border-indigo-500 outline-none appearance-none cursor-pointer"
                  value={cityFilter} 
                  onChange={e => setCityFilter(e.target.value)}
                >
                  <option value="">Tutte le città</option>
                  {cityOptions.map(item => (
                    <option key={item.city} value={item.city}>{item.city} ({item.customers})</option>
                  ))}
                </select>
              </div>
              <div className="text-xs font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-4 py-4 rounded-2xl">
                {filtered.length} Risultati
              </div>
           </div>
        </div>

        {/* Tactical Table */}
        <div className="overflow-x-auto">
           <table className="table-v3">
             <thead>
               <tr>
                 <th>Codice</th>
                 <th>Anagrafica Cliente</th>
                 <th>Residenza</th>
                 <th>Ciclo Vendita</th>
                 <th>Registrato da</th>
                 <th>Status</th>
                 <th>Status Fidelity</th>
                 <th>App Loyalty</th>
                 <th className="text-right">Azioni</th>
               </tr>
             </thead>
             <tbody>
               {filtered.map((customer) => (
                 <tr key={customer.id} className="group hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => navigate(`/customers/${customer.id}`)}>
                   <td>
                     <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md tracking-tighter">
                       {customer.code}
                     </span>
                   </td>
                   <td>
                     <div className="flex items-center gap-4 py-2">
                       <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-black text-sm group-hover:bg-white group-hover:shadow-md transition-all">
                         {initials(customer)}
                       </div>
                       <div>
                         <div className="font-black text-slate-900 tracking-tight">{customer.first_name} {customer.last_name}</div>
                         <div className="text-xs font-bold text-slate-400 flex items-center gap-2 mt-0.5">
                            <Mail size={10} /> {customer.email || 'Nessun email'}
                         </div>
                       </div>
                     </div>
                   </td>
                   <td>
                     <div className="flex flex-col">
                        <span className="font-bold text-slate-700 text-sm">{customer.city || 'Non spec.'}</span>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{customer.zip || '00000'}</span>
                     </div>
                   </td>
                   <td>
                     <div className="flex flex-col gap-1">
                        <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                           <Clock size={12} className="text-slate-300" /> {formatDate(customer.last_purchase_at)}
                        </div>
                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.1em]">Freq: {formatReturnDays(customer.return_frequency_days)}</div>
                     </div>
                   </td>
                   {/* Colonna Operatore Registrante */}
                   <td>
                     <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>
                       {customer.registered_by_name?.trim() || '—'}
                     </div>
                   </td>
                   {/* Colonna Status Attivo/Inattivo */}
                   <td>
                     <div className={`badge-v3 ${customer.status !== 'inactive' ? 'badge-v3-emerald' : 'badge-v3-slate'}`}>
                       {customer.status !== 'inactive' ? '● Attivo' : '○ Inattivo'}
                     </div>
                   </td>
                   <td>
                     <div className={`badge-v3 ${customer.card_code ? 'badge-v3-emerald' : 'badge-v3-amber'}`}>
                       <CreditCard size={12} />
                       {customer.card_code ? customer.card_code : 'Da Attivare'}
                     </div>
                   </td>
                   <td>
                     <div className="flex flex-col gap-1.5">
                        <div className={`badge-v3 ${(customer.loyalty_devices_count || 0) > 0 ? 'badge-v3-indigo' : 'badge-v3-slate'}`}>
                          <Smartphone size={12} />
                          {(customer.loyalty_devices_count || 0) > 0 ? 'Dispositivo iOS/Android' : 'Non Collegata'}
                        </div>
                        {customer.last_push_sent_at && (
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-tight pl-1">
                            Push: {formatDate(customer.last_push_sent_at)}
                          </span>
                        )}
                     </div>
                   </td>
                   <td>
                     <div className="flex items-center justify-end gap-2">
                       {/* Toggle stato attivo/inattivo */}
                       <button
                         onClick={(e) => handleToggleStatus(customer, e)}
                         title={customer.status === 'active' ? 'Cliente attivo — clicca per disattivare' : 'Cliente inattivo — clicca per attivare'}
                         className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-95 ${
                           customer.status === 'active'
                             ? 'bg-emerald-50 text-emerald-500 hover:bg-emerald-500 hover:text-white'
                             : 'bg-red-50 text-red-400 hover:bg-red-500 hover:text-white'
                         }`}
                       >
                         {customer.status === 'active' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                       </button>
                       <button 
                         onClick={(e) => { e.stopPropagation(); navigate(`/customers/${customer.id}`); }}
                         className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95"
                         title="Apri Scheda CRM"
                       >
                         <span style={{ fontSize: 14 }}>👤</span>
                       </button>
                       <button 
                         onClick={(e) => { e.stopPropagation(); handleOpenModal(customer); }}
                         className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-95"
                       >
                         <Edit2 size={16} />
                       </button>
                     </div>
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>
        
        {filtered.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center justify-center text-slate-200">
             <Users size={64} strokeWidth={1} className="mb-4" />
             <p className="font-black text-xl tracking-tight text-slate-300">Nessun cliente trovato</p>
          </div>
        )}
      </div>

      {/* Top Returners Section (Harmonized) */}
      {analytics?.top_returners?.length > 0 && (
        <div className="space-y-6 mt-12 animate-v3">
          <div className="flex items-center justify-between px-2">
             <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
               <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                 <RefreshCcw size={18} />
               </div>
               Clienti Best Performer
             </h3>
             <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Top {analytics.top_returners.length} System Rank</span>
          </div>

          <div className="card-v3 overflow-hidden border-[#F1F5F9]">
             <table className="table-v3">
                <thead>
                  <tr className="bg-slate-50/30">
                    <th>Cliente</th>
                    <th>Città</th>
                    <th>Volume Ordini</th>
                    <th>Frequenza Ritorno</th>
                    <th>Ultimo Contatto</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.top_returners.map(item => (
                    <tr key={item.customer_id} className="hover:bg-slate-50/50">
                      <td className="font-black text-slate-900">{item.customer_name}</td>
                      <td className="font-bold text-slate-400">{item.city || '-'}</td>
                      <td>
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg font-black text-xs">
                          {item.paid_orders_count} ordini
                        </span>
                      </td>
                      <td className="font-bold text-slate-600 text-sm">{formatReturnDays(item.return_frequency_days)}</td>
                      <td className="text-xs font-black text-slate-400 uppercase tracking-tight">{formatDate(item.last_purchase_at)}</td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        </div>
      )}

      {showModal && (
        <CustomerModal customer={selectedCustomer} onClose={handleCloseModal} onSave={handleSaveCustomer} />
      )}
    </div>
  );
}
