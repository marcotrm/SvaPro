import React, { useState, useEffect, useMemo } from 'react';
import { shifts as shiftsApi } from '../api.jsx';
import { Calendar, ChevronLeft, ChevronRight, Clock, CheckCircle, XCircle, Loader2, BarChart2 } from 'lucide-react';

// ─── Utility ────────────────────────────────────────────────────────────────
function fmtTime(t) { return t ? t.slice(0, 5) : '—'; }
function daysBetween(start, end) {
  const a = new Date(start), b = new Date(end);
  return Math.round((b - a) / 86400000) + 1;
}
const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const DAYS_IT = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];

// ─── MonthPicker ─────────────────────────────────────────────────────────────
function MonthPicker({ year, month, onChange }) {
  const prev = () => month === 1 ? onChange(year - 1, 12) : onChange(year, month - 1);
  const next = () => month === 12 ? onChange(year + 1, 1) : onChange(year, month + 1);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={prev} style={{ border: 'none', background: '#f1f5f9', cursor: 'pointer', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        <ChevronLeft size={16} />
      </button>
      <span style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', minWidth: 160, textAlign: 'center' }}>
        {MONTHS_IT[month - 1]} {year}
      </span>
      <button onClick={next} style={{ border: 'none', background: '#f1f5f9', cursor: 'pointer', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ─── KPI Mini ────────────────────────────────────────────────────────────────
function MiniKpi({ label, value, color = '#6366f1', icon: Icon }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{value}</div>
      </div>
    </div>
  );
}

// ─── Componente Principale ────────────────────────────────────────────────────
export default function EmployeeShiftsTab({ employee }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [allShifts, setAllShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'

  // Date del mese corrente
  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
  const dateTo = (() => {
    const last = new Date(year, month, 0);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '00')}-${String(last.getDate()).padStart(2, '0')}`;
  })();

  useEffect(() => {
    if (!employee?.id) return;
    setLoading(true);
    shiftsApi.getAll({ employee_id: employee.id, date_from: dateFrom, date_to: dateTo, limit: 200 })
      .then(res => {
        const raw = res.data?.data || res.data || [];
        // Filtra solo i turni di questo dipendente
        setAllShifts(Array.isArray(raw) ? raw.filter(s => s.employee_id === employee.id || !s.employee_id) : []);
      })
      .catch(() => setAllShifts([]))
      .finally(() => setLoading(false));
  }, [employee?.id, year, month]);

  // Statistiche derivate
  const stats = useMemo(() => {
    const effettuati = allShifts.filter(s => {
      const d = new Date(s.date || s.start_date || s.shift_date);
      return d <= now;
    });
    const futuri = allShifts.filter(s => {
      const d = new Date(s.date || s.start_date || s.shift_date);
      return d > now;
    });
    const totalOre = allShifts.reduce((sum, s) => {
      if (s.start_time && s.end_time) {
        const [sh, sm] = s.start_time.split(':').map(Number);
        const [eh, em] = s.end_time.split(':').map(Number);
        const diff = (eh * 60 + em) - (sh * 60 + sm);
        return sum + Math.max(diff, 0) / 60;
      }
      return sum;
    }, 0);
    return { 
      totale: allShifts.length, 
      effettuati: effettuati.length, 
      futuri: futuri.length,
      ore: Math.round(totalOre * 10) / 10,
    };
  }, [allShifts]);

  // Turni per giorno-chiave per la vista calendario
  const shiftsByDate = useMemo(() => {
    const map = {};
    allShifts.forEach(s => {
      const key = (s.date || s.start_date || s.shift_date || '').slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [allShifts]);

  // Genera i giorni del mese per la vista calendario
  const calendarDays = useMemo(() => {
    const days = [];
    const total = new Date(year, month, 0).getDate();
    for (let d = 1; d <= total; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dow = new Date(dateStr).getDay();
      days.push({ d, dateStr, dow, shifts: shiftsByDate[dateStr] || [] });
    }
    return days;
  }, [year, month, shiftsByDate]);

  const todayStr = now.toISOString().slice(0, 10);

  return (
    <div>
      {/* ── Header controlli ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={18} color="#6366f1" />
          <span style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>Turni di {employee?.first_name} {employee?.last_name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
          <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            {['list', 'calendar'].map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} style={{
                padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800,
                background: viewMode === mode ? '#6366f1' : '#fff',
                color: viewMode === mode ? '#fff' : '#64748b',
                transition: 'all 0.15s',
              }}>
                {mode === 'list' ? '≡ Lista' : '📅 Calendario'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        <MiniKpi label="Turni nel mese" value={stats.totale} color="#6366f1" icon={Calendar} />
        <MiniKpi label="Già effettuati" value={stats.effettuati} color="#10b981" icon={CheckCircle} />
        <MiniKpi label="Da fare" value={stats.futuri} color="#f59e0b" icon={Clock} />
        <MiniKpi label="Ore pianificate" value={`${stats.ore}h`} color="#8b5cf6" icon={BarChart2} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Loader2 size={28} className="sp-spin" style={{ color: '#6366f1', margin: '0 auto' }} />
          <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>Caricamento turni...</div>
        </div>
      ) : allShifts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
          <Calendar size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontSize: 16, fontWeight: 800, color: '#cbd5e1', marginBottom: 6 }}>Nessun turno pianificato</div>
          <div style={{ fontSize: 13 }}>Non ci sono turni registrati per {MONTHS_IT[month - 1]} {year}</div>
        </div>
      ) : viewMode === 'list' ? (
        // ── Vista Lista ──────────────────────────────────────────────────────────
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allShifts
            .sort((a, b) => {
              const da = (a.date || a.start_date || a.shift_date || '');
              const db = (b.date || b.start_date || b.shift_date || '');
              return da.localeCompare(db);
            })
            .map((shift, i) => {
              const rawDate = shift.date || shift.start_date || shift.shift_date || '';
              const dateStr = rawDate.slice(0, 10);
              const dateObj = new Date(dateStr);
              const isPast = dateStr < todayStr;
              const isToday = dateStr === todayStr;
              const dayLabel = dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' });

              const shiftColor = shift.color || (isToday ? '#6366f1' : isPast ? '#64748b' : '#10b981');

              return (
                <div key={i} style={{
                  background: '#fff', borderRadius: 14, padding: '14px 18px',
                  border: `1.5px solid ${isToday ? '#6366f1' : '#f1f5f9'}`,
                  display: 'flex', alignItems: 'center', gap: 14,
                  boxShadow: isToday ? '0 0 0 3px rgba(99,102,241,0.1)' : '0 2px 8px rgba(0,0,0,0.02)',
                  transition: 'all 0.15s',
                }}>
                  {/* Indicatore giorno */}
                  <div style={{ width: 50, textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: isToday ? '#6366f1' : '#0f172a', lineHeight: 1 }}>
                      {dateObj.getDate()}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                      {DAYS_IT[dateObj.getDay()]}
                    </div>
                  </div>

                  {/* Linea colorata */}
                  <div style={{ width: 4, height: 44, borderRadius: 4, background: shiftColor, flexShrink: 0 }} />

                  {/* Info turno */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
                      {shift.label || shift.name || 'Turno'}
                      {isToday && <span style={{ marginLeft: 8, fontSize: 10, background: '#eef2ff', color: '#6366f1', fontWeight: 800, borderRadius: 6, padding: '1px 6px' }}>OGGI</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Clock size={12} />
                      {fmtTime(shift.start_time)} – {fmtTime(shift.end_time)}
                      {shift.store_name && <span>· {shift.store_name}</span>}
                    </div>
                  </div>

                  {/* Status */}
                  <div style={{ flexShrink: 0 }}>
                    {isPast ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, color: '#64748b' }}>
                        <CheckCircle size={14} color="#10b981" /> Completato
                      </span>
                    ) : isToday ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, color: '#6366f1' }}>
                        <Clock size={14} color="#6366f1" /> In corso
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, color: '#f59e0b' }}>
                        <Clock size={14} color="#f59e0b" /> Pianificato
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        // ── Vista Calendario ─────────────────────────────────────────────────────
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
          {/* Header giorni settimana */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
            {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(d => (
              <div key={d} style={{ padding: '10px 4px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>
            ))}
          </div>
          {/* Griglia giorni */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {/* Giorni vuoti prima del primo giorno del mese (lun=0) */}
            {Array.from({ length: (new Date(dateFrom).getDay() + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} style={{ minHeight: 70, background: '#f8fafc', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9' }} />
            ))}
            {calendarDays.map(({ d, dateStr, shifts: dayShifts }) => {
              const isToday = dateStr === todayStr;
              const isPast = dateStr < todayStr;
              return (
                <div key={dateStr} style={{
                  minHeight: 70, padding: '6px 8px', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9',
                  background: isToday ? '#eef2ff' : 'transparent',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: isToday ? '#6366f1' : isPast ? '#94a3b8' : '#334155', marginBottom: 4 }}>{d}</div>
                  {dayShifts.map((s, si) => (
                    <div key={si} style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4,
                      background: s.color ? `${s.color}22` : '#eef2ff',
                      color: s.color || '#6366f1',
                      marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {fmtTime(s.start_time)}–{fmtTime(s.end_time)} {s.label || s.name || ''}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
