import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { attendance as attendanceApi } from '../api.jsx';
import { CheckCircle, LogIn, LogOut, Clock, AlertTriangle, Loader, RefreshCw, Wifi, WifiOff } from 'lucide-react';

const STATUS_COLOR = {
  presente: { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7', label: 'Presente' },
  fuori: { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB', label: 'Uscito' },
  assente: { bg: 'var(--color-surface)', text: 'var(--color-text)', border: 'var(--color-border)', label: 'Non timbrato' },
};

function Clock_({ serverTime }) {
  const [now, setNow] = useState(() => serverTime ? new Date(serverTime) : new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(n => new Date(n.getTime() + 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ textAlign: 'center', marginBottom: 32 }}>
      <div style={{ fontSize: 72, fontWeight: 900, letterSpacing: -4, color: 'var(--color-text)', fontFamily: 'monospace', lineHeight: 1 }}>
        {now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div style={{ fontSize: 18, color: 'var(--color-text-secondary)', marginTop: 8, fontWeight: 600 }}>
        {now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
    </div>
  );
}

function FeedbackBanner({ message, type }) {
  if (!message) return null;
  const colors = {
    success: { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' },
    error: { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' },
    warning: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
    info: { bg: '#EFF6FF', text: '#1E40AF', border: '#93C5FD' },
  }[type] || { bg: '#EFF6FF', text: '#1E40AF', border: '#93C5FD' };

  return (
    <div style={{
      position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
      padding: '18px 32px', borderRadius: 16, border: `2px solid ${colors.border}`,
      background: colors.bg, color: colors.text, fontWeight: 700, fontSize: 18,
      boxShadow: '0 8px 32px rgba(0,0,0,0.15)', zIndex: 9999, textAlign: 'center',
      maxWidth: 500, minWidth: 280,
    }}>
      {message}
    </div>
  );
}

export default function AttendancePage() {
  const { selectedStoreId } = useOutletContext?.() || {};
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null); // employee_id in lavorazione
  const [feedback, setFeedback] = useState(null); // { message, type }
  const [serverTime, setServerTime] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const feedbackTimer = useRef(null);

  useEffect(() => {
    window.addEventListener('online', () => setOnline(true));
    window.addEventListener('offline', () => setOnline(false));
  }, []);

  const load = useCallback(async () => {
    try {
      const params = selectedStoreId ? { store_id: selectedStoreId } : {};
      const res = await attendanceApi.getEmployeesKiosk(params);
      setEmployees(res.data?.data || []);
      setServerTime(res.data?.server_time);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  // Polling ogni 30s per aggiornare lo stato
  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const showFeedback = (message, type = 'success', duration = 3500) => {
    clearTimeout(feedbackTimer.current);
    setFeedback({ message, type });
    feedbackTimer.current = setTimeout(() => setFeedback(null), duration);
  };

  const handleTap = async (emp) => {
    if (processing) return;
    setProcessing(emp.id);
    try {
      const params = { employee_id: emp.id };
      if (selectedStoreId) params.store_id = selectedStoreId;
      else params.store_id = 1; // fallback

      if (emp.status === 'presente') {
        // Check-out
        const res = await attendanceApi.checkOut(params);
        showFeedback(
          `👋 ${res.data.employee_name} — Uscita registrata alle ${new Date(res.data.checked_out_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}.\n⏱ Turno: ${res.data.duration_label}`,
          'info', 4000
        );
      } else {
        // Check-in
        const res = await attendanceApi.checkIn(params);
        const lateMsg = res.data.late_minutes > 0
          ? ` ⚠️ ${res.data.late_minutes} min in ritardo`
          : '';
        showFeedback(
          `✅ ${res.data.employee_name} — Entrata alle ${new Date(res.data.checked_in_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}.${lateMsg}`,
          res.data.late_minutes > 0 ? 'warning' : 'success',
          4000
        );
      }
      // Ricarica stato
      await load();
    } catch (err) {
      showFeedback(err.response?.data?.message || 'Errore di connessione.', 'error');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <Loader size={36} style={{ animation: 'spin 1s linear infinite', opacity: 0.5 }} />
    </div>
  );

  const present = employees.filter(e => e.status === 'presente').length;
  const absent = employees.filter(e => e.status === 'assente').length;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Info banner: how to clock in */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b, #312e81)', borderRadius: 16, padding: '18px 24px',
        marginBottom: 28, display: 'flex', alignItems: 'center', gap: 20, color: '#fff',
      }}>
        <span style={{ fontSize: 32, flexShrink: 0 }}>⏱</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 2 }}>Come funzionano le Timbrature</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.5 }}>
            <strong>Dipendenti:</strong> vanno su <code style={{ background: 'rgba(255,255,255,0.15)', padding: '1px 6px', borderRadius: 4 }}>/clock-in</code> da tablet all'ingresso,
            selezionano il proprio nome (o scansionano il badge) e premono il pulsante. &nbsp;|&nbsp;
            <strong>Admin:</strong> in questa pagina vedete lo stato live di tutti + potete timbrare manualmente cliccando sulla card.
          </div>
        </div>
        <button
          onClick={() => window.open('/clock-in', '_blank')}
          style={{ background: '#c9a227', color: '#0e1726', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 800, cursor: 'pointer', fontSize: 13, flexShrink: 0 }}
        >
          🖥 Apri Kiosk Timbra
        </button>
      </div>

      {/* Header orologio */}
      <Clock_ serverTime={serverTime} />


      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#065F46', background: '#D1FAE5', padding: '6px 16px', borderRadius: 100 }}>
          <CheckCircle size={16} /> {present} Presenti
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)', background: 'var(--color-bg)', padding: '6px 16px', borderRadius: 100 }}>
          <Clock size={16} /> {absent} Non timbrati
        </div>
        {!online && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#92400E', background: '#FEF3C7', padding: '6px 14px', borderRadius: 100, fontWeight: 600 }}>
            <WifiOff size={14} /> Offline
          </div>
        )}
        <button onClick={load} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, marginLeft: 8 }}>
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Griglia dipendenti — card grandi per tocco */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 16,
      }}>
        {employees.map(emp => {
          const sc = STATUS_COLOR[emp.status] || STATUS_COLOR.assente;
          const isProcessing = processing === emp.id;

          return (
            <button
              key={emp.id}
              onClick={() => handleTap(emp)}
              disabled={!!processing}
              style={{
                background: sc.bg,
                border: `2px solid ${sc.border}`,
                borderRadius: 20,
                padding: '20px 16px',
                cursor: processing ? 'wait' : 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s',
                opacity: processing && !isProcessing ? 0.6 : 1,
                boxShadow: emp.status === 'presente' ? '0 4px 16px rgba(16,185,129,0.2)' : '0 2px 8px rgba(0,0,0,0.06)',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!processing) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = emp.status === 'presente' ? '0 4px 16px rgba(16,185,129,0.2)' : '0 2px 8px rgba(0,0,0,0.06)'; }}
            >
              {/* Avatar */}
              <div style={{
                width: 60, height: 60, borderRadius: '50%', margin: '0 auto 12px',
                background: emp.status === 'presente' ? '#A7F3D0' : 'var(--color-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, border: `3px solid ${sc.border}`,
              }}>
                {emp.name.charAt(0).toUpperCase()}
              </div>

              {/* Nome */}
              <div style={{ fontSize: 15, fontWeight: 800, color: sc.text, marginBottom: 4, lineHeight: 1.2 }}>
                {emp.name}
              </div>

              {/* Ruolo */}
              {emp.role && (
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 8, textTransform: 'capitalize' }}>
                  {emp.role}
                </div>
              )}

              {/* Status */}
              <div style={{ fontSize: 12, fontWeight: 700, color: sc.text, marginBottom: 8 }}>
                {isProcessing ? '...' : sc.label}
              </div>

              {/* Orario entrata/uscita */}
              {emp.checked_in_at && (
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  Entrata: {new Date(emp.checked_in_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              {emp.checked_out_at && (
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  Uscita: {new Date(emp.checked_out_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              {emp.late_minutes > 0 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#92400E', background: '#FEF3C7', padding: '3px 8px', borderRadius: 100 }}>
                  <AlertTriangle size={10} /> {emp.late_minutes} min ritardo
                </div>
              )}

              {/* Action hint */}
              {!isProcessing && emp.status !== 'fuori' && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: emp.status === 'presente' ? '#065F46' : 'var(--color-accent)' }}>
                  {emp.status === 'presente'
                    ? <><LogOut size={13} /> Tocca per uscita</>
                    : <><LogIn size={13} /> Tocca per entrata</>
                  }
                </div>
              )}

              {isProcessing && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 18, background: 'rgba(255,255,255,0.7)' }}>
                  <Loader size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-accent)' }} />
                </div>
              )}
            </button>
          );
        })}

        {employees.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--color-text-tertiary)', padding: 60 }}>
            <Clock size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
            <p>Nessun dipendente attivo trovato.</p>
            <p style={{ fontSize: 12, marginTop: 8 }}>Aggiungi dipendenti nella sezione Dipendenti.</p>
          </div>
        )}
      </div>

      {/* Banner feedback */}
      <FeedbackBanner message={feedback?.message} type={feedback?.type} />
    </div>
  );
}
