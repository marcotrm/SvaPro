import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Truck, Plus, ChevronLeft, ChevronRight, Save, Copy, X, GripVertical, Calendar, CheckCircle2, Clock, AlertCircle, XCircle, Package } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { stores } from '../api.jsx';

const LS_TPL  = 'svapro_del_tpl_v5';
const LS_DATA = 'svapro_del_data_v5';
const DAYS    = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
const DAYS_SH = ['LUN','MAR','MER','GIO','VEN','SAB','DOM'];

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

function emptyWeek() { return Object.fromEntries(DAYS.map((_,i) => [i, []])); }
function applyTpl(tpl) {
  if (!tpl) return emptyWeek();
  const w = emptyWeek();
  DAYS.forEach((_, i) => { w[i] = (tpl[i]||[]).map(s => ({ ...s, id: uid(), status: 'pending' })); });
  return w;
}

const STATUSES = {
  pending:    { label:'In Attesa',    color:'#F59E0B', bg:'rgba(245,158,11,0.12)',   icon: Clock },
  confirmed:  { label:'Confermato',   color:'#3B82F6', bg:'rgba(59,130,246,0.12)',   icon: CheckCircle2 },
  delivering: { label:'In Consegna',  color:'#8B5CF6', bg:'rgba(139,92,246,0.12)',   icon: Truck },
  done:       { label:'Consegnato',   color:'#10B981', bg:'rgba(16,185,129,0.12)',   icon: CheckCircle2 },
  issue:      { label:'Problema',     color:'#EF4444', bg:'rgba(239,68,68,0.12)',    icon: AlertCircle },
};
const STATUS_KEYS = Object.keys(STATUSES);

/* ── Palette giorni ── */
const DAY_ACCENTS = ['#6366F1','#8B5CF6','#EC4899','#F59E0B','#10B981','#3B82F6','#EF4444'];

export default function StoreDeliveriesPage() {
  const [storeList, setStoreList]   = useState([]);
  const [weekStart, setWeekStart]   = useState(() => getMonday(new Date()));
  const weekKey = toISO(weekStart);
  const [allData, setAllData]       = useState(loadData);
  const [template, setTemplate]     = useState(loadTpl);
  const [days, setDays]             = useState(() => allData[weekKey] || applyTpl(loadTpl()));
  const [addingDay, setAddingDay]   = useState(null);
  const [pickStore, setPickStore]   = useState('');
  const [dragOver, setDragOver]     = useState(null); // { dayIdx, idx }
  const dragRef = useRef(null);

  useEffect(() => {
    stores.getAll?.().then(r => setStoreList(r.data?.data || r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const saved = allData[weekKey];
    setDays(saved || applyTpl(template));
  }, [weekKey]);

  useEffect(() => {
    const updated = { ...allData, [weekKey]: days };
    setAllData(updated); saveData(updated);
  }, [days]);

  const handleAdd = (dayIdx) => {
    if (!pickStore) return;
    const s = storeList.find(x => String(x.id) === pickStore);
    const entry = { id: uid(), storeId: pickStore, storeName: s?.name || `Store ${pickStore}`, status: 'pending' };
    setDays(prev => ({ ...prev, [dayIdx]: [...(prev[dayIdx]||[]), entry] }));
    setAddingDay(null); setPickStore('');
    toast.success(`${s?.name || 'Negozio'} aggiunto`);
  };

  const handleRemove = (dayIdx, itemId) =>
    setDays(prev => ({ ...prev, [dayIdx]: prev[dayIdx].filter(x => x.id !== itemId) }));

  const cycleStatus = (dayIdx, itemId) =>
    setDays(prev => ({
      ...prev,
      [dayIdx]: prev[dayIdx].map(x => {
        if (x.id !== itemId) return x;
        const idx = STATUS_KEYS.indexOf(x.status);
        return { ...x, status: STATUS_KEYS[(idx+1) % STATUS_KEYS.length] };
      }),
    }));

  /* ── DnD ── */
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
    dragRef.current = null; setDragOver(null);
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
    dragRef.current = null; setDragOver(null);
  };
  const onDragOver = (e, dayIdx, idx) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    setDragOver({ dayIdx, idx: idx ?? -1 });
  };
  const onDragEnd = () => { dragRef.current = null; setDragOver(null); };

  /* ── Template ── */
  const handleSaveTpl = () => {
    const tpl = {};
    DAYS.forEach((_, i) => { tpl[i] = (days[i]||[]).map(s => ({ storeId: s.storeId, storeName: s.storeName })); });
    setTemplate(tpl); saveTpl(tpl);
    toast.success('Template salvato!');
  };
  const handleApplyTpl = () => {
    if (!template) return;
    if (!confirm('Sovrascrivere questa settimana col template?')) return;
    setDays(applyTpl(template)); toast.success('Template applicato');
  };

  const prevWeek = () => setWeekStart(d => addDays(d, -7));
  const nextWeek = () => setWeekStart(d => addDays(d, 7));
  const goToday  = () => setWeekStart(getMonday(new Date()));
  const todayStr = toISO(new Date());

  const weekLabel = (() => {
    const from = weekStart.toLocaleDateString('it-IT', { day:'2-digit', month:'long' });
    const to   = addDays(weekStart,6).toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });
    return `${from} – ${to}`;
  })();

  const totalDeliveries = DAYS.reduce((s,_,i) => s + (days[i]?.length||0), 0);
  const doneDeliveries  = DAYS.reduce((s,_,i) => s + (days[i]||[]).filter(x=>x.status==='done').length, 0);

  return (
    <div style={{ minHeight:'100vh', background:'var(--color-bg,#0F1117)', fontFamily:"'Inter',system-ui,sans-serif", padding:'24px 20px 40px' }}>

      {/* ── HEADER ── */}
      <div style={{ marginBottom:28 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{
              width:52, height:52, borderRadius:16, flexShrink:0,
              background:'linear-gradient(135deg,#6366F1,#8B5CF6)',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 8px 24px rgba(99,102,241,0.4)',
            }}>
              <Truck size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:'var(--color-text,#F1F5F9)', letterSpacing:'-0.5px' }}>
                Consegne Negozi
              </h1>
              <p style={{ margin:'3px 0 0', fontSize:12, color:'var(--color-text-tertiary,#64748B)' }}>
                Trascina per spostare · su/giù per priorità
              </p>
            </div>
          </div>

          {/* Stats pill */}
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 16px', borderRadius:50, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>
              <Package size={14} color="#64748B" />
              <span style={{ fontSize:13, fontWeight:700, color:'var(--color-text,#F1F5F9)' }}>{doneDeliveries}/{totalDeliveries}</span>
              <span style={{ fontSize:11, color:'#64748B' }}>consegnati</span>
            </div>
            <button onClick={handleSaveTpl} style={actionBtn('#6366F1')}>
              <Save size={13} /> Salva template
            </button>
            {template && (
              <button onClick={handleApplyTpl} style={actionBtn('#8B5CF6')}>
                <Copy size={13} /> Applica template
              </button>
            )}
          </div>
        </div>

        {/* ── Legenda status ── */}
        <div style={{ display:'flex', gap:6, marginTop:16, flexWrap:'wrap' }}>
          {STATUS_KEYS.map(k => {
            const s = STATUSES[k];
            const Icon = s.icon;
            return (
              <div key={k} style={{
                display:'flex', alignItems:'center', gap:5,
                padding:'4px 10px', borderRadius:20,
                background:s.bg, border:`1px solid ${s.color}30`,
                fontSize:10, fontWeight:700, color:s.color,
              }}>
                <Icon size={10} /> {s.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── NAVIGAZIONE SETTIMANA ── */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'center', gap:12,
        marginBottom:24, background:'rgba(255,255,255,0.03)',
        border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, padding:'10px 20px',
      }}>
        <button onClick={prevWeek} style={navBtn()}><ChevronLeft size={18} /></button>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Calendar size={15} color="#6366F1" />
          <span style={{ fontSize:15, fontWeight:800, color:'var(--color-text,#F1F5F9)', minWidth:260, textAlign:'center', letterSpacing:'-0.3px' }}>
            {weekLabel}
          </span>
        </div>
        <button onClick={nextWeek} style={navBtn()}><ChevronRight size={18} /></button>
        <button onClick={goToday} style={{ ...navBtn(), padding:'6px 14px', fontSize:11, fontWeight:700, color:'#6366F1', borderColor:'rgba(99,102,241,0.3)', background:'rgba(99,102,241,0.08)' }}>
          Oggi
        </button>
      </div>

      {/* ── GRIGLIA 7 GIORNI ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:10 }}>
        {DAYS.map((dayName, dayIdx) => {
          const dayDate  = addDays(weekStart, dayIdx);
          const isToday  = toISO(dayDate) === todayStr;
          const items    = days[dayIdx] || [];
          const accent   = DAY_ACCENTS[dayIdx];
          const isDragTarget = dragOver?.dayIdx === dayIdx;

          return (
            <div key={dayIdx}
              onDragOver={e => onDragOver(e, dayIdx)}
              onDrop={e => onDropDay(e, dayIdx)}
              onDragEnd={onDragEnd}
              style={{
                borderRadius:18,
                background: isToday
                  ? `linear-gradient(180deg, rgba(99,102,241,0.10) 0%, rgba(255,255,255,0.03) 100%)`
                  : 'rgba(255,255,255,0.03)',
                border: isToday
                  ? `1.5px solid rgba(99,102,241,0.4)`
                  : isDragTarget
                  ? `1.5px solid ${accent}60`
                  : '1.5px solid rgba(255,255,255,0.07)',
                display:'flex', flexDirection:'column',
                minHeight:320, overflow:'hidden',
                transition:'border-color 0.2s, box-shadow 0.2s',
                boxShadow: isDragTarget ? `0 0 0 3px ${accent}20` : 'none',
              }}
            >
              {/* Header giorno */}
              <div style={{
                padding:'12px 14px 10px',
                borderBottom: `1px solid rgba(255,255,255,0.06)`,
                background: isToday ? `rgba(99,102,241,0.08)` : 'transparent',
              }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:3, height:16, borderRadius:2, background:accent }} />
                      <span style={{ fontWeight:900, fontSize:11, color: isToday ? accent : 'var(--color-text,#F1F5F9)', letterSpacing:'0.5px' }}>
                        {DAYS_SH[dayIdx]}
                      </span>
                    </div>
                    <div style={{ fontSize:10, color:'#64748B', marginTop:2, paddingLeft:9 }}>
                      {fmtDay(dayDate)}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    {items.length > 0 && (
                      <span style={{ fontSize:10, fontWeight:800, background:`${accent}20`, color:accent, borderRadius:10, padding:'2px 7px', border:`1px solid ${accent}30` }}>
                        {items.length}
                      </span>
                    )}
                    <button
                      onClick={() => { setAddingDay(addingDay === dayIdx ? null : dayIdx); setPickStore(''); }}
                      title="Aggiungi negozio"
                      style={{
                        width:24, height:24, borderRadius:8, border:'none',
                        background: addingDay === dayIdx ? accent : `${accent}20`,
                        color: addingDay === dayIdx ? '#fff' : accent,
                        fontSize:16, cursor:'pointer', display:'flex', alignItems:'center',
                        justifyContent:'center', fontWeight:700, lineHeight:1, padding:0,
                        transition:'all 0.15s',
                      }}
                    >
                      {addingDay === dayIdx ? '×' : '+'}
                    </button>
                  </div>
                </div>

                {/* Picker aggiungi */}
                {addingDay === dayIdx && (
                  <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:5 }}>
                    <select
                      autoFocus
                      value={pickStore}
                      onChange={e => setPickStore(e.target.value)}
                      onKeyDown={e => { if (e.key==='Enter') handleAdd(dayIdx); if (e.key==='Escape') setAddingDay(null); }}
                      style={{
                        width:'100%', padding:'6px 8px', borderRadius:8,
                        border:`1px solid ${accent}40`, fontSize:11, outline:'none',
                        background:'rgba(0,0,0,0.3)', color:'var(--color-text,#F1F5F9)',
                      }}
                    >
                      <option value="">— Seleziona negozio —</option>
                      {storeList.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                    </select>
                    <button
                      onClick={() => handleAdd(dayIdx)}
                      disabled={!pickStore}
                      style={{
                        padding:'6px', borderRadius:8, border:'none',
                        background: pickStore ? accent : 'rgba(255,255,255,0.05)',
                        color: pickStore ? '#fff' : '#64748B',
                        fontSize:11, fontWeight:700, cursor: pickStore ? 'pointer' : 'default',
                        transition:'all 0.15s',
                      }}
                    >
                      + Aggiungi
                    </button>
                  </div>
                )}
              </div>

              {/* Items */}
              <div style={{ flex:1, padding:'8px 8px', display:'flex', flexDirection:'column', gap:5, overflowY:'auto' }}>
                {items.map((item, idx) => {
                  const st = STATUSES[item.status] || STATUSES.pending;
                  const Icon = st.icon;
                  const isBeingDragged = dragRef.current?.item?.id === item.id;
                  const isDropTarget = dragOver?.dayIdx === dayIdx && dragOver?.idx === idx;

                  return (
                    <React.Fragment key={item.id}>
                      {/* Drop indicator */}
                      {isDropTarget && (
                        <div style={{ height:3, borderRadius:2, background:`${accent}80`, margin:'0 4px', flexShrink:0 }} />
                      )}
                      <div
                        draggable
                        onDragStart={e => onDragStart(e, dayIdx, idx, item)}
                        onDragOver={e => onDragOver(e, dayIdx, idx)}
                        onDrop={e => onDropItem(e, dayIdx, idx)}
                        style={{
                          background: isBeingDragged ? 'rgba(255,255,255,0.03)' : st.bg,
                          border: `1px solid ${st.color}25`,
                          borderLeft: `3px solid ${st.color}`,
                          borderRadius:10, padding:'8px 8px 7px 10px',
                          cursor:'grab', userSelect:'none',
                          opacity: isBeingDragged ? 0.4 : 1,
                          transition:'opacity 0.15s, box-shadow 0.15s',
                          position:'relative', flexShrink:0,
                        }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow=`0 4px 12px rgba(0,0,0,0.25)`}
                        onMouseLeave={e => e.currentTarget.style.boxShadow='none'}
                      >
                        {/* Priorità */}
                        <div style={{ position:'absolute', top:5, right:22, fontSize:9, fontWeight:900, color:`${st.color}60` }}>
                          #{idx+1}
                        </div>

                        {/* Grip */}
                        <div style={{ position:'absolute', top:'50%', right:5, transform:'translateY(-50%)', color:`${st.color}40` }}>
                          <GripVertical size={11} />
                        </div>

                        {/* Nome negozio */}
                        <div style={{ fontWeight:800, fontSize:11, color:'var(--color-text,#F1F5F9)', paddingRight:20, lineHeight:1.3, marginBottom:5 }}>
                          {item.storeName}
                        </div>

                        {/* Status chip */}
                        <button
                          onClick={() => cycleStatus(dayIdx, item.id)}
                          title="Clicca per cambiare stato"
                          style={{
                            display:'flex', alignItems:'center', gap:4, padding:'2px 7px',
                            borderRadius:12, border:`1px solid ${st.color}30`,
                            background:`${st.color}15`, color:st.color,
                            fontSize:9, fontWeight:800, cursor:'pointer',
                          }}
                        >
                          <Icon size={9} /> {st.label}
                        </button>

                        {/* Rimuovi */}
                        <button
                          onClick={() => handleRemove(dayIdx, item.id)}
                          style={{ position:'absolute', top:5, left:5, background:'none', border:'none', cursor:'pointer', color:`${st.color}40`, padding:0, lineHeight:1, fontSize:12 }}
                          title="Rimuovi"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    </React.Fragment>
                  );
                })}

                {/* Drop zone vuota */}
                {items.length === 0 && (
                  <div style={{
                    flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                    color:'rgba(255,255,255,0.12)', fontSize:10, fontStyle:'italic', minHeight:80, gap:6,
                    border:`1.5px dashed rgba(255,255,255,0.07)`, borderRadius:10, margin:2,
                  }}>
                    <Truck size={18} color="rgba(255,255,255,0.1)" />
                    Nessuna consegna
                  </div>
                )}
              </div>

              {/* Footer con progress bar */}
              {items.length > 0 && (() => {
                const done = items.filter(x=>x.status==='done').length;
                const pct  = Math.round((done/items.length)*100);
                return (
                  <div style={{ padding:'6px 10px 8px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:9, fontWeight:700, color:'#64748B' }}>
                      <span>{done}/{items.length} consegnati</span>
                      <span>{pct}%</span>
                    </div>
                    <div style={{ height:3, borderRadius:2, background:'rgba(255,255,255,0.06)' }}>
                      <div style={{ height:'100%', borderRadius:2, width:`${pct}%`, background: pct===100 ? '#10B981' : accent, transition:'width 0.3s' }} />
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function actionBtn(color) {
  return {
    display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10,
    border:`1px solid ${color}30`, background:`${color}15`, color,
    fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit',
  };
}
function navBtn() {
  return {
    width:36, height:36, borderRadius:10, border:'1px solid rgba(255,255,255,0.08)',
    background:'rgba(255,255,255,0.04)', cursor:'pointer', display:'flex',
    alignItems:'center', justifyContent:'center', color:'var(--color-text,#F1F5F9)',
  };
}
