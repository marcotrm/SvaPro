import React, { useState, useEffect, useCallback } from 'react';
import { attendance } from '../api.jsx';

export default function ClockInPage() {
  const [time, setTime] = useState(new Date());
  const [employee, setEmployee] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [todayRecords, setTodayRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success'|'error', text }
  const [lastStatus, setLastStatus] = useState(null); // 'in' | 'out'
  const [barcodeInput, setBarcodeInput] = useState('');

  // Real-time clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load employees for kiosk
  useEffect(() => {
    attendance.getEmployeesKiosk({}).then(r => {
      setEmployees(r.data?.data || []);
    }).catch(() => {});
  }, []);

  // Load today's records when employee selected
  const loadTodayRecords = useCallback(async (empId) => {
    try {
      const r = await attendance.getLive({ employee_id: empId, date: new Date().toISOString().slice(0, 10) });
      const recs = r.data?.data || [];
      setTodayRecords(recs);
      // Determine last status
      if (recs.length > 0) {
        const last = recs[recs.length - 1];
        setLastStatus(last.clock_out ? 'out' : 'in');
      } else {
        setLastStatus('out');
      }
    } catch { setTodayRecords([]); setLastStatus('out'); }
  }, []);

  useEffect(() => {
    if (employee) loadTodayRecords(employee.id);
  }, [employee]);

  const handleBarcodeSelect = (barcode) => {
    const found = employees.find(e => e.barcode === barcode || String(e.id) === barcode);
    if (found) {
      setEmployee(found);
      setMessage(null);
    } else {
      setMessage({ type: 'error', text: 'Badge non riconosciuto. Riprova.' });
      setTimeout(() => setMessage(null), 2500);
    }
    setBarcodeInput('');
  };

  const handleClockIn = async () => {
    if (!employee) return;
    try {
      setLoading(true);
      await attendance.checkIn({ employee_id: employee.id });
      setMessage({ type: 'success', text: `✅ Entrata registrata — ${new Date().toLocaleTimeString('it-IT')}` });
      setLastStatus('in');
      await loadTodayRecords(employee.id);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Errore nella timbratura' });
    } finally { setLoading(false); }
  };

  const handleClockOut = async () => {
    if (!employee) return;
    try {
      setLoading(true);
      await attendance.checkOut({ employee_id: employee.id });
      setMessage({ type: 'success', text: `✅ Uscita registrata — ${new Date().toLocaleTimeString('it-IT')}` });
      setLastStatus('out');
      await loadTodayRecords(employee.id);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Errore nella timbratura' });
    } finally { setLoading(false); }
  };

  const fmtTime = (v) => v ? new Date(v).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', background: 'linear-gradient(135deg, #0e1726 0%, #1a1a3e 50%, #111827 100%)',
      fontFamily: 'Inter, system-ui, sans-serif', padding: 24, position: 'relative',
    }}>
      {/* Logo */}
      <div style={{ position: 'absolute', top: 28, left: 36, color: '#c9a227', fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px' }}>
        Sva<span style={{ color: '#ffffff' }}>Pro</span>
      </div>

      {/* Clock */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          fontSize: 'clamp(52px, 10vw, 96px)', fontWeight: 900, color: '#ffffff',
          letterSpacing: '-4px', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          textShadow: '0 0 40px rgba(201,162,39,0.3)',
        }}>
          {time.toLocaleTimeString('it-IT')}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18, marginTop: 8, fontWeight: 500 }}>
          {time.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Employee selection */}
      {!employee ? (
        <div style={{ textAlign: 'center', maxWidth: 420, width: '100%' }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, marginBottom: 20 }}>
            Scansiona il tuo badge o seleziona il tuo nome
          </div>

          {/* Hidden barcode input (auto-focused) */}
          <input
            autoFocus
            value={barcodeInput}
            onChange={e => setBarcodeInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleBarcodeSelect(barcodeInput); }}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1 }}
            placeholder="barcode"
          />

          <div style={{ display: 'grid', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
            {employees.map(emp => (
              <button key={emp.id} onClick={() => setEmployee(emp)} style={{
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 14, padding: '16px 24px', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                transition: 'all 0.2s', fontSize: 16, fontWeight: 600,
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,162,39,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #c9a227, #f0c035)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 900, color: '#0e1726', flexShrink: 0,
                }}>
                  {(emp.first_name || emp.name || '?')[0].toUpperCase()}
                </div>
                <div>
                  <div>{emp.first_name || ''} {emp.last_name || emp.name || ''}</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>{emp.role || 'Dipendente'}</div>
                </div>
              </button>
            ))}
            {employees.length === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Nessun dipendente trovato</div>
            )}
          </div>

          {message && (
            <div style={{
              marginTop: 16, padding: '12px 20px', borderRadius: 12,
              background: message.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
              border: `1px solid ${message.type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}`,
              color: message.type === 'error' ? '#fca5a5' : '#86efac', fontSize: 14, fontWeight: 600,
            }}>
              {message.text}
            </div>
          )}
        </div>
      ) : (
        /* Clock action panel */
        <div style={{ textAlign: 'center', width: '100%', maxWidth: 480 }}>

          {/* Employee badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center',
            marginBottom: 36, background: 'rgba(255,255,255,0.06)', borderRadius: 20,
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
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{employee.role || 'Dipendente'}</div>
            </div>
            <button onClick={() => { setEmployee(null); setLastStatus(null); setTodayRecords([]); setMessage(null); }}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 20 }}>
              ✕
            </button>
          </div>

          {/* Status indicator */}
          <div style={{ marginBottom: 28, color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>
            {lastStatus === 'in'
              ? <span style={{ color: '#4ade80' }}>● Sei attualmente <strong>in servizio</strong></span>
              : <span style={{ color: 'rgba(255,255,255,0.4)' }}>● Fuori servizio</span>
            }
          </div>

          {/* Main action button */}
          {message ? (
            <div style={{
              padding: '28px 40px', borderRadius: 24, fontSize: 22, fontWeight: 800,
              background: message.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
              border: `2px solid ${message.type === 'error' ? '#ef4444' : '#22c55e'}`,
              color: message.type === 'error' ? '#fca5a5' : '#86efac',
              marginBottom: 24,
            }}>
              {message.text}
            </div>
          ) : lastStatus === 'in' ? (
            <button onClick={handleClockOut} disabled={loading} style={{
              width: '100%', padding: '32px 40px', borderRadius: 24, border: '3px solid #ef4444',
              background: 'rgba(239,68,68,0.15)', color: '#fca5a5', fontSize: 24, fontWeight: 900,
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
              letterSpacing: '-0.5px',
            }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(239,68,68,0.3)'; }}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
            >
              {loading ? 'Attendere...' : '■  TIMBRA USCITA'}
            </button>
          ) : (
            <button onClick={handleClockIn} disabled={loading} style={{
              width: '100%', padding: '32px 40px', borderRadius: 24, border: '3px solid #22c55e',
              background: 'rgba(34,197,94,0.15)', color: '#86efac', fontSize: 24, fontWeight: 900,
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
              letterSpacing: '-0.5px',
            }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(34,197,94,0.3)'; }}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(34,197,94,0.15)'}
            >
              {loading ? 'Attendere...' : '▶  TIMBRA ENTRATA'}
            </button>
          )}

          {/* Today's records */}
          {todayRecords.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Timbrature di oggi
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                {todayRecords.map((rec, i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 14px',
                    border: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 10, alignItems: 'center',
                  }}>
                    <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 700 }}>▶ {fmtTime(rec.clock_in)}</span>
                    {rec.clock_out && <span style={{ color: '#f87171', fontSize: 13, fontWeight: 700 }}>■ {fmtTime(rec.clock_out)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer hint */}
      <div style={{ position: 'absolute', bottom: 20, color: 'rgba(255,255,255,0.15)', fontSize: 12 }}>
        SvaPro Timbrature — {new Date().getFullYear()}
      </div>
    </div>
  );
}
