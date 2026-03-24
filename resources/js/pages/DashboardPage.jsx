import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { orders, inventory, customers, employees, reports } from '../api.jsx';
import { SkeletonKpi, SkeletonTable } from '../components/Skeleton.jsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { setLowStockCount, selectedStoreId } = useOutletContext();

  /* ── Progressive state: each section has its own loading ── */
  const [kpi, setKpi] = useState(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [revenueChart, setRevenueChart] = useState([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [stockInfo, setStockInfo] = useState({ lowStockItems: 0, total: 0 });
  const [custCount, setCustCount] = useState(0);
  const [empCount, setEmpCount] = useState(0);
  const [countsReady, setCountsReady] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchDashboardData = useCallback(() => {
    setError('');
    const sp = selectedStoreId ? { store_id: selectedStoreId } : {};

    /* Each fetch is independent — UI updates as data arrives */
    reports.summary(sp)
      .then(res => { const d = res.data?.data; if (d) setKpi(d); })
      .catch(() => {})
      .finally(() => setKpiLoading(false));

    reports.revenueTrend({ ...sp, period: 'daily', days: 14 })
      .then(res => {
        const arr = res.data?.data || [];
        setRevenueChart(arr.map(d => ({ date: d.label, revenue: parseFloat(d.revenue) || 0 })));
      })
      .catch(() => {})
      .finally(() => setChartLoading(false));

    orders.getOrders({ ...sp, limit: 20 })
      .then(res => setRecentOrders(res.data?.data || []))
      .catch(() => setRecentOrders([]))
      .finally(() => setOrdersLoading(false));

    inventory.getStock({ ...sp, limit: 80 })
      .then(res => {
        const list = res.data?.data || [];
        const low = list.filter(i => i.on_hand < i.reorder_point).length;
        setStockInfo({ lowStockItems: low, total: list.length });
        setLowStockCount(low);
      })
      .catch(() => {});

    Promise.all([
      customers.getCustomers({ ...sp, limit: 50 }).catch(() => ({})),
      employees.getEmployees({ ...sp, limit: 50 }).catch(() => ({})),
    ]).then(([cRes, eRes]) => {
      setCustCount((cRes.data?.data || []).length);
      setEmpCount((eRes.data?.data || []).length);
      setCountsReady(true);
    });
  }, [selectedStoreId]);

  useEffect(() => {
    setKpiLoading(true);
    setChartLoading(true);
    setOrdersLoading(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  /* ── Derived ── */
  const totalRevenue = recentOrders.reduce((sum, o) => sum + (o.grand_total || 0), 0);

  const filteredOrders = recentOrders.filter(order => {
    const matchSearch =
      !search ||
      String(order.id).includes(search) ||
      `${order.customer?.first_name} ${order.customer?.last_name}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === 'all' || order.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusBadge = (status) => {
    if (status === 'paid')    return <span className="badge high"><span className="badge-dot"></span>Pagato</span>;
    if (status === 'draft')   return <span className="badge mid"><span className="badge-dot"></span>Bozza</span>;
    return                           <span className="badge low"><span className="badge-dot"></span>Pendente</span>;
  };

  return (
    <>
      {/* ── KPI GRID ── */}
      {kpiLoading ? <SkeletonKpi /> : (
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Ricavi Totali</div>
          <div className="kpi-value gold">
            €{(kpi?.revenue ?? totalRevenue).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          {kpi?.revenue_delta != null
            ? <span className={`kpi-delta ${kpi.revenue_delta >= 0 ? 'up' : 'down'}`}>
                {kpi.revenue_delta >= 0 ? '↑' : '↓'} {Math.abs(kpi.revenue_delta).toFixed(1)}%
              </span>
            : <span className="kpi-delta up">↑ live</span>}
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Ordini</div>
          <div className="kpi-value">{kpi?.orders ?? recentOrders.length}</div>
          {kpi?.orders_delta != null
            ? <span className={`kpi-delta ${kpi.orders_delta >= 0 ? 'up' : 'down'}`}>
                {kpi.orders_delta >= 0 ? '↑' : '↓'} {Math.abs(kpi.orders_delta).toFixed(1)}%
              </span>
            : <span className="kpi-delta up">Totale</span>}
        </div>

        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/inventory')}>
          <div className="kpi-label">Stock Basso</div>
          <div className={`kpi-value${stockInfo.lowStockItems > 0 ? ' red' : ''}`}>{stockInfo.lowStockItems}</div>
          {stockInfo.lowStockItems > 0
            ? <span className="kpi-delta warn">⚠ da riordinare</span>
            : <span className="kpi-delta up">✓ ok</span>}
        </div>

        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/customers')}>
          <div className="kpi-label">Clienti</div>
          <div className="kpi-value">{custCount}</div>
          <span className="kpi-delta up">Registrati</span>
        </div>
      </div>
      )}

      {/* ── ALERT BANNER ── */}
      {stockInfo.lowStockItems > 0 && (
        <div className="alert-banner">
          <span className="icon">⚠</span>
          <span>
            <strong>{stockInfo.lowStockItems} {stockInfo.lowStockItems === 1 ? 'prodotto' : 'prodotti'}</strong>
            con stock sotto la soglia di riordino
          </span>
          <button className="banner-link" onClick={() => navigate('/inventory/smart-reorder')}>
            Vai a Smart Reorder →
          </button>
        </div>
      )}

      {/* ── ERROR ── */}
      {error && (
        <div className="alert-banner" style={{ borderColor: 'rgba(230,76,60,.4)' }}>
          <span className="icon">✕</span>
          <span><strong>Errore:</strong> {error}</span>
          <button className="banner-link" onClick={fetchDashboardData}>Riprova →</button>
        </div>
      )}

      {/* ── REVENUE CHART ── */}
      {chartLoading ? null : revenueChart.length > 0 && (
        <div className="table-card" style={{ padding: '20px 16px' }}>
          <div className="section-title" style={{ marginBottom: 16 }}>
            Andamento Ricavi
            <span className="section-subtitle"> — ultimi 14 giorni</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
              <XAxis dataKey="date" tick={{ fill: '#8a8fa8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8a8fa8', fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
              <Tooltip
                contentStyle={{ background: '#0e1726', border: '1px solid rgba(201,162,39,.25)', borderRadius: 8, color: '#e8edf5', fontSize: 12 }}
                formatter={v => [`€${Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, 'Ricavi']}
                labelStyle={{ color: '#c9a227' }}
              />
              <Bar dataKey="revenue" fill="#c9a227" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── RECENT ORDERS ── */}
      {ordersLoading ? <SkeletonTable /> : (
      <div>
        <div className="section-header">
          <div className="section-title">
            Ordini Recenti
            <span className="section-subtitle"> — ultimi {recentOrders.length}</span>
          </div>
          <button className="btn btn-ghost" onClick={() => navigate('/orders')}>Vedi tutti</button>
          <button className="btn btn-gold" onClick={() => navigate('/orders')}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"/></svg>
            Nuovo Ordine
          </button>
        </div>

        <div className="table-card">
          <div className="table-toolbar">
            <div className="search-box">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style={{ color: 'var(--muted)', flexShrink: 0 }}>
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
              </svg>
              <input
                placeholder="Cerca per ID o cliente…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button
              className={`filter-chip${statusFilter === 'all' ? ' active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >Tutti</button>
            <button
              className={`filter-chip${statusFilter === 'paid' ? ' active' : ''}`}
              onClick={() => setStatusFilter('paid')}
            >Pagati</button>
            <button
              className={`filter-chip${statusFilter === 'draft' ? ' active' : ''}`}
              onClick={() => setStatusFilter('draft')}
            >Bozze</button>
            <button
              className={`filter-chip${statusFilter === 'pending' ? ' active' : ''}`}
              onClick={() => setStatusFilter('pending')}
            >Pendenti</button>
          </div>

          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Totale</th>
                <th>Stato</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length > 0 ? filteredOrders.map(order => (
                <tr key={order.id}>
                  <td><span className="mono">#{String(order.id).padStart(4, '0')}</span></td>
                  <td style={{ color: 'var(--text)', fontWeight: 500 }}>
                    {order.customer
                      ? `${order.customer.first_name} ${order.customer.last_name}`
                      : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td>
                    <span className="mono positive">
                      €{(order.grand_total || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td>{statusBadge(order.status)}</td>
                  <td>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '5px 10px', fontSize: 12 }}
                      onClick={() => navigate('/orders')}
                    >
                      Apri
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)' }}>
                    {search || statusFilter !== 'all' ? 'Nessun risultato per i filtri applicati' : 'Nessun ordine trovato'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* ── BOTTOM GRID ── */}
      <div className="bottom-grid">

        {/* Quick Actions */}
        <div className="mini-card">
          <div className="mini-card-title">Azioni Rapide</div>

          <a className="quick-action" href="/orders" onClick={e => { e.preventDefault(); navigate('/orders'); }}>
            <div className="quick-action-icon" style={{ background: 'var(--blue-bg)' }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="var(--blue)"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3z"/></svg>
            </div>
            <div>
              <div className="quick-action-label">Nuovo Ordine</div>
              <div className="quick-action-sub">Aggiungi un ordine di vendita</div>
            </div>
          </a>

          <a className="quick-action" href="/inventory/smart-reorder" onClick={e => { e.preventDefault(); navigate('/inventory/smart-reorder'); }}>
            <div className="quick-action-icon" style={{ background: 'var(--amber-bg)' }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="var(--amber)"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
            </div>
            <div>
              <div className="quick-action-label">Smart Reorder</div>
              <div className="quick-action-sub">Riordino automatico AI</div>
            </div>
          </a>

          <a className="quick-action" href="/catalog" onClick={e => { e.preventDefault(); navigate('/catalog'); }}>
            <div className="quick-action-icon" style={{ background: 'var(--gold-glow)' }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="var(--gold)"><path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4z" clipRule="evenodd"/></svg>
            </div>
            <div>
              <div className="quick-action-label">Aggiungi Prodotto</div>
              <div className="quick-action-sub">Gestisci il catalogo</div>
            </div>
          </a>

          <a className="quick-action" href="/customers" onClick={e => { e.preventDefault(); navigate('/customers'); }}>
            <div className="quick-action-icon" style={{ background: 'var(--green-bg)' }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="var(--green)"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
            </div>
            <div>
              <div className="quick-action-label">Nuovo Cliente</div>
              <div className="quick-action-sub">Registra un cliente</div>
            </div>
          </a>
        </div>

        {/* Riepilogo */}
        <div className="mini-card">
          <div className="mini-card-title">Riepilogo <span>aggiornato ora</span></div>

          <div className="activity-item">
            <div className="activity-dot" style={{ background: 'var(--gold)' }}></div>
            <div className="activity-text">Ricavi totali</div>
            <span className="mono positive">
              €{totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="activity-item">
            <div className="activity-dot" style={{ background: 'var(--blue)' }}></div>
            <div className="activity-text">Ordini registrati</div>
            <span className="mono" style={{ color: 'var(--text)' }}>{recentOrders.length}</span>
          </div>

          <div className="activity-item">
            <div className="activity-dot" style={{ background: 'var(--green)' }}></div>
            <div className="activity-text">Clienti attivi</div>
            <span className="mono" style={{ color: 'var(--text)' }}>{custCount}</span>
          </div>

          <div className="activity-item">
            <div className="activity-dot" style={{ background: 'var(--muted2)' }}></div>
            <div className="activity-text">Dipendenti</div>
            <span className="mono" style={{ color: 'var(--text)' }}>{empCount}</span>
          </div>

          <div className="activity-item">
            <div className="activity-dot" style={{ background: stockInfo.lowStockItems > 0 ? 'var(--red)' : 'var(--green)' }}></div>
            <div className="activity-text">Prodotti sotto soglia</div>
            <span className={`mono${stockInfo.lowStockItems > 0 ? ' negative' : ' positive'}`}>
              {stockInfo.lowStockItems}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

