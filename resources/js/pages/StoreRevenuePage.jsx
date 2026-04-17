import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { reports } from '../api.jsx';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, CartesianGrid,
} from 'recharts';
import { Trophy, TrendingUp, Store, RefreshCw, ChevronUp, ChevronDown, Minus } from 'lucide-react';

/* ─── costanti ──────────────────────────────────────────────── */
const STORE_COLORS = ['#7B6FD0','#F59E0B','#10B981','#EF4444','#3B82F6','#A855F7','#EC4899','#14B8A6'];
const IT_MONTHS    = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

const PERIODS = [
  { id: '7d',    label: '7 giorni',  days: 7  },
  { id: '30d',   label: '30 giorni', days: 30 },
  { id: '90d',   label: '3 mesi',    days: 90 },
  { id: '365d',  label: '12 mesi',   days: 365 },
];
const HISTORY_OPTIONS = [
  { id: 3,  label: '3 mesi'  },
  { id: 6,  label: '6 mesi'  },
  { id: 12, label: '12 mesi' },
];

const fmt  = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v ?? 0);
const fmtN = (v) => new Intl.NumberFormat('it-IT').format(v ?? 0);

/* ─── helpers ─────────────────────────────────────────────── */
function Trend({ value }) {
  if (value == null) return null;
  if (value > 0) return <span style={{ color:'#10B981', fontWeight:700, fontSize:12 }}>↑{Math.abs(value).toFixed(0)}%</span>;
  if (value < 0) return <span style={{ color:'#EF4444', fontWeight:700, fontSize:12 }}>↓{Math.abs(value).toFixed(0)}%</span>;
  return <span style={{ color:'#94A3B8', fontWeight:700, fontSize:12 }}>–</span>;
}

function itMonth(ym) {
  if (!ym) return '';
  const [y, mo] = ym.split('-');
  return `${IT_MONTHS[parseInt(mo) - 1].slice(0, 3)} ${y.slice(2)}`;
}

/* ════════════════════════════════════════════════════════════ */
export default function StoreRevenuePage() {
  const ctx = useOutletContext?.() ?? {};

  const [period,     setPeriod]     = useState('30d');
  const [histMonths, setHistMonths] = useState(6);
  const [tab,        setTab]        = useState('ranking'); // 'ranking' | 'history' | 'detail'
  const [loading,    setLoading]    = useState(false);
  const [ranking,    setRanking]    = useState([]);
  const [history,    setHistory]    = useState({ months: [], stores: [] });
  const [selectedStore, setSelectedStore] = useState(null); // per drill-down

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = PERIODS.find(x => x.id === period) || PERIODS[1];
      const [resRank, resHist] = await Promise.allSettled([
        reports.storeRevenue({ days: p.days }),
        reports.storeRevenueHistory({ months: histMonths }),
      ]);
      if (resRank.status === 'fulfilled') setRanking(resRank.value?.data?.data ?? []);
      if (resHist.status === 'fulfilled') setHistory(resHist.value?.data ?? { months: [], stores: [] });
    } finally {
      setLoading(false);
    }
  }, [period, histMonths]);

  useEffect(() => { load(); }, [load]);

  const totalRev    = ranking.reduce((s, x) => s + x.revenue, 0) || 1;
  const totalOrders = ranking.reduce((s, x) => s + x.orders, 0);

  /* ── Chart data per storico ── */
  const chartData = history.months.map(m => {
    const point = { month: m };
    history.stores.forEach(s => { point[s.name] = s.monthly[m]?.revenue ?? 0; });
    return point;
  });

  /* ── Dati drill-down negozio ── */
  const detailStore = history.stores.find(s => s.id === selectedStore);
  const detailChart = detailStore
    ? history.months.map(m => ({
        month:   m,
        revenue: detailStore.monthly[m]?.revenue ?? 0,
        orders:  detailStore.monthly[m]?.orders  ?? 0,
      }))
    : [];

  const medals = ['🥇', '🥈', '🥉'];
  const medalColors = ['#F59E0B', '#94A3B8', '#CD7C2A'];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            background: 'linear-gradient(135deg, #F59E0B, #D97706)',
            borderRadius: 16, width: 52, height: 52,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 20px rgba(245,158,11,0.3)',
          }}>
            <Trophy size={26} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: 'var(--color-text)' }}>
              Fatturato Negozi
            </h1>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Classifica e storico andamento per punto vendita
            </div>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            color: 'var(--color-text-secondary)', opacity: loading ? 0.6 : 1 }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Aggiorna
        </button>
      </div>

      {/* ── KPI totali ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Fatturato Totale', value: fmt(totalRev), sub: `Periodo: ${PERIODS.find(p => p.id === period)?.label}`, color: '#7B6FD0' },
          { label: 'Ordini Totali',    value: fmtN(totalOrders), sub: 'Tutti i negozi', color: '#F59E0B' },
          { label: 'Negozi Attivi',    value: ranking.length, sub: `${ranking.filter(s => s.revenue > 0).length} con vendite`, color: '#10B981' },
        ].map((card, i) => (
          <div key={i} style={{
            background: 'var(--color-surface)', borderRadius: 18, padding: '20px 24px',
            border: '1px solid var(--color-border)', boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {card.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: card.color, letterSpacing: '-0.5px', marginBottom: 4 }}>
              {card.value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Card princiale con tab ───────────────────────────── */}
      <div style={{
        background: 'var(--color-surface)', borderRadius: 22,
        border: '1px solid var(--color-border)', boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
        overflow: 'hidden',
      }}>

        {/* Tab bar + filtri */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg)', gap: 16, flexWrap: 'wrap',
        }}>
          {/* Tab */}
          <div style={{ display: 'flex', gap: 6, background: 'var(--color-border)', borderRadius: 12, padding: 4 }}>
            {[['ranking', '🏆 Classifica'], ['history', '📈 Storico'], ['detail', '🔍 Dettaglio']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                padding: '7px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
                background: tab === id ? '#fff' : 'transparent',
                color: tab === id ? '#1e293b' : 'var(--color-text-secondary)',
                boxShadow: tab === id ? '0 1px 6px rgba(0,0,0,0.1)' : 'none',
              }}>
                {label}
              </button>
            ))}
          </div>

          {/* Filtri periodo (visibili su tutti i tab) */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {tab !== 'history' && tab !== 'detail' && (
              <>
                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginRight: 4 }}>Periodo:</span>
                {PERIODS.map(p => (
                  <button key={p.id} onClick={() => setPeriod(p.id)} style={{
                    padding: '5px 12px', borderRadius: 8, border: '1px solid',
                    borderColor: period === p.id ? '#7B6FD0' : 'var(--color-border)',
                    background: period === p.id ? 'rgba(123,111,208,0.1)' : 'transparent',
                    color: period === p.id ? '#7B6FD0' : 'var(--color-text-secondary)',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}>
                    {p.label}
                  </button>
                ))}
              </>
            )}
            {(tab === 'history' || tab === 'detail') && (
              <>
                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginRight: 4 }}>Storico:</span>
                {HISTORY_OPTIONS.map(h => (
                  <button key={h.id} onClick={() => setHistMonths(h.id)} style={{
                    padding: '5px 12px', borderRadius: 8, border: '1px solid',
                    borderColor: histMonths === h.id ? '#7B6FD0' : 'var(--color-border)',
                    background: histMonths === h.id ? 'rgba(123,111,208,0.1)' : 'transparent',
                    color: histMonths === h.id ? '#7B6FD0' : 'var(--color-text-secondary)',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}>
                    {h.label}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ══ TAB: CLASSIFICA ══════════════════════════════════ */}
        {tab === 'ranking' && (
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ranking.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 14 }}>
                <Store size={40} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
                Nessuna vendita nel periodo selezionato
              </div>
            ) : ranking.map((store, i) => {
              const pct = Math.round(store.revenue / totalRev * 100);
              const barW = `${Math.max(pct, 2)}%`;
              return (
                <div
                  key={store.id}
                  onClick={() => { setSelectedStore(store.id); setTab('detail'); }}
                  style={{
                    background: i === 0
                      ? 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.03))'
                      : 'var(--color-bg)',
                    borderRadius: 16, padding: '16px 20px',
                    border: i === 0 ? '1.5px solid rgba(245,158,11,0.4)' : '1px solid var(--color-border)',
                    cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                    {/* Medaglia */}
                    <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                      background: i < 3 ? 'transparent' : 'var(--color-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: i < 3 ? 28 : 14, fontWeight: 900,
                      color: i < 3 ? medalColors[i] : 'var(--color-text-tertiary)',
                      border: i < 3 ? `1.5px solid ${medalColors[i]}40` : 'none',
                    }}>
                      {i < 3 ? medals[i] : `#${i + 1}`}
                    </div>

                    {/* Nome */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{store.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                        {fmtN(store.orders)} ordini · {pct}% del totale
                      </div>
                    </div>

                    {/* Fatturato */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: i < 3 ? medalColors[i] : 'var(--color-text)', letterSpacing: '-0.5px' }}>
                        {fmt(store.revenue)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                        {fmt(store.orders > 0 ? store.revenue / store.orders : 0)} / ordine
                      </div>
                    </div>
                  </div>

                  {/* Barra progresso */}
                  <div style={{ height: 7, borderRadius: 99, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: barW, borderRadius: 99,
                      background: STORE_COLORS[i % STORE_COLORS.length],
                      transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
                    }} />
                  </div>
                </div>
              );
            })}

            {/* Riga totale */}
            {ranking.length > 0 && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 20px', borderRadius: 12,
                background: 'rgba(123,111,208,0.06)', border: '1px solid rgba(123,111,208,0.15)',
                marginTop: 4,
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#7B6FD0' }}>TOTALE PERIODO</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{PERIODS.find(p => p.id === period)?.label} · {ranking.length} negozi</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#7B6FD0' }}>{fmt(totalRev)}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{fmtN(totalOrders)} ordini totali</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: STORICO══════════════════════════════════════ */}
        {tab === 'history' && (
          <div style={{ padding: '20px 24px' }}>
            {history.months.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 14 }}>
                <TrendingUp size={40} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
                Nessuno storico disponibile
              </div>
            ) : (
              <>
                {/* Legenda negozi */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                  {history.stores.map((s, i) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 99, background: STORE_COLORS[i % STORE_COLORS.length] }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                    </div>
                  ))}
                </div>

                {/* AreaChart multi-store */}
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      {history.stores.map((s, i) => (
                        <linearGradient key={s.id} id={`sg${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={STORE_COLORS[i % STORE_COLORS.length]} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={STORE_COLORS[i % STORE_COLORS.length]} stopOpacity={0.02} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={itMonth} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={44} />
                    <Tooltip
                      formatter={(val, name) => [fmt(val), name]}
                      labelFormatter={itMonth}
                      contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid var(--color-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                    />
                    {history.stores.map((s, i) => (
                      <Area key={s.id} type="monotone" dataKey={s.name}
                        stroke={STORE_COLORS[i % STORE_COLORS.length]}
                        strokeWidth={2.5}
                        fill={`url(#sg${i})`}
                        dot={false} activeDot={{ r: 5, strokeWidth: 2 }}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>

                {/* Tabella riepilogo per mese */}
                <div style={{ overflowX: 'auto', marginTop: 24 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--color-bg)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--color-border)' }}>Mese</th>
                        {history.stores.map(s => (
                          <th key={s.id} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--color-border)' }}>{s.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.months.slice().reverse().map(m => (
                        <tr key={m}
                          style={{ borderBottom: '1px solid var(--color-border)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '9px 12px', fontWeight: 700 }}>{itMonth(m)}</td>
                          {history.stores.map(s => (
                            <td key={s.id} style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600 }}>
                              {fmt(s.monthly[m]?.revenue ?? 0)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ TAB: DETTAGLIO NEGOZIO ═══════════════════════════ */}
        {tab === 'detail' && (
          <div style={{ padding: '20px 24px' }}>
            {/* Selettore negozio */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
              {history.stores.map((s, i) => (
                <button key={s.id} onClick={() => setSelectedStore(s.id)} style={{
                  padding: '8px 18px', borderRadius: 10, border: '1.5px solid',
                  borderColor: selectedStore === s.id ? STORE_COLORS[i % STORE_COLORS.length] : 'var(--color-border)',
                  background: selectedStore === s.id ? `${STORE_COLORS[i % STORE_COLORS.length]}15` : 'transparent',
                  color: selectedStore === s.id ? STORE_COLORS[i % STORE_COLORS.length] : 'var(--color-text-secondary)',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: 99, background: STORE_COLORS[i % STORE_COLORS.length], display: 'inline-block', marginRight: 8 }} />
                  {s.name}
                </button>
              ))}
              {history.stores.length === 0 && (
                <div style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nessun dato storico disponibile</div>
              )}
            </div>

            {detailStore && detailChart.length > 0 ? (
              <>
                {/* KPI negozio selezionato */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
                  {(() => {
                    const totalRank = ranking.find(r => r.id === selectedStore);
                    const monthRevs = Object.values(detailStore.monthly).map(m => m.revenue);
                    const best = Math.max(...monthRevs);
                    const avg  = monthRevs.reduce((a,b) => a+b, 0) / (monthRevs.length || 1);
                    return [
                      { label: 'Fatturato (storico)', value: fmt(monthRevs.reduce((a,b) => a+b,0)), color: '#7B6FD0' },
                      { label: 'Media mensile',       value: fmt(avg), color: '#F59E0B' },
                      { label: 'Mese migliore',       value: fmt(best), color: '#10B981' },
                    ].map((c, ci) => (
                      <div key={ci} style={{ background: 'var(--color-bg)', borderRadius: 14, padding: '16px 18px', border: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: c.color }}>{c.value}</div>
                      </div>
                    ));
                  })()}
                </div>

                {/* BarChart dettaglio negozio */}
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={detailChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={itMonth} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} width={44} />
                    <Tooltip
                      formatter={(val) => [fmt(val), 'Fatturato']}
                      labelFormatter={itMonth}
                      contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid var(--color-border)' }}
                    />
                    {(() => {
                      const si = history.stores.findIndex(s => s.id === selectedStore);
                      const color = STORE_COLORS[si % STORE_COLORS.length];
                      return (
                        <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                          {detailChart.map((_, idx) => (
                            <Cell key={idx} fill={color} opacity={0.8 + 0.2 * (idx / detailChart.length)} />
                          ))}
                        </Bar>
                      );
                    })()}
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              !detailStore && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 14 }}>
                  <Store size={40} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
                  Seleziona un negozio sopra per il dettaglio
                </div>
              )
            )}
          </div>
        )}

      </div>
    </div>
  );
}
