import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { attendance, stores } from '../api.jsx';
import DatePicker from '../components/DatePicker.jsx';

/* ─── Helpers ─────────────────────────────────────────── */
const fmtTime  = v => v ? new Date(v).toLocaleTimeString('it-IT',  { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDate  = v => v ? new Date(v).toLocaleDateString('it-IT',  { weekday: 'short', day: 'numeric', month: 'short' }) : '—';
const initials = e => `${(e.first_name||'')[0]||''}${(e.last_name||'')[0]||''}`.toUpperCase() || '?';

const AVATAR_COLORS = ['#7B6FD0','#F472B6','#34D399','#60A5FA','#FB923C','#A78BFA','#2DD4BF','#FBBF24'];
const avatarColor   = id => AVATAR_COLORS[(id || 0) % AVATAR_COLORS.length];

/* ═══════════════════════════════════════════════════════════
   ADMIN VIEW — Dashboard presenze in tempo reale
═══════════════════════════════════════════════════════════ */
function AdminPresenceView() {
  const [activeTab,   setActiveTab]   = useState('live');  // 'live' | 'history'
  const [liveList,    setLiveList]    = useState([]);
  const [todayList,   setTodayList]   = useState([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [clockStr,    setClockStr]    = useState('');
  const [dateStr,     setDateStr]     = useState('');
  const [filterDate,  setFilterDate]  = useState(new Date().toISOString().split('T')[0]);

  // History tab state
  const [histLoading,     setHistLoading]     = useState(false);
  const [histData,        setHistData]        = useState([]);
  const [histSummary,     setHistSummary]     = useState([]);
  const [histDateFrom,    setHistDateFrom]    = useState(() => { const d = new Date(); d.setDate(d.getDate()-30); return d.toISOString().split('T')[0]; });
  const [histDateTo,      setHistDateTo]      = useState(new Date().toISOString().split('T')[0]);
  const [histEmployee,    setHistEmployee]    = useState('');
  const [histEmployeeQ,   setHistEmployeeQ]   = useState('');
  const [histStoreId,     setHistStoreId]     = useState('');
  const [employeesList,   setEmployeesList]   = useState([]);
  const [storesList2,     setStoresList2]     = useState([]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClockStr(now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const fetchPresence = useCallback(async () => {
    try {
      const [kioskRes, histRes] = await Promise.allSettled([
        attendance.getEmployeesKiosk(),
        attendance.getList({ date: filterDate }),
      ]);
      if (kioskRes.status === 'fulfilled') {
        const list = kioskRes.value?.data?.data || [];
        setLiveList(list.filter(e => e.status === 'presente' || e.status === 'pausa'));
      }
      if (histRes.status === 'fulfilled') setTodayList(histRes.value?.data?.data || []);
    } catch {}
    setLoadingLive(false);
  }, [filterDate]);

  useEffect(() => {
    fetchPresence();
    const id = setInterval(fetchPresence, 30_000);
    return () => clearInterval(id);
  }, [fetchPresence]);

  // Carica opzioni filtri history
  useEffect(() => {
    stores.getStores().then(r => setStoresList2(r.data?.data || [])).catch(() => {});
    attendance.getEmployeesKiosk().then(r => setEmployeesList(r.data?.data || [])).catch(() => {});
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const params = { date_from: histDateFrom, date_to: histDateTo };
      if (histEmployee) params.employee_id = histEmployee;
      if (histStoreId)  params.store_id    = histStoreId;
      const res = await attendance.getHistory(params);
      setHistData(res.data?.data || []);
      setHistSummary(res.data?.summary || []);
    } catch {}
    setHistLoading(false);
  }, [histDateFrom, histDateTo, histEmployee, histStoreId]);

  useEffect(() => { if (activeTab === 'history') fetchHistory(); }, [activeTab, fetchHistory]);

  const liveIds = new Set(liveList.map(e => e.employee_id || e.id));

  const fmtMins = (m) => {
    if (!m && m !== 0) return '—';
    const total = Math.round(m);
    if (total <= 0) return '—';
    const h   = Math.floor(total / 60);
    const min = total % 60;
    if (h === 0) return `${min}m`;
    return min > 0 ? `${h}h ${min}m` : `${h}h`;
  };

  /* ── Tab switcher ── */
  const TabBtn = ({ id, label, icon }) => (
    <button onClick={() => setActiveTab(id)} style={{
      padding: '8px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
      fontWeight: 700, fontSize: 13, transition: 'all 0.15s',
      background: activeTab === id ? 'linear-gradient(135deg,#7B6FD0,#4F46E5)' : 'rgba(123,111,208,0.08)',
      color: activeTab === id ? '#fff' : '#7B6FD0',
    }}>{icon} {label}</button>
  );

  /* ── Filtro dipendenti ricerca testo ── */
  const filteredEmps = employeesList.filter(e =>
    histEmployeeQ === '' ||
    `${e.first_name||''} ${e.last_name||''}`.toLowerCase().includes(histEmployeeQ.toLowerCase()) ||
    (e.barcode && e.barcode.toLowerCase().includes(histEmployeeQ.toLowerCase()))
  );

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <TabBtn id="live"    label="Presenze Live"       icon="🟢" />
        <TabBtn id="history" label="Cronologia & Ore"   icon="📋" />
      </div>

      {/* ── TAB: LIVE ── */}
      {activeTab === 'live' && <>

      {/* ── Header con orologio ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1C1B2E 0%, #2D2B4E 100%)',
        borderRadius: 24, padding: '32px 40px', marginBottom: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        <div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Dashboard Presenze
          </div>
          <div style={{ fontSize: 42, fontWeight: 900, color: '#fff', fontFamily: 'monospace', letterSpacing: -1, lineHeight: 1 }}>
            {clockStr}
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 6, textTransform: 'capitalize' }}>
            {dateStr}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', textAlign: 'right' }}>
            <div style={{ display: 'inline-block', minWidth: 200 }}>
              <DatePicker value={filterDate} onChange={v => setFilterDate(v || new Date().toISOString().split('T')[0])} />
          </div>
          <div>
            <div style={{ fontSize: 48, fontWeight: 900, color: '#4ade80', lineHeight: 1 }}>{liveList.length}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>In servizio ora</div>
          </div>
          <button
            onClick={fetchPresence}
            style={{ alignSelf: 'center', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 14px', color: 'rgba(255,255,255,0.8)', fontSize: 12, cursor: 'pointer', height: 'fit-content' }}
          >
            ↺ Aggiorna
          </button>
        </div>
      </div>

      {/* ── Chi è in servizio ORA ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
          🟢 Dipendenti in servizio ora ({liveList.length})
        </div>
        {loadingLive ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, textAlign: 'center', color: '#9ca3af' }}>Caricamento...</div>
        ) : liveList.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, textAlign: 'center', color: '#9ca3af', border: '2px dashed #e5e7eb' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🏠</div>
            <div style={{ fontWeight: 700 }}>Nessun dipendente in servizio</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 12 }}>
            {liveList.map(emp => {
              const entry = fmtTime(emp.status === 'pausa' ? emp.checked_out_at : (emp.checked_in_at || emp.clock_in));
              const color = avatarColor(emp.employee_id || emp.id);
              const name  = emp.employee_name || emp.name || `${emp.first_name||''} ${emp.last_name||''}`.trim() || `Dipendente #${emp.employee_id||emp.id}`;
              const isPausa = emp.status === 'pausa';
              return (
                <div key={emp.id} style={{
                  background: isPausa ? '#fffbeb' : '#fff', borderRadius: 16, padding: '16px 20px',
                  border: `2px solid ${isPausa ? '#fcd34d' : '#dcfce7'}`, display: 'flex', alignItems: 'center', gap: 14,
                  boxShadow: `0 2px 8px ${isPausa ? 'rgba(245, 158, 11, 0.08)' : 'rgba(34,197,94,0.08)'}`,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', background: isPausa ? '#f59e0b' : color, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 16, fontWeight: 800, overflow: 'hidden',
                    border: `2px solid ${isPausa ? '#f59e0b' : '#22c55e'}`,
                  }}>
                    {emp.photo_url
                      ? <img src={emp.photo_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()
                    }
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: isPausa ? '#b45309' : '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                    <div style={{ fontSize: 12, color: isPausa ? '#d97706' : '#22c55e', fontWeight: 600, marginTop: 2 }}>
                      {isPausa ? '☕ In pausa da: ' : '🟢 Entrata: '}{entry}
                    </div>
                    {emp.store_name && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>📍 {emp.store_name}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Storico timbrature ── */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
          📋 Timbrature del {new Date(filterDate).toLocaleDateString('it-IT')} ({todayList.length})
        </div>
        {todayList.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, textAlign: 'center', color: '#9ca3af', border: '2px dashed #e5e7eb' }}>
            Nessuna timbratura in questa data
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Dipendente', 'Negozio', 'Entrata', 'Uscita', 'Stato'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#6b7280', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #f3f4f6' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todayList.map((rec, i) => {
                  const name = rec.employee_name || `${rec.first_name||''} ${rec.last_name||''}`.trim() || `#${rec.employee_id}`;
                  const isIn = liveIds.has(rec.employee_id);
                  return (
                    <tr key={rec.id || i} style={{ borderBottom: '1px solid #f9fafb' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatarColor(rec.employee_id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
                            {rec.photo_url
                              ? <img src={rec.photo_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()
                            }
                          </div>
                          <span style={{ fontWeight: 600, fontSize: 14, color: '#1f2937' }}>{name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>{rec.store_name || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#22c55e' }}>{fmtTime(rec.checked_in_at)}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: rec.checked_out_at ? '#ef4444' : '#d1d5db' }}>{fmtTime(rec.checked_out_at)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                          background: rec.status === 'pausa' ? '#FFFBEB' : (rec.status === 'presente' || isIn ? '#dcfce7' : '#f3f4f6'),
                          color: rec.status === 'pausa' ? '#B45309' : (rec.status === 'presente' || isIn ? '#16a34a' : '#6b7280'),
                        }}>
                          {rec.status === 'pausa' ? '☕ Pausa' : (rec.status === 'presente' || isIn ? '🟢 Presente' : '⚪ Uscito')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>}

    {/* ── TAB: CRONOLOGIA & ORE ── */}
    {activeTab === 'history' && (
    <div>
      {/* Filtri */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 16, padding: '20px', border: '1px solid var(--color-border)', marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
        <div>
          <DatePicker label="Dal" value={histDateFrom} onChange={setHistDateFrom} />
        </div>
        <div>
          <DatePicker label="Al" value={histDateTo} onChange={setHistDateTo} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Cerca Dipendente</label>
          <input value={histEmployeeQ} onChange={e => { setHistEmployeeQ(e.target.value); setHistEmployee(''); }}
            placeholder="Nome, cognome o barcode..."
            style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--color-border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          {histEmployeeQ && filteredEmps.length > 0 && (
            <div style={{ position: 'absolute', zIndex: 20, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', maxHeight: 180, overflowY: 'auto', minWidth: 220 }}>
              {filteredEmps.slice(0,8).map(e => (
                <div key={e.id}
                  onClick={() => { setHistEmployee(String(e.id)); setHistEmployeeQ(`${e.first_name} ${e.last_name}`); }}
                  style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                  onMouseEnter={ev => ev.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={ev => ev.currentTarget.style.background = ''}
                >{e.first_name} {e.last_name} {e.barcode ? <span style={{ fontSize: 10, color: '#9ca3af' }}>· {e.barcode}</span> : ''}</div>
              ))}
            </div>
          )}
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Negozio</label>
          <select value={histStoreId} onChange={e => setHistStoreId(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--color-border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
            <option value="">Tutti i negozi</option>
            {storesList2.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button onClick={fetchHistory} disabled={histLoading}
            style={{ width: '100%', padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7B6FD0,#4F46E5)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {histLoading ? 'Caricamento…' : '🔍 Cerca'}
          </button>
        </div>
      </div>

      {/* Riepilogo ore per dipendente */}
      {histSummary.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12, marginBottom: 20 }}>
          {histSummary.map(s => (
            <div key={s.employee_id} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', border: '1px solid var(--color-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor(s.employee_id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>
                  {s.employee_name?.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>{s.employee_name}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#16a34a' }}>{fmtMins(s.total_minutes)}</div>
                  <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700 }}>ORE TOTALI</div>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#1f2937' }}>{s.days_worked}</div>
                  <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700 }}>GIORNI</div>
                </div>
              </div>
              {s.late_count > 0 && <div style={{ marginTop: 8, fontSize: 11, color: '#ef4444', fontWeight: 700 }}>⚠ {s.late_count} ritardi</div>}
            </div>
          ))}
        </div>
      )}

      {/* Tabella cronologia */}
      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid var(--color-border)' }}>
        {histLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Caricamento...</div>
        ) : histData.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Nessuna timbratura nel periodo selezionato.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Dipendente','Negozio','Data','Entrata','Uscita','Ore','★ Ritardo','Stato'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, color: '#6b7280', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {histData.map((rec, i) => (
                  <tr key={rec.id || i}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                    style={{ borderBottom: '1px solid #f9fafb' }}
                  >
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: avatarColor(rec.employee_id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                          {rec.employee_name?.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 13, color: '#1f2937', whiteSpace: 'nowrap' }}>{rec.employee_name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: '#6b7280' }}>{rec.store_name || '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {rec.checked_in_at ? new Date(rec.checked_in_at).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' }) : '—'}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: '#22c55e' }}>{fmtTime(rec.checked_in_at)}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: rec.checked_out_at ? '#ef4444' : '#d1d5db' }}>{fmtTime(rec.checked_out_at)}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: '#1f2937' }}>{fmtMins(rec.duration_minutes)}</td>
                    <td style={{ padding: '11px 14px' }}>
                      {rec.late_minutes > 0
                        ? <span style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>+{rec.late_minutes}m</span>
                        : <span style={{ color: '#d1d5db', fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: rec.status === 'presente' ? '#dcfce7' : '#f3f4f6',
                        color: rec.status === 'presente' ? '#16a34a' : '#6b7280' }}>
                        {rec.status === 'presente' ? '🟢 Presente' : '⚪ Uscito'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EMPLOYEE KIOSK VIEW — Schermata timbratura touch
═══════════════════════════════════════════════════════════ */
function KioskView() {
  const { selectedStoreId, user } = useOutletContext() || {};
  const isDipendente = (user?.roles || []).includes('dipendente') || user?.role === 'dipendente';

  const [employees, setEmployees]        = useState([]);
  const [employee,  setEmployee]         = useState(null);
  const [todayRecords, setTodayRecords]  = useState([]);
  const [loading, setLoading]            = useState(false);
  const [message, setMessage]            = useState(null);
  const [barcodeInput, setBarcodeInput]  = useState('');
  const [clockStr, setClockStr]          = useState('');
  const [dateStr,  setDateStr]           = useState('');
  const [phase, setPhase]                = useState('idle'); // idle | confirmed
  const barcodeRef = useRef(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClockStr(now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Carica la lista dipendenti per resolveEmployee (barcode → id)
  useEffect(() => {
    attendance.getEmployeesKiosk()
      .then(res => { const list = res.data?.data; setEmployees(Array.isArray(list) ? list : []); })
      .catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    if (!employee && phase === 'idle' && !isDipendente) setTimeout(() => barcodeRef.current?.focus(), 100);
  }, [employee, phase, isDipendente]);

  // Se l'utente è un dipendente, trova automaticamente il suo ID
  useEffect(() => {
    if (isDipendente && user && employees.length > 0 && phase === 'idle') {
      const found = employees.find(e => 
        e.email === user.email || 
        (user.employee_id && e.id === user.employee_id) || 
        (String(e.id) === String(user.id))
      );
      if (found) {
        setEmployee(found);
        setPhase('ask_action');
      }
    }
  }, [isDipendente, user, employees, phase]);

  const getStoreId = () => {
    const v = localStorage.getItem('selectedStoreId');
    return v ? parseInt(v, 10) : null;
  };

  const resolveEmployee = val => {
    const t = val.trim().toLowerCase();
    if (!t) return null;
    return employees.find(em =>
      (em.barcode    && em.barcode.toLowerCase()    === t) ||
      (em.badge_code && em.badge_code.toLowerCase() === t) ||
      String(em.id) === t
    ) || null;
  };

  const loadTodayRecords = async emp => {
    try {
      const tr = await attendance.getList({ employee_id: emp.id });
      const all = (tr.data?.data || []).filter(r => r.employee_id === emp.id);
      setTodayRecords(all.map(r => ({ clock_in: r.checked_in_at, clock_out: r.checked_out_at, is_break: r.notes === 'Pausa' })));
    } catch { setTodayRecords([]); }
  };

  const performClock = async (emp, forceAction = null, isBreak = false) => {
    setLoading(true);
    const storeId = getStoreId();
    if (!storeId) {
      setMessage({ text: 'Nessun negozio selezionato', type: 'error' });
      setLoading(false);
      return;
    }
    try {
      let curr = null;
      try {
        const r = await attendance.getLive({ employee_id: emp.id });
        const l = r.data?.data || [];
        curr = l.some(e => e.employee_id === emp.id || e.id === emp.id) ? 'in' : 'out';
      } catch {}
      const action = forceAction || (curr === 'in' ? 'out' : 'in');
      
      if (action === 'in') {
        await attendance.checkIn({ employee_id: emp.id, store_id: storeId });
        setLastStatus('in');
      } else {
        await attendance.checkOut({ employee_id: emp.id, store_id: storeId, is_break: isBreak });
        setLastStatus(isBreak ? 'pausa' : 'out');
      }
      
      setEmployee(emp);
      setPhase('confirmed');
      await loadTodayRecords(emp);
      
      setTimeout(() => {
        if (isDipendente) {
            setLastStatus(null); setPhase('idle'); // Ritona al check iniziale
        } else {
            setEmployee(null); setLastStatus(null); setTodayRecords([]);
            setMessage(null); setBarcodeInput(''); setPhase('idle');
            barcodeRef.current?.focus();
        }
      }, 4500);
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Errore di connessione', type: 'error' });
    } finally { setLoading(false); }
  };

  const handleBarcodeSubmit = useCallback(async () => {
    const val = barcodeInput.trim();
    if (!val) return;
    setBarcodeInput('');
    const found = resolveEmployee(val);
    if (!found) {
      setMessage({ text: `Badge "${val}" non riconosciuto`, type: 'error' });
      setTimeout(() => setMessage(null), 3000);
      barcodeRef.current?.focus();
      return;
    }
    
    if (phase === 'ask_history') {
        setLoading(true);
        try {
            const tr = await attendance.getList({ employee_id: found.id, date: 'all' });
            const all = (tr.data?.data || []);
            setTodayRecords(all.map(r => ({ clock_in: r.checked_in_at, clock_out: r.checked_out_at, is_break: r.notes === 'Pausa' })));
            setEmployee(found);
            setPhase('history_view');
        } catch {
            setMessage({ text: 'Errore nel caricamento storico', type: 'error' });
            setTimeout(() => { setMessage(null); setPhase('idle'); }, 3000);
        } finally {
            setLoading(false);
        }
        return;
    }

    setEmployee(found);
    setPhase('ask_action');
  }, [barcodeInput, employees, phase]);

  /* ── Schermata Unificata Scelta Azione (Kiosk) ── */
  if (phase === 'ask_action' && employee) {
    return (
      <div style={{
        minHeight: '82vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: '#1a1a2e', borderRadius: 24, padding: 30
      }}>
        <div style={{ fontSize: 28, color: '#fff', marginBottom: 40, fontWeight: 800, textAlign: 'center' }}>
          Ciao {employee.first_name}, <br/><span style={{ color: '#9CA3AF', fontSize: 20, fontWeight: 600 }}>Cosa vuoi registrare?</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 600 }}>
            {/* Entrata */}
            <button 
                onClick={() => performClock(employee, 'in')}
                disabled={loading}
                style={{ background: '#F0FDF4', color: '#16A34A', padding: '24px 20px', borderRadius: 20, fontSize: 16, fontWeight: 800, border: '4px solid #BBF7D0', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', transition: 'transform 0.1s', opacity: loading ? 0.7 : 1 }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
                <span style={{ fontSize: 40 }}>✅</span>
                Inizia Turno (Entrata)
            </button>

            {/* Inizia Pausa */}
            <button 
                onClick={() => performClock(employee, 'out', true)}
                disabled={loading}
                style={{ background: '#FFFBEB', color: '#B45309', padding: '24px 20px', borderRadius: 20, fontSize: 16, fontWeight: 800, border: '4px solid #FCD34D', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', transition: 'transform 0.1s', opacity: loading ? 0.7 : 1 }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
                <span style={{ fontSize: 40 }}>☕</span>
                Inizia Pausa / Bagno
            </button>

            {/* Fine Pausa -> (Rientro / Entrata) */}
            <button 
                onClick={() => performClock(employee, 'in')}
                disabled={loading}
                style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '24px 20px', borderRadius: 20, fontSize: 16, fontWeight: 800, border: '4px solid #BFDBFE', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', transition: 'transform 0.1s', opacity: loading ? 0.7 : 1 }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
                <span style={{ fontSize: 40 }}>🔙</span>
                Fine Pausa (Rientro)
            </button>

            {/* Uscita */}
            <button 
                onClick={() => performClock(employee, 'out', false)}
                disabled={loading}
                style={{ background: '#FEF2F2', color: '#B91C1C', padding: '24px 20px', borderRadius: 20, fontSize: 16, fontWeight: 800, border: '4px solid #FECACA', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', transition: 'transform 0.1s', opacity: loading ? 0.7 : 1 }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
                <span style={{ fontSize: 40 }}>🚪</span>
                Fine Turno (Uscita)
            </button>
        </div>
        
        <button onClick={() => setPhase('ask_history')} style={{ marginTop: 40, background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          🕒 Vedi Storico Ore
        </button>
        
        {!isDipendente && (
          <button onClick={() => { setPhase('idle'); setEmployee(null); barcodeRef.current?.focus(); }} style={{ marginTop: 20, background: 'transparent', color: 'rgba(255,255,255,0.5)', border: 'none', padding: '8px 24px', fontSize: 13, cursor: 'pointer' }}>
            Annulla Operazione (Esci)
          </button>
        )}
      </div>
    );
  }

  /* ── Schermata CONFERMA (dopo timbratura) ── */
  if (phase === 'confirmed' && employee) {
    const isIn = lastStatus === 'in';
    return (
      <div style={{
        minHeight: '82vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: isIn
          ? 'linear-gradient(160deg, #052e16 0%, #14532d 50%, #052e16 100%)'
          : 'linear-gradient(160deg, #1c0a00 0%, #7c2d12 50%, #1c0a00 100%)',
        borderRadius: 24,
      }}>
        {/* Check mark */}
        <div style={{
          width: 120, height: 120, borderRadius: '50%',
          background: isIn ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
          border: `4px solid ${isIn ? '#22c55e' : '#ef4444'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 52, marginBottom: 32,
          animation: 'bounceIn 0.4s cubic-bezier(.36,.07,.19,.97) both',
        }}>
          {isIn ? '✅' : '👋'}
        </div>

        <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
          {lastStatus === 'in' ? 'Entrata timbrata' : (lastStatus === 'pausa' ? 'In Pausa' : 'Uscita timbrata')}
        </div>
        <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', marginBottom: 8 }}>
          {employee.first_name} {employee.last_name}
        </div>
        <div style={{ fontSize: 52, fontWeight: 900, color: isIn ? '#4ade80' : '#f87171', fontFamily: 'monospace', marginBottom: 32 }}>
          {clockStr}
        </div>

        {/* Timbrature di oggi */}
        {todayRecords.length > 0 && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            {todayRecords.map((rec, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '10px 18px',
                border: '1px solid rgba(255,255,255,0.12)', display: 'flex', gap: 12, alignItems: 'center',
              }}>
                <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 14 }}>🟢 {fmtTime(rec.clock_in)}</span>
                {rec.clock_out && <span style={{ color: rec.is_break ? '#FCD34D' : '#f87171', fontWeight: 700, fontSize: 14 }}>{rec.is_break ? '☕' : '🔴'} {fmtTime(rec.clock_out)}</span>}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 40, fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>
          Schermata si resetta automaticamente...
        </div>
      </div>
    );
  }

  /* ── Schermata STORICO PERSONALE ── */
  if (phase === 'history_view' && employee) {
    const recordsByMonth = todayRecords.reduce((acc, rec) => {
      const month = new Date(rec.clock_in).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
      if (!acc[month]) acc[month] = [];
      acc[month].push(rec);
      return acc;
    }, {});

    return (
      <div style={{
        minHeight: '82vh', display: 'flex', flexDirection: 'column', padding: '40px 24px',
        background: 'linear-gradient(160deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)',
        borderRadius: 24, width: '100%', maxWidth: 700, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>Storico Timbrature</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>{employee.first_name} {employee.last_name}</div>
          </div>
          <button 
            onClick={() => { setPhase('idle'); setEmployee(null); setTodayRecords([]); }}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 12, padding: '10px 20px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
          >
            Chiudi
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8 }}>
          {Object.entries(recordsByMonth).map(([month, recs]) => (
            <div key={month} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8 }}>
                {month}
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {recs.map((rec, i) => (
                  <div key={i} style={{
                    background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: '12px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div style={{ fontSize: 15, color: '#fff', fontWeight: 600 }}>
                      {new Date(rec.clock_in).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit' })}
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <span style={{ color: '#4ade80', fontWeight: 700 }}>🟢 {new Date(rec.clock_in).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span style={{ color: rec.clock_out ? '#f87171' : 'rgba(255,255,255,0.2)', fontWeight: 700 }}>
                        {rec.clock_out ? `🔴 ${new Date(rec.clock_out).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {todayRecords.length === 0 && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: 40 }}>Nessuna timbratura recente trovata.</div>
          )}
        </div>
      </div>
    );
  }

  /* ── Schermata kiosk normale ── */
  return (
    <div style={{
      minHeight: '82vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
      background: 'linear-gradient(160deg, #0e1726 0%, #1a1a2e 50%, #0f1723 100%)',
      borderRadius: 24, padding: '40px 24px',
    }}>

      {/* Orologio */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontSize: 72, fontWeight: 900, color: '#fff', fontFamily: 'monospace', letterSpacing: -3, lineHeight: 1 }}>
          {clockStr}
        </div>
        <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)', marginTop: 8, textTransform: 'capitalize' }}>
          {dateStr}
        </div>
      </div>

      {/* Zona scan badge */}
      <div style={{ width: '100%', maxWidth: 560 }}>

        {/* Messaggio errore */}
        {message && (
          <div style={{
            marginBottom: 20, padding: '16px 24px', borderRadius: 16, textAlign: 'center',
            background: message.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
            border: `2px solid ${message.type === 'error' ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.5)'}`,
            color: message.type === 'error' ? '#fca5a5' : '#86efac',
            fontSize: 16, fontWeight: 700,
          }}>
            {message.type === 'error' ? '⚠️' : '✅'} {message.text}
          </div>
        )}

        {/* Scan area */}
        <div
          onClick={() => barcodeRef.current?.focus()}
          style={{
            background: barcodeInput.length > 0 ? 'rgba(123,111,208,0.12)' : 'rgba(255,255,255,0.03)',
            border: `2px dashed ${barcodeInput.length > 0 ? '#7B6FD0' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 20, padding: '28px 24px 20px', textAlign: 'center', cursor: 'text',
            marginBottom: 24, transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 10 }}>
            {phase === 'ask_history' ? '📅' : (barcodeInput.length > 0 ? '🔦' : '📲')}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            {barcodeInput.length > 0
              ? <span style={{ color: '#a5b4fc', fontFamily: 'monospace', letterSpacing: 4 }}>{barcodeInput}</span>
              : (phase === 'ask_history' ? 'Scansiona per il tuo storico' : 'Scansiona il tuo badge')
            }
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>
            {barcodeInput.length > 0 ? 'Premi Invio per confermare' : 'oppure digita il tuo ID e premi Invio'}
          </div>
          <input
            ref={barcodeRef}
            value={barcodeInput}
            onChange={e => setBarcodeInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleBarcodeSubmit(); }}
            autoFocus
            style={{
              width: '100%', maxWidth: 220,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 10, padding: '9px 14px', color: '#fff', fontSize: 14,
              textAlign: 'center', outline: 'none', fontFamily: 'monospace', letterSpacing: 2,
              boxSizing: 'border-box',
            }}
            placeholder="ID / Codice badge"
          />
        </div>

        {/* Istruzioni badge & Storico */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <div style={{ color: 'rgba(255,255,255,0.18)', fontSize: 12 }}>
                Inserisci il codice del tuo badge e premi <kbd style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '1px 6px', fontFamily: 'monospace', fontSize: 11 }}>Invio</kbd>
            </div>
            
            <button 
               onClick={() => {
                 if (isDipendente) {
                     setPhase('idle'); // ritornerà ai bottoni personali
                 } else {
                     setPhase(phase === 'ask_history' ? 'idle' : 'ask_history'); 
                     barcodeRef.current?.focus();
                 }
               }}
               style={{ background: phase === 'ask_history' ? 'rgba(255,255,255,0.15)' : 'transparent', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: 20, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12, transition: 'all 0.2s' }}
            >
               {phase === 'ask_history' ? '🔙 Torna Indietro' : '🕒 Vedi Storico'}
            </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ENTRY POINT — Router in base al ruolo
═══════════════════════════════════════════════════════════ */
export default function ClockInPage() {
  const { user } = useOutletContext() || {};
  // user.roles è un array (es. ['superadmin'] o ['dipendente'])
  const roles = user?.roles || [];
  const isAdmin = roles.includes('superadmin') || roles.includes('admin_cliente');
  return isAdmin ? <AdminPresenceView /> : <KioskView />;
}
