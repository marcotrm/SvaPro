import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { orders } from '../api.jsx';
import { SkeletonTable } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';

export default function StockAlertsPage() {
  const { selectedStoreId, selectedStore } = useOutletContext();

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('unresolved');
  const [resolvingId, setResolvingId] = useState(null);

  useEffect(() => {
    fetchAlerts();
  }, [selectedStoreId, statusFilter]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {
        status: statusFilter,
        limit: 250,
      };

      if (selectedStoreId) {
        params.store_id = selectedStoreId;
      }

      const response = await orders.getStockAlerts(params);
      setAlerts(response.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nel caricamento degli alert stock');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (alertId) => {
    try {
      setResolvingId(alertId);
      await orders.resolveStockAlert(alertId);
      await fetchAlerts();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nella risoluzione dell\'alert');
    } finally {
      setResolvingId(null);
    }
  };

  const fmtDate = (value) => (value ? new Date(value).toLocaleString('it-IT') : '-');

  if (loading) return <SkeletonTable />;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head-title">Alert Stock</div>
          <div className="page-head-sub">
            {alerts.length} alert{selectedStore ? ` - Store: ${selectedStore.name}` : ''}
          </div>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchAlerts} />}

      <div className="table-card">
        <div className="table-toolbar">
          <button className={`filter-chip${statusFilter === 'unresolved' ? ' active' : ''}`} onClick={() => setStatusFilter('unresolved')}>
            Da risolvere
          </button>
          <button className={`filter-chip${statusFilter === 'resolved' ? ' active' : ''}`} onClick={() => setStatusFilter('resolved')}>
            Risolti
          </button>
          <button className={`filter-chip${statusFilter === 'all' ? ' active' : ''}`} onClick={() => setStatusFilter('all')}>
            Tutti
          </button>
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>
            {alerts.length} risultati
          </span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Ordine</th>
              <th>Prodotto</th>
              <th>Richiesto</th>
              <th>Disponibile</th>
              <th>Mancanza</th>
              <th>Stato</th>
              <th>Creato</th>
              <th style={{ textAlign: 'right' }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length > 0 ? alerts.map((alert) => {
              const isResolved = Boolean(alert.resolved_at);
              return (
                <tr key={alert.id}>
                  <td><span className="mono">#{alert.sales_order_id}</span></td>
                  <td style={{ color: 'var(--text)', fontWeight: 600 }}>
                    {alert.product_name || `Variante #${alert.product_variant_id || '-'}`}
                  </td>
                  <td>{alert.requested_qty ?? '-'}</td>
                  <td>{alert.available_qty ?? '-'}</td>
                  <td>
                    <span className={`badge ${Number(alert.shortage_qty || 0) > 0 ? 'low' : 'high'}`}>
                      <span className="badge-dot" />
                      {alert.shortage_qty ?? '-'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${isResolved ? 'high' : 'low'}`}>
                      <span className="badge-dot" />
                      {isResolved ? 'Risolto' : 'Aperto'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--muted2)' }}>{fmtDate(alert.created_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {!isResolved && (
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        disabled={resolvingId === alert.id}
                        onClick={() => handleResolve(alert.id)}
                      >
                        {resolvingId === alert.id ? 'Risoluzione...' : 'Risolvi'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>
                  Nessun alert stock trovato
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
