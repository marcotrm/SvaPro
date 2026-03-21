import React, { useState, useEffect } from 'react';
import { customers } from '../api.jsx';
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

  useEffect(() => { fetchCustomers(); }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true); setError('');
      const response = await customers.getCustomers();
      setCustomersList(response.data.data || []);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento dei clienti');
    } finally { setLoading(false); }
  };

  const handleOpenModal = (customer = null) => { setSelectedCustomer(customer); setShowModal(true); };
  const handleCloseModal = () => { setShowModal(false); setSelectedCustomer(null); };
  const handleSaveCustomer = async () => { await fetchCustomers(); handleCloseModal(); };

  const filtered = customersList.filter(c =>
    c.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const initials = c => `${c.first_name?.[0] || ''}${c.last_name?.[0] || ''}`.toUpperCase();

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
          <span style={{fontSize:12,color:'var(--muted)',marginLeft:'auto'}}>{filtered.length} risultati</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Codice</th>
              <th>Nome</th>
              <th>Email</th>
              <th>Telefono</th>
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
                    </div>
                  </div>
                </td>
                <td style={{color:'var(--muted2)'}}>{customer.email}</td>
                <td style={{color:'var(--muted2)'}}>{customer.phone || 'â€”'}</td>
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
                <td colSpan="5" style={{textAlign:'center',padding:'40px 0',color:'var(--muted)'}}>
                  Nessun cliente trovato
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CustomerModal customer={selectedCustomer} onClose={handleCloseModal} onSave={handleSaveCustomer} />
      )}
    </>
  );
}

