import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { deliveryNotes } from '../api.jsx';
import { toast } from 'react-hot-toast';

/**
 * StoreLoadingPage — Kiosk dipendente per la ricezione delle bolle di carico
 *
 * Flusso:
 * 1. Seleziona bolla pendente dal negozio
 * 2. Scansiona i prodotti uno per uno (barcode)
 * 3. Inserisci quantità ricevuta
 * 4. Conferma → sistema salva e confronta con qtà attesa
 * 5. Discrepanze vengono segnalate all'admin (pallino rosso)
 */
export default function StoreLoadingPage() {
  const { selectedStoreId, user } = useOutletContext();
  const [phase, setPhase] = useState('select'); // 'select' | 'scan' | 'summary'
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState(null);
  const [items, setItems] = useState([]);       // items con received_qty modificabile
  const [barcodeInput, setBarcodeInput] = useState('');
  const [activeItemIdx, setActiveItemIdx] = useState(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);   // risultato dopo receive
  const barcodeRef = useRef(null);

  useEffect(() => {
    fetchNotes();
  }, [selectedStoreId]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const params = { status: 'pending', store_id: selectedStoreId };
      const res = await deliveryNotes.getAll(params);
      // Il dipendente vede anche quelle in_progress
      const res2 = await deliveryNotes.getAll({ status: 'in_progress', store_id: selectedStoreId });
      const all = [...(res.data?.data || []), ...(res2.data?.data || [])];
      setNotes(all);
    } catch (err) {
      toast.error('Errore caricamento bolle: ' + (err.message || ''));
    } finally { setLoading(false); }
  };

  const openNote = async (note) => {
    try {
      const res = await deliveryNotes.getOne(note.id);
      const full = res.data?.data;
      setSelectedNote(full);
      setItems((full.items || []).map(i => ({ ...i, received_qty: i.received_qty ?? 0 })));
      setPhase('scan');
      setTimeout(() => barcodeRef.current?.focus(), 300);
    } catch (err) {
      toast.error('Errore apertura bolla');
    }
  };

  // Cerca item tramite barcode/SKU/nome
  const resolveBarcode = (val) => {
    const t = val.trim().toLowerCase();
    return items.findIndex(i =>
      (i.barcode && i.barcode.toLowerCase() === t) ||
      (i.sku && i.sku.toLowerCase() === t) ||
      (i.product_variant_id && String(i.product_variant_id) === t) ||
      i.product_name.toLowerCase().includes(t)
    );
  };

  const handleBarcodeScan = (e) => {
    if (e.key !== 'Enter') return;
    const val = barcodeInput.trim();
    if (!val) return;
    const idx = resolveBarcode(val);
    if (idx >= 0) {
      setActiveItemIdx(idx);
      // Auto-incrementa di 1
      const next = [...items];
      next[idx] = { ...next[idx], received_qty: (next[idx].received_qty || 0) + 1 };
      setItems(next);
      setBarcodeInput('');
      toast.success(`+1 → ${items[idx].product_name}`, { duration: 1200 });
    } else {
      toast.error(`"${val}" non trovato nella bolla`, { duration: 2500 });
      setBarcodeInput('');
    }
    barcodeRef.current?.focus();
  };

  const handleConfirm = async () => {
    if (!selectedNote) return;
    setSaving(true);
    try {
      const res = await deliveryNotes.receive(selectedNote.id, {
        items: items.map(i => ({ id: i.id, received_qty: i.received_qty || 0 }))
      });
      const data = res.data?.data;
      setResult(data);
      setPhase('summary');
      if (data.discrepancies > 0) {
        toast.error(`⚠️ ${data.discrepancies} discrepanze rilevate! L'admin è stato notificato.`);
      } else {
        toast.success('✅ Carico registrato correttamente!');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Errore registrazione');
    } finally { setSaving(false); }
  };

  const fmtDate = (v) => v ? new Date(v).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  // ── PHASE: SELECT ──────────────────────────────────────
  if (phase === 'select') {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div className="page-head">
          <div>
            <div className="page-head-title">📦 Carico Negozio</div>
            <div className="page-head-sub">Seleziona la bolla da ricevere e scansiona i prodotti</div>
          </div>
          <button className="btn btn-ghost" onClick={fetchNotes} style={{ fontSize: 13 }}>↺ Aggiorna</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Caricamento bolle...</div>
        ) : notes.length === 0 ? (
          <div className="table-card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📭</div>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8, color: 'var(--color-text)' }}>Nessuna bolla in attesa</div>
            <div style={{ color: 'var(--muted)', fontSize: 14 }}>
              L'area manager non ha ancora creato bolle di carico per questo negozio.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {notes.map(note => (
              <div key={note.id} className="table-card"
                onClick={() => openNote(note)}
                style={{ padding: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, transition: 'box-shadow 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(123,111,208,0.2)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
              >
                <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                  📦
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--color-text)', marginBottom: 3 }}>
                    {note.note_number}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {note.items_count} articoli · Creata da {note.created_by_name || '—'} · {fmtDate(note.created_at)}
                  </div>
                  {note.notes && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, fontStyle: 'italic' }}>{note.notes}</div>}
                </div>
                <div style={{ flexShrink: 0 }}>
                  <span style={{
                    display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: note.status === 'in_progress' ? '#fef3c7' : '#dcfce7',
                    color: note.status === 'in_progress' ? '#92400e' : '#065f46',
                  }}>
                    {note.status === 'in_progress' ? '🔄 In corso' : '⏳ In attesa'}
                  </span>
                </div>
                <div style={{ fontSize: 20, color: 'var(--muted)' }}>›</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── PHASE: SCAN ──────────────────────────────────────
  if (phase === 'scan' && selectedNote) {
    const totalExpected = items.reduce((s, i) => s + i.expected_qty, 0);
    const totalReceived = items.reduce((s, i) => s + (i.received_qty || 0), 0);
    const progress = totalExpected > 0 ? Math.min(100, Math.round((totalReceived / totalExpected) * 100)) : 0;

    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div className="page-head">
          <div>
            <div className="page-head-title">📷 Scansione — {selectedNote.note_number}</div>
            <div className="page-head-sub">{items.length} articoli da ricevere</div>
          </div>
          <button className="btn btn-ghost" onClick={() => { setPhase('select'); setSelectedNote(null); }} style={{ fontSize: 13 }}>
            ← Torna alla lista
          </button>
        </div>

        {/* Barra progresso */}
        <div className="table-card" style={{ padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            <span>Progresso ricezione</span>
            <span style={{ color: progress >= 100 ? '#22c55e' : '#c9a227' }}>{totalReceived} / {totalExpected} pz · {progress}%</span>
          </div>
          <div style={{ height: 8, background: 'var(--color-border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: progress >= 100 ? '#22c55e' : '#c9a227', borderRadius: 4, transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* Scan barcode */}
        <div className="table-card" style={{ padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>📷</span>
          <div style={{ flex: 1 }}>
            <label className="field-label" style={{ marginBottom: 4 }}>Scansiona barcode prodotto</label>
            <input
              ref={barcodeRef}
              className="field-input"
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={handleBarcodeScan}
              placeholder="Scansiona o digita barcode/SKU/nome + Invio"
              autoFocus
              style={{ fontFamily: 'monospace', letterSpacing: 1 }}
            />
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
            Ogni scan<br/>aggiunge +1
          </div>
        </div>

        {/* Lista articoli */}
        <div className="table-card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)' }}>Prodotto</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)' }}>Atteso</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)' }}>Ricevuto</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)' }}>Stato</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const diff = (item.received_qty || 0) - item.expected_qty;
                const isActive = activeItemIdx === idx;
                const ok = diff === 0 && item.received_qty !== null;
                const over = diff > 0;
                const under = diff < 0;
                return (
                  <tr key={item.id}
                    style={{
                      background: isActive ? 'rgba(123,111,208,0.08)' : 'transparent',
                      borderBottom: '1px solid var(--color-border)',
                      transition: 'background 0.2s',
                    }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>{item.product_name}</div>
                      {item.barcode && <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{item.barcode}</div>}
                      {item.sku && <div style={{ fontSize: 11, color: 'var(--muted)' }}>SKU: {item.sku}</div>}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 800, fontSize: 15 }}>
                      {item.expected_qty}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        value={item.received_qty ?? 0}
                        onChange={e => {
                          const next = [...items];
                          next[idx] = { ...next[idx], received_qty: parseInt(e.target.value) || 0 };
                          setItems(next);
                          setActiveItemIdx(idx);
                        }}
                        style={{
                          width: 70, textAlign: 'center', fontWeight: 800, fontSize: 16,
                          border: `2px solid ${ok ? '#22c55e' : over ? '#f59e0b' : under && item.received_qty !== null ? '#ef4444' : 'var(--color-border)'}`,
                          borderRadius: 8, padding: '4px 8px', color: 'var(--color-text)',
                          background: 'var(--color-bg)', outline: 'none',
                        }}
                      />
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      {item.received_qty === null || item.received_qty === undefined
                        ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>
                        : ok
                        ? <span style={{ color: '#22c55e', fontWeight: 800, fontSize: 16 }}>✓</span>
                        : over
                        ? <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 12 }}>+{diff} in più</span>
                        : <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 12 }}>{diff} mancanti</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-gold"
            onClick={handleConfirm}
            disabled={saving}
            style={{ fontSize: 15, padding: '12px 32px' }}
          >
            {saving ? '⏳ Registrazione...' : '✓ Conferma Ricezione'}
          </button>
        </div>
      </div>
    );
  }

  // ── PHASE: SUMMARY ──────────────────────────────────────
  if (phase === 'summary' && result) {
    const hasDiscrepancy = result.discrepancies > 0;
    return (
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div className="table-card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 72, marginBottom: 20 }}>
            {hasDiscrepancy ? '⚠️' : '✅'}
          </div>
          <div style={{ fontWeight: 900, fontSize: 24, marginBottom: 12, color: hasDiscrepancy ? '#b45309' : '#065f46' }}>
            {hasDiscrepancy ? 'Carico con discrepanze' : 'Carico completato!'}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 28 }}>
            {hasDiscrepancy
              ? `${result.discrepancies} prodotto/i con quantità diversa da quella attesa. L'area manager è stato notificato.`
              : 'Tutte le quantità corrispondono. Stock aggiornato correttamente.'
            }
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-gold" onClick={() => { setPhase('select'); setResult(null); fetchNotes(); }}>
              ← Torna alle bolle
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
