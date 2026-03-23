import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { stores, clearApiCache } from '../api.jsx';
import { SkeletonKpi, SkeletonTable } from '../components/Skeleton.jsx';

export default function ControlTowerPage() {
  const navigate = useNavigate();
  const { user } = useOutletContext();
  const [health, setHealth] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isSuperAdmin = (user?.roles || []).includes('superadmin');

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchHealth();
  }, []);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await stores.getTenantHealth();
      setHealth(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Errore nel caricamento dati');
    } finally {
      setLoading(false);
    }
  };

  const handleEnterTenant = (tenantCode) => {
    localStorage.setItem('tenantCode', tenantCode);
    localStorage.removeItem('selectedStoreId');
    clearApiCache();
    navigate('/');
  };

  const totals = health.reduce(
    (acc, t) => ({
      stores: acc.stores + t.stores,
      products: acc.products + t.products,
      customers: acc.customers + t.customers,
      employees: acc.employees + t.employees,
      total_orders: acc.total_orders + t.total_orders,
      total_revenue: acc.total_revenue + t.total_revenue,
      low_stock: acc.low_stock + t.low_stock_items,
    }),
    { stores: 0, products: 0, customers: 0, employees: 0, total_orders: 0, total_revenue: 0, low_stock: 0 }
  );

  if (!isSuperAdmin) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
        Accesso riservato al Superadmin.
      </div>
    );
  }

  if (loading) {
    return (
      <>
        <SkeletonKpi count={4} />
        <SkeletonTable cols={8} rows={3} />
      </>
    );
  }

  const fmtCurrency = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="page-head-title">Control Tower</div>
          <div className="page-head-sub">
            Panoramica globale — {health.length} tenant attivi
          </div>
        </div>
        <button className="btn btn-ghost" onClick={fetchHealth}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          Aggiorna
        </button>
      </div>

      {error && (
        <div className="banner banner-error">
          <span className="banner-icon">✕</span>
          <div className="banner-text"><strong>Errore:</strong> {error}</div>
          <button className="banner-action" onClick={fetchHealth}>Riprova</button>
        </div>
      )}

      {/* Global KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Tenant</div>
          <div className="kpi-value">{health.length}</div>
          <span className="kpi-delta up">{totals.stores} store totali</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Ricavi Globali</div>
          <div className="kpi-value gold">{fmtCurrency(totals.total_revenue)}</div>
          <span className="kpi-delta up">{totals.total_orders} ordini</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Prodotti</div>
          <div className="kpi-value">{totals.products}</div>
          <span className="kpi-delta up">{totals.customers} clienti</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Stock Basso</div>
          <div className={`kpi-value${totals.low_stock > 0 ? ' red' : ''}`}>{totals.low_stock}</div>
          {totals.low_stock > 0
            ? <span className="kpi-delta warn">Attenzione riordino</span>
            : <span className="kpi-delta up">Tutto OK</span>}
        </div>
      </div>

      {/* Per-tenant table */}
      <div className="table-card">
        <div className="table-toolbar">
          <div className="section-title">Dettaglio per Tenant</div>
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>
            {health.length} tenant
          </span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Store</th>
              <th>Admin</th>
              <th>Prodotti</th>
              <th>Clienti</th>
              <th>Ordini</th>
              <th>Ricavi</th>
              <th>Stock Basso</th>
              <th style={{ textAlign: 'right' }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {health.length > 0 ? health.map((t) => (
              <tr key={t.tenant_id}>
                <td>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text)' }}>{t.name}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{t.code}</div>
                  </div>
                </td>
                <td className="mono">{t.stores}</td>
                <td className="mono">{t.admins}</td>
                <td className="mono">{t.products}</td>
                <td className="mono">{t.customers}</td>
                <td className="mono">{t.total_orders}</td>
                <td><span className="mono positive">{fmtCurrency(t.total_revenue)}</span></td>
                <td>
                  {t.low_stock_items > 0 ? (
                    <span className="badge low"><span className="badge-dot" />{t.low_stock_items} item</span>
                  ) : (
                    <span className="badge high"><span className="badge-dot" />OK</span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                    <button
                      className="btn btn-gold"
                      style={{ fontSize: 12, padding: '6px 14px' }}
                      onClick={() => handleEnterTenant(t.code)}
                    >
                      Entra
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
                  Nessun tenant trovato
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
