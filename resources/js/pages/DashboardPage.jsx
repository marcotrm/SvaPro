import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { orders as ordersApi, inventory, customers, reports, stores as storesApi } from '../api.jsx';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, Cell, PieChart, Pie
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, Search, Bell, Download, Users, Trophy } from 'lucide-react';

/* ─── palette ──────────────────────────────────────────────── */
const PURPLE   = '#9B8FD4';
const PURPLE_L = '#C5BEE8';
const PURPLE_D = '#6C63AC';
const STORE_COLORS = ['#6C63AC','#22C55E','#F59E0B','#EF4444','#3B82F6','#EC4899','#14B8A6'];

/* ─── Period tabs ───────────────────────────────────────────── */
const PERIODS = [
  { id: 'today',     label: 'Oggi',      chartPeriod: 'daily',   days: 1 },
  { id: 'yesterday', label: 'Ieri',      chartPeriod: 'daily',   days: 2 },
  { id: 'week',      label: 'Settimana', chartPeriod: 'daily',   days: 7 },
  { id: 'month',     label: 'Mese',      chartPeriod: 'weekly',  days: 30 },
  { id: 'year',      label: 'Anno',      chartPeriod: 'monthly', days: 365 },
];

/* ─── piccoli helpers UI ────────────────────────────────────── */
const Avatar = ({ name = '', size = 36, color = '#9B8FD4', photoUrl = null }) => {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  if (photoUrl) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        overflow: 'hidden', background: color,
      }}>
        <img
          src={photoUrl}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={e => { e.currentTarget.style.display = 'none'; }}
        />
      </div>
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.35, fontWeight: 700, flexShrink: 0,
    }}>{initials}</div>
  );
};

const Trend = ({ value }) => {
  if (value == null) return null;
  const up = value >= 0;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: 12, fontWeight: 600, color: up ? '#22C55E' : '#EF4444' }}>
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(value).toFixed(0)}%
    </span>
  );
};

const CustomBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1C1B2E', color: '#fff', borderRadius: 10,
      padding: '8px 14px', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.fill, display: 'inline-block' }} />
          {p.value > 0 ? `€${p.value.toFixed(0)}` : 0}
        </div>
      ))}
    </div>
  );
};

/* ─── DONUT CHART ────────────────────────────────────────────── */
const DonutChart = ({ data = [], colors = STORE_COLORS }) => {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div style={{ position: 'relative', width: 160, height: 160 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={48} outerRadius={72}
            dataKey="value" startAngle={90} endAngle={-270} strokeWidth={2} stroke="#fff">
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>Totale</span>
        <span style={{ fontSize: 18, fontWeight: 800 }}>{total}</span>
      </div>
    </div>
  );
};

const MiniBar = ({ data = [], color = '#fff' }) => (
  <ResponsiveContainer width="100%" height={60}>
    <BarChart data={data} barSize={6}>
      <Bar dataKey="v" fill={color} radius={[3, 3, 0, 0]} opacity={0.7} />
    </BarChart>
  </ResponsiveContainer>
);

const MiniLine = ({ data = [], color = '#fff' }) => (
  <ResponsiveContainer width="100%" height={60}>
    <AreaChart data={data}>
      <defs>
        <linearGradient id="miniGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity={0.3} />
          <stop offset="95%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2}
        fill="url(#miniGrad)" dot={false} />
    </AreaChart>
  </ResponsiveContainer>
);

const StatusBadge = ({ status }) => {
  const map = {
    paid:      { label: 'Pagato',    color: '#22C55E' },
    refunded:  { label: 'Rimborso',  color: '#EF4444' },
    cancelled: { label: 'Annullato', color: '#EF4444' },
    draft:     { label: 'Bozza',     color: '#F59E0B' },
  };
  const s = map[status] || { label: status, color: '#9CA3AF' };
  return <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.label}</span>;
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const navigate  = useNavigate();
  const { selectedStoreId } = useOutletContext();

  const [kpi,          setKpi]          = useState(null);
  const [monthlyChart, setMonthlyChart] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [custCount,    setCustCount]    = useState(0);
  const [topProducts,  setTopProducts]  = useState([]);
  const [stockStats,   setStockStats]   = useState({ low: 0, out: 0, total: 0 });
  const [loading,      setLoading]      = useState(true);

  // NEW: period filter for main chart
  const [activePeriod, setActivePeriod] = useState('year');

  // NEW: employee activity (ultime attività = dipendenti)
  const [employeeActivity, setEmployeeActivity] = useState([]);

  // NEW: store revenue ranking
  const [storeRanking, setStoreRanking] = useState([]);
  const [storesList, setStoresList] = useState([]);
  const [donutStoreId, setDonutStoreId] = useState('all');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const sp = selectedStoreId ? { store_id: selectedStoreId } : {};
      const period = PERIODS.find(p => p.id === activePeriod) || PERIODS[4];

      // Calcola date_from per il filtro ordini
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - period.days);
      const dateFromStr = dateFrom.toISOString().slice(0, 10);

      // Fetch each independently so one failure doesn't break everything
      const [resSummary, resTrend, resOrders, resStock, resCust, resStores] = await Promise.allSettled([
        reports.summary(sp),
        reports.revenueTrend({ ...sp, period: period.chartPeriod, days: period.days }),
        ordersApi.getOrders({ ...sp, limit: 200, status: 'paid', date_from: dateFromStr }),
        inventory.getStock({ ...sp, limit: 1000 }),
        customers.getCustomers({ limit: 1 }),
        storesApi.getStores(),
      ]);

      // ── KPI Summary ───────────────────────────────────────────
      if (resSummary.status === 'fulfilled') {
        const raw = resSummary.value?.data?.data;
        setKpi(raw ? {
          revenue_total:   raw.revenue        ?? raw.revenue_total  ?? 0,
          orders_count:    raw.orders         ?? raw.orders_count   ?? 0,
          avg_order:       raw.avg_order      ?? 0,
          revenue_trend:   raw.delta_revenue  ?? raw.revenue_trend  ?? null,
          orders_trend:    raw.delta_orders   ?? raw.orders_trend   ?? null,
          total_customers: raw.total_customers ?? 0,
          new_customers:   raw.new_customers  ?? 0,
          low_stock:       raw.low_stock      ?? 0,
        } : null);
      }

      // ── Revenue Trend Chart ───────────────────────────────────
      if (resTrend.status === 'fulfilled') {
        const trend = resTrend.value?.data?.data || [];
        if (activePeriod === 'year') {
          // Monthly chart (12 mesi)
          const MONTHS = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
          const monthly = MONTHS.map((m, i) => {
            const found = trend.find(d => {
              const rawPeriod = d.period ?? d.label ?? '';
              const mo = new Date(rawPeriod.length === 7 ? rawPeriod + '-01' : rawPeriod).getMonth();
              return mo === i;
            });
            return { label: m, revenue: parseFloat(found?.revenue || 0), orders: parseInt(found?.order_count ?? 0) };
          });
          setMonthlyChart(monthly);
        } else if (activePeriod === 'month') {
          // Weekly chart (4-5 settimane)
          const weekly = trend.map(d => ({
            label: `W${d.period?.slice(-2) || d.label || ''}`,
            revenue: parseFloat(d.revenue || 0),
            orders: parseInt(d.order_count ?? 0),
          }));
          setMonthlyChart(weekly.length ? weekly : [{ label: 'N/D', revenue: 0, orders: 0 }]);
        } else {
          // Daily chart (today/week/yesterday)
          const daily = trend.map(d => ({
            label: d.period ? new Date(d.period).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : (d.label || ''),
            revenue: parseFloat(d.revenue || 0),
            orders: parseInt(d.order_count ?? 0),
          }));
          setMonthlyChart(daily.length ? daily : [{ label: 'N/D', revenue: 0, orders: 0 }]);
        }
      }

      // ── Recent Orders & Employee Activity ─────────────────────
      if (resOrders.status === 'fulfilled') {
        const ordersList = resOrders.value?.data?.data || [];
        setRecentOrders(ordersList);

        // Employee activity — usa employee_name + photo_url dal backend
        const empMap = {};
        ordersList.forEach(o => {
          const name = o.employee_name; // ora restituito dal backend
          if (!name) return;
          if (!empMap[name]) empMap[name] = { name, sales: 0, revenue: 0, photoUrl: o.employee_photo_url || null };
          empMap[name].sales++;
          empMap[name].revenue += parseFloat(o.total || o.grand_total || 0);
          // aggiorna la foto se disponibile
          if (o.employee_photo_url && !empMap[name].photoUrl) empMap[name].photoUrl = o.employee_photo_url;
        });
        setEmployeeActivity(Object.values(empMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5));

        // Store ranking — usa store_id + store_name dal backend
        const storeMap = {};
        ordersList.forEach(o => {
          const sId = o.store_id;
          const sName = o.store_name || o.warehouse?.name || `Negozio #${sId}`;
          if (!sId) return;
          if (!storeMap[sId]) storeMap[sId] = { id: sId, name: sName, revenue: 0, orders: 0 };
          storeMap[sId].revenue += parseFloat(o.total || o.grand_total || 0);
          storeMap[sId].orders++;
        });
        setStoreRanking(Object.values(storeMap).sort((a, b) => b.revenue - a.revenue));

        // Top products
        const topProd = [...ordersList]
          .flatMap(o => o.lines || [])
          .reduce((acc, line) => {
            const key = line.product_name || line.sku || `#${line.product_variant_id}`;
            if (!acc[key]) acc[key] = { name: key, qty: 0, revenue: 0 };
            acc[key].qty     += line.qty || 0;
            acc[key].revenue += (line.qty || 0) * (line.unit_price || 0);
            return acc;
          }, {});
        setTopProducts(Object.values(topProd).sort((a, b) => b.revenue - a.revenue).slice(0, 5));
      }

      // ── Customer Count ─────────────────────────────────────────
      if (resCust.status === 'fulfilled') {
        const custData = resCust.value?.data;
        const total = custData?.meta?.total ?? custData?.meta?.pagination?.total ?? custData?.pagination?.total ?? custData?.total ?? null;
        setCustCount(total !== null ? total : (custData?.data?.length ?? 0));
      }

      // ── Stock Stats ────────────────────────────────────────────
      if (resStock.status === 'fulfilled') {
        const stockList = resStock.value?.data?.data || [];
        const low = stockList.filter(i => i.on_hand > 0 && i.on_hand < (i.reorder_point || 10)).length;
        const out = stockList.filter(i => i.on_hand <= 0).length;
        setStockStats({ low, out, total: stockList.length });
      }

      // ── Stores list for donut switch ──────────────────────────
      if (resStores.status === 'fulfilled') {
        setStoresList(resStores.value?.data?.data || []);
      }

    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally { setLoading(false); }
  }, [selectedStoreId, activePeriod]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt  = v  => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);
  const fmtN = v  => new Intl.NumberFormat('it-IT').format(v || 0);

  const revenueSparkbar  = monthlyChart.slice(-8).map(d => ({ v: d.revenue }));
  const ordersSparkline  = monthlyChart.slice(-8).map((_, i) => ({ v: Math.max(0, (kpi?.orders_count || 0) / 8 + (i % 3) * 2) }));

  // Donut: per negozio (automatico, senza switch)
  const donutData = useMemo(() => {
    // Raggruppa per negozio direttamente
    const byStore = {};
    recentOrders.forEach(o => {
      const sId = String(o.store_id || 'unknown');
      const name = o.store_name || o.warehouse?.name || (o.store_id ? `Negozio #${o.store_id}` : 'Non assegnato');
      if (!byStore[sId]) byStore[sId] = { name, value: 0 };
      byStore[sId].value++;
    });
    const result = Object.values(byStore);
    if (result.length === 0) {
      // Fallback: mostra canali se non ci sono store_id negli ordini
      return [
        { name: 'POS',  value: recentOrders.filter(o => o.channel === 'pos').length  || 1 },
        { name: 'Web',  value: recentOrders.filter(o => o.channel === 'web').length  || 1 },
        { name: 'Altro',value: recentOrders.filter(o => !['pos','web'].includes(o.channel)).length || 1 },
      ];
    }
    return result;
  }, [recentOrders]);

  const avatarColors = ['#9B8FD4','#6C63AC','#C5BEE8','#A78BFA','#7C3AED'];

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:400 }}>
      <div style={{ width:36, height:36, border:'3px solid #E5E7EB', borderTopColor: PURPLE, borderRadius:'50%' }} className="sp-spin" />
    </div>
  );

  return (
    <div style={{ display:'flex', gap:20, alignItems:'flex-start' }} className="sp-animate-in">

      {/* ══════════════════════════════════════
          COLONNA PRINCIPALE (sinistra)
      ══════════════════════════════════════ */}
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:20 }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
          <div>
            <h1 style={{ fontSize:28, fontWeight:800, color:'var(--color-text)', margin:0, lineHeight:1.2 }}>
              Overview
            </h1>
            <p style={{ fontSize:13, color:'var(--color-text-tertiary)', margin:'4px 0 0' }}>
              Informazioni dettagliate sul tuo negozio
            </p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button style={{ width:38, height:38, borderRadius:'50%', border:'1px solid var(--color-border)',
              background:'var(--color-surface)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Search size={16} color="var(--color-text-secondary)" />
            </button>
            <button style={{ width:38, height:38, borderRadius:'50%', border:'1px solid var(--color-border)',
              background:'var(--color-surface)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
              <Bell size={16} color="var(--color-text-secondary)" />
              {(stockStats.low + stockStats.out) > 0 && (
                <span style={{ position:'absolute', top:6, right:6, width:8, height:8, borderRadius:'50%',
                  background:'#EF4444', border:'2px solid var(--color-surface)' }} />
              )}
            </button>
          </div>
        </div>

        {/* ── Sales Analytics with Period Tabs ── */}
        <div style={{ background:'var(--color-surface)', borderRadius:20, padding:24,
          boxShadow:'0 1px 8px rgba(0,0,0,0.04)', border:'1px solid var(--color-border)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div>
              <div style={{ fontWeight:700, fontSize:15 }}>Analisi Vendite</div>
              <div style={{ display:'flex', gap:16, marginTop:6 }}>
                <span style={{ fontSize:12, color:'var(--color-text-tertiary)', display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ width:10, height:10, borderRadius:2, background:PURPLE_L, display:'inline-block' }} />
                  Fatturato
                </span>
              </div>
            </div>
            {/* Period Tabs ── CLICCABILI */}
            <div style={{ display:'flex', gap:4, background:'var(--color-bg)', borderRadius:10, padding:4, border:'1px solid var(--color-border)' }}>
              {PERIODS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setActivePeriod(p.id)}
                  style={{
                    padding:'5px 12px', fontSize:12, fontWeight:600, borderRadius:7, border:'none', cursor:'pointer',
                    background: activePeriod === p.id ? PURPLE_D : 'transparent',
                    color: activePeriod === p.id ? '#fff' : 'var(--color-text-secondary)',
                    transition:'all 0.15s',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyChart} barGap={4}>
              <XAxis dataKey="label" tick={{ fontSize:11, fill:'#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomBarTooltip />} cursor={{ fill:'rgba(155,143,212,0.08)' }} />
              <Bar dataKey="revenue" radius={[6,6,0,0]}>
                {monthlyChart.map((entry, index) => {
                  const isMax = entry.revenue === Math.max(...monthlyChart.map(d => d.revenue));
                  return <Cell key={index} fill={isMax ? PURPLE_D : PURPLE_L} fillOpacity={isMax ? 1 : 0.6} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Riga media: donut (per negozio) + attività dipendenti ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1.6fr', gap:16 }}>

          {/* Distribuzione Negozi (donut — automatico) */}
          <div style={{ background:'var(--color-surface)', borderRadius:20, padding:24,
            boxShadow:'0 1px 8px rgba(0,0,0,0.04)', border:'1px solid var(--color-border)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <span style={{ fontWeight:700, fontSize:14 }}>Distribuzione Negozi</span>
              <span style={{ fontSize:11, color:'var(--color-text-tertiary)' }}>
                {PERIODS.find(p => p.id === activePeriod)?.label}
              </span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <DonutChart data={donutData} colors={STORE_COLORS} />
              <div style={{ display:'flex', flexDirection:'column', gap:8, flex:1, minWidth:0 }}>
                {donutData.map((d, i) => {
                  const total = donutData.reduce((s, x) => s + x.value, 0);
                  return (
                    <div key={d.name} style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ width:8, height:8, borderRadius:'50%', background:STORE_COLORS[i % STORE_COLORS.length], flexShrink:0 }} />
                      <span style={{ fontSize:11, color:'var(--color-text-secondary)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</span>
                      <span style={{ fontSize:12, fontWeight:700 }}>
                        {Math.round(d.value / total * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Ultima attività — DIPENDENTI */}
          <div style={{ background:'var(--color-surface)', borderRadius:20, padding:24,
            boxShadow:'0 1px 8px rgba(0,0,0,0.04)', border:'1px solid var(--color-border)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <span style={{ fontWeight:700, fontSize:14, display:'flex', alignItems:'center', gap:8 }}>
                <Users size={16} color={PURPLE} /> Attività Dipendenti
              </span>
              <button onClick={() => navigate('/employees')} style={{ background:'none', border:'none',
                cursor:'pointer', fontSize:12, color: PURPLE, fontWeight:600 }}>
                Vedi tutti ↗
              </button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {employeeActivity.length === 0 && (
                <div style={{ color:'var(--color-text-tertiary)', fontSize:13, textAlign:'center', padding:'16px 0' }}>
                  <Users size={28} style={{ opacity:0.2, marginBottom:6 }} /><br/>
                  Nessuna attività registrata nel periodo
                </div>
              )}
              {employeeActivity.map((emp, i) => (
                <div key={emp.name} style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ position:'relative' }}>
                    <Avatar name={emp.name} size={34} color={avatarColors[i % avatarColors.length]} photoUrl={emp.photoUrl} />
                    {i === 0 && (
                      <Trophy size={12} color="#F59E0B"
                        style={{ position:'absolute', bottom:-2, right:-2, background:'#fff', borderRadius:'50%', padding:1 }} />
                    )}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {emp.name}
                    </div>
                    <div style={{ fontSize:11, color:'var(--color-text-tertiary)' }}>{emp.sales} vendite</div>
                  </div>
                  <div style={{ fontWeight:700, fontSize:13, minWidth:70, textAlign:'right' }}>
                    {fmt(emp.revenue)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Classifica Negozi per Fatturato ── */}
        <div style={{ background:'var(--color-surface)', borderRadius:20,
          boxShadow:'0 1px 8px rgba(0,0,0,0.04)', border:'1px solid var(--color-border)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 24px', borderBottom:'1px solid var(--color-border)' }}>
            <span style={{ fontWeight:700, fontSize:14 }}>🏆 Classifica Fatturato per Negozio</span>
            <span style={{ fontSize:12, color:'var(--color-text-tertiary)' }}>Periodo: {PERIODS.find(p => p.id === activePeriod)?.label}</span>
          </div>
          {storeRanking.length === 0 ? (
            <div style={{ padding:'28px 24px', color:'var(--color-text-tertiary)', fontSize:13, textAlign:'center' }}>
              Nessun dato negozio disponibile — le vendite vengono associate al punto cassa
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['#','Negozio','Ordini','Fatturato','Quota %'].map(h => (
                    <th key={h} style={{ padding:'10px 20px', textAlign:'left', fontSize:11,
                      fontWeight:600, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {storeRanking.map((store, i) => {
                  const totalRev = storeRanking.reduce((s, x) => s + x.revenue, 0) || 1;
                  const pct = Math.round(store.revenue / totalRev * 100);
                  return (
                    <tr key={store.id} style={{ borderTop:'1px solid var(--color-border)' }}>
                      <td style={{ padding:'10px 20px' }}>
                        <span style={{ fontSize:14, fontWeight:900, color: i < 3 ? ['#F59E0B','#9CA3AF','#CD7C2A'][i] : 'var(--color-text-tertiary)' }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                        </span>
                      </td>
                      <td style={{ padding:'10px 20px' }}>
                        <div style={{ fontWeight:600, fontSize:13 }}>{store.name}</div>
                      </td>
                      <td style={{ padding:'10px 20px', fontSize:13, color:'var(--color-text-secondary)' }}>{store.orders}</td>
                      <td style={{ padding:'10px 20px', fontWeight:700, fontSize:13 }}>{fmt(store.revenue)}</td>
                      <td style={{ padding:'10px 20px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ flex:1, height:6, borderRadius:99, background:'var(--color-border)', overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${pct}%`, borderRadius:99, background:STORE_COLORS[i % STORE_COLORS.length] }} />
                          </div>
                          <span style={{ fontSize:11, fontWeight:700, minWidth:30, color:'var(--color-text-secondary)' }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>{/* fine colonna sinistra */}

      {/* ══════════════════════════════════════
          COLONNA DESTRA — 3 stat card
      ══════════════════════════════════════ */}
      <div style={{ width:280, flexShrink:0, display:'flex', flexDirection:'column', gap:16 }}>

        {/* Card 1 — Total Customers (dark) */}
        <div style={{ background:'#1C1B2E', borderRadius:22, padding:22, color:'#fff' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:600, opacity:0.7 }}>Clienti Totali</span>
            <span style={{ opacity:0.4, cursor:'pointer', fontSize:18, lineHeight:1 }}>⋮</span>
          </div>
          <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:4 }}>
            <span style={{ fontSize:32, fontWeight:900, letterSpacing:'-1px' }}>{fmtN(custCount)}</span>
            <Trend value={kpi?.revenue_trend} />
          </div>
          <div style={{ fontSize:12, opacity:0.5, marginBottom:18 }}>
            {stockStats.total} referenze a magazzino
          </div>
          <div style={{ height:6, borderRadius:99, background:'rgba(255,255,255,0.12)', overflow:'hidden', marginBottom:6 }}>
            <div style={{ height:'100%', width:'60%', borderRadius:99,
              background:`linear-gradient(90deg, ${PURPLE_D}, ${PURPLE_L})` }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, opacity:0.5 }}>
            <span>● Privati 40%</span>
            <span>● Aziende 60%</span>
          </div>
        </div>

        {/* Card 2 — Total Revenue */}
        <div style={{ background:`linear-gradient(135deg, #6C63AC 0%, #9B8FD4 60%, #C5BEE8 100%)`,
          borderRadius:22, padding:22, color:'#fff' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:600, opacity:0.85 }}>Fatturato Totale</span>
            <span style={{ opacity:0.5, cursor:'pointer', fontSize:18, lineHeight:1 }}>⋮</span>
          </div>
          <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:2 }}>
            <span style={{ fontSize:26, fontWeight:900, letterSpacing:'-0.5px' }}>{fmt(kpi?.revenue_total)}</span>
            {kpi?.revenue_trend != null && (
              <span style={{ fontSize:12, fontWeight:600, opacity:0.85 }}>
                {kpi.revenue_trend >= 0 ? '↑' : '↓'}{Math.abs(kpi.revenue_trend || 0).toFixed(0)}%
              </span>
            )}
          </div>
          <div style={{ fontSize:12, opacity:0.6, marginBottom:12 }}>
            {kpi?.orders_count || 0} ordini totali
          </div>
          <MiniBar data={revenueSparkbar.length ? revenueSparkbar : [{v:0}]} color="rgba(255,255,255,0.6)" />
        </div>

        {/* Card 3 — Total Orders */}
        <div style={{ background:'#F5F0E8', borderRadius:22, padding:22 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:600, color:'#6B5A3E' }}>Ordini Totali</span>
            <span style={{ color:'#9CA3AF', cursor:'pointer', fontSize:18, lineHeight:1 }}>⋮</span>
          </div>
          <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:2 }}>
            <span style={{ fontSize:26, fontWeight:900, letterSpacing:'-0.5px', color:'#2D1B00' }}>
              {fmtN(kpi?.orders_count)}
            </span>
            <Trend value={kpi?.orders_trend} />
          </div>
          <div style={{ fontSize:12, color:'#9CA3AF', marginBottom:12 }}>
            {stockStats.low > 0 ? `${stockStats.low} prodotti sotto soglia` : 'Stock regolare'}
          </div>
          <MiniLine data={ordersSparkline.length ? ordersSparkline : [{v:0}]} color="#C4A772" />
        </div>

        {/* Export button */}
        <button
          onClick={() => window.open('/api/export/orders', '_blank')}
          style={{ background:'#1C1B2E', color:'#fff', borderRadius:16, padding:'14px 20px',
            border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            gap:8, fontWeight:700, fontSize:14, transition:'opacity 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
          <Download size={16} />
          Esporta statistiche
        </button>
      </div>

    </div>
  );
}
