import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { returns } from '../api.jsx';
import { SkeletonTable } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';

export default function ReturnsPage() {
  const { selectedStoreId, selectedStore } = useOutletContext();
  const [list, setList] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('list'); // 'list' | 'analytics'
  const [form, setForm] = useState({ order_id: '', reason: '', notes: '', lines: [{ product_variant_id: '', qty: '', condition: 'good' }] });

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

  const fetchAnalytics = async () => {
    try {
      setLoading(true); setError('');
      const params = {};
      if (selectedStoreId) params.store_id = selectedStoreId;
      const res = await returns.getAnalytics(params);
      setAnalytics(res.data?.data || res.data || null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nel caricamento analytics');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (tab === 'analytics') fetchAnalytics(); }, [tab, selectedStoreId]);

  const handleCreate = async () => {
    try {
      setSaving(true); setError('');
      await returns.create({
        ...form,
        lines: form.lines.filter(l => l.product_variant_id && l.qty),
      });
      setShowForm(false);
      setForm({ order_id: '', reason: '', notes: '', lines: [{ product_variant_id: '', qty: '', condition: 'good' }] });
      await fetchList();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nella creazione del reso');
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (returnId, newStatus) => {
    try {
      setError('');
      await returns.updateStatus(returnId, newStatus);
      await fetchList();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nel cambio stato');
    }
  };

  const addLine = () => setForm({ ...form, lines: [...form.lines, { product_variant_id: '', qty: '', condition: 'good' }] });
  const updateLine = (idx, field, val) => {
    const lines = [...form.lines];
    lines[idx] = { ...lines[idx], [field]: val };
    setForm({ ...form, lines });
  };

  const fmtDate = v => v ? new Date(v).toLocaleDateString('it-IT') : '-';
  const fmtCurrency = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);

  const statusLabels = { requested: 'Richiesto', approved: 'Approvato', refunded: 'Rimborsato', rejected: 'Rifiutato', exchanged: 'Scambiato' };
  const statusClass = s => s === 'refunded' || s === 'approved' ? 'high' : s === 'rejected' ? 'low' : 'mid';

  if (loading && tab === 'list') return <SkeletonTable />;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head-title">Resi & Rimborsi</div>
          <div className="page-head-sub">{list.length} resi{selectedStore ? ` - Store: ${selectedStore.name}` : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn ${tab === 'list' ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setTab('list')}>Lista</button>
          <button className={`btn ${tab === 'analytics' ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setTab('analytics')}>Analytics</button>
          {tab === 'list' && (
            <button className="btn btn-gold" onClick={() => setShowForm(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nuovo Reso
            </button>
          )}
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={tab === 'list' ? fetchList : fetchAnalytics} />}

      {/* Analytics Tab */}
      {tab === 'analytics' && analytics && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Totale Resi</div>
              <div className="kpi-value">{analytics.total_returns ?? 0}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Valore Rimborsato</div>
              <div className="kpi-value gold">{fmtCurrency(analytics.total_refunded_value)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Tasso Reso</div>
              <div className="kpi-value">{analytics.return_rate ? `${analytics.return_rate}%` : '-'}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Motivo Più Freq.</div>
              <div className="kpi-value" style={{ fontSize: 16 }}>{analytics.top_reason || '-'}</div>
            </div>
          </div>
          {analytics.by_reason?.length > 0 && (
            <div className="table-card">
              <div className="table-toolbar"><div className="section-title">Per Motivo</div></div>
              <table>
                <thead><tr><th>Motivo</th><th>Conteggio</th><th>Valore</th></tr></thead>
                <tbody>
                  {analytics.by_reason.map((r, i) => (
                    <tr key={i}><td>{r.reason || '-'}</td><td className="mono">{r.count}</td><td className="mono">{fmtCurrency(r.total_value)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* List Tab */}
      {tab === 'list' && (
        <>
          {showForm && (
            <div className="table-card" style={{ marginBottom: 16 }}>
              <div className="table-toolbar"><div className="section-title">Nuovo Reso</div></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, padding: '0 16px 12px' }}>
                <div><label className="field-label">Ordine ID *</label><input className="field-input" value={form.order_id} onChange={e => setForm({ ...form, order_id: e.target.value })} /></div>
                <div><label className="field-label">Motivo</label><input className="field-input" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
                <div><label className="field-label">Note</label><input className="field-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <div style={{ padding: '0 16px 8px' }}>
                <div className="section-title" style={{ fontSize: 12, marginBottom: 8 }}>Articoli</div>
                {form.lines.map((line, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <input className="field-input" placeholder="Variante ID" value={line.product_variant_id} onChange={e => updateLine(idx, 'product_variant_id', e.target.value)} style={{ width: 120 }} />
                    <input className="field-input" placeholder="Qtà" type="number" value={line.qty} onChange={e => updateLine(idx, 'qty', e.target.value)} style={{ width: 80 }} />
                    <select className="field-input" value={line.condition} onChange={e => updateLine(idx, 'condition', e.target.value)} style={{ width: 120 }}>
                      <option value="good">Buono</option>
                      <option value="damaged">Danneggiato</option>
                      <option value="defective">Difettoso</option>
                    </select>
                  </div>
                ))}
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={addLine}>+ Aggiungi articolo</button>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '8px 16px 16px' }}>
                <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Annulla</button>
                <button className="btn btn-gold" disabled={saving || !form.order_id} onClick={handleCreate}>{saving ? 'Salvataggio...' : 'Crea Reso'}</button>
              </div>
            </div>
          )}

          <div className="table-card">
            <div className="table-toolbar">
              {['all', 'requested', 'approved', 'refunded', 'rejected'].map(s => (
                <button key={s} className={`filter-chip${statusFilter === s ? ' active' : ''}`} onClick={() => setStatusFilter(s)}>
                  {s === 'all' ? 'Tutti' : statusLabels[s]}
                </button>
              ))}
              <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>{list.length} risultati</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ordine</th>
                  <th>Cliente</th>
                  <th>Motivo</th>
                  <th>Stato</th>
                  <th>Valore</th>
                  <th>Data</th>
                  <th style={{ textAlign: 'right' }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {list.length > 0 ? list.map(r => (
                  <tr key={r.id}>
                    <td className="mono">#{r.id}</td>
                    <td className="mono">#{r.order_id || r.sales_order_id || '-'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text)' }}>{r.customer_name || '-'}</td>
                    <td>{r.reason || '-'}</td>
                    <td><span className={`badge ${statusClass(r.status)}`}><span className="badge-dot" />{statusLabels[r.status] || r.status}</span></td>
                    <td className="mono">{fmtCurrency(r.refund_amount || r.total_value)}</td>
                    <td style={{ color: 'var(--muted2)' }}>{fmtDate(r.created_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                        {r.status === 'requested' && (
                          <>
                            <button className="btn btn-gold" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => handleStatusChange(r.id, 'approved')}>Approva</button>
                            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px', color: '#ef4444' }} onClick={() => handleStatusChange(r.id, 'rejected')}>Rifiuta</button>
                          </>
                        )}
                        {r.status === 'approved' && (
                          <>
                            <button className="btn btn-gold" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => handleStatusChange(r.id, 'refunded')}>Rimborsa</button>
                            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => handleStatusChange(r.id, 'exchanged')}>Scambio</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>Nessun reso trovato</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
