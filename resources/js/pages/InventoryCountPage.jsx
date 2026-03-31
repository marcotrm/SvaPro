import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { inventoryCount, inventory } from '../api.jsx';
import { SkeletonTable } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';

export default function InventoryCountPage() {
  const { selectedStoreId } = useOutletContext();
  const [tab, setTab] = useState('sessions');
  const [sessions, setSessions] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create session
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ warehouse_id: '', notes: '' });
  const [creating, setCreating] = useState(false);

  // Active count session detail
  const [activeSession, setActiveSession] = useState(null);
  const [sessionLines, setSessionLines] = useState([]);
  const [scanInput, setScanInput] = useState('');
  const [countQty, setCountQty] = useState('1');
  const [scanning, setScanning] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true); setError('');
      const [sessRes, stockRes] = await Promise.all([
        inventoryCount.getSessions(),
        inventory.getStock(),
      ]);
      setSessions(sessRes.data?.data || []);
      // Extract unique warehouses from stock data
      const stockData = stockRes.data?.data || [];
      const whMap = new Map();
      stockData.forEach(s => {
        if (s.warehouse_id && s.warehouse_name) {
          whMap.set(s.warehouse_id, { id: s.warehouse_id, name: s.warehouse_name });
        }
      });
      setWarehouses(Array.from(whMap.values()));
    } catch (err) {
      setError(err);
    } finally { setLoading(false); }
  };

  const handleCreateSession = async () => {
    try {
      setCreating(true); setError('');
      const res = await inventoryCount.createSession({
        warehouse_id: parseInt(createForm.warehouse_id),
        notes: createForm.notes || null,
      });
      setShowCreate(false);
      setCreateForm({ warehouse_id: '', notes: '' });
      await fetchAll();
      // Open the newly created session
      if (res.data?.session_id) {
        await loadSessionDetail(res.data.session_id);
      }
    } catch (err) {
      setError(err);
    } finally { setCreating(false); }
  };

  const loadSessionDetail = async (sessionId) => {
    try {
      setError('');
      const res = await inventoryCount.getSessionDetail(sessionId);
      setActiveSession(res.data?.session || null);
      setSessionLines(res.data?.lines || []);
      setTab('counting');
    } catch (err) {
      setError(err);
    }
  };

  const handleScan = async () => {
    if (!scanInput.trim() || !activeSession) return;
    try {
      setScanning(true); setError('');
      await inventoryCount.addCount(activeSession.id, {
        barcode: scanInput.trim(),
        counted_qty: parseInt(countQty) || 1,
      });
      setScanInput('');
      setCountQty('1');
      // Reload session detail
      await loadSessionDetail(activeSession.id);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setScanning(false); }
  };

  const handleFinalize = async (applyAdjustments) => {
    if (!activeSession) return;
    if (applyAdjustments && !confirm('Applicare le rettifiche alle giacenze? Le differenze verranno aggiornate nel magazzino.')) return;
    try {
      setFinalizing(true); setError('');
      await inventoryCount.finalize(activeSession.id, { apply_adjustments: applyAdjustments });
      setActiveSession(null);
      setSessionLines([]);
      setTab('sessions');
      await fetchAll();
    } catch (err) {
      setError(err);
    } finally { setFinalizing(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScan();
    }
  };

  const fmtDate = v => v ? new Date(v).toLocaleString('it-IT') : '-';
  const statusBadge = (s) => {
    const map = { open: 'high', finalized: 'up', cancelled: 'low' };
    const labels = { open: 'Aperta', finalized: 'Finalizzata', cancelled: 'Annullata' };
    return <span className={`badge ${map[s] || 'mid'}`}><span className="badge-dot" />{labels[s] || s}</span>;
  };

  // Stats
  const totalVariance = sessionLines.reduce((sum, l) => sum + Math.abs(l.difference || 0), 0);
  const matchCount = sessionLines.filter(l => l.difference === 0).length;
  const mismatchCount = sessionLines.filter(l => l.difference !== 0).length;

  if (loading) return <SkeletonTable />;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head-title">Inventario Guidato</div>
          <div className="page-head-sub">Conteggio barcode con confronto giacenze</div>
        </div>
        {tab === 'sessions' && (
          <button className="btn btn-gold" onClick={() => setShowCreate(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nuova Sessione
          </button>
        )}
        {tab === 'counting' && activeSession && (
          <button className="btn btn-ghost" onClick={() => { setTab('sessions'); setActiveSession(null); }}>
            &larr; Torna alla lista
          </button>
        )}
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchAll} />}

      {/* Tabs */}
      {tab !== 'counting' && (
        <div className="filter-bar" style={{ marginBottom: 16 }}>
          <button className={`filter-chip ${tab === 'sessions' ? 'active' : ''}`} onClick={() => setTab('sessions')}>
            Sessioni ({sessions.length})
          </button>
        </div>
      )}

      {/* Create Session */}
      {showCreate && (
        <div className="table-card" style={{ marginBottom: 16 }}>
          <div className="table-toolbar"><div className="section-title">Nuova Sessione di Conteggio</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 16px 16px' }}>
            <div>
              <label className="field-label">Magazzino *</label>
              <select className="field-input" value={createForm.warehouse_id} onChange={e => setCreateForm({ ...createForm, warehouse_id: e.target.value })}>
                <option value="">— seleziona —</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div><label className="field-label">Note</label><input className="field-input" value={createForm.notes} onChange={e => setCreateForm({ ...createForm, notes: e.target.value })} placeholder="Inventario trimestrale..." /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '0 16px 16px' }}>
            <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Annulla</button>
            <button className="btn btn-gold" onClick={handleCreateSession} disabled={creating || !createForm.warehouse_id}>{creating ? 'Creazione...' : 'Avvia Sessione'}</button>
          </div>
        </div>
      )}

      {/* Sessions List */}
      {tab === 'sessions' && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Magazzino</th>
                <th>Stato</th>
                <th>Articoli</th>
                <th>Varianza Tot.</th>
                <th>Avviata da</th>
                <th>Data</th>
                <th style={{ textAlign: 'right' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length > 0 ? sessions.map(s => (
                <tr key={s.id}>
                  <td className="mono">#{s.id}</td>
                  <td>{s.warehouse_name || `WH #${s.warehouse_id}`}</td>
                  <td>{statusBadge(s.status)}</td>
                  <td className="mono">{s.line_count}</td>
                  <td className="mono" style={{ color: s.total_variance > 0 ? '#ef4444' : 'var(--muted2)' }}>
                    {s.total_variance > 0 ? `±${s.total_variance}` : '0'}
                  </td>
                  <td style={{ color: 'var(--muted2)' }}>{s.started_by_name || '-'}</td>
                  <td style={{ color: 'var(--muted2)' }}>{fmtDate(s.created_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => loadSessionDetail(s.id)}>
                      {s.status === 'open' ? 'Continua' : 'Dettaglio'}
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>Nessuna sessione di conteggio</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Counting Session Detail */}
      {tab === 'counting' && activeSession && (
        <>
          {/* KPIs */}
          <div className="kpi-grid">
            <div className="kpi-card"><div className="kpi-label">Articoli Contati</div><div className="kpi-value">{sessionLines.length}</div></div>
            <div className="kpi-card"><div className="kpi-label">Corrispondenti</div><div className="kpi-value" style={{ color: '#22c55e' }}>{matchCount}</div></div>
            <div className="kpi-card"><div className="kpi-label">Discrepanze</div><div className="kpi-value" style={{ color: mismatchCount > 0 ? '#ef4444' : 'var(--text)' }}>{mismatchCount}</div></div>
            <div className="kpi-card"><div className="kpi-label">Varianza Totale</div><div className="kpi-value" style={{ color: totalVariance > 0 ? '#ef4444' : 'var(--text)' }}>±{totalVariance}</div></div>
          </div>

          {/* Barcode scanner input */}
          {activeSession.status === 'open' && (
            <div className="table-card" style={{ marginBottom: 16 }}>
              <div className="table-toolbar"><div className="section-title">Scansiona Barcode</div></div>
              <div style={{ display: 'flex', gap: 12, padding: '0 16px 16px', alignItems: 'flex-end' }}>
                <div style={{ flex: 2 }}>
                  <label className="field-label">Barcode / SKU</label>
                  <input className="field-input" value={scanInput} onChange={e => setScanInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Scansiona o digita barcode..." autoFocus style={{ fontSize: 16 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="field-label">Quantità</label>
                  <input className="field-input" type="number" min="0" value={countQty} onChange={e => setCountQty(e.target.value)} style={{ fontSize: 16 }} />
                </div>
                <button className="btn btn-gold" onClick={handleScan} disabled={scanning || !scanInput.trim()} style={{ height: 42 }}>
                  {scanning ? '...' : 'Registra'}
                </button>
              </div>
            </div>
          )}

          {/* Count lines */}
          <div className="table-card">
            <div className="table-toolbar">
              <div className="section-title">Righe di Conteggio</div>
              {activeSession.status === 'open' && (
                <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                  <button className="btn btn-ghost" onClick={() => handleFinalize(false)} disabled={finalizing}>Chiudi Senza Rettifiche</button>
                  <button className="btn btn-gold" onClick={() => handleFinalize(true)} disabled={finalizing}>Chiudi e Applica Rettifiche</button>
                </div>
              )}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Prodotto</th>
                  <th>SKU</th>
                  <th>Barcode</th>
                  <th>Contato</th>
                  <th>Sistema</th>
                  <th>Differenza</th>
                </tr>
              </thead>
              <tbody>
                {sessionLines.length > 0 ? sessionLines.map(l => (
                  <tr key={l.id} style={{ background: l.difference !== 0 ? 'rgba(239,68,68,0.04)' : undefined }}>
                    <td style={{ fontWeight: 600 }}>{l.product_name || '-'}{l.variant_flavor ? ` (${l.variant_flavor})` : ''}</td>
                    <td className="mono">{l.product_sku || '-'}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{l.barcode_scanned || '-'}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>{l.counted_qty}</td>
                    <td className="mono">{l.system_qty}</td>
                    <td className="mono" style={{ fontWeight: 600, color: l.difference === 0 ? '#22c55e' : '#ef4444' }}>
                      {l.difference > 0 ? '+' : ''}{l.difference}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>Scansiona il primo barcode per iniziare</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
