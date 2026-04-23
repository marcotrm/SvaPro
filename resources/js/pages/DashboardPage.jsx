import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { orders as ordersApi, inventory, customers, reports, stores as storesApi, employees as employeesApi, ai } from '../api.jsx';
import ReactMarkdown from 'react-markdown';
import { Send, Bot } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, Cell, PieChart, Pie
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, Search, Bell, Download, Users, Trophy, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

/* ─── palette ──────────────────────────────────────────────── */

/* ─── CalendarPicker custom premium ─────────────────────────── */
const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const IT_DAYS_SHORT = ['Lu','Ma','Me','Gi','Ve','Sa','Do'];

function CalendarPicker({ value, onChange }) {
  // value: 'YYYY-MM-DD' string
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => value ? parseInt(value.slice(0,4)) : new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => value ? parseInt(value.slice(5,7)) - 1 : new Date().getMonth());
  const ref = useRef();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // When value changes from outside, sync view
  useEffect(() => {
    if (value) {
      setViewYear(parseInt(value.slice(0,4)));
      setViewMonth(parseInt(value.slice(5,7)) - 1);
    }
  }, [value]);

  const today = new Date().toISOString().slice(0,10);

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  // Build calendar grid (always 6 rows × 7 cols)
  const cells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    // Mon=0 ... Sun=6 (Italian week starts Monday)
    let startDow = firstDay.getDay(); // 0=Sun
    startDow = startDow === 0 ? 6 : startDow - 1; // convert to Mon-based
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const grid = [];
    let offset = -startDow;
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        offset++;
        if (offset < 1 || offset > daysInMonth) {
          grid.push(null);
        } else {
          const mm = String(viewMonth + 1).padStart(2,'0');
          const dd = String(offset).padStart(2,'0');
          grid.push(`${viewYear}-${mm}-${dd}`);
        }
      }
    }
    return grid;
  }, [viewYear, viewMonth]);

  const displayLabel = value
    ? (() => { const [y,m,d] = value.split('-'); return `${d}/${m}/${y}`; })()
    : 'Seleziona data';

  const isWeekend = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr).getDay();
    return d === 0 || d === 6;
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 14px', borderRadius: 10, border: '1.5px solid rgba(123,111,208,0.35)',
          background: open ? 'rgba(123,111,208,0.18)' : 'rgba(123,111,208,0.07)',
          color: '#7B6FD0', cursor: 'pointer', fontSize: 13, fontWeight: 800,
          transition: 'all 0.15s', whiteSpace: 'nowrap',
          boxShadow: open ? '0 0 0 3px rgba(123,111,208,0.2)' : 'none',
        }}
      >
        <CalendarDays size={14} strokeWidth={2.5} />
        {displayLabel}
      </button>

      {/* Popup */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: 'rgba(15,18,35,0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(123,111,208,0.25)',
          borderRadius: 18,
          boxShadow: '0 24px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)',
          padding: '18px 16px 14px',
          width: 280,
          animation: 'calFadeIn 0.15s ease',
        }}>
          <style>{`
            @keyframes calFadeIn {
              from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
              to   { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          `}</style>

          {/* Header: mese/anno + nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button onClick={prevMonth} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(123,111,208,0.3)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.07)'}
            >
              <ChevronLeft size={16} />
            </button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em' }}>{IT_MONTHS[viewMonth]}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{viewYear}</div>
            </div>
            <button onClick={nextMonth} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(123,111,208,0.3)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.07)'}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day names header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 6 }}>
            {IT_DAYS_SHORT.map((d, i) => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 800, color: i >= 5 ? 'rgba(251,191,36,0.6)' : 'rgba(255,255,255,0.3)', letterSpacing: '0.04em', paddingBottom: 4 }}>{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
            {cells.map((dateStr, i) => {
              if (!dateStr) return <div key={i} />;
              const isSelected = dateStr === value;
              const isToday = dateStr === today;
              const weekend = isWeekend(dateStr);
              return (
                <button
                  key={dateStr}
                  onClick={() => { onChange(dateStr); setOpen(false); }}
                  style={{
                    aspectRatio: '1', border: 'none', borderRadius: 9,
                    fontSize: 12, fontWeight: isSelected ? 900 : isToday ? 800 : 600,
                    cursor: 'pointer', transition: 'all 0.12s',
                    background: isSelected
                      ? 'linear-gradient(135deg, #7B6FD0, #5B50B0)'
                      : isToday
                      ? 'rgba(123,111,208,0.18)'
                      : 'transparent',
                    color: isSelected
                      ? '#fff'
                      : isToday
                      ? '#b3a9f0'
                      : weekend
                      ? 'rgba(251,191,36,0.65)'
                      : 'rgba(255,255,255,0.75)',
                    boxShadow: isSelected ? '0 4px 12px rgba(123,111,208,0.5)' : 'none',
                    outline: isToday && !isSelected ? '1.5px solid rgba(123,111,208,0.4)' : 'none',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(123,111,208,0.22)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isToday ? 'rgba(123,111,208,0.18)' : 'transparent'; }}
                >
                  {parseInt(dateStr.slice(8))}
                </button>
              );
            })}
          </div>

          {/* Scorciatoie: Oggi / Ieri */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
            {['Oggi', 'Ieri', '-7gg'].map(label => {
              const d = new Date();
              if (label === 'Ieri') d.setDate(d.getDate() - 1);
              if (label === '-7gg') d.setDate(d.getDate() - 7);
              const ds = d.toISOString().slice(0,10);
              return (
                <button key={label} onClick={() => { onChange(ds); setOpen(false); }}
                  style={{
                    flex: 1, padding: '5px 0', borderRadius: 8, border: 'none',
                    background: value === ds ? 'rgba(123,111,208,0.4)' : 'rgba(255,255,255,0.06)',
                    color: value === ds ? '#c4bbf9' : 'rgba(255,255,255,0.45)',
                    fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { if (value !== ds) e.currentTarget.style.background='rgba(255,255,255,0.12)'; }}
                  onMouseLeave={e => { if (value !== ds) e.currentTarget.style.background='rgba(255,255,255,0.06)'; }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const PURPLE   = '#9B8FD4';
const PURPLE_L = '#C5BEE8';
const PURPLE_D = '#6C63AC';
const STORE_COLORS = ['#6C63AC','#22C55E','#F59E0B','#EF4444','#3B82F6','#EC4899','#14B8A6'];

/* ─── Period tabs ───────────────────────────────────────────── */
const PERIODS = [
  { id: 'today',     label: 'Oggi',      chartPeriod: 'daily' },
  { id: 'yesterday', label: 'Ieri',      chartPeriod: 'daily' },
  { id: 'week',      label: 'Settimana', chartPeriod: 'daily' },
  { id: 'month',     label: 'Mese',      chartPeriod: 'weekly' },
  { id: 'year',      label: 'Anno',      chartPeriod: 'monthly' },
  { id: 'custom',    label: 'Giorno...', chartPeriod: 'daily' },
];

// Calcola date_from e date_to per ogni periodo
const getPeriodDates = (periodId, customDate = null) => {
  const today = new Date();
  const fmt = d => d.toISOString().slice(0, 10);
  const todayStr = fmt(today);

  if (periodId === 'custom' && customDate) {
    return { date_from: customDate, date_to: customDate, days: 1 };
  }

  if (periodId === 'today') {
    return { date_from: todayStr, date_to: todayStr, days: 1 };
  }
  if (periodId === 'yesterday') {
    const y = new Date(today); y.setDate(y.getDate() - 1);
    const yStr = fmt(y);
    return { date_from: yStr, date_to: yStr, days: 2 };
  }
  if (periodId === 'week') {
    const from = new Date(today); from.setDate(from.getDate() - 6);
    return { date_from: fmt(from), date_to: todayStr, days: 7 };
  }
  if (periodId === 'month') {
    const from = new Date(today); from.setDate(from.getDate() - 29);
    return { date_from: fmt(from), date_to: todayStr, days: 30 };
  }
  // year
  const from = new Date(today); from.setDate(from.getDate() - 364);
  return { date_from: fmt(from), date_to: todayStr, days: 365 };
};

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
        <span style={{ fontSize: 18, fontWeight: 800 }}>{total.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</span>
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

const AiReorderCard = ({ proposal, setAiAnswer }) => {
  const [loading, setLoading] = useState(false);
  const handleAccept = async () => {
    setLoading(true);
    try {
      const { ai } = await import('../api.jsx');
      const res = await ai.acceptReorder(proposal.ordini);
      setAiAnswer(`✅ **Operazione completata!**\n\n${res.data.message}`);
    } catch(err) {
      console.error("ERRORE BACKEND DETTAGLIATO:", err.response?.data || err.message);
      const serverMsg = err.response?.data?.message || err.message;
      setAiAnswer(`❌ Errore durante la creazione delle bolle: ${serverMsg}`);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontWeight: 800, fontSize: 14, color: '#C5BEE8' }}>✨ Proposta di Riordino AI</div>
      <p style={{ margin: 0 }}>{proposal.motivazione}</p>
      
      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 10 }}>
        {proposal.ordini.map((o, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: idx < proposal.ordini.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', padding: '6px 0' }}>
            <div>
               <div style={{ fontWeight: 600 }}>Da negozio {o.from_store_id} a negozio {o.to_store_id}</div>
               <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{o.notes || `Prodotto ID: ${o.product_variant_id}`}</div>
            </div>
            <div style={{ fontWeight: 800 }}>{o.quantity} pz</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={handleAccept} disabled={loading} style={{ flex: 1, background: '#22C55E', color: '#fff', border: 'none', padding: '8px 0', borderRadius: 8, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Creazione...' : 'Accetta e Crea Bolle'}
        </button>
        <button onClick={() => setAiAnswer('Operazione annullata. Riformula la tua domanda per modificare la proposta.')} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
          Modifica
        </button>
      </div>
    </div>
  );
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
  const [customDate, setCustomDate] = useState(() => new Date().toISOString().slice(0, 10));

  const handleCustomDateChange = (dateStr) => {
    if (dateStr) setCustomDate(dateStr);
  };

  // NEW: employee activity (ultime attività = dipendenti)
  const [employeeActivity, setEmployeeActivity] = useState([]);

  // Store revenue ranking + storico
  const [storeRanking, setStoreRanking]   = useState([]);
  const [storeHistory, setStoreHistory]   = useState({ months: [], stores: [] });
  const [storeTab, setStoreTab]           = useState('ranking'); // 'ranking' | 'history'
  const [storesList, setStoresList]       = useState([]);
  const [donutStoreId, setDonutStoreId]   = useState('all');

  // AI Chat State
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const handleAskAi = async (e) => {
    e?.preventDefault();
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    try {
      const res = await ai.askAdvice(aiQuestion);
      let answerText = res.data.answer;
      try {
        const parsed = JSON.parse(answerText);
        answerText = parsed;
      } catch (e) {}
      setAiAnswer(answerText);
    } catch (err) {
      setAiAnswer('Errore durante la richiesta AI. Riprova più tardi.');
    }
    setAiLoading(false);
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const sp = selectedStoreId ? { store_id: selectedStoreId } : {};
      const period = PERIODS.find(p => p.id === activePeriod) || PERIODS[4];
      const { date_from, date_to, days } = getPeriodDates(activePeriod, customDate);

      // Fetch each independently so one failure doesn't break everything
      const [resSummary, resTrend, resOrders, resStock, resCust, resStores, resEmployees, resStoreRev, resStoreHist] = await Promise.allSettled([
        reports.summary({ ...sp, date_from, date_to, days }),
        reports.revenueTrend({ ...sp, period: period.chartPeriod, days, date_from, date_to }),
        ordersApi.getOrders({ ...sp, limit: 200, status: 'paid', date_from, date_to }),
        inventory.getStock({ ...sp, limit: 1000 }),
        customers.getCustomers({ limit: 1 }),
        storesApi.getStores(),
        employeesApi.getEmployees({ limit: 200 }),
        reports.storeRevenue({ date_from, date_to, days }),        // classifica periodo
        reports.storeRevenueHistory({ months: 6 }),                // storico 6 mesi
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
      // Costruisce mappa nome dipendente → photo_url dai dati reali dipendenti
      const empPhotoMap = {};
      if (resEmployees?.status === 'fulfilled') {
        (resEmployees.value?.data?.data || []).forEach(emp => {
          const fullName = `${emp.first_name} ${emp.last_name}`.trim();
          if (fullName && emp.photo_url) empPhotoMap[fullName] = emp.photo_url;
        });
      }

      if (resOrders.status === 'fulfilled') {
        const ordersList = resOrders.value?.data?.data || [];
        setRecentOrders(ordersList);

        // Employee activity — abbina la foto tramite nome dipendente
        const empMap = {};
        ordersList.forEach(o => {
          const name = o.employee_name;
          if (!name) return;
          if (!empMap[name]) empMap[name] = {
            name,
            sales: 0,
            revenue: 0,
            photoUrl: empPhotoMap[name] || o.employee_photo_url || null,
          };
          empMap[name].sales++;
          empMap[name].revenue += parseFloat(o.total || o.grand_total || 0);
        });
        setEmployeeActivity(Object.values(empMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5));

        // Top products — lavora sugli ordini già fetchati
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

      // Store ranking — endpoint dedicato (dati completi, non troncati a 200 ordini)
      if (resStoreRev?.status === 'fulfilled') {
        setStoreRanking(resStoreRev.value?.data?.data || []);
      }
      // Storico mensile per negozio
      if (resStoreHist?.status === 'fulfilled') {
        setStoreHistory(resStoreHist.value?.data || { months: [], stores: [] });
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
  }, [selectedStoreId, activePeriod, customDate]);

  // Si aggiorna quando main fetchData cambia
  React.useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh ogni 60 secondi — la dashboard rimane sempre aggiornata in tempo reale
  React.useEffect(() => {
    const interval = setInterval(() => { fetchData(); }, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Aggiornamento immediato quando arriva una vendita dal POS o una modifica dipendente
  React.useEffect(() => {
    const refresh = () => fetchData();
    window.addEventListener('orderPlaced', refresh);
    window.addEventListener('employeeUpdated', refresh);
    return () => {
      window.removeEventListener('orderPlaced', refresh);
      window.removeEventListener('employeeUpdated', refresh);
    };
  }, [fetchData]);

  // Selezionando Custom, invoca fetchData se cambia la customDate
  useEffect(() => {
    if (activePeriod === 'custom') fetchData();
  }, [customDate, activePeriod, fetchData]);

  const fmt  = v  => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);
  const fmtN = v  => new Intl.NumberFormat('it-IT').format(v || 0);

  const revenueSparkbar  = monthlyChart.slice(-8).map(d => ({ v: d.revenue }));
  const ordersSparkline  = monthlyChart.slice(-8).map((_, i) => ({ v: Math.max(0, (kpi?.orders_count || 0) / 8 + (i % 3) * 2) }));

  const donutData = useMemo(() => {
    // Raggruppa per negozio in base al fatturato sfruttando i dati completi dal backend
    if (storeRanking && storeRanking.length > 0) {
      return storeRanking.map(s => ({
        name: s.name,
        value: s.revenue
      }));
    }
    
    // Fallback se proprio non ci sono dati di vendita nel periodo
    return [
      { name: 'POS',  value: 1 },
      { name: 'Web',  value: 1 },
      { name: 'Altro',value: 1 },
    ];
  }, [storeRanking]);

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
            <div style={{ display:'flex', gap:4, background:'var(--color-bg)', borderRadius:10, padding:4, border:'1px solid var(--color-border)', alignItems:'center' }}>
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
              {activePeriod === 'custom' && (
                <CalendarPicker value={customDate} onChange={handleCustomDateChange} />
              )}
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
          boxShadow:'0 1px 8px rgba(0,0,0,0.04)', border:'1px solid var(--color-border)', overflow:'hidden' }}>

          {/* Header con tab */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'18px 24px', borderBottom:'1px solid var(--color-border)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <Trophy size={18} color="#F59E0B" />
              <span style={{ fontWeight:800, fontSize:15 }}>Fatturato per Negozio</span>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              {[['ranking','🏆 Classifica'],['history','📈 Storico']].map(([id, label]) => (
                <button key={id} onClick={() => setStoreTab(id)}
                  style={{
                    padding:'5px 14px', borderRadius:20, border:'none', cursor:'pointer',
                    fontSize:11, fontWeight:700, transition:'all 0.15s',
                    background: storeTab === id ? '#7B6FD0' : 'var(--color-border)',
                    color: storeTab === id ? '#fff' : 'var(--color-text-secondary)',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* TAB: CLASSIFICA */}
          {storeTab === 'ranking' && (
            storeRanking.length === 0 ? (
              <div style={{ padding:'28px 24px', color:'var(--color-text-tertiary)', fontSize:13, textAlign:'center' }}>
                Nessuna vendita nel periodo selezionato
              </div>
            ) : (() => {
              const totalRev = storeRanking.reduce((s, x) => s + x.revenue, 0) || 1;
              return (
                <div style={{ padding:'16px 24px', display:'flex', flexDirection:'column', gap:14 }}>
                  {storeRanking.map((store, i) => {
                    const pct = Math.round(store.revenue / totalRev * 100);
                    const medals = ['🥇','🥈','🥉'];
                    const colors = ['#F59E0B','#94A3B8','#CD7C2A'];
                    const barColor = STORE_COLORS[i % STORE_COLORS.length];
                    return (
                      <div key={store.id} style={{
                        background: i === 0 ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))'
                          : 'var(--color-border)',
                        borderRadius:14, padding:'14px 18px',
                        border: i === 0 ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent',
                      }}>
                        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                          <span style={{ fontSize:22, lineHeight:1 }}>
                            {i < 3 ? medals[i] : <span style={{ fontSize:13, fontWeight:900, color:'var(--color-text-tertiary)', width:22, display:'inline-block', textAlign:'center' }}>#{i+1}</span>}
                          </span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:800, fontSize:14 }}>{store.name}</div>
                            <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginTop:1 }}>
                              {store.orders} ordini
                            </div>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <div style={{ fontSize:18, fontWeight:900, color: i < 3 ? colors[i] : 'var(--color-text)' }}>
                              {fmt(store.revenue)}
                            </div>
                            <div style={{ fontSize:11, color:'var(--color-text-tertiary)' }}>{pct}% del totale</div>
                          </div>
                        </div>
                        {/* Barra progresso */}
                        <div style={{ height:6, borderRadius:99, background:'rgba(0,0,0,0.07)', overflow:'hidden' }}>
                          <div style={{
                            height:'100%', width:`${pct}%`, borderRadius:99,
                            background: barColor,
                            transition:'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                          }} />
                        </div>
                      </div>
                    );
                  })}
                  {/* Totale */}
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 18px',
                    borderTop:'1px solid var(--color-border)', marginTop:4 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:'var(--color-text-secondary)' }}>Totale periodo</span>
                    <span style={{ fontSize:14, fontWeight:900 }}>{fmt(totalRev)}</span>
                  </div>
                </div>
              );
            })()
          )}

          {/* TAB: STORICO */}
          {storeTab === 'history' && (
            storeHistory.months.length === 0 ? (
              <div style={{ padding:'28px 24px', color:'var(--color-text-tertiary)', fontSize:13, textAlign:'center' }}>
                Nessuno storico disponibile
              </div>
            ) : (() => {
              // Costruisci dati per Recharts — {month, store1: val, store2: val, ...}
              const chartData = storeHistory.months.map(m => {
                const point = { month: m.slice(0,7) }; // 'YYYY-MM'
                storeHistory.stores.forEach(s => {
                  point[s.name] = s.monthly[m]?.revenue ?? 0;
                });
                return point;
              });
              const itMonth = (ym) => {
                if (!ym) return '';
                const [y, mo] = ym.split('-');
                return `${IT_MONTHS[parseInt(mo)-1].slice(0,3)} ${y.slice(2)}`;
              };
              return (
                <div style={{ padding:'16px 24px' }}>
                  {/* Legenda */}
                  <div style={{ display:'flex', gap:16, marginBottom:16, flexWrap:'wrap' }}>
                    {storeHistory.stores.map((s, i) => (
                      <div key={s.id} style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <div style={{ width:10, height:10, borderRadius:99, background:STORE_COLORS[i % STORE_COLORS.length] }} />
                        <span style={{ fontSize:12, fontWeight:600 }}>{s.name}</span>
                      </div>
                    ))}
                  </div>
                  {/* Grafico */}
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData} margin={{ top:4, right:4, left:0, bottom:0 }}>
                      <defs>
                        {storeHistory.stores.map((s, i) => (
                          <linearGradient key={s.id} id={`sg${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={STORE_COLORS[i % STORE_COLORS.length]} stopOpacity={0.25} />
                            <stop offset="95%" stopColor={STORE_COLORS[i % STORE_COLORS.length]} stopOpacity={0.02} />
                          </linearGradient>
                        ))}
                      </defs>
                      <XAxis dataKey="month" tickFormatter={itMonth} tick={{ fontSize:10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize:10 }} axisLine={false} tickLine={false}
                        tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} width={40} />
                      <Tooltip
                        formatter={(val, name) => [fmt(val), name]}
                        labelFormatter={itMonth}
                        contentStyle={{ borderRadius:10, fontSize:12, border:'1px solid var(--color-border)' }}
                      />
                      {storeHistory.stores.map((s, i) => (
                        <Area key={s.id} type="monotone" dataKey={s.name}
                          stroke={STORE_COLORS[i % STORE_COLORS.length]}
                          strokeWidth={2.5}
                          fill={`url(#sg${i})`}
                          dot={false} activeDot={{ r:4 }}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              );
            })()
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
            {stockStats.low > 0 ? (
              <span
                onClick={() => navigate('/inventory?filter=low')}
                style={{ color:'#D97706', fontWeight:700, cursor:'pointer', textDecoration:'underline', textUnderlineOffset:2 }}
              >
                ⚠ {stockStats.low} prodotti sotto soglia →
              </span>
            ) : 'Stock regolare'}
          </div>
          <MiniLine data={ordersSparkline.length ? ordersSparkline : [{v:0}]} color="#C4A772" />
        </div>

        {/* Export button */}
        <button
          onClick={() => window.open('/api/export/orders', '_blank')}
          style={{ background:'#1C1B2E', color:'#fff', borderRadius:16, padding:'14px 20px',
            border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            gap:8, fontWeight:700, fontSize:14, transition:'opacity 0.15s', marginBottom:8 }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
          <Download size={16} />
          Esporta statistiche
        </button>

        {/* AI Assistant Widget */}
        <div style={{ background:'linear-gradient(135deg, #1C1B2E, #2A2846)', borderRadius:22, padding:22, color:'#fff', display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <Bot size={22} color={PURPLE_L} />
            <span style={{ fontSize:15, fontWeight:800 }}>AI Business Intelligence</span>
          </div>
          
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:4 }}>
            {['Analizza vendite mese', 'Prevedi scorte', 'Ottimizza magazzino'].map(q => (
              <button key={q} onClick={() => setAiQuestion(q)} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:20, padding:'6px 12px', fontSize:11, color:'#C5BEE8', cursor:'pointer', transition:'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.2)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}>
                {q}
              </button>
            ))}
          </div>

          {aiAnswer && (
            <div style={{ background:'rgba(0,0,0,0.2)', padding:14, borderRadius:12, fontSize:13, lineHeight:1.5, maxHeight:300, overflowY:'auto', border:'1px solid rgba(255,255,255,0.05)' }} className="markdown-body-dark">
              {typeof aiAnswer === 'string' ? (
                <ReactMarkdown>{aiAnswer}</ReactMarkdown>
              ) : aiAnswer?.type === 'action_card' && aiAnswer?.action === 'proponi_riordino' ? (
                <AiReorderCard proposal={aiAnswer.payload} setAiAnswer={setAiAnswer} />
              ) : null}
            </div>
          )}

          <form onSubmit={handleAskAi} style={{ display:'flex', gap:8, marginTop:4 }}>
            <input 
              type="text" 
              value={aiQuestion} 
              onChange={e => setAiQuestion(e.target.value)} 
              placeholder="Chiedi un consiglio..." 
              style={{ flex:1, padding:'10px 14px', borderRadius:12, border:'none', background:'rgba(255,255,255,0.08)', color:'#fff', fontSize:13, outline:'none' }}
            />
            <button type="submit" disabled={aiLoading || !aiQuestion.trim()} style={{ background:PURPLE_D, border:'none', borderRadius:12, width:40, display:'flex', alignItems:'center', justifyContent:'center', cursor:aiLoading||!aiQuestion.trim()?'not-allowed':'pointer', opacity:aiLoading||!aiQuestion.trim()?0.5:1, color:'#fff' }}>
              {aiLoading ? <div className="sp-spin" style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%' }} /> : <Send size={16} />}
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}
