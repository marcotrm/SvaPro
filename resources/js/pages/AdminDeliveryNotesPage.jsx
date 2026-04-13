import React, { useState, useEffect, useRef } from 'react';
import DatePicker from '../components/DatePicker.jsx';
import { useOutletContext } from 'react-router-dom';
import { deliveryNotes, stores, catalog } from '../api.jsx';
import { SkeletonTable } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import { toast } from 'react-hot-toast';

const STATUS_LABELS = {
    pending:     { label: '📦 In consegna', cls: 'mid'  },
    in_progress: { label: '🔄 In controllo', cls: 'warn' },
    received:    { label: '✅ Controllata', cls: 'high' },
    discrepancy: { label: '⚠️ Arrivata (Discrepanze)', cls: 'low'  },
};

const fmtDT = v => v ? new Date(v).toLocaleString('it-IT') : '–';

export default function AdminDeliveryNotesPage() {
    const [list, setList] = useState([]);
    const [discrepancies, setDiscrepancies] = useState([]);
    const [storesList, setStoresList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('list'); // 'list' or 'discrepancies'
    const [showForm, setShowForm] = useState(false);
    
    useEffect(() => {
        fetchData();
        stores.getStores().then(r => setStoresList(r.data?.data || []));
    }, [tab]);

    const fetchData = async () => {
        try {
            setLoading(true);
            if (tab === 'list') {
                const res = await deliveryNotes.getAll();
                setList(res.data?.data || []);
            } else {
                const res = await deliveryNotes.getDiscrepancies();
                setDiscrepancies(res.data?.data || []);
            }
        } catch (e) {
            toast.error(e.message || 'Errore');
        } finally {
            setLoading(false);
        }
    };

    const handleBrtSync = async (id) => {
        try {
            await deliveryNotes.syncBrt(id);
            toast.success("Stato BRT Sincronizzato con successo!");
            fetchData();
        } catch (e) {
            toast.error("Errore sincronizzazione BRT");
        }
    };

    const resolveDiscrepancy = async (id, status) => {
        if (!confirm(`Vuoi marcare questa discrepanza come ${status === 'resolved' ? 'Risolta (Stock sistemato)' : 'Accettata (Stock non modificato)'}?`)) return;
        try {
            await deliveryNotes.resolveDiscrepancy(id, { status, notes: "Risolto da Admin" });
            toast.success("Discrepanza aggiornata");
            fetchData();
        } catch (e) {
            toast.error("Errore");
        }
    };

    // --- FORM CREAZIONE BOLLA ---
    const [form, setForm] = useState({ store_id: '', notes: '', expected_at: '', items: [] });
    const [productSearch, setProductSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    
    const searchCatalog = async (q) => {
        if (!q || q.length < 2) return setSearchResults([]);
        try {
            const res = await catalog.getProducts({ search: q, limit: 10, include_variants: 1 });
            const all = [];
            (res.data?.data || []).forEach(p => {
                (p.variants || []).forEach(v => {
                    all.push({
                        id: v.id, sku: v.sku, barcode: v.barcode,
                        name: `${p.name} ${v.flavor ? '- '+v.flavor : ''}`,
                        on_hand: v.on_hand ?? 0
                    });
                });
            });
            setSearchResults(all);
        } catch (e) {}
    };

    const addItemToForm = (vr) => {
        const existing = form.items.find(i => String(i.product_variant_id) === String(vr.id));
        if (existing) {
            const nextItems = form.items.map(i => String(i.product_variant_id) === String(vr.id) ? { ...i, expected_qty: i.expected_qty + 1 } : i);
            setForm({ ...form, items: nextItems });
        } else {
            setForm({ ...form, items: [...form.items, { product_variant_id: vr.id, product_name: vr.name, barcode: vr.barcode, sku: vr.sku, expected_qty: 1 }] });
        }
        setProductSearch('');
        setSearchResults([]);
    };

    const handleCreate = async () => {
        if (!form.store_id || form.items.length === 0) return toast.error("Seleziona negozio e articoli");
        try {
            await deliveryNotes.create({ ...form, type: 'scarico' });
            toast.success("Bolla creata con successo! Giacenze decrementate dal Magazzino Centrale.");
            setShowForm(false);
            setForm({ store_id: '', notes: '', expected_at: '', items: [] });
            fetchData();
        } catch (e) {
            toast.error(e.response?.data?.message || e.message);
        }
    };

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 48 }}>
            <div className="page-head">
                <div>
                    <div className="page-head-title">Bolle di Scarico KIOSK</div>
                    <div className="page-head-sub">Invia merce ai negozi e verifica ricezione via KIOSK</div>
                </div>
                <button className="btn btn-gold" onClick={() => setShowForm(!showForm)}>
                    + Nuova Bolla (Spedisci)
                </button>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <button className={`btn ${tab === 'list' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('list')}>Elenco Bolle</button>
                <button className={`btn ${tab === 'discrepancies' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('discrepancies')}>
                    Discrepanze
                    {discrepancies.filter(d => d.status === 'open').length > 0 && <span style={{ marginLeft: 6, background: 'red', color: 'white', padding: '2px 6px', borderRadius: 10, fontSize: 11 }}>{discrepancies.filter(d => d.status === 'open').length}</span>}
                </button>
            </div>

            {showForm && (
                <div className="table-card" style={{ padding: 24, marginBottom: 24 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>Prepara Spedizione (Dal Centrale)</h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                            <label className="field-label">Negozio Destinazione</label>
                            <select className="field-input" value={form.store_id} onChange={e => setForm({...form, store_id: e.target.value})}>
                                <option value="">— seleziona —</option>
                                {storesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="field-label">Data Trasporto Attesa</label>
                            <DatePicker value={form.expected_at} onChange={v => setForm({...form, expected_at: v})} placeholder="Seleziona data" />
                        </div>
                    </div>

                    <div style={{ marginTop: 16, position: 'relative' }}>
                        <label className="field-label">Cerca Articoli nel Catalogo (decreamenterà il Magazzino Centrale)</label>
                        <input className="field-input" value={productSearch} onChange={e => { setProductSearch(e.target.value); searchCatalog(e.target.value); }} placeholder="Cerca prodotto..." />
                        
                        {searchResults.length > 0 && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #ccc', zIndex: 100, maxHeight: 200, overflowY: 'auto' }}>
                                {searchResults.map(vr => (
                                    <div key={vr.id} style={{ padding: 10, borderBottom: '1px solid #eee', cursor: 'pointer' }} onClick={() => addItemToForm(vr)}>
                                        <strong>{vr.name}</strong> - Giacenza Centrale: {vr.on_hand}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {form.items.length > 0 && (
                        <table style={{ width: '100%', marginTop: 16 }}>
                            <thead><tr><th style={{ textAlign: 'left' }}>Prodotto</th><th>Quantità</th><th>Rimuovi</th></tr></thead>
                            <tbody>
                                {form.items.map((it, idx) => (
                                    <tr key={idx}>
                                        <td>{it.product_name}</td>
                                        <td>
                                            <input type="number" className="field-input" value={it.expected_qty} onChange={e => {
                                                const next = [...form.items]; next[idx].expected_qty = parseInt(e.target.value) || 0;
                                                setForm({ ...form, items: next });
                                            }} style={{ width: 80, padding: 4 }} />
                                        </td>
                                        <td><button onClick={() => setForm({...form, items: form.items.filter((_, i) => i !== idx)})}>X</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    <div style={{ marginTop: 24, textAlign: 'right' }}>
                        <button className="btn btn-gold" onClick={handleCreate}>Spedisci Bolla e Scala Giacenze</button>
                    </div>
                </div>
            )}

            {tab === 'list' && (
                <div className="table-card">
                    {loading ? <SkeletonTable /> : (
                        <table style={{ width: '100%' }}>
                            <thead><tr><th>Bolla N.</th><th>Destinazione</th><th>Stato</th><th>Tracking BRT</th><th>Operazioni</th></tr></thead>
                            <tbody>
                                {list.map(note => (
                                    <tr key={note.id}>
                                        <td style={{ fontWeight: 'bold' }}>{note.note_number}</td>
                                        <td>{note.store_name}</td>
                                        <td><span className={`badge ${STATUS_LABELS[note.status]?.cls}`}>{STATUS_LABELS[note.status]?.label || note.status}</span></td>
                                        <td>
                                            <div style={{ fontSize: 13, color: '#444' }}>{note.tracking_number || '-'}</div>
                                            <div style={{ fontSize: 11, color: '#888' }}>{note.carrier_status || ''}</div>
                                        </td>
                                        <td>
                                            <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => handleBrtSync(note.id)}>Aggiorna BRT</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {tab === 'discrepancies' && (
                <div className="table-card">
                    {loading ? <SkeletonTable /> : (
                        <table style={{ width: '100%' }}>
                            <thead><tr><th>Negozio</th><th>Bolla</th><th>Prodotto</th><th>Atteso / Ricevuto</th><th>Stato</th><th>Azioni</th></tr></thead>
                            <tbody>
                                {discrepancies.map(d => (
                                    <tr key={d.id}>
                                        <td>{d.store_name}</td>
                                        <td>{d.note_number}</td>
                                        <td>{d.product_name}</td>
                                        <td style={{ fontSize: 18, color: d.difference > 0 ? '#f59e0b' : '#ef4444', fontWeight: 800 }}>
                                            {d.expected_qty} / {d.received_qty} ({d.difference > 0 ? '+' : ''}{d.difference})
                                        </td>
                                        <td>{d.status === 'open' ? 'Aperta' : 'Chiusa'}</td>
                                        <td>
                                            {d.status === 'open' && (
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button className="btn" style={{ fontSize: 11, background: '#10b981', color: 'white' }} onClick={() => resolveDiscrepancy(d.id, 'resolved')}>Approva Scostamento</button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}
