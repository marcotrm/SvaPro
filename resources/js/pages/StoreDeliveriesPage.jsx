import React, { useState, useEffect, useRef, useCallback } from 'react';
/* eslint-disable */
import { Truck, Plus, ChevronLeft, ChevronRight, Save, Copy, X, Calendar, GripVertical, ExternalLink, Loader } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { stores, storeDeliveries } from '../api.jsx';
import { useOutletContext } from 'react-router-dom';

const LS_TPL  = 'svapro_del_tpl_v4';
const DAYS    = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
const DAYS_SH = ['LUN','MAR','MER','GIO','VEN','SAB','DOM'];

function getMonday(d) {
  const dt = new Date(d); const day = dt.getDay();
  dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day));
  dt.setHours(0,0,0,0); return dt;
}
function addDays(d,n){ const dt=new Date(d); dt.setDate(dt.getDate()+n); return dt; }
function toISO(d){ const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
function fmtDay(d){ return d.toLocaleDateString('it-IT',{day:'2-digit',month:'short'}); }
function emptyWeek(){ return Object.fromEntries(DAYS.map((_,i)=>[i,[]])); }
function loadTpl(){ try{ return JSON.parse(localStorage.getItem(LS_TPL)||'null'); }catch{ return null; } }
function saveTpl(t){ localStorage.setItem(LS_TPL,JSON.stringify(t)); }

// Trasforma lista API → {dayIdx: [items]}
function apiListToDays(list, weekStart) {
  const days = emptyWeek();
  (list || []).forEach(item => {
    const d = new Date(item.scheduled_date + 'T00:00:00');
    const ms = getMonday(weekStart);
    const diff = Math.round((d - ms) / 86400000);
    if (diff >= 0 && diff <= 6) {
      days[diff] = [...(days[diff] || []), {
        id: item.id,
        storeId: String(item.store_id || ''),
        storeName: item.store_name,
        status: item.status || 'pending',
        priority: item.priority || 'normal',
        items: item.items || '',
        notes: item.notes || '',
        driver_note: item.driver_note || '',
        completed_at: item.completed_at || null,
        scheduled_date: item.scheduled_date || null,
      }];
    }
  });
  return days;
}

const ST = {
  pending:    { label:'In attesa',   color:'#F59E0B', bg:'rgba(245,158,11,0.15)' },
  confirmed:  { label:'Confermato',  color:'#60A5FA', bg:'rgba(96,165,250,0.15)' },
  in_progress:{ label:'In consegna', color:'#A78BFA', bg:'rgba(167,139,250,0.15)' },
  done:       { label:'Consegnato',  color:'#34D399', bg:'rgba(52,211,153,0.15)' },
  issue:      { label:'Problema',    color:'#F87171', bg:'rgba(248,113,113,0.15)' },
};
const SK = Object.keys(ST);
const ACCENTS = ['#6366F1','#8B5CF6','#EC4899','#06B6D4','#10B981','#3B82F6','#EF4444'];

export default function StoreDeliveriesPage() {
  const { user } = useOutletContext?.() || {};
  const tenantCode = user?.tenant_code || '';

  const [storeList, setStoreList] = useState([]);
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [days, setDays] = useState(emptyWeek);
  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState(loadTpl);
  const [addingDay, setAddingDay] = useState(null);
  const [pickStore, setPickStore] = useState('');
  const [dragOver, setDragOver] = useState(null);
  const dragRef = useRef(null);
  const [detailCard, setDetailCard] = useState(null);

  // ── Carica negozi ──
  useEffect(() => {
    stores.getAll?.().then(r => setStoreList(r.data?.data || r.data || [])).catch(() => {});
  }, []);

  // ── Carica consegne dalla settimana (auto-applica template se vuota) ──
  const loadWeek = useCallback(async () => {
    setLoading(true);
    try {
      const res = await storeDeliveries.getAll({ date: toISO(weekStart) });
      const list = res.data?.data || [];
      // Filtra solo le consegne di questa settimana
      const mon = toISO(weekStart);
      const sun = toISO(addDays(weekStart, 6));
      const weekList = list.filter(x => x.scheduled_date >= mon && x.scheduled_date <= sun);
      if (weekList.length === 0) {
        // Settimana vuota → auto-applica template principale
        const tpl = loadTpl();
        if (tpl) {
          const created = [];
          for (let i = 0; i < 7; i++) {
            for (const s of (tpl[i] || [])) {
              try {
                const r = await storeDeliveries.create({
                  store_id: Number(s.storeId) || null,
                  store_name: s.storeName,
                  scheduled_date: toISO(addDays(weekStart, i)),
                  priority: 'normal',
                });
                created.push(r.data?.data);
              } catch {}
            }
          }
          if (created.length > 0) {
            // Ricarica dopo creazione
            const res2 = await storeDeliveries.getAll({ date: toISO(weekStart) });
            const list2 = (res2.data?.data || []).filter(x => x.scheduled_date >= mon && x.scheduled_date <= sun);
            setDays(apiListToDays(list2, weekStart));
            return;
          }
        }
      }
      setDays(apiListToDays(weekList, weekStart));
    } catch (e) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message || '';
      toast.error(`Errore consegne${status ? ` (${status})` : ''}: ${msg || 'server error'}`);
    }
    finally { setLoading(false); }
  }, [weekStart]);

  useEffect(() => { loadWeek(); }, [loadWeek]);

  // Polling ogni 15s per aggiornamenti driver
  useEffect(() => {
    const t = setInterval(loadWeek, 15000);
    return () => clearInterval(t);
  }, [loadWeek]);

  // ── Aggiungi consegna ──
  const handleAdd = async (dayIdx) => {
    if (!pickStore) return;
    const s = storeList.find(x => String(x.id) === pickStore);
    const scheduledDate = toISO(addDays(weekStart, dayIdx));
    try {
      await storeDeliveries.create({
        store_id: Number(pickStore),
        store_name: s?.name || `Store ${pickStore}`,
        scheduled_date: scheduledDate,
        priority: 'normal',
      });
      toast.success(`${s?.name || 'Negozio'} aggiunto`);
      setAddingDay(null); setPickStore('');
      loadWeek();
    } catch { toast.error('Errore aggiunta consegna'); }
  };

  // ── Rimuovi consegna ──
  const handleRemove = async (id) => {
    try {
      await storeDeliveries.destroy(id);
      loadWeek();
    } catch { toast.error('Errore eliminazione'); }
  };

  // ── Cicla stato (click) ──
  const cycleStatus = async (id, currentStatus) => {
    const next = SK[(SK.indexOf(currentStatus) + 1) % SK.length];
    try {
      await storeDeliveries.updateStatus(id, { status: next });
      setDays(prev => {
        const n = { ...prev };
        Object.keys(n).forEach(di => {
          n[di] = (n[di] || []).map(x => x.id === id ? { ...x, status: next } : x);
        });
        return n;
      });
    } catch { toast.error('Errore aggiornamento stato'); }
  };

  // ── DnD: sposta tra giorni ──
  const onDragStart = (e, dayIdx, idx, item) => {
    dragRef.current = { item, fromDay: dayIdx, fromIdx: idx };
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e, dayIdx, idx) => {
    e.preventDefault(); e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOver({ dayIdx, idx: idx ?? -1 });
  };
  const onDragLeave = () => setDragOver(null);
  const onDragEnd   = () => { dragRef.current = null; setDragOver(null); };

  const onDropDay = async (e, toDayIdx) => {
    e.preventDefault();
    const { item, fromDay } = dragRef.current || {};
    if (!item || fromDay === toDayIdx) return;
    dragRef.current = null; setDragOver(null);
    const newDate = toISO(addDays(weekStart, toDayIdx));
    try {
      await storeDeliveries.updateStatus(item.id, { status: 'pending', scheduled_date: newDate });
      loadWeek();
    } catch { toast.error('Errore spostamento'); }
  };

  const onDropItem = async (e, toDayIdx) => {
    e.preventDefault(); e.stopPropagation();
    const { item, fromDay } = dragRef.current || {};
    if (!item) return;
    dragRef.current = null; setDragOver(null);
    if (fromDay === toDayIdx) return;
    const newDate = toISO(addDays(weekStart, toDayIdx));
    try {
      await storeDeliveries.updateStatus(item.id, { status: 'pending', scheduled_date: newDate });
      loadWeek();
    } catch { toast.error('Errore spostamento'); }
  };

  // ── Template principale (locale) ──
  const saveTplNow = () => {
    const tpl = {};
    DAYS.forEach((_, i) => {
      tpl[i] = (days[i] || []).map(s => ({ storeId: s.storeId, storeName: s.storeName }));
    });
    setTemplate(tpl); saveTpl(tpl);
    toast.success('✅ Template principale salvato! Verrà applicato a tutte le settimane senza consegne.');
  };

  const todayStr = toISO(new Date());
  const weekLabel = (() => {
    const f = weekStart.toLocaleDateString('it-IT', { day:'2-digit', month:'long' });
    const t = addDays(weekStart,6).toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });
    return `${f} – ${t}`;
  })();

  const driverUrl = `${window.location.origin}/deliveries/driver${tenantCode ? `?tk=${encodeURIComponent(tenantCode)}` : ''}`;

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
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {loading && <Loader size={14} style={{animation:'spin 1s linear infinite',color:'#6366F1'}} />}
            <button
              onClick={() => window.open(driverUrl, '_blank')}
              style={topBtn('#10B981')}
              title="Apri la vista mobile per il corriere in una nuova scheda"
            >
              <Truck size={12}/> Vista Corriere
              <ExternalLink size={10} style={{opacity:0.7}}/>
            </button>
            <button onClick={saveTplNow} style={topBtn('#6366F1')}><Save size={12}/> Salva template principale</button>
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
                background:isToday?`${accent}26`:`${accent}0F`,
                border:`1.5px solid ${colDragOver?accent+'55':isToday?accent+'55':accent+'28'}`,
                borderBottom:'none',
                transition:'border-color 0.15s',
              }}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <div style={{width:3,height:15,borderRadius:2,background:accent}}/>
                      <span style={{fontWeight:900,fontSize:11,color:accent,letterSpacing:'0.8px'}}>{DAYS_SH[dayIdx]}</span>
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

                {items.length>0&&(
                  <div style={{marginTop:8,height:3,borderRadius:2,background:'rgba(255,255,255,0.08)'}}>
                    <div style={{height:'100%',borderRadius:2,width:`${pct}%`,background:pct===100?'#10B981':accent,transition:'width 0.35s'}}/>
                  </div>
                )}

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
                background:colDragOver?`${accent}14`:`${accent}07`,
                border:`1.5px solid ${colDragOver?accent+'55':accent+'28'}`,
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
                        onDrop={e=>onDropItem(e,dayIdx)}
                        style={{
                          background: item.status==='done' ? 'rgba(52,211,153,0.1)' : item.status==='issue' ? 'rgba(248,113,113,0.1)' : `${st.color}12`,
                          border: item.status==='done' ? '1px solid rgba(52,211,153,0.35)' : item.status==='issue' ? '1px solid rgba(248,113,113,0.35)' : `1px solid ${st.color}28`,
                          borderLeft: item.status==='done' ? '3px solid #34D399' : item.status==='issue' ? '3px solid #F87171' : `3px solid ${st.color}`,
                          borderRadius:9,padding:'9px 10px 8px 11px',
                          cursor:'pointer',userSelect:'none',
                          transition:'box-shadow 0.15s',
                          position:'relative',flexShrink:0,
                        }}
                        onClick={()=>setDetailCard(item)}
                        onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 14px rgba(0,0,0,0.3)'}
                        onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}
                      >
                        <div style={{position:'absolute',top:6,right:6,display:'flex',alignItems:'center',gap:2}}>
                          <span style={{fontSize:10,fontWeight:800,color: item.status==='done'?'#34D399':item.status==='issue'?'#F87171':`${st.color}55`}}>#{idx+1}</span>
                          <GripVertical size={11} color={`${st.color}40`}/>
                        </div>

                        {/* Nome negozio */}
                        <div style={{fontWeight:800,fontSize:13,color:'var(--color-text,#F1F5F9)',paddingRight:32,lineHeight:1.3,marginBottom:5}}>
                          {item.storeName}
                        </div>

                        {/* Data di consegna — sempre dalla colonna */}
                        <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:8,display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
                          <Calendar size={10} color="rgba(255,255,255,0.4)"/>
                          <span>{addDays(weekStart, dayIdx).toLocaleDateString('it-IT',{weekday:'short',day:'2-digit',month:'short'})}</span>
                          {item.completed_at && (
                            <span style={{color:'#34D399',fontWeight:700}}>
                              · ✓ {new Date(item.completed_at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}
                            </span>
                          )}
                        </div>

                        <div style={{display:'flex',alignItems:'center',gap:5}}>
                          <button onClick={e=>{e.stopPropagation();cycleStatus(item.id,item.status);}}
                            title="Clicca per cambiare stato"
                            style={{flex:1,display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:20,border:`1px solid ${st.color}40`,background:`${st.color}20`,color:st.color,fontSize:11,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
                            <div style={{width:6,height:6,borderRadius:'50%',background:st.color,flexShrink:0}}/>{st.label}
                          </button>
                          <button
                            onClick={e=>{e.stopPropagation(); if(confirm(`Eliminare la consegna a ${item.storeName}?`)) handleRemove(item.id);}}
                            title="Elimina"
                            style={{display:'flex',alignItems:'center',gap:3,padding:'5px 9px',borderRadius:20,border:'1px solid rgba(248,113,113,0.35)',background:'rgba(248,113,113,0.1)',color:'#F87171',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}
                            onMouseEnter={e=>e.currentTarget.style.background='rgba(248,113,113,0.25)'}
                            onMouseLeave={e=>e.currentTarget.style.background='rgba(248,113,113,0.1)'}>
                            <X size={10}/> Elimina
                          </button>
                        </div>

                      </div>
                    </React.Fragment>
                  );
                })}

                {dragOver?.dayIdx===dayIdx&&dragOver?.idx===items.length&&(
                  <div style={{height:2,borderRadius:1,background:accent,margin:'0 4px',boxShadow:`0 0 6px ${accent}`}}/>
                )}

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

      {/* POPUP DETTAGLI */}
      {detailCard && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
          onClick={()=>setDetailCard(null)}>
          <div style={{background:'#1a1a2e',border:'1px solid rgba(255,255,255,0.1)',borderRadius:20,padding:28,maxWidth:420,width:'100%',position:'relative'}}
            onClick={e=>e.stopPropagation()}>
            <button onClick={()=>setDetailCard(null)}
              style={{position:'absolute',top:14,right:14,background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.4)'}}>
              <X size={18}/>
            </button>
            <div style={{fontWeight:900,fontSize:18,color:'#fff',marginBottom:18}}>{detailCard.storeName}</div>
            <div style={{display:'flex',flexDirection:'column',gap:12,fontSize:13}}>
              {[
                ['Stato', ST[detailCard.status]?.label || detailCard.status],
                ['Priorità', detailCard.priority==='high'?'🔴 Urgente':detailCard.priority==='low'?'🟢 Bassa':'🟡 Normale'],
                detailCard.items && ['Articoli', detailCard.items],
                detailCard.notes && ['Note', detailCard.notes],
                detailCard.driver_note && ['Nota Corriere', detailCard.driver_note],
                detailCard.completed_at && ['Consegnato il', new Date(detailCard.completed_at).toLocaleString('it-IT')],
              ].filter(Boolean).map(([label,value])=>(
                <div key={label} style={{display:'flex',gap:10,padding:'8px 12px',background:'rgba(255,255,255,0.04)',borderRadius:10}}>
                  <span style={{color:'rgba(255,255,255,0.4)',fontWeight:700,minWidth:100}}>{label}</span>
                  <span style={{color:'#fff',fontWeight:600}}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function topBtn(c){ return {display:'flex',alignItems:'center',gap:5,padding:'7px 13px',borderRadius:9,border:`1px solid ${c}35`,background:`${c}15`,color:c,fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit'}; }
function navBtn(){ return {width:34,height:34,borderRadius:9,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.04)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--color-text,#F1F5F9)'}; }
