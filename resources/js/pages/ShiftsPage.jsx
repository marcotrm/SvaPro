import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { attendance, shifts as shiftsApi, stores, clearApiCache } from '../api.jsx';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Save, Copy, Loader, Clock, Trash, X } from 'lucide-react';
import toast from 'react-hot-toast';
import ShiftTemplateModal from '../components/ShiftTemplateModal.jsx';

// Utility per date
function getStartOfWeek(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = d.getDay() || 7; // Rendiamo Sunday = 7
  d.setDate(d.getDate() - day + 1); // Monday
  return d;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function generateWeekDays(startDate) {
  const days = [];
  const curr = new Date(startDate);
  for (let i = 0; i < 7; i++) {
    days.push({
      dateStr: formatDate(curr),
      label: curr.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' }),
      isToday: formatDate(curr) === formatDate(new Date())
    });
    curr.setDate(curr.getDate() + 1);
  }
  return days;
}

export default function ShiftsPage() {
  const { selectedStoreId } = useOutletContext?.() || {};
  const [storeId, setStoreId] = useState(selectedStoreId || '');

  // Settimana
  const [weekStart, setWeekStart] = useState(() => getStartOfWeek());
  const weekDays = useMemo(() => generateWeekDays(weekStart), [weekStart]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState({}); // Mappa: "empId_dateStr" -> { start_time, end_time, color }
  const [originalShifts, setOriginalShifts] = useState({}); // Per tracciare modifiche e delezioni

  const [templates, setTemplates] = useState([]);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);

  // Per menu contestuale della cella
  const [activeCell, setActiveCell] = useState(null); // { empId, dateStr }

  useEffect(() => {
    if (selectedStoreId) setStoreId(selectedStoreId);
  }, [selectedStoreId]);

  useEffect(() => {
    if (storeId) {
      loadData();
    } else {
      setEmployees([]);
      setShifts({});
      setOriginalShifts({});
    }
  }, [storeId, weekStart]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Carica i dipendenti di questo store (usiamo l'api kiosk che fa proprio questo)
      const empRes = await attendance.getEmployeesKiosk({ store_id: storeId });
      setEmployees(empRes.data?.data || []);

      // 2. Carica i turni della settimana
      const startDateStr = weekDays[0].dateStr;
      const endDateStr = weekDays[6].dateStr;
      const shRes = await shiftsApi.getAll({ store_id: storeId, start_date: startDateStr, end_date: endDateStr });
      
      const shiftsMap = {};
      (shRes.data?.data || []).forEach(s => {
        const key = `${s.employee_id}_${s.date}`;
        shiftsMap[key] = { start_time: s.start_time, end_time: s.end_time, color: s.color };
      });
      setShifts(shiftsMap);
      setOriginalShifts(JSON.parse(JSON.stringify(shiftsMap)));

      // 3. Carica i template (solo per il popup contestuale)
      const tplRes = await shiftsApi.getTemplates();
      setTemplates(tplRes.data?.data || []);

    } catch (err) {
      toast.error('Errore caricamento dati');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() - 7);
    setWeekStart(next);
  };
  const handleNextWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
  };

  const onCellChange = (empId, dateStr, changes) => {
    const key = `${empId}_${dateStr}`;
    setShifts(prev => {
      const copy = { ...prev };
      if (!copy[key]) copy[key] = { start_time: '', end_time: '', color: '#10B981' };
      copy[key] = { ...copy[key], ...changes };
      return copy;
    });
  };

  const applyTemplate = (empId, dateStr, tpl) => {
    onCellChange(empId, dateStr, { start_time: tpl.start_time, end_time: tpl.end_time, color: tpl.color });
    setActiveCell(null);
  };

  const clearCell = (empId, dateStr) => {
    const key = `${empId}_${dateStr}`;
    setShifts(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    setActiveCell(null);
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const payload = { store_id: storeId, shifts: [], deletions: [] };
      
      // Calcola differenze
      // Tutti quelli attualmente in shifts sono da salvare/aggiornare
      Object.keys(shifts).forEach(key => {
        const [empId, dateStr] = key.split('_');
        payload.shifts.push({
          employee_id: empId,
          date: dateStr,
          start_time: shifts[key].start_time,
          end_time: shifts[key].end_time,
          color: shifts[key].color
        });
      });

      // Se c'era in originalShifts ma non c'è più in shifts, va in deletions
      Object.keys(originalShifts).forEach(key => {
        if (!shifts[key]) {
          const [empId, dateStr] = key.split('_');
          payload.deletions.push({ employee_id: empId, date: dateStr });
        }
      });

      await shiftsApi.bulkSave(payload);
      toast.success('Turni salvati con successo');
      setOriginalShifts(JSON.parse(JSON.stringify(shifts)));

    } catch (err) {
      toast.error('Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const renderCellMenu = (empId, dateStr) => {
    const isActive = activeCell?.empId === empId && activeCell?.dateStr === dateStr;
    if (!isActive) return null;

    return (
      <div style={{
        position: 'absolute', top: 5, left: '95%', zIndex: 100,
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 12, padding: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.3)', width: 220
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Seleziona Turno</div>
          <button onClick={(e) => { e.stopPropagation(); setActiveCell(null); }} style={{ background: 'none', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer' }}><X size={14} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
          {templates.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '10px 0' }}>Nessun template.</div>
          ) : (
            templates.map(t => (
              <button key={t.id} onClick={() => applyTemplate(empId, dateStr, t)} style={{
                display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-bg)',
                border: '1px solid var(--color-border)', padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                textAlign: 'left', transition: 'all 0.1s'
              }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--color-bg)'}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.color || '#10B981' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{t.start_time} - {t.end_time}</div>
                </div>
              </button>
            ))
          )}
        </div>

        <div style={{ height: 1, background: 'var(--color-border)', margin: '10px 0' }} />
        
        <button onClick={() => clearCell(empId, dateStr)} style={{
          display: 'flex', alignItems: 'center', gap: 6, color: '#EF4444', background: 'rgba(239, 68, 68, 0.1)',
          border: 'none', width: '100%', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700
        }}>
          <Trash size={14} /> Cancella Turno (Riposo)
        </button>
      </div>
    );
  };

  if (!storeId) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        <CalendarIcon size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
        <h2>Seleziona un negozio</h2>
        <p>Devi selezionare un punto vendita dalla barra in alto per gestire i turni.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <CalendarIcon size={24} color="var(--color-accent)" /> 
            Pianificazione Turni
          </h1>
          <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
            Gestisci orari e turnazioni della settimana per il negozio selezionato. I riposi corrispondono semplicemente all'assenza di un turno per quella giornata.
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            onClick={() => setShowTemplatesModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', padding: '10px 16px', borderRadius: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            <Clock size={16} /> Modelli Orari (Template)
          </button>
          <button 
            onClick={saveChanges} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-accent)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.8 : 1 }}
          >
            {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />} 
            Salva Configurazioni
          </button>
        </div>
      </div>

      {/* Controller Settimana */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', padding: '16px 24px', borderRadius: '16px 16px 0 0', border: '1px solid var(--color-border)', borderBottom: 'none' }}>
        <button onClick={handlePrevWeek} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={20} />
        </button>
        
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text)' }}>
          Settimana dal {weekDays[0].dateStr.split('-').reverse().join('/')} al {weekDays[6].dateStr.split('-').reverse().join('/')}
        </div>

        <button onClick={handleNextWeek} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Grid Calendario */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0 0 16px 16px', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 1000, borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr>
              <th style={{ padding: '16px 20px', borderBottom: '2px solid var(--color-border)', borderRight: '1px solid var(--color-border)', width: 220, background: 'var(--color-bg)' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dipendente</div>
              </th>
              {weekDays.map(day => (
                <th key={day.dateStr} style={{ padding: '12px 8px', borderBottom: '2px solid var(--color-border)', borderRight: '1px solid var(--color-border)', textAlign: 'center', width: `${100/7}%`, background: day.isToday ? 'rgba(16, 185, 129, 0.05)' : 'transparent' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: day.isToday ? 'var(--color-accent)' : 'var(--color-text)', textTransform: 'uppercase' }}>
                    {day.label.split(' ')[0]} {/* es LUN */}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: day.isToday ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                    {day.label.split(' ')[1]} {/* es 12 */}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 60, textAlign: 'center' }}><Loader size={32} className="animate-spin" style={{ color: 'var(--color-accent)' }} /></td></tr>
            ) : employees.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Nessun dipendente trovato in questo negozio.</td></tr>
            ) : (
              employees.map(emp => (
                <tr key={emp.id}>
                  {/* Cella Dipendente */}
                  <td style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'var(--color-text)' }}>
                        {emp.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--color-text)' }}>{emp.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', textTransform: 'capitalize' }}>{emp.role || 'Operatore'}</div>
                      </div>
                    </div>
                  </td>

                  {/* Celle Giorni */}
                  {weekDays.map(day => {
                    const key = `${emp.id}_${day.dateStr}`;
                    const shift = shifts[key];
                    const hasShift = shift && shift.start_time;

                    return (
                      <td 
                        key={day.dateStr} 
                        style={{ padding: '8px', borderBottom: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)', position: 'relative', background: day.isToday ? 'rgba(16, 185, 129, 0.02)' : 'transparent', verticalAlign: 'top' }}
                        onClick={() => setActiveCell({ empId: emp.id, dateStr: day.dateStr })}
                      >
                        {hasShift ? (
                          <div style={{ background: `${shift.color}15`, border: `1px solid ${shift.color}40`, borderLeft: `4px solid ${shift.color}`, borderRadius: 8, padding: '8px', cursor: 'pointer', transition: 'all 0.1s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                              <input type="time" value={shift.start_time || ''} onChange={e => { e.stopPropagation(); onCellChange(emp.id, day.dateStr, { start_time: e.target.value }); }} style={{ flex: 1, width: 0, padding: '4px', fontSize: 12, fontWeight: 700, border: 'none', background: 'transparent', outline: 'none', color: 'var(--color-text)' }} />
                              <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>-</span>
                              <input type="time" value={shift.end_time || ''} onChange={e => { e.stopPropagation(); onCellChange(emp.id, day.dateStr, { end_time: e.target.value }); }} style={{ flex: 1, width: 0, padding: '4px', fontSize: 12, fontWeight: 700, border: 'none', background: 'transparent', outline: 'none', color: 'var(--color-text)' }} />
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', textAlign: 'center', fontWeight: 600 }}>CARTA TURNO (click p. opzioni)</div>
                          </div>
                        ) : (
                          <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--color-border)', borderRadius: 8, color: 'var(--color-text-tertiary)', fontSize: 12, cursor: 'pointer', transition: 'all 0.1s' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg)'; e.currentTarget.style.color = 'var(--color-text)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}>
                            + Assegna (Riposo)
                          </div>
                        )}

                        {/* Menu testuale (solo quando cliccato) */}
                        {renderCellMenu(emp.id, day.dateStr)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showTemplatesModal && (
        <ShiftTemplateModal onClose={() => {
          setShowTemplatesModal(false);
          // Ricarica templates alla chiusura se necessario (sono caricati all'avvio in loadData)
          loadData(); 
        }} />
      )}

    </div>
  );
}
