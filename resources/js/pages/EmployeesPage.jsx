import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { employees, clearApiCache } from '../api.jsx';
import { EmployeesSkeleton } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import EmployeeModal from '../components/EmployeeModal.jsx';
import EmployeeShiftsTab from '../components/EmployeeShiftsTab.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { AttendanceContent } from './AttendancePage.jsx';
import { Monitor } from 'lucide-react';
import toast from 'react-hot-toast';

// ── Sospensione ──────────────────────────────────────────────────────
const SUSP_KEY = 'svapro_suspended_employees_v1';
const loadSuspended = () => { try { return new Set(JSON.parse(localStorage.getItem(SUSP_KEY) || '[]')); } catch { return new Set(); } };
const saveSuspended = (s) => { try { localStorage.setItem(SUSP_KEY, JSON.stringify([...s])); } catch {} };
// ─────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const { selectedStoreId, selectedStore, storesList } = useOutletContext();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('anagrafica'); // 'anagrafica' | 'presenze'
  const [employeesList, setEmployeesList] = useState([]);
  const [analytics,     setAnalytics]     = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [showModal,     setShowModal]     = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchTerm,    setSearchTerm]    = useState('');
  // Sospensione — locale/localStorage
  const [suspendedIds,  setSuspendedIds]  = useState(() => loadSuspended());
  const [showSuspended, setShowSuspended] = useState(false);
  // Modal turni dipendente
  const [shiftsEmployee, setShiftsEmployee] = useState(null);
  const [confirmToDelete, setConfirmToDelete] = useState(null);

  const handleSuspend = (emp) => {
    const next = new Set(suspendedIds); next.add(emp.id); setSuspendedIds(next); saveSuspended(next);
    toast.success(`${emp.first_name} ${emp.last_name} sospeso ⏸`);
  };
  const handleUnsuspend = (emp) => {
    const next = new Set(suspendedIds); next.delete(emp.id); setSuspendedIds(next); saveSuspended(next);
    toast.success(`${emp.first_name} ${emp.last_name} riattivato ✅`);
  };

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

  // Refresh silenzioso (senza skeleton) dopo salvataggio
  const refreshEmployees = async () => {
    try {
      const [employeesResponse, analyticsResponse] = await Promise.all([
        employees.getEmployees(selectedStoreId ? { store_id: selectedStoreId, limit: 60 } : { limit: 60 }),
        employees.getTopPerformers(selectedStoreId ? { store_id: selectedStoreId } : {}),
      ]);
      setEmployeesList(employeesResponse.data.data || []);
      setAnalytics(analyticsResponse.data || null);
    } catch (err) {
      console.error('Refresh silent error:', err);
    }
  };

  const handleOpenModal = (employee = null) => { setSelectedEmployee(employee); setShowModal(true); };
  const handleCloseModal = () => { setShowModal(false); setSelectedEmployee(null); };

  const handleSaveEmployee = async (isNew = false, updatedData = null) => {
    handleCloseModal();
    toast.success(isNew ? 'Dipendente creato! 🎉' : 'Dipendente aggiornato! ✅');

    // Aggiornamento ottimistico istantaneo: mostra subito la nuova foto
    if (!isNew && updatedData?.id) {
      setEmployeesList(prev => prev.map(e =>
        e.id === updatedData.id
          ? { ...e, photo_url: updatedData.photo_url ?? e.photo_url,
                    first_name: updatedData.first_name ?? e.first_name,
                    last_name: updatedData.last_name ?? e.last_name }
          : e
      ));
    }

    window.dispatchEvent(new CustomEvent('employeeUpdated'));

    // Svuota cache prima del refresh — altrimenti cachedGet ritorna i dati vecchi
    clearApiCache();

    // Refresh completo dal server
    try {
      const [empRes, anaRes] = await Promise.all([
        employees.getEmployees(selectedStoreId ? { store_id: selectedStoreId, limit: 60 } : { limit: 60 }),
        employees.getTopPerformers(selectedStoreId ? { store_id: selectedStoreId } : {}),
      ]);
      const freshList = empRes.data.data || [];
      setEmployeesList(freshList.map(e => {
        // Se il server non ha ancora la nuova foto, teniamo quella ottimistica
        if (!isNew && updatedData?.id && e.id === updatedData.id && !e.photo_url && updatedData.photo_url) {
          return { ...e, photo_url: updatedData.photo_url };
        }
        return e;
      }));
      setAnalytics(anaRes.data || null);
    } catch (err) {
      console.error('Refresh silent error:', err);
    }
  };

  const handleDelete = (employee) => {
    setConfirmToDelete(employee);
  };

  const doDelete = async () => {
    const employee = confirmToDelete;
    if (!employee) return;
    setConfirmToDelete(null);
    // Rimuovi immediatamente dalla lista (ottimistic)
    setEmployeesList(prev => prev.filter(e => e.id !== employee.id));
    try {
      await employees.deleteEmployee(employee.id);
      fetchEmployees().catch(() => {});
    } catch (err) {
      // Rollback: ripristina il dipendente se l'eliminazione fallisce
      setEmployeesList(prev => [...prev, employee].sort((a, b) => a.id - b.id));
      setError(err.response?.data?.message || "Errore durante l'eliminazione");
    }
  };

  const filtered = employeesList
    .filter(e => e.status !== 'deleted')
    .filter(e => showSuspended ? suspendedIds.has(e.id) : !suspendedIds.has(e.id))
    .filter(e =>
      e.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.store_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
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

      {/* ── Tab bar Dipendenti ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20, background: 'var(--color-surface)', borderRadius: 14, padding: 4, border: '1px solid var(--color-border)', width: 'fit-content' }}>
        {[{ id: 'anagrafica', label: '👥 Anagrafica' }, { id: 'presenze', label: '⏱ Presenze & Timbrature' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '8px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, transition: 'all 0.15s',
            background: activeTab === t.id ? 'linear-gradient(135deg, var(--color-accent), #6d5fd5)' : 'transparent',
            color: activeTab === t.id ? '#fff' : 'var(--color-text-secondary)',
            boxShadow: activeTab === t.id ? '0 2px 8px rgba(123,111,208,0.35)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Tab: Presenze (inline) ── */}
      {activeTab === 'presenze' && (
        <div>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => window.open('/clock-in', '_blank')} title="Apri Kiosk Timbratura in una nuova finestra" style={{
              padding: '7px 14px', borderRadius: 10, border: '1px solid var(--color-border)', cursor: 'pointer', fontWeight: 700, fontSize: 12,
              background: 'transparent', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Monitor size={12} /> 🖥 Apri Kiosk \u2197
            </button>
          </div>
          <AttendanceContent selectedStoreId={selectedStoreId} />
        </div>
      )}

      {/* ── Tab: Anagrafica ── */}
      {activeTab === 'anagrafica' && (<>

      {analytics && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Dipendenti Totali</div>
            <div className="kpi-value">{employeesList.length}</div>
            <div className="kpi-delta up">Anagrafica team</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Dipendenti Attivi</div>
            <div className="kpi-value gold">{employeesList.filter(e => e.status === 'active' && !suspendedIds.has(e.id)).length}</div>
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
            <input placeholder="Cerca per nome..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <button
            onClick={() => setShowSuspended(v => !v)}
            style={{ marginLeft: 8, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: showSuspended ? '#FEF3C7' : 'var(--color-bg)', color: showSuspended ? '#B45309' : 'var(--muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            ⏸ {showSuspended ? `Sospesi (${suspendedIds.size})` : `Mostra sospesi (${suspendedIds.size})`}
          </button>
          <span style={{fontSize:12,color:'var(--muted)',marginLeft:'auto'}}>{filtered.length} risultati</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Codice</th>
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
              <tr key={employee.id} style={{ opacity: suspendedIds.has(employee.id) ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                <td>
                  <div className="avatar-cell">
                    <div className="avatar-sm" style={{ width: 36, height: 36, minWidth: 36, borderRadius: '50%', overflow: 'hidden', padding: 0, flexShrink: 0 }}>
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
                <td>
                  {employee.barcode ? (
                    <span className="mono" style={{
                      background: 'var(--color-bg, #f8f9fa)',
                      border: '1px solid var(--color-border, #e9ecef)',
                      borderRadius: 6,
                      padding: '2px 8px',
                      fontSize: 12,
                      letterSpacing: '0.08em',
                      color: 'var(--color-accent, #6366f1)',
                      fontWeight: 700,
                      display: 'inline-block',
                    }}>
                      {employee.barcode}
                    </span>
                  ) : (
                    <span style={{color:'var(--muted)', fontSize:12}}>—</span>
                  )}
                </td>
                <td style={{color:'var(--muted2)'}}>{employee.store_name || '-'}</td>
                <td className="mono">{employee.orders_count || 0}</td>
                <td className="mono" style={{color:'var(--gold)'}}>{employee.points_balance || 0}</td>
                <td style={{color:'var(--muted2)'}}>{formatDate(employee.last_sale_at)}</td>
                <td>
                  <span className={`badge ${suspendedIds.has(employee.id) ? '' : (employee.status === 'active' ? 'high' : 'mid')}`}
                    style={suspendedIds.has(employee.id) ? { background:'#FEF3C7', color:'#B45309' } : {}}>
                    <span className="badge-dot" />
                    {suspendedIds.has(employee.id) ? '⏸ Sospeso' : (employee.status === 'active' ? 'Attivo' : 'Inattivo')}
                  </span>
                </td>
                <td>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:4}}>
                    {/* Turni */}
                    <button className="icon-action" onClick={() => setShiftsEmployee(employee)} title="Vedi Turni"
                      style={{ color: '#6366f1', background: 'rgba(99,102,241,0.10)' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </button>
                    <button className="icon-action edit" onClick={() => handleOpenModal(employee)} title="Modifica">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    {/* Sospendi / Riattiva */}
                    {suspendedIds.has(employee.id) ? (
                      <button
                        className="icon-action"
                        style={{ color: '#16a34a', background: 'rgba(22,163,74,0.10)' }}
                        title="Riattiva dipendente"
                        onClick={() => handleUnsuspend(employee)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      </button>
                    ) : (
                      <button
                        className="icon-action"
                        style={{ color: '#B45309', background: 'rgba(180,83,9,0.10)' }}
                        title="Sospendi dipendente"
                        onClick={() => handleSuspend(employee)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                      </button>
                    )}
                    <button className="icon-action danger" title="Elimina" onClick={() => handleDelete(employee)}>
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

      {/* ── Modal Turni Dipendente ── */}
      {shiftsEmployee && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShiftsEmployee(null)}>
          <div style={{ background: '#f8fafc', borderRadius: 22, width: '100%', maxWidth: 760, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderRadius: '22px 22px 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #818cf8, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900 }}>
                  {((shiftsEmployee.first_name||'?')[0]).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: '#0f172a' }}>{shiftsEmployee.first_name} {shiftsEmployee.last_name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{shiftsEmployee.store_name || 'Dipendente'} · Pianificazione Turni</div>
                </div>
              </div>
              <button onClick={() => setShiftsEmployee(null)} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', fontSize: 20 }}>×</button>
            </div>
            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <EmployeeShiftsTab employee={shiftsEmployee} />
            </div>
          </div>
        </div>
      )}
      </>)}
      <ConfirmModal
        isOpen={!!confirmToDelete}
        title="Elimina dipendente"
        message={confirmToDelete ? `Stai per eliminare ${confirmToDelete.first_name} ${confirmToDelete.last_name}. Tutti i dati associati (turni, punti, vendite) verranno rimossi.` : ''}
        onConfirm={doDelete}
        onCancel={() => setConfirmToDelete(null)}
      />
    </>
  );
}
