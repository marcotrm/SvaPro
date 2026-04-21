import React, { useState, useEffect, useRef } from 'react';
import { Truck, Plus, Check, ChevronLeft, ChevronRight, X, Save, Copy } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { stores } from '../api.jsx';

const LS_TPL  = 'svapro_del_tpl_v4';
const LS_DATA = 'svapro_del_data_v4';
const DAYS    = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
const DAYS_SH = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

function getMonday(d) {
  const dt = new Date(d); const day = dt.getDay();
  dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day));
  dt.setHours(0,0,0,0); return dt;
}
function addDays(d, n) { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt; }
function toISO(d) { return d.toISOString().slice(0,10); }
function fmtDay(d) { return d.toLocaleDateString('it-IT', { day:'2-digit', month:'short' }); }
function uid() { return `d_${Date.now()}_${Math.random().toString(36).slice(2,6)}`; }

function loadData() { try { return JSON.parse(localStorage.getItem(LS_DATA)||'{}'); } catch { return {}; } }
function saveData(d) { localStorage.setItem(LS_DATA, JSON.stringify(d)); }
function loadTpl()  { try { return JSON.parse(localStorage.getItem(LS_TPL)||'null'); } catch { return null; } }
function saveTpl(t) { localStorage.setItem(LS_TPL, JSON.stringify(t)); }

// Crea settimana vuota: { 0:[], 1:[], ... 6:[] }
function emptyWeek() { return Object.fromEntries(DAYS.map((_,i) => [i, []])); }
function applyTpl(tpl) {
  if (!tpl) return emptyWeek();
  const w = emptyWeek();
  DAYS.forEach((_, i) => {
    w[i] = (tpl[i]||[]).map(s => ({ ...s, id: uid(), status: 'pending' }));
  });
  return w;
}

const STATUS_COLORS = {
  pending:   { bg:'#FEF3C7', border:'#F59E0B', text:'#92400E', label:'In Attesa' },
  confirmed: { bg:'#DBEAFE', border:'#3B82F6', text:'#1E40AF', label:'Confermato' },
  delivering:{ bg:'#F0FDF4', border:'#22C55E', text:'#166534', label:'In Consegna' },
  done:      { bg:'#D1FAE5', border:'#10B981', text:'#065F46', label:'Consegnato' },
  issue:     { bg:'#FEE2E2', border:'#EF4444', text:'#991B1B', label:'Problema' },
};
const STATUS_KEYS = Object.keys(STATUS_COLORS);

export default function StoreDeliveriesPage() {
  const [storeList, setStoreList] = useState([]);
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const weekKey = toISO(weekStart);
  const [allData, setAllData] = useState(loadData);
  const [template, setTemplate] = useState(loadTpl);

  // Settimana corrente
  const [days, setDays] = useState(() => allData[weekKey] || applyTpl(template));

  // Picker per aggiungere negozio
  const [addingDay, setAddingDay] = useState(null);
  const [pickStore, setPickStore] = useState('');

  // Drag state
  const dragRef = useRef(null); // { item, fromDay, fromIdx }

  useEffect(() => {
    stores.getAll?.().then(r => setStoreList(r.data?.data || r.data || [])).catch(() => {});
  }, []);

  // Quando cambia settimana, carica o applica template
  useEffect(() => {
    const saved = allData[weekKey];
    if (saved) { setDays(saved); }
    else { const fresh = applyTpl(template); setDays(fresh); }
  }, [weekKey]);

  // Salva automaticamente
  useEffect(() => {
    const updated = { ...allData, [weekKey]: days };
    setAllData(updated); saveData(updated);
  }, [days]);

  // ── Aggiungi negozio a giorno ──
  const handleAdd = (dayIdx) => {
    if (!pickStore) return;
    const s = storeList.find(x => String(x.id) === pickStore);
    const entry = { id: uid(), storeId: pickStore, storeName: s?.name || `Store ${pickStore}`, status: 'pending' };
    setDays(prev => ({ ...prev, [dayIdx]: [...(prev[dayIdx]||[]), entry] }));
    setAddingDay(null); setPickStore('');
  };

  // ── Rimuovi ──
  const handleRemove = (dayIdx, itemId) => {
    setDays(prev => ({ ...prev, [dayIdx]: prev[dayIdx].filter(x => x.id !== itemId) }));
  };

  // ── Cambia status (ciclo) ──
  const cycleStatus = (dayIdx, itemId) => {
    setDays(prev => ({
      ...prev,
      [dayIdx]: prev[dayIdx].map(x => {
        if (x.id !== itemId) return x;
        const idx = STATUS_KEYS.indexOf(x.status);
        return { ...x, status: STATUS_KEYS[(idx+1) % STATUS_KEYS.length] };
      }),
    }));
  };

  // ── DnD: tra giorni + verticale per priorità ──
  const onDragStart = (e, dayIdx, idx, item) => {
    dragRef.current = { item, fromDay: dayIdx, fromIdx: idx };
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDropItem = (e, toDayIdx, toIdx) => {
    e.preventDefault(); e.stopPropagation();
    const { item, fromDay, fromIdx } = dragRef.current || {};
    if (!item) return;
    setDays(prev => {
      const from = [...(prev[fromDay]||[])];
      const to   = fromDay === toDayIdx ? from : [...(prev[toDayIdx]||[])];
      from.splice(fromIdx, 1);
      if (fromDay === toDayIdx) { from.splice(toIdx, 0, item); return { ...prev, [fromDay]: from }; }
      to.splice(toIdx, 0, { ...item, status: 'pending' });
      return { ...prev, [fromDay]: from, [toDayIdx]: to };
    });
    dragRef.current = null;
  };
  const onDropDay = (e, toDayIdx) => {
    e.preventDefault();
    const { item, fromDay } = dragRef.current || {};
    if (!item || fromDay === toDayIdx) return;
    setDays(prev => {
      const from = [...(prev[fromDay]||[])];
      const idx = from.findIndex(x => x.id === item.id);
      if (idx < 0) return prev;
      from.splice(idx, 1);
      const to = [...(prev[toDayIdx]||[]), { ...item, status: 'pending' }];
      return { ...prev, [fromDay]: from, [toDayIdx]: to };
    });
    dragRef.current = null;
  };
  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  // ── Template ──
  const handleSaveTpl = () => {
    const tpl = {};
    DAYS.forEach((_, i) => { tpl[i] = (days[i]||[]).map(s => ({ storeId: s.storeId, storeName: s.storeName })); });
    setTemplate(tpl); saveTpl(tpl);
    toast.success('Template salvato! Verrà applicato alle nuove settimane.');
  };
  const handleApplyTpl = () => {
    if (!template) return;
    if (!confirm('Sovrascrivere questa settimana col template?')) return;
    setDays(applyTpl(template));
    toast.success('Template applicato');
  };

  // Navigazione
  const prevWeek = () => setWeekStart(d => addDays(d, -7));
  const nextWeek = () => setWeekStart(d => addDays(d, 7));
  const today    = () => setWeekStart(getMonday(new Date()));
  const todayStr = toISO(new Date());

  const weekLabel = (() => {
    const from = weekStart.toLocaleDateString('it-IT', { day:'2-digit', month:'long' });
    const to   = addDays(weekStart,6).toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });
    return `${from} — ${to}`;
  })();

  return (
    <div style={{ padding:'20px 24px', minHeight:'100vh', background:'var(--color-bg, #F5F7FA)', fontFamily:"'Inter',sans-serif" }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ background:'linear-gradient(135deg,#7B6FD0,#5B50B0)', borderRadius:14, width:46, height:46, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(123,111,208,0.3)', flexShrink:0 }}>
            <Truck size={21} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize:20, fontWeight:900, margin:0, color:'var(--color-text,#1A202C)' }}>Consegne Negozi</h1>
            <p style={{ fontSize:12, color:'var(--color-text-tertiary,#94A3B8)', margin:0 }}>Trascina per spostare · su/giù per priorità · salva template</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={handleSaveTpl} style={btnS()}><Save size={13} /> Salva template</button>
          {template && <button onClick={handleApplyTpl} style={btnS()}><Copy size={13} /> Applica template</button>}
        </div>
      </div>

      {/* Legenda */}
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        {STATUS_KEYS.map(k => { const c = STATUS_COLORS[k]; return (
          <div key={k} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:16, background:c.bg, border:`1px solid ${c.border}22`, fontSize:10, fontWeight:700, color:c.text }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:c.border }} /> {c.label}
          </div>
        ); })}
      </div>

      {/* Navigazione settimana */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:14, marginBottom:20 }}>
        <button onClick={prevWeek} style={navBtn()}><ChevronLeft size={16} /></button>
        <div style={{ fontSize:15, fontWeight:800, minWidth:280, textAlign:'center', color:'var(--color-text,#1A202C)' }}>{weekLabel}</div>
        <button onClick={nextWeek} style={navBtn()}><ChevronRight size={16} /></button>
        <button onClick={today} style={{ ...navBtn(), padding:'5px 12px', fontSize:11, fontWeight:700 }}>Oggi</button>
      </div>

      {/* ── Colonne giorni ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:10, minHeight:400 }}>
        {DAYS.map((dayName, dayIdx) => {
          const dayDate  = addDays(weekStart, dayIdx);
          const dateLabel= fmtDay(dayDate);
          const isToday  = toISO(dayDate) === todayStr;
          const items    = days[dayIdx] || [];

          return (
            <div key={dayIdx}
              onDragOver={onDragOver}
              onDrop={e => onDropDay(e, dayIdx)}
              style={{
                background:'var(--color-surface,#fff)',
                border:`2px solid ${isToday ? '#7B6FD0' : 'var(--color-border,#E8ECF0)'}`,
                borderRadius:14, minHeight:200, display:'flex', flexDirection:'column', overflow:'hidden',
              }}
            >
              {/* Header giorno */}
              <div style={{
                padding:'10px 12px', background: isToday ? 'rgba(123,111,208,0.08)' : '#F8FAFC',
                borderBottom:'1px solid var(--color-border,#E8ECF0)',
                display:'flex', alignItems:'center', justifyContent:'space-between',
              }}>
                <div>
                  <div style={{ fontWeight:900, fontSize:12, color: isToday ? '#7B6FD0' : 'var(--color-text,#1A202C)' }}>{DAYS_SH[dayIdx]}</div>
                  <div style={{ fontSize:10, color:'var(--color-text-tertiary,#94A3B8)' }}>{dateLabel}</div>
                  {isToday && <div style={{ width:5, height:5, borderRadius:'50%', background:'#7B6FD0', marginTop:3 }} />}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  {items.length > 0 && <span style={{ fontSize:10, fontWeight:700, background:'rgba(123,111,208,0.15)', color:'#7B6FD0', borderRadius:10, padding:'1px 6px' }}>{items.length}</span>}
                  <button onClick={() => { setAddingDay(addingDay === dayIdx ? null : dayIdx); setPickStore(''); }}
                    style={{ width:22, height:22, borderRadius:'50%', border:'none', background:'#7B6FD0', color:'#fff', fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1, padding:0, fontWeight:700 }}
                    title="Aggiungi negozio"
                  >+</button>
                </div>
              </div>

              {/* Picker aggiungi */}
              {addingDay === dayIdx && (
                <div style={{ padding:'8px 10px', background:'#F0F4FF', borderBottom:'1px solid var(--color-border,#E8ECF0)', display:'flex', gap:5, alignItems:'center' }}>
                  <select autoFocus value={pickStore} onChange={e => setPickStore(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAdd(dayIdx); if (e.key === 'Escape') setAddingDay(null); }}
                    style={{ flex:1, padding:'5px 6px', borderRadius:7, border:'1px solid #7B6FD0', fontSize:11, outline:'none' }}
                  >
                    <option value="">— Negozio —</option>
                    {storeList.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                  </select>
                  <button onClick={() => handleAdd(dayIdx)} style={{ padding:'3px 8px', borderRadius:6, border:'none', background:'#7B6FD0', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer' }}>✓</button>
                  <button onClick={() => setAddingDay(null)} style={{ padding:'3px 6px', borderRadius:6, border:'none', background:'#EEF2FF', color:'#94A3B8', fontSize:11, cursor:'pointer' }}>✕</button>
                </div>
              )}

              {/* Items */}
              <div style={{ flex:1, padding:6, display:'flex', flexDirection:'column', gap:5, overflowY:'auto' }}>
                {items.map((item, idx) => {
                  const st = STATUS_COLORS[item.status] || STATUS_COLORS.pending;
                  return (
                    <div key={item.id}
                      draggable
                      onDragStart={e => onDragStart(e, dayIdx, idx, item)}
                      onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={e => onDropItem(e, dayIdx, idx)}
                      style={{
                        background: st.bg, border:`1.5px solid ${st.border}55`,
                        borderLeft:`4px solid ${st.border}`, borderRadius:9,
                        padding:'6px 8px', cursor:'grab', userSelect:'none',
                        transition:'box-shadow 0.15s', position:'relative',
                      }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.12)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow='none'}
                    >
                      {/* Priorità # */}
                      <div style={{ position:'absolute', top:4, right:6, fontSize:9, fontWeight:900, color:st.text, opacity:0.5 }}>
                        #{idx+1}
                      </div>
                      {/* Nome */}
                      <div style={{ fontWeight:800, fontSize:11, color:st.text, paddingRight:18, lineHeight:1.3 }}>
                        {item.storeName}
                      </div>
                      {/* Status chip — clicca per ciclare */}
                      <button onClick={() => cycleStatus(dayIdx, item.id)}
                        style={{ marginTop:4, display:'flex', alignItems:'center', gap:3, padding:'2px 6px', borderRadius:10, border:'none', background:`${st.border}20`, color:st.text, fontSize:9, fontWeight:800, cursor:'pointer' }}
                      >
                        <div style={{ width:5, height:5, borderRadius:'50%', background:st.border }} />
                        {st.label}
                      </button>
                      {/* Rimuovi */}
                      <button onClick={() => handleRemove(dayIdx, item.id)}
                        style={{ position:'absolute', top:16, right:5, background:'none', border:'none', cursor:'pointer', color:st.text, opacity:0.3, fontSize:11, padding:1, lineHeight:1 }}
                        title="Rimuovi"
                      >×</button>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#CBD5E1', fontSize:11, fontStyle:'italic', minHeight:50 }}>
                    Nessuna consegna
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function btnS() {
  return { display:'flex', alignItems:'center', gap:5, padding:'7px 13px', borderRadius:9, border:'1px solid rgba(123,111,208,0.4)', background:'rgba(123,111,208,0.08)', color:'#7B6FD0', fontWeight:700, fontSize:12, cursor:'pointer' };
}
function navBtn() {
  return { width:34, height:34, borderRadius:10, border:'1px solid var(--color-border,#E8ECF0)', background:'var(--color-surface,#fff)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' };
}
