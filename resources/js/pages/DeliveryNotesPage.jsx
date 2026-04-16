import React, { useState, useEffect, useRef, useCallback } from 'react';
import DatePicker from '../components/DatePicker.jsx';
import { deliveryNotes, stores as storesApi, catalog } from '../api.jsx';
import { toast } from 'react-hot-toast';
import { Package, X, CheckCircle, AlertTriangle, Truck, RefreshCw, Edit3, Search } from 'lucide-react';

/* ─── Costanti ─────────────────────────────────────────── */
const STATUS = {
  pending:     { label: '📦 In Consegna',       color: '#7c3aed', bg: '#ede9fe' },
  shipped:     { label: '🚛 In Transit',         color: '#3b82f6', bg: '#dbeafe' },
  in_transit:  { label: '🚛 In Transito',        color: '#3b82f6', bg: '#dbeafe' },
  in_progress: { label: '🔄 In Controllo',       color: '#d97706', bg: '#fef3c7' },
  received:    { label: '✅ Ricevuta',            color: '#059669', bg: '#d1fae5' },
  completed:   { label: '✅ Completata',          color: '#059669', bg: '#d1fae5' },
  verified:    { label: '✅ Verificata',          color: '#059669', bg: '#d1fae5' },
  discrepancy: { label: '⚠️ Discrepanze',         color: '#dc2626', bg: '#fee2e2' },
  cancelled:   { label: '❌ Annullata',           color: '#6b7280', bg: '#f3f4f6' },
};

const fmtDT  = v => v ? new Date(v).toLocaleString('it-IT') : '–';
const fmtDate= v => v ? new Date(v).toLocaleDateString('it-IT') : '–';

/* ─── Helper semaforo ────────────────────────────────────── */
const getScanColor = (item) => {
  const s = parseInt(item.scanned_qty ?? 0);
  const e = parseInt(item.expected_qty ?? 1);
  if (s <= 0)    return { color: '#dc2626', bg: '#fee2e2', label: '🔴 Da scansionare', key: 'red' };
  if (s < e)     return { color: '#d97706', bg: '#fef3c7', label: '🟠 Incompleto',     key: 'orange' };
  return           { color: '#059669', bg: '#d1fae5', label: '🟢 Completo',       key: 'green' };
};

/* ─── Componente principale ─────────────────────────────── */
export default function DeliveryNotesPage() {
  const [notes, setNotes]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState('notes'); // notes | discrepancies
  const [discrepancies, setDisc]  = useState([]);
  const [openDiscCount, setOpenDC]= useState(0);
  const [selectedNote, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [scanMode, setScanMode]   = useState(null); // noteId in corso di riscontro
  const [storesList, setStoresList] = useState([]);

  useEffect(() => { storesApi.getStores().then(r => setStoresList(r.data?.data || [])); }, []);
  useEffect(() => { fetchData(); }, [tab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tab === 'notes') {
        const res = await deliveryNotes.getAll();
        setNotes(res.data?.data || []);
      } else {
        const res = await deliveryNotes.getDiscrepancies();
        setDisc(res.data?.data || []);
        setOpenDC(res.data?.open_count || 0);
      }
    } catch { toast.error('Errore caricamento'); }
    finally { setLoading(false); }
  };

  const handleBrtSync = async (id) => {
    try {
      const res = await deliveryNotes.syncBrt(id);
      const d = res.data?.data;
      toast.success(`BRT: ${d?.carrier_status} ${d?.real_api ? '(API reale ✓)' : '(simulato)'}`);
      fetchData();
    } catch { toast.error('Errore sincronizzazione BRT'); }
  };

  const handleResolveDisc = async (id, status) => {
    if (!confirm(`Marcare come ${status === 'resolved' ? 'Risolta (stock sistemato)' : 'Accettata'}?`)) return;
    try {
      await deliveryNotes.resolveDiscrepancy(id, { status });
      toast.success('Discrepanza aggiornata');
      fetchData();
    } catch { toast.error('Errore'); }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 60 }}>
      <div className="page-head">
        <div>
          <div className="page-head-title">📄 Bolle di Scarico</div>
          <div className="page-head-sub">Merce in transito verso i negozi — riscontro via barcode</div>
        </div>
        <button className="btn btn-gold" onClick={() => setShowCreate(true)}>+ Nuova Bolla Manuale</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { key: 'notes', label: 'Elenco Bolle' },
          { key: 'discrepancies', label: `Discrepanze${openDiscCount > 0 ? ` (${openDiscCount})` : ''}` },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSelected(null); setScanMode(null); }}
            style={{
              padding: '7px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 13,
              background: tab === t.key ? '#0e1726' : '#f3f4f6',
              color: tab === t.key ? '#fff' : '#374151',
              position: 'relative',
            }}>
            {t.label}
            {t.key === 'discrepancies' && openDiscCount > 0 && (
              <span style={{ background: '#dc2626', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: 6 }}>
                {openDiscCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* CONTENUTO TAB BOLLE */}
      {tab === 'notes' && !scanMode && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedNote ? '1fr 460px' : '1fr', gap: 20 }}>
          {/* Tabella bolle */}
          <div className="table-card" style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Caricamento...</div>
            ) : notes.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>
                <Package size={40} style={{ opacity: 0.4, marginBottom: 12 }} />
                <div>Nessuna bolla trovata</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['Bolla', 'Negozio', 'Art.', 'BRT', 'Stato', 'Verifica', 'Azioni'].map(h => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {notes.map(n => {
                    const st = STATUS[n.status] || STATUS.pending;
                    const hasDisc = n.has_discrepancy || n.open_discrepancies > 0;
                    return (
                      <tr key={n.id}
                        onClick={() => setSelected(n.id === selectedNote ? null : n.id)}
                        style={{
                          borderBottom: '1px solid #f3f4f6', cursor: 'pointer',
                          background: selectedNote === n.id ? '#f0f2ff' : 'white',
                        }}
                        onMouseEnter={e => { if (selectedNote !== n.id) e.currentTarget.style.background = '#f9fafb'; }}
                        onMouseLeave={e => { if (selectedNote !== n.id) e.currentTarget.style.background = 'white'; }}>
                        <td style={{ padding: '12px 14px', fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {n.note_number}
                            {hasDisc && <span title="Discrepanze rilevate" style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', display: 'inline-block', flexShrink: 0 }} />}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 13 }}>{n.store_name}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: '#e0e7ff', color: '#4338ca', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{n.items_count}</span>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 12 }}>
                          {n.tracking_number ? (
                            <div>
                              <div style={{ color: '#7c3aed', fontWeight: 600 }}>{n.tracking_number}</div>
                              <div style={{ color: '#9ca3af', fontSize: 11 }}>{n.carrier_status}</div>
                            </div>
                          ) : <span style={{ color: '#d1d5db' }}>–</span>}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: st.bg, color: st.color, borderRadius: 10, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>
                            {st.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: '#6b7280' }}>
                          {n.verification_duration_minutes != null
                            ? `⏱ ${n.verification_duration_minutes} min`
                            : '–'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                            {['pending', 'in_progress'].includes(n.status) && (
                              <button className="btn btn-gold" style={{ fontSize: 11, padding: '4px 10px' }}
                                onClick={() => setScanMode(n.id)}>
                                📷 Riscontro
                              </button>
                            )}
                            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}
                              onClick={() => handleBrtSync(n.id)}>
                              <RefreshCw size={11} style={{ marginRight: 3 }} />BRT
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pannello dettaglio bolla */}
          {selectedNote && (
            <NoteDetail
              noteId={selectedNote}
              onClose={() => setSelected(null)}
              onRefresh={fetchData}
              onScanMode={() => setScanMode(selectedNote)}
            />
          )}
        </div>
      )}

      {/* MODALITÀ RISCONTRO (scan kiosk) */}
      {tab === 'notes' && scanMode && (
        <ScanKiosk
          noteId={scanMode}
          onClose={() => { setScanMode(null); fetchData(); }}
        />
      )}

      {/* CONTENUTO TAB DISCREPANZE */}
      {tab === 'discrepancies' && (
        <DiscrepanciesTab
          discrepancies={discrepancies}
          loading={loading}
          onResolve={handleResolveDisc}
          onRefresh={fetchData}
          notes={notes}
        />
      )}

      {/* Modal creazione manuale */}
      {showCreate && (
        <CreateNoteModal
          storesList={storesList}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchData(); }}
        />
      )}
    </div>
  );
}

/* ─── Dettaglio Bolla ────────────────────────────────────── */
function NoteDetail({ noteId, onClose, onRefresh, onScanMode }) {
  const [note, setNote] = useState(null);

  useEffect(() => {
    deliveryNotes.getOne(noteId).then(r => setNote(r.data?.data)).catch(() => toast.error('Errore'));
  }, [noteId]);

  if (!note) return <div className="table-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}><div style={{ color: '#9ca3af' }}>Caricamento...</div></div>;

  const st = STATUS[note.status] || STATUS.pending;

  return (
    <div className="table-card" style={{ padding: 24, position: 'relative', maxHeight: '80vh', overflowY: 'auto' }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={18} /></button>

      <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{note.note_number}</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ background: st.bg, color: st.color, borderRadius: 10, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>{st.label}</span>
        {note.has_discrepancy && (
          <span style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>⚠️ {note.open_discrepancies} discrepanze</span>
        )}
      </div>

      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        {[
          ['🏪 Negozio', note.store_name],
          ['👤 Creato da', note.created_by_name],
          ['🕐 Creato il', fmtDT(note.created_at)],
          note.tracking_number && ['📦 Tracking BRT', note.tracking_number],
          note.carrier_status  && ['🚛 Stato BRT', note.carrier_status],
          note.verification_duration_minutes != null && ['⏱ Tempo verifica', `${note.verification_duration_minutes} min`],
        ].filter(Boolean).map(([l, v]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #f3f4f6', paddingBottom: 5 }}>
            <span style={{ color: '#6b7280' }}>{l}</span>
            <span style={{ fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Articoli con semafori */}
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Articoli ({note.items?.length || 0})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(note.items || []).map(item => {
          const sc = getScanColor(item);
          return (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f9fafb', borderRadius: 8, fontSize: 13 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                {item.sku && <div style={{ fontSize: 11, color: '#9ca3af' }}>SKU: {item.sku}</div>}
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                <div style={{ fontWeight: 700 }}>{parseInt(item.scanned_qty || 0)} / {item.expected_qty}</div>
                <span style={{ background: sc.bg, color: sc.color, borderRadius: 8, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{sc.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {['pending', 'in_progress'].includes(note.status) && (
        <button className="btn btn-gold" style={{ width: '100%', marginTop: 20 }} onClick={onScanMode}>
          📷 Avvia Riscontro Merce
        </button>
      )}
    </div>
  );
}

/* ─── Kiosk Scan Riscontro ───────────────────────────────── */
function ScanKiosk({ noteId, onClose }) {
  const [note, setNote]           = useState(null);
  const [items, setItems]         = useState([]);
  const [barcode, setBarcode]     = useState('');
  const [lastScanned, setLast]    = useState(null);
  const [completing, setCompleting] = useState(false);
  const [elapsed, setElapsed]     = useState(0);
  const barcodeRef = useRef();
  const startRef   = useRef(Date.now());

  useEffect(() => {
    deliveryNotes.getOne(noteId).then(r => {
      setNote(r.data?.data);
      setItems(r.data?.data?.items || []);
    });
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [noteId]);

  useEffect(() => { barcodeRef.current?.focus(); }, [note]);

  const handleScan = useCallback(async () => {
    const bc = barcode.trim();
    if (!bc) return;
    setBarcode('');
    try {
      const res = await deliveryNotes.scanByBarcode(noteId, bc);
      if (res.data?.found) {
        const updated = res.data.data;
        setItems(prev => prev.map(i => i.id === updated.id ? { ...i, scanned_qty: updated.scanned_qty, scan_status: updated.scan_status } : i));
        setLast({ name: updated.product_name, scanned: updated.scanned_qty, expected: updated.expected_qty, status: getScanColor(updated) });
        toast.success(`${updated.product_name} (+1)`, { duration: 1200, icon: '✅' });
      }
    } catch (e) {
      const msg = e.response?.data?.message || 'Barcode non trovato in questa bolla';
      toast.error(msg, { duration: 2000, icon: '❌' });
    }
    barcodeRef.current?.focus();
  }, [barcode, noteId]);

  const handleManualScan = async (itemId, qty) => {
    try {
      const res = await deliveryNotes.scanItem(noteId, itemId, qty);
      const updated = res.data?.data;
      setItems(prev => prev.map(i => i.id === updated.id ? { ...i, scanned_qty: updated.scanned_qty } : i));
    } catch { toast.error('Errore'); }
  };

  const redCount    = items.filter(i => parseInt(i.scanned_qty || 0) <= 0).length;
  const orangeCount = items.filter(i => { const s = parseInt(i.scanned_qty || 0); return s > 0 && s < i.expected_qty; }).length;
  const greenCount  = items.filter(i => parseInt(i.scanned_qty || 0) >= i.expected_qty).length;

  const handleComplete = async () => {
    if (!confirm('Concludere il riscontro? Le quantità scansionate verranno registrate come ricevute.')) return;
    setCompleting(true);
    try {
      const res = await deliveryNotes.completeVerification(noteId);
      const d = res.data?.data;
      if (d?.has_discrepancy) {
        toast.error(`Riscontro completato con ${d.discrepancies} discrepanze`, { duration: 4000 });
      } else {
        toast.success('Riscontro completato ✓ Giacenze aggiornate', { duration: 3000 });
      }
      onClose();
    } catch (e) { toast.error(e.response?.data?.message || 'Errore'); }
    finally { setCompleting(false); }
  };

  const fmtElapsed = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div style={{ background: '#0e1726', minHeight: '70vh', borderRadius: 20, padding: 32, color: 'white' }}>
      {/* Header kiosk */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>📷 Riscontro Merce</div>
          <div style={{ fontSize: 14, color: '#94a3b8' }}>{note?.note_number} — {note?.store_name}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#c9a227' }}>{fmtElapsed(elapsed)}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Tempo trascorso</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, padding: '8px 16px', color: 'white', cursor: 'pointer', fontSize: 13 }}>
            ✕ Esci
          </button>
        </div>
      </div>

      {/* Semaforo riepilogo */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {[
          { count: redCount,    label: 'Da fare',   color: '#dc2626', bg: 'rgba(220,38,38,0.15)' },
          { count: orangeCount, label: 'Parziali',  color: '#d97706', bg: 'rgba(217,119,6,0.15)' },
          { count: greenCount,  label: 'Completati',color: '#059669', bg: 'rgba(5,150,105,0.15)' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: 14, padding: '14px 20px', textAlign: 'center', border: `1px solid ${s.color}33` }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Input barcode */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>📷 Scansiona barcode o inserisci manualmente:</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            ref={barcodeRef}
            value={barcode}
            onChange={e => setBarcode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleScan()}
            placeholder="Scan barcode o digita e premi Invio..."
            style={{
              flex: 1, padding: '14px 18px', borderRadius: 12,
              border: '2px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
              color: 'white', fontSize: 16, outline: 'none',
            }}
            autoFocus
          />
          <button onClick={handleScan} style={{ background: '#c9a227', border: 'none', borderRadius: 12, padding: '0 24px', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>
            ✓
          </button>
        </div>
        {lastScanned && (
          <div style={{ marginTop: 10, padding: '10px 16px', background: `${lastScanned.status.bg}22`, border: `1px solid ${lastScanned.status.color}44`, borderRadius: 10, fontSize: 13 }}>
            <span style={{ color: lastScanned.status.color, fontWeight: 700 }}>Ultimo: </span>
            {lastScanned.name} — {lastScanned.scanned}/{lastScanned.expected} unità
          </div>
        )}
      </div>

      {/* Lista articoli con semafori */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto', marginBottom: 24 }}>
        {items.map(item => {
          const sc = getScanColor(item);
          const scanned = parseInt(item.scanned_qty || 0);
          return (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px 16px',
              border: `1px solid ${sc.color}33`,
            }}>
              {/* Pallino semaforo */}
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: sc.color, flexShrink: 0, boxShadow: `0 0 8px ${sc.color}88` }} />

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item.product_name}</div>
                {item.sku && <div style={{ fontSize: 11, color: '#64748b' }}>SKU: {item.sku} {item.barcode && `| BC: ${item.barcode}`}</div>}
              </div>

              {/* Contatore manuale */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => handleManualScan(item.id, -1)}
                  style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  −
                </button>
                <span style={{ fontWeight: 800, fontSize: 18, color: sc.color, minWidth: 40, textAlign: 'center' }}>
                  {scanned}<span style={{ fontSize: 12, color: '#64748b' }}>/{item.expected_qty}</span>
                </span>
                <button onClick={() => handleManualScan(item.id, 1)}
                  style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pulsante concludi */}
      <button onClick={handleComplete} disabled={completing}
        style={{
          width: '100%', padding: '18px', borderRadius: 14, border: 'none', cursor: completing ? 'not-allowed' : 'pointer',
          background: redCount === 0 && orangeCount === 0 ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #d97706, #f59e0b)',
          color: 'white', fontSize: 17, fontWeight: 800, letterSpacing: '0.02em',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}>
        {completing ? 'Registrazione in corso...' : (redCount === 0 && orangeCount === 0 ? '✅ Concludi Riscontro — Tutto OK' : `⚠️ Concludi Riscontro (${redCount + orangeCount} articoli incompleti)`)}
      </button>
    </div>
  );
}

/* ─── Tab Discrepanze ────────────────────────────────────── */
function DiscrepanciesTab({ discrepancies, loading, onResolve, onRefresh, notes }) {
  const [adjustModal, setAdjustModal] = useState(null);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Caricamento...</div>;

  return (
    <div className="table-card" style={{ padding: 0 }}>
      {discrepancies.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>
          <CheckCircle size={40} style={{ opacity: 0.4, marginBottom: 12 }} />
          <div>Nessuna discrepanza aperta 🎉</div>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Negozio', 'Bolla', 'Prodotto', 'Atteso', 'Ricevuto', 'Diff.', 'Stato', 'Azioni'].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {discrepancies.map(d => (
              <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '12px 14px', fontSize: 13 }}>{d.store_name}</td>
                <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 12 }}>{d.note_number}</td>
                <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500 }}>{d.product_name}</td>
                <td style={{ padding: '12px 14px', fontWeight: 700 }}>{d.expected_qty}</td>
                <td style={{ padding: '12px 14px', fontWeight: 700 }}>{d.received_qty}</td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ color: d.difference < 0 ? '#dc2626' : '#059669', fontWeight: 800, fontSize: 15 }}>
                    {d.difference > 0 ? '+' : ''}{d.difference}
                  </span>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ background: d.status === 'open' ? '#fee2e2' : '#d1fae5', color: d.status === 'open' ? '#dc2626' : '#059669', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                    {d.status === 'open' ? 'Aperta' : 'Risolta'}
                  </span>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  {d.status === 'open' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn" style={{ fontSize: 11, padding: '4px 10px', background: '#7c3aed', color: 'white' }}
                        onClick={() => setAdjustModal(d)}>
                        ✏️ Correggi
                      </button>
                      <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}
                        onClick={() => onResolve(d.id, 'accepted')}>
                        Accetta
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {adjustModal && (
        <AdjustStockModal
          discrepancy={adjustModal}
          onClose={() => setAdjustModal(null)}
          onSaved={() => { setAdjustModal(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

/* ─── Modal Correzione Giacenza ──────────────────────────── */
function AdjustStockModal({ discrepancy: d, onClose, onSaved }) {
  const [qty, setQty]   = useState(d.received_qty ?? 0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await deliveryNotes.adjustStock(d.delivery_note_id, d.product_variant_id
        ? undefined  // verrà cercato per product_variant_id
        : undefined,
        { corrected_qty: parseInt(qty), notes }
      );
      // Usa il endpoint corretto per aggiustare via delivery_note_id e discrepancy
      await fetch(`/api/delivery-notes/${d.delivery_note_id}/items/${d.id}/adjust-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('authToken')}`, 'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO' },
        body: JSON.stringify({ corrected_qty: parseInt(qty), notes }),
      });
      toast.success('Giacenza corretta ✓');
      onSaved();
    } catch { toast.error('Errore durante la correzione'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 32, width: 440, boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>✏️ Correggi Giacenza</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>{d.product_name} — Bolla {d.note_number}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, padding: 14, background: '#f9fafb', borderRadius: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>Spedito</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{d.expected_qty}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>Rilevato</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626' }}>{d.received_qty}</div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Quantità Corretta *</label>
          <input className="field-input" type="number" min={0} value={qty === 0 ? '' : qty} onChange={e => setQty(e.target.value === '' ? 0 : e.target.value)} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label className="field-label">Note (opzionale)</label>
          <textarea className="field-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="es. Prodotto trovato danneggiato..." />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-ghost" onClick={onClose}>Annulla</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvataggio...' : '✓ Applica Correzione'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal Creazione Bolla Manuale ─────────────────────── */
function CreateNoteModal({ storesList, onClose, onCreated }) {
  const [form, setForm] = useState({ store_id: '', notes: '', expected_at: '', tracking_number: '', items: [] });
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (search.length < 2) { setResults([]); return; }
      try {
        const res = await catalog.getProducts({ search, limit: 10, include_variants: 1 });
        const all = [];
        (res.data?.data || []).forEach(p => (p.variants || []).forEach(v => {
          all.push({ id: v.id, sku: v.sku, barcode: v.barcode, name: `${p.name}${v.flavor ? ' – ' + v.flavor : ''}`, on_hand: v.on_hand ?? 0 });
        }));
        setResults(all);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const addItem = (vr) => {
    setForm(f => {
      const ex = f.items.find(i => i.product_variant_id === vr.id);
      if (ex) return { ...f, items: f.items.map(i => i.product_variant_id === vr.id ? { ...i, expected_qty: i.expected_qty + 1 } : i) };
      return { ...f, items: [...f.items, { product_variant_id: vr.id, product_name: vr.name, barcode: vr.barcode, sku: vr.sku, expected_qty: 1 }] };
    });
    setSearch(''); setResults([]);
  };

  const handleCreate = async () => {
    if (!form.store_id || form.items.length === 0) { toast.error('Seleziona negozio e almeno un articolo'); return; }
    setSaving(true);
    try {
      await deliveryNotes.create({ ...form, type: 'scarico' });
      toast.success('Bolla creata ✓ — Giacenze scalate dal Centrale');
      onCreated();
    } catch (e) { toast.error(e.response?.data?.message || 'Errore'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 32, width: '100%', maxWidth: 680, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>📄 Nuova Bolla di Scarico</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label className="field-label">Negozio Destinazione *</label>
            <select className="field-input" value={form.store_id} onChange={e => setForm({ ...form, store_id: e.target.value })}>
              <option value="">— seleziona —</option>
              {storesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Data Trasporto Attesa</label>
            <DatePicker value={form.expected_at} onChange={v => setForm({ ...form, expected_at: v })} placeholder="Seleziona data" />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Tracking BRT (opzionale)</label>
          <input className="field-input" value={form.tracking_number} onChange={e => setForm({ ...form, tracking_number: e.target.value })} placeholder="Numero di tracciabilità BRT..." />
        </div>

        <div style={{ marginBottom: 16, position: 'relative' }}>
          <label className="field-label">Aggiungi Prodotti al Catalogo</label>
          <input className="field-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca prodotto..." />
          {results.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, zIndex: 200, maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
              {results.map(vr => (
                <div key={vr.id} onClick={() => addItem(vr)} style={{ padding: '10px 16px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{vr.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{vr.sku}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: vr.on_hand > 0 ? '#059669' : '#dc2626' }}>Giac: {vr.on_hand}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {form.items.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Articoli ({form.items.length})</div>
            {form.items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f9fafb', borderRadius: 8, marginBottom: 6 }}>
                <div style={{ flex: 1, fontSize: 13 }}>{item.product_name}</div>
                <input type="number" min={1} value={item.expected_qty}
                  onChange={e => { const n = [...form.items]; n[idx].expected_qty = e.target.value === '' ? '' : parseInt(e.target.value); setForm({ ...form, items: n }); }}
                  style={{ width: 60, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, textAlign: 'center' }} />
                <button onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><X size={14} /></button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-ghost" onClick={onClose}>Annulla</button>
          <button className="btn btn-gold" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creazione...' : '📄 Crea Bolla e Scala Giacenze'}
          </button>
        </div>
      </div>
    </div>
  );
}
