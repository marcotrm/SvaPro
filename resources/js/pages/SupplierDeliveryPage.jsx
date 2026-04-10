import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { suppliers as suppliersApi, inventory, stores } from '../api.jsx';

/**
 * SupplierDeliveryPage — DDT Fornitore → Magazzino
 *
 * Flusso:
 * 1. Seleziona fornitore (o crea nuovo)
 * 2. Aggiungi prodotti con quantità e costo
 * 3. Seleziona magazzino di destinazione
 * 4. Conferma → aggiorna stock automaticamente
 * 5. Stampa Bolla di Carico DDT
 */
export default function SupplierDeliveryPage() {
  const { selectedStoreId, user } = useOutletContext();

  // Lists
  const [suppliersList, setSuppliersList] = useState([]);
  const [storesList, setStoresList] = useState([]);
  const [stockItems, setStockItems] = useState([]);  // for product lookup

  // Form state
  const [step, setStep] = useState(1); // 1=info, 2=products, 3=confirm
  const [ddtType, setDdtType] = useState('carico'); // 'carico' | 'scarico_vendita' | 'conto_visione'
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [ddtNumber, setDdtNumber] = useState(`DDT-${Date.now().toString().slice(-6)}`);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ product_variant_id: '', product_name: '', qty: 1, unit_cost: 0 }]);

  const DDT_TYPES = [
    { id: 'carico',          label: '📦 Carico Merce',      sub: 'Fornitore → Magazzino (+stock)',           qtySign: +1, color: '#065f46', bg: '#d1fae5' },
    { id: 'scarico_vendita', label: '🛒 Scarico Vendita',   sub: 'Genera fattura immediata (-stock)',          qtySign: -1, color: '#1d4ed8', bg: '#dbeafe' },
    { id: 'conto_visione',   label: '👁 Conto Visione',     sub: 'Trasferimento bene (fattura posticipata)',   qtySign:  0, color: '#92400e', bg: '#fef3c7' },
  ];
  const activeDdtType = DDT_TYPES.find(t => t.id === ddtType) || DDT_TYPES[0];

  // Status
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null); // saved DDT for printing

  // History of DDTs (local)
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ddt_history') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    Promise.all([
      suppliersApi.getAll(),
      stores.getStores(),
    ]).then(([supRes, storeRes]) => {
      setSuppliersList(supRes.data?.data || []);
      setStoresList(storeRes.data?.data || []);
      if (!warehouseId && (storeRes.data?.data || []).length > 0) {
        setWarehouseId(storeRes.data.data[0].id);
      }
    }).catch(err => setError('Errore caricamento dati: ' + err.message));

    // Stock separato — se fallisce il DDT è comunque usabile
    inventory.getStock({ limit: 500 })
      .then(stockRes => setStockItems(stockRes.data?.data || []))
      .catch(() => {});
  }, []);

  const addLine = () => setLines([...lines, { product_variant_id: '', product_name: '', qty: 1, unit_cost: 0 }]);

  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));

  // Helper: cerca uno stock item per barcode (su prodotto), SKU prodotto, o ID variante numerico
  const findStockItem = (val) => {
    const v = String(val).trim().toLowerCase();
    if (!v) return null;
    return stockItems.find(s =>
      String(s.product_variant_id) === v ||
      (s.barcode      && s.barcode.trim().toLowerCase()      === v) ||
      (s.product_sku  && s.product_sku.trim().toLowerCase()  === v)
    ) || null;
  };

  const updateLine = (i, field, val) => {
    const next = [...lines];
    next[i] = { ...next[i], [field]: val };
    if (field === 'product_variant_id') {
      const found = findStockItem(val);
      if (found) {
        next[i].product_name       = found.product_name || '';
        next[i].unit_cost          = found.cost_price   || found.sale_price || 0;
        next[i].product_variant_id = found.product_variant_id;
      }
    }
    setLines(next);
  };

  // Scan rapido barcode: aggiunge una nuova riga dalla scansione
  const [barcodeScan, setBarcodeScan] = useState('');
  const handleBarcodeScan = (e) => {
    if (e.key !== 'Enter') return;
    const val = barcodeScan.trim();
    if (!val) return;
    const found = findStockItem(val);
    if (found) {
      const variantId = found.product_variant_id;
      const emptyIdx  = lines.findIndex(l => !l.product_variant_id && !l.product_name);
      const newLine   = { product_variant_id: variantId, product_name: found.product_name || '', unit_cost: found.cost_price || found.sale_price || 0, qty: 1 };
      if (emptyIdx >= 0) {
        const next = [...lines]; next[emptyIdx] = newLine; setLines(next);
      } else {
        setLines([...lines, newLine]);
      }
    } else {
      setError(`Barcode/SKU "${val}" non trovato. Verifica che il prodotto abbia un barcode nel catalogo.`);
      setTimeout(() => setError(''), 4000);
    }
    setBarcodeScan('');
  };

  const totalValue = lines.reduce((s, l) => s + (parseFloat(l.qty) || 0) * (parseFloat(l.unit_cost) || 0), 0);
  const fmt = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);

  const handleConfirm = async () => {
    if (!supplierId) { setError('Seleziona un fornitore.'); return; }
    if (!warehouseId) { setError('Seleziona il negozio/magazzino.'); return; }
    const validLines = lines.filter(l => (l.product_variant_id || l.product_name) && l.qty > 0);
    if (validLines.length === 0) { setError('Aggiungi almeno un prodotto con quantità.'); return; }

    try {
      setSaving(true); setError('');

      // Update stock for each line
      const errors = [];
      for (const line of validLines) {
        if (!line.product_variant_id) {
          errors.push(`Prodotto "${line.product_name}": nessun ID variante — aggiungilo dal catalogo`);
          continue;
        }
        // Conto visione: non modifica stock
        if (ddtType === 'conto_visione') continue;
        try {
          await inventory.adjustStock({
            product_variant_id: parseInt(line.product_variant_id),
            store_id:           parseInt(warehouseId),
            qty:                activeDdtType.qtySign * parseInt(line.qty),
            movement_type:      ddtType === 'scarico_vendita' ? 'out' : 'in',
            unit_cost:          parseFloat(line.unit_cost) || 0,
            reference_type:     'ddt',
          });
        } catch (e) {
          errors.push(`Prodotto "${line.product_name}": ${e.response?.data?.message || e.message}`);
        }
      }

      const supplier = suppliersList.find(s => String(s.id) === String(supplierId));
      const warehouse = storesList.find(s => String(s.id) === String(warehouseId));

      const saved = {
        id: Date.now(),
        ddtType,
        ddtTypeName: activeDdtType.label,
        ddtNumber,
        supplierId,
        supplierName: supplier?.name || 'Fornitore',
        warehouseId,
        warehouseName: warehouse?.name || 'Magazzino',
        deliveryDate,
        notes,
        lines: validLines,
        totalValue,
        createdAt: new Date().toISOString(),
        errors,
        // Scarico vendita → flagged for invoice generation
        needsInvoice: ddtType === 'scarico_vendita',
        isContoVisione: ddtType === 'conto_visione',
      };

      // Save to history
      const newHistory = [saved, ...history].slice(0, 50);
      setHistory(newHistory);
      localStorage.setItem('ddt_history', JSON.stringify(newHistory));

      setSuccess(saved);
      setStep(3);

      if (errors.length > 0) {
        setError(`⚠️ ${errors.length} prodotti non avevano un ID variante valido e non hanno aggiornato lo stock:\n${errors.join('\n')}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setSaving(false); }
  };

  const printDDT = (ddt) => {
    const w = window.open('', '_blank');
    const today = new Date(ddt.createdAt || ddt.deliveryDate).toLocaleDateString('it-IT');
    w.document.write(`<!DOCTYPE html><html><head>
<title>DDT Fornitore — ${ddt.ddtNumber}</title>
<style>
  body{font-family:Arial,sans-serif;margin:32px;color:#111;font-size:13px}
  h1{font-size:22px;margin:0 0 4px;font-weight:900}
  .sub{color:#666;font-size:12px;margin-bottom:20px}
  .badge{display:inline-block;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;background:#d1fae5;color:#065f46;margin-bottom:16px}
  .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;background:#f5f5f7;padding:14px;border-radius:8px;margin-bottom:20px}
  .info h3{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#888;margin:0 0 2px}
  .info p{font-size:14px;font-weight:700;margin:0}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;padding:8px 10px;font-size:10px;text-transform:uppercase;background:#1a1a2e;color:#fff}
  td{padding:8px 10px;border-bottom:1px solid #eee}
  .total{background:#f0f0f0;padding:12px;border-radius:6px;font-weight:700;margin-top:12px;text-align:right;font-size:16px}
  .footer{margin-top:40px;display:flex;justify-content:space-between}
  .sign{border-top:1px solid #ccc;width:200px;text-align:center;padding-top:6px;font-size:11px;color:#666}
</style></head><body>
<h1>BOLLA DI CARICO — DDT FORNITORE</h1>
<div class="sub">Documento: <strong>${ddt.ddtNumber}</strong> &nbsp;|&nbsp; Emesso il: ${today}</div>
<div class="badge">✅ MERCE RICEVUTA — STOCK AGGIORNATO</div>
<div class="grid">
  <div class="info"><h3>Fornitore (Cedente)</h3><p>${ddt.supplierName}</p></div>
  <div class="info"><h3>Destinazione</h3><p>${ddt.warehouseName}</p></div>
  <div class="info"><h3>Data Consegna</h3><p>${new Date(ddt.deliveryDate).toLocaleDateString('it-IT')}</p></div>
</div>
<table>
  <thead><tr><th>#</th><th>Prodotto</th><th>ID Variante</th><th>Qtà Ricevuta</th><th>Costo Unit.</th><th>Valore</th></tr></thead>
  <tbody>
    ${ddt.lines.map((l, i) => `
    <tr>
      <td style="color:#aaa">${i + 1}</td>
      <td><strong>${l.product_name || `Variante #${l.product_variant_id}`}</strong></td>
      <td style="font-family:monospace;color:#666">${l.product_variant_id || '—'}</td>
      <td style="font-weight:700;color:#065f46">+${l.qty}</td>
      <td>${new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(l.unit_cost||0)}</td>
      <td style="font-weight:700">${new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(l.qty*(l.unit_cost||0))}</td>
    </tr>`).join('')}
  </tbody>
</table>
<div class="total">Valore Totale Merce: ${new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(ddt.totalValue)}</div>
${ddt.notes ? `<p style="margin-top:14px;font-size:12px;color:#666"><strong>Note:</strong> ${ddt.notes}</p>` : ''}
<div class="footer">
  <div class="sign">Firma Autista/Corriere</div>
  <div style="font-size:10px;color:#aaa">Stampato: ${new Date().toLocaleString('it-IT')}</div>
  <div class="sign">Firma Magazziniere</div>
</div>
</body></html>`);
    w.document.close(); w.print();
  };

  const supplier = suppliersList.find(s => String(s.id) === String(supplierId));
  const warehouse = storesList.find(s => String(s.id) === String(warehouseId));

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 48 }}>

      {/* Header */}
      <div className="page-head">
        <div>
          <div className="page-head-title">🚛 DDT Fornitore / Movimentazione</div>
          <div className="page-head-sub">Carico, Scarico Vendita e Conto Visione</div>
        </div>
      </div>

      {/* ── Tipo DDT selector ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
        {DDT_TYPES.map(t => (
          <button key={t.id} onClick={() => { setDdtType(t.id); setStep(1); setSuccess(null); }}
            style={{
              padding: '14px 16px', borderRadius: 14, border: `2px solid ${ddtType === t.id ? t.color : 'var(--color-border)'}`,
              background: ddtType === t.id ? t.bg : 'var(--color-surface)', cursor: 'pointer',
              textAlign: 'left', transition: 'all 0.15s',
            }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: ddtType === t.id ? t.color : 'var(--color-text)', marginBottom: 3 }}>{t.label}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.sub}</div>
          </button>
        ))}
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        {[
          ['1', 'Fornitore & Magazzino'],
          ['2', 'Prodotti Ricevuti'],
          ['3', 'Conferma & Stampa'],
        ].map(([num, label], i) => (
          <div key={num} style={{
            flex: 1, padding: '12px 16px', textAlign: 'center', cursor: step > i + 1 ? 'pointer' : 'default',
            background: step === i + 1 ? '#1a1a2e' : step > i + 1 ? '#d1fae5' : 'var(--color-surface)',
            color: step === i + 1 ? '#c9a227' : step > i + 1 ? '#065f46' : 'var(--muted)',
            fontWeight: 800, fontSize: 13, borderRight: i < 2 ? '1px solid var(--color-border)' : 'none',
          }} onClick={() => step > i + 1 && success === null && setStep(i + 1)}>
            <span style={{ fontSize: 18, marginRight: 8 }}>{step > i + 1 ? '✓' : num}</span>{label}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', marginBottom: 16, color: '#991b1b', fontSize: 13, whiteSpace: 'pre-line' }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── STEP 1: Fornitore & Magazzino ── */}
      {step === 1 && (
        <div className="table-card" style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <label className="field-label">Fornitore *</label>
              <select className="field-input" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                <option value="">— seleziona fornitore —</option>
                {suppliersList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Negozio/Magazzino Destinazione *</label>
              <select className="field-input" value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
                <option value="">— seleziona magazzino —</option>
                {storesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Numero DDT</label>
              <input className="field-input" value={ddtNumber} onChange={e => setDdtNumber(e.target.value)} placeholder="es. DDT-2026-001" />
            </div>
            <div>
              <label className="field-label">Data Consegna</label>
              <input className="field-input" type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="field-label">Note DDT</label>
              <input className="field-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Numero riferimento ordine, vettore, note..." />
            </div>
          </div>
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-gold" disabled={!supplierId || !warehouseId} onClick={() => setStep(2)}>
              Avanti → Prodotti
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Prodotti ── */}
      {step === 2 && (
        <div className="table-card" style={{ padding: 24 }}>
          <div style={{ marginBottom: 16, color: 'var(--muted)', fontSize: 13 }}>
            <strong>Fornitore:</strong> {supplier?.name} &nbsp;·&nbsp; <strong>Destinazione:</strong> {warehouse?.name} &nbsp;·&nbsp; <strong>DDT:</strong> {ddtNumber}
          </div>

          {/* Scan rapido barcode */}
          <div style={{ marginBottom: 18, padding: '12px 16px', background: 'rgba(6,95,70,0.06)', borderRadius: 12, border: '1px solid rgba(6,95,70,0.15)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>📷</span>
            <div style={{ flex: 1 }}>
              <label className="field-label" style={{ marginBottom: 4 }}>Scan Barcode Rapido</label>
              <input
                className="field-input"
                value={barcodeScan}
                onChange={e => setBarcodeScan(e.target.value)}
                onKeyDown={handleBarcodeScan}
                placeholder="Scansiona o digita barcode/SKU + Invio per aggiungere riga"
                style={{ fontFamily: 'monospace', letterSpacing: 1 }}
                autoFocus
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right', lineHeight: 1.4 }}>
              {stockItems.length} prodotti<br/>in catalogo
            </div>
          </div>


          {lines.map((line, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, marginBottom: 10, alignItems: 'center' }}>
              <div>
                {i === 0 && <label className="field-label">Prodotto (ID Variante / Barcode / SKU)</label>}
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="field-input" value={line.product_variant_id}
                    onChange={e => updateLine(i, 'product_variant_id', e.target.value)}
                    placeholder="ID / barcode / SKU" style={{ width: 130, flexShrink: 0, fontFamily: 'monospace' }} />
                  <input className="field-input" value={line.product_name}
                    onChange={e => updateLine(i, 'product_name', e.target.value)}
                    placeholder="Nome prodotto (auto da barcode)" style={{ flex: 1 }} />
                </div>
              </div>
              <div>
                {i === 0 && <label className="field-label">Qtà Ricevuta *</label>}
                <input className="field-input" type="number" min="1" value={line.qty}
                  onChange={e => updateLine(i, 'qty', parseInt(e.target.value) || 0)}
                  style={{ fontWeight: 800, color: '#065f46' }} />
              </div>
              <div>
                {i === 0 && <label className="field-label">Costo Unitario €</label>}
                <input className="field-input" type="number" step="0.01" value={line.unit_cost}
                  onChange={e => updateLine(i, 'unit_cost', parseFloat(e.target.value) || 0)} />
              </div>
              <div style={{ paddingTop: i === 0 ? 22 : 0 }}>
                {lines.length > 1 && (
                  <button onClick={() => removeLine(i)} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '7px 10px', color: '#ef4444', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                )}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <button className="btn btn-ghost" onClick={addLine} style={{ fontSize: 13 }}>+ Aggiungi riga</button>
            <div style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>
              Totale: <span style={{ color: '#c9a227' }}>{fmt(totalValue)}</span> &nbsp;
              <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 13 }}>({lines.filter(l => l.qty > 0).length} prodotti)</span>
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>← Indietro</button>
            <button className="btn btn-gold" disabled={saving || lines.filter(l => l.qty > 0).length === 0}
              onClick={handleConfirm}>
              {saving ? 'Aggiornamento stock...' : '✓ Registra DDT & Aggiorna Stock'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Conferma & DDT ── */}
      {step === 3 && success && (
        <div className="table-card" style={{ padding: 24 }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>✅</div>
            <div style={{ fontWeight: 900, fontSize: 22, color: '#065f46', marginBottom: 4 }}>
              DDT registrato con successo!
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 14 }}>
              {ddtType === 'conto_visione'
                ? <>Bene in <strong>conto visione</strong> — fattura posticipata. {success.warehouseName} è la destinazione.</>
                : ddtType === 'scarico_vendita'
                ? <>Scarico effettuato, stock <strong>decrementato</strong> per {success.lines.filter(l => l.product_variant_id).length} prodotti in {success.warehouseName}.</>
                : <>Stock <strong>aggiornato</strong> per {success.lines.filter(l => l.product_variant_id).length} prodotti nel magazzino <strong>{success.warehouseName}</strong>.</>
              }
            </div>
          </div>

          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Numero DDT', value: success.ddtNumber },
              { label: 'Fornitore', value: success.supplierName },
              { label: 'Valore Totale', value: fmt(success.totalValue) },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--color-surface)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{k.label}</div>
                <div style={{ fontWeight: 800, color: 'var(--text)', fontSize: 15 }}>{k.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-gold" style={{ fontSize: 15, padding: '10px 28px' }} onClick={() => printDDT(success)}>
              🖨 Stampa {activeDdtType.label}
            </button>
            {success.needsInvoice && (
              <button className="btn" style={{ fontSize: 14, padding: '10px 20px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}
                onClick={() => {
                  // Apri pagina fatture fornitore con pre-fill (via URL params)
                  window.location.href = `/supplier-invoices?prefill_amount=${success.totalValue}&prefill_supplier=${success.supplierId}&prefill_ddt=${success.ddtNumber}`;
                }}>
                📄 Genera Fattura
              </button>
            )}
            {success.isContoVisione && (
              <button className="btn" style={{ fontSize: 14, padding: '10px 20px', background: '#92400e', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}
                onClick={() => {
                  window.location.href = `/supplier-invoices?prefill_amount=${success.totalValue}&prefill_supplier=${success.supplierId}&prefill_ddt=${success.ddtNumber}&type=proforma`;
                }}>
                📋 Genera Fattura Proforma
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => {
              setStep(1); setSuccess(null); setError('');
              setDdtNumber(`DDT-${Date.now().toString().slice(-6)}`);
              setLines([{ product_variant_id: '', product_name: '', qty: 1, unit_cost: 0 }]);
              setSupplierId(''); setNotes('');
            }}>
              + Nuovo DDT
            </button>
          </div>
        </div>
      )}

      {/* ── Storico DDT ── */}
      {history.length > 0 && step !== 3 && (
        <div className="table-card" style={{ marginTop: 24 }}>
          <div className="table-toolbar"><div className="section-title">Storico DDT Fornitore ({history.length})</div></div>
          <table>
            <thead>
              <tr><th>Numero DDT</th><th>Fornitore</th><th>Magazzino</th><th>Data</th><th>Prodotti</th><th>Totale</th><th style={{ textAlign: 'right' }}>Azioni</th></tr>
            </thead>
            <tbody>
              {history.map(ddt => (
                <tr key={ddt.id}>
                  <td className="mono">{ddt.ddtNumber}</td>
                  <td style={{ fontWeight: 600 }}>{ddt.supplierName}</td>
                  <td style={{ color: 'var(--muted)' }}>{ddt.warehouseName}</td>
                  <td style={{ color: 'var(--muted)' }}>{new Date(ddt.deliveryDate).toLocaleDateString('it-IT')}</td>
                  <td style={{ color: 'var(--muted)' }}>{ddt.lines?.length || 0} art.</td>
                  <td className="mono" style={{ fontWeight: 700 }}>{fmt(ddt.totalValue)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => printDDT(ddt)}>🖨 DDT</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
