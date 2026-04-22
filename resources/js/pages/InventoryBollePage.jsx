import React, { useState, useEffect } from 'react';
import { inventorySessions } from '../api.jsx';
import { useNavigate } from 'react-router-dom';

const STATUS_LABEL = { DRAFT:'Bozza', SENT_TO_STORE:'Inviata', IN_PROGRESS:'In corso', CLOSED_BY_STORE:'Chiusa', UNDER_REVIEW:'In revisione', APPROVED:'Approvata', DISPUTED:'Contestata', REOPENED:'Riaperta', CANCELLED:'Annullata' };
const STATUS_COLOR = { DRAFT:'#6B7280', SENT_TO_STORE:'#3B82F6', IN_PROGRESS:'#F59E0B', CLOSED_BY_STORE:'#8B5CF6', UNDER_REVIEW:'#F97316', APPROVED:'#10B981', DISPUTED:'#EF4444', REOPENED:'#F97316', CANCELLED:'#6B7280' };

const inp = { width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid var(--color-border)', background:'var(--color-bg)', color:'var(--color-text)', fontSize:14, outline:'none', boxSizing:'border-box' };
const sel = { ...inp, cursor:'pointer' };
const btn = (bg='var(--color-accent)', color='#fff') => ({ padding:'10px 18px', borderRadius:10, border:'none', background:bg, color, fontSize:13, fontWeight:700, cursor:'pointer' });

function Badge({ status }) {
  const c = STATUS_COLOR[status] ?? '#6B7280';
  return <span style={{ background:c+'22', color:c, border:`1px solid ${c}44`, borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700 }}>{STATUS_LABEL[status] ?? status}</span>;
}

function KpiCard({ label, value, color }) {
  return (
    <div style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:14, padding:'18px 20px', minWidth:120 }}>
      <div style={{ fontSize:28, fontWeight:900, color:color??'var(--color-accent)' }}>{value}</div>
      <div style={{ fontSize:12, color:'var(--color-text-tertiary)', marginTop:4 }}>{label}</div>
    </div>
  );
}

// ─── MODAL CREA BOLLA ─────────────────────────────────────────────────────────
function CreateModal({ onClose, onCreated }) {
  const [opts, setOpts] = useState({ brands:[], categories:[], product_types:[], stores:[] });
  const [form, setForm] = useState({
    title:'', store_id:'', due_date:'', notes_internal:'',
    filters:{ brand_id:'', category_id:'', product_type:'', only_positive_stock:true, name:'' }
  });
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    inventorySessions.getFilterOptions()
      .then(r => setOpts(r.data ?? { brands:[], categories:[], product_types:[], stores:[] }))
      .catch(() => {});
  }, []);

  const setFilter = (key, val) => setForm(f => ({ ...f, filters:{ ...f.filters, [key]:val } }));

  const handlePreview = async () => {
    if (!form.store_id) { setErr('Seleziona prima un negozio'); return; }
    setLoadingPreview(true); setErr('');
    try {
      const r = await inventorySessions.getPreview(form.store_id, form.filters);
      setPreview(r.data);
    } catch (e) { setErr(e.response?.data?.message ?? 'Errore anteprima'); }
    setLoadingPreview(false);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { setErr('Il titolo è obbligatorio'); return; }
    if (!form.store_id) { setErr('Seleziona un negozio'); return; }
    setSaving(true); setErr('');
    try {
      const r = await inventorySessions.create(form);
      onCreated(r.data.session_id);
    } catch (e) { setErr(e.response?.data?.message ?? 'Errore durante la creazione'); }
    setSaving(false);
  };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:400, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ background:'var(--color-surface)', borderRadius:20, width:'100%', maxWidth:660, maxHeight:'92vh', overflow:'auto', border:'1px solid var(--color-border)', boxShadow:'0 32px 80px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ padding:'22px 28px 18px', borderBottom:'1px solid var(--color-border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:18, fontWeight:900, color:'var(--color-text)' }}>📋 Crea Bolla Inventario</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:'var(--color-text-secondary)', lineHeight:1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding:'20px 28px', display:'flex', flexDirection:'column', gap:16 }}>
          {err && <div style={{ background:'#EF444422', color:'#EF4444', padding:'10px 14px', borderRadius:10, fontSize:13 }}>⚠️ {err}</div>}

          {/* Titolo */}
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--color-text-secondary)', display:'block', marginBottom:6 }}>TITOLO *</label>
            <input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))}
              placeholder="Es. Inventario liquidi Aprile 2026..." style={inp} />
          </div>

          {/* Store + Scadenza */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--color-text-secondary)', display:'block', marginBottom:6 }}>NEGOZIO *</label>
              <select value={form.store_id} onChange={e => { setForm(f=>({...f,store_id:e.target.value})); setPreview(null); }} style={sel}>
                <option value="">— Seleziona negozio —</option>
                {opts.stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--color-text-secondary)', display:'block', marginBottom:6 }}>SCADENZA</label>
              <input type="datetime-local" value={form.due_date} onChange={e => setForm(f=>({...f,due_date:e.target.value}))} style={inp} />
            </div>
          </div>

          {/* Filtri */}
          <div style={{ background:'var(--color-bg)', borderRadius:12, padding:'14px 16px', border:'1px solid var(--color-border)' }}>
            <div style={{ fontSize:12, fontWeight:800, color:'var(--color-text-secondary)', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.05em' }}>🔍 Filtri Prodotti</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              {/* Brand */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--color-text-tertiary)', display:'block', marginBottom:5 }}>MARCA</label>
                <select value={form.filters.brand_id} onChange={e => setFilter('brand_id', e.target.value)} style={{ ...sel, fontSize:13 }}>
                  <option value="">Tutte le marche</option>
                  {opts.brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              {/* Categoria */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--color-text-tertiary)', display:'block', marginBottom:5 }}>CATEGORIA</label>
                <select value={form.filters.category_id} onChange={e => setFilter('category_id', e.target.value)} style={{ ...sel, fontSize:13 }}>
                  <option value="">Tutte le categorie</option>
                  {opts.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {/* Tipo prodotto */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--color-text-tertiary)', display:'block', marginBottom:5 }}>TIPO PRODOTTO</label>
                <select value={form.filters.product_type} onChange={e => setFilter('product_type', e.target.value)} style={{ ...sel, fontSize:13 }}>
                  <option value="">Tutti i tipi</option>
                  {opts.product_types.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            {/* Ricerca nome/sku/barcode */}
            <div style={{ marginTop:12 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--color-text-tertiary)', display:'block', marginBottom:5 }}>RICERCA NOME / SKU / BARCODE</label>
              <input value={form.filters.name} onChange={e => setFilter('name', e.target.value)}
                placeholder="Filtra per nome, SKU o barcode..." style={{ ...inp, fontSize:13 }} />
            </div>
            {/* Solo positivi */}
            <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:13, color:'var(--color-text)', marginTop:12 }}>
              <input type="checkbox" checked={!!form.filters.only_positive_stock}
                onChange={e => setFilter('only_positive_stock', e.target.checked)}
                style={{ width:16, height:16, accentColor:'var(--color-accent)' }} />
              Solo prodotti con giacenza &gt; 0 nel magazzino selezionato
            </label>
          </div>

          {/* Note interne */}
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--color-text-secondary)', display:'block', marginBottom:6 }}>NOTE INTERNE <span style={{fontWeight:400,opacity:.7}}>(non visibili allo store)</span></label>
            <textarea value={form.notes_internal} onChange={e => setForm(f=>({...f,notes_internal:e.target.value}))}
              placeholder="Istruzioni per il deposito..." rows={2}
              style={{ ...inp, resize:'vertical' }} />
          </div>

          {/* Preview */}
          {preview && (
            <div style={{ background: preview.count > 0 ? 'rgba(59,130,246,0.08)' : 'rgba(239,68,68,0.08)', border:`1px solid ${preview.count>0?'rgba(59,130,246,0.3)':'rgba(239,68,68,0.3)'}`, borderRadius:12, padding:'12px 16px', fontSize:13, color:'var(--color-text)' }}>
              {preview.count > 0
                ? <>ℹ️ Con questi filtri la bolla includerà <strong>{preview.count}</strong> prodotti{!preview.warehouse_id ? ' (⚠️ magazzino non configurato per questo store)' : ''}.</>
                : '⚠️ Nessun prodotto trovato con i filtri selezionati. Modifica i filtri.'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 28px', borderTop:'1px solid var(--color-border)', display:'flex', gap:10, justifyContent:'flex-end', background:'var(--color-bg)', borderRadius:'0 0 20px 20px' }}>
          <button onClick={handlePreview} disabled={!form.store_id || loadingPreview}
            style={{ ...btn('var(--color-surface)', 'var(--color-accent)'), border:'1.5px solid var(--color-border)', opacity: !form.store_id ? 0.5 : 1 }}>
            {loadingPreview ? '⏳ Caricamento...' : '👁 Anteprima prodotti'}
          </button>
          <button onClick={onClose} style={{ ...btn('var(--color-surface)', 'var(--color-text-secondary)'), border:'1.5px solid var(--color-border)' }}>Annulla</button>
          <button onClick={handleSubmit} disabled={saving}
            style={{ ...btn('linear-gradient(135deg,#3B82F6,#2563EB)'), opacity:saving?0.6:1, boxShadow:'0 4px 14px rgba(59,130,246,0.35)' }}>
            {saving ? '⏳ Creazione...' : '📋 Crea Bolla'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function InventoryBollePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [kpi, setKpi] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    const s = localStorage.getItem('user');
    if (s) try { setUser(JSON.parse(s)); } catch {}
  }, []);

  const isAdmin = user && ['superadmin','admin_cliente','magazziniere','store_manager'].includes(user.role);
  const isStore = user && (user.role === 'dipendente' || !!user.store_id);

  const load = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const [kR, sR] = await Promise.all([
          inventorySessions.getKpi(),
          inventorySessions.getAll(filterStatus ? { status: filterStatus } : {})
        ]);
        setKpi(kR.data?.data ?? null);
        setSessions(sR.data?.data ?? []);
      } else {
        const r = await inventorySessions.storeGetAll();
        setSessions(r.data?.data ?? []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { if (user !== null) load(); }, [user, filterStatus]);

  const handleCreated = (sessionId) => {
    setShowCreate(false);
    if (sessionId) navigate(`/inventory/bolle/${sessionId}`);
    else load();
  };

  const FILTER_STATUSES = ['', 'SENT_TO_STORE', 'IN_PROGRESS', 'CLOSED_BY_STORE', 'UNDER_REVIEW', 'APPROVED'];

  return (
    <div style={{ padding:'24px 28px', minHeight:'100vh', background:'var(--color-bg)' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:26, fontWeight:900, color:'var(--color-text)' }}>📋 Bolle Inventario</div>
          <div style={{ fontSize:13, color:'var(--color-text-tertiary)', marginTop:4 }}>
            {isAdmin ? 'Crea e gestisci le bolle per tutti i negozi' : 'Inventari assegnati al tuo negozio'}
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => setShowCreate(true)}
            style={{ padding:'12px 22px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#3B82F6,#2563EB)', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', boxShadow:'0 4px 14px rgba(59,130,246,0.35)', whiteSpace:'nowrap' }}>
            + Crea Bolla
          </button>
        )}
      </div>

      {/* KPI cards — solo admin */}
      {isAdmin && kpi && (
        <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:28 }}>
          <KpiCard label="Inviate" value={kpi.open} color="#3B82F6" />
          <KpiCard label="In corso" value={kpi.in_progress} color="#F59E0B" />
          <KpiCard label="Chiuse" value={kpi.closed} color="#8B5CF6" />
          <KpiCard label="In revisione" value={kpi.under_review} color="#F97316" />
          <KpiCard label="Approvate" value={kpi.approved} color="#10B981" />
          <KpiCard label="Totale" value={kpi.total} color="var(--color-text-secondary)" />
        </div>
      )}

      {/* Filtro status — solo admin */}
      {isAdmin && (
        <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
          {FILTER_STATUSES.map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ padding:'6px 14px', borderRadius:20, border:`1.5px solid ${filterStatus===s?'var(--color-accent)':'var(--color-border)'}`, background:filterStatus===s?'var(--color-accent)':'transparent', color:filterStatus===s?'#fff':'var(--color-text-secondary)', fontSize:12, fontWeight:700, cursor:'pointer', transition:'all 0.15s' }}>
              {s === '' ? 'Tutte' : (STATUS_LABEL[s] ?? s)}
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--color-text-tertiary)' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>⏳</div>Caricamento...
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ textAlign:'center', padding:60 }}>
          <div style={{ fontSize:52, marginBottom:16 }}>📦</div>
          <div style={{ fontSize:16, fontWeight:700, color:'var(--color-text)' }}>Nessuna bolla inventario</div>
          <div style={{ fontSize:13, color:'var(--color-text-tertiary)', marginTop:6 }}>
            {isAdmin ? 'Clicca "Crea Bolla" per iniziare.' : 'Nessun inventario assegnato al momento.'}
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {sessions.map(s => (
            <div key={s.id}
              onClick={() => navigate(`/inventory/bolle/${s.id}`)}
              style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:16, padding:'18px 22px', cursor:'pointer', display:'flex', alignItems:'center', gap:20, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', transition:'box-shadow 0.15s, transform 0.1s' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow='0 6px 24px rgba(0,0,0,0.14)'; e.currentTarget.style.transform='translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.06)'; e.currentTarget.style.transform=''; }}
            >
              {/* Info principale */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, flexWrap:'wrap' }}>
                  <span style={{ fontSize:11, fontWeight:800, color:'var(--color-text-tertiary)', fontFamily:'monospace' }}>{s.inventory_number}</span>
                  <Badge status={s.status} />
                  {s.due_date && new Date(s.due_date) < new Date() && s.status !== 'APPROVED' && (
                    <span style={{ background:'#EF444422', color:'#EF4444', border:'1px solid #EF444444', borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:700 }}>⏰ SCADUTA</span>
                  )}
                </div>
                <div style={{ fontSize:16, fontWeight:800, color:'var(--color-text)', marginBottom:4, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.title}</div>
                <div style={{ fontSize:12, color:'var(--color-text-tertiary)', display:'flex', gap:16, flexWrap:'wrap' }}>
                  {s.store_name && <span>🏪 {s.store_name}</span>}
                  {s.due_date && <span>⏰ Scad. {new Date(s.due_date).toLocaleDateString('it-IT')}</span>}
                  {s.summary?.total !== undefined && <span>📦 {s.summary.total} prodotti</span>}
                  {s.total_items !== undefined && <span>📦 {s.total_items} prodotti</span>}
                </div>
              </div>

              {/* Stats admin */}
              {s.summary && (
                <div style={{ display:'flex', gap:16, alignItems:'center', flexShrink:0 }}>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:900, color:'#10B981' }}>{s.summary.matched}</div>
                    <div style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>OK</div>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:900, color:'#EF4444' }}>{s.summary.mismatched}</div>
                    <div style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>Diff.</div>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:900, color:'var(--color-accent)' }}>{s.summary.accuracy}%</div>
                    <div style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>Acc.</div>
                  </div>
                </div>
              )}

              {/* Progress bar store */}
              {s.total_items !== undefined && (
                <div style={{ flexShrink:0, minWidth:120 }}>
                  <div style={{ fontSize:12, color:'var(--color-text-secondary)', fontWeight:700, marginBottom:6 }}>
                    {s.counted_items}/{s.total_items} contati
                  </div>
                  <div style={{ height:6, borderRadius:4, background:'var(--color-border)', overflow:'hidden' }}>
                    <div style={{ height:'100%', background:'#10B981', borderRadius:4, width:`${s.total_items>0 ? (s.counted_items/s.total_items*100) : 0}%`, transition:'width 0.3s' }} />
                  </div>
                </div>
              )}

              <div style={{ color:'var(--color-text-tertiary)', fontSize:20, flexShrink:0 }}>›</div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
    </div>
  );
}
