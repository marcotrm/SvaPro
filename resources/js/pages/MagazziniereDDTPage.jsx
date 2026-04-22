import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { stockTransfers, stores as storesApi, catalog } from '../api.jsx';
import { Package, Send, CheckCircle, XCircle, Plus, Scan, ArrowRightLeft, ChevronDown, ChevronUp, Trash2, Truck } from 'lucide-react';

const STATUS = {
  draft:      { label: 'Bozza',       color: '#6366f1', bg: 'rgba(99,102,241,.15)' },
  in_transit: { label: 'In Transito', color: '#f59e0b', bg: 'rgba(245,158,11,.15)' },
  received:   { label: 'Ricevuto',    color: '#22c55e', bg: 'rgba(34,197,94,.15)' },
  cancelled:  { label: 'Annullato',   color: '#ef4444', bg: 'rgba(239,68,68,.15)' },
};

const fmtDate = v => v ? new Date(v).toLocaleDateString('it-IT') : '-';

const s = {
  page: { minHeight:'100vh', background:'#0a0a0f', color:'#e2e8f0', fontFamily:'Inter,system-ui,sans-serif', padding:'12px 12px 100px' },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 },
  title: { fontSize:20, fontWeight:800, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' },
  sub: { fontSize:12, color:'#94a3b8', marginTop:2 },
  btnPrimary: { display:'flex', alignItems:'center', gap:6, padding:'10px 16px', borderRadius:12, border:'none', cursor:'pointer', fontWeight:700, fontSize:14, color:'#fff', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow:'0 4px 15px rgba(99,102,241,.3)' },
  btnGhost: { padding:'8px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,.1)', background:'rgba(255,255,255,.04)', color:'#94a3b8', fontSize:13, fontWeight:600, cursor:'pointer' },
  btnSuccess: { padding:'10px 16px', borderRadius:12, border:'none', cursor:'pointer', fontWeight:700, fontSize:14, color:'#fff', background:'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow:'0 4px 15px rgba(34,197,94,.3)', display:'flex', alignItems:'center', gap:6 },
  btnDanger: { padding:'8px 14px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:600, fontSize:13, color:'#ef4444', background:'rgba(239,68,68,.1)' },
  card: { background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:16, padding:16, marginBottom:12, backdropFilter:'blur(10px)' },
  filterBar: { display:'flex', gap:6, overflowX:'auto', marginBottom:16, paddingBottom:4 },
  chip: (active) => ({ padding:'8px 14px', borderRadius:20, border:'none', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', color: active ? '#fff' : '#94a3b8', background: active ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,.06)' }),
  badge: (st) => ({ display:'inline-flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:8, fontSize:11, fontWeight:700, color: st?.color||'#94a3b8', background: st?.bg||'rgba(255,255,255,.06)' }),
  input: { width:'100%', padding:'12px 14px', borderRadius:12, border:'1px solid rgba(255,255,255,.1)', background:'rgba(255,255,255,.06)', color:'#e2e8f0', fontSize:14, outline:'none', boxSizing:'border-box' },
  select: { width:'100%', padding:'12px 14px', borderRadius:12, border:'1px solid rgba(255,255,255,.1)', background:'rgba(255,255,255,.06)', color:'#e2e8f0', fontSize:14, outline:'none', boxSizing:'border-box', appearance:'none' },
  label: { fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'#64748b', marginBottom:6, display:'block' },
  kpiRow: { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 },
  kpi: (c) => ({ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.06)', borderRadius:12, padding:'12px 10px', textAlign:'center' }),
  kpiVal: (c) => ({ fontSize:22, fontWeight:800, color: c }),
  kpiLbl: { fontSize:10, fontWeight:600, color:'#64748b', textTransform:'uppercase', marginTop:2 },
  overlay: { position:'fixed', inset:0, zIndex:9000, background:'rgba(0,0,0,.7)', backdropFilter:'blur(6px)', display:'flex', alignItems:'flex-end', justifyContent:'center' },
  modal: { background:'#12121a', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:500, maxHeight:'90vh', display:'flex', flexDirection:'column', border:'1px solid rgba(255,255,255,.08)' },
  modalHead: { padding:'20px 20px 12px', borderBottom:'1px solid rgba(255,255,255,.06)', display:'flex', alignItems:'center', justifyContent:'space-between' },
  modalBody: { padding:20, overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:16 },
  scannerBox: { display:'flex', gap:8, alignItems:'center', background:'rgba(99,102,241,.08)', border:'1px solid rgba(99,102,241,.2)', borderRadius:12, padding:12 },
  itemRow: { display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:'rgba(255,255,255,.03)', borderRadius:10, border:'1px solid rgba(255,255,255,.06)' },
};

export default function MagazziniereDDTPage() {
  const { selectedStoreId } = useOutletContext();
  const [list, setList] = useState([]);
  const [stores, setStores] = useState([]);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({ from_store_id:'', to_store_id:'', notes:'', items:[{ product_variant_id:'', quantity_sent:1 }] });
  const [barcode, setBarcode] = useState('');
  const barcodeRef = useRef(null);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(null);

  useEffect(() => { fetchAll(); }, [filter]);

  const fetchAll = async () => {
    try {
      setLoading(true); setError('');
      const params = {};
      if (filter !== 'all') params.status = filter;
      if (selectedStoreId) params.store_id = selectedStoreId;
      const [tRes, sRes] = await Promise.all([stockTransfers.getAll(params), storesApi.getStores()]);
      setList(tRes.data?.data || []);
      setStores(sRes.data?.data || []);
    } catch(e) { setError(e.response?.data?.message || e.message); }
    finally { setLoading(false); }
  };

  const loadVariants = async (storeId) => {
    if (!storeId) return;
    try {
      const res = await catalog.getProducts({ store_id: storeId, limit: 500, include_variants: 1 });
      const all = [];
      (res.data?.data || []).forEach(p => {
        (p.variants || []).forEach(v => {
          all.push({ id: v.id, label: `${p.name}${v.flavor?' - '+v.flavor:''}${v.resistance_ohm?' '+v.resistance_ohm+'O':''}`, sku: v.sku||'', barcode: v.barcode||'', on_hand: v.on_hand??0 });
        });
      });
      setVariants(all);
    } catch { setVariants([]); }
  };

  const handleFromStore = (sid) => {
    setForm(f => ({ ...f, from_store_id: sid, items:[{ product_variant_id:'', quantity_sent:1 }] }));
    setVariants([]);
    if (sid) loadVariants(sid);
  };

  const addItem = () => setForm(f => ({ ...f, items:[...f.items, { product_variant_id:'', quantity_sent:1 }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_,idx) => idx !== i) }));
  const updateItem = (i, field, val) => { const items=[...form.items]; items[i]={...items[i],[field]:val}; setForm(f=>({...f,items})); };

  const handleBarcode = (e) => {
    if (e.key !== 'Enter' || !barcode.trim()) return;
    const bc = barcode.trim().toLowerCase();
    const found = variants.find(v => v.barcode?.toLowerCase()===bc || v.sku?.toLowerCase()===bc);
    if (found) {
      const idx = form.items.findIndex(i => String(i.product_variant_id)===String(found.id));
      if (idx >= 0) { updateItem(idx,'quantity_sent',form.items[idx].quantity_sent+1); }
      else {
        const items=[...form.items];
        if (!items[items.length-1].product_variant_id) items[items.length-1]={ product_variant_id:String(found.id), quantity_sent:1 };
        else items.push({ product_variant_id:String(found.id), quantity_sent:1 });
        setForm(f=>({...f,items}));
      }
      setBarcode('');
      barcodeRef.current?.focus();
    } else { setError(`Barcode "${barcode}" non trovato`); setBarcode(''); }
  };

  const handleCreate = async () => {
    if (!form.from_store_id || !form.to_store_id) { setError('Seleziona mittente e destinatario'); return; }
    if (form.items.some(i => !i.product_variant_id || i.quantity_sent < 1)) { setError('Compila tutti i prodotti'); return; }
    try { setSaving(true); setError(''); await stockTransfers.create(form); setShowNew(false); setForm({ from_store_id:'', to_store_id:'', notes:'', items:[{ product_variant_id:'', quantity_sent:1 }] }); setVariants([]); await fetchAll(); }
    catch(e) { setError(e.response?.data?.message || e.message); }
    finally { setSaving(false); }
  };

  const handleSend = async (id) => {
    if (!confirm('Inviare il DDT? Lo stock verra scalato.')) return;
    try { setError(''); await stockTransfers.send(id); await fetchAll(); } catch(e) { setError(e.response?.data?.message||e.message); }
  };
  const handleReceive = async (id) => {
    if (!confirm('Confermare ricezione?')) return;
    try { setError(''); await stockTransfers.receive(id); await fetchAll(); } catch(e) { setError(e.response?.data?.message||e.message); }
  };
  const handleCancel = async (id) => {
    if (!confirm('Annullare il DDT?')) return;
    try { setError(''); await stockTransfers.cancel(id); await fetchAll(); } catch(e) { setError(e.response?.data?.message||e.message); }
  };
  const handleDelete = async (id) => {
    if (!confirm('Eliminare definitivamente?')) return;
    try { setError(''); await stockTransfers.delete(id); await fetchAll(); } catch(e) { setError(e.response?.data?.message||e.message); }
  };

  const counts = { draft: list.filter(t=>t.status==='draft').length, in_transit: list.filter(t=>t.status==='in_transit').length, received: list.filter(t=>t.status==='received').length };
  const filteredSuggestions = (q) => q.length >= 1 ? variants.filter(v => v.label.toLowerCase().includes(q.toLowerCase())).slice(0,8) : [];

  if (loading && list.length === 0) return <div style={s.page}><div style={{textAlign:'center',padding:60,color:'#64748b'}}>Caricamento...</div></div>;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.title}>Trasferimenti DDT</div>
          <div style={s.sub}>Gestione magazzino</div>
        </div>
        <button style={s.btnPrimary} onClick={() => { setShowNew(true); setForm({ from_store_id:'', to_store_id:'', notes:'', items:[{ product_variant_id:'', quantity_sent:1 }] }); setVariants([]); }}>
          <Plus size={16} /> Nuovo
        </button>
      </div>

      {/* KPIs */}
      <div style={s.kpiRow}>
        <div style={s.kpi()}><div style={s.kpiVal('#6366f1')}>{counts.draft}</div><div style={s.kpiLbl}>Bozze</div></div>
        <div style={s.kpi()}><div style={s.kpiVal('#f59e0b')}>{counts.in_transit}</div><div style={s.kpiLbl}>In Transito</div></div>
        <div style={s.kpi()}><div style={s.kpiVal('#22c55e')}>{counts.received}</div><div style={s.kpiLbl}>Ricevuti</div></div>
      </div>

      {/* Filters */}
      <div style={s.filterBar}>
        {[['all','Tutti'],['draft','Bozze'],['in_transit','In Transito'],['received','Ricevuti'],['cancelled','Annullati']].map(([k,l]) => (
          <button key={k} style={s.chip(filter===k)} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {error && <div style={{...s.card, borderColor:'rgba(239,68,68,.3)', background:'rgba(239,68,68,.08)', color:'#fca5a5', fontSize:13, marginBottom:12}}>{error} <button onClick={()=>setError('')} style={{float:'right',background:'none',border:'none',color:'#ef4444',cursor:'pointer',fontWeight:700}}>X</button></div>}

      {/* DDT List - Cards */}
      {list.length === 0 ? (
        <div style={{...s.card, textAlign:'center', padding:40, color:'#64748b'}}>
          <Truck size={40} style={{marginBottom:12,opacity:.3}} />
          <div>Nessun trasferimento trovato</div>
          <div style={{fontSize:12,marginTop:4}}>Crea il primo DDT con il pulsante in alto</div>
        </div>
      ) : list.map(t => {
        const st = STATUS[t.status] || { label:t.status, color:'#94a3b8', bg:'rgba(255,255,255,.06)' };
        const isOpen = expanded === t.id;
        const itemCount = (t.items||[]).length;
        const totalPz = (t.items||[]).reduce((a,i) => a+(i.quantity_sent||0), 0);
        return (
          <div key={t.id} style={s.card}>
            {/* Card header */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',cursor:'pointer'}} onClick={() => setExpanded(isOpen?null:t.id)}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                  <span style={{fontWeight:800,fontSize:15,fontFamily:'monospace',color:'#e2e8f0'}}>{t.ddt_number}</span>
                  <span style={s.badge(st)}>{st.label}</span>
                </div>
                <div style={{fontSize:13,color:'#94a3b8'}}>
                  <span style={{fontWeight:600,color:'#c4b5fd'}}>{t.from_store_name}</span>
                  <ArrowRightLeft size={12} style={{margin:'0 6px',verticalAlign:'middle',color:'#6366f1'}} />
                  <span style={{fontWeight:600,color:'#93c5fd'}}>{t.to_store_name}</span>
                </div>
                <div style={{fontSize:11,color:'#64748b',marginTop:4}}>{itemCount} articol{itemCount===1?'o':'i'} - {totalPz} pz - {fmtDate(t.created_at)}</div>
              </div>
              {isOpen ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
            </div>

            {/* Expanded detail */}
            {isOpen && (
              <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid rgba(255,255,255,.06)'}}>
                {(t.items||[]).map((item,i) => (
                  <div key={i} style={{...s.itemRow, marginBottom:6}}>
                    <Package size={14} color="#6366f1" />
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:'#e2e8f0'}}>{item.product_name||'-'}{item.flavor?<span style={{color:'#94a3b8',fontWeight:400}}> - {item.flavor}</span>:''}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:14,fontWeight:800,color:'#6366f1'}}>{item.quantity_sent}</div>
                      {item.quantity_received!=null && <div style={{fontSize:11,color:'#22c55e'}}>Ric: {item.quantity_received}</div>}
                    </div>
                  </div>
                ))}
                {/* Action buttons */}
                <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
                  {t.status==='draft' && <button style={s.btnPrimary} onClick={()=>handleSend(t.id)}><Send size={14}/>Invia</button>}
                  {t.status==='in_transit' && <button style={s.btnSuccess} onClick={()=>handleReceive(t.id)}><CheckCircle size={14}/>Ricevuto</button>}
                  {['draft','in_transit'].includes(t.status) && <button style={s.btnDanger} onClick={()=>handleCancel(t.id)}>Annulla</button>}
                  {['draft','cancelled'].includes(t.status) && <button style={s.btnDanger} onClick={()=>handleDelete(t.id)}><Trash2 size={12}/>Elimina</button>}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* New DDT Modal (bottom sheet) */}
      {showNew && (
        <div style={s.overlay} onClick={() => setShowNew(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHead}>
              <span style={{fontWeight:800,fontSize:18,color:'#e2e8f0'}}>Nuovo DDT</span>
              <button onClick={() => setShowNew(false)} style={{background:'none',border:'none',color:'#64748b',fontSize:22,cursor:'pointer'}}>X</button>
            </div>
            <div style={s.modalBody}>
              {/* From store */}
              <div>
                <label style={s.label}>Mittente *</label>
                <select style={s.select} value={form.from_store_id} onChange={e => handleFromStore(e.target.value)}>
                  <option value="">Seleziona negozio</option>
                  {stores.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              </div>
              {/* To store */}
              <div>
                <label style={s.label}>Destinatario *</label>
                <select style={s.select} value={form.to_store_id} onChange={e => setForm(f=>({...f,to_store_id:e.target.value}))}>
                  <option value="">Seleziona negozio</option>
                  {stores.filter(st => String(st.id)!==String(form.from_store_id)).map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              </div>

              {/* Barcode scanner */}
              {form.from_store_id && (
                <div style={s.scannerBox}>
                  <Scan size={18} color="#6366f1" />
                  <input ref={barcodeRef} style={{...s.input,border:'none',background:'transparent',padding:'6px 0'}} value={barcode} onChange={e=>setBarcode(e.target.value)} onKeyDown={handleBarcode} placeholder="Scansiona barcode / SKU" autoComplete="off" />
                </div>
              )}

              {/* Products */}
              {form.from_store_id && (
                <div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <label style={{...s.label,margin:0}}>Prodotti *</label>
                    <button onClick={addItem} style={{...s.btnGhost,fontSize:11,padding:'4px 10px'}}>+ Aggiungi</button>
                  </div>
                  {form.items.map((item,i) => {
                    const sel = variants.find(v => String(v.id)===String(item.product_variant_id));
                    return (
                      <div key={i} style={{...s.itemRow,marginBottom:8}}>
                        <div style={{flex:1}}>
                          {showSearch===i ? (
                            <div style={{position:'relative'}}>
                              <input style={s.input} autoFocus value={search} onChange={e=>{setSearch(e.target.value);}} placeholder="Cerca prodotto..." />
                              {filteredSuggestions(search).length > 0 && (
                                <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:9999,background:'#1e1e2e',border:'1px solid rgba(255,255,255,.1)',borderRadius:10,maxHeight:200,overflowY:'auto',marginTop:4}}>
                                  {filteredSuggestions(search).map(v => (
                                    <div key={v.id} onClick={()=>{updateItem(i,'product_variant_id',String(v.id));setShowSearch(null);setSearch('');}} style={{padding:'10px 12px',cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,.05)',fontSize:13}}>
                                      <div style={{fontWeight:600}}>{v.label}</div>
                                      <div style={{fontSize:11,color:'#64748b'}}>Disp: {v.on_hand}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div onClick={()=>{setShowSearch(i);setSearch('');}} style={{fontSize:13,fontWeight:sel?600:400,color:sel?'#e2e8f0':'#64748b',cursor:'pointer'}}>
                              {sel ? sel.label : 'Tocca per cercare...'}
                            </div>
                          )}
                        </div>
                        <input type="number" min="1" value={item.quantity_sent} onChange={e=>updateItem(i,'quantity_sent',parseInt(e.target.value)||1)} style={{...s.input,width:60,textAlign:'center',padding:'8px 4px'}} />
                        {form.items.length > 1 && <button onClick={()=>removeItem(i)} style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer'}}><XCircle size={18}/></button>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Notes */}
              <div>
                <label style={s.label}>Note</label>
                <input style={s.input} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Note opzionali..." />
              </div>

              {/* Submit */}
              <div style={{display:'flex',gap:8}}>
                <button style={{...s.btnGhost,flex:1}} onClick={()=>setShowNew(false)}>Annulla</button>
                <button style={{...s.btnPrimary,flex:1,justifyContent:'center'}} onClick={handleCreate} disabled={saving}>{saving?'Creazione...':'Crea DDT'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
