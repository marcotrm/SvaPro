import React, { useState, useEffect, useCallback } from 'react';
import DatePicker from '../components/DatePicker.jsx';
import { useOutletContext } from 'react-router-dom';
import { purchaseOrders, suppliers as suppliersApi, stores as storesApi } from '../api.jsx';
import { SkeletonTable } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import { toast } from 'react-hot-toast';

export default function PurchaseOrdersPage() {
  const { selectedStoreId, selectedStore } = useOutletContext();
  const [list, setList] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);
  const [warehousesList, setWarehousesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [detail, setDetail] = useState(null);

  // Receive modal state
  const [receiveModal, setReceiveModal] = useState(null); // po object
  const [receiveWarehouseId, setReceiveWarehouseId] = useState('');
  const [receiveLines, setReceiveLines] = useState([]);
  const [receiveSaving, setReceiveSaving] = useState(false);
  const [receiveError, setReceiveError] = useState('');
  const [receiveTogglePending, setReceiveTogglePending] = useState(false);
  const [lastReceived, setLastReceived] = useState(null); // po data after receive for DDT print

  const [form, setForm] = useState({
    supplier_id: '', notes: '', expected_at: '',
    lines: [{ product_variant_id: '', qty: '', unit_cost: '' }],
  });

  useEffect(() => { fetchAll(); }, [selectedStoreId, statusFilter]);

  const fetchAll = async () => {
    try {
      setLoading(true); setError('');
      const params = { limit: 200 };
      if (selectedStoreId) params.store_id = selectedStoreId;
      if (statusFilter !== 'all') params.status = statusFilter;
      const [poRes, supRes, wRes] = await Promise.all([
        purchaseOrders.getAll(params),
        suppliersApi.getAll(),
        storesApi.getStores(),
      ]);
      setList(poRes.data?.data || []);
      setSuppliersList(supRes.data?.data || []);
      setWarehousesList(wRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nel caricamento');
    } finally { setLoading(false); }
  };

  const handleCreate = async () => {
    try {
      setSaving(true); setError('');
      const payload = {
        ...form,
        lines: form.lines.filter(l => l.product_variant_id && l.qty && l.unit_cost),
      };
      await purchaseOrders.create(payload);
      setShowForm(false);
      setForm({ supplier_id: '', notes: '', expected_at: '', lines: [{ product_variant_id: '', qty: '', unit_cost: '' }] });
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nella creazione');
    } finally { setSaving(false); }
  };

  const handleSend = async (poId) => {
    try {
      setActionLoading(`${poId}-send`); setError('');
      await purchaseOrders.send(poId);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setActionLoading(null); }
  };

  const handleCancel = async (poId) => {
    if (!confirm('Annullare questo ordine?')) return;
    try {
      setActionLoading(`${poId}-cancel`); setError('');
      await purchaseOrders.cancel(poId);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setActionLoading(null); }
  };

    const openReceive = async (po) => {
    try {
      setReceiveError('');
      const res = await purchaseOrders.getOne(po.id);
      const detail = res.data?.data || null;
      if (!detail) { setError('Impossibile caricare dettaglio PO.'); return; }
      setReceiveModal({ ...po, lines: detail.lines || [] });
      setReceiveLines((detail.lines || []).map(l => ({ ...l, qty_received: 0, lot_number: '', expiry_date: '' })));
      setReceiveWarehouseId(warehousesList[0]?.id || '');
      setReceiveTogglePending(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const handleReceive = async () => {
    if (!receiveWarehouseId) { setReceiveError('Seleziona il magazzino di destinazione.'); return; }
    if (receiveLines.every(l => !l.qty_received || l.qty_received < 1)) {
      setReceiveError('Inserisci almeno una quantità ricevuta > 0 per salvare.');
      return;
    }
    try {
      setReceiveSaving(true); setReceiveError('');
      await purchaseOrders.receive(receiveModal.id, {
        warehouse_id: receiveWarehouseId,
        lines: receiveLines.map(l => ({
          purchase_order_line_id: l.id,
          qty_received: parseInt(l.qty_received) || 0,
          lot_number: l.lot_number,
          expiry_date: l.expiry_date,
        })),
      });
      // Save for DDT printing
      setLastReceived({ ...receiveModal, warehouseId: receiveWarehouseId, receivedLines: receiveLines });
      setReceiveModal(null);
      await fetchAll();
    } catch (err) {
      setReceiveError(err.response?.data?.message || err.message);
    } finally { setReceiveSaving(false); }
  };

  const printDdtCarico = (po, warehouseId, lines, isProforma = false) => {
    const w = window.open('', '_blank');
    const wh = warehousesList.find(wh => String(wh.id) === String(warehouseId));
    const today = new Date().toLocaleDateString('it-IT');
    const tipo = isProforma ? 'BOLLA DI CARICO PROFORMA' : 'BOLLA DI CARICO MERCE';
    w.document.write(`<!DOCTYPE html><html><head>
<title>${tipo} — PO #${po.po_number || po.id}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 32px; color: #111; font-size: 13px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #666; font-size: 12px; margin-bottom: 24px; }
  .badge { display:inline-block; padding: 2px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 20px; background: #d1fae5; color: #065f46; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px; background: #f5f5f7; padding: 14px; border-radius: 8px; }
  .info-block h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #888; margin: 0 0 2px; }
  .info-block p { font-size: 14px; font-weight: 700; margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; background: #1a1a2e; color: #fff; }
  td { padding: 8px 10px; border-bottom: 1px solid #eee; }
  .footer { margin-top: 40px; display: flex; justify-content: space-between; }
  .sign-box { border-top: 1px solid #ccc; width: 200px; text-align: center; padding-top: 6px; font-size: 11px; color: #666; }
  .total-bar { background: #f0f0f0; padding: 12px 14px; border-radius: 6px; mt: 16px; font-weight: 700; }
</style></head><body>
<h1>${tipo}</h1>
<div class="sub">PO # ${po.po_number || po.id} &nbsp;|&nbsp; Data: ${today}</div>
<div class="badge">? MERCI RICEVUTE A MAGAZZINO</div>
<div class="info-grid">
  <div class="info-block"><h3>Fornitore</h3><p>${po.supplier_name || '—'}</p></div>
  <div class="info-block"><h3>Magazzino Destinazione</h3><p>${wh?.name || `ID ${warehouseId}`}</p></div>
  <div class="info-block"><h3>Data Ricezione</h3><p>${today}</p></div>
</div>
<table>
  <thead><tr><th>#</th><th>Prodotto</th><th>Qta Ordinata</th><th>Qta Ricevuta</th><th>Costo Unit.</th><th>Totale</th></tr></thead>
  <tbody>
    ${lines.map((l, i) => `
    <tr>
      <td style="color:#aaa">${i + 1}</td>
      <td><strong>${l.product_name || l.product_variant_id}</strong>${l.flavor ? ' — ' + l.flavor : ''}</td>
      <td>${l.qty}</td>
      <td style="font-weight:700">${l.qty_received ?? l.qty}</td>
      <td>${new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(l.unit_cost || 0)}</td>
      <td style="font-weight:700">${new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format((l.qty_received || l.qty) * (l.unit_cost || 0))}</td>
    </tr>`).join('')}
  </tbody>
</table>
<div class="total-bar" style="margin-top:16px">
  Totale Valore Merci: <span style="font-size:18px">${new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(
    lines.reduce((s, l) => s + (l.qty_received || l.qty) * (l.unit_cost || 0), 0)
  )}</span>
</div>
<div class="footer">
  <div class="sign-box">Firma Fornitore / Trasportatore</div>
  <div style="font-size:10px;color:#aaa">Stampato il ${new Date().toLocaleString('it-IT')}</div>
  <div class="sign-box">Firma Magazziniere</div>
</div>
</body></html>`);
    w.document.close(); w.print();
  };

  const handleShowDetail = async (poId) => {
    try {
      const res = await purchaseOrders.getOne(poId);
      setDetail(res.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const addLine = () => setForm({ ...form, lines: [...form.lines, { product_variant_id: '', qty: '', unit_cost: '' }] });
  const updateLine = (idx, field, val) => {
    const lines = [...form.lines]; lines[idx] = { ...lines[idx], [field]: val }; setForm({ ...form, lines });
  };
  const removeLine = (idx) => setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) });

  const fmtDate = v => v ? new Date(v).toLocaleDateString('it-IT') : '—';
  const fmtCurrency = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);
  const statusLabels = { draft: 'Bozza', sent: 'Inviato', received: 'Ricevuto', cancelled: 'Annullato', partial: 'Parziale' };
  const statusClass = s => s === 'received' ? 'high' : s === 'cancelled' ? 'low' : s === 'sent' ? 'mid' : '';
  const filtered = list.filter(po => !searchTerm ||
    po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    po.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const [poFulfillment, setPoFulfillment] = useState({});
  const FULFIL_OPTS = [
    { key: 'scaricato',   label: '📥 Scaricato',   bg: '#dbeafe', color: '#1d4ed8' },
    { key: 'controllato', label: '? Controllato',  bg: '#d1fae5', color: '#065f46' },
    { key: 'pagato',      label: '?? Pagato',       bg: '#fef3c7', color: '#92400e' },
    { key: 'none',        label: '— Nessuno',      bg: '#f3f4f6', color: '#6b7280' },
  ];

  // Inizializza da DB quando la lista cambia
  useEffect(() => {
    const init = {};
    list.forEach(po => { if (po.fulfillment_status && po.fulfillment_status !== 'none') init[po.id] = po.fulfillment_status; });
    setPoFulfillment(init);
  }, [list]);

  const cycleFulfil = async (poId) => {
    const cur  = poFulfillment[poId] || 'none';
    const keys = FULFIL_OPTS.map(o => o.key);
    const next = keys[(keys.indexOf(cur) + 1) % keys.length];
    setPoFulfillment(prev => ({ ...prev, [poId]: next }));
    try {
      await purchaseOrders.patchFulfillment(poId, next);
    } catch {
      toast.error('Errore nel salvataggio stato lavorazione');
      setPoFulfillment(prev => ({ ...prev, [poId]: cur }));
    }
  };

  // ── Ordine Automatico ──
  const [autoModal, setAutoModal]   = useState(false);
  const [autoItems, setAutoItems]   = useState([]);
  const [autoLoad,  setAutoLoad]    = useState(false);
  const [autoSelSup, setAutoSelSup] = useState('');
  const [autoLines, setAutoLines]   = useState([]);
  const [autoSaving, setAutoSaving] = useState(false);

  const fetchAutoSuggest = async () => {
    setAutoLoad(true);
    try {
      const params = {};
      if (selectedStoreId) params.store_id = selectedStoreId;
      if (autoSelSup) params.supplier_id = autoSelSup;
      const res = await purchaseOrders.autoSuggest(params);
      const items = res.data?.data || [];
      setAutoItems(items);
      setAutoLines(items.map(i => ({
        variant_id: i.variant_id,
        product_name: i.product_name,
        flavor: i.flavor,
        qty_on_hand: i.qty_on_hand,
        suggested_qty: i.suggested_qty,
        unit_cost: i.unit_cost,
        qty: i.suggested_qty,
        supplier_id: i.supplier_id,
      })));
    } catch { toast.error('Errore caricamento suggerimenti'); }
    finally { setAutoLoad(false); }
  };

  const handleCreateAutoOrder = async () => {
    const lines = autoLines.filter(l => l.qty > 0);
    if (!autoSelSup) { toast.error('Seleziona il fornitore'); return; }
    if (!lines.length) { toast.error('Nessun prodotto selezionato'); return; }
    setAutoSaving(true);
    try {
      await purchaseOrders.create({
        supplier_id: autoSelSup,
        notes: 'Ordine automatico da stock basso',
        lines: lines.map(l => ({ product_variant_id: l.variant_id, qty: l.qty, unit_cost: l.unit_cost })),
      });
      toast.success('Ordine automatico creato!');
      setAutoModal(false);
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.message || 'Errore'); }
    finally { setAutoSaving(false); }
  };

  if (loading) return <SkeletonTable />;

  return (
    <>
      {/* Header */}
      <div className="page-head">
        <div>
          <div className="page-head-title">Ordini di Acquisto</div>
          <div className="page-head-sub">{list.length} ordini{selectedStore ? ` — ${selectedStore.name}` : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => { setAutoModal(true); fetchAutoSuggest(); }}>
            ⚡ Ordine Automatico
          </button>
          <button className="btn btn-gold" onClick={() => setShowForm(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nuovo PO
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchAll} />}

      {/* ── Post-receive DDT prompt ── */}
      {lastReceived && (
        <div className="table-card" style={{ marginBottom: 16, background: '#f0fdf4', border: '1px solid #86efac', padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 22 }}>?</span>
          <div style={{ flex: 1 }}>
            <strong>Merce ricevuta con successo!</strong> PO #{lastReceived.po_number || lastReceived.id} da {lastReceived.supplier_name}
          </div>
          <button className="btn btn-gold" style={{ fontSize: 12 }}
            onClick={() => printDdtCarico(lastReceived, lastReceived.warehouseId, lastReceived.receivedLines)}>
            🖨 Stampa Bolla di Carico DDT
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setLastReceived(null)}>✕</button>
        </div>
      )}

      {/* ── Receive Modal ── */}
      {receiveModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#1a1a2e', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '90vh', overflow: 'auto', padding: 0 }}>
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>?? Ricezione Merce — PO # {receiveModal.po_number || receiveModal.id}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 }}>Fornitore: {receiveModal.supplier_name}</div>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', height: 'calc(90vh - 140px)' }}>
              {receiveError && <div style={{ background: '#ef4444', color: '#fff', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>{receiveError}</div>}

              <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    Magazzino Destinazione *
                  </label>
                  <select className="field-input" value={receiveWarehouseId} onChange={e => setReceiveWarehouseId(e.target.value)}>
                    <option value="">— seleziona magazzino —</option>
                    {warehousesList.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                    {warehousesList.length === 0 && <option value="1">Magazzino Centrale (ID 1)</option>}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    Spara Barcode Pistola
                  </label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="Spara qui il barcode..."
                    autoFocus
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            const barcode = e.target.value.trim();
                            if (!barcode) return;
                            const idx = receiveLines.findIndex(l => l.variant_barcode === barcode || l.product_barcode === barcode || l.sku === barcode);
                            if (idx >= 0) {
                                const ls = [...receiveLines];
                                ls[idx].qty_received = (parseInt(ls[idx].qty_received) || 0) + 1;
                                setReceiveLines(ls);
                                toast.success(`+1 ${ls[idx].product_name}`);
                            } else {
                                toast.error('Barcode non trovato in questo ordine.');
                            }
                            e.target.value = '';
                        }
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10 }}>
                    <input type="checkbox" id="togglePending" checked={receiveTogglePending} onChange={e => setReceiveTogglePending(e.target.checked)} style={{ accentColor: 'var(--color-accent)' }} />
                    <label htmlFor="togglePending" style={{ color: '#fff', fontSize: 13, cursor: 'pointer' }}>Mostra solo da evadere</label>
                </div>
              </div>

              {/* Lines Table */}
              <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#252542', zIndex: 10 }}>
                        <tr>
                            <th style={{ padding: '10px 14px', textAlign: 'left', color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase' }}>Prodotto</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase' }}>Atteso</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase' }}>Riscontrato</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase' }}>Lotto</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase' }}>Scadenza</th>
                        </tr>
                    </thead>
                    <tbody>
                        {receiveLines.map((line, idx) => {
                            if (receiveTogglePending && line.qty_received >= line.qty) return null;
                            return (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                onDoubleClick={() => {
                                    const ls = [...receiveLines];
                                    ls[idx].qty_received = (parseInt(ls[idx].qty_received) || 0) + 1;
                                    setReceiveLines(ls);
                                }}
                                title="Doppio click per fare +1"
                            >
                                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#fff', userSelect: 'none' }}>
                                    {line.product_name} {line.flavor ? <span style={{ color: 'rgba(255,255,255,0.45)' }}>— {line.flavor}</span> : ''}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: 'rgba(255,255,255,0.6)', userSelect: 'none' }}>
                                    {line.qty}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                        <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 16 }} onClick={() => {
                                            const ls = [...receiveLines];
                                            ls[idx].qty_received = Math.max(0, (parseInt(ls[idx].qty_received) || 0) - 1);
                                            setReceiveLines(ls);
                                        }}>−</button>
                                        <input type="number" min="0" value={line.qty_received}
                                            onChange={e => { const ls = [...receiveLines]; ls[idx].qty_received = parseInt(e.target.value) || 0; setReceiveLines(ls); }}
                                            style={{ width: 60, textAlign: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '4px 6px', color: '#fff', fontWeight: 800 }}
                                        />
                                    </div>
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                    <input type="text" placeholder="Es. L1234" value={line.lot_number || ''}
                                        onChange={e => { const ls = [...receiveLines]; ls[idx].lot_number = e.target.value; setReceiveLines(ls); }}
                                        style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '4px 8px', color: '#fff' }}
                                    />
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                    <input type="date" value={line.expiry_date || ''}
                                        onChange={e => { const ls = [...receiveLines]; ls[idx].expiry_date = e.target.value; setReceiveLines(ls); }}
                                        style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '4px 8px', color: '#fff' }}
                                    />
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setReceiveModal(null)} style={{ color: 'rgba(255,255,255,0.5)' }}>Annulla</button>
              <button className="btn btn-gold" disabled={receiveSaving} onClick={handleReceive}>
                {receiveSaving ? 'Ricezione...' : '✓ Conferma Ricezione'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail panel ── */}
      {detail && (
        <div className="table-card" style={{ marginBottom: 16 }}>
          <div className="table-toolbar">
            <div className="section-title">Dettaglio PO #{detail.po_number || detail.id}</div>
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              {detail.status === 'received' && (
                <button className="btn btn-ghost" style={{ fontSize: 11 }}
                  onClick={() => printDdtCarico(detail, detail.warehouse_id, detail.lines || [])}>
                  🖨 Stampa Bolla Carico
                </button>
              )}
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setDetail(null)}>Chiudi</button>
            </div>
          </div>
          <div style={{ padding: '0 16px 12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, fontSize: 13 }}>
            <div><strong>Fornitore:</strong> {detail.supplier_name || '—'}</div>
            <div><strong>Stato:</strong> {statusLabels[detail.status] || detail.status}</div>
            <div><strong>Totale:</strong> {fmtCurrency(detail.total_net)}</div>
            <div><strong>Creato:</strong> {fmtDate(detail.created_at)}</div>
          </div>
          {detail.lines?.length > 0 && (
            <table style={{ fontSize: 13 }}>
              <thead><tr><th>Prodotto</th><th>Qtà</th><th>Costo Unit.</th><th>Totale</th></tr></thead>
              <tbody>
                {detail.lines.map((l, i) => (
                  <tr key={i}>
                    <td>{l.product_name || `#${l.product_variant_id}`}{l.flavor ? ` — ${l.flavor}` : ''}</td>
                    <td>{l.qty}</td>
                    <td>{fmtCurrency(l.unit_cost)}</td>
                    <td>{fmtCurrency(l.qty * l.unit_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Create Form ── */}
      {showForm && (
        <div className="table-card" style={{ marginBottom: 16 }}>
          <div className="table-toolbar"><div className="section-title">Nuovo Ordine di Acquisto</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, padding: '12px 16px' }}>
            <div>
              <label className="field-label">Fornitore *</label>
              <select className="field-input" value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">— seleziona —</option>
                {suppliersList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Data prevista consegna</label>
              <DatePicker value={form.expected_at} onChange={v => setForm({ ...form, expected_at: v })} placeholder="Seleziona data consegna" />
            </div>
            <div>
              <label className="field-label">Note</label>
              <input className="field-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Note interne..." />
            </div>
          </div>
          <div style={{ padding: '0 16px 8px' }}>
            <div className="section-title" style={{ fontSize: 12, marginBottom: 8 }}>Righe ordine</div>
            {form.lines.map((line, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <input className="field-input" placeholder="Variante ID *" value={line.product_variant_id}
                  onChange={e => updateLine(idx, 'product_variant_id', e.target.value)} style={{ width: 130 }} />
                <input className="field-input" placeholder="Qtà *" type="number" value={line.qty}
                  onChange={e => updateLine(idx, 'qty', e.target.value)} style={{ width: 80 }} />
                <input className="field-input" placeholder="Costo € *" type="number" step="0.01" value={line.unit_cost}
                  onChange={e => updateLine(idx, 'unit_cost', e.target.value)} style={{ width: 100 }} />
                {form.lines.length > 1 && (
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px', color: '#ef4444' }} onClick={() => removeLine(idx)}>✕</button>
                )}
              </div>
            ))}
            <button className="btn btn-ghost" style={{ fontSize: 12, marginTop: 4 }} onClick={addLine}>+ Aggiungi riga</button>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '8px 16px 16px' }}>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Annulla</button>
            <button className="btn btn-gold" disabled={saving || !form.supplier_id} onClick={handleCreate}>
              {saving ? 'Salvataggio...' : 'Crea PO'}
            </button>
          </div>
        </div>
      )}

      {/* ── Main Table ── */}
      <div className="table-card">
        <div className="table-toolbar">
          {['all', 'draft', 'sent', 'received', 'cancelled'].map(s => (
            <button key={s} className={`filter-chip${statusFilter === s ? ' active' : ''}`} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'Tutti' : statusLabels[s]}
            </button>
          ))}
          <input className="search-input" placeholder="Cerca PO o fornitore..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)} style={{ maxWidth: 220, marginLeft: 'auto' }} />
        </div>
        <table>
          <thead>
            <tr>
              <th>PO #</th>
              <th>Fornitore</th>
              <th>Stato</th>
              <th>Lavorazione</th>
              <th>Totale</th>
              <th>Data prevista</th>
              <th>Creato</th>
              <th style={{ textAlign: 'right' }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(po => (
              <tr key={po.id}>
                <td>
                  <span className="mono" style={{ cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => handleShowDetail(po.id)}>
                    #{po.po_number || po.id}
                  </span>
                  {po.is_ai_generated && (
                    <span style={{ marginLeft: 8, padding: '2px 6px', background: 'var(--color-accent)', color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      AI 🤖
                    </span>
                  )}
                </td>
                <td style={{ fontWeight: 600, color: 'var(--text)' }}>{po.supplier_name || '—'}</td>
                <td><span className={`badge ${statusClass(po.status)}`}><span className="badge-dot" />{statusLabels[po.status] || po.status}</span></td>
                <td>
                  {(() => {
                    const f = poFulfillment[po.id];
                    const opt = FULFIL_OPTS.find(o => o.key === f);
                    return (
                      <button
                        onClick={() => cycleFulfil(po.id)}
                        title="Clicca per cambiare stato lavorazione"
                        style={{
                          padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                          background: opt?.bg || '#f3f4f6', color: opt?.color || '#6b7280',
                          fontSize: 11, fontWeight: 800, transition: 'all 0.15s',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {opt?.label || '— Non impostato'}
                      </button>
                    );
                  })()}
                </td>
                <td className="mono">{fmtCurrency(po.total_net)}</td>
                <td style={{ color: 'var(--muted2)' }}>{fmtDate(po.expected_at)}</td>
                <td style={{ color: 'var(--muted2)' }}>{fmtDate(po.created_at)}</td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                    {po.status === 'received' && (
                      <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}
                        onClick={() => handleShowDetail(po.id).then(() => {})}>
                        🖨 DDT
                      </button>
                    )}
                    {po.status === 'draft' && (
                      <button className="btn btn-gold" style={{ fontSize: 11, padding: '4px 10px' }}
                        disabled={actionLoading === `${po.id}-send`} onClick={() => handleSend(po.id)}>
                        {actionLoading === `${po.id}-send` ? '...' : 'Invia'}
                      </button>
                    )}
                    {(po.status === 'sent' || po.status === 'partial') && (
                      <button className="btn btn-gold" style={{ fontSize: 11, padding: '4px 10px', background: '#16a34a' }}
                        onClick={() => openReceive(po)}>
                        ?? Carica Merce
                      </button>
                    )}
                    {['draft', 'sent'].includes(po.status) && (
                      <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: '#ef4444' }}
                        disabled={actionLoading === `${po.id}-cancel`} onClick={() => handleCancel(po.id)}>
                        {actionLoading === `${po.id}-cancel` ? '...' : 'Annulla'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>Nessun ordine di acquisto trovato</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ══ MODALE ORDINE AUTOMATICO ══ */}
      {autoModal && (
        <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div style={{ background:'var(--color-surface)', borderRadius:20, width:'100%', maxWidth:760, maxHeight:'92vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 32px 80px rgba(0,0,0,0.3)', border:'1px solid var(--color-border)' }}>

            {/* Header */}
            <div style={{ padding:'22px 28px 18px', borderBottom:'1px solid var(--color-border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:44, height:44, borderRadius:14, background:'linear-gradient(135deg,#F59E0B,#D97706)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 14px rgba(245,158,11,0.35)', flexShrink:0 }}>
                  <span style={{ fontSize:22 }}>⚡</span>
                </div>
                <div>
                  <div style={{ fontSize:18, fontWeight:900, color:'var(--color-text)' }}>Ordine Automatico</div>
                  <div style={{ fontSize:12, color:'var(--color-text-tertiary)', marginTop:2 }}>Prodotti sotto il punto di riordino</div>
                </div>
              </div>
              <button onClick={() => setAutoModal(false)} style={{ background:'var(--color-bg)', border:'1px solid var(--color-border)', borderRadius:10, width:36, height:36, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--color-text-secondary)', fontSize:18 }}>×</button>
            </div>

            {/* Filtro fornitore */}
            <div style={{ padding:'16px 28px', borderBottom:'1px solid var(--color-border)', display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', background:'var(--color-bg)', flexShrink:0 }}>
              <select
                style={{ minWidth:240, padding:'9px 14px', borderRadius:10, border:'1.5px solid var(--color-border)', background:'var(--color-surface)', color:'var(--color-text)', fontSize:13, fontWeight:600, cursor:'pointer', outline:'none' }}
                value={autoSelSup} onChange={e => setAutoSelSup(e.target.value)}
              >
                <option value="">Tutti i fornitori</option>
                {suppliersList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button
                onClick={fetchAutoSuggest} disabled={autoLoad}
                style={{ padding:'9px 16px', borderRadius:10, border:'1.5px solid var(--color-border)', background:'var(--color-surface)', color:'var(--color-accent)', fontSize:13, fontWeight:700, cursor:autoLoad?'default':'pointer', display:'flex', alignItems:'center', gap:6, opacity:autoLoad?0.6:1 }}
              >
                {autoLoad ? '⟳ Caricamento...' : '🔄 Aggiorna'}
              </button>
              {!autoSelSup && autoItems.length > 0 && (
                <span style={{ fontSize:12, color:'var(--color-text-tertiary)', fontStyle:'italic' }}>Seleziona un fornitore per creare l'ordine</span>
              )}
            </div>

            {/* Corpo tabella */}
            <div style={{ flex:1, overflowY:'auto', padding:'8px 0' }}>
              {autoLoad ? (
                <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--color-text-tertiary)', fontSize:14 }}>Caricamento prodotti sotto-scorta...</div>
              ) : autoLines.length === 0 ? (
                <div style={{ textAlign:'center', padding:'60px 20px' }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>?</div>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--color-text)' }}>Stock OK!</div>
                  <div style={{ fontSize:13, color:'var(--color-text-tertiary)', marginTop:4 }}>Nessun prodotto sotto il punto di riordino.</div>
                </div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead style={{ position:'sticky', top:0, zIndex:1 }}>
                    <tr style={{ background:'var(--color-bg)', borderBottom:'2px solid var(--color-border)' }}>
                      <th style={{ padding:'10px 14px 10px 20px', textAlign:'left', fontSize:10, fontWeight:800, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'0.07em', width:36 }}>☐</th>
                      <th style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontWeight:800, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Prodotto</th>
                      <th style={{ padding:'10px 14px', textAlign:'center', fontSize:10, fontWeight:800, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Stock</th>
                      <th style={{ padding:'10px 14px', textAlign:'center', fontSize:10, fontWeight:800, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Riordino</th>
                      <th style={{ padding:'10px 14px', textAlign:'center', fontSize:10, fontWeight:800, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Qtà da ordinare</th>
                      <th style={{ padding:'10px 20px 10px 14px', textAlign:'right', fontSize:10, fontWeight:800, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Costo Unit.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {autoLines.map((l, i) => (
                      <tr key={l.variant_id} style={{ borderBottom:'1px solid var(--color-border)', transition:'background 0.12s' }}
                        onMouseEnter={e => e.currentTarget.style.background='var(--color-bg)'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}
                      >
                        <td style={{ padding:'10px 8px 10px 20px' }}>
                          <input type="checkbox" checked={l.qty > 0} onChange={e => {
                            const nl = [...autoLines]; nl[i].qty = e.target.checked ? nl[i].suggested_qty : 0; setAutoLines(nl);
                          }} style={{ width:16, height:16, cursor:'pointer', accentColor:'var(--color-accent)' }} />
                        </td>
                        <td style={{ padding:'10px 14px', fontWeight:700, color:'var(--color-text)' }}>
                          {l.product_name}{l.flavor ? <span style={{ color:'var(--color-text-tertiary)', fontWeight:500 }}> — {l.flavor}</span> : ''}
                        </td>
                        <td style={{ padding:'10px 14px', textAlign:'center' }}>
                          <span style={{ fontWeight:800, fontSize:13, color: l.qty_on_hand < 0 ? '#EF4444' : l.qty_on_hand === 0 ? '#F59E0B' : '#10B981', background: l.qty_on_hand < 0 ? 'rgba(239,68,68,0.1)' : l.qty_on_hand === 0 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', padding:'3px 10px', borderRadius:20 }}>
                            {l.qty_on_hand}
                          </span>
                        </td>
                        <td style={{ padding:'10px 14px', textAlign:'center', color:'var(--color-text-secondary)', fontWeight:600 }}>{l.reorder_point ?? '—'}</td>
                        <td style={{ padding:'10px 14px', textAlign:'center' }}>
                          <input type="number" min="0" value={l.qty}
                            onChange={e => { const nl=[...autoLines]; nl[i].qty=parseInt(e.target.value)||0; setAutoLines(nl); }}
                            style={{ width:70, textAlign:'center', background:'var(--color-bg)', border:'1.5px solid var(--color-border)', borderRadius:8, padding:'6px 8px', color:'var(--color-text)', fontWeight:800, fontSize:14, outline:'none' }} />
                        </td>
                        <td style={{ padding:'10px 20px 10px 14px', textAlign:'right', color:'var(--color-text-secondary)', fontWeight:600 }}>
                          {new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(l.unit_cost||0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding:'16px 28px', borderTop:'1px solid var(--color-border)', display:'flex', gap:10, justifyContent:'flex-end', alignItems:'center', background:'var(--color-bg)', flexShrink:0 }}>
              <span style={{ fontSize:13, color:'var(--color-text-secondary)', marginRight:'auto', fontWeight:600 }}>
                <strong style={{ color:'var(--color-text)' }}>{autoLines.filter(l=>l.qty>0).length}</strong> prodotti selezionati &nbsp;·&nbsp; Totale: <strong style={{ color:'var(--color-accent)' }}>{new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(autoLines.reduce((s,l)=>s+l.qty*(l.unit_cost||0),0))}</strong>
              </span>
              <button onClick={() => setAutoModal(false)} style={{ padding:'10px 20px', borderRadius:10, border:'1.5px solid var(--color-border)', background:'var(--color-surface)', color:'var(--color-text-secondary)', fontSize:13, fontWeight:700, cursor:'pointer' }}>Annulla</button>
              <button
                disabled={autoSaving || !autoSelSup || autoLines.filter(l=>l.qty>0).length===0}
                onClick={handleCreateAutoOrder}
                style={{ padding:'10px 22px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#F59E0B,#D97706)', color:'#fff', fontSize:13, fontWeight:800, cursor:(autoSaving||!autoSelSup||autoLines.filter(l=>l.qty>0).length===0)?'default':'pointer', opacity:(autoSaving||!autoSelSup||autoLines.filter(l=>l.qty>0).length===0)?0.6:1, boxShadow:'0 4px 14px rgba(245,158,11,0.35)', display:'flex', alignItems:'center', gap:8 }}
              >
                <span>⚡</span> {autoSaving ? 'Creazione...' : 'Crea Ordine Fornitore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
