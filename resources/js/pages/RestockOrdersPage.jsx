import React, { useState, useEffect, useRef, useCallback } from 'react';
import { restockOrders, stores as storesApi, catalog, deliveryNotes } from '../api.jsx';
import { toast } from 'react-hot-toast';
import { Package, Plus, ChevronRight, Search, Truck, ClipboardList, CheckCircle, Clock, Trash2, Edit2, X, ArrowRight } from 'lucide-react';

/* ─── Costanti ─────────────────────────────────────────── */
const STATUS = {
  draft:      { label: '📝 Bozza',           color: '#6b7280', bg: '#f3f4f6' },
  confirmed:  { label: '✅ Confermato',       color: '#059669', bg: '#d1fae5' },
  preparing:  { label: '📦 In Preparazione', color: '#d97706', bg: '#fef3c7' },
  shipped:    { label: '🚚 Spedito',          color: '#7c3aed', bg: '#ede9fe' },
  cancelled:  { label: '❌ Annullato',        color: '#dc2626', bg: '#fee2e2' },
};

const fmtDate = v => v ? new Date(v).toLocaleDateString('it-IT') : '–';
const fmtDT   = v => v ? new Date(v).toLocaleString('it-IT')     : '–';

/* ─── Componente principale ─────────────────────────────── */
export default function RestockOrdersPage() {
  const [orders, setOrders]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [storesList, setStoresList]   = useState([]);
  const [activeTab, setActiveTab]     = useState('all');
  const [selectedOrder, setSelected]  = useState(null);
  const [showCreate, setShowCreate]   = useState(false);
  const [showShipModal, setShipModal] = useState(null); // orderId

  useEffect(() => { fetchOrders(); }, [activeTab]);
  useEffect(() => { storesApi.getStores().then(r => setStoresList(r.data?.data || [])); }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = activeTab !== 'all' ? { status: activeTab } : {};
      const res = await restockOrders.getAll(params);
      setOrders(res.data?.data || []);
    } catch { toast.error('Errore caricamento ordini'); }
    finally { setLoading(false); }
  };

  const handleConfirm = async (id) => {
    try { await restockOrders.confirm(id); toast.success('Ordine confermato'); fetchOrders(); }
    catch (e) { toast.error(e.response?.data?.message || 'Errore'); }
  };

  const handleStartPreparing = async (id) => {
    try { await restockOrders.startPreparing(id); toast.success('Preparazione avviata'); fetchOrders(); }
    catch (e) { toast.error(e.response?.data?.message || 'Errore'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Eliminare questo ordine?')) return;
    try { await restockOrders.destroy(id); toast.success('Ordine eliminato'); fetchOrders(); }
    catch (e) { toast.error(e.response?.data?.message || 'Errore'); }
  };

  const tabs = [
    { key: 'all',       label: 'Tutti' },
    { key: 'draft',     label: '📝 Bozze' },
    { key: 'confirmed', label: '✅ Confermati' },
    { key: 'preparing', label: '📦 In Preparazione' },
    { key: 'shipped',   label: '🚚 Spediti' },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 60 }}>
      {/* Header */}
      <div className="page-head">
        <div>
          <div className="page-head-title">📋 Ordini di Riassortimento Store</div>
          <div className="page-head-sub">Crea ordini di restock da inviare ai negozi — diventeranno Bolle di Scarico</div>
        </div>
        <button className="btn btn-gold" onClick={() => setShowCreate(true)}>
          <Plus size={15} style={{ marginRight: 6 }} />Nuovo Ordine
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.key}
            onClick={() => { setActiveTab(t.key); setSelected(null); }}
            style={{
              padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 13,
              background: activeTab === t.key ? '#0e1726' : '#f3f4f6',
              color: activeTab === t.key ? '#fff' : '#374151',
              transition: 'all 0.15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedOrder ? '1fr 420px' : '1fr', gap: 20 }}>
        {/* Lista ordini */}
        <div className="table-card" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Caricamento...</div>
          ) : orders.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>
              <ClipboardList size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontSize: 15 }}>Nessun ordine trovato</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Numero', 'Negozio', 'Articoli', 'Consegna', 'Stato', 'Azioni'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}
                    onClick={() => setSelected(o.id === selectedOrder ? null : o.id)}
                    style={{
                      borderBottom: '1px solid #f3f4f6', cursor: 'pointer',
                      background: selectedOrder === o.id ? '#f0f2ff' : 'white',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { if (selectedOrder !== o.id) e.currentTarget.style.background = '#f9fafb'; }}
                    onMouseLeave={e => { if (selectedOrder !== o.id) e.currentTarget.style.background = 'white'; }}
                  >
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1a1a2e', fontFamily: 'monospace' }}>{o.order_number}</td>
                    <td style={{ padding: '14px 16px', fontSize: 14 }}>{o.store_name}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: '#e0e7ff', color: '#4338ca', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                        {o.items_count} art.
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#6b7280' }}>{fmtDate(o.expected_delivery_date)}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        background: STATUS[o.status]?.bg, color: STATUS[o.status]?.color,
                        borderRadius: 10, padding: '4px 10px', fontSize: 12, fontWeight: 700,
                      }}>
                        {STATUS[o.status]?.label || o.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                        {o.status === 'draft' && (
                          <>
                            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}
                              onClick={() => handleConfirm(o.id)}>Conferma</button>
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '4px 6px' }}
                              onClick={() => handleDelete(o.id)}><Trash2 size={14} /></button>
                          </>
                        )}
                        {o.status === 'confirmed' && (
                          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px', color: '#d97706' }}
                            onClick={() => handleStartPreparing(o.id)}>▶ Inizia Prep.</button>
                        )}
                        {o.status === 'preparing' && (
                          <button className="btn btn-gold" style={{ fontSize: 11, padding: '4px 12px' }}
                            onClick={() => setShipModal(o.id)}>🚚 Spedisci</button>
                        )}
                        {o.status === 'shipped' && o.delivery_note_id && (
                          <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>BDC-{o.delivery_note_id}</span>
                        )}
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px 6px' }}
                          onClick={() => setSelected(o.id === selectedOrder ? null : o.id)}>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pannello dettaglio */}
        {selectedOrder && (
          <OrderDetail
            orderId={selectedOrder}
            onClose={() => setSelected(null)}
            onRefresh={fetchOrders}
            storesList={storesList}
          />
        )}
      </div>

      {/* Modal creazione */}
      {showCreate && (
        <CreateOrderModal
          storesList={storesList}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchOrders(); }}
        />
      )}

      {/* Modal spedizione */}
      {showShipModal && (
        <ShipModal
          orderId={showShipModal}
          onClose={() => setShipModal(null)}
          onShipped={() => { setShipModal(null); fetchOrders(); }}
        />
      )}
    </div>
  );
}

/* ─── Dettaglio ordine (pannello laterale) ────────────────── */
function OrderDetail({ orderId, onClose, onRefresh, storesList }) {
  const [order, setOrder] = useState(null);

  useEffect(() => {
    restockOrders.getOne(orderId)
      .then(r => setOrder(r.data?.data))
      .catch(() => toast.error('Errore caricamento dettaglio'));
  }, [orderId]);

  if (!order) return (
    <div className="table-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ color: '#9ca3af' }}>Caricamento...</div>
    </div>
  );

  const st = STATUS[order.status];

  return (
    <div className="table-card" style={{ padding: 24, position: 'relative' }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
        <X size={18} />
      </button>

      <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{order.order_number}</div>
      <span style={{ background: st?.bg, color: st?.color, borderRadius: 10, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
        {st?.label}
      </span>

      <div style={{ marginTop: 20, display: 'grid', gap: 10 }}>
        {[
          ['🏪 Negozio', order.store_name],
          ['📅 Consegna attesa', fmtDate(order.expected_delivery_date)],
          ['👤 Creato da', order.created_by_name],
          ['🕐 Creato il', fmtDT(order.created_at)],
          order.confirmed_at && ['✅ Confermato', fmtDT(order.confirmed_at)],
          order.preparing_at && ['📦 In prep. dal', fmtDT(order.preparing_at)],
          order.shipped_at   && ['🚚 Spedito il', fmtDT(order.shipped_at)],
        ].filter(Boolean).map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #f3f4f6', paddingBottom: 6 }}>
            <span style={{ color: '#6b7280' }}>{label}</span>
            <span style={{ fontWeight: 600 }}>{value}</span>
          </div>
        ))}
      </div>

      {order.notes && (
        <div style={{ marginTop: 16, padding: 12, background: '#f9fafb', borderRadius: 8, fontSize: 13, color: '#374151' }}>
          📝 {order.notes}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#374151' }}>
          Articoli ({order.items?.length || 0})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
          {(order.items || []).map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f9fafb', borderRadius: 8, fontSize: 13 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                {item.sku && <div style={{ fontSize: 11, color: '#9ca3af' }}>SKU: {item.sku}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: '#1a1a2e' }}>× {item.requested_qty}</div>
                <div style={{ fontSize: 11, color: item.central_stock > 0 ? '#059669' : '#dc2626' }}>
                  Centrale: {item.central_stock}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Modal Creazione Ordine ──────────────────────────────── */
function CreateOrderModal({ storesList, onClose, onCreated }) {
  const [form, setForm] = useState({ store_id: '', notes: '', expected_delivery_date: '', items: [] });
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const searchRef = useRef();

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return; }
    try {
      const res = await catalog.getProducts({ search: q, limit: 10, include_variants: 1 });
      const all = [];
      (res.data?.data || []).forEach(p => {
        (p.variants || []).forEach(v => {
          all.push({ id: v.id, sku: v.sku, barcode: v.barcode, name: `${p.name}${v.flavor ? ' – ' + v.flavor : ''}`, on_hand: v.on_hand ?? 0 });
        });
      });
      setResults(all);
    } catch {}
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(search), 300);
    return () => clearTimeout(t);
  }, [search, doSearch]);

  const addItem = (vr) => {
    setForm(f => {
      const ex = f.items.find(i => String(i.product_variant_id) === String(vr.id));
      if (ex) return { ...f, items: f.items.map(i => i.product_variant_id === vr.id ? { ...i, requested_qty: i.requested_qty + 1 } : i) };
      return { ...f, items: [...f.items, { product_variant_id: vr.id, product_name: vr.name, barcode: vr.barcode, sku: vr.sku, requested_qty: 1 }] };
    });
    setSearch(''); setResults([]);
  };

  const handleSave = async () => {
    if (!form.store_id) { toast.error('Seleziona un negozio'); return; }
    if (form.items.length === 0) { toast.error('Aggiungi almeno un articolo'); return; }
    setSaving(true);
    try {
      await restockOrders.create(form);
      toast.success('Ordine creato ✓');
      onCreated();
    } catch (e) { toast.error(e.response?.data?.message || 'Errore'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 32, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>📋 Nuovo Ordine di Riassortimento</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div>
            <label className="field-label">Negozio Destinazione *</label>
            <select className="field-input" value={form.store_id} onChange={e => setForm({ ...form, store_id: e.target.value })}>
              <option value="">— seleziona —</option>
              {storesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Data Consegna Attesa</label>
            <input className="field-input" type="date" value={form.expected_delivery_date} onChange={e => setForm({ ...form, expected_delivery_date: e.target.value })} />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label className="field-label">Note</label>
          <textarea className="field-input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Istruzioni per il magazzino..." />
        </div>

        {/* Ricerca prodotti */}
        <div style={{ marginBottom: 16, position: 'relative' }}>
          <label className="field-label">Cerca e Aggiungi Prodotti</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input ref={searchRef} className="field-input" style={{ paddingLeft: 34 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca per nome, SKU o barcode..." />
          </div>
          {results.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, zIndex: 200, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
              {results.map(vr => (
                <div key={vr.id} onClick={() => addItem(vr)}
                  style={{ padding: '10px 16px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{vr.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{vr.sku}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: vr.on_hand > 0 ? '#059669' : '#dc2626' }}>
                    Giacenza: {vr.on_hand}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lista articoli */}
        {form.items.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#374151' }}>Articoli ({form.items.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {form.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f9fafb', borderRadius: 10 }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{item.product_name}</div>
                  <input type="number" min={1}
                    value={item.requested_qty}
                    onChange={e => {
                      const next = [...form.items];
                      next[idx] = { ...next[idx], requested_qty: parseInt(e.target.value) || 1 };
                      setForm({ ...form, items: next });
                    }}
                    style={{ width: 60, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, fontWeight: 700, textAlign: 'center' }}
                  />
                  <button onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-ghost" onClick={onClose}>Annulla</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvataggio...' : '📋 Salva come Bozza'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal Spedizione ──────────────────────────────────── */
function ShipModal({ orderId, onClose, onShipped }) {
  const [trackingNumber, setTracking] = useState('');
  const [shipping, setShipping] = useState(false);

  const handleShip = async () => {
    setShipping(true);
    try {
      const res = await restockOrders.ship(orderId, { tracking_number: trackingNumber || undefined });
      toast.success(`Spedito! Bolla ${res.data?.note_number} creata e giacenze scalate ✓`);
      onShipped();
    } catch (e) { toast.error(e.response?.data?.message || 'Errore'); }
    finally { setShipping(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 32, width: 440, boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>🚚 Conferma Spedizione</div>
        <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>
          Questa azione creerà automaticamente una Bolla di Scarico e scalerà le giacenze dal Magazzino Centrale.
        </div>

        <div style={{ marginBottom: 20 }}>
          <label className="field-label">Numero Tracking BRT (opzionale)</label>
          <input className="field-input" value={trackingNumber} onChange={e => setTracking(e.target.value)} placeholder="es. 12345678901234" />
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            Se inserito, il negozio potrà seguire la spedizione in tempo reale
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-ghost" onClick={onClose}>Annulla</button>
          <button className="btn btn-gold" onClick={handleShip} disabled={shipping}>
            {shipping ? 'Spedizione...' : '🚚 Spedisci e Crea Bolla'}
          </button>
        </div>
      </div>
    </div>
  );
}
