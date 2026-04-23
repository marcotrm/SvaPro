import React, { useState, useEffect } from 'react';
import { inventorySessions } from '../api.jsx';
import { useNavigate } from 'react-router-dom';

const STATUS_LABEL = {
  DRAFT:'Bozza', SENT_TO_STORE:'Inviata', IN_PROGRESS:'In corso',
  CLOSED_BY_STORE:'Chiusa', UNDER_REVIEW:'In revisione',
  APPROVED:'Approvata', DISPUTED:'Contestata', REOPENED:'Riaperta', CANCELLED:'Annullata'
};
const STATUS_COLOR = {
  DRAFT:'#6B7280', SENT_TO_STORE:'#3B82F6', IN_PROGRESS:'#F59E0B',
  CLOSED_BY_STORE:'#8B5CF6', UNDER_REVIEW:'#F97316',
  APPROVED:'#10B981', DISPUTED:'#EF4444', REOPENED:'#F97316', CANCELLED:'#6B7280'
};

const inp = {
  width:'100%', padding:'10px 14px', borderRadius:10,
  border:'1.5px solid var(--color-border)', background:'var(--color-bg)',
  color:'var(--color-text)', fontSize:14, outline:'none', boxSizing:'border-box'
};
const sel = { ...inp, cursor:'pointer' };
const btnPrimary = { padding:'10px 20px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#3B82F6,#2563EB)', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', boxShadow:'0 4px 14px rgba(59,130,246,0.35)' };
const btnSecondary = { padding:'10px 18px', borderRadius:10, border:'1.5px solid var(--color-border)', background:'var(--color-surface)', color:'var(--color-text-secondary)', fontSize:13, fontWeight:700, cursor:'pointer' };

function Badge({ status }) {
  const c = STATUS_COLOR[status] ?? '#6B7280';
  return <span style={{ background:c+'22', color:c, border:`1px solid ${c}44`, borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700 }}>{STATUS_LABEL[status] ?? status}</span>;
}
function KpiCard({ label, value, color }) {
  return (
    <div style={{ background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:14, padding:'18px 20px', minWidth:120 }}>
      <div style={{ fontSize:28, fontWeight:900, color:color??'var(--color-accent)' }}>{value ?? 0}</div>
      <div style={{ fontSize:12, color:'var(--color-text-tertiary)', marginTop:4 }}>{label}</div>
    </div>
  );
}
function Label({ children }) {
  return <label style={{ fontSize:12, fontWeight:700, color:'var(--color-text-secondary)', display:'block', marginBottom:6 }}>{children}</label>;
}

// ─── MODAL CREA BOLLA ────────────────────────────────────────────────────────
function CreateModal({ onClose, onCreated }) {
  // Opzioni dropdown
  const [opts, setOpts] = useState({ stores:[], brands:[], categories:[], product_types:[] });
  const [loadingOpts, setLoadingOpts] = useState(true);
  const [optsError, setOptsError] = useState('');

  // Form
  const [form, setForm] = useState({
    title:'', store_id:'', due_date:'', notes_internal:'',
    filters:{ brand_id:'', category_id:'', product_type:'', only_positive_stock:true, name:'' }
  });
  const setFilter = (k, v) => setForm(f => ({ ...f, filters:{ ...f.filters, [k]:v } }));

  // Preview
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Submit
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  // ── Carica opzioni al mount ──
  useEffect(() => {
    setLoadingOpts(true);
    inventorySessions.getFilterOptions()
      .then(r => {
        const data = r.data ?? {};
        console.log('Inventory options loaded:', data); // debug
        setOpts({
          stores:       Array.isArray(data.stores)        ? data.stores        : [],
          brands:       Array.isArray(data.brands)        ? data.brands        : [],
          categories:   Array.isArray(data.categories)    ? data.categories    : [],
          product_types: Array.isArray(data.product_types) ? data.product_types : [],
        });
        if (!data.stores || data.stores.length === 0) {
          setOptsError('Nessun negozio trovato. Verifica configurazione store nel gestionale.');
        }
      })
      .catch(e => {
        console.error('getFilterOptions error:', e);
        setOptsError('Impossibile caricare le opzioni dal server.');
      })
      .finally(() => setLoadingOpts(false));
  }, []);

  // ── Anteprima prodotti ──
  const handlePreview = async () => {
    if (!form.store_id) { setFormErr('Seleziona prima un negozio'); return; }
    setLoadingPreview(true); setFormErr('');
    try {
      const r = await inventorySessions.getPreview(form.store_id, form.filters);
      setPreview(r.data);
    } catch (e) {
      setFormErr(e.response?.data?.message ?? 'Errore durante il caricamento anteprima');
    }
    setLoadingPreview(false);
  };

  // ── Crea bolla ──
  const handleSubmit = async () => {
    if (!form.title.trim()) { setFormErr('Il titolo è obbligatorio'); return; }
    if (!form.store_id)     { setFormErr('Seleziona un negozio'); return; }
    setSaving(true); setFormErr('');
    try {
      const payload = {
        ...form,
        store_id: parseInt(form.store_id, 10),
        filters: {
          ...form.filters,
          brand_id:    form.filters.brand_id    ? parseInt(form.filters.brand_id, 10)    : null,
          category_id: form.filters.category_id ? parseInt(form.filters.category_id, 10) : null,
        }
      };
      const r = await inventorySessions.create(payload);
      onCreated(r.data?.session_id ?? null);
    } catch (e) {
      setFormErr(e.response?.data?.message ?? 'Errore durante la creazione della bolla');
    }
    setSaving(false);
  };

  const canCreate = !!form.store_id && !!form.title.trim() && !saving;

  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'var(--color-surface)', borderRadius:20, width:'100%', maxWidth:680, maxHeight:'94vh', overflow:'auto', border:'1px solid var(--color-border)', boxShadow:'0 32px 80px rgba(0,0,0,0.35)' }}>

        {/* Header */}
        <div style={{ padding:'22px 28px 16px', borderBottom:'1px solid var(--color-border)', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'var(--color-surface)', zIndex:10 }}>
          <div style={{ fontSize:18, fontWeight:900 }}>📋 Crea Bolla Inventario</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:24, lineHeight:1, color:'var(--color-text-secondary)' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding:'20px 28px', display:'flex', flexDirection:'column', gap:18 }}>

          {/* Errori globali */}
          {formErr && (
            <div style={{ background:'#EF444420', color:'#EF4444', padding:'10px 16px', borderRadius:10, fontSize:13, border:'1px solid #EF444440' }}>
              ⚠️ {formErr}
            </div>
          )}

          {/* Avviso nessuno store */}
          {!loadingOpts && optsError && (
            <div style={{ background:'#F59E0B20', color:'#F59E0B', padding:'10px 16px', borderRadius:10, fontSize:13, border:'1px solid #F59E0B40' }}>
              ⚠️ {optsError}
            </div>
          )}

          {/* ── Titolo ── */}
          <div>
            <Label>TITOLO *</Label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title:e.target.value }))}
              placeholder="Es. Inventario liquidi Aprile 2026..."
              style={inp}
            />
          </div>

          {/* ── Negozio + Scadenza ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div>
              <Label>NEGOZIO *</Label>
              {loadingOpts ? (
                <div style={{ ...inp, color:'var(--color-text-tertiary)' }}>⏳ Caricamento negozi...</div>
              ) : (
                <select
                  value={form.store_id}
                  onChange={e => { setForm(f => ({ ...f, store_id:e.target.value })); setPreview(null); setFormErr(''); }}
                  style={sel}
                  disabled={opts.stores.length === 0}
                >
                  <option value="">— Seleziona negozio —</option>
                  {opts.stores.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
              {!loadingOpts && opts.stores.length === 0 && (
                <div style={{ fontSize:11, color:'#EF4444', marginTop:4 }}>Nessun negozio disponibile</div>
              )}
            </div>
            <div>
              <Label>SCADENZA</Label>
              <input type="datetime-local" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date:e.target.value }))} style={inp} />
            </div>
          </div>

          {/* ── Filtri prodotti ── */}
          <div style={{ background:'var(--color-bg)', borderRadius:12, padding:'16px', border:'1px solid var(--color-border)' }}>
            <div style={{ fontSize:12, fontWeight:800, color:'var(--color-text-secondary)', marginBottom:14, textTransform:'uppercase', letterSpacing:'0.06em' }}>🔍 Filtri Prodotti</div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
              {/* Brand */}
              <div>
                <Label>MARCA</Label>
                {opts.brands.length > 0 ? (
                  <select value={form.filters.brand_id} onChange={e => setFilter('brand_id', e.target.value)} style={{ ...sel, fontSize:13 }}>
                    <option value="">Tutte le marche</option>
                    {opts.brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                ) : (
                  <div style={{ ...inp, fontSize:12, color:'var(--color-text-tertiary)', display:'flex', alignItems:'center' }}>
                    {loadingOpts ? '⏳ ...' : 'Nessuna marca'}
                  </div>
                )}
              </div>

              {/* Categoria */}
              <div>
                <Label>CATEGORIA</Label>
                {opts.categories.length > 0 ? (
                  <select value={form.filters.category_id} onChange={e => setFilter('category_id', e.target.value)} style={{ ...sel, fontSize:13 }}>
                    <option value="">Tutte le categorie</option>
                    {opts.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                ) : (
                  <div style={{ ...inp, fontSize:12, color:'var(--color-text-tertiary)', display:'flex', alignItems:'center' }}>
                    {loadingOpts ? '⏳ ...' : 'Nessuna categoria'}
                  </div>
                )}
              </div>

              {/* Tipo prodotto */}
              <div>
                <Label>TIPO PRODOTTO</Label>
                {opts.product_types.length > 0 ? (
                  <select value={form.filters.product_type} onChange={e => setFilter('product_type', e.target.value)} style={{ ...sel, fontSize:13 }}>
                    <option value="">Tutti i tipi</option>
                    {opts.product_types.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                ) : (
                  <div style={{ ...inp, fontSize:12, color:'var(--color-text-tertiary)', display:'flex', alignItems:'center' }}>
                    {loadingOpts ? '⏳ ...' : 'Nessun tipo'}
                  </div>
                )}
              </div>
            </div>

            {/* Ricerca testuale */}
            <div style={{ marginTop:14 }}>
              <Label>RICERCA NOME / SKU / BARCODE</Label>
              <input
                value={form.filters.name}
                onChange={e => setFilter('name', e.target.value)}
                placeholder="Filtra per nome prodotto, SKU o barcode..."
                style={{ ...inp, fontSize:13 }}
              />
            </div>

            {/* Solo positivi */}
            <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:13, marginTop:14, color:'var(--color-text)' }}>
              <input
                type="checkbox"
                checked={!!form.filters.only_positive_stock}
                onChange={e => setFilter('only_positive_stock', e.target.checked)}
                style={{ width:16, height:16, accentColor:'var(--color-accent)', cursor:'pointer' }}
              />
              Solo prodotti con giacenza &gt; 0 nel magazzino del negozio selezionato
            </label>
          </div>

          {/* ── Note interne ── */}
          <div>
            <Label>NOTE INTERNE <span style={{ fontWeight:400, opacity:.6 }}>(non visibili allo store)</span></Label>
            <textarea
              value={form.notes_internal}
              onChange={e => setForm(f => ({ ...f, notes_internal:e.target.value }))}
              placeholder="Istruzioni operative per il magazzino..."
              rows={2}
              style={{ ...inp, resize:'vertical' }}
            />
          </div>

          {/* ── Anteprima prodotti ── */}
          {preview !== null && (
            <div style={{
              background: preview.count > 0 ? 'rgba(59,130,246,0.08)' : 'rgba(239,68,68,0.08)',
              border:`1px solid ${preview.count > 0 ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.3)'}`,
              borderRadius:12, padding:'12px 16px', fontSize:13
            }}>
              {preview.count > 0 ? (
                <>ℹ️ Con questi filtri la bolla includerà <strong>{preview.count}</strong> varianti prodotto
                {!preview.warehouse_id ? <span style={{ color:'#F59E0B' }}> — ⚠️ Nessun magazzino configurato per questo store</span> : ''}.
                </>
              ) : (
                <>⚠️ Nessun prodotto trovato con i filtri selezionati. Modifica i criteri di ricerca.</>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 28px', borderTop:'1px solid var(--color-border)', display:'flex', gap:10, justifyContent:'flex-end', background:'var(--color-bg)', borderRadius:'0 0 20px 20px', position:'sticky', bottom:0 }}>
          <button
            type="button" onClick={handlePreview}
            disabled={!form.store_id || loadingPreview}
            style={{ ...btnSecondary, opacity: !form.store_id || loadingPreview ? 0.5 : 1 }}
          >
            {loadingPreview ? '⏳ Caricamento...' : '👁 Anteprima prodotti'}
          </button>
          <button type="button" onClick={onClose} style={btnSecondary}>Annulla</button>
          <button
            type="button" onClick={handleSubmit}
            disabled={!canCreate}
            style={{ ...btnPrimary, opacity:canCreate ? 1 : 0.5 }}
          >
            {saving ? '⏳ Creazione...' : '📋 Crea Bolla'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function InventoryBollePage() {
  const navigate = useNavigate();
  const [user, setUser]       = useState(null);
  const [kpi, setKpi]         = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]  = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    try { const s = localStorage.getItem('user'); if(s) setUser(JSON.parse(s)); } catch {}
  }, []);

  const isAdmin = user && ['superadmin','admin_cliente','magazziniere','store_manager'].includes(user.role);

  const STORE_VISIBLE_STATUSES = ['SENT_TO_STORE','IN_PROGRESS','CLOSED_BY_STORE','UNDER_REVIEW','APPROVED','DISPUTED','REOPENED'];

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      if (isAdmin) {
        const [kR, sR] = await Promise.all([
          inventorySessions.getKpi(),
          inventorySessions.getAll(filterStatus ? { status: filterStatus } : {})
        ]);
        setKpi(kR.data?.data ?? null);
        setSessions(sR.data?.data ?? []);
      } else {
        // Dipendente: usa lo stesso endpoint admin che già funziona.
        // Non dipende da store_id — vede le bolle del suo tenant filtrate per status.
        const r = await inventorySessions.getAll({});
        const all = r.data?.data ?? [];
        // Filtra solo sessioni visibili al negozio (no DRAFT, no CANCELLED)
        setSessions(all.filter(s => STORE_VISIBLE_STATUSES.includes(s.status)));
      }
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'Errore caricamento inventari';
      setLoadError(`Errore: ${msg}`);
      console.error('InventoryBollePage load error:', e);
    }
    setLoading(false);
  };


  useEffect(() => { if (user !== null) load(); }, [user, filterStatus]); // eslint-disable-line

  const handleCreated = (sessionId) => {
    setShowCreate(false);
    if (sessionId) navigate(`/inventory/bolle/${sessionId}`);
    else load();
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Annullare questa bolla? Verr\u00e0 marcata come CANCELLATA e non potr\u00e0 essere riattivata.')) return;
    setDeletingId(id);
    try {
      await inventorySessions.deleteSession(id);
      // Soft delete: aggiorna lo status nella lista locale invece di rimuoverla
      setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'CANCELLED' } : s));
    } catch (err) {
      alert(err.response?.data?.message ?? 'Errore durante l\'annullamento');
    }
    setDeletingId(null);
  };

  const FILTER_STATUSES = ['', 'SENT_TO_STORE', 'IN_PROGRESS', 'CLOSED_BY_STORE', 'UNDER_REVIEW', 'APPROVED'];

  return (
    <div style={{ padding:'24px 28px', minHeight:'100vh', background:'var(--color-bg)' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:26, fontWeight:900, color:'var(--color-text)' }}>📋 Bolle Inventario</div>
          <div style={{ fontSize:13, color:'var(--color-text-tertiary)', marginTop:4 }}>
            {isAdmin ? 'Crea e gestisci le bolle inventario per i negozi' : 'Inventari assegnati al tuo negozio'}
          </div>
        </div>
        {isAdmin && (
          <button type="button" onClick={() => setShowCreate(true)} style={btnPrimary}>
            + Crea Bolla
          </button>
        )}
      </div>

      {/* KPI — solo admin */}
      {isAdmin && kpi && (
        <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:28 }}>
          <KpiCard label="Inviate"      value={kpi.open}         color="#3B82F6" />
          <KpiCard label="In corso"     value={kpi.in_progress}  color="#F59E0B" />
          <KpiCard label="Chiuse"       value={kpi.closed}       color="#8B5CF6" />
          <KpiCard label="In revisione" value={kpi.under_review} color="#F97316" />
          <KpiCard label="Approvate"    value={kpi.approved}     color="#10B981" />
          <KpiCard label="Totale"       value={kpi.total}        color="var(--color-text-secondary)" />
        </div>
      )}

      {/* Banner errore */}
      {loadError && (
        <div style={{
          background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.35)',
          borderRadius:10, padding:'14px 18px', marginBottom:20,
          color:'#FCA5A5', fontSize:14, display:'flex', alignItems:'center', gap:10
        }}>
          <span style={{ fontSize:20 }}>⚠️</span>
          <span>{loadError}</span>
        </div>
      )}

      {/* Filtro status — solo admin */}
      {isAdmin && (
        <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
          {FILTER_STATUSES.map(s => (
            <button
              key={s} type="button" onClick={() => setFilterStatus(s)}
              style={{
                padding:'6px 16px', borderRadius:20, border:`1.5px solid ${filterStatus===s ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background:filterStatus===s ? 'var(--color-accent)' : 'transparent',
                color:filterStatus===s ? '#fff' : 'var(--color-text-secondary)',
                fontSize:12, fontWeight:700, cursor:'pointer', transition:'all 0.15s'
              }}
            >
              {s === '' ? 'Tutte' : (STATUS_LABEL[s] ?? s)}
            </button>
          ))}
        </div>
      )}

      {/* Lista bolle */}
      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--color-text-tertiary)' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>⏳</div>Caricamento...
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ textAlign:'center', padding:60 }}>
          <div style={{ fontSize:52, marginBottom:16 }}>📦</div>
          <div style={{ fontSize:16, fontWeight:700, color:'var(--color-text)' }}>Nessuna bolla inventario</div>
          <div style={{ fontSize:13, color:'var(--color-text-tertiary)', marginTop:6 }}>
            {isAdmin ? 'Clicca "+ Crea Bolla" per iniziare.' : 'Nessun inventario assegnato al momento.'}
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => navigate(`/inventory/bolle/${s.id}`)}
              role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && navigate(`/inventory/bolle/${s.id}`)}
              style={{
                background:'var(--color-surface)', border:'1px solid var(--color-border)',
                borderRadius:16, padding:'18px 22px', cursor:'pointer',
                display:'flex', alignItems:'center', gap:20,
                boxShadow:'0 2px 8px rgba(0,0,0,0.06)', transition:'box-shadow 0.15s, transform 0.1s'
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow='0 6px 24px rgba(0,0,0,0.14)'; e.currentTarget.style.transform='translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.06)'; e.currentTarget.style.transform=''; }}
            >
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, flexWrap:'wrap' }}>
                  <span style={{ fontSize:11, fontWeight:800, color:'var(--color-text-tertiary)', fontFamily:'monospace' }}>{s.inventory_number}</span>
                  <Badge status={s.status} />
                  {s.due_date && new Date(s.due_date) < new Date() && !['APPROVED','CANCELLED'].includes(s.status) && (
                    <span style={{ background:'#EF444422', color:'#EF4444', border:'1px solid #EF444440', borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:700 }}>⏰ SCADUTA</span>
                  )}
                </div>
                <div style={{ fontSize:15, fontWeight:800, color:'var(--color-text)', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.title}</div>
                <div style={{ fontSize:12, color:'var(--color-text-tertiary)', display:'flex', gap:16, flexWrap:'wrap' }}>
                  {s.store_name && <span>🏪 {s.store_name}</span>}
                  {s.due_date && <span>⏰ Scad. {new Date(s.due_date).toLocaleDateString('it-IT')}</span>}
                  {s.summary?.total !== undefined && <span>📦 {s.summary.total} prodotti</span>}
                  {s.total_items  !== undefined && <span>📦 {s.total_items} prodotti</span>}
                </div>
              </div>

              {/* Statistiche admin */}
              {s.summary && (
                <div style={{ display:'flex', gap:16, alignItems:'center', flexShrink:0 }}>
                  {[
                    { v:s.summary.matched,     label:'OK',   c:'#10B981' },
                    { v:s.summary.mismatched,  label:'Diff', c:'#EF4444' },
                    { v:`${s.summary.accuracy}%`, label:'Acc', c:'var(--color-accent)' },
                  ].map(({ v, label, c }) => (
                    <div key={label} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:20, fontWeight:900, color:c }}>{v}</div>
                      <div style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>{label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Progress bar store */}
              {s.total_items !== undefined && (
                <div style={{ flexShrink:0, minWidth:130 }}>
                  <div style={{ fontSize:12, color:'var(--color-text-secondary)', fontWeight:700, marginBottom:6 }}>
                    {s.counted_items ?? 0}/{s.total_items} contati
                  </div>
                  <div style={{ height:6, borderRadius:4, background:'var(--color-border)', overflow:'hidden' }}>
                    <div style={{
                      height:'100%', background:'#10B981', borderRadius:4,
                      width:`${s.total_items > 0 ? Math.round((s.counted_items ?? 0) / s.total_items * 100) : 0}%`,
                      transition:'width 0.3s'
                    }} />
                  </div>
                </div>
              )}

              <div style={{ color:'var(--color-text-tertiary)', fontSize:20, flexShrink:0 }}>›</div>

              {/* Pulsante elimina — non per APPROVED/CLOSED_BY_STORE definitivi */}
              {isAdmin && !['APPROVED','CLOSED_BY_STORE','UNDER_REVIEW'].includes(s.status) && (
                <button
                  type="button"
                  onClick={e => handleDelete(e, s.id)}
                  disabled={deletingId === s.id}
                  title="Elimina bolla"
                  style={{
                    flexShrink:0, background:'none', border:'1.5px solid #EF444460',
                    borderRadius:8, padding:'6px 10px', cursor:'pointer',
                    color:'#EF4444', fontSize:13, fontWeight:700,
                    opacity: deletingId === s.id ? 0.5 : 1,
                    transition:'all 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#EF444415'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  {deletingId === s.id ? '⏳' : '🗑'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
    </div>
  );
}
