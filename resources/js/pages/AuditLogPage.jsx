import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { audit } from '../api.jsx';
import { SkeletonTable } from '../components/Skeleton.jsx';
import DatePicker from '../components/DatePicker.jsx';

const actionLabels = {
  create: 'Creazione',
  update: 'Modifica',
  delete: 'Eliminazione',
  adjust: 'Rettifica',
  login: 'Login',
  logout: 'Logout',
  impersonate: 'Impersonificazione',
};

const entityLabels = {
  product: 'Prodotto',
  customer: 'Cliente',
  employee: 'Dipendente',
  order: 'Ordine',
  inventory: 'Magazzino',
};

const actionBadge = (action) => {
  if (action === 'create') return 'high';
  if (action === 'update') return 'mid';
  if (action === 'delete' || action === 'adjust') return 'low';
  return 'mid';
};

export default function AuditLogPage() {
  const { user } = useOutletContext();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => { fetchLogs(); }, [actionFilter, entityFilter, dateFrom, dateTo]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError('');
      const params = { limit: 100 };
      if (actionFilter) params.action = actionFilter;
      if (entityFilter) params.entity_type = entityFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await audit.getLogs(params);
      setLogs(res.data?.data || []);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento dei log');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (v) => v ? new Date(v).toLocaleString('it-IT') : '-';

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head-title">Registro Attività</div>
          <div className="page-head-sub">
            {logs.length} eventi registrati
          </div>
        </div>
      </div>

      {error && (
        <div className="alert-banner" style={{ borderColor: 'rgba(230,76,60,.4)' }}>
          <span className="icon">✕</span>
          <span><strong>Errore:</strong> {error}</span>
          <button className="banner-link" onClick={fetchLogs}>Riprova ?</button>
        </div>
      )}

      <div className="table-card">
        <div className="table-toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
          <select
            className="form-select"
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            style={{ minWidth: 140 }}
          >
            <option value="">Tutte le azioni</option>
            {Object.entries(actionLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select
            className="form-select"
            value={entityFilter}
            onChange={e => setEntityFilter(e.target.value)}
            style={{ minWidth: 140 }}
          >
            <option value="">Tutte le entità</option>
            {Object.entries(entityLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <div style={{ minWidth: 180 }}>
            <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Data da..." />
          </div>
          <div style={{ minWidth: 180 }}>
            <DatePicker value={dateTo} onChange={setDateTo} placeholder="Data a..." />
          </div>

          {(actionFilter || entityFilter || dateFrom || dateTo) && (
            <button
              className="filter-chip"
              onClick={() => { setActionFilter(''); setEntityFilter(''); setDateFrom(''); setDateTo(''); }}
            >
              Resetta filtri
            </button>
          )}

          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>
            {logs.length} risultati
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 24 }}><SkeletonTable rows={8} cols={6} /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Utente</th>
                <th>Azione</th>
                <th>Entità</th>
                <th>Dettaglio</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.length > 0 ? logs.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--muted2)' }}>
                    {formatDate(log.performed_at || log.created_at)}
                  </td>
                  <td style={{ fontWeight: 500, color: 'var(--text)' }}>
                    {log.user_name || log.actor_name || log.actor_email || '-'}
                  </td>
                  <td>
                    <span className={`badge ${actionBadge(log.action)}`}>
                      <span className="badge-dot" />
                      {actionLabels[log.action] || log.action}
                    </span>
                  </td>
                  <td style={{ color: 'var(--muted2)' }}>
                    {entityLabels[log.entity_type] || log.entity_type}
                    {log.entity_id ? ` #${log.entity_id}` : ''}
                  </td>
                  <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted2)', fontSize: 12 }}>
                    {log.entity_label || '-'}
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {log.ip || '-'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
                    Nessun evento registrato
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
