import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { purchaseOrders, suppliers as suppliersApi } from '../api.jsx';
import { SkeletonTable } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';

export default function PurchaseOrdersPage() {
  const { selectedStoreId, selectedStore } = useOutletContext();
  const [list, setList] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ supplier_id: '', store_id: '', warehouse_id: '', notes: '', lines: [{ product_variant_id: '', qty: '', unit_cost: '' }] });

  useEffect(() => { fetchAll(); }, [selectedStoreId, statusFilter]);

  const fetchAll = async () => {
    try {
      setLoading(true); setError('');
      const params = { limit: 200 };
      if (selectedStoreId) params.store_id = selectedStoreId;
      if (statusFilter !== 'all') params.status = statusFilter;
      const [poRes, supRes] = await Promise.all([
        purchaseOrders.getAll(params),
        suppliersApi.getAll(),
      ]);
      setList(poRes.data?.data || []);
      setSuppliersList(supRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nel caricamento');
    } finally { setLoading(false); }
  };

  const handleCreate = async () => {
    try {
      setSaving(true); setError('');
      const payload = {
        ...form,
        store_id: form.store_id || selectedStoreId || undefined,
        lines: form.lines.filter(l => l.product_variant_id && l.qty),
      };
      await purchaseOrders.create(payload);
      setShowForm(false);
      setForm({ supplier_id: '', store_id: '', warehouse_id: '', notes: '', lines: [{ product_variant_id: '', qty: '', unit_cost: '' }] });
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nella creazione');
    } finally { setSaving(false); }
  };

  const handleAction = async (poId, action) => {
    try {
      setActionLoading(`${poId}-${action}`); setError('');
      if (action === 'send') await purchaseOrders.send(poId);
      if (action === 'receive') await purchaseOrders.receive(poId);
      if (action === 'cancel') await purchaseOrders.cancel(poId);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || err.message || `Errore nell'azione ${action}`);
    } finally { setActionLoading(null); }
  };

  const handleShowDetail = async (poId) => {
    try {
      const res = await purchaseOrders.getOne(poId);
      setDetail(res.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nel caricamento dettaglio');
    }
  };

  const addLine = () => setForm({ ...form, lines: [...form.lines, { product_variant_id: '', qty: '', unit_cost: '' }] });
  const updateLine = (idx, field, val) => {
    const lines = [...form.lines];
    lines[idx] = { ...lines[idx], [field]: val };
    setForm({ ...form, lines });
  };
  const removeLine = (idx) => setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) });

  const fmtDate = v => v ? new Date(v).toLocaleDateString('it-IT') : '-';
  const fmtCurrency = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);

  const statusLabels = { draft: 'Bozza', sent: 'Inviato', received: 'Ricevuto', cancelled: 'Annullato', partial: 'Parziale' };
  const statusClass = s => s === 'received' ? 'high' : s === 'cancelled' ? 'low' : s === 'sent' ? 'mid' : '';

  const filtered = list.filter(po =>
    !searchTerm || po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    po.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <SkeletonTable />;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head-title">Ordini di Acquisto</div>
          <div className="page-head-sub">{list.length} ordini{selectedStore ? ` - Store: ${selectedStore.name}` : ''}</div>
        </div>
        <button className="btn btn-gold" onClick={() => setShowForm(true)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuovo PO
        </button>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchAll} />}

      {/* Detail Modal */}
      {detail && (
        <div className="table-card" style={{ marginBottom: 16 }}>
          <div className="table-toolbar">
            <div className="section-title">Dettaglio PO #{detail.po_number || detail.id}</div>
            <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={() => setDetail(null)}>Chiudi</button>
          </div>
          <div style={{ padding: '0 16px 12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, fontSize: 13 }}>
            <div><strong>Fornitore:</strong> {detail.supplier_name || '-'}</div>
            <div><strong>Store:</strong> {detail.store_name || '-'}</div>
            <div><strong>Stato:</strong> {statusLabels[detail.status] || detail.status}</div>
            <div><strong>Totale:</strong> {fmtCurrency(detail.total)}</div>
            <div><strong>Creato:</strong> {fmtDate(detail.created_at)}</div>
            <div><strong>Sorgente:</strong> {detail.source || '-'}</div>
          </div>
          {detail.lines?.length > 0 && (
            <table style={{ fontSize: 13 }}>
              <thead><tr><th>Variante ID</th><th>Qtà</th><th>Costo Unit.</th><th>Totale</th></tr></thead>
              <tbody>
                {detail.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="mono">#{l.product_variant_id}</td>
                    <td>{l.qty}</td>
                    <td>{fmtCurrency(l.unit_cost)}</td>
                    <td>{fmtCurrency(l.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="table-card" style={{ marginBottom: 16 }}>
          <div className="table-toolbar"><div className="section-title">Nuovo Ordine di Acquisto</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, padding: '0 16px 12px' }}>
            <div>
              <label className="field-label">Fornitore *</label>
              <select className="field-input" value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">— seleziona —</option>
                {suppliersList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className="field-label">Note</label><input className="field-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div style={{ padding: '0 16px 8px' }}>
            <div className="section-title" style={{ fontSize: 12, marginBottom: 8 }}>Righe ordine</div>
            {form.lines.map((line, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <input className="field-input" placeholder="Variante ID" value={line.product_variant_id} onChange={e => updateLine(idx, 'product_variant_id', e.target.value)} style={{ width: 120 }} />
                <input className="field-input" placeholder="Qtà" type="number" value={line.qty} onChange={e => updateLine(idx, 'qty', e.target.value)} style={{ width: 80 }} />
                <input className="field-input" placeholder="Costo €" type="number" step="0.01" value={line.unit_cost} onChange={e => updateLine(idx, 'unit_cost', e.target.value)} style={{ width: 100 }} />
                {form.lines.length > 1 && (
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px', color: '#ef4444' }} onClick={() => removeLine(idx)}>✕</button>
                )}
              </div>
            ))}
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={addLine}>+ Aggiungi riga</button>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '8px 16px 16px' }}>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Annulla</button>
            <button className="btn btn-gold" disabled={saving || !form.supplier_id} onClick={handleCreate}>{saving ? 'Salvataggio...' : 'Crea PO'}</button>
          </div>
        </div>
      )}

      <div className="table-card">
        <div className="table-toolbar">
          {['all', 'draft', 'sent', 'received', 'cancelled'].map(s => (
            <button key={s} className={`filter-chip${statusFilter === s ? ' active' : ''}`} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'Tutti' : statusLabels[s]}
            </button>
          ))}
          <input className="search-input" placeholder="Cerca PO..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ maxWidth: 220, marginLeft: 'auto' }} />
        </div>
        <table>
          <thead>
            <tr>
              <th>PO #</th>
              <th>Fornitore</th>
              <th>Store</th>
              <th>Stato</th>
              <th>Totale</th>
              <th>Sorgente</th>
              <th>Creato</th>
              <th style={{ textAlign: 'right' }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(po => (
              <tr key={po.id}>
                <td><span className="mono" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => handleShowDetail(po.id)}>#{po.po_number || po.id}</span></td>
                <td style={{ fontWeight: 600, color: 'var(--text)' }}>{po.supplier_name || '-'}</td>
                <td>{po.store_name || '-'}</td>
                <td><span className={`badge ${statusClass(po.status)}`}><span className="badge-dot" />{statusLabels[po.status] || po.status}</span></td>
                <td className="mono">{fmtCurrency(po.total)}</td>
                <td>{po.source === 'auto_reorder' ? <span className="badge high"><span className="badge-dot" />Auto</span> : (po.source || 'Manuale')}</td>
                <td style={{ color: 'var(--muted2)' }}>{fmtDate(po.created_at)}</td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                    {po.status === 'draft' && (
                      <button className="btn btn-gold" style={{ fontSize: 11, padding: '4px 10px' }} disabled={actionLoading === `${po.id}-send`} onClick={() => handleAction(po.id, 'send')}>
                        {actionLoading === `${po.id}-send` ? '...' : 'Invia'}
                      </button>
                    )}
                    {po.status === 'sent' && (
                      <button className="btn btn-gold" style={{ fontSize: 11, padding: '4px 10px' }} disabled={actionLoading === `${po.id}-receive`} onClick={() => handleAction(po.id, 'receive')}>
                        {actionLoading === `${po.id}-receive` ? '...' : 'Ricevi'}
                      </button>
                    )}
                    {['draft', 'sent'].includes(po.status) && (
                      <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px', color: '#ef4444' }} disabled={actionLoading === `${po.id}-cancel`} onClick={() => handleAction(po.id, 'cancel')}>
                        {actionLoading === `${po.id}-cancel` ? '...' : 'Annulla'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>Nessun ordine di acquisto trovato</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
