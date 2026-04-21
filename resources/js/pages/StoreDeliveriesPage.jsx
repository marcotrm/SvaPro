import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { stores as storesApi } from '../api.jsx';
import { toast } from 'react-hot-toast';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
  pending:    { label: 'In Attesa',    bg: '#FEF3C7', color: '#92400E', dot: '#F59E0B' },
  confirmed:  { label: 'Confermato',   bg: '#DBEAFE', color: '#1E40AF', dot: '#3B82F6' },
  delivering: { label: 'In Consegna', bg: '#F0FDF4', color: '#166534', dot: '#22C55E' },
  done:       { label: 'Consegnato',   bg: '#D1FAE5', color: '#065F46', dot: '#10B981' },
  issue:      { label: 'Problema',     bg: '#FEE2E2', color: '#991B1B', dot: '#EF4444' },
};

const DAYS = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
const LS_TEMPLATE = 'svapro_del_template_v3';
const LS_WEEKS    = 'svapro_del_weeks_v3';

function getWeekKey(date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Mon
  return d.toISOString().slice(0,10);
}

function getMondayOf(weekKey) {
  return new Date(weekKey + 'T00:00:00');
}

function loadWeeks() {
  try { return JSON.parse(localStorage.getItem(LS_WEEKS) || '{}'); } catch { return {}; }
}
function saveWeeks(w) { localStorage.setItem(LS_WEEKS, JSON.stringify(w)); }

function loadTemplate() {
  try { return JSON.parse(localStorage.getItem(LS_TEMPLATE) || 'null'); } catch { return null; }
}
function saveTemplate(t) { localStorage.setItem(LS_TEMPLATE, JSON.stringify(t)); }

// Crea una settimana vuota (7 giorni, array vuoto per ogni giorno)
function emptyWeek() {
  return DAYS.reduce((acc, _, i) => { acc[i] = []; return acc; }, {});
}

// Applica il template a una settimana vuota
function applyTemplate(template) {
  if (!template) return emptyWeek();
  return DAYS.reduce((acc, _, i) => {
    acc[i] = (template[i] || []).map(s => ({ ...s, status: 'pending', id: `${s.storeId}_${i}_${Date.now()}_${Math.random()}` }));
    return acc;
  }, {});
}

export default function StoreDeliveriesPage() {
  const { selectedStoreId } = useOutletContext?.() || {};
  const [storesList, setStoresList] = useState([]);
  const [weekKey, setWeekKey] = useState(() => getWeekKey(new Date()));
  const [allWeeks, setAllWeeks] = useState(loadWeeks);
  const [template, setTemplate] = useState(loadTemplate);

  // Il dato della settimana corrente
  const weekData = allWeeks[weekKey] || null;
  const [days, setDays] = useState(() => weekData || applyTemplate(template));

  // Picker negozio per aggiungere
  const [addingDay, setAddingDay] = useState(null);
  const [newStoreId, setNewStoreId] = useState('');

  // Drag state
  const drag = useRef({ item: null, fromDay: null, fromIdx: null, type: null });

  // Carica negozi
  useEffect(() => {
    storesApi.getStores().then(r => setStoresList(r.data?.data || [])).catch(() => {});
  }, []);

  // Quando cambia settimana, carica o inizializza
  useEffect(() => {
    const saved = allWeeks[weekKey];
    if (saved) {
      setDays(saved);
    } else {
      const initial = applyTemplate(template);
      setDays(initial);
    }
  }, [weekKey]);

  // Salva ogni volta che days cambia
  useEffect(() => {
    const updated = { ...allWeeks, [weekKey]: days };
    setAllWeeks(updated);
    saveWeeks(updated);
  }, [days]);

  const storeName = (id) => storesList.find(s => String(s.id) === String(id))?.name || `Store ${id}`;

  // ── Salva come template ──
  const handleSaveAsTemplate = () => {
    const tpl = DAYS.reduce((acc, _, i) => {
      acc[i] = days[i].map(s => ({ storeId: s.storeId, storeName: s.storeName }));
      return acc;
    }, {});
    setTemplate(tpl);
    saveTemplate(tpl);
    toast.success('Template settimanale salvato! Verrà applicato a tutte le nuove settimane.');
  };

  // ── Aggiungi store a un giorno ──
  const handleAdd = (dayIdx) => {
    if (!newStoreId) return;
    const store = storesList.find(s => String(s.id) === String(newStoreId));
    const entry = {
      id: `${newStoreId}_${dayIdx}_${Date.now()}`,
      storeId: String(newStoreId),
      storeName: store?.name || `Store ${newStoreId}`,
      status: 'pending',
      priority: (days[dayIdx]?.length || 0) + 1,
      note: '',
    };
    setDays(prev => ({ ...prev, [dayIdx]: [...(prev[dayIdx] || []), entry] }));
    setAddingDay(null);
    setNewStoreId('');
  };

  // ── Rimuovi store ──
  const handleRemove = (dayIdx, itemId) => {
    setDays(prev => ({
      ...prev,
      [dayIdx]: prev[dayIdx].filter(s => s.id !== itemId),
    }));
  };

  // ── Cambia status ──
  const handleStatus = (dayIdx, itemId, newStatus) => {
    setDays(prev => ({
      ...prev,
      [dayIdx]: prev[dayIdx].map(s => s.id === itemId ? { ...s, status: newStatus } : s),
    }));
  };

  // ── Drag: orizzontale (tra giorni) ──
  const onDragStart = (e, dayIdx, idx, item) => {
    drag.current = { item, fromDay: dayIdx, fromIdx: idx, type: 'move' };
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDropDay = (e, toDayIdx) => {
    e.preventDefault();
    const { item, fromDay, fromIdx } = drag.current;
    if (item === null) return;
    if (fromDay === toDayIdx) return; // gestito da onDropItem
    setDays(prev => {
      const from = [...(prev[fromDay] || [])];
      const to   = [...(prev[toDayIdx] || [])];
      from.splice(fromIdx, 1);
      to.push({ ...item, status: 'pending' });
      return { ...prev, [fromDay]: from, [toDayIdx]: to };
    });
    drag.current = { item: null, fromDay: null, fromIdx: null };
  };

  // ── Drag: verticale (priorità dentro lo stesso giorno) ──
  const onDropItem = (e, toDayIdx, toIdx) => {
    e.preventDefault();
    e.stopPropagation();
    const { item, fromDay, fromIdx } = drag.current;
    if (item === null) return;
    setDays(prev => {
      const fromList = [...(prev[fromDay] || [])];
      const toList   = fromDay === toDayIdx ? fromList : [...(prev[toDayIdx] || [])];
      fromList.splice(fromIdx, 1);
      if (fromDay === toDayIdx) {
        fromList.splice(toIdx, 0, item);
        return { ...prev, [fromDay]: fromList };
      } else {
        toList.splice(toIdx, 0, { ...item, status: 'pending' });
        return { ...prev, [fromDay]: fromList, [toDayIdx]: toList };
      }
    });
    drag.current = { item: null, fromDay: null, fromIdx: null };
  };

  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  // ── Navigazione settimana ──
  const prevWeek = () => {
    const d = new Date(weekKey + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    setWeekKey(getWeekKey(d));
  };
  const nextWeek = () => {
    const d = new Date(weekKey + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    setWeekKey(getWeekKey(d));
  };

  const monday = getMondayOf(weekKey);
  const weekLabel = monday.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });

  // ── Colore link corriere ──
  const corriereColor = (status) => STATUS[status]?.dot || '#6B7280';

  const C = {
    bg: '#F5F7FA', surface: '#FFFFFF', border: '#E8ECF0',
    text: '#1A202C', muted: '#94A3B8', accent: '#6366F1',
    success: '#10B981', danger: '#EF4444', gold: '#F59E0B',
  };

  return (
    <div style={{ padding: '24px 28px', minHeight: '100vh', background: C.bg, fontFamily: "'Inter', sans-serif" }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.text }}>🚚 Consegna Negozi</h1>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            Settimana del {weekLabel}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Navigazione settimana */}
          <button onClick={prevWeek} style={btnStyle(C)}>&larr; Prec.</button>
          <button onClick={() => setWeekKey(getWeekKey(new Date()))} style={btnStyle(C, true)}>Oggi</button>
          <button onClick={nextWeek} style={btnStyle(C)}>Succ. &rarr;</button>
          <div style={{ width: 1, height: 24, background: C.border, margin: '0 4px' }} />
          <button onClick={handleSaveAsTemplate} style={{ ...btnStyle(C), background: C.accent, color: '#fff', border: 'none' }}>
            💾 Salva come Template
          </button>
          {template && (
            <button onClick={() => {
              if (confirm('Applicare il template a questa settimana? I dati esistenti saranno sostituiti.')) {
                setDays(applyTemplate(template));
              }
            }} style={btnStyle(C)}>
              📋 Applica Template
            </button>
          )}
        </div>
      </div>

      {/* ── Legenda stati ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(STATUS).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: v.bg, border: `1px solid ${v.dot}22` }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: v.dot }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: v.color }}>{v.label}</span>
          </div>
        ))}
        <div style={{ fontSize: 11, color: C.muted, alignSelf: 'center', marginLeft: 8 }}>
          Trascina per spostare tra giorni · Trascina su/giù per priorità
        </div>
      </div>

      {/* ── Colonne giorni ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, minHeight: 400 }}>
        {DAYS.map((dayName, dayIdx) => {
          const dayDate = new Date(monday);
          dayDate.setDate(dayDate.getDate() + dayIdx);
          const dateLabel = dayDate.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
          const isToday = getWeekKey(new Date()) === weekKey &&
            new Date().getDay() === (dayIdx + 1) % 7;
          const dayItems = days[dayIdx] || [];

          return (
            <div
              key={dayIdx}
              onDragOver={onDragOver}
              onDrop={e => onDropDay(e, dayIdx)}
              style={{
                background: C.surface,
                border: `2px solid ${isToday ? C.accent : C.border}`,
                borderRadius: 14,
                minHeight: 200,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Header giorno */}
              <div style={{
                padding: '10px 12px',
                background: isToday ? `${C.accent}15` : '#F8FAFC',
                borderBottom: `1px solid ${C.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 12, color: isToday ? C.accent : C.text }}>{dayName}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{dateLabel}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {dayItems.length > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: C.accent + '20', color: C.accent, borderRadius: 10, padding: '1px 6px' }}>
                      {dayItems.length}
                    </span>
                  )}
                  <button
                    onClick={() => { setAddingDay(dayIdx); setNewStoreId(''); }}
                    style={{ width: 20, height: 20, borderRadius: '50%', border: 'none', background: C.accent, color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}
                    title="Aggiungi negozio"
                  >+</button>
                </div>
              </div>

              {/* Picker aggiungi */}
              {addingDay === dayIdx && (
                <div style={{ padding: '8px 10px', background: '#F0F4FF', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select
                    autoFocus
                    value={newStoreId}
                    onChange={e => setNewStoreId(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAdd(dayIdx); if (e.key === 'Escape') setAddingDay(null); }}
                    style={{ flex: 1, padding: '5px 8px', borderRadius: 7, border: `1px solid ${C.accent}`, fontSize: 12, outline: 'none' }}
                  >
                    <option value="">— Negozio —</option>
                    {storesList.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button onClick={() => handleAdd(dayIdx)} style={{ padding: '4px 10px', borderRadius: 7, border: 'none', background: C.accent, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓</button>
                  <button onClick={() => setAddingDay(null)} style={{ padding: '4px 8px', borderRadius: 7, border: 'none', background: '#EEF2FF', color: C.muted, fontSize: 11, cursor: 'pointer' }}>✕</button>
                </div>
              )}

              {/* Items */}
              <div style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
                {dayItems.map((item, idx) => {
                  const st = STATUS[item.status] || STATUS.pending;
                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={e => onDragStart(e, dayIdx, idx, item)}
                      onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={e => onDropItem(e, dayIdx, idx)}
                      style={{
                        background: st.bg,
                        border: `1.5px solid ${st.dot}55`,
                        borderLeft: `4px solid ${st.dot}`,
                        borderRadius: 9,
                        padding: '7px 9px',
                        cursor: 'grab',
                        userSelect: 'none',
                        transition: 'box-shadow 0.15s',
                        position: 'relative',
                      }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                    >
                      {/* Priorità */}
                      <div style={{ position: 'absolute', top: 5, right: 7, fontSize: 9, fontWeight: 900, color: st.color, opacity: 0.6 }}>
                        #{idx + 1}
                      </div>

                      {/* Nome negozio */}
                      <div style={{ fontWeight: 800, fontSize: 11, color: st.color, paddingRight: 16, lineHeight: 1.3 }}>
                        {item.storeName}
                      </div>

                      {/* Status selector */}
                      <select
                        value={item.status}
                        onChange={e => handleStatus(dayIdx, item.id, e.target.value)}
                        onClick={e => e.stopPropagation()}
                        style={{
                          marginTop: 5,
                          width: '100%',
                          padding: '3px 5px',
                          borderRadius: 5,
                          border: `1px solid ${st.dot}55`,
                          background: '#fff',
                          fontSize: 10,
                          fontWeight: 700,
                          color: st.color,
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        {Object.entries(STATUS).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>

                      {/* Link corriere (visivo) */}
                      {(item.status === 'delivering' || item.status === 'confirmed') && (
                        <div style={{ marginTop: 4, fontSize: 9, fontWeight: 700, color: st.dot, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot, animation: 'pulse 1.5s infinite' }} />
                          {item.status === 'delivering' ? 'In rotta' : 'Pronto'}
                        </div>
                      )}

                      {/* Rimuovi */}
                      <button
                        onClick={e => { e.stopPropagation(); handleRemove(dayIdx, item.id); }}
                        style={{ position: 'absolute', top: 20, right: 5, background: 'none', border: 'none', cursor: 'pointer', color: st.color, opacity: 0.4, fontSize: 12, padding: 2, lineHeight: 1 }}
                        title="Rimuovi"
                      >×</button>
                    </div>
                  );
                })}

                {dayItems.length === 0 && (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CBD5E1', fontSize: 11, fontStyle: 'italic', minHeight: 60 }}>
                    Nessuna consegna
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}

function btnStyle(C, active = false) {
  return {
    padding: '7px 14px',
    borderRadius: 9,
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? `${C.accent}15` : '#fff',
    color: active ? C.accent : C.text,
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
    transition: 'all 0.15s',
  };
}
