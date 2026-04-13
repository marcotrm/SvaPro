import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { reports, exports_ } from '../api.jsx';
import { SkeletonTable } from '../components/Skeleton.jsx';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#c9a227', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function ReportsPage() {
  const { selectedStoreId } = useOutletContext();

  const [kpi, setKpi] = useState(null);
  const [trend, setTrend] = useState([]);
  const [topProds, setTopProds] = useState([]);
  const [acquisition, setAcquisition] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('daily');
  const [days, setDays] = useState(30);
  const [topBy, setTopBy] = useState('revenue');

  useEffect(() => { fetchAll(); }, [selectedStoreId, period, days, topBy]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const storeParam = selectedStoreId ? { store_id: selectedStoreId } : {};
      const [kpiRes, trendRes, topRes, acqRes] = await Promise.all([
        reports.summary({ ...storeParam, days }).catch(() => ({})),
        reports.revenueTrend({ ...storeParam, period, days }).catch(() => ({})),
        reports.topProducts({ ...storeParam, sort: topBy, limit: 8, days }).catch(() => ({})),
        reports.customerAcquisition({ ...storeParam, period, days }).catch(() => ({})),
      ]);
      const rawKpi = kpiRes.data?.data || null;
      setKpi(rawKpi ? {
        ...rawKpi,
        revenue_delta: rawKpi.revenue_delta ?? rawKpi.delta_revenue ?? null,
        orders_delta: rawKpi.orders_delta ?? rawKpi.delta_orders ?? null,
      } : null);
      setTrend((trendRes.data?.data || []).map(d => ({ date: d.period ?? d.label, revenue: parseFloat(d.revenue) || 0 })));
      setTopProds(topRes.data?.data || []);
      setAcquisition((acqRes.data?.data || []).map(d => ({ date: d.period ?? d.label, count: parseInt(d.new_customers ?? d.count) || 0 })));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (type) => {
    const params = selectedStoreId ? { store_id: selectedStoreId } : {};
    const fn = exports_[type];
    if (fn) exports_.download(fn(params), `export_${type}_${new Date().toISOString().slice(0,10)}.csv`);
  };

  const delta = (val) => {
    if (val == null) return null;
    const isUp = val >= 0;
    return <span className={`kpi-delta ${isUp ? 'up' : 'down'}`}>{isUp ? '↑' : '↓'} {Math.abs(val).toFixed(1)}%</span>;
  };

  if (loading) return <SkeletonTable />;

  return (
    <>
      {/* ── CONTROLS ── */}
      <div className="section-header">
        <div className="section-title">Report & Analisi</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="filter-chip active" value={days} onChange={e => setDays(+e.target.value)} style={{ minWidth: 100 }}>
            <option value={7}>7 giorni</option>
            <option value={14}>14 giorni</option>
            <option value={30}>30 giorni</option>
            <option value={90}>90 giorni</option>
          </select>
          <select className="filter-chip active" value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="daily">Giornaliero</option>
            <option value="weekly">Settimanale</option>
            <option value="monthly">Mensile</option>
          </select>
        </div>
      </div>

      {/* ── KPI ── */}
      {kpi && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Ricavi</div>
            <div className="kpi-value gold">
              €{(kpi.revenue ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            {delta(kpi.revenue_delta)}
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Ordini</div>
            <div className="kpi-value">{kpi.orders ?? 0}</div>
            {delta(kpi.orders_delta)}
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Ticket Medio</div>
            <div className="kpi-value">
              €{(kpi.avg_order ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Nuovi Clienti</div>
            <div className="kpi-value">{kpi.new_customers ?? 0}</div>
          </div>
        </div>
      )}

      {/* ── REVENUE TREND ── */}
      {trend.length > 0 && (
        <div className="table-card" style={{ padding: '20px 16px' }}>
          <div className="section-title" style={{ marginBottom: 16 }}>Andamento Ricavi</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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

      {/* ── BOTTOM GRID: TOP PRODUCTS + ACQUISITION ── */}
      <div className="bottom-grid">
        {/* Top Products */}
        <div className="table-card" style={{ padding: '20px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="section-title" style={{ margin: 0 }}>Top Prodotti</div>
            <select className="filter-chip active" value={topBy} onChange={e => setTopBy(e.target.value)} style={{ fontSize: 11 }}>
              <option value="revenue">Per Ricavi</option>
              <option value="qty">Per Quantità</option>
            </select>
          </div>
          {topProds.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={topProds} dataKey={topBy === 'revenue' ? 'total_revenue' : 'total_qty'}
                  nameKey="product_name" cx="50%" cy="50%" outerRadius={90} label={({ name }) => name?.slice(0, 12)}>
                  {topProds.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0e1726', border: '1px solid rgba(201,162,39,.25)', borderRadius: 8, color: '#e8edf5', fontSize: 12 }}
                  formatter={(v, name) => [topBy === 'revenue' ? `€${Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : v, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Nessun dato</div>
          )}
        </div>

        {/* Customer Acquisition */}
        <div className="table-card" style={{ padding: '20px 16px' }}>
          <div className="section-title" style={{ marginBottom: 12 }}>Acquisizione Clienti</div>
          {acquisition.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={acquisition} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                <XAxis dataKey="date" tick={{ fill: '#8a8fa8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8a8fa8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#0e1726', border: '1px solid rgba(201,162,39,.25)', borderRadius: 8, color: '#e8edf5', fontSize: 12 }}
                  formatter={v => [v, 'Nuovi clienti']}
                  labelStyle={{ color: '#10b981' }}
                />
                <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Nessun dato</div>
          )}
        </div>
      </div>

      {/* ── EXPORT ── */}
      <div className="table-card" style={{ padding: '20px 16px' }}>
        <div className="section-title" style={{ marginBottom: 16 }}>Esporta Dati (CSV)</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => handleExport('orders')}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
            Ordini
          </button>
          <button className="btn btn-ghost" onClick={() => handleExport('customers')}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
            Clienti
          </button>
          <button className="btn btn-ghost" onClick={() => handleExport('inventory')}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
            Inventario
          </button>
        </div>
      </div>
    </>
  );
}
