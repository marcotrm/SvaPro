import React, { useState, useEffect, useRef } from 'react';
import { Truck, Plus, X, ChevronLeft, ChevronRight, ExternalLink, Copy, Circle, CheckCircle2, AlertCircle, GripVertical } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { stores } from '../api.jsx';

/* ── storage ── */
const SK = 'svapro_del_v2';
const load = () => { try { return JSON.parse(localStorage.getItem(SK) || '{}'); } catch { return {}; } };
const save = (d) => localStorage.setItem(SK, JSON.stringify(d));
const uid  = () => `d${Date.now()}${Math.random().toString(36).slice(2,5)}`;

/* ── date helpers ── */
const DAYS = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
const SH   = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

function monday(d) {
  const dt = new Date(d); const day = dt.getDay();
  dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day)); dt.setHours(0,0,0,0); return dt;
}
function addDays(d, n) { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt; }
function iso(d) { return d.toISOString().slice(0,10); }
function fmtDay(d) { return d.toLocaleDateString('it-IT', { day:'2-digit', month:'short' }); }

/* ── status ── */
const ST = {
  pending:     { label:'Da fare',    color:'#F59E0B', bg:'rgba(245,158,11,0.13)',  Icon: Circle },
  in_progress: { label:'In corso',  color:'#3B82F6', bg:'rgba(59,130,246,0.13)',  Icon: Truck },
  done:        { label:'Consegnato',color:'#10B981', bg:'rgba(16,185,129,0.13)',  Icon: CheckCircle2 },
  issue:       { label:'Problema',  color:'#EF4444', bg:'rgba(239,68,68,0.13)',   Icon: AlertCircle },
};
const CYCLE = ['pending','in_progress','done','issue'];

/* ── store chip color ── */
const chipColor = (name='') => `hsl(${([...name].reduce((a,c)=>a+c.charCodeAt(0),0)*47)%360},55%,52%)`;

/* ──────────────────────────────────────────────────────────── */
export default function StoreDeliveriesPage() {
  const [data,      setData]      = useState(load);     // { [dateStr]: [{ id, storeId, storeName, status }] }
  const [storeList, setStoreList] = useState([]);
  const [weekStart, setWeekStart] = useState(() => monday(new Date()));
  const [picker,    setPicker]    = useState(null);     // dateStr | null
  const [pickerQ,   setPickerQ]   = useState('');
  const [dragId,    setDragId]    = useState(null);     // { id, fromDate }
  const [dragOver,  setDragOver]  = useState(null);     // dateStr
  const pickerRef = useRef();

  useEffect(() => {
    stores.getAll?.().then(r => setStoreList(r.data?.data || r.data || [])).catch(() => {});
  }, []);

  /* close picker on outside click */
  useEffect(() => {
    if (!picker) return;
    const h = e => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setPicker(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [picker]);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return { dateStr: iso(d), label: DAYS[i], short: SH[i], display: fmtDay(d), date: d };
  });

  const todayStr = iso(new Date());
  const fmtRange = () => {
    const f = weekDays[0].date.toLocaleDateString('it-IT', { day:'2-digit', month:'long' });
    const t = weekDays[6].date.toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });
    return `${f} — ${t}`;
  };

  /* persist */
  const persist = d => { setData(d); save(d); };

  /* add store to day */
  const addStore = (dateStr, storeId, storeName) => {
    const existing = (data[dateStr] || []);
    if (existing.some(x => x.storeId === storeId)) {
      toast.error('Negozio già assegnato a questo giorno'); return;
    }
    const next = { ...data, [dateStr]: [...existing, { id: uid(), storeId, storeName, status: 'pending' }] };
    persist(next);
    setPicker(null); setPickerQ('');
    toast.success(`✅ ${storeName} → ${weekDays.find(d=>d.dateStr===dateStr)?.short}`);
  };

  /* remove */
  const removeItem = (dateStr, id) => {
    const next = { ...data, [dateStr]: (data[dateStr]||[]).filter(x => x.id !== id) };
    persist(next);
  };

  /* cycle status */
  const cycleStatus = (dateStr, id) => {
    const next = { ...data, [dateStr]: (data[dateStr]||[]).map(x =>
      x.id === id ? { ...x, status: CYCLE[(CYCLE.indexOf(x.status)+1)%CYCLE.length] } : x
    )};
    persist(next);
  };

  /* drag & drop */
  const onDragStart = (e, id, fromDate) => {
    setDragId({ id, fromDate });
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDrop = (e, toDate) => {
    e.preventDefault(); setDragOver(null);
    if (!dragId || dragId.fromDate === toDate) { setDragId(null); return; }
    const { id, fromDate } = dragId;
    const item = (data[fromDate]||[]).find(x => x.id === id);
    if (!item) { setDragId(null); return; }
    if ((data[toDate]||[]).some(x => x.storeId === item.storeId)) {
      toast.error('Negozio già presente in quel giorno'); setDragId(null); return;
    }
    const next = {
      ...data,
      [fromDate]: (data[fromDate]||[]).filter(x => x.id !== id),
      [toDate]:   [...(data[toDate]||[]), { ...item }],
    };
    persist(next);
    setDragId(null);
    toast.success(`Spostato in ${weekDays.find(d=>d.dateStr===toDate)?.short}`);
  };

  /* copy from previous week */
  const copyPrevWeek = () => {
    let copied = 0;
    const next = { ...data };
    weekDays.forEach((day, i) => {
      const prevDate = iso(addDays(weekStart, i - 7));
      const prevItems = data[prevDate] || [];
      if (prevItems.length === 0) return;
      const existing = data[day.dateStr] || [];
      const toAdd = prevItems.filter(p => !existing.some(e => e.storeId === p.storeId))
                             .map(p => ({ ...p, id: uid(), status: 'pending' }));
      if (toAdd.length) { next[day.dateStr] = [...existing, ...toAdd]; copied += toAdd.length; }
    });
    if (copied === 0) { toast.error('Nessuna consegna nella settimana precedente'); return; }
    persist(next);
    toast.success(`✅ ${copied} consegne copiate dalla settimana scorsa`);
  };

  /* filtered store list for picker */
  const pickerStores = storeList.filter(s =>
    !pickerQ || (s.name||'').toLowerCase().includes(pickerQ.toLowerCase())
  );

  return (
    <div style={{ padding: '20px 24px', display:'flex', flexDirection:'column', gap:18, height:'100%', boxSizing:'border-box' }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ background:'linear-gradient(135deg,#7B6FD0,#5B50B0)', borderRadius:14, width:46, height:46, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(123,111,208,0.3)', flexShrink:0 }}>
            <Truck size={21} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize:20, fontWeight:900, margin:0 }}>Consegne Negozi</h1>
            <p style={{ fontSize:12, color:'var(--color-text-tertiary)', margin:0 }}>Piano settimanale — trascina i negozi tra i giorni</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={copyPrevWeek} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:10, border:'1px solid var(--color-border)', background:'var(--color-surface)', color:'var(--color-text-secondary)', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            <Copy size={12}/> Copia sett. prec.
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.25)', borderRadius:10 }}>
            <ExternalLink size={12} color="#10B981"/>
            <span style={{ fontSize:11, fontWeight:700, color:'#10B981' }}>Vista Corriere</span>
            <button onClick={() => { navigator.clipboard?.writeText(window.location.origin+'/deliveries/driver'); toast.success('Link copiato!'); }} style={{ background:'none', border:'none', cursor:'pointer', color:'#10B981', display:'flex', padding:0 }} title="Copia link"><Copy size={12}/></button>
            <button onClick={() => window.open('/deliveries/driver','_blank')} style={{ background:'none', border:'none', cursor:'pointer', color:'#10B981', display:'flex', padding:0 }}><ExternalLink size={12}/></button>
          </div>
        </div>
      </div>

      {/* ── Navigazione settimana ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:16 }}>
        <button onClick={() => setWeekStart(d => addDays(d,-7))} style={{ width:34, height:34, borderRadius:10, border:'1px solid var(--color-border)', background:'var(--color-surface)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <ChevronLeft size={18}/>
        </button>
        <div style={{ fontSize:15, fontWeight:800, minWidth:280, textAlign:'center' }}>{fmtRange()}</div>
        <button onClick={() => setWeekStart(d => addDays(d,7))} style={{ width:34, height:34, borderRadius:10, border:'1px solid var(--color-border)', background:'var(--color-surface)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <ChevronRight size={18}/>
        </button>
        <button onClick={() => setWeekStart(monday(new Date()))} style={{ padding:'6px 12px', borderRadius:8, border:'1px solid var(--color-border)', background:'var(--color-surface)', cursor:'pointer', fontSize:11, fontWeight:700, color:'var(--color-text-secondary)' }}>Oggi</button>
      </div>

      {/* ── Colonne giorni ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:10, flex:1, minHeight:0 }}>
        {weekDays.map(day => {
          const isToday  = day.dateStr === todayStr;
          const isOver   = dragOver === day.dateStr;
          const items    = data[day.dateStr] || [];
          const isPicker = picker === day.dateStr;

          return (
            <div
              key={day.dateStr}
              onDragOver={e => { e.preventDefault(); setDragOver(day.dateStr); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => onDrop(e, day.dateStr)}
              style={{
                display:'flex', flexDirection:'column', gap:6,
                background: isOver ? 'rgba(123,111,208,0.08)' : 'var(--color-surface)',
                border:`1.5px solid ${isOver ? '#7B6FD0' : isToday ? '#7B6FD050' : 'var(--color-border)'}`,
                borderRadius:14, padding:10, minHeight:320,
                transition:'border-color 0.15s, background 0.15s',
                position:'relative',
              }}
            >
              {/* header giorno */}
              <div style={{ textAlign:'center', paddingBottom:8, borderBottom:`1px solid ${isToday?'#7B6FD040':'var(--color-border)'}` }}>
                <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', color: isToday?'#7B6FD0':'var(--color-text-tertiary)' }}>{day.short}</div>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--color-text)', marginTop:2 }}>{day.display}</div>
                {isToday && <div style={{ width:6, height:6, borderRadius:3, background:'#7B6FD0', margin:'4px auto 0' }}/>}
              </div>

              {/* chip negozi */}
              <div style={{ display:'flex', flexDirection:'column', gap:5, flex:1, overflowY:'auto' }}>
                {items.map(item => {
                  const st = ST[item.status] || ST.pending;
                  const color = chipColor(item.storeName);
                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={e => onDragStart(e, item.id, day.dateStr)}
                      onDragEnd={() => { setDragId(null); setDragOver(null); }}
                      style={{
                        display:'flex', alignItems:'center', gap:6,
                        background: st.bg,
                        border:`1px solid ${st.color}35`,
                        borderLeft:`3px solid ${color}`,
                        borderRadius:8, padding:'6px 8px',
                        cursor:'grab', userSelect:'none',
                        transition:'opacity 0.1s, transform 0.1s',
                        opacity: dragId?.id === item.id ? 0.4 : 1,
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform='translateY(-1px)'}
                      onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}
                    >
                      <GripVertical size={10} style={{ color:'#94a3b8', flexShrink:0 }}/>
                      <div style={{ width:22, height:22, borderRadius:6, background:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:900, color:'#fff', flexShrink:0 }}>
                        {item.storeName.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize:11, fontWeight:700, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {item.storeName}
                      </span>
                      <button
                        title={`Stato: ${st.label}`}
                        onClick={() => cycleStatus(day.dateStr, item.id)}
                        style={{ background:'none', border:'none', cursor:'pointer', padding:1, display:'flex', color:st.color, flexShrink:0 }}
                      >
                        <st.Icon size={11}/>
                      </button>
                      <button
                        onClick={() => removeItem(day.dateStr, item.id)}
                        style={{ background:'none', border:'none', cursor:'pointer', padding:1, display:'flex', color:'#EF4444', opacity:0.5, flexShrink:0 }}
                        onMouseEnter={e=>e.currentTarget.style.opacity='1'}
                        onMouseLeave={e=>e.currentTarget.style.opacity='0.5'}
                      >
                        <X size={10}/>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* + button */}
              <div style={{ position:'relative' }} ref={isPicker ? pickerRef : null}>
                <button
                  onClick={() => { setPicker(isPicker ? null : day.dateStr); setPickerQ(''); }}
                  style={{
                    width:'100%', padding:'6px 0', borderRadius:8,
                    border:'1.5px dashed var(--color-border)',
                    background:'transparent', cursor:'pointer',
                    color:'var(--color-text-tertiary)', fontSize:18, fontWeight:700,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    transition:'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='#7B6FD0'; e.currentTarget.style.color='#7B6FD0'; e.currentTarget.style.background='rgba(123,111,208,0.07)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='var(--color-border)'; e.currentTarget.style.color='var(--color-text-tertiary)'; e.currentTarget.style.background='transparent'; }}
                >
                  <Plus size={14}/>
                </button>

                {/* picker dropdown */}
                {isPicker && (
                  <div style={{
                    position:'absolute', bottom:'calc(100% + 6px)', left:0, right:0,
                    background:'var(--color-surface)', border:'1px solid var(--color-border)',
                    borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,0.25)',
                    zIndex:500, overflow:'hidden',
                  }}>
                    <div style={{ padding:'8px 10px', borderBottom:'1px solid var(--color-border)' }}>
                      <input
                        autoFocus
                        value={pickerQ}
                        onChange={e => setPickerQ(e.target.value)}
                        placeholder="Cerca negozio..."
                        style={{ width:'100%', padding:'6px 10px', borderRadius:8, border:'1px solid var(--color-border)', background:'var(--color-bg)', color:'var(--color-text)', fontSize:12, outline:'none', boxSizing:'border-box' }}
                      />
                    </div>
                    <div style={{ maxHeight:180, overflowY:'auto' }}>
                      {pickerStores.length === 0 && (
                        <div style={{ padding:'12px', textAlign:'center', fontSize:12, color:'var(--color-text-tertiary)' }}>Nessun negozio</div>
                      )}
                      {pickerStores.map(s => {
                        const name = s.name || s.store_name || '';
                        const alreadyIn = (data[day.dateStr]||[]).some(x => x.storeId === String(s.id));
                        return (
                          <button
                            key={s.id}
                            disabled={alreadyIn}
                            onClick={() => addStore(day.dateStr, String(s.id), name)}
                            style={{
                              width:'100%', padding:'8px 12px', textAlign:'left',
                              background:'transparent', border:'none', cursor: alreadyIn ? 'default' : 'pointer',
                              color: alreadyIn ? 'var(--color-text-tertiary)' : 'var(--color-text)',
                              fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:8,
                              opacity: alreadyIn ? 0.5 : 1,
                            }}
                            onMouseEnter={e => { if (!alreadyIn) e.currentTarget.style.background='rgba(123,111,208,0.09)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background='transparent'; }}
                          >
                            <div style={{ width:22, height:22, borderRadius:6, background:chipColor(name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:900, color:'#fff', flexShrink:0 }}>
                              {name.charAt(0).toUpperCase()}
                            </div>
                            {name}
                            {alreadyIn && <span style={{ marginLeft:'auto', fontSize:10 }}>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Legenda status ── */}
      <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }}>
        {Object.entries(ST).map(([k,s]) => (
          <div key={k} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, fontWeight:700, color:s.color }}>
            <s.Icon size={12}/> {s.label}
          </div>
        ))}
        <div style={{ fontSize:11, color:'var(--color-text-tertiary)', display:'flex', alignItems:'center', gap:4 }}>
          <GripVertical size={11}/> Trascina tra i giorni
        </div>
      </div>
    </div>
  );
}
