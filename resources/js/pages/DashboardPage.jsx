import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { orders as ordersApi, inventory, customers, reports } from '../api.jsx';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area, CartesianGrid
} from 'recharts';
import { 
  ArrowUpRight, ArrowDownRight, Users, TrendingUp, 
  ShoppingCart, Package, DollarSign, AlertTriangle
} from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { selectedStoreId } = useOutletContext();

  const [kpi, setKpi] = useState(null);
  const [revenueChart, setRevenueChart] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [custCount, setCustCount] = useState(0);
  const [stockStats, setStockStats] = useState({ low: 0, out: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const sp = selectedStoreId ? { store_id: selectedStoreId } : {};

      const [resSummary, resTrend, resOrders, resStock, resCust] = await Promise.all([
        reports.summary(sp),
        reports.revenueTrend({ ...sp, period: 'daily', days: 14 }),
        ordersApi.getOrders({ ...sp, limit: 8 }),
        inventory.getStock({ ...sp, limit: 1000 }),
        customers.getCustomers({ ...sp, limit: 1 })
      ]);

      setKpi(resSummary.data?.data || null);
      
      const trendData = (resTrend.data?.data || []).map(d => ({ 
        label: d.label, 
        revenue: parseFloat(d.revenue) || 0,
        orders: parseInt(d.orders_count) || 0
      }));
      setRevenueChart(trendData);
      setRecentOrders(resOrders.data?.data || []);
      setCustCount(resCust.data?.meta?.total || 0);

      const stockList = resStock.data?.data || [];
      const low = stockList.filter(i => i.on_hand > 0 && i.on_hand < (i.reorder_point || 10)).length;
      const out = stockList.filter(i => i.on_hand <= 0).length;
      setStockStats({ low, out, total: stockList.length });
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally { setLoading(false); }
  }, [selectedStoreId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);
  const fmtDate = (v) => v ? new Date(v).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '—';

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
      <div style={{ width: 36, height: 36, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%' }} className="sp-spin" />
    </div>
  );

  return (
    <div className="sp-animate-in">
      <div className="sp-page-header sp-mb-6">
        <div>
          <h1 className="sp-page-title">Dashboard</h1>
          <p className="sp-page-subtitle">Panoramica attività</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="sp-stats-grid sp-mb-6">
        <div className="sp-stat-card">
          <div className="sp-stat-label">
            <DollarSign size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            Fatturato
          </div>
          <div className="sp-stat-value">{fmt(kpi?.revenue_total)}</div>
          {kpi?.revenue_trend != null && (
            <div className={`sp-stat-trend ${kpi.revenue_trend >= 0 ? 'up' : 'down'}`}>
              {kpi.revenue_trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {Math.abs(kpi.revenue_trend || 0).toFixed(1)}% vs periodo prec.
            </div>
          )}
        </div>
        <div className="sp-stat-card">
          <div className="sp-stat-label">
            <ShoppingCart size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            Ordini
          </div>
          <div className="sp-stat-value">{kpi?.orders_count || 0}</div>
        </div>
        <div className="sp-stat-card">
          <div className="sp-stat-label">
            <Users size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            Clienti
          </div>
          <div className="sp-stat-value">{custCount}</div>
        </div>
        <div className="sp-stat-card">
          <div className="sp-stat-label">
            <AlertTriangle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            Alerti Stock
          </div>
          <div className="sp-stat-value" style={{ color: (stockStats.low + stockStats.out) > 0 ? 'var(--color-warning)' : 'inherit' }}>
            {stockStats.low + stockStats.out}
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Revenue Chart */}
        <div className="sp-card">
          <div className="sp-card-header">
            <span className="sp-card-title">Andamento Fatturato (14g)</span>
          </div>
          <div className="sp-card-body" style={{ height: 280 }}>
            {revenueChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChart}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0066FF" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#0066FF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
                    formatter={(v) => [fmt(v), 'Fatturato']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#0066FF" strokeWidth={2} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-tertiary)' }}>
                Nessun dato disponibile
              </div>
            )}
          </div>
        </div>

        {/* Stock summary */}
        <div className="sp-card">
          <div className="sp-card-header">
            <span className="sp-card-title">Stato Magazzino</span>
          </div>
          <div className="sp-card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Referenze totali</span>
                <span style={{ fontSize: 20, fontWeight: 800 }}>{stockStats.total}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--color-warning)' }}>⚠ Stock basso</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-warning)' }}>{stockStats.low}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--color-error)' }}>✕ Esauriti</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-error)' }}>{stockStats.out}</span>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />
              <button className="sp-btn sp-btn-secondary sp-btn-block" onClick={() => navigate('/inventory')}>
                Vai al Magazzino
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="sp-table-wrap">
        <div className="sp-table-toolbar">
          <span style={{ fontWeight: 700, fontSize: 14 }}>Ordini Recenti</span>
          <button className="sp-btn sp-btn-ghost sp-btn-sm" onClick={() => navigate('/orders')} style={{ marginLeft: 'auto' }}>
            Vedi tutti →
          </button>
        </div>
        <table className="sp-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Data</th>
              <th>Cliente</th>
              <th>Totale</th>
              <th>Stato</th>
              <th>Pagamento</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.length > 0 ? recentOrders.map(order => (
              <tr key={order.id}>
                <td className="sp-font-mono sp-cell-secondary">#{order.id}</td>
                <td className="sp-cell-secondary">{fmtDate(order.created_at)}</td>
                <td className="sp-cell-primary">{order.customer_name || 'Walk-in'}</td>
                <td style={{ fontWeight: 700 }}>{fmt(order.total)}</td>
                <td>
                  <span className={`sp-badge ${order.status === 'paid' ? 'sp-badge-success' : order.status === 'cancelled' ? 'sp-badge-error' : 'sp-badge-warning'}`}>
                    <span className="sp-badge-dot" />
                    {order.status === 'paid' ? 'Pagato' : order.status === 'cancelled' ? 'Annullato' : order.status}
                  </span>
                </td>
                <td className="sp-cell-secondary" style={{ textTransform: 'capitalize' }}>{order.payment_method || '—'}</td>
              </tr>
            )) : (
              <tr><td colSpan="6" className="sp-table-empty">Nessun ordine recente</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
