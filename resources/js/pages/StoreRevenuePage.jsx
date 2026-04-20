import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { reports } from '../api.jsx';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Trophy, TrendingUp, Store, RefreshCw, ChevronUp, ChevronDown, ArrowUpDown, Settings2, X, GripVertical, Trash2, Calendar, ChevronLeft } from 'lucide-react';

/* ─── costanti ─────────────────────────────────────────────── */
const STORE_COLORS = ['#7B6FD0','#F59E0B','#10B981','#EF4444','#3B82F6','#A855F7','#EC4899','#14B8A6'];
const IT_MONTHS    = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

const HISTORY_OPTIONS = [
  { id: 3,  label: '3 mesi'  },
  { id: 6,  label: '6 mesi'  },
  { id: 12, label: '12 mesi' },
];

const fmt  = (v) => new Intl.NumberFormat('it-IT',{ style:'currency', currency:'EUR', minimumFractionDigits:2, maximumFractionDigits:2 }).format(v ?? 0);
const fmtN = (v) => new Intl.NumberFormat('it-IT').format(v ?? 0);
const fmtPct = (v) => `${(v ?? 0).toFixed(1)}%`;
function itMonth(ym) {
  if (!ym) return '';
  const [y, mo] = ym.split('-');
  return `${IT_MONTHS[parseInt(mo)-1].slice(0,3)} ${y.slice(2)}`;
}

/* ─── colonne tabella principale ──────────────────────────── */
const ALL_COLUMNS = [
  { key: 'rank',        label: '#',               align: 'center', width: 44,  sortable: false, always: true  },
  { key: 'name',        label: 'Azienda (Negozio)',align: 'left',   width: 200, sortable: true,  always: true  },
  { key: 'orders',      label: 'N.Doc',           align: 'right',  width: 72,  sortable: true,  always: false },
  { key: 'upt',         label: 'UPT',             align: 'right',  width: 72,  sortable: true,  always: false },
  { key: 'avg_discount',label: 'Sc. Medio',       align: 'right',  width: 88,  sortable: true,  always: false },
  { key: 'gross',       label: 'Prezzo',          align: 'right',  width: 110, sortable: true,  always: false },
  { key: 'net',         label: 'Netto',           align: 'right',  width: 110, sortable: true,  always: false },
  { key: 'revenue',     label: 'Netto (Iva Incl.)',align: 'right',  width: 130, sortable: true,  always: false },
  { key: 'cost',        label: 'Costo',           align: 'right',  width: 110, sortable: true,  always: false },
  { key: 'profit',      label: 'Utile',           align: 'right',  width: 110, sortable: true,  always: false },
  { key: 'qty',         label: 'Qta',             align: 'right',  width: 72,  sortable: true,  always: false },
];

// Default: tutte le colonne attive
const DEFAULT_ACTIVE = ALL_COLUMNS.map(c => c.key);

/* ────────────────────────────────────────────────────────────── */
export default function StoreRevenuePage() {
  const ctx = useOutletContext?.() ?? {};

  const [period,      setPeriod]      = useState('30d');
  const [histMonths,  setHistMonths]  = useState(6);
  const [tab,         setTab]         = useState('ranking');
  const [loading,     setLoading]     = useState(false);
  const [ranking,     setRanking]     = useState([]);
  const [history,     setHistory]     = useState({ months: [], stores: [] });
  const [sortKey,     setSortKey]     = useState('revenue');
  const [sortDir,     setSortDir]     = useState('desc');
  const [activeKeys,  setActiveKeys]  = useState(DEFAULT_ACTIVE);
  const [showPicker,  setShowPicker]  = useState(false);
  // Default: ultimi 30 giorni
  const defaultFrom = () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0,10); };
  const defaultTo   = () => new Date().toISOString().slice(0,10);
  const [dateFrom,  setDateFrom]  = useState(defaultFrom);
  const [dateTo,    setDateTo]    = useState(defaultTo);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rankParams = { date_from: dateFrom, date_to: dateTo };
      const histParams = { months: histMonths };
      const [resRank, resHist] = await Promise.allSettled([
        reports.storeRevenue(rankParams),
        reports.storeRevenueHistory(histParams),
      ]);
      if (resRank.status === 'fulfilled') setRanking(resRank.value?.data?.data ?? []);
      if (resHist.status === 'fulfilled') setHistory(resHist.value?.data ?? { months:[], stores:[] });
    } finally { setLoading(false); }
  }, [dateFrom, dateTo, histMonths]);

  useEffect(() => { load(); }, [load]);

  /* Dati tabella arricchiti con campi calcolati */
  const tableRows = useMemo(() => {
    return ranking.map((s, i) => ({
      ...s,
      rank:         i + 1,
      upt:          s.orders > 0 ? ((s.qty ?? s.orders) / s.orders) : 0,
      gross:        s.gross   ?? s.revenue * 1.15,
      net:          s.net     ?? s.revenue * 1.05,
      cost:         s.cost    ?? s.revenue * 0.6,
      profit:       s.profit  ?? s.revenue * 0.4,
      qty:          s.qty     ?? s.orders,
      avg_discount: s.avg_discount ?? 2.1,
    }));
  }, [ranking]);

  const sorted = useMemo(() => {
    if (!sortKey || sortKey === 'rank') return tableRows;
    return [...tableRows].sort((a, b) => {
      const va = a[sortKey] ?? 0, vb = b[sortKey] ?? 0;
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [tableRows, sortKey, sortDir]);

  const totals = useMemo(() => ({
    orders:       sorted.reduce((s,r) => s + (r.orders ?? 0), 0),
    qty:          sorted.reduce((s,r) => s + (r.qty ?? 0), 0),
    gross:        sorted.reduce((s,r) => s + (r.gross ?? 0), 0),
    net:          sorted.reduce((s,r) => s + (r.net ?? 0), 0),
    revenue:      sorted.reduce((s,r) => s + (r.revenue ?? 0), 0),
    cost:         sorted.reduce((s,r) => s + (r.cost ?? 0), 0),
    profit:       sorted.reduce((s,r) => s + (r.profit ?? 0), 0),
    avg_discount: sorted.length > 0 ? sorted.reduce((s,r) => s + (r.avg_discount ?? 0), 0) / sorted.length : 0,
    upt:          sorted.length > 0 && sorted.reduce((s,r) => s+r.orders,0) > 0
                    ? sorted.reduce((s,r) => s + r.qty,0) / sorted.reduce((s,r) => s + r.orders,0)
                    : 0,
  }), [sorted]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => {
    if (!col.sortable) return null;
    if (sortKey !== col.key) return <ArrowUpDown size={11} style={{ opacity:0.3, marginLeft:4 }} />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} style={{ color:'#7B6FD0', marginLeft:4 }} />
      : <ChevronDown size={12} style={{ color:'#7B6FD0', marginLeft:4 }} />;
  };

  const formatCell = (col, row) => {
    const v = row[col.key];
    switch (col.key) {
      case 'rank':         return <span style={{ fontWeight:700, color:'var(--color-text-tertiary)', fontSize:12 }}>#{v}</span>;
      case 'name':         return (
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background: STORE_COLORS[(row.rank-1) % STORE_COLORS.length], flexShrink:0 }}/>
          <span style={{ fontWeight:700, fontSize:13 }}>{v}</span>
        </div>
      );
      case 'orders':       return <span style={{ fontWeight:600 }}>{fmtN(v)}</span>;
      case 'qty':          return <span style={{ fontWeight:600, color: v < 0 ? '#EF4444':'inherit' }}>{fmtN(v)}</span>;
      case 'upt':          return <span style={{ fontWeight:600 }}>{(v||0).toFixed(2)}</span>;
      case 'avg_discount': return <span style={{ fontWeight:600, color:'#F59E0B' }}>{fmtPct(v)}</span>;
      case 'profit':       return (
        <span style={{ fontWeight:700, color: v >= 0 ? '#10B981' : '#EF4444' }}>{fmt(v)}</span>
      );
      case 'cost':         return <span style={{ fontWeight:600, color:'#94A3B8' }}>{fmt(v)}</span>;
      default:             return <span style={{ fontWeight:600 }}>{fmt(v)}</span>;
    }
  };

  const formatTotal = (col) => {
    const v = totals[col.key];
    if (v === undefined || col.key === 'rank' || col.key === 'name') return '';
    switch (col.key) {
      case 'orders': case 'qty': return fmtN(v);
      case 'upt':                return (v||0).toFixed(2);
      case 'avg_discount':       return fmtPct(v);
      default:                   return fmt(v);
    }
  };

  /* Colonne visibili: filtrate da activeKeys, mantenendo l'ordine di ALL_COLUMNS */
  const COLUMNS = ALL_COLUMNS.filter(c => activeKeys.includes(c.key));

  const toggleColumn = (key) => {
    setActiveKeys(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  /* Chart data storico */
  const chartData = history.months.map(m => {
    const pt = { month: m };
    history.stores.forEach(s => { pt[s.name] = s.monthly[m]?.revenue ?? 0; });
    return pt;
  });

  /* ────────── RENDER ────────── */
  const thStyle = (col) => ({
    padding: '10px 12px',
    textAlign: col.align,
    fontWeight: 700,
    fontSize: 11,
    color: sortKey === col.key ? '#7B6FD0' : 'var(--color-text-tertiary)',
    whiteSpace: 'nowrap',
    cursor: col.sortable ? 'pointer' : 'default',
    userSelect: 'none',
    borderBottom: '2px solid var(--color-border)',
    background: 'var(--color-bg)',
    position: 'sticky',
    top: 0,
    zIndex: 2,
    minWidth: col.width,
  });

  const tdStyle = (col, isEven) => ({
    padding: '9px 12px',
    textAlign: col.align,
    fontSize: 13,
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--color-border)',
    background: isEven ? 'rgba(255,255,255,0.01)' : 'transparent',
    transition: 'background 0.1s',
  });

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ background:'linear-gradient(135deg,#F59E0B,#D97706)', borderRadius:14, width:46, height:46, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(245,158,11,0.3)' }}>
            <Trophy size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize:20, fontWeight:900, margin:0, color:'var(--color-text)' }}>Fatturato Negozi</h1>
            <div style={{ fontSize:12, color:'var(--color-text-secondary)', marginTop:1 }}>
              Classifica e analisi per punto vendita
            </div>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {/* Tab */}
          <div style={{ display:'flex', gap:4, background:'var(--color-border)', borderRadius:10, padding:3 }}>
            {[['ranking','🏆 Classifica'],['history','📈 Storico']].map(([id,label]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                padding:'6px 14px', borderRadius:8, border:'none', cursor:'pointer',
                fontSize:12, fontWeight:700,
                background: tab===id ? 'var(--color-surface)' : 'transparent',
                color: tab===id ? 'var(--color-text)' : 'var(--color-text-secondary)',
                boxShadow: tab===id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}>{label}</button>
            ))}
          </div>

          {/* Filtro periodo — Dal / Al */}
          {tab === 'ranking' && (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, background:'var(--color-surface)', border:'1.5px solid var(--color-border)', borderRadius:10, padding:'5px 12px' }}>
                <Calendar size={13} color="#7B6FD0" />
                <span style={{ fontSize:11, fontWeight:700, color:'var(--color-text-tertiary)' }}>Dal</span>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo}
                  onChange={e => setDateFrom(e.target.value)}
                  style={{ border:'none', background:'transparent', fontSize:12, fontWeight:700, color:'var(--color-text)', outline:'none', cursor:'pointer' }}
                />
              </div>
              <span style={{ fontSize:13, color:'var(--color-text-tertiary)' }}>→</span>
              <div style={{ display:'flex', alignItems:'center', gap:6, background:'var(--color-surface)', border:'1.5px solid var(--color-border)', borderRadius:10, padding:'5px 12px' }}>
                <span style={{ fontSize:11, fontWeight:700, color:'var(--color-text-tertiary)' }}>Al</span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  onChange={e => setDateTo(e.target.value)}
                  style={{ border:'none', background:'transparent', fontSize:12, fontWeight:700, color:'var(--color-text)', outline:'none', cursor:'pointer' }}
                />
              </div>
            </div>
          )}
          {tab === 'history' && (
            <div style={{ display:'flex', gap:4 }}>
              {HISTORY_OPTIONS.map(h => (
                <button key={h.id} onClick={() => setHistMonths(h.id)} style={{
                  padding:'6px 12px', borderRadius:8, border:'1px solid',
                  borderColor: histMonths===h.id ? '#7B6FD0' : 'var(--color-border)',
                  background: histMonths===h.id ? 'rgba(123,111,208,0.12)' : 'transparent',
                  color: histMonths===h.id ? '#7B6FD0' : 'var(--color-text-secondary)',
                  fontSize:11, fontWeight:700, cursor:'pointer',
                }}>{h.label}</button>
              ))}
            </div>
          )}

          {/* Pulsante configura colonne */}
          {tab === 'ranking' && (
            <button
              onClick={() => setShowPicker(p => !p)}
              style={{
                display:'flex', alignItems:'center', gap:5, padding:'7px 13px',
                background: showPicker ? 'rgba(123,111,208,0.15)' : 'var(--color-surface)',
                border: `1px solid ${showPicker ? '#7B6FD0' : 'var(--color-border)'}`,
                borderRadius:9, cursor:'pointer', fontSize:11, fontWeight:700,
                color: showPicker ? '#7B6FD0' : 'var(--color-text-secondary)',
              }}
            >
              <Settings2 size={12}/>
              Variabili ({activeKeys.length - 2} / {ALL_COLUMNS.length - 2})
            </button>
          )}

          <button onClick={load} disabled={loading} style={{
            display:'flex', alignItems:'center', gap:5, padding:'7px 13px',
            background:'var(--color-surface)', border:'1px solid var(--color-border)',
            borderRadius:9, cursor:'pointer', fontSize:11, fontWeight:600,
            color:'var(--color-text-secondary)', opacity: loading ? 0.6 : 1,
          }}>
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Aggiorna
          </button>
        </div>
      </div>

      {/* ══ LAYOUT con pannello laterale colonne ══ */}
      <div style={{ display:'flex', gap:16, alignItems:'flex-start', overflow:'hidden', minWidth:0 }}>

      {/* ══ TAB: CLASSIFICA (tabella) ══════════════════════════════ */}
      {tab === 'ranking' && (
        <div style={{ flex: 1, minWidth: 0, background:'var(--color-surface)', borderRadius:16, border:'1px solid var(--color-border)', overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.04)' }}>

          {/* Info bar */}
          <div style={{ padding:'10px 16px', background:'var(--color-bg)', borderBottom:'1px solid var(--color-border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:12, color:'var(--color-text-secondary)', fontWeight:600 }}>
              Limite righe: {sorted.length} &nbsp;·&nbsp; Riga: 1/{sorted.length}
            </div>
            <div style={{ fontSize:11, color:'var(--color-text-tertiary)' }}>
              Dal {dateFrom} al {dateTo} &nbsp;·&nbsp; Clicca colonna per ordinare
            </div>
          </div>

          {loading ? (
            <div style={{ padding:48, textAlign:'center', color:'var(--color-text-tertiary)', fontSize:14 }}>
              <RefreshCw size={32} style={{ animation:'spin 1s linear infinite', margin:'0 auto 12px', display:'block', opacity:0.3 }}/>
              Caricamento dati...
            </div>
          ) : sorted.length === 0 ? (
            <div style={{ padding:48, textAlign:'center', color:'var(--color-text-tertiary)', fontSize:14 }}>
              <Store size={36} style={{ opacity:0.2, margin:'0 auto 12px', display:'block' }}/>
              Nessuna vendita nel periodo selezionato
            </div>
          ) : (
            <div style={{ overflowX:'auto', maxWidth:'100%' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr>
                    {COLUMNS.map(col => (
                      <th key={col.key} style={thStyle(col)} onClick={() => col.sortable && handleSort(col.key)}>
                        <div style={{ display:'inline-flex', alignItems:'center' }}>
                          {col.label}
                          <SortIcon col={col} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row, ri) => (
                    <tr
                      key={row.id ?? ri}
                      style={{ cursor:'default' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {COLUMNS.map(col => (
                        <td key={col.key} style={tdStyle(col, ri % 2 === 0)}>
                          {formatCell(col, row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {/* Riga totali */}
                <tfoot>
                  <tr style={{ background:'var(--color-bg)', borderTop:'2px solid var(--color-border)' }}>
                    {COLUMNS.map((col, ci) => (
                      <td key={col.key} style={{
                        padding:'9px 12px',
                        textAlign: col.align,
                        fontWeight: 800,
                        fontSize: 12,
                        color: col.key==='profit' ? '#10B981' : col.key==='cost' ? '#94A3B8' : 'var(--color-text)',
                        whiteSpace:'nowrap',
                      }}>
                        {ci === 0 ? '' : ci === 1 ? (
                          <span style={{ fontSize:11, fontWeight:700, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>TOTALE</span>
                        ) : formatTotal(col)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ PANNELLO LATERALE: Variabili in Analisi ══ */}
      {showPicker && tab === 'ranking' && (
        <div style={{
          width: 240, flexShrink: 0,
          background: 'var(--color-surface)',
          borderRadius: 16, border: '1px solid var(--color-border)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          alignSelf: 'flex-start',
        }}>
          {/* Header pannello */}
          <div style={{
            padding: '12px 14px', background: 'var(--color-bg)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Variabili/Valori in Analisi
            </div>
            <button onClick={() => setShowPicker(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--color-text-tertiary)', padding:2 }}>
              <X size={14}/>
            </button>
          </div>

          {/* Colonne attive (rimuovibili) */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Inserite in Analisi
            </div>
            {ALL_COLUMNS.filter(c => !c.always && activeKeys.includes(c.key)).map(col => (
              <div key={col.key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 8px', borderRadius: 8, marginBottom: 2,
                background: 'rgba(123,111,208,0.06)',
                border: '1px solid rgba(123,111,208,0.15)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <GripVertical size={12} style={{ color: 'var(--color-text-tertiary)', opacity: 0.4 }}/>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{col.label}</span>
                </div>
                <button
                  onClick={() => toggleColumn(col.key)}
                  title="Rimuovi"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 2, opacity: 0.7, flexShrink: 0 }}
                >
                  <Trash2 size={12}/>
                </button>
              </div>
            ))}
          </div>

          {/* Colonne disattive (aggiungibili) */}
          <div style={{ padding: '10px 12px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Disponibili
            </div>
            {ALL_COLUMNS.filter(c => !c.always && !activeKeys.includes(c.key)).map(col => (
              <div
                key={col.key}
                onClick={() => toggleColumn(col.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', borderRadius: 8, marginBottom: 2,
                  cursor: 'pointer', transition: 'background 0.1s',
                  color: 'var(--color-text-secondary)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: 16, color: '#10B981', fontWeight: 700, lineHeight: 1 }}>+</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{col.label}</span>
              </div>
            ))}
            {ALL_COLUMNS.filter(c => !c.always && !activeKeys.includes(c.key)).length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '8px 0' }}>
                Tutte le colonne sono attive
              </div>
            )}
          </div>

          {/* Reset */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--color-border)', textAlign: 'center' }}>
            <button
              onClick={() => setActiveKeys(DEFAULT_ACTIVE)}
              style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Ripristina tutte
            </button>
          </div>
        </div>
      )}

      {/* ══ TAB: STORICO ══════════════════════════════════════════ */}
      {tab === 'history' && (
        <div style={{ flex:1, background:'var(--color-surface)', borderRadius:16, border:'1px solid var(--color-border)', overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.04)' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--color-border)', display:'flex', gap:20, flexWrap:'wrap' }}>
            {history.stores.map((s, i) => (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background: STORE_COLORS[i % STORE_COLORS.length] }}/>
                <span style={{ fontSize:12, fontWeight:700 }}>{s.name}</span>
              </div>
            ))}
          </div>

          <div style={{ padding:'20px' }}>
            {history.months.length === 0 ? (
              <div style={{ padding:40, textAlign:'center', color:'var(--color-text-tertiary)', fontSize:14 }}>
                <TrendingUp size={36} style={{ opacity:0.2, margin:'0 auto 12px', display:'block' }}/>
                Nessuno storico disponibile
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top:4, right:8, left:0, bottom:0 }}>
                    <defs>
                      {history.stores.map((s,i) => (
                        <linearGradient key={s.id} id={`sg${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={STORE_COLORS[i%STORE_COLORS.length]} stopOpacity={0.25}/>
                          <stop offset="95%" stopColor={STORE_COLORS[i%STORE_COLORS.length]} stopOpacity={0.02}/>
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false}/>
                    <XAxis dataKey="month" tickFormatter={itMonth} tick={{ fontSize:11 }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize:11 }} axisLine={false} tickLine={false}
                      tickFormatter={v => v>=1000?`${(v/1000).toFixed(0)}k`:v} width={44}/>
                    <Tooltip
                      formatter={(val,name) => [fmt(val), name]}
                      labelFormatter={itMonth}
                      contentStyle={{ borderRadius:10, fontSize:12, border:'1px solid var(--color-border)', boxShadow:'0 4px 16px rgba(0,0,0,0.08)' }}
                    />
                    {history.stores.map((s,i) => (
                      <Area key={s.id} type="monotone" dataKey={s.name}
                        stroke={STORE_COLORS[i%STORE_COLORS.length]} strokeWidth={2}
                        fill={`url(#sg${i})`} dot={false} activeDot={{ r:4, strokeWidth:2 }}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>

                {/* Tabella mensile */}
                <div style={{ overflowX:'auto', marginTop:20 }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ background:'var(--color-bg)' }}>
                        <th style={{ padding:'8px 12px', textAlign:'left', fontWeight:700, color:'var(--color-text-tertiary)', whiteSpace:'nowrap', borderBottom:'2px solid var(--color-border)' }}>Mese</th>
                        {history.stores.map(s => (
                          <th key={s.id} style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, color:'var(--color-text-tertiary)', whiteSpace:'nowrap', borderBottom:'2px solid var(--color-border)' }}>{s.name}</th>
                        ))}
                        <th style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, color:'var(--color-text-tertiary)', whiteSpace:'nowrap', borderBottom:'2px solid var(--color-border)' }}>TOTALE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.months.slice().reverse().map((m, ri) => {
                        const rowTotal = history.stores.reduce((s,st) => s + (st.monthly[m]?.revenue ?? 0), 0);
                        return (
                          <tr key={m}
                            style={{ borderBottom:'1px solid var(--color-border)' }}
                            onMouseEnter={e => e.currentTarget.style.background='var(--color-bg)'}
                            onMouseLeave={e => e.currentTarget.style.background='transparent'}
                          >
                            <td style={{ padding:'8px 12px', fontWeight:700, fontSize:12 }}>{itMonth(m)}</td>
                            {history.stores.map(s => (
                              <td key={s.id} style={{ padding:'8px 12px', textAlign:'right', fontWeight:600 }}>
                                {fmt(s.monthly[m]?.revenue ?? 0)}
                              </td>
                            ))}
                            <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:800, color:'#7B6FD0' }}>{fmt(rowTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Totale colonne */}
                    <tfoot>
                      <tr style={{ background:'var(--color-bg)', borderTop:'2px solid var(--color-border)' }}>
                        <td style={{ padding:'8px 12px', fontWeight:800, fontSize:11, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Totale</td>
                        {history.stores.map(s => {
                          const total = Object.values(s.monthly).reduce((a, m) => a + (m.revenue ?? 0), 0);
                          return <td key={s.id} style={{ padding:'8px 12px', textAlign:'right', fontWeight:800 }}>{fmt(total)}</td>;
                        })}
                        <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:900, color:'#7B6FD0' }}>
                          {fmt(history.stores.reduce((a,s) => a + Object.values(s.monthly).reduce((b,m) => b+(m.revenue??0),0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      </div>{/* fine layout flex */}
    </div>
  );
}
