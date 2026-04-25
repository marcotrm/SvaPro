import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart, RefreshCw, Play, CheckCircle, XCircle, Eye,
  ChevronDown, ChevronUp, Edit2, AlertTriangle, Loader2, Package
} from 'lucide-react';
import { reorderDrafts } from '../api.jsx';

const fmt  = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v ?? 0);
const fmtN = v => new Intl.NumberFormat('it-IT').format(v ?? 0);

const STATUS_CFG = {
  draft:     { label: 'Bozza',      bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200' },
  confirmed: { label: 'Approvato',  bg: 'bg-green-50',   text: 'text-green-700',  border: 'border-green-200' },
  cancelled: { label: 'Scartato',   bg: 'bg-gray-100',   text: 'text-gray-500',   border: 'border-gray-200' },
};

/* ── Modale dettaglio bozza ─────────────────────────────────────────────── */
function DraftModal({ draftId, onClose, onApproved, onDiscarded }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [editing, setEditing] = useState({});     // { lineId: newQty }
  const [saving,  setSaving]  = useState(false);
  const [actMsg,  setActMsg]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await reorderDrafts.getOne(draftId);
      setData(res.data);
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Errore caricamento');
    } finally { setLoading(false); }
  }, [draftId]);

  useEffect(() => { load(); }, [load]);

  const handleQtyChange = (lineId, val) => {
    setEditing(prev => ({ ...prev, [lineId]: val }));
  };

  const saveLineQty = async (lineId) => {
    const qty = parseInt(editing[lineId], 10);
    if (isNaN(qty) || qty < 1) return;
    setSaving(true);
    try {
      await reorderDrafts.updateLine(draftId, lineId, { qty, override_reason: 'Modifica manuale PM' });
      await load(); // ricarica — il totale viene ricalcolato dal backend
      setEditing(prev => { const n = {...prev}; delete n[lineId]; return n; });
    } catch (e) {
      setActMsg({ type: 'error', text: e?.response?.data?.message ?? 'Errore salvataggio' });
    } finally { setSaving(false); }
  };

  const handleApprove = async () => {
    setSaving(true); setActMsg(null);
    try {
      await reorderDrafts.approve(draftId);
      setActMsg({ type: 'ok', text: 'Ordine approvato! Ora visibile in Acquisti.' });
      onApproved?.();
      setTimeout(onClose, 1500);
    } catch (e) {
      setActMsg({ type: 'error', text: e?.response?.data?.message ?? 'Errore approvazione' });
    } finally { setSaving(false); }
  };

  const handleDiscard = async () => {
    if (!confirm('Scartare questa bozza?')) return;
    setSaving(true);
    try {
      await reorderDrafts.discard(draftId);
      onDiscarded?.();
      onClose();
    } catch (e) {
      setActMsg({ type: 'error', text: e?.response?.data?.message ?? 'Errore' });
    } finally { setSaving(false); }
  };

  const po    = data?.data;
  const lines = data?.lines ?? [];
  const isDraft = po?.status === 'draft';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-black text-gray-900">
              Bozza #{draftId} — {po?.supplier_name ?? '…'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{po?.store_name} · {po ? fmt(po.total_net) : '…'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <XCircle size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12 text-gray-400">
              <Loader2 size={28} className="animate-spin" />
              <span className="text-sm">Caricamento righe ordine…</span>
            </div>
          ) : error ? (
            <div className="flex gap-2 items-center p-4 bg-red-50 rounded-xl text-red-600 text-sm">
              <AlertTriangle size={16} /> {error}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <th className="pb-3 pr-4">Prodotto</th>
                  <th className="pb-3 pr-4 text-right">Qty</th>
                  <th className="pb-3 pr-4 text-right">Costo Un.</th>
                  <th className="pb-3 text-right">Totale riga</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lines.map(line => {
                  const isEditing = editing[line.id] !== undefined;
                  return (
                    <tr key={line.id} className="group">
                      <td className="py-3 pr-4 font-medium text-gray-800">{line.product_name}</td>
                      <td className="py-3 pr-4 text-right">
                        {isDraft ? (
                          <div className="flex items-center justify-end gap-2">
                            {isEditing ? (
                              <>
                                <input
                                  type="number" min="1"
                                  value={editing[line.id]}
                                  onChange={e => handleQtyChange(line.id, e.target.value)}
                                  className="w-20 border border-indigo-300 rounded-lg px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                                <button
                                  onClick={() => saveLineQty(line.id)}
                                  disabled={saving}
                                  className="text-xs font-bold px-2 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                >
                                  {saving ? '…' : '✓'}
                                </button>
                                <button
                                  onClick={() => setEditing(prev => { const n={...prev}; delete n[line.id]; return n; })}
                                  className="text-xs text-gray-400 hover:text-gray-600"
                                >✕</button>
                              </>
                            ) : (
                              <>
                                <span className="font-bold text-gray-800">{fmtN(line.qty)}</span>
                                <button
                                  onClick={() => handleQtyChange(line.id, line.qty)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Modifica quantità"
                                >
                                  <Edit2 size={13} className="text-indigo-400 hover:text-indigo-600" />
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="font-bold">{fmtN(line.qty)}</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right text-gray-500">{fmt(line.unit_cost)}</td>
                      <td className="py-3 text-right font-semibold text-gray-800">{fmt(line.line_total)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200">
                  <td colSpan={3} className="pt-3 pr-4 font-black text-gray-700 text-right">Totale ordine</td>
                  <td className="pt-3 text-right font-black text-lg text-indigo-700">{fmt(po?.total_net)}</td>
                </tr>
              </tfoot>
            </table>
          )}

          {actMsg && (
            <div className={`mt-4 flex gap-2 items-center p-3 rounded-xl text-sm font-semibold
              ${actMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {actMsg.type === 'ok' ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
              {actMsg.text}
            </div>
          )}
        </div>

        {/* Footer azioni */}
        {isDraft && (
          <div className="flex justify-between items-center p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button
              onClick={handleDiscard}
              disabled={saving}
              className="px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            >
              Scarta bozza
            </button>
            <button
              onClick={handleApprove}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              Approva Ordine
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Riga bozza nella lista ─────────────────────────────────────────────── */
function DraftRow({ draft, onSelect }) {
  const sc = STATUS_CFG[draft.status] ?? STATUS_CFG.draft;
  return (
    <tr
      onClick={() => onSelect(draft.id)}
      className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
    >
      <td className="px-4 py-3 text-sm font-semibold text-gray-800">#{draft.id}</td>
      <td className="px-4 py-3 text-sm text-gray-700">{draft.supplier_name}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{draft.store_name}</td>
      <td className="px-4 py-3 text-center">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${sc.bg} ${sc.text} ${sc.border}`}>
          {sc.label}
        </span>
      </td>
      <td className="px-4 py-3 text-right text-sm font-bold text-indigo-700">{fmt(draft.total_net)}</td>
      <td className="px-4 py-3 text-center text-sm text-gray-400">{draft.lines_count}</td>
      <td className="px-4 py-3 text-right">
        <button className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-auto text-xs font-semibold text-indigo-600 hover:text-indigo-800">
          <Eye size={13} /> Apri
        </button>
      </td>
    </tr>
  );
}

/* ── Componente principale ──────────────────────────────────────────────── */
export default function ReorderDraftsDashboard() {
  const [drafts,    setDrafts]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genResult,  setGenResult]  = useState(null);
  const [genError,   setGenError]   = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const loadDrafts = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await reorderDrafts.getAll();
      setDrafts(res.data?.data ?? res.data ?? []);
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Errore caricamento bozze');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  const handleGenerate = async (dryRun = false) => {
    setGenerating(true); setGenResult(null); setGenError(null);
    try {
      const res = await reorderDrafts.generate({ dry_run: dryRun });
      setGenResult(res.data);
      if (!dryRun) loadDrafts();
    } catch (e) {
      setGenError(e?.response?.data?.message ?? 'Errore generazione');
    } finally { setGenerating(false); }
  };

  const draftCount     = drafts.filter(d => d.status === 'draft').length;
  const confirmedCount = drafts.filter(d => d.status === 'confirmed').length;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-indigo-900 to-indigo-700 rounded-2xl p-6 mb-6 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 w-40 h-40 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4" />
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <ShoppingCart size={20} />
              </div>
              <h1 className="text-2xl font-black">Bozze Riordino Fornitori</h1>
            </div>
            <p className="text-indigo-200 text-sm">
              Il calcolo del fabbisogno avviene interamente nel backend.
              Approva le bozze per trasformarle in Ordini d'Acquisto.
            </p>
          </div>
          <div className="flex gap-4 text-center">
            {[
              { v: draftCount,     l: 'Da approvare', c: 'text-amber-300' },
              { v: confirmedCount, l: 'Approvati',    c: 'text-green-300' },
            ].map(k => (
              <div key={k.l}>
                <div className={`text-3xl font-black ${k.c}`}>{k.v}</div>
                <div className="text-xs text-indigo-300 mt-0.5">{k.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Azioni generazione ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <p className="text-sm text-gray-500 mb-4">
          Il backend calcola: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">
            (vendite_30gg/30 × lead_time) + safety_stock − (stock + in_transito)
          </code>, arrotondato al lotto MOQ del fornitore.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleGenerate(true)}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 border-2 border-indigo-200 text-indigo-700 font-bold text-sm rounded-xl hover:bg-indigo-50 disabled:opacity-50 transition-colors"
          >
            {generating ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
            Simula (dry run)
          </button>
          <button
            onClick={() => handleGenerate(false)}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow disabled:opacity-50 transition-colors"
          >
            {generating ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            {generating ? 'Calcolo in corso…' : 'Genera Bozze Ordine'}
          </button>
          <button
            onClick={loadDrafts}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 font-semibold text-sm rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors ml-auto"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Aggiorna lista
          </button>
        </div>

        {/* Risultato generazione */}
        {genResult && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
            <div className="font-black mb-1 flex items-center gap-2">
              <CheckCircle size={15} />
              {genResult.dry_run ? 'Simulazione completata' : `${genResult.drafts_created} bozze create`}
            </div>
            <div className="text-xs text-green-600">
              Saltati (fabbisogno ≤ 0): {genResult.skipped_no_need ?? 0}
              {genResult.reason && ` · ${genResult.reason}`}
            </div>
          </div>
        )}
        {genError && (
          <div className="mt-4 flex gap-2 items-center p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-semibold">
            <AlertTriangle size={15} /> {genError}
          </div>
        )}
      </div>

      {/* ── Lista bozze ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <Package size={16} className="text-indigo-400" />
          <span className="font-bold text-gray-800">Bozze generate</span>
          <span className="ml-auto text-xs text-gray-400">{drafts.length} totali</span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
            <Loader2 size={28} className="animate-spin" />
            <span className="text-sm">Caricamento bozze…</span>
          </div>
        ) : error ? (
          <div className="flex gap-2 items-center p-6 text-red-600 text-sm">
            <AlertTriangle size={16} /> {error}
          </div>
        ) : drafts.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            <ShoppingCart size={32} className="mx-auto mb-3 opacity-30" />
            Nessuna bozza — premi "Genera Bozze Ordine" per avviare il calcolo.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                {['ID', 'Fornitore', 'Negozio', 'Stato', 'Totale', 'Righe', ''].map(h => (
                  <th key={h} className={`px-4 py-3 ${h === 'Totale' ? 'text-right' : h === 'Stato' || h === 'Righe' ? 'text-center' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {drafts.map(d => (
                <DraftRow key={d.id} draft={d} onSelect={setSelectedId} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modale dettaglio ───────────────────────────────────────────── */}
      {selectedId && (
        <DraftModal
          draftId={selectedId}
          onClose={() => setSelectedId(null)}
          onApproved={loadDrafts}
          onDiscarded={loadDrafts}
        />
      )}
    </div>
  );
}
