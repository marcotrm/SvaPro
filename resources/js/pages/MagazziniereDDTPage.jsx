import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { stockTransfers, stores as storesApi, catalog } from '../api.jsx';
import { Package, Send, CheckCircle, XCircle, Plus, Scan, ArrowRight,
         ChevronDown, ChevronUp, Trash2, Truck, X } from 'lucide-react';

const STATUS_MAP = {
  draft:      { label: 'Bozza',       cls: 'sp-badge-info' },
  in_transit: { label: 'In Transito', cls: 'sp-badge-warning' },
  received:   { label: 'Ricevuto',    cls: 'sp-badge-success' },
  cancelled:  { label: 'Annullato',   cls: 'sp-badge-secondary' },
};

const fmtDate = v => v ? new Date(v).toLocaleDateString('it-IT') : '-';

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
      if (idx >= 0) updateItem(idx,'quantity_sent',form.items[idx].quantity_sent+1);
      else {
        const items=[...form.items];
        if (!items[items.length-1].product_variant_id) items[items.length-1]={ product_variant_id:String(found.id), quantity_sent:1 };
        else items.push({ product_variant_id:String(found.id), quantity_sent:1 });
        setForm(f=>({...f,items}));
      }
      setBarcode('');
    } else { setError(`Barcode "${barcode}" non trovato`); setBarcode(''); }
  };

  const handleCreate = async () => {
    if (!form.from_store_id || !form.to_store_id) { setError('Seleziona mittente e destinatario'); return; }
    if (form.items.some(i => !i.product_variant_id || i.quantity_sent < 1)) { setError('Compila tutti i prodotti'); return; }
    try { setSaving(true); setError(''); await stockTransfers.create(form); setShowNew(false); setForm({ from_store_id:'', to_store_id:'', notes:'', items:[{ product_variant_id:'', quantity_sent:1 }] }); setVariants([]); await fetchAll(); }
    catch(e) { setError(e.response?.data?.message || e.message); }
    finally { setSaving(false); }
  };

  const handleAction = async (action, id) => {
    const messages = { send: 'Inviare il DDT? Lo stock verra scalato.', receive: 'Confermare ricezione?', cancel: 'Annullare il DDT?', delete: 'Eliminare definitivamente?' };
    if (!confirm(messages[action])) return;
    try {
      setError('');
      if (action === 'send') await stockTransfers.send(id);
      else if (action === 'receive') await stockTransfers.receive(id);
      else if (action === 'cancel') await stockTransfers.cancel(id);
      else if (action === 'delete') await stockTransfers.delete(id);
      await fetchAll();
    } catch(e) { setError(e.response?.data?.message||e.message); }
  };

  const counts = { draft: list.filter(t=>t.status==='draft').length, in_transit: list.filter(t=>t.status==='in_transit').length, received: list.filter(t=>t.status==='received').length };
  const suggestions = (q) => q.length >= 1 ? variants.filter(v => v.label.toLowerCase().includes(q.toLowerCase())).slice(0,8) : [];

  if (loading && list.length === 0) return <div className="mag-page"><div className="mag-empty">Caricamento...</div></div>;

  return (
    <div className="mag-page">
      {/* Header */}
      <div className="mag-header">
        <div>
          <h1>Trasferimenti DDT</h1>
          <div className="mag-sub">Gestione magazzino</div>
        </div>
        <button className="sp-btn sp-btn-primary" onClick={() => { setShowNew(true); setForm({ from_store_id:'', to_store_id:'', notes:'', items:[{ product_variant_id:'', quantity_sent:1 }] }); setVariants([]); }}>
          <Plus size={16} /> Nuovo
        </button>
      </div>

      {/* KPIs */}
      <div className="mag-kpis">
        <div className="mag-kpi">
          <div className="mag-kpi-val" style={{color:'var(--color-info)'}}>{counts.draft}</div>
          <div className="mag-kpi-label">Bozze</div>
        </div>
        <div className="mag-kpi">
          <div className="mag-kpi-val" style={{color:'var(--color-warning)'}}>{counts.in_transit}</div>
          <div className="mag-kpi-label">In Transito</div>
        </div>
        <div className="mag-kpi">
          <div className="mag-kpi-val" style={{color:'var(--color-success)'}}>{counts.received}</div>
          <div className="mag-kpi-label">Ricevuti</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mag-filters">
        {[['all','Tutti'],['draft','Bozze'],['in_transit','In Transito'],['received','Ricevuti'],['cancelled','Annullati']].map(([k,l]) => (
          <button key={k} className={`mag-chip ${filter===k?'active':''}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {error && <div className="mag-error">{error} <button onClick={()=>setError('')} style={{background:'none',border:'none',color:'var(--color-error)',fontWeight:700,cursor:'pointer'}}>X</button></div>}

      {/* DDT List */}
      {list.length === 0 ? (
        <div className="mag-empty">
          <Truck size={40} />
          <div style={{marginTop:8,fontWeight:600}}>Nessun trasferimento</div>
          <div style={{fontSize:12,marginTop:4}}>Crea il primo DDT con il pulsante in alto</div>
        </div>
      ) : list.map(t => {
        const st = STATUS_MAP[t.status] || { label:t.status, cls:'sp-badge-secondary' };
        const isOpen = expanded === t.id;
        const items = t.items || [];
        const totalPz = items.reduce((a,i) => a+(i.quantity_sent||0), 0);
        return (
          <div key={t.id} className="mag-card">
            <div className="mag-card-head" onClick={() => setExpanded(isOpen?null:t.id)}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <span className="mag-ddt-num">{t.ddt_number}</span>
                  <span className={`mag-badge mag-badge-${t.status}`}>{st.label}</span>
                </div>
                <div className="mag-stores">
                  <span className="from">{t.from_store_name}</span>
                  <ArrowRight size={12} className="arrow" style={{verticalAlign:'middle',margin:'0 4px',color:'var(--color-text-tertiary)'}} />
                  <span className="to">{t.to_store_name}</span>
                </div>
                <div className="mag-meta">{items.length} art. - {totalPz} pz - {fmtDate(t.created_at)}</div>
              </div>
              {isOpen ? <ChevronUp size={18} color="var(--color-text-tertiary)" /> : <ChevronDown size={18} color="var(--color-text-tertiary)" />}
            </div>

            {isOpen && (
              <div className="mag-detail">
                {items.map((item,i) => (
                  <div key={i} className="mag-item">
                    <Package size={14} style={{color:'var(--color-accent)',flexShrink:0}} />
                    <div className="mag-item-name">
                      {item.product_name||'-'}
                      {item.flavor && <small>{item.flavor}</small>}
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div className="mag-item-qty">{item.quantity_sent}</div>
                      {item.quantity_received!=null && <div className="mag-item-recv">Ric: {item.quantity_received}</div>}
                    </div>
                  </div>
                ))}
                <div className="mag-actions">
                  {t.status==='draft' && <button className="mag-btn mag-btn-primary" onClick={()=>handleAction('send',t.id)}><Send size={14}/>Invia</button>}
                  {t.status==='in_transit' && <button className="mag-btn mag-btn-success" onClick={()=>handleAction('receive',t.id)}><CheckCircle size={14}/>Ricevuto</button>}
                  {['draft','in_transit'].includes(t.status) && <button className="mag-btn mag-btn-danger" onClick={()=>handleAction('cancel',t.id)}>Annulla</button>}
                  {['draft','cancelled'].includes(t.status) && <button className="mag-btn mag-btn-danger" onClick={()=>handleAction('delete',t.id)}><Trash2 size={12}/>Elimina</button>}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* New DDT Bottom Sheet */}
      {showNew && (
        <div className="mag-overlay" onClick={() => setShowNew(false)}>
          <div className="mag-modal" onClick={e => e.stopPropagation()}>
            <div className="mag-modal-head">
              <h2>Nuovo DDT</h2>
              <button onClick={() => setShowNew(false)} className="sp-btn sp-btn-ghost sp-btn-icon"><X size={18} /></button>
            </div>
            <div className="mag-modal-body">
              <div className="mag-field">
                <label>Mittente *</label>
                <select value={form.from_store_id} onChange={e => handleFromStore(e.target.value)}>
                  <option value="">Seleziona negozio</option>
                  {stores.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              </div>
              <div className="mag-field">
                <label>Destinatario *</label>
                <select value={form.to_store_id} onChange={e => setForm(f=>({...f,to_store_id:e.target.value}))}>
                  <option value="">Seleziona negozio</option>
                  {stores.filter(st => String(st.id)!==String(form.from_store_id)).map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              </div>

              {form.from_store_id && (
                <div className="mag-scanner">
                  <Scan size={18} style={{color:'var(--color-accent)',flexShrink:0}} />
                  <input ref={barcodeRef} value={barcode} onChange={e=>setBarcode(e.target.value)} onKeyDown={handleBarcode} placeholder="Scansiona barcode / SKU" autoComplete="off" />
                </div>
              )}

              {form.from_store_id && (
                <div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <label style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--color-text-tertiary)',margin:0}}>Prodotti *</label>
                    <button onClick={addItem} className="sp-btn sp-btn-ghost sp-btn-sm">+ Aggiungi</button>
                  </div>
                  {form.items.map((item,i) => {
                    const sel = variants.find(v => String(v.id)===String(item.product_variant_id));
                    return (
                      <div key={i} className="mag-item" style={{marginBottom:8}}>
                        <div style={{flex:1,position:'relative'}}>
                          {showSearch===i ? (
                            <div style={{position:'relative'}}>
                              <input className="sp-input" autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cerca prodotto..." />
                              {suggestions(search).length > 0 && (
                                <div className="mag-suggestions">
                                  {suggestions(search).map(v => (
                                    <div key={v.id} className="mag-suggestion" onClick={()=>{updateItem(i,'product_variant_id',String(v.id));setShowSearch(null);setSearch('');}}>
                                      <div className="mag-suggestion-name">{v.label}</div>
                                      <div className="mag-suggestion-stock">Disp: {v.on_hand}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div onClick={()=>{setShowSearch(i);setSearch('');}} style={{fontSize:13,fontWeight:sel?600:400,color:sel?'var(--color-text)':'var(--color-text-tertiary)',cursor:'pointer',padding:'4px 0'}}>
                              {sel ? sel.label : 'Tocca per cercare...'}
                            </div>
                          )}
                        </div>
                        <input type="number" min="1" value={item.quantity_sent} onChange={e=>updateItem(i,'quantity_sent',parseInt(e.target.value)||1)} className="sp-input" style={{width:60,textAlign:'center',padding:'8px 4px'}} />
                        {form.items.length > 1 && <button onClick={()=>removeItem(i)} style={{color:'var(--color-error)'}}><XCircle size={18}/></button>}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mag-field">
                <label>Note</label>
                <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Note opzionali..." />
              </div>

              <div style={{display:'flex',gap:8}}>
                <button className="sp-btn sp-btn-secondary" style={{flex:1}} onClick={()=>setShowNew(false)}>Annulla</button>
                <button className="sp-btn sp-btn-primary" style={{flex:1}} onClick={handleCreate} disabled={saving}>{saving?'Creazione...':'Crea DDT'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
