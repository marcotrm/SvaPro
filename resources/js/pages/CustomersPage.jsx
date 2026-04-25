import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { customers as customersApi } from '../api.jsx';
import { CustomersSkeleton } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import CustomerModal from '../components/CustomerModal.jsx';
import toast from 'react-hot-toast';
import { 
  Users, CreditCard, RefreshCcw, Smartphone, Clock, 
  Search, Plus, Filter, Download, Edit2, Mail, Phone,
  ToggleLeft, ToggleRight, CheckSquare, Square, MessageSquare,
  Send, X, ChevronDown, Megaphone, AlertCircle, Loader
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   Componente Modal Marketing Bulk
   ───────────────────────────────────────────────────────────── */
function MarketingModal({ selectedIds, allCustomers, onClose }) {
  const [channel, setChannel] = useState('whatsapp'); // 'whatsapp' | 'email'
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterConsent, setFilterConsent] = useState('true'); // 'all' | 'true' | 'false'
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const useSelection = selectedIds.length > 0;

  // Calcola il numero di destinatari con i filtri applicati
  const previewCount = useMemo(() => {
    if (useSelection) return selectedIds.length;
    let list = allCustomers.filter(c => c.status === 'active');
    if (filterCity) list = list.filter(c => c.city === filterCity);
    if (filterConsent === 'true') list = list.filter(c => c.marketing_consent);
    if (filterConsent === 'false') list = list.filter(c => !c.marketing_consent);
    // Channel-specific
    if (channel === 'whatsapp') list = list.filter(c => c.phone);
    if (channel === 'email') list = list.filter(c => c.email);
    return list.length;
  }, [useSelection, selectedIds, allCustomers, filterCity, filterConsent, channel]);

  const cityOptions = useMemo(() => {
    const cities = [...new Set(allCustomers.map(c => c.city).filter(Boolean))];
    return cities.sort();
  }, [allCustomers]);

  const handleSend = async () => {
    if (!message.trim()) { toast.error('Inserisci un messaggio'); return; }
    if (channel === 'email' && !subject.trim()) { toast.error('Inserisci il subject'); return; }
    setSending(true);
    try {
      const payload = {
        message,
        ...(channel === 'email' ? { subject, body: message } : {}),
        ...(useSelection ? { customer_ids: selectedIds } : {}),
        ...(!useSelection && filterCity ? { filter_city: filterCity } : {}),
        ...(!useSelection && filterConsent !== 'all' ? { filter_consent: filterConsent === 'true' } : {}),
      };
      const res = channel === 'whatsapp'
        ? await customersApi.bulkWhatsapp(payload)
        : await customersApi.bulkEmail(payload);
      setResult({ ok: true, message: res.data.message, sent: res.data.sent });
      toast.success(res.data.message);
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setResult({ ok: false, message: msg });
      toast.error(msg);
    } finally { setSending(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Megaphone size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>Invia Messaggio Marketing</div>
              <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                {useSelection ? `${selectedIds.length} clienti selezionati` : 'Filtro automatico'}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          {result ? (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>{result.ok ? '?' : '❌'}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: result.ok ? '#16a34a' : '#dc2626', marginBottom: 8 }}>{result.message}</div>
              <button onClick={onClose} className="sp-btn sp-btn-primary" style={{ marginTop: 16 }}>Chiudi</button>
            </div>
          ) : (
            <>
              {/* Channel selector */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {['whatsapp', 'email'].map(ch => (
                  <button
                    key={ch}
                    onClick={() => setChannel(ch)}
                    style={{
                      padding: '12px 16px', borderRadius: 12, border: `2px solid ${channel === ch ? '#6366f1' : '#e2e8f0'}`,
                      background: channel === ch ? '#eef2ff' : '#f8fafc', cursor: 'pointer', fontWeight: 800,
                      color: channel === ch ? '#4f46e5' : '#64748b', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
                    }}
                  >
                    {ch === 'whatsapp' ? <MessageSquare size={16} /> : <Mail size={16} />}
                    {ch === 'whatsapp' ? 'WhatsApp' : 'Email'}
                  </button>
                ))}
              </div>

              {/* Filters (shown only if no selection) */}
              {!useSelection && (
                <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: 12 }}>Filtri Destinatari</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>Città</label>
                      <select className="sp-select" value={filterCity} onChange={e => setFilterCity(e.target.value)} style={{ fontSize: 13 }}>
                        <option value="">Tutte le città</option>
                        {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>Consenso Marketing</label>
                      <select className="sp-select" value={filterConsent} onChange={e => setFilterConsent(e.target.value)} style={{ fontSize: 13 }}>
                        <option value="all">Tutti</option>
                        <option value="true">Solo con consenso ✓</option>
                        <option value="false">Senza consenso</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview count */}
              <div style={{ background: '#eef2ff', borderRadius: 10, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} color="#6366f1" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5' }}>
                  {previewCount} destinatari {channel === 'whatsapp' ? 'con numero telefono' : 'con email'}
                </span>
              </div>

              {/* Subject (email only) */}
              {channel === 'email' && (
                <div style={{ marginBottom: 14 }}>
                  <label className="sp-label">Oggetto Email *</label>
                  <input className="sp-input" placeholder="Es: Offerta speciale per te..." value={subject} onChange={e => setSubject(e.target.value)} />
                </div>
              )}

              {/* Message */}
              <div style={{ marginBottom: 20 }}>
                <label className="sp-label">{channel === 'whatsapp' ? 'Messaggio WhatsApp *' : 'Corpo Email *'}</label>
                <textarea
                  className="sp-input"
                  style={{ minHeight: 120, resize: 'vertical' }}
                  placeholder={channel === 'whatsapp' ? 'Ciao {nome}! Abbiamo un\'offerta speciale per te...' : 'Caro cliente,\n\nTi scriviamo per...'}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  maxLength={channel === 'whatsapp' ? 1600 : 50000}
                />
                <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'right', marginTop: 4 }}>{message.length}{channel === 'whatsapp' ? '/1600' : ''} caratteri</div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={onClose} className="sp-btn sp-btn-secondary">Annulla</button>
                <button
                  onClick={handleSend}
                  disabled={sending || previewCount === 0}
                  className="sp-btn sp-btn-primary"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', minWidth: 140 }}
                >
                  {sending ? <><Loader size={14} className="sp-spin" /> Invio...</> : <><Send size={14} /> Invia a {previewCount} clienti</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN PAGE
   ───────────────────────────────────────────────────────────── */
export default function CustomersPage() {
  const { selectedStoreId, selectedStore, user } = useOutletContext();
  const navigate = useNavigate();
  
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
  const [statusFilter, setStatusFilter] = useState('');
  const [consentFilter, setConsentFilter] = useState('');
  
  // Selezione checkbox
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  // Ordinamento Tabella
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });

  // Marketing modal
  const [showMarketing, setShowMarketing] = useState(false);

  useEffect(() => { fetchCustomers(); }, [selectedStoreId]);

  const fetchCustomers = async () => {
    try {
      setLoading(true); setError('');
      const res = await customersApi.getCustomers(
        selectedStoreId ? { store_id: selectedStoreId, limit: 500 } : { limit: 500 }
      );
      setCustomersList(res.data.data || []);
      setSelectedIds(new Set());
      try {
        const aRes = await customersApi.getReturnAnalytics(
          selectedStoreId ? { store_id: selectedStoreId } : {}
        );
        setAnalytics(aRes.data || null);
      } catch { setAnalytics(null); }
    } catch (err) {
      setError(err.message || 'Errore nel caricamento dei clienti');
    } finally { setLoading(false); }
  };

  const handleOpenModal = (c = null) => { setSelectedCustomer(c); setShowModal(true); };
  const handleCloseModal = () => { setShowModal(false); setSelectedCustomer(null); };
  const handleSaveCustomer = async () => { await fetchCustomers(); handleCloseModal(); };

  // FIX: passa solo { status } al backend, non tutto il customer object
  const handleToggleStatus = async (customer, e) => {
    e.stopPropagation();
    const newStatus = customer.status === 'active' ? 'inactive' : 'active';
    try {
      await customersApi.updateCustomer(customer.id, { status: newStatus });
      setCustomersList(prev => prev.map(c => c.id === customer.id ? { ...c, status: newStatus } : c));
      toast.success(newStatus === 'active' ? 'Cliente attivato' : 'Cliente disattivato');
    } catch (err) {
      toast.error('Errore aggiornamento status');
    }
  };



  const filtered = useMemo(() => {
    let result = customersList.filter(c => {
      const term = searchTerm.toLowerCase();
      const matchSearch = !searchTerm || (
        c.first_name?.toLowerCase().includes(term) ||
        c.last_name?.toLowerCase().includes(term) ||
        c.company_name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.includes(term) ||
        c.code?.toLowerCase().includes(term) ||
        c.city?.toLowerCase().includes(term) ||
        String(c.id) === term.replace('#', '')
      );
      const matchCity = !cityFilter || c.city === cityFilter;
      const matchStatus = !statusFilter || c.status === statusFilter;
      const matchConsent = !consentFilter || String(!!c.marketing_consent) === consentFilter;
      return matchSearch && matchCity && matchStatus && matchConsent;
    });

    result.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'fidelity') {
        aVal = a.card_code ? 1 : 0;
        bVal = b.card_code ? 1 : 0;
      } else if (sortConfig.key === 'app') {
        aVal = (a.loyalty_devices_count || 0) > 0 ? 1 : 0;
        bVal = (b.loyalty_devices_count || 0) > 0 ? 1 : 0;
      } else if (sortConfig.key === 'status') {
        aVal = a.status === 'active' ? 1 : 0;
        bVal = b.status === 'active' ? 1 : 0;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [customersList, searchTerm, cityFilter, statusFilter, consentFilter, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'desc' };
    });
  };

  // Selezione checkbox DOPO la dichiarazione di `filtered`
  const toggleSelectOne = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size > 0 && selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  };
  const allSelected = selectedIds.size > 0 && selectedIds.size === filtered.length;
  const someSelected = selectedIds.size > 0;

  const initials = c => `${c.first_name?.[0] || ''}${c.last_name?.[0] || ''}`.toUpperCase() || c.company_name?.[0]?.toUpperCase() || '?';
  const cityOptions = analytics?.city_breakdown || [];
  const formatDate = v => v ? new Date(v).toLocaleDateString('it-IT') : '—';
  const formatReturnDays = v => v ? `${v} gg` : 'Nuovo';

  if (loading) return <CustomersSkeleton />;

  // ─── VISTA DIPENDENTE ──────────────────
  if (isDipendente) {
    return (
      <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 16px' }}>
        <div style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)', borderRadius: 20, padding: '28px 32px', marginBottom: 24, color: '#fff' }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 4px' }}>Registra Nuovo Cliente</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0 }}>Inserisci i dati del nuovo cliente da registrare</p>
        </div>
        <div className="card-v3" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #818cf8, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Users size={32} color="#fff" />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px', color: '#1a1a2e' }}>Nuovo Cliente</h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px' }}>Premi il pulsante per aprire il modulo di registrazione</p>
          <button onClick={() => setShowNewCustomerModal(true)} className="sp-btn sp-btn-primary" style={{ padding: '12px 32px', fontSize: 15, fontWeight: 700 }}>
            <Plus size={16} /> Registra Cliente
          </button>
        </div>
        {showNewCustomerModal && (
          <CustomerModal customer={null} onClose={() => setShowNewCustomerModal(false)} onSave={() => setShowNewCustomerModal(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="animate-v3 space-y-10 px-2 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Anagrafica Clienti</h1>
          <p className="text-slate-400 font-bold flex items-center gap-2">
            <Users size={16} className="text-indigo-500" />
            {customersList.length} clienti registrati{selectedStore ? ` • ${selectedStore.name}` : ''}
            {someSelected && <span style={{ background: '#eef2ff', color: '#4f46e5', fontSize: 11, fontWeight: 800, borderRadius: 6, padding: '2px 8px', marginLeft: 4 }}>{selectedIds.size} selezionati</span>}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Marketing button - appare sempre, si illumina quando ci sono selezionati */}
          <button
            onClick={() => setShowMarketing(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 14, border: 'none', cursor: 'pointer',
              fontWeight: 800, fontSize: 13,
              background: someSelected ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#f1f5f9',
              color: someSelected ? '#fff' : '#64748b',
              boxShadow: someSelected ? '0 8px 24px rgba(99,102,241,0.35)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <Megaphone size={16} />
            {someSelected ? `Invia a (${selectedIds.size})` : 'Marketing Bulk'}
          </button>
          <button className="btn-v3 flex items-center gap-2 px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl text-slate-600 font-black hover:border-indigo-500 hover:text-indigo-500 transition-all shadow-sm">
            <Download size={18} /> Esporta
          </button>
          <button className="btn-v3-primary flex items-center gap-2 px-8 py-4 rounded-2xl shadow-xl shadow-indigo-100" onClick={() => handleOpenModal()}>
            <Plus size={20} strokeWidth={3} /> Nuovo Cliente
          </button>
        </div>
      </div>

      {/* KPI Section */}
      {analytics && (
        <div className="kpi-v3-grid">
          <div className="kpi-v3-card group">
            <div className="kpi-v3-icon bg-indigo-50 text-indigo-600"><Users size={24} /></div>
            <div>
              <div className="kpi-v3-label">Clienti Totali</div>
              <div className="kpi-v3-value">{analytics.overview?.total_customers ?? 0}</div>
            </div>
          </div>
          <div className="kpi-v3-card">
            <div className="kpi-v3-icon bg-amber-50 text-amber-600"><CreditCard size={24} /></div>
            <div>
              <div className="kpi-v3-label">Fidelity Attive</div>
              <div className="kpi-v3-value">{analytics.overview?.loyalty_card_customers ?? 0}</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">
                {Math.round(((analytics.overview?.loyalty_card_customers || 0) / (analytics.overview?.total_customers || 1)) * 100)}% copertura
              </div>
            </div>
          </div>
          <div className="kpi-v3-card">
            <div className="kpi-v3-icon bg-emerald-50 text-emerald-600"><RefreshCcw size={24} /></div>
            <div>
              <div className="kpi-v3-label">Retention</div>
              <div className="kpi-v3-value">{analytics.overview?.returning_customers ?? 0}</div>
              <div className="text-[10px] font-black text-red-400 uppercase mt-1">inattivi: {analytics.overview?.inactive_customers_30d ?? 0}</div>
            </div>
          </div>
          <div className="kpi-v3-card">
            <div className="kpi-v3-icon bg-purple-50 text-purple-600"><Smartphone size={24} /></div>
            <div>
              <div className="kpi-v3-label">App Collegata</div>
              <div className="kpi-v3-value">{analytics.overview?.app_ready_customers ?? 0}</div>
              <div className="text-[10px] font-black text-emerald-500 uppercase mt-1">push 7gg: {analytics.overview?.push_sent_7d ?? 0}</div>
            </div>
          </div>
          <div className="kpi-v3-card">
            <div className="kpi-v3-icon bg-slate-100 text-slate-600"><Clock size={24} /></div>
            <div>
              <div className="kpi-v3-label">Ciclo Ritorno</div>
              <div className="kpi-v3-value text-slate-900">{analytics.overview?.avg_return_days ?? '—'} <span className="text-sm">gg</span></div>
            </div>
          </div>
        </div>
      )}

      {error && <ErrorAlert message={error} onRetry={fetchCustomers} />}

      {/* Table Card */}
      <div className="card-v3 overflow-hidden border-[#F1F5F9] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.06)]">
        {/* Toolbar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', background: '#fafbff' }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Cerca nome, email, telefono, codice..."
              style={{ width: '100%', paddingLeft: 36, paddingRight: 12, height: 40, borderRadius: 10, border: '2px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {/* Filtro Città */}
          <select
            className="sp-select"
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
            style={{ width: 160, height: 40, fontSize: 12 }}
          >
            <option value="">Tutte le città</option>
            {cityOptions.map(item => <option key={item.city} value={item.city}>{item.city} ({item.customers})</option>)}
          </select>
          {/* Filtro Status */}
          <select
            className="sp-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: 140, height: 40, fontSize: 12 }}
          >
            <option value="">Tutti gli status</option>
            <option value="active">Attivi</option>
            <option value="inactive">Inattivi</option>
          </select>
          {/* Filtro Consenso */}
          <select
            className="sp-select"
            value={consentFilter}
            onChange={e => setConsentFilter(e.target.value)}
            style={{ width: 170, height: 40, fontSize: 12 }}
          >
            <option value="">Consenso marketing</option>
            <option value="true">Con consenso ✓</option>
            <option value="false">Senza consenso</option>
          </select>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', padding: '8px 12px', background: '#f1f5f9', borderRadius: 8, whiteSpace: 'nowrap' }}>
            {filtered.length} risultati
          </div>
          {/* Tasto Seleziona Tutti Toolbar */}
          <button
            onClick={toggleSelectAll}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '2px solid #e0e7ff', background: allSelected ? '#eef2ff' : '#fff', color: '#4f46e5', fontSize: 12, fontWeight: 800, cursor: 'pointer', marginLeft: 'auto' }}
          >
            {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
            {allSelected ? 'Deseleziona Tutti' : 'Seleziona Tutti'}
          </button>
        </div>

        {/* Selezione rapida bar (appare se ci sono selezionati) */}
        {someSelected && (
          <div style={{ background: 'linear-gradient(90deg, #eef2ff, #f5f3ff)', borderBottom: '1px solid #e0e7ff', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#4f46e5' }}>
              {selectedIds.size} clienti selezionati
            </span>
            <button
              onClick={() => setShowMarketing(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
            >
              <Send size={12} /> Invia Messaggio
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'rgba(99,102,241,0.08)', color: '#6366f1', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
            >
              <X size={12} /> Deseleziona
            </button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="table-v3">
            <thead>
              <tr>
                {/* Checkbox colonna */}
                <th style={{ width: 40, paddingLeft: 16 }}>
                  <button onClick={toggleSelectAll} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#94a3b8' }}>
                    {allSelected ? <CheckSquare size={18} color="#6366f1" /> : <Square size={18} />}
                  </button>
                </th>
                <th>N° Cliente</th>
                <th>Anagrafica Cliente</th>
                <th>Residenza</th>
                <th>Ciclo Vendita</th>
                <th>Registrato da</th>
                <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    Status
                    {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                <th onClick={() => handleSort('fidelity')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    Fidelity
                    {sortConfig.key === 'fidelity' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                <th onClick={() => handleSort('app')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    App
                    {sortConfig.key === 'app' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                <th style={{ textAlign: 'right' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => {
                const isSelected = selectedIds.has(customer.id);
                return (
                  <tr
                    key={customer.id}
                    className="group hover:bg-slate-50/50 transition-colors cursor-pointer"
                    style={{ background: isSelected ? '#eef2ff' : undefined }}
                    onClick={() => navigate(`/customers/${customer.id}`)}
                  >
                    {/* Checkbox */}
                    <td style={{ paddingLeft: 16 }} onClick={e => toggleSelectOne(customer.id, e)}>
                      {isSelected ? <CheckSquare size={18} color="#6366f1" /> : <Square size={18} color="#cbd5e1" />}
                    </td>
                    <td>
                      <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md tracking-tighter font-mono">
                        #{customer.id}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-4 py-2">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-black text-sm group-hover:bg-white group-hover:shadow-md transition-all">
                          {initials(customer)}
                        </div>
                        <div>
                          <div className="font-black text-slate-900 tracking-tight">
                            {customer.customer_type === 'azienda' ? customer.company_name : `${customer.first_name} ${customer.last_name}`}
                          </div>
                          <div className="text-xs font-bold text-slate-400 flex items-center gap-2 mt-0.5">
                            {customer.email && <><Mail size={10} /> {customer.email}</>}
                            {customer.phone && <><Phone size={10} /> {customer.phone}</>}
                          </div>
                          {customer.marketing_consent && (
                            <div style={{ fontSize: 9, background: '#dcfce7', color: '#16a34a', fontWeight: 700, borderRadius: 4, padding: '1px 5px', display: 'inline-block', marginTop: 2 }}>
                              ✓ marketing
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700 text-sm">{customer.city || '—'}</span>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{customer.province || ''}</span>
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
                    <td>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>
                        {customer.registered_by_name?.trim() || '—'}
                      </div>
                    </td>
                    <td>
                      <div className={`badge-v3 ${customer.status !== 'inactive' ? 'badge-v3-emerald' : 'badge-v3-slate'}`}>
                        {customer.status !== 'inactive' ? '● Attivo' : '○ Inattivo'}
                      </div>
                    </td>
                    <td>
                      <div className={`badge-v3 ${customer.code || customer.card_code ? 'badge-v3-emerald' : 'badge-v3-amber'}`}>
                        <CreditCard size={12} />
                        {customer.code || customer.card_code || 'Da Attivare'}
                      </div>
                    </td>
                    <td>
                      <div className={`badge-v3 ${(customer.loyalty_devices_count || 0) > 0 ? 'badge-v3-indigo' : 'badge-v3-slate'}`}>
                        <Smartphone size={12} />
                        {(customer.loyalty_devices_count || 0) > 0 ? 'Collegata' : 'No App'}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        {/* Toggle status */}
                        <button
                          onClick={(e) => handleToggleStatus(customer, e)}
                          title={customer.status === 'active' ? 'Clicca per disattivare' : 'Clicca per attivare'}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-95 ${
                            customer.status === 'active'
                              ? 'bg-emerald-50 text-emerald-500 hover:bg-emerald-500 hover:text-white'
                              : 'bg-red-50 text-red-400 hover:bg-red-500 hover:text-white'
                          }`}
                        >
                          {customer.status === 'active' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        </button>
                        {/* CRM scheda */}
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/customers/${customer.id}`); }}
                          className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95"
                          title="Apri Scheda CRM"
                        >
                          <span style={{ fontSize: 14 }}>👤</span>
                        </button>
                        {/* Edit */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenModal(customer); }}
                          className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-95"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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

      {/* Top Returners */}
      {analytics?.top_returners?.length > 0 && (
        <div className="space-y-6 mt-12 animate-v3">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                <RefreshCcw size={18} />
              </div>
              Clienti Best Performer
            </h3>
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Top {analytics.top_returners.length} Rank</span>
          </div>
          <div className="card-v3 overflow-hidden border-[#F1F5F9]">
            <table className="table-v3">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Città</th>
                  <th>Ordini</th>
                  <th>Frequenza</th>
                  <th>Ultimo Acquisto</th>
                </tr>
              </thead>
              <tbody>
                {analytics.top_returners.map(item => (
                  <tr key={item.customer_id} className="hover:bg-slate-50/50">
                    <td className="font-black text-slate-900">{item.customer_name}</td>
                    <td className="font-bold text-slate-400">{item.city || '—'}</td>
                    <td><span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg font-black text-xs">{item.paid_orders_count} ordini</span></td>
                    <td className="font-bold text-slate-600 text-sm">{formatReturnDays(item.return_frequency_days)}</td>
                    <td className="text-xs font-black text-slate-400">{formatDate(item.last_purchase_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showModal && <CustomerModal customer={selectedCustomer} onClose={handleCloseModal} onSave={handleSaveCustomer} />}
      {showMarketing && (
        <MarketingModal
          selectedIds={[...selectedIds]}
          allCustomers={filtered}
          onClose={() => setShowMarketing(false)}
        />
      )}
    </div>
  );
}
