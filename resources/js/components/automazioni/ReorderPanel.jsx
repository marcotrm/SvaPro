import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, Truck, RefreshCw, Play, CheckCircle, AlertTriangle, ArrowRight, Package, Warehouse } from 'lucide-react';
import { inventory, stockTransfers } from '../../api.jsx';

const fmt = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);

/* ─── Sezione 1: Riordino Automatico Fornitori ───────────────────────────── */
function ReorderFornitori() {
  const [preview, setPreview]   = useState(null);
  const [loading, setLoading]   = useState(false);   // non caricare in automatico
  const [running, setRunning]   = useState(false);
  const [result,  setResult]    = useState(null);
  const [error,   setError]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await inventory.getSmartReorderPreview();
      // Il backend può tornare HTTP 200 con _error se la query SQL fallisce
      if (res.data?._error) {
        setError('Errore server: ' + res.data._error);
        setPreview(null);
        return;
      }
      setPreview(res.data);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Errore caricamento preview');
    } finally { setLoading(false); }
  }, []);

  // NON caricare in automatico — l'utente clicca "Carica Preview"

  const runReorder = async () => {
    setRunning(true); setResult(null); setError(null);
    try {
      const res = await inventory.runSmartReorder();
      setResult(res.data);
      load();
    } catch (e) {
      setError(e?.response?.data?.message || 'Errore durante il riordino');
    } finally { setRunning(false); }
  };

  const alerts = preview?.alerts || [];
  const summary = preview?.summary || {};

  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 20, padding: '20px 24px', border: '1.5px solid rgba(99,102,241,0.15)', marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingCart size={20} color="#6366f1" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }}>Riordino Automatico Fornitori</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
              {loading ? 'Caricamento...' : `${alerts.length} prodotti sotto soglia`}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 600 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Aggiorna
          </button>
          <button onClick={runReorder} disabled={running || alerts.length === 0} style={{ display: 'flex', alignItems: 'center', gap: 6, background: alerts.length > 0 ? '#6366f1' : '#e2e8f0', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: alerts.length > 0 ? 'pointer' : 'not-allowed', color: alerts.length > 0 ? '#fff' : '#94a3b8', fontSize: 12, fontWeight: 700 }}>
            <Play size={13} /> {running ? 'In corso...' : 'Lancia Riordino'}
          </button>
        </div>
      </div>

      {/* KPI strip */}
      {!loading && summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Prodotti da riordinare', value: summary.total_alerts ?? alerts.length, color: '#ef4444' },
            { label: 'Fornitori coinvolti',    value: summary.suppliers_count ?? '—',         color: '#6366f1' },
            { label: 'Valore stimato ordine',  value: summary.estimated_value ? fmt(summary.estimated_value) : '—', color: '#10b981' },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--color-bg)', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Alerts list */}
      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Analisi prodotti sotto soglia in corso…</div>
      ) : error ? (
        <div style={{ padding: 14, background: '#fef2f2', borderRadius: 10, color: '#dc2626', fontSize: 13, display: 'flex', gap: 8 }}>
          <AlertTriangle size={16} />{error}
        </div>
      ) : preview === null ? (
        <div style={{ padding: 20, textAlign: 'center', background: 'var(--color-bg)', borderRadius: 12, color: 'var(--color-text-secondary)', fontSize: 13 }}>
          <div style={{ marginBottom: 10, opacity: 0.5, fontSize: 28 }}>📦</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Preview non caricata</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 14 }}>
            Il calcolo potrebbe richiedere 10–20 secondi. Clicca per avviarlo.
          </div>
          <button onClick={load} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            <RefreshCw size={14} /> Carica Preview
          </button>
        </div>
      ) : alerts.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', background: '#f0fdf4', borderRadius: 12, color: '#16a34a', fontWeight: 700, fontSize: 13 }}>
          <CheckCircle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Tutti i prodotti sono sopra soglia — nessun riordino necessario
        </div>
      ) : (
        <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.slice(0, 20).map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--color-bg)', borderRadius: 10, border: '1px solid var(--color-border)' }}>
              <Package size={15} color="#6366f1" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.product_name || a.name || `Prodotto #${a.product_id}`}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                  Stock: <strong style={{ color: '#ef4444' }}>{a.current_stock ?? a.on_hand ?? 0}</strong> · Soglia: {a.reorder_point ?? '—'} · Fornitore: {a.supplier_name ?? '—'}
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#6366f1', flexShrink: 0 }}>Qty: {a.suggested_qty ?? a.qty ?? '—'}</div>
            </div>
          ))}
          {alerts.length > 20 && <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-tertiary)', padding: 8 }}>... e altri {alerts.length - 20} prodotti</div>}
        </div>
      )}

      {/* Result feedback */}
      {result && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #86efac', color: '#16a34a', fontSize: 13, fontWeight: 700, display: 'flex', gap: 8 }}>
          <CheckCircle size={16} />{result.message || `Riordino completato: ${result.orders_created ?? ''} ordini creati`}
        </div>
      )}
    </div>
  );
}

/* ─── Sezione 2: Riordino Magazzini (Stock Transfers) ────────────────────── */
function ReorderMagazzini() {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await stockTransfers.getAll({ limit: 10, sort: 'created_at', dir: 'desc' });
      setTransfers(res.data?.data || res.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || 'Errore caricamento trasferimenti');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const STATUS = {
    draft:    { label: 'Bozza',     color: '#94a3b8', bg: '#f8fafc' },
    sent:     { label: 'Inviato',   color: '#f59e0b', bg: '#fffbeb' },
    received: { label: 'Ricevuto',  color: '#10b981', bg: '#f0fdf4' },
    cancelled:{ label: 'Annullato', color: '#ef4444', bg: '#fef2f2' },
  };

  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 20, padding: '20px 24px', border: '1.5px solid rgba(16,185,129,0.15)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Truck size={20} color="#10b981" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }}>Riordino Magazzini</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Trasferimenti stock tra negozi</div>
          </div>
        </div>
        <button onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 600 }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Aggiorna
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>Caricamento trasferimenti...</div>
      ) : error ? (
        <div style={{ padding: 14, background: '#fef2f2', borderRadius: 10, color: '#dc2626', fontSize: 13, display: 'flex', gap: 8 }}>
          <AlertTriangle size={16} />{error}
        </div>
      ) : transfers.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', background: 'var(--color-bg)', borderRadius: 12, color: 'var(--color-text-tertiary)', fontSize: 13 }}>
          Nessun trasferimento recente. Gestisci i trasferimenti dalla sezione <strong>Logistica → DDT</strong>.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {transfers.map(t => {
            const sc = STATUS[t.status] || STATUS.draft;
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--color-bg)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                <Warehouse size={15} color="#10b981" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {t.from_warehouse_name || t.from_store_name || `Magazzino #${t.from_warehouse_id}`}
                    <ArrowRight size={12} color="#94a3b8" />
                    {t.to_warehouse_name || t.to_store_name || `Magazzino #${t.to_warehouse_id}`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    {t.items_count ?? '?'} articoli · {t.created_at ? new Date(t.created_at).toLocaleDateString('it-IT') : '—'}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: sc.bg, color: sc.color }}>
                  {sc.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(16,185,129,0.05)', borderRadius: 10, border: '1px solid rgba(16,185,129,0.2)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
        💡 Per creare un nuovo trasferimento vai su <strong>Logistica → DDT / Trasferimenti</strong>
      </div>
    </div>
  );
}

export default function ReorderPanel() {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontWeight: 900, fontSize: 17, color: 'var(--color-text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 4, height: 20, background: '#6366f1', borderRadius: 2, display: 'inline-block' }} />
        Riordino Automatico
      </div>
      <ReorderFornitori />
      <ReorderMagazzini />
    </div>
  );
}
