import React, { useState, useEffect, useRef } from 'react';
import { Truck, Plus, Check, ChevronLeft, ChevronRight, X, AlertCircle, CheckCircle2, Circle, Trash2, Copy, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { stores } from '../api.jsx';

const STORAGE_KEY = 'svapro_store_deliveries_v2';
const TPL_KEY     = 'svapro_store_deliveries_tpl_v2';
const loadAll     = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
const saveAll     = (l) => localStorage.setItem(STORAGE_KEY, JSON.stringify(l));
const loadTpl     = () => { try { return JSON.parse(localStorage.getItem(TPL_KEY) || 'null'); } catch { return null; } };
const saveTpl     = (t) => localStorage.setItem(TPL_KEY, JSON.stringify(t));
const newId       = () => `del_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;

const DAYS_IT = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
const DAYS_SH = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

function getMonday(d) {
  const dt = new Date(d); const day = dt.getDay();
  dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day));
  dt.setHours(0,0,0,0); return dt;
}
function addDays(d, n) { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt; }
function toISO(d)  { return d.toISOString().slice(0,10); }
function fmtDay(d) { return d.toLocaleDateString('it-IT', { day:'2-digit', month:'short' }); }

const STATUS = {
  pending:     { label:'Da fare',    color:'#F59E0B', bg:'rgba(245,158,11,0.12)',  Icon: Circle },
  in_progress: { label:'In corso',  color:'#3B82F6', bg:'rgba(59,130,246,0.12)',  Icon: Truck },
  done:        { label:'Consegnato',color:'#10B981', bg:'rgba(16,185,129,0.12)',  Icon: CheckCircle2 },
  issue:       { label:'Problema',  color:'#EF4444', bg:'rgba(239,68,68,0.12)',   Icon: AlertCircle },
};

export default function StoreDeliveriesPage() {
  const [deliveries, setDeliveries] = useState(loadAll);
  const [storeList,  setStoreList]  = useState([]);
  const [weekStart,  setWeekStart]  = useState(() => getMonday(new Date()));
  const [template,   setTemplate]   = useState(loadTpl);
  const [showModal,  setShowModal]  = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [form,       setForm]       = useState({ store_id:'', store_name:'', priority:'normal', scheduled_date:'' });
  const dragRef = useRef(null); // { id, fromDate, fromStoreId }
  const [dragOver, setDragOver] = useState(null); // 'storeId|dateStr'

  useEffect(() => {
    stores.getAll?.().then(r => setStoreList(r.data?.data || r.data || [])).catch(() => {});
  }, []);

  // ── Auto-applica template a settimane vuote ──
  useEffect(() => {
    if (!template) return;
    const weekDates = Array.from({length:7}, (_,i) => toISO(addDays(weekStart,i)));
    const hasData = deliveries.some(d => weekDates.includes(d.scheduled_date));
    if (hasData) return;
    // Crea le consegne dal template
    const newDels = [];
    template.forEach(({ storeId, storeName, dayIndex }) => {
      const dateStr = toISO(addDays(weekStart, dayIndex));
      newDels.push({ id: newId(), store_id: storeId, store_name: storeName, priority:'normal', scheduled_date: dateStr, status:'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    });
    if (newDels.length > 0) {
      const merged = [...deliveries, ...newDels];
      setDeliveries(merged); saveAll(merged);
    }
  }, [weekStart, template]);

  const weekDays = Array.from({length:7}, (_,i) => {
    const d = addDays(weekStart, i);
    return { dateStr: toISO(d), label: DAYS_IT[i], short: DAYS_SH[i], display: fmtDay(d) };
  });
  const fmtWeekRange = () => {
    const from = addDays(weekStart,0).toLocaleDateString('it-IT', { day:'2-digit', month:'long' });
    const to   = addDays(weekStart,6).toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });
    return `${from} — ${to}`;
  };

  const persist = (list) => { setDeliveries(list); saveAll(list); };

  const openCreate = (storeId, storeName, dateStr) => {
    setForm({ store_id: String(storeId||''), store_name: storeName||'', priority:'normal', scheduled_date: dateStr||'' });
    setEditId(null); setShowModal(true);
  };
  const openEdit = (d) => {
    setForm({ store_id: String(d.store_id||''), store_name: d.store_name||'', priority: d.priority||'normal', scheduled_date: d.scheduled_date||'' });
    setEditId(d.id); setShowModal(true);
  };
  const handleSave = () => {
    const sName = form.store_name || storeList.find(s => String(s.id) === form.store_id)?.name || form.store_id;
    if (!sName) return toast.error('Seleziona un negozio');
    if (!form.scheduled_date) return toast.error('Seleziona una data');
    if (editId) {
      persist(deliveries.map(d => d.id === editId ? { ...d, ...form, store_name: sName, updated_at: new Date().toISOString() } : d));
      toast.success('Consegna aggiornata');
    } else {
      persist([{ id: newId(), ...form, store_name: sName, status:'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...deliveries]);
      toast.success(`Consegna aggiunta per ${sName}`);
    }
    setShowModal(false); setEditId(null);
  };
  const handleDelete = (id) => {
    if (!confirm('Eliminare questa consegna?')) return;
    persist(deliveries.filter(d => d.id !== id)); toast.success('Eliminata');
  };
  const toggleStatus = (id) => {
    const d = deliveries.find(x => x.id === id); if (!d) return;
    const order = ['pending','in_progress','done','issue'];
    const next = order[(order.indexOf(d.status)+1) % order.length];
    persist(deliveries.map(x => x.id === id ? { ...x, status: next, updated_at: new Date().toISOString() } : x));
  };

  // ── Salva template dalla settimana corrente ──
  const handleSaveTemplate = () => {
    const weekDates = Array.from({length:7}, (_,i) => toISO(addDays(weekStart,i)));
    const tpl = [];
    weekDates.forEach((dateStr, dayIndex) => {
      deliveries.filter(d => d.scheduled_date === dateStr).forEach(d => {
        tpl.push({ storeId: String(d.store_id), storeName: d.store_name, dayIndex });
      });
    });
    setTemplate(tpl); saveTpl(tpl);
    toast.success('Template salvato! Verrà applicato a tutte le nuove settimane.');
  };

  // ── DnD: drag delivery tra celle ──
  const onDragStart = (e, delivery) => {
    dragRef.current = { id: delivery.id, fromDate: delivery.scheduled_date, fromStoreId: String(delivery.store_id) };
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e, storeId, dateStr) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    setDragOver(`${storeId}|${dateStr}`);
  };
  const onDrop = (e, toStoreId, toStoreName, toDate) => {
    e.preventDefault(); setDragOver(null);
    const { id, fromDate, fromStoreId } = dragRef.current || {};
    if (!id) return;
    if (fromDate === toDate && fromStoreId === String(toStoreId)) return;
    persist(deliveries.map(d => d.id === id
      ? { ...d, scheduled_date: toDate, store_id: String(toStoreId), store_name: toStoreName, status:'pending', updated_at: new Date().toISOString() }
      : d
    ));
    dragRef.current = null;
  };
  const onDragLeave = () => setDragOver(null);

  // ── Griglia ──
  const deliveriesThisWeek = deliveries.filter(d => weekDays.some(w => w.dateStr === d.scheduled_date));
  const storesInGrid = (() => {
    const map = new Map();
    storeList.forEach(s => map.set(String(s.id), { id: String(s.id), name: s.name || '' }));
    deliveriesThisWeek.forEach(d => { if (d.store_id && !map.has(String(d.store_id))) map.set(String(d.store_id), { id: String(d.store_id), name: d.store_name }); });
    return Array.from(map.values());
  })();
  const cellDels = (storeId, dateStr) => deliveries.filter(d => d.scheduled_date === dateStr && String(d.store_id) === String(storeId));
  const todayStr = toISO(new Date());
  const counts   = Object.fromEntries(Object.keys(STATUS).map(k => [k, deliveries.filter(d => d.status === k).length]));

  return (
    <div style={{ padding: '20px 24px', display:'flex', flexDirection:'column', gap:20, height:'100%', boxSizing:'border-box' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ background:'linear-gradient(135deg,#7B6FD0,#5B50B0)', borderRadius:14, width:46, height:46, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(123,111,208,0.3)', flexShrink:0 }}>
            <Truck size={21} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize:20, fontWeight:900, margin:0 }}>Consegne Negozi</h1>
            <p style={{ fontSize:12, color:'var(--color-text-tertiary)', margin:0 }}>Pianifica le consegne · trascina per spostare · salva come template</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <button onClick={handleSaveTemplate} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 13px', borderRadius:9, border:'1px solid rgba(123,111,208,0.4)', background:'rgba(123,111,208,0.08)', color:'#7B6FD0', fontWeight:700, fontSize:12, cursor:'pointer' }}>
            <Save size={13} /> Salva template
          </button>
          {template && (
            <button onClick={() => { if(confirm('Applica template a questa settimana?')) { const weekDates = Array.from({length:7},(_,i)=>toISO(addDays(weekStart,i))); const newDels=[]; template.forEach(({storeId,storeName,dayIndex})=>{ newDels.push({id:newId(),store_id:storeId,store_name:storeName,priority:'normal',scheduled_date:weekDates[dayIndex],status:'pending',created_at:new Date().toISOString(),updated_at:new Date().toISOString()}); }); const merged=[...deliveries.filter(d=>!weekDates.includes(d.scheduled_date)),...newDels]; persist(merged); toast.success('Template applicato!'); } }} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 13px', borderRadius:9, border:'1px solid var(--color-border)', background:'var(--color-surface)', fontWeight:700, fontSize:12, cursor:'pointer' }}>
              <Copy size={13} /> Applica template
            </button>
          )}
          <button onClick={() => openCreate('','','')} className="sp-btn sp-btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Plus size={14} /> Nuova Consegna
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display:'flex', gap:10 }}>
        {Object.entries(STATUS).map(([k,s]) => {
          const { Icon } = s;
          return (
            <div key={k} style={{ flex:1, background:'var(--color-surface)', border:`1.5px solid ${s.color}30`, borderRadius:12, padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Icon size={17} color={s.color} />
              </div>
              <div>
                <div style={{ fontSize:22, fontWeight:900, color:'var(--color-text)', lineHeight:1 }}>{counts[k]||0}</div>
                <div style={{ fontSize:10, fontWeight:700, color:s.color, textTransform:'uppercase', marginTop:2 }}>{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigazione settimana */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:16 }}>
        <button onClick={() => setWeekStart(d => addDays(d,-7))} style={{ width:34, height:34, borderRadius:10, border:'1px solid var(--color-border)', background:'var(--color-surface)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><ChevronLeft size={18} /></button>
        <div style={{ fontSize:15, fontWeight:800, color:'var(--color-text)', minWidth:280, textAlign:'center' }}>{fmtWeekRange()}</div>
        <button onClick={() => setWeekStart(d => addDays(d,7))}  style={{ width:34, height:34, borderRadius:10, border:'1px solid var(--color-border)', background:'var(--color-surface)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><ChevronRight size={18} /></button>
        <button onClick={() => setWeekStart(getMonday(new Date()))} style={{ padding:'6px 12px', borderRadius:8, border:'1px solid var(--color-border)', background:'var(--color-surface)', cursor:'pointer', fontSize:11, fontWeight:700, color:'var(--color-text-secondary)' }}>Oggi</button>
      </div>

      {/* Griglia tabella */}
      <div style={{ overflowX:'auto', flex:1, borderRadius:14, border:'1px solid var(--color-border)', background:'var(--color-surface)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
          <thead>
            <tr>
              <th style={{ padding:'12px 16px', fontSize:11, fontWeight:800, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'left', background:'var(--color-bg)', borderBottom:'2px solid var(--color-border)', borderRight:'1px solid var(--color-border)', position:'sticky', left:0, zIndex:3, minWidth:160, whiteSpace:'nowrap' }}>
                Store / Negozio
              </th>
              {weekDays.map(day => {
                const isToday = day.dateStr === todayStr;
                return (
                  <th key={day.dateStr} style={{ padding:'10px 8px', fontSize:12, fontWeight:700, textAlign:'center', background: isToday ? 'rgba(123,111,208,0.08)' : 'var(--color-bg)', borderBottom:`2px solid ${isToday ? '#7B6FD0' : 'var(--color-border)'}`, borderRight:'1px solid var(--color-border)', color: isToday ? '#7B6FD0' : 'var(--color-text)', minWidth:128, position:'sticky', top:0, zIndex:2 }}>
                    <div style={{ fontWeight:800 }}>{day.short}</div>
                    <div style={{ fontSize:11, fontWeight:500, color: isToday ? '#7B6FD0' : 'var(--color-text-tertiary)', marginTop:2 }}>{day.display}</div>
                    {isToday && <div style={{ width:6, height:6, borderRadius:3, background:'#7B6FD0', margin:'4px auto 0' }} />}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {storesInGrid.length === 0 ? (
              <tr><td colSpan={8} style={{ padding:'60px 20px', textAlign:'center', color:'var(--color-text-tertiary)' }}>
                <Truck size={40} style={{ opacity:0.2, marginBottom:12 }} />
                <div style={{ fontSize:14, fontWeight:600 }}>Nessun negozio</div>
                <div style={{ fontSize:12, marginTop:4 }}>Aggiungi una consegna o salva un template</div>
              </td></tr>
            ) : storesInGrid.map((store, si) => (
              <tr key={store.id} style={{ background: si%2===0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                {/* Nome negozio sticky */}
                <td style={{ padding:'10px 14px', fontWeight:800, fontSize:13, color:'var(--color-text)', background: si%2===0 ? 'var(--color-surface)' : 'var(--color-bg)', borderBottom:'1px solid var(--color-border)', borderRight:'1px solid var(--color-border)', position:'sticky', left:0, zIndex:1, whiteSpace:'nowrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:`hsl(${(si*47+220)%360},60%,55%)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:900, color:'#fff', flexShrink:0 }}>
                      {store.name.charAt(0).toUpperCase()}
                    </div>
                    {store.name}
                  </div>
                </td>
                {/* Celle per ogni giorno */}
                {weekDays.map(day => {
                  const isToday   = day.dateStr === todayStr;
                  const cell      = cellDels(store.id, day.dateStr);
                  const dropKey   = `${store.id}|${day.dateStr}`;
                  const isDragTgt = dragOver === dropKey;
                  return (
                    <td key={day.dateStr}
                      onDragOver={e  => onDragOver(e, store.id, day.dateStr)}
                      onDrop={e      => onDrop(e, store.id, store.name, day.dateStr)}
                      onDragLeave={onDragLeave}
                      style={{ padding:6, verticalAlign:'top', height:80, borderBottom:'1px solid var(--color-border)', borderRight:'1px solid var(--color-border)', background: isDragTgt ? 'rgba(123,111,208,0.12)' : isToday ? 'rgba(123,111,208,0.04)' : 'transparent', position:'relative', cursor:'default', transition:'background 0.1s', outline: isDragTgt ? '2px dashed #7B6FD0' : 'none', outlineOffset:-2 }}
                    >
                      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                        {cell.map(d => {
                          const st = STATUS[d.status] || STATUS.pending;
                          return (
                            <div key={d.id}
                              draggable
                              onDragStart={e => onDragStart(e, d)}
                              style={{ background:st.bg, border:`1px solid ${st.color}40`, borderLeft:`3px solid ${st.color}`, borderRadius:6, padding:'4px 7px', fontSize:11, fontWeight:700, color:'var(--color-text)', cursor:'grab', display:'flex', alignItems:'center', justifyContent:'space-between', gap:4, transition:'opacity 0.1s, box-shadow 0.1s', userSelect:'none' }}
                              onMouseEnter={e => e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.15)'}
                              onMouseLeave={e => e.currentTarget.style.boxShadow='none'}
                              onClick={() => openEdit(d)}
                            >
                              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
                                {d.store_name}
                              </span>
                              <div style={{ display:'flex', gap:2, flexShrink:0 }}>
                                <button title={st.label} onClick={e => { e.stopPropagation(); toggleStatus(d.id); }} style={{ background:'none', border:'none', cursor:'pointer', padding:1, display:'flex', borderRadius:4, color:st.color }}>
                                  <st.Icon size={11} />
                                </button>
                                <button onClick={e => { e.stopPropagation(); handleDelete(d.id); }} style={{ background:'none', border:'none', cursor:'pointer', padding:1, display:'flex', borderRadius:4, color:'#EF4444', opacity:0.6 }}>
                                  <X size={10} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Btn + */}
                      <button
                        onClick={() => openCreate(store.id, store.name, day.dateStr)}
                        style={{ position:'absolute', bottom:4, right:4, width:20, height:20, borderRadius:5, border:'1px dashed var(--color-border)', background:'transparent', cursor:'pointer', color:'var(--color-text-tertiary)', fontSize:14, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1, padding:0, transition:'all 0.1s' }}
                        onMouseEnter={e => { e.currentTarget.style.background='rgba(123,111,208,0.12)'; e.currentTarget.style.color='#7B6FD0'; e.currentTarget.style.borderColor='#7B6FD0'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--color-text-tertiary)'; e.currentTarget.style.borderColor='var(--color-border)'; }}
                      >+</button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:9000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={() => setShowModal(false)}>
          <div style={{ background:'var(--color-surface)', borderRadius:18, padding:28, width:'100%', maxWidth:500, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:16, fontWeight:900, margin:0 }}>{editId ? 'Modifica Consegna' : 'Nuova Consegna'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--color-text-secondary)' }}><X size={18} /></button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label className="sp-label">Negozio *</label>
                <select className="sp-select" value={form.store_id} onChange={e => { const s = storeList.find(x => String(x.id) === e.target.value); setForm(f => ({ ...f, store_id: e.target.value, store_name: s ? (s.name||s.store_name) : '' })); }}>
                  <option value="">— Seleziona negozio —</option>
                  {storeList.map(s => <option key={s.id} value={s.id}>{s.name||s.store_name}</option>)}
                </select>
              </div>
              <div>
                <label className="sp-label">Data *</label>
                <input className="sp-input" type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} />
              </div>
              <div>
                <label className="sp-label">Priorità</label>
                <select className="sp-select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  <option value="low">🟢 Bassa</option>
                  <option value="normal">🟡 Normale</option>
                  <option value="high">🔴 Urgente</option>
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:20, justifyContent:'flex-end' }}>
              {editId && <button className="sp-btn" onClick={() => { handleDelete(editId); setShowModal(false); }} style={{ color:'#EF4444', borderColor:'rgba(239,68,68,0.3)', marginRight:'auto' }}><Trash2 size={13} /> Elimina</button>}
              <button className="sp-btn sp-btn-ghost" onClick={() => setShowModal(false)}>Annulla</button>
              <button className="sp-btn sp-btn-primary" onClick={handleSave}><Check size={14} /> {editId ? 'Salva' : 'Crea'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
