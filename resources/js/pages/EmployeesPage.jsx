import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { employees } from '../api.jsx';
import { EmployeesSkeleton } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import EmployeeModal from '../components/EmployeeModal.jsx';

export default function EmployeesPage() {
  const { selectedStoreId, selectedStore, storesList } = useOutletContext();
  const [employeesList, setEmployeesList] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { fetchEmployees(); }, [selectedStoreId]);

  const fetchEmployees = async () => {
    try {
      setLoading(true); setError('');
      const [employeesResponse, analyticsResponse] = await Promise.all([
        employees.getEmployees(selectedStoreId ? { store_id: selectedStoreId, limit: 60 } : { limit: 60 }),
        employees.getTopPerformers(selectedStoreId ? { store_id: selectedStoreId } : {}),
      ]);

      setEmployeesList(employeesResponse.data.data || []);
      setAnalytics(analyticsResponse.data || null);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento dei dipendenti');
    } finally { setLoading(false); }
  };

  const handleOpenModal = (employee = null) => { setSelectedEmployee(employee); setShowModal(true); };
  const handleCloseModal = () => { setShowModal(false); setSelectedEmployee(null); };
  const handleSaveEmployee = async () => { await fetchEmployees(); handleCloseModal(); };

  const filtered = employeesList.filter(e =>
    e.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.store_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const initials = e => `${e.first_name?.[0] || ''}${e.last_name?.[0] || ''}`.toUpperCase();
  const formatDate = value => value ? new Date(value).toLocaleDateString('it-IT') : '-';
  const formatCurrency = value => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));

  if (loading) return <EmployeesSkeleton />;

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="page-head-title">Dipendenti</div>
          <div className="page-head-sub">
            {employeesList.length} dipendenti nel sistema{selectedStore ? ` - Store: ${selectedStore.name}` : ''}
          </div>
        </div>
        <button className="btn btn-gold" onClick={() => handleOpenModal()}>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuovo Dipendente
        </button>
      </div>

      {analytics && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Dipendenti Totali</div>
            <div className="kpi-value">{analytics.overview?.total_employees ?? 0}</div>
            <div className="kpi-delta up">Anagrafica team</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Dipendenti Attivi</div>
            <div className="kpi-value gold">{analytics.overview?.active_employees ?? 0}</div>
            <div className="kpi-delta up">Presidio operativo</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Vendite Generate</div>
            <div className="kpi-value">{formatCurrency(analytics.overview?.total_net_sales)}</div>
            <div className="kpi-delta warn">Ordini: {analytics.overview?.total_orders ?? 0}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Ticket Medio</div>
            <div className="kpi-value">{formatCurrency(analytics.overview?.avg_ticket)}</div>
            <div className="kpi-delta up">Resa commerciale media</div>
          </div>
        </div>
      )}

      {error && <ErrorAlert message={error} onRetry={fetchEmployees} />}

      {/* Table */}
      <div className="table-card">
        <div className="table-toolbar">
          <div className="search-box">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--muted)',flexShrink:0}}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              placeholder="Cerca per nome..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <span style={{fontSize:12,color:'var(--muted)',marginLeft:'auto'}}>{filtered.length} risultati</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Store</th>
              <th>Ordini</th>
              <th>Punti</th>
              <th>Ultima Vendita</th>
              <th>Stato</th>
              <th style={{textAlign:'right'}}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(employee => (
              <tr key={employee.id}>
                <td>
                  <div className="avatar-cell">
                    <div className="avatar-sm" style={{ overflow: 'hidden', padding: 0 }}>
                      {employee.photo_url ? (
                        <img src={employee.photo_url} alt={`${employee.first_name} ${employee.last_name}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      ) : (
                        <span>{initials(employee)}</span>
                      )}
                    </div>
                    <div>
                      <div className="avatar-name">{employee.first_name} {employee.last_name}</div>
                      <div className="avatar-sub">Assunto: {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('it-IT') : '-'}</div>
                    </div>
                  </div>
                </td>
                <td style={{color:'var(--muted2)'}}>{employee.store_name || '-'}</td>
                <td className="mono">{employee.orders_count || 0}</td>
                <td className="mono" style={{color:'var(--gold)'}}>{employee.points_balance || 0}</td>
                <td style={{color:'var(--muted2)'}}>{formatDate(employee.last_sale_at)}</td>
                <td>
                  <span className={`badge ${employee.status === 'active' ? 'high' : 'mid'}`}>
                    <span className="badge-dot" />
                    {employee.status === 'active' ? 'Attivo' : 'Inattivo'}
                  </span>
                </td>
                <td>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:4}}>
                    <button className="icon-action edit" onClick={() => handleOpenModal(employee)} title="Modifica">
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
                  Nessun dipendente trovato
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {analytics?.top_performers?.length > 0 && (
        <div className="table-card">
          <div className="table-toolbar">
            <div className="section-title">Top performer</div>
            <span style={{fontSize:12,color:'var(--muted)',marginLeft:'auto'}}>Ranking automatico</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Dipendente</th>
                <th>Store</th>
                <th>Vendite</th>
                <th>Margine</th>
                <th>Punti</th>
              </tr>
            </thead>
            <tbody>
              {analytics.top_performers.map(item => (
                <tr key={item.employee_id}>
                  <td><span className="mono">#{item.rank}</span></td>
                  <td>{item.employee_name}</td>
                  <td style={{color:'var(--muted2)'}}>{item.store_name || '-'}</td>
                  <td className="mono">{formatCurrency(item.total_net_sales)}</td>
                  <td className="mono">{formatCurrency(item.total_margin)}</td>
                  <td className="mono" style={{color:'var(--gold)'}}>{item.points_balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <EmployeeModal
          employee={selectedEmployee}
          storesList={storesList}
          selectedStoreId={selectedStoreId}
          onClose={handleCloseModal}
          onSave={handleSaveEmployee}
        />
      )}
    </>
  );
}

