import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { reports, stores, orders } from '../api.jsx';
import { Shield, Loader2, Euro, Activity, TrendingUp, Package, BarChart2, Users, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import OrderDetailModal from '../components/OrderDetailModal.jsx';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid
} from 'recharts';

const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);
const fmtDate = (d) => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ─── MiniBarChart con Recharts ──────────────────────────────────────────────
function MiniBarChart({ data, valueKey, color = '#10B981', labelKey = 'label', height = 180, formatValue }) {
  if (!data?.length) return (
    <div style={{ height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13, gap: 8 }}>
      <BarChart2 size={32} style={{ opacity: 0.2 }} />
      <span>Nessun dato nel periodo selezionato</span>
    </div>
  );

  const safeData = data.map(d => ({ ...d, [valueKey]: parseFloat(d[valueKey]) || 0 }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={safeData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="20%">
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis
          dataKey={labelKey}
          tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          axisLine={false} tickLine={false}
          tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
          width={36}
        />
        <Tooltip
          formatter={(val) => [formatValue ? formatValue(val) : val, '']}
          contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
        />
        <Bar dataKey={valueKey} radius={[6, 6, 2, 2]} maxBarSize={48} fill={color} />
      </BarChart>
    </ResponsiveContainer>
  );
}


// ─── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color = '#10B981' }) {
  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: '20px 24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ width: 44, height: 44, borderRadius: 14, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={22} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── Period Selector ─────────────────────────────────────────────────────────
const PERIODS = [
  { key: 'giorno',    label: 'Oggi',     icon: '📅' },
  { key: 'settimana', label: 'Sett.',     icon: '📆' },
  { key: 'mese',      label: 'Mese',      icon: '🗓️' },
  { key: 'trimestre', label: 'Trimestre', icon: '📊' },
  { key: 'anno',      label: 'Anno',      icon: '🗃️' },
];

function getPeriodDates(period, offset = 0) {
  const now = new Date();
  let from, to;
  if (period === 'giorno') {
    const d = new Date(now); d.setDate(d.getDate() + offset);
    from = to = d.toISOString().split('T')[0];
  } else if (period === 'settimana') {
    const start = new Date(now); start.setDate(start.getDate() - start.getDay() + 1 + (offset * 7));
    const end = new Date(start); end.setDate(end.getDate() + 6);
    from = start.toISOString().split('T')[0]; to = end.toISOString().split('T')[0];
  } else if (period === 'mese') {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    from = d.toISOString().split('T')[0];
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    to = last.toISOString().split('T')[0];
  } else if (period === 'trimestre') {
    const quarter = Math.floor(now.getMonth() / 3) + offset;
    const yr = now.getFullYear() + Math.floor(quarter / 4);
    const q = ((quarter % 4) + 4) % 4;
    const startMonth = q * 3;
    const startDate = new Date(yr, startMonth, 1);
    const endDate = new Date(yr, startMonth + 3, 0);
    from = startDate.toISOString().split('T')[0]; to = endDate.toISOString().split('T')[0];
  } else if (period === 'anno') {
    const yr = now.getFullYear() + offset;
    from = `${yr}-01-01`; to = `${yr}-12-31`;
  }
  return { from, to };
}

function PeriodSelector({ period, setPeriod, offset, setOffset, customFrom, customTo, setCustomFrom, setCustomTo }) {
  const { from, to } = period !== 'custom' ? getPeriodDates(period, offset) : { from: customFrom, to: customTo };
  const canGoNext = period !== 'custom' && offset < 0;
  const [showCustom, setShowCustom] = React.useState(false);

  const label = (period !== 'custom' && from)
    ? (from === to
        ? new Date(from + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
        : `${new Date(from + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })} – ${new Date(to + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}`)
    : (customFrom && customTo
        ? `${new Date(customFrom + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })} – ${new Date(customTo + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}`
        : 'Seleziona date');

  const handleLabelClick = () => {
    setPeriod('custom');
    setShowCustom(true);
  };

  const handlePillClick = (key) => {
    setPeriod(key);
    setOffset(0);
    setShowCustom(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* periodo pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => handlePillClick(p.key)}
            style={{
              padding: '6px 14px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800,
              background: period === p.key ? '#10B981' : '#f1f5f9',
              color: period === p.key ? '#fff' : '#64748b',
              transition: 'all 0.15s',
            }}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      {/* nav arrows + date label cliccabile */}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', borderRadius: 12, padding: '8px 14px', border: '1px solid #e2e8f0', width: 'fit-content' }}>
          {/* freccia sinistra — solo per periodi non custom */}
          {period !== 'custom' && (
            <button onClick={() => setOffset(o => o - 1)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', color: '#64748b', padding: 2 }}>
              <ChevronLeft size={18} />
            </button>
          )}

          {/* label cliccabile → apre il date picker */}
          <span
            onClick={handleLabelClick}
            title="Clicca per scegliere un intervallo personalizzato"
            style={{
              fontWeight: 800, fontSize: 13, color: '#0f172a',
              minWidth: 180, textAlign: 'center',
              cursor: 'pointer', borderRadius: 6,
              padding: '2px 6px',
              transition: 'background 0.15s',
              userSelect: 'none',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {label}
          </span>

          {/* freccia destra — solo per periodi non custom */}
          {period !== 'custom' && (
            <button onClick={() => setOffset(o => o + 1)} disabled={!canGoNext}
              style={{ border: 'none', background: 'none', cursor: canGoNext ? 'pointer' : 'default', display: 'flex', color: canGoNext ? '#64748b' : '#cbd5e1', padding: 2 }}>
              <ChevronRight size={18} />
            </button>
          )}
        </div>

        {/* Dropdown date picker — singolo giorno */}
        {(period === 'custom' || showCustom) && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 200,
            background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0',
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)', padding: '14px 16px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Scegli un giorno</div>
            <input
              type="date"
              value={customFrom}
              onChange={e => {
                const d = e.target.value;
                setCustomFrom(d);
                setCustomTo(d);
                setPeriod('custom');
                setShowCustom(false); // chiude subito dopo la scelta
              }}
              className="sp-input"
              style={{ width: 160 }}
              autoFocus
            />
          </div>
        )}

      </div>
    </div>
  );
}

export default function QscareDashboardPage() {
  const { selectedStoreId } = useOutletContext();
  const now = new Date();

  const [period, setPeriod] = useState('mese');
  const [offset, setOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState(now.toISOString().split('T')[0]);
  const [customTo, setCustomTo] = useState(now.toISOString().split('T')[0]);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ total_revenue: 0, total_qty: 0 });
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [storeId, setStoreId] = useState(selectedStoreId || '');
  const [employeeId, setEmployeeId] = useState('');
  const [storesList, setStoresList] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);

  const getDates = () => period === 'custom'
    ? { from: customFrom, to: customTo }
    : getPeriodDates(period, offset);

  const { from: dateFrom, to: dateTo } = getDates();

  useEffect(() => {
    stores.getStores().then(res => setStoresList(res.data?.data || [])).catch(() => {});
    orders.getOptions({ store_id: selectedStoreId }).then(res => {
      setEmployeesList(res.data?.data?.employees || []);
    }).catch(() => {});
  }, [selectedStoreId]);

  const fetchData = async () => {
    if (!dateFrom || !dateTo) return;
    try {
      setLoading(true);
      const params = { date_from: dateFrom, date_to: dateTo };
      if (storeId) params.store_id = storeId;
      if (employeeId) params.employee_id = employeeId;
      const res = await reports.qscareDashboard(params);
      setData(res.data?.data || []);
      setSummary(res.data?.summary || { total_revenue: 0, total_qty: 0 });
    } catch {
      toast.error('Errore nel caricamento dei dati QScare');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [period, offset, customFrom, customTo, storeId, employeeId]);

  // ── Raggruppa per giorno ───────────────────────────────────────────────────
  const chartByDay = useMemo(() => {
    const map = {};
    data.forEach(r => {
      const raw = r.created_at?.split('T')[0]?.split(' ')[0];
      if (!raw) return;
      const d = new Date(raw + 'T12:00:00');
      // Label diversa per periodo
      let label;
      if (period === 'anno' || period === 'trimestre') {
        label = d.toLocaleDateString('it-IT', { month: 'short' }); // raggruppato per mese
        const key = raw.slice(0, 7); // YYYY-MM
        if (!map[key]) map[key] = { key, label, revenue: 0, qty: 0 };
        map[key].revenue += parseFloat(r.line_total || 0);
        map[key].qty += parseInt(r.qty || 0);
        return;
      } else if (period === 'settimana') {
        label = d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit' });
      } else {
        label = d.getDate().toString();
      }
      if (!map[raw]) map[raw] = { key: raw, label, revenue: 0, qty: 0 };
      map[raw].revenue += parseFloat(r.line_total || 0);
      map[raw].qty += parseInt(r.qty || 0);
    });
    return Object.keys(map).sort().map(k => map[k]);
  }, [data, period]);

  const chartByEmployee = useMemo(() => {
    const map = {};
    data.forEach(r => {
      const name = r.employee_name || 'N/D';
      if (!map[name]) map[name] = { label: name.split(' ')[0], revenue: 0, qty: 0 };
      map[name].revenue += parseFloat(r.line_total || 0);
      map[name].qty += parseInt(r.qty || 0);
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [data]);

  const chartByStore = useMemo(() => {
    const map = {};
    data.forEach(r => {
      const name = r.store_name || 'N/D';
      if (!map[name]) map[name] = { label: name, revenue: 0, qty: 0 };
      map[name].revenue += parseFloat(r.line_total || 0);
      map[name].qty += parseInt(r.qty || 0);
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [data]);

  const avgTicket = summary.total_qty > 0 ? summary.total_revenue / summary.total_qty : 0;
  const uniqueEmployees = new Set(data.map(r => r.employee_name)).size;
  const uniqueOrders = new Set(data.map(r => r.order_id)).size;

  const periodLabel = dateFrom && dateTo
    ? dateFrom === dateTo
      ? new Date(dateFrom + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
      : `${new Date(dateFrom + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })} – ${new Date(dateTo + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : '—';

  const chartCardStyle = { background: '#fff', borderRadius: 20, padding: '22px 24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' };
  const chartHeaderStyle = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 };

  return (
    <div className="sp-content sp-animate-in">
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 26, fontWeight: 900, color: '#0f172a', margin: 0 }}>
            <div style={{ background: 'linear-gradient(135deg, #10B981, #059669)', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
              <Shield size={24} color="#fff" />
            </div>
            Dashboard QScare
          </h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '6px 0 0', fontWeight: 600 }}>
            Riepilogo attivazioni garanzie · <span style={{ color: '#10B981', fontWeight: 800 }}>{periodLabel}</span>
          </p>
        </div>
        <PeriodSelector
          period={period} setPeriod={setPeriod}
          offset={offset} setOffset={setOffset}
          customFrom={customFrom} customTo={customTo}
          setCustomFrom={setCustomFrom} setCustomTo={setCustomTo}
        />
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <KpiCard icon={Euro} label="Fatturato QScare" value={fmt(summary.total_revenue)} sub={`${uniqueOrders} ordini nel periodo`} color="#10B981" />
        <KpiCard icon={Activity} label="Attivazioni Totali" value={`${summary.total_qty}`} sub="QScare nel periodo" color="#6366f1" />
        <KpiCard icon={TrendingUp} label="Ticket Medio" value={fmt(avgTicket)} sub="Per garanzia attivata" color="#f59e0b" />
        <KpiCard icon={Users} label="Operatori Attivi" value={uniqueEmployees} sub="Con almeno 1 attivazione" color="#8b5cf6" />
      </div>

      {/* ── Grafici ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 28 }}>
        {/* Fatturato per periodo */}
        <div style={chartCardStyle}>
          <div style={chartHeaderStyle}>
            <BarChart2 size={18} color="#10B981" />
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
              Fatturato {period === 'anno' || period === 'trimestre' ? 'Mensile' : 'Giornaliero'}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto', fontWeight: 700 }}>€</div>
          </div>
          {loading
            ? <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={24} className="sp-spin" style={{ color: '#10B981' }} /></div>
            : <MiniBarChart data={chartByDay} valueKey="revenue" labelKey="label" height={160} color="#10B981" formatValue={v => fmt(v)} />}
        </div>

        {/* Attivazioni per periodo */}
        <div style={chartCardStyle}>
          <div style={chartHeaderStyle}>
            <Activity size={18} color="#6366f1" />
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
              Attivazioni {period === 'anno' || period === 'trimestre' ? 'Mensili' : 'Giornaliere'}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto', fontWeight: 700 }}>n°</div>
          </div>
          {loading
            ? <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={24} className="sp-spin" style={{ color: '#6366f1' }} /></div>
            : <MiniBarChart data={chartByDay} valueKey="qty" labelKey="label" height={160} color="#6366f1" />}
        </div>

        {/* Top operatori */}
        <div style={chartCardStyle}>
          <div style={chartHeaderStyle}>
            <Users size={18} color="#8b5cf6" />
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Top Operatori</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto', fontWeight: 700 }}>€</div>
          </div>
          {loading
            ? <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={24} className="sp-spin" style={{ color: '#8b5cf6' }} /></div>
            : <MiniBarChart data={chartByEmployee} valueKey="revenue" labelKey="label" height={160} color="#8b5cf6" formatValue={v => fmt(v)} />}
        </div>

        {/* Per negozio */}
        <div style={chartCardStyle}>
            <div style={chartHeaderStyle}>
              <Package size={18} color="#f59e0b" />
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Per Negozio</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto', fontWeight: 700 }}>€</div>
            </div>
            {loading
              ? <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={24} className="sp-spin" style={{ color: '#f59e0b' }} /></div>
              : <MiniBarChart data={chartByStore} valueKey="revenue" labelKey="label" height={160} color="#f59e0b" formatValue={v => fmt(v)} />}
          </div>
      </div>

      {/* ── Tabella dettaglio ── */}
      <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
        {/* Filtri */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, background: '#f8fafc' }}>
          <div>
            <label className="sp-label" style={{ fontSize: 11 }}>Negozio</label>
            <select className="sp-input" value={storeId} onChange={e => setStoreId(e.target.value)}>
              <option value="">Tutti i negozi</option>
              {storesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="sp-label" style={{ fontSize: 11 }}>Dipendente</label>
            <select className="sp-input" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
              <option value="">Tutti i dipendenti</option>
              {employeesList.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ padding: '8px 14px', background: '#ecfdf5', borderRadius: 10, fontSize: 12, fontWeight: 800, color: '#059669' }}>
              {data.length} righe · {fmt(summary.total_revenue)}
            </div>
          </div>
        </div>

        {/* Riepilogo per operatore selezionato */}
        {employeeId && !loading && (
          <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg, #ecfdf5, #eff6ff)', borderBottom: '1px solid #d1fae5', display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} color="#10B981" />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#065f46' }}>
                {employeesList.find(e => String(e.id) === String(employeeId))?.first_name || 'Operatore'} · {periodLabel}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: '8px 16px', border: '1px solid #a7f3d0', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tot. Attivazioni</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#10B981' }}>{summary.total_qty}</div>
              </div>
              <div style={{ background: '#fff', borderRadius: 12, padding: '8px 16px', border: '1px solid #a7f3d0', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tot. Fatturato</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#059669' }}>{fmt(summary.total_revenue)}</div>
              </div>
              <div style={{ background: '#fff', borderRadius: 12, padding: '8px 16px', border: '1px solid #a7f3d0', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ticket Medio</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#6366f1' }}>{fmt(avgTicket)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Tabella */}
        <div style={{ overflowX: 'auto' }}>
          <table className="sp-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Ordine ID</th>
                <th>Negozio</th>
                <th>Operatore</th>
                <th>Qt.</th>
                <th>Prezzo Cad.</th>
                <th>Totale</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}><Loader2 size={24} className="sp-spin" style={{ margin: '0 auto', color: '#10B981' }} /></td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <Shield size={36} style={{ opacity: 0.15 }} />
                    <div>Nessuna attivazione QScare nel periodo <strong>{periodLabel}</strong>.</div>
                    <div style={{ fontSize: 12, color: '#cbd5e1' }}>Le attivazioni appaiono qui dopo le vendite POS con prodotto QScare.</div>
                  </div>
                </td></tr>
              ) : (
                data.map((row, i) => (
                  <tr key={row.order_id + '-' + i}
                    onClick={() => setSelectedOrder(row.order_id)}
                    style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8f7fc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ fontWeight: 600 }}>{fmtDate(row.created_at)}</td>
                    <td><span className="sp-badge sp-badge-primary">#{row.order_id}</span></td>
                    <td>{row.store_name}</td>
                    <td>{row.employee_name}</td>
                    <td><span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>{row.qty}</span></td>
                    <td>{fmt(parseFloat(row.unit_price))}</td>
                    <td style={{ fontWeight: 800, color: '#10B981' }}>{fmt(parseFloat(row.line_total))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOrder && (
        <OrderDetailModal
          orderId={selectedOrder}
          orders={data}
          onClose={() => setSelectedOrder(null)}
          onNavigate={id => setSelectedOrder(id)}
        />
      )}
    </div>
  );
}
