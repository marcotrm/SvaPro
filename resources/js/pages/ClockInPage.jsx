import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { attendance } from '../api.jsx';

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
  const [liveList,    setLiveList]    = useState([]);
  const [todayList,   setTodayList]   = useState([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [clockStr,    setClockStr]    = useState('');
  const [dateStr,     setDateStr]     = useState('');

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
      const [liveRes, histRes] = await Promise.allSettled([
        attendance.getLive(),
        attendance.getList(),
      ]);
      if (liveRes.status === 'fulfilled') setLiveList(liveRes.value?.data?.data || []);
      if (histRes.status === 'fulfilled') setTodayList(histRes.value?.data?.data || []);
    } catch {}
    setLoadingLive(false);
  }, []);

  useEffect(() => {
    fetchPresence();
    const id = setInterval(fetchPresence, 30_000);
    return () => clearInterval(id);
  }, [fetchPresence]);

  const liveIds = new Set(liveList.map(e => e.employee_id || e.id));

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>

      {/* ── Header con orologio ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1C1B2E 0%, #2D2B4E 100%)',
        borderRadius: 24, padding: '32px 40px', marginBottom: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
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
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: '#4ade80', lineHeight: 1 }}>{liveList.length}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>In servizio ora</div>
          <button
            onClick={fetchPresence}
            style={{ marginTop: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '6px 14px', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}
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
              const entry = fmtTime(emp.checked_in_at || emp.clock_in);
              const color = avatarColor(emp.employee_id || emp.id);
              const name  = emp.employee_name || `${emp.first_name||''} ${emp.last_name||''}`.trim() || `Dipendente #${emp.employee_id||emp.id}`;
              return (
                <div key={emp.id} style={{
                  background: '#fff', borderRadius: 16, padding: '16px 20px',
                  border: '2px solid #dcfce7', display: 'flex', alignItems: 'center', gap: 14,
                  boxShadow: '0 2px 8px rgba(34,197,94,0.08)',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', background: color, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 16, fontWeight: 800, overflow: 'hidden',
                    border: '2px solid #22c55e',
                  }}>
                    {emp.photo_url
                      ? <img src={emp.photo_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()
                    }
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                    <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 600, marginTop: 2 }}>🟢 Entrata: {entry}</div>
                    {emp.store_name && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>📍 {emp.store_name}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Storico timbrature di oggi ── */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
          📋 Timbrature di oggi ({todayList.length})
        </div>
        {todayList.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, textAlign: 'center', color: '#9ca3af', border: '2px dashed #e5e7eb' }}>
            Nessuna timbratura oggi
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
                          background: isIn ? '#dcfce7' : '#f3f4f6',
                          color: isIn ? '#16a34a' : '#6b7280',
                        }}>
                          {isIn ? '🟢 Presente' : rec.checked_out_at ? '⚪ Uscito' : '—'}
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
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EMPLOYEE KIOSK VIEW — Schermata timbratura touch
═══════════════════════════════════════════════════════════ */
function KioskView() {
  const [employees, setEmployees]        = useState([]);
  const [employee,  setEmployee]         = useState(null);
  const [lastStatus, setLastStatus]      = useState(null);
  const [todayRecords, setTodayRecords]  = useState([]);
  const [loading, setLoading]            = useState(false);
  const [loadingEmp, setLoadingEmp]      = useState(true);
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

  useEffect(() => {
    setLoadingEmp(true);
    attendance.getEmployeesKiosk()
      .then(res => { const list = res.data?.data; setEmployees(Array.isArray(list) ? list : []); })
      .catch(() => setEmployees([]))
      .finally(() => setLoadingEmp(false));
  }, []);

  useEffect(() => {
    if (!employee) setTimeout(() => barcodeRef.current?.focus(), 100);
  }, [employee]);

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

  const loadTodayStatus = async emp => {
    try {
      const res = await attendance.getLive({ employee_id: emp.id });
      const liveList = res.data?.data || [];
      setLastStatus(liveList.some(e => e.employee_id === emp.id || e.id === emp.id) ? 'in' : 'out');
      const tr = await attendance.getList({ employee_id: emp.id });
      const all = (tr.data?.data || []).filter(r => r.employee_id === emp.id);
      setTodayRecords(all.map(r => ({ clock_in: r.checked_in_at, clock_out: r.checked_out_at })));
    } catch { setLastStatus(null); setTodayRecords([]); }
  };

  const performClock = async (emp, forceAction = null) => {
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
        await attendance.checkOut({ employee_id: emp.id, store_id: storeId });
        setLastStatus('out');
      }
      setEmployee(emp);
      setPhase('confirmed');
      await loadTodayStatus(emp);
      setTimeout(() => {
        setEmployee(null); setLastStatus(null); setTodayRecords([]);
        setMessage(null); setBarcodeInput(''); setPhase('idle');
        barcodeRef.current?.focus();
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
    await performClock(found);
  }, [barcodeInput, employees]);

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
          {isIn ? 'Entrata timbrata' : 'Uscita timbrata'}
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
                {rec.clock_out && <span style={{ color: '#f87171', fontWeight: 700, fontSize: 14 }}>🔴 {fmtTime(rec.clock_out)}</span>}
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
            {barcodeInput.length > 0 ? '🔦' : '📲'}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            {barcodeInput.length > 0
              ? <span style={{ color: '#a5b4fc', fontFamily: 'monospace', letterSpacing: 4 }}>{barcodeInput}</span>
              : 'Scansiona il tuo badge'
            }
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>
            {barcodeInput.length > 0 ? 'Premi Invio per confermare' : 'oppure seleziona il tuo nome qui sotto'}
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

        {/* Griglia dipendenti */}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, textAlign: 'center' }}>
          — oppure scegli il tuo nome —
        </div>

        {loadingEmp ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: 24 }}>Caricamento...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
            {employees.map(emp => {
              const color = avatarColor(emp.id);
              const name  = `${emp.first_name||''} ${emp.last_name||''}`.trim() || emp.name || `#${emp.id}`;
              return (
                <button
                  key={emp.id}
                  onClick={() => performClock(emp)}
                  disabled={loading}
                  style={{
                    background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)',
                    borderRadius: 16, padding: '16px 12px', cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                    transition: 'all 0.15s', opacity: loading ? 0.5 : 1,
                  }}
                  onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'rgba(123,111,208,0.15)'; e.currentTarget.style.borderColor = 'rgba(123,111,208,0.4)'; e.currentTarget.style.transform = 'translateY(-2px)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = ''; }}
                >
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%', background: color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 900, color: '#fff', flexShrink: 0, overflow: 'hidden',
                  }}>
                    {emp.photo_url
                      ? <img src={emp.photo_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : initials(emp)
                    }
                  </div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, textAlign: 'center', lineHeight: 1.3 }}>{name}</div>
                  {emp.employee_code && (
                    <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: 'monospace' }}>#{emp.employee_code}</div>
                  )}
                </button>
              );
            })}
            {employees.length === 0 && (
              <div style={{ gridColumn: '1/-1', color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: 20 }}>
                Nessun dipendente trovato
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ENTRY POINT — Router in base al ruolo
═══════════════════════════════════════════════════════════ */
export default function ClockInPage() {
  const { user } = useOutletContext() || {};
  const role = user?.role || '';
  const isAdmin = role === 'superadmin' || role === 'admin_cliente';
  return isAdmin ? <AdminPresenceView /> : <KioskView />;
}
