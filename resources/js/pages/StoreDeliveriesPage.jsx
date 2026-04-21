import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Truck, Plus, ChevronLeft, ChevronRight, Save, Copy, X, Calendar, CheckCircle2, Clock, AlertCircle, Package, GripVertical } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { stores } from '../api.jsx';

const LS_TPL  = 'svapro_del_tpl_v6';
const LS_DATA = 'svapro_del_data_v6';
const DAYS    = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
const DAYS_SH = ['LUN','MAR','MER','GIO','VEN','SAB','DOM'];

function getMonday(d) {
  const dt = new Date(d); const day = dt.getDay();
  dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day));
  dt.setHours(0,0,0,0); return dt;
}
function addDays(d, n) { const dt = new Date(d); dt.setDate(dt.getDate()+n); return dt; }
function toISO(d) { return d.toISOString().slice(0,10); }
function fmtDay(d) { return d.toLocaleDateString('it-IT',{day:'2-digit',month:'short'}); }
function uid() { return `d_${Date.now()}_${Math.random().toString(36).slice(2,6)}`; }
function loadData() { try { return JSON.parse(localStorage.getItem(LS_DATA)||'{}'); } catch { return {}; } }
function saveData(d) { localStorage.setItem(LS_DATA, JSON.stringify(d)); }
function loadTpl()  { try { return JSON.parse(localStorage.getItem(LS_TPL)||'null'); } catch { return null; } }
function saveTpl(t) { localStorage.setItem(LS_TPL, JSON.stringify(t)); }
function emptyWeek() { return Object.fromEntries(DAYS.map((_,i)=>[i,[]])); }
function applyTpl(tpl) {
  if (!tpl) return emptyWeek();
  const w = emptyWeek();
  DAYS.forEach((_,i) => { w[i]=(tpl[i]||[]).map(s=>({...s,id:uid(),status:'pending'})); });
  return w;
}

const ST = {
  pending:    { label:'In attesa',   color:'#F59E0B', dot:'#FCD34D' },
  confirmed:  { label:'Confermato',  color:'#60A5FA', dot:'#93C5FD' },
  delivering: { label:'In consegna', color:'#A78BFA', dot:'#C4B5FD' },
  done:       { label:'Consegnato',  color:'#34D399', dot:'#6EE7B7' },
  issue:      { label:'Problema',    color:'#F87171', dot:'#FCA5A5' },
};
const SK = Object.keys(ST);

const COL_COLORS = ['#6366F1','#8B5CF6','#EC4899','#F59E0B','#10B981','3B82F6','#EF4444'];
const COL_HEX    = ['#6366F1','#8B5CF6','#EC4899','#F59E0B','#10B981','#3B82F6','#EF4444'];

export default function StoreDeliveriesPage() {
  const [storeList, setStoreList] = useState([]);
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const weekKey = toISO(weekStart);
  const [allData, setAllData] = useState(loadData);
  const [template, setTemplate] = useState(loadTpl);
  const [days, setDays] = useState(() => { const d=loadData(); return d[toISO(getMonday(new Date()))] || applyTpl(loadTpl()); });
  const [addingDay, setAddingDay] = useState(null);
  const [pickStore, setPickStore] = useState('');

  // ── Drag state ──
  const [ghost, setGhost] = useState(null); // {item, fromDay, fromIdx, x, y, w, h, ox, oy}
  const [dropTarget, setDropTarget] = useState(null); // {dayIdx, idx}
  const colRefs = useRef({});
  const rafRef = useRef(null);

  useEffect(() => {
    stores.getAll?.().then(r => setStoreList(r.data?.data||r.data||[])).catch(()=>{});
  },[]);

  useEffect(() => {
    const saved = allData[weekKey];
    setDays(saved || applyTpl(template));
  }, [weekKey]);

  useEffect(() => {
    const updated = {...allData,[weekKey]:days};
    setAllData(updated); saveData(updated);
  }, [days]);

  // ── Add ──
  const handleAdd = (dayIdx) => {
    if (!pickStore) return;
    const s = storeList.find(x=>String(x.id)===pickStore);
    setDays(prev=>({...prev,[dayIdx]:[...(prev[dayIdx]||[]),{id:uid(),storeId:pickStore,storeName:s?.name||`Store ${pickStore}`,status:'pending'}]}));
    setAddingDay(null); setPickStore('');
    toast.success(`${s?.name||'Negozio'} aggiunto`);
  };
  const handleRemove = (dayIdx, id) =>
    setDays(prev=>({...prev,[dayIdx]:prev[dayIdx].filter(x=>x.id!==id)}));
  const cycleStatus = (dayIdx, id) =>
    setDays(prev=>({...prev,[dayIdx]:prev[dayIdx].map(x=>x.id!==id?x:{...x,status:SK[(SK.indexOf(x.status)+1)%SK.length]})}));

  // ── Pointer DnD ──
  const startDrag = useCallback((e, dayIdx, idx, item) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setGhost({ item, fromDay: dayIdx, fromIdx: idx, x: e.clientX, y: e.clientY, w: rect.width, h: rect.height, ox: e.clientX-rect.left, oy: e.clientY-rect.top });
  }, []);

  const computeDrop = useCallback((cx, cy) => {
    for (const [key, ref] of Object.entries(colRefs.current)) {
      if (!ref) continue;
      const r = ref.getBoundingClientRect();
      if (cx>=r.left && cx<=r.right && cy>=r.top && cy<=r.bottom) {
        const dayIdx = Number(key);
        const cards = ref.querySelectorAll('[data-cidx]');
        let insertIdx = days[dayIdx]?.length ?? 0;
        for (const card of cards) {
          const cr = card.getBoundingClientRect();
          if (cy < cr.top + cr.height/2) { insertIdx = Number(card.dataset.cidx); break; }
        }
        return { dayIdx, idx: insertIdx };
      }
    }
    return null;
  }, [days]);

  useEffect(() => {
    if (!ghost) return;
    const onMove = (e) => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setGhost(prev => prev ? {...prev, x:e.clientX, y:e.clientY} : null);
        setDropTarget(computeDrop(e.clientX, e.clientY));
      });
    };
    const onUp = (e) => {
      const dt = computeDrop(e.clientX, e.clientY);
      if (dt && ghost) {
        const {item, fromDay, fromIdx} = ghost;
        const {dayIdx: toDay, idx: toIdx} = dt;
        setDays(prev => {
          const n = {...prev};
          const from = [...(n[fromDay]||[])];
          const [removed] = from.splice(fromIdx, 1);
          n[fromDay] = from;
          if (fromDay === toDay) {
            const ai = toIdx > fromIdx ? toIdx-1 : toIdx;
            from.splice(Math.max(0,ai), 0, removed);
          } else {
            const to = [...(n[toDay]||[])];
            to.splice(toIdx, 0, {...removed, status:'pending'});
            n[toDay] = to;
          }
          return n;
        });
      }
      setGhost(null); setDropTarget(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove',onMove); window.removeEventListener('pointerup',onUp); };
  }, [ghost, computeDrop]);

  // ── Template ──
  const saveTplNow = () => {
    const tpl={};
    DAYS.forEach((_,i)=>{ tpl[i]=(days[i]||[]).map(s=>({storeId:s.storeId,storeName:s.storeName})); });
    setTemplate(tpl); saveTpl(tpl); toast.success('Template salvato!');
  };
  const applyTplNow = () => {
    if (!template) return;
    if (!confirm('Sovrascrivere questa settimana col template?')) return;
    setDays(applyTpl(template)); toast.success('Template applicato');
  };

  const todayStr = toISO(new Date());
  const weekLabel = (() => {
    const f = weekStart.toLocaleDateString('it-IT',{day:'2-digit',month:'long'});
    const t = addDays(weekStart,6).toLocaleDateString('it-IT',{day:'2-digit',month:'long',year:'numeric'});
    return `${f} – ${t}`;
  })();

  const totalItems = DAYS.reduce((s,_,i)=>s+(days[i]?.length||0),0);
  const doneItems  = DAYS.reduce((s,_,i)=>s+(days[i]||[]).filter(x=>x.status==='done').length,0);

  return (
    <div style={{minHeight:'100vh',background:'var(--color-bg,#0B0C10)',fontFamily:"'Inter',system-ui,sans-serif",display:'flex',flexDirection:'column',userSelect:ghost?'none':'auto'}}>

      {/* ── TOP BAR ── */}
      <div style={{padding:'20px 24px 0',background:'var(--color-bg,#0B0C10)',borderBottom:'1px solid rgba(255,255,255,0.06)',backdropFilter:'blur(20px)',position:'sticky',top:0,zIndex:10}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,gap:12,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div style={{width:44,height:44,borderRadius:14,background:'linear-gradient(135deg,#6366F1,#8B5CF6)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 8px 20px rgba(99,102,241,0.35)',flexShrink:0}}>
              <Truck size={20} color="#fff"/>
            </div>
            <div>
              <h1 style={{margin:0,fontSize:20,fontWeight:800,color:'var(--color-text,#F1F5F9)',letterSpacing:'-0.5px'}}>Consegne Negozi</h1>
              <p style={{margin:0,fontSize:11,color:'#64748B'}}>Kanban settimanale · trascina le card per spostare</p>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:20,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',fontSize:12,fontWeight:700,color:'#94A3B8'}}>
              <Package size={13} color="#6366F1"/>
              <span style={{color:'#F1F5F9'}}>{doneItems}/{totalItems}</span> consegnati
            </div>
            <button onClick={saveTplNow} style={topBtn('#6366F1')}><Save size={12}/> Template</button>
            {template && <button onClick={applyTplNow} style={topBtn('#8B5CF6')}><Copy size={12}/> Applica</button>}
          </div>
        </div>

        {/* Legenda status */}
        <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>
          {SK.map(k=>(
            <div key={k} style={{display:'flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:20,background:`${ST[k].color}18`,border:`1px solid ${ST[k].color}30`,fontSize:10,fontWeight:700,color:ST[k].color}}>
              <div style={{width:5,height:5,borderRadius:'50%',background:ST[k].dot}}/>
              {ST[k].label}
            </div>
          ))}
        </div>
      </div>

      {/* ── NAV SETTIMANA ── */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,padding:'14px 24px',background:'rgba(255,255,255,0.02)',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
        <button onClick={()=>setWeekStart(d=>addDays(d,-7))} style={navBtn()}><ChevronLeft size={16}/></button>
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 20px',borderRadius:12,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)'}}>
          <Calendar size={13} color="#6366F1"/>
          <span style={{fontSize:13,fontWeight:700,color:'var(--color-text,#F1F5F9)',minWidth:240,textAlign:'center'}}>{weekLabel}</span>
        </div>
        <button onClick={()=>setWeekStart(d=>addDays(d,7))} style={navBtn()}><ChevronRight size={16}/></button>
        <button onClick={()=>setWeekStart(getMonday(new Date()))} style={{...navBtn(),padding:'7px 16px',fontSize:11,fontWeight:700,color:'#6366F1',borderColor:'rgba(99,102,241,0.3)',background:'rgba(99,102,241,0.1)'}}>Oggi</button>
      </div>

      {/* ── KANBAN BOARD ── */}
      <div style={{flex:1,overflowX:'auto',padding:'20px 16px 32px',display:'flex',gap:12,minWidth:0}}>
        {DAYS.map((_, dayIdx) => {
          const dayDate = addDays(weekStart, dayIdx);
          const isToday = toISO(dayDate) === todayStr;
          const items   = days[dayIdx] || [];
          const accent  = COL_HEX[dayIdx];
          const isDragOver = dropTarget?.dayIdx === dayIdx;
          const doneCount  = items.filter(x=>x.status==='done').length;
          const pct = items.length>0 ? Math.round(doneCount/items.length*100) : 0;

          return (
            <div key={dayIdx} style={{display:'flex',flexDirection:'column',minWidth:200,width:'calc((100% - 72px) / 7)',flexShrink:0}}>
              {/* Column header */}
              <div style={{
                padding:'12px 14px 10px',
                borderRadius:'14px 14px 0 0',
                background: isToday ? `${accent}20` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isDragOver ? accent+'60' : isToday ? accent+'40' : 'rgba(255,255,255,0.07)'}`,
                borderBottom:'none',
                transition:'border-color 0.2s',
              }}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <div style={{width:3,height:14,borderRadius:2,background:accent,flexShrink:0}}/>
                      <span style={{fontWeight:900,fontSize:12,color:isToday?accent:'var(--color-text,#F1F5F9)',letterSpacing:'0.8px'}}>{DAYS_SH[dayIdx]}</span>
                    </div>
                    <div style={{fontSize:10,color:'#64748B',marginTop:2,paddingLeft:9}}>{fmtDay(dayDate)}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    {items.length>0 && <span style={{fontSize:10,fontWeight:800,padding:'1px 7px',borderRadius:10,background:`${accent}25`,color:accent,border:`1px solid ${accent}30`}}>{items.length}</span>}
                    <button
                      onClick={()=>{setAddingDay(addingDay===dayIdx?null:dayIdx);setPickStore('');}}
                      style={{width:26,height:26,borderRadius:8,border:'none',background:addingDay===dayIdx?accent:`${accent}20`,color:addingDay===dayIdx?'#fff':accent,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s'}}
                    >
                      {addingDay===dayIdx?<X size={13}/>:<Plus size={13}/>}
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {items.length>0 && (
                  <div style={{marginTop:8}}>
                    <div style={{height:3,borderRadius:2,background:'rgba(255,255,255,0.08)'}}>
                      <div style={{height:'100%',borderRadius:2,width:`${pct}%`,background:pct===100?'#10B981':accent,transition:'width 0.4s'}}/>
                    </div>
                  </div>
                )}

                {/* Picker */}
                {addingDay===dayIdx && (
                  <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:6}}>
                    <select autoFocus value={pickStore} onChange={e=>setPickStore(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter')handleAdd(dayIdx);if(e.key==='Escape')setAddingDay(null);}}
                      style={{width:'100%',padding:'7px 8px',borderRadius:8,border:`1px solid ${accent}50`,fontSize:11,outline:'none',background:'rgba(0,0,0,0.4)',color:'var(--color-text,#F1F5F9)',fontFamily:'inherit'}}>
                      <option value="">— Seleziona negozio —</option>
                      {storeList.map(s=><option key={s.id} value={String(s.id)}>{s.name}</option>)}
                    </select>
                    <button onClick={()=>handleAdd(dayIdx)} disabled={!pickStore}
                      style={{padding:'7px',borderRadius:8,border:'none',background:pickStore?accent:'rgba(255,255,255,0.05)',color:pickStore?'#fff':'#64748B',fontSize:11,fontWeight:700,cursor:pickStore?'pointer':'default',fontFamily:'inherit',transition:'all 0.15s'}}>
                      + Aggiungi
                    </button>
                  </div>
                )}
              </div>

              {/* Column body — drop target */}
              <div
                ref={el=>colRefs.current[dayIdx]=el}
                style={{
                  flex:1,minHeight:300,padding:'6px',
                  background: isDragOver ? `${accent}08` : 'rgba(255,255,255,0.025)',
                  border:`1px solid ${isDragOver?accent+'50':'rgba(255,255,255,0.07)'}`,
                  borderTop:'none',borderRadius:'0 0 14px 14px',
                  display:'flex',flexDirection:'column',gap:5,
                  transition:'background 0.15s,border-color 0.15s',
                  overflowY:'auto',
                }}
              >
                {items.map((item,idx) => {
                  const st = ST[item.status]||ST.pending;
                  const isGhost = ghost?.item?.id === item.id;
                  const showDropLine = dropTarget?.dayIdx===dayIdx && dropTarget?.idx===idx;

                  return (
                    <React.Fragment key={item.id}>
                      {showDropLine && <div style={{height:3,borderRadius:2,background:accent,margin:'0 2px',flexShrink:0,boxShadow:`0 0 8px ${accent}`}}/>}
                      <div
                        data-cidx={idx}
                        onPointerDown={e=>startDrag(e,dayIdx,idx,item)}
                        style={{
                          background: isGhost ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
                          border:`1px solid ${isGhost?'rgba(255,255,255,0.05)':st.color+'30'}`,
                          borderLeft:`3px solid ${isGhost?'rgba(255,255,255,0.1)':st.color}`,
                          borderRadius:10,padding:'10px 10px 8px 12px',
                          cursor:isGhost?'grabbing':'grab',
                          opacity:isGhost?0.35:1,
                          transition:'opacity 0.15s,box-shadow 0.15s,background 0.15s',
                          position:'relative',flexShrink:0,
                          boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
                        }}
                        onMouseEnter={e=>{if(!ghost)e.currentTarget.style.background='rgba(255,255,255,0.09)';}}
                        onMouseLeave={e=>{if(!ghost)e.currentTarget.style.background='rgba(255,255,255,0.06)';}}
                      >
                        {/* Priority + grip */}
                        <div style={{position:'absolute',top:6,right:6,display:'flex',alignItems:'center',gap:3}}>
                          <span style={{fontSize:9,fontWeight:800,color:'rgba(255,255,255,0.2)'}}>#{idx+1}</span>
                          <GripVertical size={10} color="rgba(255,255,255,0.15)"/>
                        </div>

                        {/* Store name */}
                        <div style={{fontWeight:700,fontSize:12,color:'var(--color-text,#F1F5F9)',paddingRight:32,lineHeight:1.35,marginBottom:7}}>
                          {item.storeName}
                        </div>

                        {/* Status + remove row */}
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                          <button onClick={()=>cycleStatus(dayIdx,item.id)}
                            style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:20,border:`1px solid ${st.color}35`,background:`${st.color}15`,color:st.color,fontSize:9,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
                            <div style={{width:5,height:5,borderRadius:'50%',background:st.dot,boxShadow:`0 0 4px ${st.color}`}}/>
                            {st.label}
                          </button>
                          <button onClick={()=>handleRemove(dayIdx,item.id)}
                            style={{background:'none',border:'none',cursor:'pointer',padding:'2px 3px',color:'rgba(255,255,255,0.2)',lineHeight:1,borderRadius:4,display:'flex',alignItems:'center'}}
                            onMouseEnter={e=>e.currentTarget.style.color='#F87171'}
                            onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.2)'}>
                            <X size={11}/>
                          </button>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}

                {/* Bottom drop line */}
                {dropTarget?.dayIdx===dayIdx && dropTarget?.idx===items.length && (
                  <div style={{height:3,borderRadius:2,background:accent,margin:'0 2px',flexShrink:0,boxShadow:`0 0 8px ${accent}`}}/>
                )}

                {/* Empty state */}
                {items.length===0 && (
                  <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,color:'rgba(255,255,255,0.1)',minHeight:120}}>
                    <div style={{width:36,height:36,borderRadius:10,border:'1.5px dashed rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <Truck size={16} color="rgba(255,255,255,0.12)"/>
                    </div>
                    <span style={{fontSize:10,fontStyle:'italic'}}>Nessuna consegna</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── GHOST CARD (segue cursore) ── */}
      {ghost && (
        <div style={{
          position:'fixed',
          left: ghost.x - ghost.ox,
          top:  ghost.y - ghost.oy,
          width: ghost.w,
          pointerEvents:'none',
          zIndex:9999,
          transform:'rotate(2deg) scale(1.03)',
          boxShadow:'0 20px 60px rgba(0,0,0,0.6)',
          borderRadius:10,
          border:'1.5px solid rgba(255,255,255,0.2)',
          background:'rgba(30,34,52,0.95)',
          backdropFilter:'blur(12px)',
          padding:'10px 10px 8px 12px',
          borderLeft:'3px solid #6366F1',
        }}>
          <div style={{fontWeight:700,fontSize:12,color:'#F1F5F9',marginBottom:6}}>{ghost.item.storeName}</div>
          <div style={{display:'flex',alignItems:'center',gap:4,fontSize:9,fontWeight:800,color:ST[ghost.item.status]?.color||'#F59E0B'}}>
            <div style={{width:5,height:5,borderRadius:'50%',background:ST[ghost.item.status]?.dot||'#FCD34D'}}/>
            {ST[ghost.item.status]?.label||'In attesa'}
          </div>
        </div>
      )}
    </div>
  );
}

function topBtn(color) {
  return {display:'flex',alignItems:'center',gap:5,padding:'7px 13px',borderRadius:9,border:`1px solid ${color}35`,background:`${color}15`,color,fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit'};
}
function navBtn() {
  return {width:34,height:34,borderRadius:9,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.04)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--color-text,#F1F5F9)'};
}
