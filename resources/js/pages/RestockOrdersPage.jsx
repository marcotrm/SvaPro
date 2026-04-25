import React, { useState, useEffect, useRef, useCallback } from 'react';
import DatePicker from '../components/DatePicker.jsx';
import { restockOrders, stores as storesApi, catalog } from '../api.jsx';
import { toast } from 'react-hot-toast';
import {
  Package, Plus, ChevronRight, Search, Truck, ClipboardList,
  CheckCircle, Clock, Trash2, X, ArrowRight, CheckSquare, Square,
  Barcode, RefreshCw,
} from 'lucide-react';

/* ─── Costanti ──────────────────────────────────────────────────────── */
const STATUS = {
  draft:      { label: '📝 Bozza',           color: '#6b7280', bg: '#f3f4f6' },
  confirmed:  { label: '? Confermato',       color: '#059669', bg: '#d1fae5' },
  preparing:  { label: '?? In Preparazione', color: '#d97706', bg: '#fef3c7' },
  shipped:    { label: '🚚 Spedito',          color: '#7c3aed', bg: '#ede9fe' },
  cancelled:  { label: '❌ Annullato',        color: '#dc2626', bg: '#fee2e2' },
};

const fmtDate = v => v ? new Date(v).toLocaleDateString('it-IT') : '–';
const fmtDT   = v => v ? new Date(v).toLocaleString('it-IT')     : '–';

/* ─── Componente principale ─────────────────────────────────────────── */
export default function RestockOrdersPage() {
  const [orders, setOrders]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [storesList, setStoresList]   = useState([]);
  const [activeTab, setActiveTab]     = useState('all');
  const [selectedOrder, setSelected]  = useState(null);
  const [showCreate, setShowCreate]   = useState(false);
  const [showShipModal, setShipModal] = useState(null);

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
    { key: 'confirmed', label: '? Confermati' },
    { key: 'preparing', label: '?? In Preparazione' },
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

      <div style={{ display: 'grid', gridTemplateColumns: selectedOrder ? '1fr 460px' : '1fr', gap: 20 }}>
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
            onShip={(id) => setShipModal(id)}
          />
        )}
      </div>

      {showCreate && (
        <CreateOrderModal
          storesList={storesList}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchOrders(); }}
        />
      )}

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

/* ─── Dettaglio ordine + checklist palmarino ────────────────────────── */
function OrderDetail({ orderId, onClose, onRefresh, onShip }) {
  const [order, setOrder]     = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [checked, setChecked] = useState({}); // { [item.id]: bool }

  useEffect(() => {
    setOrder(null); setLoadErr(''); setChecked({});
    restockOrders.getOne(orderId)
      .then(r => setOrder(r.data?.data || null))
      .catch(e => {
        const msg = e.response?.data?.message || 'Errore caricamento dettaglio';
        setLoadErr(msg);
        toast.error(msg);
      });
  }, [orderId]);

  if (loadErr) return (
    <div className="table-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 12 }}>
      <div style={{ color: '#dc2626', fontSize: 14, fontWeight: 600 }}>??️ {loadErr}</div>
      <button className="btn btn-ghost" onClick={onClose}>Chiudi</button>
    </div>
  );

  if (!order) return (
    <div className="table-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 8 }}>
        <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Caricamento...
      </div>
    </div>
  );

  const st       = STATUS[order.status];
  const items    = order.items || [];
  const isPreparing = order.status === 'preparing';
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const allChecked   = items.length > 0 && checkedCount === items.length;

  const toggleItem = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleAll  = () => {
    if (allChecked) setChecked({});
    else setChecked(Object.fromEntries(items.map(i => [i.id, true])));
  };

  return (
    <div className="table-card" style={{ padding: 0, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header ordine */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f3f4f6', background: isPreparing ? '#fffbf0' : '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: '#1a1a2e' }}>{order.order_number}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ background: st?.bg, color: st?.color, borderRadius: 10, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
            {st?.label}
          </span>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>🏪 {order.store_name}</span>
          {order.expected_delivery_date && (
            <span style={{ fontSize: 12, color: '#9ca3af' }}>📅 {fmtDate(order.expected_delivery_date)}</span>
          )}
        </div>

        {order.notes && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#fef9ee', borderRadius: 8, fontSize: 13, color: '#92400e', borderLeft: '3px solid #f59e0b' }}>
            📝 {order.notes}
          </div>
        )}
      </div>

      {/* Checklist articoli — ottimizzata per palmarino */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Header checklist */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 24px', background: '#f9fafb', borderBottom: '1px solid #f3f4f6', position: 'sticky', top: 0, zIndex: 2,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
            Articoli ({items.length})
            {isPreparing && (
              <span style={{ marginLeft: 10, color: checkedCount === items.length ? '#059669' : '#d97706', fontWeight: 800 }}>
                {checkedCount}/{items.length} ✓
              </span>
            )}
          </div>
          {isPreparing && items.length > 0 && (
            <button onClick={toggleAll} style={{
              display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none',
              cursor: 'pointer', color: '#4338ca', fontWeight: 700, fontSize: 12,
            }}>
              {allChecked ? <CheckSquare size={16} /> : <Square size={16} />}
              {allChecked ? 'Deseleziona tutti' : 'Seleziona tutti'}
            </button>
          )}
        </div>

        {/* Righe articoli */}
        <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map(item => {
            const isDone = checked[item.id] || false;
            return (
              <div key={item.id}
                onClick={() => isPreparing && toggleItem(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 12,
                  background: isDone ? '#f0fdf4' : '#f9fafb',
                  border: `1.5px solid ${isDone ? '#86efac' : '#f3f4f6'}`,
                  cursor: isPreparing ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                  opacity: isDone ? 0.7 : 1,
                }}
              >
                {/* Checkbox palmarino */}
                {isPreparing && (
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: isDone ? '#22c55e' : '#e5e7eb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    {isDone && <CheckCircle size={18} color="#fff" />}
                  </div>
                )}

                {/* Info prodotto */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 700, fontSize: 14, color: isDone ? '#374151' : '#111827',
                    textDecoration: isDone ? 'line-through' : 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.product_name}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                    {item.sku && (
                      <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>SKU: {item.sku}</span>
                    )}
                    {item.barcode && (
                      <span style={{ fontSize: 10, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Barcode size={9} /> {item.barcode}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quantità e stock */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontWeight: 900, fontSize: 20, color: isDone ? '#22c55e' : '#4338ca',
                    lineHeight: 1,
                  }}>×{item.requested_qty}</div>
                  {item.central_stock !== undefined && (
                    <div style={{ fontSize: 10, fontWeight: 600, marginTop: 3, color: item.central_stock > 0 ? '#059669' : '#dc2626' }}>
                      Centrale: {item.central_stock}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer azioni */}
      {isPreparing && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid #f3f4f6', background: '#fff' }}>
          {/* Progress bar */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 5 }}>
              <span>Progresso preparazione</span>
              <span>{Math.round((checkedCount / Math.max(items.length, 1)) * 100)}%</span>
            </div>
            <div style={{ height: 8, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99, transition: 'width 0.3s',
                width: `${(checkedCount / Math.max(items.length, 1)) * 100}%`,
                background: allChecked ? '#22c55e' : '#d97706',
              }} />
            </div>
          </div>
          <button
            onClick={() => onShip(orderId)}
            disabled={!allChecked}
            style={{
              width: '100%', padding: '14px', borderRadius: 12, border: 'none',
              background: allChecked ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : '#f3f4f6',
              color: allChecked ? '#fff' : '#9ca3af',
              fontWeight: 800, fontSize: 14, cursor: allChecked ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Truck size={16} />
            {allChecked ? '🚚 Spedisci Ordine' : `Spunta tutti i ${items.length} articoli per spedire`}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Modal Creazione Ordine (redesign) ─────────────────────────────── */
function CreateOrderModal({ storesList, onClose, onCreated }) {
  const [step, setStep]     = useState(1); // 1=info, 2=prodotti
  const [form, setForm]     = useState({ store_id: '', notes: '', expected_delivery_date: '', items: [] });
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

  useEffect(() => {
    if (step === 2) setTimeout(() => searchRef.current?.focus(), 100);
  }, [step]);

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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 24, width: '100%', maxWidth: 700, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.3)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid #f3f4f6', background: 'linear-gradient(135deg, #0e1726, #1e1b4b)', color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>📋 Nuovo Ordine di Riassortimento</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                {step === 1 ? 'Imposta i dettagli dell\'ordine' : `${form.items.length} articoli aggiunti`}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, cursor: 'pointer', color: '#fff', padding: '8px 10px', display: 'flex' }}>
              <X size={18} />
            </button>
          </div>
          {/* Steps */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[['1', 'Info Ordine'], ['2', 'Articoli']].map(([s, l]) => (
              <div key={s} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                opacity: step < parseInt(s) ? 0.4 : 1,
                cursor: step > parseInt(s) ? 'pointer' : 'default',
              }} onClick={() => step > parseInt(s) && setStep(parseInt(s))}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', fontWeight: 800, fontSize: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: step >= parseInt(s) ? '#c9a227' : 'rgba(255,255,255,0.15)',
                  color: step >= parseInt(s) ? '#0e1726' : '#fff',
                }}>{s}</div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{l}</span>
                {s === '1' && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>?</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

          {/* STEP 1 — Info */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label className="field-label">🏪 Negozio Destinazione *</label>
                  <select className="field-input" value={form.store_id} onChange={e => setForm({ ...form, store_id: e.target.value })}>
                    <option value="">— seleziona —</option>
                    {storesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">📅 Data Consegna Attesa</label>
                  <DatePicker value={form.expected_delivery_date} onChange={v => setForm({ ...form, expected_delivery_date: v })} placeholder="Seleziona data" />
                </div>
              </div>
              <div>
                <label className="field-label">📝 Note per il magazzino</label>
                <textarea className="field-input" rows={3} value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Istruzioni speciali, priorità, riferimenti interni..." />
              </div>

              {/* Info card */}
              <div style={{ padding: '16px 20px', background: '#eff6ff', borderRadius: 14, border: '1px solid #bfdbfe', fontSize: 13, color: '#1e40af', lineHeight: 1.6 }}>
                <strong>💡 Come funziona:</strong><br />
                Crea l'ordine come <em>Bozza</em> ? confermalo ? avvia la preparazione sul palmarino ? spedisci. Verrà generata automaticamente una Bolla di Scarico.
              </div>
            </div>
          )}

          {/* STEP 2 — Prodotti */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Ricerca */}
              <div style={{ position: 'relative' }}>
                <label className="field-label">🔍 Cerca e Aggiungi Prodotti</label>
                <div style={{ position: 'relative' }}>
                  <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                  <input ref={searchRef} className="field-input" style={{ paddingLeft: 38 }}
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Nome, SKU o barcode..." />
                </div>
                {results.length > 0 && (
                  <div style={{ position: 'absolute', left: 0, right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, zIndex: 200, maxHeight: 220, overflowY: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,0.15)', top: 'calc(100% + 4px)' }}>
                    {results.map(vr => (
                      <div key={vr.id} onClick={() => addItem(vr)}
                        style={{ padding: '11px 16px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{vr.name}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{vr.sku}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: vr.on_hand > 0 ? '#059669' : '#dc2626' }}>
                            Disp: {vr.on_hand}
                          </span>
                          <div style={{ fontSize: 10, color: '#9ca3af' }}>+ Aggiungi</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista articoli */}
              {form.items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                  <Package size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <div style={{ fontSize: 14 }}>Nessun articolo aggiunto</div>
                  <div style={{ fontSize: 12 }}>Cerca un prodotto qui sopra per aggiungerlo</div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Articoli ({form.items.length})</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      Tot. pezzi: {form.items.reduce((s, i) => s + i.requested_qty, 0)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                    {form.items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f9fafb', borderRadius: 12, border: '1px solid #f3f4f6' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product_name}</div>
                          {item.sku && <div style={{ fontSize: 10, color: '#9ca3af' }}>{item.sku}</div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => { const n = [...form.items]; n[idx] = { ...n[idx], requested_qty: Math.max(1, n[idx].requested_qty - 1) }; setForm({ ...form, items: n }); }}
                            style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                          <span style={{ fontWeight: 900, fontSize: 16, minWidth: 28, textAlign: 'center' }}>{item.requested_qty}</span>
                          <button onClick={() => { const n = [...form.items]; n[idx] = { ...n[idx], requested_qty: n[idx].requested_qty + 1 }; setForm({ ...form, items: n }); }}
                            style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                        <button onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4, display: 'flex' }}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
          <button className="btn btn-ghost" onClick={step === 1 ? onClose : () => setStep(1)}>
            {step === 1 ? 'Annulla' : '← Indietro'}
          </button>
          {step === 1 ? (
            <button onClick={() => {
              if (!form.store_id) { toast.error('Seleziona un negozio'); return; }
              setStep(2);
            }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #1e1b4b, #312e81)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Avanti: Aggiungi Articoli ?
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving || form.items.length === 0} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12, border: 'none',
              background: form.items.length > 0 ? 'linear-gradient(135deg, #c9a227, #b8901f)' : '#f3f4f6',
              color: form.items.length > 0 ? '#0e1726' : '#9ca3af',
              fontWeight: 800, fontSize: 14, cursor: form.items.length > 0 ? 'pointer' : 'not-allowed',
            }}>
              {saving ? '⏳ Salvataggio...' : `📋 Salva Bozza (${form.items.length} art.)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Modal Spedizione ───────────────────────────────────────────────── */
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
