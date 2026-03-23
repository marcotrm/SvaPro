import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { orders, inventory, customers, employees } from '../api.jsx';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { setLowStockCount, selectedStoreId } = useOutletContext();

  const [data, setData] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    lowStockItems: 0,
    activeCustomers: 0,
    activeEmployees: 0,
    recentOrders: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { fetchDashboardData(); }, [selectedStoreId]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      const [ordersRes, inventoryRes, customersRes, employeesRes] = await Promise.all([
        orders.getOrders(selectedStoreId ? { store_id: selectedStoreId, limit: 20 } : { limit: 20 }).catch(() => ({})),
        inventory.getStock(selectedStoreId ? { store_id: selectedStoreId, limit: 80 } : { limit: 80 }).catch(() => ({})),
        customers.getCustomers(selectedStoreId ? { store_id: selectedStoreId, limit: 50 } : { limit: 50 }).catch(() => ({})),
        employees.getEmployees(selectedStoreId ? { store_id: selectedStoreId, limit: 50 } : { limit: 50 }).catch(() => ({})),
      ]);

      const ordersList    = ordersRes.data?.data    || [];
      const stockList     = inventoryRes.data?.data || [];
      const customersList = customersRes.data?.data || [];
      const employeesList = employeesRes.data?.data || [];

      const totalRevenue  = ordersList.reduce((sum, o) => sum + (o.grand_total || 0), 0);
      const lowStockItems = stockList.filter(i => i.on_hand < i.reorder_point).length;

      setData({
        totalOrders:     ordersList.length,
        totalRevenue,
        lowStockItems,
        activeCustomers: customersList.length,
        activeEmployees: employeesList.length,
        recentOrders:    ordersList.slice(0, 10),
      });

      setLowStockCount(lowStockItems);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = data.recentOrders.filter(order => {
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

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 300 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, border: '3px solid var(--border2)',
            borderTopColor: 'var(--gold)', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto',
          }}></div>
          <p style={{ marginTop: 14, color: 'var(--muted)', fontSize: 13 }}>Caricamento…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── KPI GRID ── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Ricavi Totali</div>
          <div className="kpi-value gold">
            €{data.totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="kpi-delta up">↑ live</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Ordini</div>
          <div className="kpi-value">{data.totalOrders}</div>
          <span className="kpi-delta up">Totale</span>
        </div>

        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/inventory')}>
          <div className="kpi-label">Stock Basso</div>
          <div className={`kpi-value${data.lowStockItems > 0 ? ' red' : ''}`}>{data.lowStockItems}</div>
          {data.lowStockItems > 0
            ? <span className="kpi-delta warn">⚠ da riordinare</span>
            : <span className="kpi-delta up">✓ ok</span>}
        </div>

        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/customers')}>
          <div className="kpi-label">Clienti</div>
          <div className="kpi-value">{data.activeCustomers}</div>
          <span className="kpi-delta up">Registrati</span>
        </div>
      </div>

      {/* ── ALERT BANNER ── */}
      {data.lowStockItems > 0 && (
        <div className="alert-banner">
          <span className="icon">⚠</span>
          <span>
            <strong>{data.lowStockItems} {data.lowStockItems === 1 ? 'prodotto' : 'prodotti'}</strong>
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

      {/* ── RECENT ORDERS ── */}
      <div>
        <div className="section-header">
          <div className="section-title">
            Ordini Recenti
            <span className="section-subtitle"> — ultimi {data.recentOrders.length}</span>
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
              €{data.totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="activity-item">
            <div className="activity-dot" style={{ background: 'var(--blue)' }}></div>
            <div className="activity-text">Ordini registrati</div>
            <span className="mono" style={{ color: 'var(--text)' }}>{data.totalOrders}</span>
          </div>

          <div className="activity-item">
            <div className="activity-dot" style={{ background: 'var(--green)' }}></div>
            <div className="activity-text">Clienti attivi</div>
            <span className="mono" style={{ color: 'var(--text)' }}>{data.activeCustomers}</span>
          </div>

          <div className="activity-item">
            <div className="activity-dot" style={{ background: 'var(--muted2)' }}></div>
            <div className="activity-text">Dipendenti</div>
            <span className="mono" style={{ color: 'var(--text)' }}>{data.activeEmployees}</span>
          </div>

          <div className="activity-item">
            <div className="activity-dot" style={{ background: data.lowStockItems > 0 ? 'var(--red)' : 'var(--green)' }}></div>
            <div className="activity-text">Prodotti sotto soglia</div>
            <span className={`mono${data.lowStockItems > 0 ? ' negative' : ' positive'}`}>
              {data.lowStockItems}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

