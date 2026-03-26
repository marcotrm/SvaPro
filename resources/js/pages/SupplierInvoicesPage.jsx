import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supplierInvoices, suppliers as suppliersApi } from '../api.jsx';
import { SkeletonTable } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';

export default function SupplierInvoicesPage() {
  const { selectedStoreId } = useOutletContext();
  const [list, setList] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paidFilter, setPaidFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplier_id: '', invoice_number: '', document_type: 'TD01', causale: '', sezionale: '',
    payment_method: '', total_amount: '', tax_amount: '', issue_date: '', due_date: '', notes: '',
    lines: [{ description: '', qty: '', unit_price: '', tax_rate: '' }],
  });

  useEffect(() => { fetchAll(); }, [paidFilter]);

  const fetchAll = async () => {
    try {
      setLoading(true); setError('');
      const params = { limit: 200 };
      if (paidFilter !== 'all') params.is_paid = paidFilter === 'paid' ? 1 : 0;
      const [invRes, supRes] = await Promise.all([
        supplierInvoices.getAll(params),
        suppliersApi.getAll(),
      ]);
      setList(invRes.data?.data || []);
      setSuppliersList(supRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nel caricamento');
    } finally { setLoading(false); }
  };

  const handleCreate = async () => {
    try {
      setSaving(true); setError('');
      await supplierInvoices.create({
        ...form,
        lines: form.lines.filter(l => l.description && l.qty),
      });
      setShowForm(false);
      resetForm();
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nella creazione');
    } finally { setSaving(false); }
  };

  const handleMarkPaid = async (id) => {
    try {
      setError('');
      await supplierInvoices.markPaid(id);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nel pagamento');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Eliminare questa fattura passiva?')) return;
    try {
      await supplierInvoices.remove(id);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nella cancellazione');
    }
  };

  const resetForm = () => setForm({
    supplier_id: '', invoice_number: '', document_type: 'TD01', causale: '', sezionale: '',
    payment_method: '', total_amount: '', tax_amount: '', issue_date: '', due_date: '', notes: '',
    lines: [{ description: '', qty: '', unit_price: '', tax_rate: '' }],
  });

  const addLine = () => setForm({ ...form, lines: [...form.lines, { description: '', qty: '', unit_price: '', tax_rate: '' }] });
  const updateLine = (idx, field, val) => {
    const lines = [...form.lines];
    lines[idx] = { ...lines[idx], [field]: val };
    setForm({ ...form, lines });
  };

  const fmtDate = v => v ? new Date(v).toLocaleDateString('it-IT') : '-';
  const fmtCurrency = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);

  const filtered = list.filter(inv =>
    !searchTerm ||
    inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <SkeletonTable />;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head-title">Fatture Passive</div>
          <div className="page-head-sub">{list.length} fatture da fornitori</div>
        </div>
        <button className="btn btn-gold" onClick={() => { resetForm(); setShowForm(true); }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuova Fattura
        </button>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchAll} />}

      {showForm && (
        <div className="table-card" style={{ marginBottom: 16 }}>
          <div className="table-toolbar"><div className="section-title">Nuova Fattura Passiva</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, padding: '0 16px 12px' }}>
            <div>
              <label className="field-label">Fornitore *</label>
              <select className="field-input" value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">— seleziona —</option>
                {suppliersList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className="field-label">N. Fattura *</label><input className="field-input" value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} /></div>
            <div>
              <label className="field-label">Tipo Doc.</label>
              <select className="field-input" value={form.document_type} onChange={e => setForm({ ...form, document_type: e.target.value })}>
                <option value="TD01">TD01 - Fattura</option>
                <option value="TD04">TD04 - Nota Credito</option>
                <option value="TD24">TD24 - Differita</option>
              </select>
            </div>
            <div><label className="field-label">Causale</label><input className="field-input" value={form.causale} onChange={e => setForm({ ...form, causale: e.target.value })} /></div>
            <div><label className="field-label">Sezionale</label><input className="field-input" value={form.sezionale} onChange={e => setForm({ ...form, sezionale: e.target.value })} /></div>
            <div><label className="field-label">Metodo Pag.</label><input className="field-input" value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} /></div>
            <div><label className="field-label">Totale €</label><input className="field-input" type="number" step="0.01" value={form.total_amount} onChange={e => setForm({ ...form, total_amount: e.target.value })} /></div>
            <div><label className="field-label">IVA €</label><input className="field-input" type="number" step="0.01" value={form.tax_amount} onChange={e => setForm({ ...form, tax_amount: e.target.value })} /></div>
            <div><label className="field-label">Data Emissione</label><input className="field-input" type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} /></div>
            <div><label className="field-label">Scadenza</label><input className="field-input" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
            <div style={{ gridColumn: 'span 2' }}><label className="field-label">Note</label><input className="field-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div style={{ padding: '0 16px 8px' }}>
            <div className="section-title" style={{ fontSize: 12, marginBottom: 8 }}>Righe</div>
            {form.lines.map((line, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <input className="field-input" placeholder="Descrizione" value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} style={{ flex: 1 }} />
                <input className="field-input" placeholder="Qtà" type="number" value={line.qty} onChange={e => updateLine(idx, 'qty', e.target.value)} style={{ width: 80 }} />
                <input className="field-input" placeholder="Prezzo €" type="number" step="0.01" value={line.unit_price} onChange={e => updateLine(idx, 'unit_price', e.target.value)} style={{ width: 100 }} />
                <input className="field-input" placeholder="IVA %" type="number" value={line.tax_rate} onChange={e => updateLine(idx, 'tax_rate', e.target.value)} style={{ width: 80 }} />
              </div>
            ))}
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={addLine}>+ Aggiungi riga</button>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '8px 16px 16px' }}>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Annulla</button>
            <button className="btn btn-gold" disabled={saving || !form.supplier_id || !form.invoice_number} onClick={handleCreate}>{saving ? 'Salvataggio...' : 'Registra'}</button>
          </div>
        </div>
      )}

      <div className="table-card">
        <div className="table-toolbar">
          {['all', 'unpaid', 'paid'].map(s => (
            <button key={s} className={`filter-chip${paidFilter === s ? ' active' : ''}`} onClick={() => setPaidFilter(s)}>
              {s === 'all' ? 'Tutte' : s === 'paid' ? 'Pagate' : 'Da Pagare'}
            </button>
          ))}
          <input className="search-input" placeholder="Cerca fattura..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ maxWidth: 220, marginLeft: 'auto' }} />
        </div>
        <table>
          <thead>
            <tr>
              <th>N. Fattura</th>
              <th>Fornitore</th>
              <th>Tipo</th>
              <th>Totale</th>
              <th>IVA</th>
              <th>Pagata</th>
              <th>Emissione</th>
              <th>Scadenza</th>
              <th style={{ textAlign: 'right' }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(inv => (
              <tr key={inv.id}>
                <td className="mono" style={{ fontWeight: 600 }}>{inv.invoice_number || '-'}</td>
                <td style={{ color: 'var(--text)' }}>{inv.supplier_name || '-'}</td>
                <td className="mono">{inv.document_type || '-'}</td>
                <td className="mono">{fmtCurrency(inv.total_amount)}</td>
                <td className="mono">{fmtCurrency(inv.tax_amount)}</td>
                <td>
                  <span className={`badge ${inv.is_paid ? 'high' : 'low'}`}>
                    <span className="badge-dot" />{inv.is_paid ? 'Pagata' : 'Da Pagare'}
                  </span>
                </td>
                <td style={{ color: 'var(--muted2)' }}>{fmtDate(inv.issue_date)}</td>
                <td style={{ color: 'var(--muted2)' }}>{fmtDate(inv.due_date)}</td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                    {!inv.is_paid && (
                      <button className="btn btn-gold" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => handleMarkPaid(inv.id)}>Paga</button>
                    )}
                    {!inv.is_paid && (
                      <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px', color: '#ef4444' }} onClick={() => handleDelete(inv.id)}>Elimina</button>
                    )}
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>Nessuna fattura passiva trovata</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
