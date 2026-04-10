import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { stockTransfers, stores as storesApi, catalog } from '../api.jsx';
import { SkeletonTable } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';

const STATUS_LABELS = {
    draft:      { label: 'Bozza',       cls: 'mid'  },
    in_transit: { label: 'In Transito', cls: 'warn' },
    received:   { label: 'Ricevuto',    cls: 'high' },
    cancelled:  { label: 'Annullato',   cls: 'low'  },
};

const fmtDate = v => v ? new Date(v).toLocaleDateString('it-IT') : '–';
const fmtDT   = v => v ? new Date(v).toLocaleString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '–';

/* ─── Autocomplete prodotto ─────────────────────────────────────────────── */
function ProductAutocomplete({ variants, value, onChange }) {
    const [query, setQuery]       = useState('');
    const [open,  setOpen]        = useState(false);
    const [active, setActive]     = useState(-1);
    const wrapRef                 = useRef(null);

    // Etichetta del valore selezionato
    const selectedLabel = value ? (variants.find(v => String(v.id) === String(value))?.label || '') : '';

    // Filtra i suggerimenti
    const suggestions = query.length >= 1
        ? variants.filter(v => v.label.toLowerCase().includes(query.toLowerCase())).slice(0, 10)
        : [];

    // Chiudi se si clicca fuori
    useEffect(() => {
        const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const select = (v) => {
        onChange(String(v.id));
        setQuery('');
        setOpen(false);
        setActive(-1);
    };

    const handleKeyDown = (e) => {
        if (!open || suggestions.length === 0) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, suggestions.length - 1)); }
        if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
        if (e.key === 'Enter' && active >= 0) { e.preventDefault(); select(suggestions[active]); }
        if (e.key === 'Escape')    { setOpen(false); }
    };

    return (
        <div ref={wrapRef} style={{ position: 'relative', flex: 1 }}>
            {/* Campo di input con il prodotto selezionato o la ricerca */}
            {!open && value ? (
                <div
                    onClick={() => { setQuery(''); setOpen(true); }}
                    style={{
                        padding: '8px 12px',
                        border: '1px solid var(--color-border)',
                        borderRadius: 8,
                        fontSize: 13,
                        cursor: 'pointer',
                        background: 'var(--color-surface)',
                        color: 'var(--color-text)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        minHeight: 38,
                    }}
                >
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel}</span>
                    <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginLeft: 8, flexShrink: 0 }}>✎</span>
                </div>
            ) : (
                <input
                    className="field-input"
                    autoFocus={open}
                    value={query}
                    onChange={e => { setQuery(e.target.value); setOpen(true); setActive(-1); }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digita nome prodotto, SKU, gusto..."
                    autoComplete="off"
                />
            )}

            {/* Dropdown suggerimenti */}
            {open && suggestions.length > 0 && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9000,
                    background: 'var(--color-card)', border: '1px solid var(--color-border)',
                    borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                    maxHeight: 240, overflowY: 'auto', marginTop: 4,
                }}>
                    {suggestions.map((v, idx) => (
                        <div
                            key={v.id}
                            onMouseDown={() => select(v)}
                            style={{
                                padding: '10px 14px',
                                cursor: 'pointer',
                                background: idx === active ? 'rgba(99,102,241,0.12)' : 'transparent',
                                borderBottom: '1px solid var(--color-border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                fontSize: 13,
                            }}
                            onMouseEnter={() => setActive(idx)}
                        >
                            <span style={{ fontWeight: 600 }}>{v.label}</span>
                            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginLeft: 8 }}>Disp: {v.on_hand}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Nessun risultato */}
            {open && query.length >= 2 && suggestions.length === 0 && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9000,
                    background: 'var(--color-card)', border: '1px solid var(--color-border)',
                    borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                    padding: '12px 14px', marginTop: 4, fontSize: 13,
                    color: 'var(--color-text-tertiary)', textAlign: 'center',
                }}>
                    Nessun prodotto trovato per "{query}"
                </div>
            )}
        </div>
    );
}

/* ─── Modal Dettaglio DDT ───────────────────────────────────────────────── */
function DDTDetailModal({ transfer, onClose }) {
    if (!transfer) return null;
    const st = STATUS_LABELS[transfer.status] || { label: transfer.status, cls: '' };

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: 'var(--color-card)', borderRadius: 16,
                    width: '100%', maxWidth: 680, maxHeight: '85vh',
                    display: 'flex', flexDirection: 'column',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
                    border: '1px solid var(--color-border)',
                }}
            >
                {/* Header modal */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--color-text)' }}>
                            DDT {transfer.ddt_number}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                            Creato il {fmtDT(transfer.created_at)}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className={`badge ${st.cls}`}><span className="badge-dot"/>{st.label}</span>
                        <button
                            onClick={onClose}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--color-text-secondary)', lineHeight: 1 }}
                        >×</button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
                    {/* Info grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                        {[
                            ['📤 Mittente',    transfer.from_store_name || '–'],
                            ['📥 Destinatario',transfer.to_store_name   || '–'],
                            ['📅 Data Invio',  fmtDT(transfer.sent_at)],
                            ['✅ Data Ricezione', fmtDT(transfer.received_at)],
                        ].map(([label, val]) => (
                            <div key={label} style={{ background: 'var(--color-surface)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--color-border)' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>{label}</div>
                                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>{val}</div>
                            </div>
                        ))}
                        {transfer.notes && (
                            <div style={{ gridColumn: 'span 2', background: 'var(--color-surface)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--color-border)' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>📝 Note</div>
                                <div style={{ fontSize: 13, color: 'var(--color-text)' }}>{transfer.notes}</div>
                            </div>
                        )}
                    </div>

                    {/* Articoli */}
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--color-text)' }}>
                        Articoli ({(transfer.items || []).length})
                    </div>
                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--color-surface)' }}>
                                    {['Prodotto', 'Qtà Inviata', 'Qtà Ricevuta'].map(h => (
                                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {(transfer.items || []).length === 0 ? (
                                    <tr><td colSpan="3" style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Nessun articolo</td></tr>
                                ) : (transfer.items || []).map((item, i) => (
                                    <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                                            {item.product_name || '–'}
                                            {item.flavor ? <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}> — {item.flavor}</span> : ''}
                                            {item.resistance_ohm ? <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}> {item.resistance_ohm}Ω</span> : ''}
                                        </td>
                                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: 'var(--color-accent)' }}>{item.quantity_sent}</td>
                                        <td style={{ padding: '12px 14px', fontSize: 13, color: item.quantity_received != null ? 'var(--color-success)' : 'var(--color-text-tertiary)', fontWeight: item.quantity_received != null ? 700 : 400 }}>
                                            {item.quantity_received ?? '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Totale */}
                    <div style={{ marginTop: 14, display: 'flex', gap: 12 }}>
                        <div style={{ background: 'rgba(99,102,241,0.08)', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: 'var(--color-accent)' }}>
                            Totale pezzi inviati: {(transfer.items || []).reduce((s, i) => s + (i.quantity_sent || 0), 0)}
                        </div>
                        {transfer.status === 'received' && (
                            <div style={{ background: 'rgba(34,197,94,0.08)', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: 'var(--color-success)' }}>
                                Totale pezzi ricevuti: {(transfer.items || []).reduce((s, i) => s + (i.quantity_received || 0), 0)}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Componente principale ─────────────────────────────────────── */
export default function StockTransfersPage() {
    const { selectedStoreId } = useOutletContext();

    const [list,    setList]    = useState([]);
    const [stores,  setStores]  = useState([]);
    const [variants, setVariants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showForm, setShowForm] = useState(false);
    const [saving,  setSaving]  = useState(false);
    const [viewTransfer, setViewTransfer] = useState(null); // per il modal dettaglio

    const [form, setForm] = useState({
        from_store_id: '', to_store_id: '', notes: '',
        items: [{ product_variant_id: '', quantity_sent: 1 }],
    });
    const [barcodeInput, setBarcodeInput] = useState('');
    const barcodeInputRef = useRef(null);

    useEffect(() => { fetchAll(); }, [statusFilter]);

    const fetchAll = async () => {
        try {
            setLoading(true); setError('');
            const params = {};
            if (statusFilter !== 'all') params.status = statusFilter;
            if (selectedStoreId) params.store_id = selectedStoreId;

            const [tRes, sRes] = await Promise.all([
                stockTransfers.getAll(params),
                storesApi.getStores(),
            ]);
            setList(tRes.data?.data || []);
            setStores(sRes.data?.data || []);
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally { setLoading(false); }
    };

    const loadVariants = async (storeId) => {
        if (!storeId) return;
        try {
            const res = await catalog.getProducts({ store_id: storeId, limit: 500, include_variants: 1 });
            const all = [];
            (res.data?.data || []).forEach(p => {
                (p.variants || []).forEach(v => {
                    all.push({
                        id: v.id,
                        label: `${p.name}${v.flavor ? ' – ' + v.flavor : ''}${v.resistance_ohm ? ' ' + v.resistance_ohm + 'Ω' : ''}`,
                        sku: v.sku || '',
                        barcode: v.barcode || '',
                        on_hand: v.on_hand ?? 0,
                    });
                });
            });
            setVariants(all);
        } catch { setVariants([]); }
    };

    const handleFromStoreChange = (storeId) => {
        setForm(f => ({ ...f, from_store_id: storeId, items: [{ product_variant_id: '', quantity_sent: 1 }] }));
        setVariants([]);
        if (storeId) loadVariants(storeId);
    };

    const addItem    = () => setForm(f => ({ ...f, items: [...f.items, { product_variant_id: '', quantity_sent: 1 }] }));
    const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
    const updateItem = (i, field, val) => {
        const items = [...form.items];
        items[i] = { ...items[i], [field]: val };
        setForm(f => ({ ...f, items }));
    };

    const resetForm = () => {
        setForm({ from_store_id: '', to_store_id: '', notes: '', items: [{ product_variant_id: '', quantity_sent: 1 }] });
        setVariants([]);
        setShowForm(false);
    };

    const handleCreate = async () => {
        if (!form.from_store_id || !form.to_store_id) { setError('Seleziona i negozi mittente e destinatario.'); return; }
        if (form.items.some(i => !i.product_variant_id || i.quantity_sent < 1)) { setError('Compila tutti i prodotti con quantità valide.'); return; }
        try {
            setSaving(true); setError('');
            await stockTransfers.create(form);
            resetForm();
            await fetchAll();
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally { setSaving(false); }
    };

    const handleSend = async (id) => {
        if (!confirm('Inviare il DDT? Lo stock verrà scalato dal magazzino mittente.')) return;
        try { setError(''); await stockTransfers.send(id); await fetchAll(); }
        catch (e) { setError(e.response?.data?.message || e.message); }
    };

    const handleReceive = async (transfer) => {
        if (!confirm('Confermare la ricezione? Lo stock verrà aggiunto al magazzino destinatario.')) return;
        try { setError(''); await stockTransfers.receive(transfer.id); await fetchAll(); }
        catch (e) { setError(e.response?.data?.message || e.message); }
    };

    const handleCancel = async (id) => {
        if (!confirm('Annullare il DDT?')) return;
        try { setError(''); await stockTransfers.cancel(id); await fetchAll(); }
        catch (e) { setError(e.response?.data?.message || e.message); }
    };

    const handleDelete = async (id) => {
        if (!confirm("Eliminare definitivamente questo DDT? L'operazione non è reversibile.")) return;
        try { setError(''); await stockTransfers.delete(id); await fetchAll(); }
        catch (e) { setError(e.response?.data?.message || e.message); }
    };

    const printDDT = (t) => {
        const w = window.open('', '_blank');
        w.document.write(`<!DOCTYPE html><html><head>
<title>DDT ${t.ddt_number}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 32px; color: #111; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .sub { color: #666; font-size: 13px; margin-bottom: 24px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; background: #f5f5f7; padding: 16px; border-radius: 8px; }
  .info-block h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin-bottom: 4px; }
  .info-block p { font-size: 14px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; background: #f0f0f0; }
  td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
  .footer { margin-top: 40px; display: flex; justify-content: space-between; }
  .sign-box { border-top: 1px solid #ccc; width: 200px; text-align: center; padding-top: 8px; font-size: 12px; color: #666; }
</style>
</head><body>
<h1>Documento di Trasporto (DDT)</h1>
<div class="sub">N. ${t.ddt_number} &nbsp;|&nbsp; Data: ${fmtDT(t.created_at)}</div>
<div class="info-grid">
  <div class="info-block"><h3>Mittente</h3><p>${t.from_store_name}</p></div>
  <div class="info-block"><h3>Destinatario</h3><p>${t.to_store_name}</p></div>
  <div class="info-block"><h3>Stato</h3><p>${STATUS_LABELS[t.status]?.label || t.status}</p></div>
  <div class="info-block"><h3>Data Invio</h3><p>${fmtDT(t.sent_at)}</p></div>
  ${t.notes ? `<div class="info-block" style="grid-column:span 2"><h3>Note</h3><p>${t.notes}</p></div>` : ''}
</div>
<table>
  <thead><tr><th>Prodotto</th><th>Qtà Inviata</th><th>Qtà Ricevuta</th></tr></thead>
  <tbody>
    ${(t.items || []).map(i => `
      <tr>
        <td>${i.product_name || ''}${i.flavor ? ' – ' + i.flavor : ''}${i.resistance_ohm ? ' ' + i.resistance_ohm + 'Ω' : ''}</td>
        <td>${i.quantity_sent}</td>
        <td>${i.quantity_received ?? '–'}</td>
      </tr>`).join('')}
  </tbody>
</table>
<div class="footer">
  <div class="sign-box">Firma Mittente</div>
  <div class="sign-box">Firma Destinatario</div>
</div>
</body></html>`);
        w.document.close();
        w.print();
    };

    const counts = {
        draft:      list.filter(t => t.status === 'draft').length,
        in_transit: list.filter(t => t.status === 'in_transit').length,
        received:   list.filter(t => t.status === 'received').length,
    };

    if (loading && list.length === 0) return <SkeletonTable />;

    return (
        <>
            {/* Modal dettaglio DDT */}
            {viewTransfer && <DDTDetailModal transfer={viewTransfer} onClose={() => setViewTransfer(null)} />}

            {/* Header */}
            <div className="page-head">
                <div>
                    <div className="page-head-title">Trasferimenti DDT</div>
                    <div className="page-head-sub">Gestione trasferimenti stock tra negozi</div>
                </div>
                <button className="btn btn-gold" onClick={() => { resetForm(); setShowForm(true); }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nuovo DDT
                </button>
            </div>

            {/* KPIs */}
            <div className="kpi-grid">
                <div className="kpi-card"><div className="kpi-label">Totale DDT</div><div className="kpi-value">{list.length}</div></div>
                <div className="kpi-card"><div className="kpi-label">Bozze</div><div className="kpi-value mid">{counts.draft}</div></div>
                <div className="kpi-card"><div className="kpi-label">In Transito</div><div className="kpi-value warn">{counts.in_transit}</div></div>
                <div className="kpi-card"><div className="kpi-label">Ricevuti</div><div className="kpi-value high">{counts.received}</div></div>
            </div>

            {error && <ErrorAlert message={error} onRetry={fetchAll} />}

            {/* Form Nuovo DDT */}
            {showForm && (
                <div className="table-card" style={{ marginBottom: 16 }}>
                    <div className="table-toolbar"><div className="section-title">Nuovo Trasferimento DDT</div></div>
                    <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* Negozi */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr', gap: 12, alignItems: 'center' }}>
                            <div>
                                <label className="field-label">Negozio Mittente *</label>
                                <select className="field-input" value={form.from_store_id} onChange={e => handleFromStoreChange(e.target.value)}>
                                    <option value="">— seleziona —</option>
                                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div style={{ textAlign: 'center', fontSize: 20, color: 'var(--color-accent)', fontWeight: 700, paddingTop: 18 }}>→</div>
                            <div>
                                <label className="field-label">Negozio Destinatario *</label>
                                <select className="field-input" value={form.to_store_id} onChange={e => setForm(f => ({ ...f, to_store_id: e.target.value }))}>
                                    <option value="">— seleziona —</option>
                                    {stores.filter(s => String(s.id) !== String(form.from_store_id)).map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Barcode scanner */}
                        {form.from_store_id && (
                            <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>📷 Scansiona barcode:</span>
                                <input
                                    ref={barcodeInputRef}
                                    className="field-input"
                                    style={{ flex: 1 }}
                                    value={barcodeInput}
                                    onChange={e => setBarcodeInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && barcodeInput.trim()) {
                                            const bc = barcodeInput.trim().toLowerCase();
                                            const found = variants.find(v =>
                                                v.barcode?.toLowerCase() === bc ||
                                                v.sku?.toLowerCase() === bc ||
                                                v.label?.toLowerCase().includes(bc)
                                            );
                                            if (found) {
                                                const existingIdx = form.items.findIndex(i => String(i.product_variant_id) === String(found.id));
                                                if (existingIdx >= 0) {
                                                    updateItem(existingIdx, 'quantity_sent', form.items[existingIdx].quantity_sent + 1);
                                                } else {
                                                    const items = [...form.items];
                                                    if (items[items.length - 1].product_variant_id === '') {
                                                        items[items.length - 1] = { product_variant_id: String(found.id), quantity_sent: 1 };
                                                    } else {
                                                        items.push({ product_variant_id: String(found.id), quantity_sent: 1 });
                                                    }
                                                    setForm(f => ({ ...f, items }));
                                                }
                                                setBarcodeInput('');
                                                barcodeInputRef.current?.focus();
                                            } else {
                                                setError(`Barcode "${barcodeInput}" non trovato.`);
                                                setBarcodeInput('');
                                            }
                                        }
                                    }}
                                    placeholder="Barcode / SKU prodotto + Invio"
                                    autoComplete="off"
                                />
                            </div>
                        )}

                        {/* Prodotti */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <label className="field-label" style={{ margin: 0 }}>Prodotti da Trasferire *</label>
                            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={addItem} type="button">+ Aggiungi</button>
                        </div>

                        {!form.from_store_id && (
                            <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                                Seleziona prima il negozio mittente per caricare i prodotti disponibili.
                            </div>
                        )}

                        {form.from_store_id && form.items.map((item, i) => {
                            const selected = variants.find(v => String(v.id) === String(item.product_variant_id));
                            return (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 80px 32px', gap: 8, alignItems: 'center' }}>
                                    {/* ── Autocomplete prodotto ── */}
                                    <ProductAutocomplete
                                        variants={variants}
                                        value={item.product_variant_id}
                                        onChange={val => updateItem(i, 'product_variant_id', val)}
                                    />
                                    <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center' }}>
                                        {selected ? `Disp: ${selected.on_hand}` : ''}
                                    </div>
                                    <input
                                        className="field-input"
                                        type="number" min="1"
                                        max={selected?.on_hand || 99999}
                                        value={item.quantity_sent}
                                        onChange={e => updateItem(i, 'quantity_sent', parseInt(e.target.value) || 1)}
                                        placeholder="Qtà"
                                    />
                                    {form.items.length > 1 && (
                                        <button type="button" onClick={() => removeItem(i)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', fontSize: 18, lineHeight: 1 }}>
                                            ×
                                        </button>
                                    )}
                                </div>
                            );
                        })}

                        {/* Note */}
                        <div>
                            <label className="field-label">Note (opzionale)</label>
                            <input className="field-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Es. Rifornimento stagionale..." />
                        </div>

                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={resetForm}>Annulla</button>
                            <button className="btn btn-gold" onClick={handleCreate} disabled={saving}>
                                {saving ? 'Creazione...' : '✓ Crea DDT'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Filtri */}
            <div className="filter-bar" style={{ marginBottom: 16 }}>
                {['all','draft','in_transit','received','cancelled'].map(s => (
                    <button key={s} className={`filter-chip ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
                        {{ all:'Tutti', draft:'Bozze', in_transit:'In Transito', received:'Ricevuti', cancelled:'Annullati' }[s]}
                    </button>
                ))}
            </div>

            {/* Tabella */}
            <div className="table-card">
                <table>
                    <thead>
                        <tr>
                            <th>N. DDT</th>
                            <th>Mittente → Destinatario</th>
                            <th>Prodotti</th>
                            <th>Stato</th>
                            <th>Data</th>
                            <th>Inviato</th>
                            <th style={{ textAlign: 'right' }}>Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {list.length > 0 ? list.map(t => {
                            const st = STATUS_LABELS[t.status] || { label: t.status, cls: '' };
                            return (
                                <tr key={t.id}>
                                    <td className="mono" style={{ fontWeight: 600 }}>{t.ddt_number}</td>
                                    <td>
                                        <span style={{ fontWeight: 600 }}>{t.from_store_name}</span>
                                        <span style={{ color: 'var(--color-accent)', margin: '0 6px' }}>→</span>
                                        <span style={{ fontWeight: 600 }}>{t.to_store_name}</span>
                                    </td>
                                    <td>
                                        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                                            {(t.items || []).length} articol{(t.items || []).length === 1 ? 'o' : 'i'}
                                            {' '}({(t.items || []).reduce((s, i) => s + (i.quantity_sent || 0), 0)} pz)
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`badge ${st.cls}`}><span className="badge-dot"/>{st.label}</span>
                                    </td>
                                    <td style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{fmtDate(t.created_at)}</td>
                                    <td style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{fmtDT(t.sent_at)}</td>
                                    <td>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                                            {/* ── TASTO VISUALIZZA ── */}
                                            <button
                                                className="btn btn-ghost"
                                                style={{ fontSize: 11, padding: '4px 10px', color: 'var(--color-accent)', fontWeight: 700 }}
                                                onClick={() => setViewTransfer(t)}
                                                title="Visualizza dettagli DDT"
                                            >
                                                👁 Visualizza
                                            </button>
                                            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => printDDT(t)} title="Stampa DDT">🖨</button>
                                            {t.status === 'draft' && (
                                                <button className="btn btn-gold" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => handleSend(t.id)}>Invia</button>
                                            )}
                                            {t.status === 'in_transit' && (
                                                <button className="btn" style={{ fontSize: 11, padding: '4px 10px', background: 'var(--color-success)', color:'#fff', borderRadius: 6, border:'none', cursor:'pointer' }} onClick={() => handleReceive(t)}>Ricevuto</button>
                                            )}
                                            {['draft','in_transit'].includes(t.status) && (
                                                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: 'var(--color-error)' }} onClick={() => handleCancel(t.id)}>Annulla</button>
                                            )}
                                            {['draft','cancelled'].includes(t.status) && (
                                                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: 'var(--color-error)', fontWeight: 800 }} onClick={() => handleDelete(t.id)} title="Elimina DDT">🗑</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-tertiary)' }}>
                                Nessun trasferimento trovato. Crea il tuo primo DDT con il pulsante in alto.
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
}
