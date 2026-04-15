import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { reports, stores, orders } from '../api.jsx';
import { Shield, Loader2, Euro, Activity, TrendingUp, Package, ChevronLeft, ChevronRight, BarChart2, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import OrderDetailModal from '../components/OrderDetailModal.jsx';

const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);
const fmtDate = (d) => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ─── Barchart SVG puro ──────────────────────────────────────────────────────
function MiniBarChart({ data, valueKey, colorStart = '#10B981', colorEnd = '#6366f1', labelKey = 'label', height = 180 }) {
  if (!data?.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>Nessun dato</div>;

  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  const w = 100 / data.length;

  return (
    <div style={{ width: '100%', height: height + 28, position: 'relative' }}>
      {/* Baseline */}
      <div style={{ position: 'absolute', bottom: 28, left: 0, right: 0, height: 1, background: '#f1f5f9' }} />
      <div style={{ display: 'flex', alignItems: 'flex-end', height, gap: 3, paddingBottom: 0 }}>
        {data.map((d, i) => {
          const pct = (d[valueKey] || 0) / max;
          const barH = Math.max(pct * (height - 20), 4);
          const ratio = data.length > 1 ? i / (data.length - 1) : 0;
          // interpolate color
          const r1 = parseInt(colorStart.slice(1,3), 16), g1 = parseInt(colorStart.slice(3,5), 16), b1 = parseInt(colorStart.slice(5,7), 16);
          const r2 = parseInt(colorEnd.slice(1,3), 16), g2 = parseInt(colorEnd.slice(3,5), 16), b2 = parseInt(colorEnd.slice(5,7), 16);
          const color = `rgb(${Math.round(r1 + (r2-r1)*ratio)},${Math.round(g1 + (g2-g1)*ratio)},${Math.round(b1 + (b2-b1)*ratio)})`;

          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, height: '100%', position: 'relative' }} title={`${d[labelKey]}: ${d[valueKey]}`}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                <div style={{
                  width: '80%', height: barH,
                  background: `linear-gradient(to top, ${color}cc, ${color})`,
                  borderRadius: '4px 4px 2px 2px',
                  transition: 'height 0.4s ease',
                  boxShadow: `0 2px 8px ${color}55`,
                  minHeight: 4,
                }} />
              </div>
              <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', textAlign: 'center' }}>
                {d[labelKey]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color = '#10B981', trend }) {
  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: '20px 24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ width: 44, height: 44, borderRadius: 14, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={22} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, fontWeight: 600 }}>{sub}</div>}
        {trend !== undefined && (
          <div style={{ fontSize: 11, fontWeight: 800, color: trend >= 0 ? '#10B981' : '#ef4444', marginTop: 4 }}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}% vs mese prec.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Month Picker ─────────────────────────────────────────────────────────────
function MonthPicker({ year, month, onChange }) {
  const label = new Date(year, month - 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  const prev = () => {
    if (month === 1) onChange(year - 1, 12);
    else onChange(year, month - 1);
  };
  const next = () => {
    if (month === 12) onChange(year + 1, 1);
    else onChange(year, month + 1);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', borderRadius: 12, padding: '8px 14px', border: '1px solid #e2e8f0' }}>
      <button onClick={prev} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748b' }}>
        <ChevronLeft size={18} />
      </button>
      <span style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', minWidth: 140, textAlign: 'center', textTransform: 'capitalize' }}>{label}</span>
      <button onClick={next} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748b' }}>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

export default function QscareDashboardPage() {
  const { selectedStoreId } = useOutletContext();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ total_revenue: 0, total_qty: 0 });
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Filtri extra
  const [storeId, setStoreId] = useState(selectedStoreId || '');
  const [employeeId, setEmployeeId] = useState('');
  const [storesList, setStoresList] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);

  // Date from/to derivate dal mese selezionato
  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
  const dateTo = (() => {
    const last = new Date(year, month, 0);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
  })();

  useEffect(() => {
    stores.getStores().then(res => setStoresList(res.data?.data || [])).catch(() => {});
    orders.getOptions({ store_id: selectedStoreId }).then(res => {
      setEmployeesList(res.data?.data?.employees || []);
    }).catch(() => {});
  }, [selectedStoreId]);

  const fetchData = async () => {
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

  useEffect(() => { fetchData(); }, [year, month, storeId, employeeId]);

  // ── Grafici derivati dai dati ──────────────────────────────────────────────
  const chartByDay = useMemo(() => {
    const map = {};
    data.forEach(r => {
      const day = r.created_at?.split('T')[0]?.split(' ')[0];
      if (!day) return;
      if (!map[day]) map[day] = { label: day.slice(8), revenue: 0, qty: 0 };
      map[day].revenue += parseFloat(r.line_total || 0);
      map[day].qty += parseInt(r.qty || 0);
    });
    return Object.values(map).sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

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

  const monthLabel = new Date(year, month - 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  return (
    <div className="sp-content sp-animate-in">
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 26, fontWeight: 900, color: '#0f172a', margin: 0 }}>
            <div style={{ background: 'linear-gradient(135deg, #10B981, #059669)', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
              <Shield size={24} color="#fff" />
            </div>
            Dashboard QScare
          </h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '6px 0 0', fontWeight: 600 }}>
            Riepilogo attivazioni garanzie · <span style={{ textTransform: 'capitalize', color: '#10B981', fontWeight: 800 }}>{monthLabel}</span>
          </p>
        </div>
        <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <KpiCard icon={Euro} label="Fatturato QScare" value={fmt(summary.total_revenue)} sub={`${uniqueOrders} ordini nel mese`} color="#10B981" />
        <KpiCard icon={Activity} label="Attivazioni Totali" value={`${summary.total_qty}`} sub="QScare nel periodo" color="#6366f1" />
        <KpiCard icon={TrendingUp} label="Ticket Medio" value={fmt(avgTicket)} sub="Per garanzia attivata" color="#f59e0b" />
        <KpiCard icon={Users} label="Operatori Attivi" value={uniqueEmployees} sub="Dipendenti con almeno 1 attivazione" color="#8b5cf6" />
      </div>

      {/* ── Grafici ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 28 }}>

        {/* Fatturato per giorno */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '22px 24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <BarChart2 size={18} color="#10B981" />
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Fatturato Giornaliero</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto', fontWeight: 700 }}>€</div>
          </div>
          {loading ? <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={24} className="sp-spin" style={{ color: '#10B981' }} /></div>
            : <MiniBarChart data={chartByDay} valueKey="revenue" labelKey="label" height={160} colorStart="#10B981" colorEnd="#059669" />}
        </div>

        {/* Attivazioni per giorno */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '22px 24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Activity size={18} color="#6366f1" />
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Attivazioni Giornaliere</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto', fontWeight: 700 }}>n°</div>
          </div>
          {loading ? <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={24} className="sp-spin" style={{ color: '#6366f1' }} /></div>
            : <MiniBarChart data={chartByDay} valueKey="qty" labelKey="label" height={160} colorStart="#818cf8" colorEnd="#6366f1" />}
        </div>

        {/* Top operatori */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '22px 24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Users size={18} color="#8b5cf6" />
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Top Operatori</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto', fontWeight: 700 }}>€</div>
          </div>
          {loading ? <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={24} className="sp-spin" style={{ color: '#8b5cf6' }} /></div>
            : <MiniBarChart data={chartByEmployee} valueKey="revenue" labelKey="label" height={160} colorStart="#a78bfa" colorEnd="#7c3aed" />}
        </div>

        {/* Per negozio */}
        {chartByStore.length > 1 && (
          <div style={{ background: '#fff', borderRadius: 20, padding: '22px 24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Package size={18} color="#f59e0b" />
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Per Negozio</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto', fontWeight: 700 }}>€</div>
            </div>
            {loading ? <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={24} className="sp-spin" style={{ color: '#f59e0b' }} /></div>
              : <MiniBarChart data={chartByStore} valueKey="revenue" labelKey="label" height={160} colorStart="#fbbf24" colorEnd="#d97706" />}
          </div>
        )}
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
                  Nessuna vendita QScare trovata per <strong style={{ textTransform: 'capitalize' }}>{monthLabel}</strong>.
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
