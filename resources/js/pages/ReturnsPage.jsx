import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { returns, orders as ordersApi } from '../api.jsx';
import { Search, Plus, AlertTriangle, Package, ArrowLeftRight, ChevronRight, X, RefreshCcw, User, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import OrderDetailModal from '../components/OrderDetailModal.jsx';

/* ─── Return Detail Modal ─────────────────────────────────────── */
function ReturnDetailModal({ returnObj, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        // Fetch specific return details
        const res = await returns.getAll({ return_id: returnObj.id, limit: 1 });
        const found = res.data?.data?.find(r => r.id === returnObj.id);
        setDetail(found || returnObj);
      } catch {
        setDetail(returnObj);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [returnObj.id]);

  const r = detail || returnObj;
  const fmtDate = v => v ? new Date(v).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–';
  const fmtCurrency = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);

  const STATUS_LABELS_LOCAL = {
    pending: 'In attesa', requested: 'Richiesto', approved: 'Approvato',
    received: 'Ricevuto', refunded: 'Rimborsato', denied: 'Rifiutato',
    rejected: 'Rifiutato', exchanged: 'Scambiato', on_hold: '⏸ In Attesa',
    repaired: '🔧 Riparato', scrapped: '🗑 Smaltimento', sent_to_supplier: '📦 Al Produttore',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 4000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: '#fff', borderRadius: 20, width: '100%', maxWidth: 640,
        maxHeight: '88vh', overflow: 'auto',
        boxShadow: '0 32px 80px rgba(0,0,0,0.22)',
        border: '1px solid #e2e8f0',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid #f1f5f9',
          background: 'linear-gradient(135deg, #0f172a, #1e293b)', borderRadius: '20px 20px 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowLeftRight size={20} color="#f87171" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>Dettaglio Reso #{r.id}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                Ordine #{r.order_id || r.sales_order_id || '–'} • {fmtDate(r.created_at)}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Info Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Cliente', value: r.customer_name || 'Non registrato' },
              { label: 'Dipendente', value: r.employee_name || '—' },
              { label: 'Negozio', value: r.store_name || '—' },
              { label: 'Stato', value: STATUS_LABELS_LOCAL[r.status] || r.status },
              { label: 'Motivo', value: r.reason || '—' },
              { label: 'Valore Rimborso', value: fmtCurrency(r.refund_amount || r.total_value) },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Note */}
          {r.notes && (
            <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', marginBottom: 4 }}>Note</div>
              <div style={{ fontSize: 13, color: '#78350f' }}>{r.notes}</div>
            </div>
          )}

          {/* Lines / Articoli */}
          {r.lines && r.lines.length > 0 ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                Articoli Resi ({r.lines.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {r.lines.map((line, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', background: '#f8fafc', borderRadius: 12,
                    border: '1px solid #e2e8f0',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Package size={16} color="#6366f1" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{line.product_name || line.name || `Prodotto #${line.product_variant_id}`}</div>
                        {line.flavor && <div style={{ fontSize: 11, color: '#94a3b8' }}>{line.flavor}</div>}
                        {line.condition && <span style={{ fontSize: 10, background: line.condition === 'good' ? '#dcfce7' : '#fee2e2', color: line.condition === 'good' ? '#16a34a' : '#dc2626', borderRadius: 6, padding: '1px 6px', fontWeight: 700 }}>{line.condition === 'good' ? 'Buono' : line.condition === 'damaged' ? 'Danneggiato' : 'Difettoso'}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>×{line.qty || line.quantity}</div>
                      {line.unit_price && <div style={{ fontSize: 11, color: '#94a3b8' }}>{fmtCurrency(line.unit_price)}/pz</div>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 16px', background: '#f8fafc', borderRadius: 12, color: '#94a3b8' }}>
              <Package size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>Dettaglio articoli non disponibile</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Vedi l'ordine #{ r.order_id || r.sales_order_id} per i prodotti</div>
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '10px 24px', borderRadius: 12, border: '2px solid #e2e8f0', background: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Chiudi</button>
          </div>
        </div>
      </div>
    </div>
  );
}


const STATUS_LABELS = {
  pending:            'In attesa',
  requested:          'Richiesto',
  approved:           'Approvato',
  received:           'Ricevuto',
  refunded:           'Rimborsato',
  denied:             'Rifiutato',
  rejected:           'Rifiutato',
  exchanged:          'Scambiato',
  on_hold:            '⏸ In Attesa',
  repaired:           '🔧 Riparato',
  scrapped:           '🗑 Smaltimento',
  sent_to_supplier:   '📦 Al Produttore',
};

const STATUS_BADGE = {
  pending:          'sp-badge-warning',
  requested:        'sp-badge-warning',
  approved:         'sp-badge-info',
  received:         'sp-badge-info',
  refunded:         'sp-badge-success',
  denied:           'sp-badge-error',
  rejected:         'sp-badge-error',
  exchanged:        'sp-badge-neutral',
  on_hold:          'sp-badge-warning',
  repaired:         'sp-badge-success',
  scrapped:         'sp-badge-neutral',
  sent_to_supplier: 'sp-badge-info',
};

export default function ReturnsPage() {
  const { selectedStoreId } = useOutletContext();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tab, setTab] = useState('list'); // 'list' | 'new'
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [isOrderDetailOpen, setIsOrderDetailOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null); // for ReturnDetailModal


  // --- New Return Form ---
  const [lookupId, setLookupId] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [orderLines, setOrderLines] = useState([]);
  const [selectedReturnLines, setSelectedReturnLines] = useState([]);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const barcodeRef = useRef(null);

  useEffect(() => { fetchList(); }, [selectedStoreId, statusFilter]);

  const fetchList = async () => {
    try {
      setLoading(true); setError('');
      const params = { limit: 200 };
      if (selectedStoreId) params.store_id = selectedStoreId;
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await returns.getAll(params);
      setList(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nel caricamento resi');
    } finally { setLoading(false); }
  };

  const lookupOrder = async () => {
    const id = lookupId.trim();
    if (!id) return toast.error('Inserisci un ID ordine o barcode');
    try {
      setLookupLoading(true);
      setOrderLines([]);
      setSelectedReturnLines([]);
      const res = await ordersApi.getOrder(Number(id));
      const lines = res.data?.data?.lines || [];
      setOrderLines(lines);
      if (lines.length === 0) toast.error('Nessun articolo trovato per questo ordine');
      else {
        // Pre-select all lines
        setSelectedReturnLines(lines.map(l => ({
          product_variant_id: l.product_variant_id,
          qty: l.qty,
          condition: 'good',
          max_qty: l.qty,
        })));
      }
    } catch (err) {
      toast.error('Ordine non trovato. Verifica l\'ID.');
    } finally { setLookupLoading(false); }
  };

  const toggleLine = (variantId) => {
    const exists = selectedReturnLines.find(l => l.product_variant_id === variantId);
    if (exists) {
      setSelectedReturnLines(prev => prev.filter(l => l.product_variant_id !== variantId));
    } else {
      const orderLine = orderLines.find(l => l.product_variant_id === variantId);
      setSelectedReturnLines(prev => [...prev, {
        product_variant_id: variantId,
        qty: orderLine?.qty || 1,
        condition: 'good',
        max_qty: orderLine?.qty || 1,
      }]);
    }
  };

  const updateReturnLine = (variantId, field, value) => {
    setSelectedReturnLines(prev => prev.map(l =>
      l.product_variant_id === variantId ? { ...l, [field]: value } : l
    ));
  };

  const handleCreate = async () => {
    if (!lookupId || selectedReturnLines.length === 0) {
      return toast.error('Seleziona almeno un prodotto da rendere');
    }
    try {
      setSaving(true);
      await returns.create({
        order_id: Number(lookupId),
        reason,
        notes,
        lines: selectedReturnLines.map(l => ({
          product_variant_id: l.product_variant_id,
          qty: Number(l.qty),
          condition: l.condition,
        })),
      });
      toast.success('Reso creato con successo!');
      setTab('list');
      setLookupId('');
      setOrderLines([]);
      setSelectedReturnLines([]);
      setReason('');
      setNotes('');
      await fetchList();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Errore nella creazione del reso');
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (returnId, newStatus) => {
    try {
      await returns.updateStatus(returnId, newStatus);
      toast.success(`Reso ${STATUS_LABELS[newStatus] || newStatus}`);
      await fetchList();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Errore nel cambio stato');
    }
  };

  const fmtDate = v => v ? new Date(v).toLocaleDateString('it-IT') : '–';
  const fmtCurrency = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);

  const totalRequested = list.filter(r => r.status === 'requested').length;

  return (
    <div className="sp-animate-in">
      {selectedReturn && (
        <ReturnDetailModal
          returnObj={selectedReturn}
          onClose={() => setSelectedReturn(null)}
        />
      )}
      {isOrderDetailOpen && selectedOrderId && (
        <OrderDetailModal
          onClose={() => setIsOrderDetailOpen(false)}
          orderId={selectedOrderId}
        />
      )}

      {/* Header */}
      <div className="sp-page-header">
        <div>
          <h1 className="sp-page-title">Resi e Rimborsi</h1>
          <p className="sp-page-subtitle">
            {list.length} resi{totalRequested > 0 ? ` — ${totalRequested} in attesa` : ''}
          </p>
        </div>
        <div className="sp-page-actions">
          <button
            className={`sp-btn ${tab === 'list' ? 'sp-btn-secondary' : 'sp-btn-ghost'}`}
            onClick={() => setTab('list')}
          >
            Lista
          </button>
          <button
            className={`sp-btn ${tab === 'new' ? 'sp-btn-primary' : 'sp-btn-secondary'}`}
            onClick={() => { setTab('new'); setTimeout(() => barcodeRef.current?.focus(), 100); }}
          >
            <Plus size={16} /> Nuovo Reso
          </button>
        </div>
      </div>

      {error && (
        <div className="sp-alert sp-alert-error">
          <AlertTriangle size={16} /> {error}
          <button className="sp-btn sp-btn-ghost sp-btn-sm" onClick={fetchList} style={{ marginLeft: 'auto' }}>Riprova</button>
        </div>
      )}

      {/* === NUOVO RESO TAB === */}
      {tab === 'new' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Barcode / ID lookup */}
          <div className="sp-card">
            <div className="sp-card-header">
              <span className="sp-card-title">Ricerca Ordine</span>
            </div>
            <div className="sp-card-body" style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label className="sp-label">ID Ordine / Barcode Scontrino</label>
                <div className="sp-search-box">
                  <Search size={14} />
                  <input
                    ref={barcodeRef}
                    className="sp-input"
                    placeholder="Scansiona barcode o inserisci ID ordine..."
                    value={lookupId}
                    onChange={e => setLookupId(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') lookupOrder(); }}
                    type="number"
                  />
                </div>
              </div>
              <button
                className="sp-btn sp-btn-primary"
                onClick={lookupOrder}
                disabled={lookupLoading}
                style={{ alignSelf: 'flex-end' }}
              >
                {lookupLoading ? 'Ricerca...' : <><Search size={16} /> Cerca Ordine</>}
              </button>
            </div>
          </div>

          {/* Articles from order */}
          {orderLines.length > 0 && (
            <div className="sp-card">
              <div className="sp-card-header">
                <span className="sp-card-title">
                  <Package size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                  Articoli Ordine #{lookupId}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  Seleziona i prodotti da restituire
                </span>
              </div>
              <div className="sp-card-body" style={{ padding: 0 }}>
                <table className="sp-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Prodotto</th>
                      <th>Prezzo</th>
                      <th>Qtà Acquistata</th>
                      <th>Qtà Reso</th>
                      <th>Condizione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderLines.map(line => {
                      const selected = selectedReturnLines.find(l => l.product_variant_id === line.product_variant_id);
                      return (
                        <tr
                          key={line.product_variant_id}
                          style={{ opacity: selected ? 1 : 0.5, cursor: 'pointer' }}
                          onClick={() => toggleLine(line.product_variant_id)}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={!!selected}
                              onChange={() => toggleLine(line.product_variant_id)}
                              onClick={e => e.stopPropagation()}
                              style={{ width: 16, height: 16, cursor: 'pointer' }}
                            />
                          </td>
                          <td>
                            <span className="sp-cell-primary">{line.product_name}</span>
                            {line.flavor && <span className="sp-cell-secondary"> — {line.flavor}</span>}
                          </td>
                          <td style={{ fontWeight: 600 }}>{fmtCurrency(line.unit_price)}</td>
                          <td className="sp-font-mono">{line.qty}</td>
                          <td onClick={e => e.stopPropagation()}>
                            {selected && (
                              <input
                                type="number"
                                className="sp-input"
                                style={{ width: 80 }}
                                value={selected.qty}
                                min={1}
                                max={line.qty}
                                onChange={e => updateReturnLine(line.product_variant_id, 'qty', Math.min(line.qty, Math.max(1, Number(e.target.value))))}
                              />
                            )}
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            {selected && (
                              <select
                                className="sp-select"
                                style={{ fontSize: 12 }}
                                value={selected.condition}
                                onChange={e => updateReturnLine(line.product_variant_id, 'condition', e.target.value)}
                              >
                                <option value="good">Buono — Scaffalabile</option>
                                <option value="damaged">Danneggiato</option>
                                <option value="defective">Difettoso</option>
                              </select>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reason and Notes */}
          {orderLines.length > 0 && (
            <div className="sp-card">
              <div className="sp-card-header">
                <span className="sp-card-title">Dettagli Reso</span>
              </div>
              <div className="sp-card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
                <div>
                  <label className="sp-label">Motivo</label>
                  <select className="sp-select" value={reason} onChange={e => setReason(e.target.value)}>
                    <option value="">Seleziona motivo...</option>
                    <option value="difetto">Prodotto difettoso</option>
                    <option value="cambio">Cambio taglia/variante</option>
                    <option value="ripensamento">Ripensamento cliente</option>
                    <option value="errore_vendita">Errore operatore</option>
                    <option value="danno_trasporto">Danno trasporto</option>
                    <option value="altro">Altro</option>
                  </select>
                </div>
                <div>
                  <label className="sp-label">Note aggiuntive</label>
                  <input
                    className="sp-input"
                    placeholder="Note libere sul reso..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ padding: '0 20px 20px', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button className="sp-btn sp-btn-ghost" onClick={() => setTab('list')}>
                  Annulla
                </button>
                <button
                  className="sp-btn sp-btn-primary"
                  onClick={handleCreate}
                  disabled={saving || selectedReturnLines.length === 0}
                >
                  {saving ? 'Salvando...' : `Crea Reso (${selectedReturnLines.length} art.)`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* === LIST TAB === */}
      {tab === 'list' && (
        <div className="sp-table-wrap">
          <div className="sp-table-toolbar">
            {['all', 'requested', 'approved', 'refunded', 'rejected'].map(s => (
              <button
                key={s}
                className={`sp-chip ${statusFilter === s ? 'active' : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === 'all' ? 'Tutti' : STATUS_LABELS[s]}
                {s === 'requested' && totalRequested > 0 && (
                  <span style={{ marginLeft: 4, background: 'var(--color-warning)', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 10 }}>
                    {totalRequested}
                  </span>
                )}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
              {list.length} risultati
            </span>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
              Caricamento...
            </div>
          ) : (
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Negozio</th>
                  <th>Ordine</th>
                  <th>Cliente</th>
                  <th>Dipendente</th>
                  <th>Motivo</th>
                  <th>Stato</th>
                  <th>Valore</th>
                  <th>Data</th>
                  <th style={{ textAlign: 'right' }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {list.length > 0 ? list.map(r => (
                  <tr 
                    key={r.id} 
                    style={{ cursor: 'pointer' }} 
                    onClick={() => setSelectedReturn(r)}
                  >

                    <td className="sp-cell-secondary" style={{ fontSize: 12 }}>{r.store_name || '—'}</td>
                    <td className="sp-font-mono">
                      <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
                        #{r.order_id || r.sales_order_id || '–'}
                      </span>
                    </td>
                    <td className="sp-cell-primary">{r.customer_name || 'Cliente non registrato'}</td>
                    <td className="sp-cell-secondary" style={{ fontSize: 12 }}>{r.employee_name || '—'}</td>
                    <td className="sp-cell-secondary">{r.reason || '–'}</td>
                    <td>
                      <span className={`sp-badge ${STATUS_BADGE[r.status] || 'sp-badge-neutral'}`}>
                        <span className="sp-badge-dot" />
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{fmtCurrency(r.refund_amount || r.total_value)}</td>
                    <td className="sp-cell-secondary">{fmtDate(r.created_at)}</td>
                    <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, flexWrap: 'wrap' }}>
                        {/* Da Richiesto/Pending: approva o nega */}
                        {(r.status === 'requested' || r.status === 'pending') && (<>
                          <button className="sp-btn sp-btn-success sp-btn-sm" onClick={() => handleStatusChange(r.id, 'approved')}>Approva</button>
                          <button className="sp-btn sp-btn-ghost sp-btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => handleStatusChange(r.id, 'denied')}>Nega</button>
                          <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => handleStatusChange(r.id, 'on_hold')}>⏸ Attesa</button>
                        </>)}
                        {/* Da Approvato: ricevuto o rimborso o smaltimento o produttore */}
                        {r.status === 'approved' && (<>
                          <button className="sp-btn sp-btn-primary sp-btn-sm" onClick={() => handleStatusChange(r.id, 'refunded')}>Rimborsa</button>
                          <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => handleStatusChange(r.id, 'repaired')}>🔧 Riparato</button>
                          <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => handleStatusChange(r.id, 'scrapped')}>🗑 Smaltimento</button>
                          <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => handleStatusChange(r.id, 'sent_to_supplier')}>📦 Produttore</button>
                        </>)}
                        {/* Da In Attesa: approva o nega */}
                        {r.status === 'on_hold' && (<>
                          <button className="sp-btn sp-btn-success sp-btn-sm" onClick={() => handleStatusChange(r.id, 'approved')}>Approva</button>
                          <button className="sp-btn sp-btn-ghost sp-btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => handleStatusChange(r.id, 'denied')}>Nega</button>
                        </>)}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="8" className="sp-table-empty">
                      Nessun reso trovato
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
