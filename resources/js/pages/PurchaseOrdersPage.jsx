import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { purchaseOrders, suppliers as suppliersApi, storesApi } from '../api.jsx';
import { SkeletonTable } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';

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

  // Open receive modal: load PO detail first
  const openReceive = async (po) => {
    try {
      setReceiveError('');
      const res = await purchaseOrders.getOne(po.id);
      const detail = res.data?.data || null;
      if (!detail) { setError('Impossibile caricare dettaglio PO.'); return; }
      setReceiveModal({ ...po, lines: detail.lines || [] });
      setReceiveLines((detail.lines || []).map(l => ({ ...l, qty_received: l.qty ?? 1 })));
      setReceiveWarehouseId(warehousesList[0]?.id || '');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const handleReceive = async () => {
    if (!receiveWarehouseId) { setReceiveError('Seleziona il magazzino di destinazione.'); return; }
    if (receiveLines.some(l => !l.qty_received || l.qty_received < 1)) {
      setReceiveError('Inserisci quantità valide per tutte le righe.');
      return;
    }
    try {
      setReceiveSaving(true); setReceiveError('');
      await purchaseOrders.receive(receiveModal.id, {
        warehouse_id: receiveWarehouseId,
        lines: receiveLines.map(l => ({
          purchase_order_line_id: l.id,
          qty_received: parseInt(l.qty_received),
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
<div class="badge">✅ MERCI RICEVUTE A MAGAZZINO</div>
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

  if (loading) return <SkeletonTable />;

  return (
    <>
      {/* Header */}
      <div className="page-head">
        <div>
          <div className="page-head-title">Ordini di Acquisto</div>
          <div className="page-head-sub">{list.length} ordini{selectedStore ? ` — ${selectedStore.name}` : ''}</div>
        </div>
        <button className="btn btn-gold" onClick={() => setShowForm(true)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuovo PO
        </button>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchAll} />}

      {/* ── Post-receive DDT prompt ── */}
      {lastReceived && (
        <div className="table-card" style={{ marginBottom: 16, background: '#f0fdf4', border: '1px solid #86efac', padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 22 }}>✅</span>
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
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>📦 Ricezione Merce — PO # {receiveModal.po_number || receiveModal.id}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 }}>Fornitore: {receiveModal.supplier_name}</div>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {receiveError && <div style={{ background: '#ef4444', color: '#fff', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>{receiveError}</div>}

              {/* Warehouse selector */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Magazzino Destinazione *
                </label>
                <select className="field-input" value={receiveWarehouseId} onChange={e => setReceiveWarehouseId(e.target.value)}>
                  <option value="">— seleziona magazzino —</option>
                  {warehousesList.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                  {warehousesList.length === 0 && <option value="1">Magazzino Centrale (ID 1)</option>}
                </select>
              </div>

              {/* Lines */}
              <div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Prodotti da ricevere
                </div>
                {receiveLines.map((line, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', gap: 10, marginBottom: 8, alignItems: 'center' }}>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>
                      {line.product_name || `Variante #${line.product_variant_id}`}
                      {line.flavor && <span style={{ color: 'rgba(255,255,255,0.45)', marginLeft: 6 }}>— {line.flavor}</span>}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center' }}>
                      Ordinato: <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{line.qty}</strong>
                    </div>
                    <div>
                      <input type="number" min="0" max={line.qty} value={line.qty_received}
                        onChange={e => { const ls = [...receiveLines]; ls[idx] = { ...ls[idx], qty_received: parseInt(e.target.value) || 0 }; setReceiveLines(ls); }}
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '8px 12px', color: '#fff', width: '100%', fontSize: 14, fontWeight: 700 }}
                        placeholder="Qtà ricevuta"
                      />
                    </div>
                  </div>
                ))}
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
              <input className="field-input" type="date" value={form.expected_at} onChange={e => setForm({ ...form, expected_at: e.target.value })} />
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
                </td>
                <td style={{ fontWeight: 600, color: 'var(--text)' }}>{po.supplier_name || '—'}</td>
                <td><span className={`badge ${statusClass(po.status)}`}><span className="badge-dot" />{statusLabels[po.status] || po.status}</span></td>
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
                        📦 Carica Merce
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
    </>
  );
}
