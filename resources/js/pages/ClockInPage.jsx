import React, { useState, useEffect, useRef, useCallback } from 'react';
import { attendance } from '../api.jsx';

/**
 * ClockInPage — Kiosk per timbrature dipendenti
 *
 * Flusso: Scansiona badge (barcode) → conferma automatica ENTRATA/USCITA
 * Fallback: seleziona nome dalla lista → premi il pulsante
 */
export default function ClockInPage() {
  const [employees, setEmployees]        = useState([]);
  const [employee, setEmployee]          = useState(null);
  const [lastStatus, setLastStatus]      = useState(null); // 'in' | 'out' | null
  const [todayRecords, setTodayRecords]  = useState([]);
  const [loading, setLoading]            = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [message, setMessage]            = useState(null); // { text, type }

  // Barcode input
  const [barcodeInput, setBarcodeInput]  = useState('');
  const barcodeRef = useRef(null);

  const now = useRef(null);
  const [clockStr, setClockStr] = useState('');

  // Live clock
  useEffect(() => {
    const tick = () => setClockStr(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Load employees
  useEffect(() => {
    setLoadingEmployees(true);
    attendance.getEmployeesKiosk()
      .then(res => setEmployees(res.data?.data?.employees || []))
      .catch(() => setEmployees([]))
      .finally(() => setLoadingEmployees(false));
  }, []);

  // Auto-focus barcode input when no employee is selected
  useEffect(() => {
    if (!employee) {
      setTimeout(() => barcodeRef.current?.focus(), 100);
    }
  }, [employee]);

  const showMessage = (text, type = 'success', duration = 3500) => {
    setMessage({ text, type });
    setTimeout(() => { setMessage(null); }, duration);
  };

  // Recupera store_id dal localStorage (impostato dal selettore negozio nel Layout)
  const getStoreId = () => {
    const val = localStorage.getItem('selectedStoreId');
    return val ? parseInt(val, 10) : null;
  };

  const resolveEmployee = (val) => {
    const trimmed = val.trim().toLowerCase();
    if (!trimmed) return null;
    return employees.find(em =>
      (em.barcode    && em.barcode.toLowerCase()    === trimmed) ||
      (em.badge_code && em.badge_code.toLowerCase() === trimmed) ||
      String(em.id) === trimmed
    ) || null;
  };

  // Handle barcode submit (Enter key)
  const handleBarcodeSubmit = useCallback(async () => {
    const val = barcodeInput.trim();
    if (!val) return;
    setBarcodeInput('');

    const found = resolveEmployee(val);
    if (!found) {
      showMessage(`❌ Badge "${val}" non riconosciuto. Contatta un amministratore.`, 'error');
      barcodeRef.current?.focus();
      return;
    }

    // Auto-clock in/out
    await performClock(found);
    setTimeout(() => barcodeRef.current?.focus(), 3600);
  }, [barcodeInput, employees]);

  const loadTodayStatus = async (emp) => {
    try {
      const res = await attendance.getLive({ employee_id: emp.id });
      const liveList = res.data?.data || [];
      const isPresent = liveList.some(e => e.employee_id === emp.id || e.id === emp.id);
      setLastStatus(isPresent ? 'in' : 'out');
      // Carica timbrature di oggi
      try {
        const todayRes = await attendance.getList({ employee_id: emp.id });
        const all = (todayRes.data?.data || []).filter(r => r.employee_id === emp.id);
        setTodayRecords(all.map(r => ({ clock_in: r.checked_in_at, clock_out: r.checked_out_at })));
      } catch { setTodayRecords([]); }
    } catch {
      setLastStatus(null);
      setTodayRecords([]);
    }
  };

  // Perform clock action (auto-detect in/out or manual)
  const performClock = async (emp, forceAction = null) => {
    setLoading(true);
    const storeId = getStoreId();

    if (!storeId) {
      showMessage('❌ Nessun negozio selezionato. Seleziona prima un negozio dal menu in alto.', 'error');
      setLoading(false);
      return;
    }

    try {
      // Get current status first
      let currentStatus = null;
      try {
        const res = await attendance.getLive({ employee_id: emp.id });
        const liveList = res.data?.data || [];
        currentStatus = liveList.some(e => e.employee_id === emp.id || e.id === emp.id) ? 'in' : 'out';
      } catch {}

      const action = forceAction || (currentStatus === 'in' ? 'out' : 'in');

      if (action === 'in') {
        await attendance.checkIn({ employee_id: emp.id, store_id: storeId });
        showMessage(`✅ Entrata timbrata per ${emp.first_name} ${emp.last_name} — ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`, 'success');
        setLastStatus('in');
      } else {
        await attendance.checkOut({ employee_id: emp.id, store_id: storeId });
        showMessage(`👋 Uscita timbrata per ${emp.first_name} ${emp.last_name} — ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`, 'success');
        setLastStatus('out');
      }

      setEmployee(emp);
      await loadTodayStatus(emp);

      // Auto-reset kiosk after 4 seconds
      setTimeout(() => {
        setEmployee(null);
        setLastStatus(null);
        setTodayRecords([]);
        setMessage(null);
        barcodeRef.current?.focus();
      }, 4000);

    } catch (err) {
      showMessage(`❌ Errore: ${err.response?.data?.message || err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEmployee = async (emp) => {
    setEmployee(emp);
    await loadTodayStatus(emp);
  };

  const fmtTime = v => v ? new Date(v).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div style={{
      minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #0e1726 0%, #1a1a2e 50%, #0f1723 100%)',
      borderRadius: 24, padding: '40px 20px', position: 'relative',
    }}>
      {/* Orologio */}
      <div style={{ position: 'absolute', top: 28, left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ fontSize: 56, fontWeight: 900, color: '#fff', letterSpacing: -2, fontFamily: 'monospace', lineHeight: 1 }}>
          {clockStr}
        </div>
        <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
          {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* Main card */}
      <div style={{ width: '100%', maxWidth: 520, padding: '0 20px', marginTop: 20 }}>

        {!employee ? (
          /* ── SCAN MODE ── */
          <div>
            {/* Big barcode input area */}
            <div
              onClick={() => barcodeRef.current?.focus()}
              style={{
                background: barcodeInput.length > 0 ? 'rgba(201,162,39,0.1)' : 'rgba(255,255,255,0.04)',
                border: `3px dashed ${barcodeInput.length > 0 ? '#c9a227' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: 24, padding: '36px 24px', textAlign: 'center', cursor: 'text',
                marginBottom: 24, transition: 'all 0.2s', position: 'relative',
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>
                {barcodeInput.length > 0 ? '🔦' : '📲'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
                {barcodeInput.length > 0 ? (
                  <span style={{ color: '#c9a227', fontFamily: 'monospace', letterSpacing: 4 }}>{barcodeInput}</span>
                ) : (
                  'Scansiona il tuo badge'
                )}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
                {barcodeInput.length > 0 ? 'Premi Invio per confermare' : 'oppure seleziona il nome qui sotto'}
              </div>

              {/* Hidden → actual focused input */}
              <input
                ref={barcodeRef}
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleBarcodeSubmit(); }}
                autoFocus
                style={{
                  position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
                  width: 180, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8, padding: '6px 12px', color: '#fff', fontSize: 13, textAlign: 'center',
                  outline: 'none', fontFamily: 'monospace', letterSpacing: 2,
                }}
                placeholder="ID / Codice badge"
              />
            </div>

            {/* Feedback message */}
            {message && (
              <div style={{
                marginBottom: 20, padding: '16px 24px', borderRadius: 16, textAlign: 'center',
                background: message.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                border: `2px solid ${message.type === 'error' ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.5)'}`,
                color: message.type === 'error' ? '#fca5a5' : '#86efac',
                fontSize: 16, fontWeight: 700, animation: 'fadeIn 0.3s ease',
              }}>
                {message.text}
              </div>
            )}

            {/* Employee list (manual fallback) */}
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, textAlign: 'center' }}>
                — oppure scegli il tuo nome —
              </div>
              {loadingEmployees ? (
                <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 16 }}>Caricamento...</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {employees.map(emp => (
                    <button key={emp.id} onClick={() => handleSelectEmployee(emp)} style={{
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 12, padding: '12px 20px', color: '#fff', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                      transition: 'all 0.15s', fontSize: 15, fontWeight: 600,
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,162,39,0.12)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, #c9a227, #f0c035)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, fontWeight: 900, color: '#0e1726', overflow: 'hidden',
                      }}>
                        {emp.photo_url
                          ? <img src={emp.photo_url} alt={emp.first_name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                          : (emp.first_name || emp.name || '?')[0].toUpperCase()
                        }
                      </div>
                      <div>
                        <div>{emp.first_name || ''} {emp.last_name || emp.name || ''}</div>
                        {emp.employee_code && (
                          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2, fontFamily: 'monospace' }}>
                            #{emp.employee_code}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                  {employees.length === 0 && !loadingEmployees && (
                    <div style={{ color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: 12 }}>Nessun dipendente trovato</div>
                  )}
                </div>
              )}
            </div>
          </div>

        ) : (
          /* ── CLOCK ACTION MODE ── */
          <div style={{ textAlign: 'center' }}>
            {/* Employee badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center',
              marginBottom: 32, background: 'rgba(255,255,255,0.06)', borderRadius: 20,
              padding: '16px 28px', border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #c9a227, #f0c035)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 900, color: '#0e1726',
              }}>
                {(employee.first_name || employee.name || '?')[0].toUpperCase()}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 20 }}>
                  {employee.first_name || ''} {employee.last_name || employee.name || ''}
                </div>
                <div style={{ color: lastStatus === 'in' ? '#4ade80' : 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 2 }}>
                  {lastStatus === 'in' ? '🟢 In servizio' : '⚪ Fuori servizio'}
                </div>
              </div>
              <button onClick={() => { setEmployee(null); setLastStatus(null); setTodayRecords([]); setMessage(null); setBarcodeInput(''); }}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 22 }}>
                ✕
              </button>
            </div>

            {/* Message or action button */}
            {message ? (
              <div style={{
                padding: '28px 40px', borderRadius: 24, fontSize: 20, fontWeight: 800, marginBottom: 24,
                background: message.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                border: `2px solid ${message.type === 'error' ? '#ef4444' : '#22c55e'}`,
                color: message.type === 'error' ? '#fca5a5' : '#86efac',
              }}>
                {message.text}
              </div>
            ) : lastStatus === 'in' ? (
              <button onClick={() => performClock(employee, 'out')} disabled={loading} style={{
                width: '100%', padding: '32px 40px', borderRadius: 24, border: '3px solid #ef4444',
                background: 'rgba(239,68,68,0.15)', color: '#fca5a5', fontSize: 24, fontWeight: 900,
                cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', letterSpacing: '-0.5px',
              }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(239,68,68,0.3)'; }}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
              >
                {loading ? '⏳ Attendere...' : '🔴 TIMBRA USCITA'}
              </button>
            ) : (
              <button onClick={() => performClock(employee, 'in')} disabled={loading} style={{
                width: '100%', padding: '32px 40px', borderRadius: 24, border: '3px solid #22c55e',
                background: 'rgba(34,197,94,0.15)', color: '#86efac', fontSize: 24, fontWeight: 900,
                cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', letterSpacing: '-0.5px',
              }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(34,197,94,0.3)'; }}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(34,197,94,0.15)'}
              >
                {loading ? '⏳ Attendere...' : '🟢 TIMBRA ENTRATA'}
              </button>
            )}

            {/* Today's records */}
            {todayRecords.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  Timbrature di oggi
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {todayRecords.map((rec, i) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 14px',
                      border: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 10, alignItems: 'center',
                    }}>
                      <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 700 }}>🟢 {fmtTime(rec.clock_in)}</span>
                      {rec.clock_out && <span style={{ color: '#f87171', fontSize: 13, fontWeight: 700 }}>🔴 {fmtTime(rec.clock_out)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ position: 'absolute', bottom: 20, color: 'rgba(255,255,255,0.12)', fontSize: 12 }}>
        SvaPro Timbrature © {new Date().getFullYear()} — Scansiona il badge o inserisci l'ID + Invio
      </div>
    </div>
  );
}
