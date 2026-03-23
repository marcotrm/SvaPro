import React, { useState, useEffect } from 'react';
import { customers } from '../api.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import CustomerModal from '../components/CustomerModal.jsx';

export default function CustomersPage() {
  const [customersList, setCustomersList] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');

  useEffect(() => { fetchCustomers(); }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true); setError('');
      const [customersResponse, analyticsResponse] = await Promise.all([
        customers.getCustomers(),
        customers.getReturnAnalytics(),
      ]);

      setCustomersList(customersResponse.data.data || []);
      setAnalytics(analyticsResponse.data || null);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento dei clienti');
    } finally { setLoading(false); }
  };

  const handleOpenModal = (customer = null) => { setSelectedCustomer(customer); setShowModal(true); };
  const handleCloseModal = () => { setShowModal(false); setSelectedCustomer(null); };
  const handleSaveCustomer = async () => { await fetchCustomers(); handleCloseModal(); };

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

  if (loading) return <LoadingSpinner />;

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="page-head-title">Clienti</div>
          <div className="page-head-sub">{customersList.length} clienti registrati</div>
        </div>
        <button className="btn btn-gold" onClick={() => handleOpenModal()}>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuovo Cliente
        </button>
      </div>

      {analytics && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Clienti Totali</div>
            <div className="kpi-value">{analytics.overview?.total_customers ?? 0}</div>
            <div className="kpi-delta up">Base anagrafica attiva</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Fidelity Attive</div>
            <div className="kpi-value gold">{analytics.overview?.loyalty_card_customers ?? 0}</div>
            <div className="kpi-delta up">Clienti con card</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Clienti di Ritorno</div>
            <div className="kpi-value">{analytics.overview?.returning_customers ?? 0}</div>
            <div className="kpi-delta warn">Riattivabili: {analytics.overview?.inactive_customers_30d ?? 0}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Ritorno Medio</div>
            <div className="kpi-value">{analytics.overview?.avg_return_days ? `${analytics.overview.avg_return_days} gg` : '-'}</div>
            <div className="kpi-delta up">Frequenza media acquisto</div>
          </div>
        </div>
      )}

      {error && <ErrorAlert message={error} onRetry={fetchCustomers} />}

      {/* Table */}
      <div className="table-card">
        <div className="table-toolbar">
          <div className="search-box">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--muted)',flexShrink:0}}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              placeholder="Cerca per nome, email o codice..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <select className="form-select" style={{maxWidth: 220}} value={cityFilter} onChange={e => setCityFilter(e.target.value)}>
            <option value="">Tutte le citta</option>
            {cityOptions.map(item => (
              <option key={item.city} value={item.city}>{item.city} ({item.customers})</option>
            ))}
          </select>
          <span style={{fontSize:12,color:'var(--muted)',marginLeft:'auto'}}>{filtered.length} risultati</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Codice</th>
              <th>Nome</th>
              <th>Citta</th>
              <th>Ultimo Acquisto</th>
              <th>Ritorno Medio</th>
              <th>Fidelity</th>
              <th style={{textAlign:'right'}}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(customer => (
              <tr key={customer.id}>
                <td><span className="mono" style={{color:'var(--gold)'}}>{customer.code}</span></td>
                <td>
                  <div className="avatar-cell">
                    <div className="avatar-sm">{initials(customer)}</div>
                    <div>
                      <div className="avatar-name">{customer.first_name} {customer.last_name}</div>
                      <div className="avatar-sub">{customer.email || customer.phone || 'Contatto non disponibile'}</div>
                    </div>
                  </div>
                </td>
                <td style={{color:'var(--muted2)'}}>{customer.city || '-'}</td>
                <td style={{color:'var(--muted2)'}}>{formatDate(customer.last_purchase_at)}</td>
                <td style={{color:'var(--muted2)'}}>{formatReturnDays(customer.return_frequency_days)}</td>
                <td>
                  <span className={`badge ${customer.card_code ? 'high' : 'mid'}`}>
                    <span className="badge-dot" />
                    {customer.card_code ? customer.card_code : 'Da attivare'}
                  </span>
                </td>
                <td>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:4}}>
                    <button className="icon-action edit" onClick={() => handleOpenModal(customer)} title="Modifica">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button className="icon-action danger" title="Elimina">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="7" style={{textAlign:'center',padding:'40px 0',color:'var(--muted)'}}>
                  Nessun cliente trovato
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {analytics?.top_returners?.length > 0 && (
        <div className="table-card">
          <div className="table-toolbar">
            <div className="section-title">Clienti che ritornano meglio</div>
            <span style={{fontSize:12,color:'var(--muted)',marginLeft:'auto'}}>Top {analytics.top_returners.length}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Citta</th>
                <th>Ordini Pagati</th>
                <th>Ritorno Medio</th>
                <th>Ultimo Acquisto</th>
              </tr>
            </thead>
            <tbody>
              {analytics.top_returners.map(item => (
                <tr key={item.customer_id}>
                  <td>{item.customer_name}</td>
                  <td style={{color:'var(--muted2)'}}>{item.city || '-'}</td>
                  <td className="mono">{item.paid_orders_count}</td>
                  <td style={{color:'var(--muted2)'}}>{formatReturnDays(item.return_frequency_days)}</td>
                  <td style={{color:'var(--muted2)'}}>{formatDate(item.last_purchase_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <CustomerModal customer={selectedCustomer} onClose={handleCloseModal} onSave={handleSaveCustomer} />
      )}
    </>
  );
}

