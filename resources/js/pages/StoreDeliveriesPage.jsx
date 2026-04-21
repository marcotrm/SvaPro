import React, { useState, useEffect, useRef } from 'react';
/* eslint-disable */
import { Truck, Plus, ChevronLeft, ChevronRight, Save, Copy, X, Calendar, GripVertical } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { stores } from '../api.jsx';

const LS_TPL  = 'svapro_del_tpl_v4';
const LS_DATA = 'svapro_del_data_v4';
const DAYS    = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
const DAYS_SH = ['LUN','MAR','MER','GIO','VEN','SAB','DOM'];

function getMonday(d) {
  const dt = new Date(d); const day = dt.getDay();
  dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day));
  dt.setHours(0,0,0,0); return dt;
}
function addDays(d,n){ const dt=new Date(d); dt.setDate(dt.getDate()+n); return dt; }
function toISO(d){ return d.toISOString().slice(0,10); }
function fmtDay(d){ return d.toLocaleDateString('it-IT',{day:'2-digit',month:'short'}); }
function uid(){ return `d_${Date.now()}_${Math.random().toString(36).slice(2,6)}`; }
function loadData(){ try{ return JSON.parse(localStorage.getItem(LS_DATA)||'{}'); }catch{ return {}; } }
function saveData(d){ localStorage.setItem(LS_DATA,JSON.stringify(d)); }
function loadTpl(){ try{ return JSON.parse(localStorage.getItem(LS_TPL)||'null'); }catch{ return null; } }
function saveTpl(t){ localStorage.setItem(LS_TPL,JSON.stringify(t)); }
function emptyWeek(){ return Object.fromEntries(DAYS.map((_,i)=>[i,[]])); }
function applyTpl(tpl){
  if(!tpl) return emptyWeek();
  const w=emptyWeek();
  DAYS.forEach((_,i)=>{ w[i]=(tpl[i]||[]).map(s=>({...s,id:uid(),status:'pending'})); });
  return w;
}

const ST = {
  pending:    { label:'In attesa',   color:'#F59E0B', bg:'rgba(245,158,11,0.15)' },
  confirmed:  { label:'Confermato',  color:'#60A5FA', bg:'rgba(96,165,250,0.15)' },
  delivering: { label:'In consegna', color:'#A78BFA', bg:'rgba(167,139,250,0.15)' },
  done:       { label:'Consegnato',  color:'#34D399', bg:'rgba(52,211,153,0.15)' },
  issue:      { label:'Problema',    color:'#F87171', bg:'rgba(248,113,113,0.15)' },
};
const SK = Object.keys(ST);
const ACCENTS = ['#6366F1','#8B5CF6','#EC4899','#F59E0B','#10B981','#3B82F6','#EF4444'];

export default function StoreDeliveriesPage() {
  const [storeList, setStoreList] = useState([]);
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const weekKey = toISO(weekStart);
  const [allData, setAllData] = useState(loadData);
  const [template, setTemplate] = useState(loadTpl);
  const [days, setDays] = useState(() => { const d=loadData(); const k=toISO(getMonday(new Date())); return d[k]||applyTpl(loadTpl()); });
  const [addingDay, setAddingDay] = useState(null);
  const [pickStore, setPickStore] = useState('');
  const [dragOver, setDragOver] = useState(null);
  const dragRef = useRef(null);

  useEffect(() => {
    stores.getAll?.().then(r=>setStoreList(r.data?.data||r.data||[])).catch(()=>{});
  }, []);

  useEffect(() => {
    const saved = allData[weekKey];
    setDays(saved || applyTpl(template));
  }, [weekKey]);

  useEffect(() => {
    const updated = {...allData,[weekKey]:days};
    setAllData(updated); saveData(updated);
  }, [days]);

  const handleAdd = (dayIdx) => {
    if (!pickStore) return;
    const s = storeList.find(x=>String(x.id)===pickStore);
    setDays(prev=>({...prev,[dayIdx]:[...(prev[dayIdx]||[]),{id:uid(),storeId:pickStore,storeName:s?.name||`Store ${pickStore}`,status:'pending'}]}));
    setAddingDay(null); setPickStore('');
    toast.success(`${s?.name||'Negozio'} aggiunto`);
  };

  const handleRemove = (dayIdx,id) =>
    setDays(prev=>({...prev,[dayIdx]:prev[dayIdx].filter(x=>x.id!==id)}));

  const cycleStatus = (dayIdx,id) =>
    setDays(prev=>({...prev,[dayIdx]:prev[dayIdx].map(x=>x.id!==id?x:{...x,status:SK[(SK.indexOf(x.status)+1)%SK.length]})}));

  // ── HTML5 DnD (stesso sistema originale che funzionava) ──
  const onDragStart = (e,dayIdx,idx,item) => {
    dragRef.current={item,fromDay:dayIdx,fromIdx:idx};
    e.dataTransfer.effectAllowed='move';
  };
  const onDragOver = (e,dayIdx,idx) => {
    e.preventDefault(); e.stopPropagation();
    e.dataTransfer.dropEffect='move';
    setDragOver({dayIdx,idx:idx??-1});
  };
  const onDragLeave = () => setDragOver(null);
  const onDragEnd   = () => { dragRef.current=null; setDragOver(null); };

  const onDropItem = (e,toDayIdx,toIdx) => {
    e.preventDefault(); e.stopPropagation();
    const {item,fromDay,fromIdx} = dragRef.current||{};
    if(!item) return;
    setDays(prev=>{
      const from=[...(prev[fromDay]||[])];
      const to  = fromDay===toDayIdx ? from : [...(prev[toDayIdx]||[])];
      from.splice(fromIdx,1);
      if(fromDay===toDayIdx){ from.splice(toIdx,0,item); return {...prev,[fromDay]:from}; }
      to.splice(toIdx,0,{...item,status:'pending'});
      return {...prev,[fromDay]:from,[toDayIdx]:to};
    });
    dragRef.current=null; setDragOver(null);
  };

  const onDropDay = (e,toDayIdx) => {
    e.preventDefault();
    const {item,fromDay} = dragRef.current||{};
    if(!item||fromDay===toDayIdx) return;
    setDays(prev=>{
      const from=[...(prev[fromDay]||[])];
      const idx=from.findIndex(x=>x.id===item.id);
      if(idx<0) return prev;
      from.splice(idx,1);
      return {...prev,[fromDay]:from,[toDayIdx]:[...(prev[toDayIdx]||[]),{...item,status:'pending'}]};
    });
    dragRef.current=null; setDragOver(null);
  };

  const saveTplNow = () => {
    const tpl={};
    DAYS.forEach((_,i)=>{ tpl[i]=(days[i]||[]).map(s=>({storeId:s.storeId,storeName:s.storeName})); });
    setTemplate(tpl); saveTpl(tpl); toast.success('Template salvato!');
  };
  const applyTplNow = () => {
    if(!template||!confirm('Sovrascrivere questa settimana col template?')) return;
    setDays(applyTpl(template)); toast.success('Template applicato');
  };

  const todayStr = toISO(new Date());
  const weekLabel = (() => {
    const f=weekStart.toLocaleDateString('it-IT',{day:'2-digit',month:'long'});
    const t=addDays(weekStart,6).toLocaleDateString('it-IT',{day:'2-digit',month:'long',year:'numeric'});
    return `${f} – ${t}`;
  })();

  return (
    <div style={{minHeight:'100vh',background:'var(--color-bg,#0B0D12)',fontFamily:"'Inter',system-ui,sans-serif",display:'flex',flexDirection:'column'}}>

      {/* TOP BAR */}
      <div style={{padding:'18px 24px 14px',borderBottom:'1px solid rgba(255,255,255,0.07)',background:'rgba(255,255,255,0.02)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div style={{width:42,height:42,borderRadius:13,background:'linear-gradient(135deg,#6366F1,#8B5CF6)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 6px 18px rgba(99,102,241,0.4)',flexShrink:0}}>
              <Truck size={19} color="#fff"/>
            </div>
            <div>
              <h1 style={{margin:0,fontSize:19,fontWeight:800,color:'var(--color-text,#F1F5F9)',letterSpacing:'-0.4px'}}>Consegne Negozi</h1>
              <p style={{margin:'2px 0 0',fontSize:11,color:'#64748B'}}>Kanban settimanale · trascina per spostare · clic status per aggiornare</p>
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={saveTplNow} style={topBtn('#6366F1')}><Save size={12}/> Salva template</button>
            {template && <button onClick={applyTplNow} style={topBtn('#8B5CF6')}><Copy size={12}/> Applica template</button>}
          </div>
        </div>

        {/* Legenda */}
        <div style={{display:'flex',gap:5,marginTop:12,flexWrap:'wrap'}}>
          {SK.map(k=>(
            <span key={k} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 9px',borderRadius:20,background:ST[k].bg,border:`1px solid ${ST[k].color}30`,fontSize:10,fontWeight:700,color:ST[k].color}}>
              <div style={{width:5,height:5,borderRadius:'50%',background:ST[k].color}}/>{ST[k].label}
            </span>
          ))}
        </div>
      </div>

      {/* NAVIGAZIONE */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,padding:'12px 24px',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
        <button onClick={()=>setWeekStart(d=>addDays(d,-7))} style={navBtn()}><ChevronLeft size={16}/></button>
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 18px',borderRadius:11,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)'}}>
          <Calendar size={13} color="#6366F1"/>
          <span style={{fontSize:13,fontWeight:700,color:'var(--color-text,#F1F5F9)',minWidth:230,textAlign:'center'}}>{weekLabel}</span>
        </div>
        <button onClick={()=>setWeekStart(d=>addDays(d,7))} style={navBtn()}><ChevronRight size={16}/></button>
        <button onClick={()=>setWeekStart(getMonday(new Date()))} style={{...navBtn(),padding:'6px 14px',fontSize:11,fontWeight:700,color:'#6366F1',borderColor:'rgba(99,102,241,0.3)',background:'rgba(99,102,241,0.08)'}}>Oggi</button>
      </div>

      {/* KANBAN */}
      <div style={{flex:1,overflowX:'auto',padding:'18px 16px 32px',display:'flex',gap:10}}>
        {DAYS.map((_,dayIdx)=>{
          const dayDate = addDays(weekStart,dayIdx);
          const isToday = toISO(dayDate)===todayStr;
          const items   = days[dayIdx]||[];
          const accent  = ACCENTS[dayIdx];
          const doneN   = items.filter(x=>x.status==='done').length;
          const pct     = items.length>0 ? Math.round(doneN/items.length*100) : 0;
          const colDragOver = dragOver?.dayIdx===dayIdx;

          return (
            <div key={dayIdx}
              onDragOver={e=>onDragOver(e,dayIdx)}
              onDragLeave={onDragLeave}
              onDrop={e=>onDropDay(e,dayIdx)}
              style={{display:'flex',flexDirection:'column',minWidth:185,width:'calc((100% - 60px)/7)',flexShrink:0}}>

              {/* Colonna header */}
              <div style={{
                padding:'11px 13px 10px',
                borderRadius:'13px 13px 0 0',
                background:isToday?`${accent}1A`:'rgba(255,255,255,0.04)',
                border:`1.5px solid ${colDragOver?accent+'55':isToday?accent+'45':'rgba(255,255,255,0.08)'}`,
                borderBottom:'none',
                transition:'border-color 0.15s',
              }}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <div style={{width:3,height:15,borderRadius:2,background:accent}}/>
                      <span style={{fontWeight:900,fontSize:11,color:isToday?accent:'var(--color-text,#F1F5F9)',letterSpacing:'0.8px'}}>{DAYS_SH[dayIdx]}</span>
                    </div>
                    <div style={{fontSize:10,color:'#64748B',marginTop:1,paddingLeft:9}}>{fmtDay(dayDate)}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:5}}>
                    {items.length>0&&<span style={{fontSize:10,fontWeight:800,padding:'1px 7px',borderRadius:10,background:`${accent}22`,color:accent,border:`1px solid ${accent}33`}}>{items.length}</span>}
                    <button
                      onClick={()=>{setAddingDay(addingDay===dayIdx?null:dayIdx);setPickStore('');}}
                      style={{width:25,height:25,borderRadius:8,border:'none',background:addingDay===dayIdx?accent:`${accent}22`,color:addingDay===dayIdx?'#fff':accent,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s'}}>
                      {addingDay===dayIdx?<X size={13}/>:<Plus size={13}/>}
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {items.length>0&&(
                  <div style={{marginTop:8,height:3,borderRadius:2,background:'rgba(255,255,255,0.08)'}}>
                    <div style={{height:'100%',borderRadius:2,width:`${pct}%`,background:pct===100?'#10B981':accent,transition:'width 0.35s'}}/>
                  </div>
                )}

                {/* Picker aggiungi */}
                {addingDay===dayIdx&&(
                  <div style={{marginTop:9,display:'flex',flexDirection:'column',gap:5}}>
                    <select autoFocus value={pickStore} onChange={e=>setPickStore(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter')handleAdd(dayIdx);if(e.key==='Escape')setAddingDay(null);}}
                      style={{width:'100%',padding:'6px 8px',borderRadius:8,border:`1px solid ${accent}50`,fontSize:11,outline:'none',background:'rgba(0,0,0,0.45)',color:'var(--color-text,#F1F5F9)',fontFamily:'inherit'}}>
                      <option value="">— Seleziona negozio —</option>
                      {storeList.map(s=><option key={s.id} value={String(s.id)}>{s.name}</option>)}
                    </select>
                    <button onClick={()=>handleAdd(dayIdx)} disabled={!pickStore}
                      style={{padding:'6px',borderRadius:8,border:'none',background:pickStore?accent:'rgba(255,255,255,0.05)',color:pickStore?'#fff':'#64748B',fontSize:11,fontWeight:700,cursor:pickStore?'pointer':'default',fontFamily:'inherit',transition:'all 0.15s'}}>
                      Aggiungi
                    </button>
                  </div>
                )}
              </div>

              {/* Colonna body */}
              <div style={{
                flex:1,minHeight:280,padding:'6px',
                background:colDragOver?`${accent}0A`:'rgba(255,255,255,0.025)',
                border:`1.5px solid ${colDragOver?accent+'55':'rgba(255,255,255,0.07)'}`,
                borderTop:'none',borderRadius:'0 0 13px 13px',
                display:'flex',flexDirection:'column',gap:5,
                overflowY:'auto',transition:'background 0.15s,border-color 0.15s',
              }}>
                {items.map((item,idx)=>{
                  const st = ST[item.status]||ST.pending;
                  const isDrop = dragOver?.dayIdx===dayIdx && dragOver?.idx===idx;

                  return (
                    <React.Fragment key={item.id}>
                      {isDrop&&<div style={{height:2,borderRadius:1,background:accent,margin:'0 4px',boxShadow:`0 0 6px ${accent}`}}/>}
                      <div
                        draggable
                        onDragStart={e=>onDragStart(e,dayIdx,idx,item)}
                        onDragEnd={onDragEnd}
                        onDragOver={e=>onDragOver(e,dayIdx,idx)}
                        onDrop={e=>onDropItem(e,dayIdx,idx)}
                        style={{
                          background:`${st.color}12`,
                          border:`1px solid ${st.color}28`,
                          borderLeft:`3px solid ${st.color}`,
                          borderRadius:9,padding:'9px 10px 8px 11px',
                          cursor:'grab',userSelect:'none',
                          transition:'box-shadow 0.15s',
                          position:'relative',flexShrink:0,
                        }}
                        onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 14px rgba(0,0,0,0.3)'}
                        onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}
                      >
                        <div style={{position:'absolute',top:5,right:5,display:'flex',alignItems:'center',gap:2}}>
                          <span style={{fontSize:9,fontWeight:800,color:`${st.color}55`}}>#{idx+1}</span>
                          <GripVertical size={10} color={`${st.color}40`}/>
                        </div>

                        <div style={{fontWeight:700,fontSize:12,color:'var(--color-text,#F1F5F9)',paddingRight:28,lineHeight:1.35,marginBottom:7}}>
                          {item.storeName}
                        </div>

                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                          <button onClick={()=>cycleStatus(dayIdx,item.id)}
                            title="Clicca per cambiare stato"
                            style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:20,border:`1px solid ${st.color}35`,background:`${st.color}18`,color:st.color,fontSize:9,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
                            <div style={{width:5,height:5,borderRadius:'50%',background:st.color}}/>{st.label}
                          </button>
                          <button onClick={()=>handleRemove(dayIdx,item.id)}
                            style={{background:'none',border:'none',cursor:'pointer',padding:'2px',color:'rgba(255,255,255,0.18)',lineHeight:1,borderRadius:4}}
                            onMouseEnter={e=>e.currentTarget.style.color='#F87171'}
                            onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.18)'}>
                            <X size={11}/>
                          </button>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}

                {/* Drop finale colonna */}
                {dragOver?.dayIdx===dayIdx&&dragOver?.idx===items.length&&(
                  <div style={{height:2,borderRadius:1,background:accent,margin:'0 4px',boxShadow:`0 0 6px ${accent}`}}/>
                )}

                {/* Empty state */}
                {items.length===0&&(
                  <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:7,color:'rgba(255,255,255,0.1)',minHeight:100}}>
                    <div style={{width:34,height:34,borderRadius:9,border:'1.5px dashed rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <Truck size={15} color="rgba(255,255,255,0.1)"/>
                    </div>
                    <span style={{fontSize:10,fontStyle:'italic'}}>Nessuna consegna</span>
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

function topBtn(c){ return {display:'flex',alignItems:'center',gap:5,padding:'7px 13px',borderRadius:9,border:`1px solid ${c}35`,background:`${c}15`,color:c,fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit'}; }
function navBtn(){ return {width:34,height:34,borderRadius:9,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.04)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--color-text,#F1F5F9)'}; }
