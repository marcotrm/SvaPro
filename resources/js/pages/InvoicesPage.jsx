import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { invoices, orders } from '../api.jsx';
import { SkeletonTable } from '../components/Skeleton.jsx';

export default function InvoicesPage() {
  const { selectedStoreId } = useOutletContext();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  /* generate modal */
  const [showGen, setShowGen] = useState(false);
  const [ordersList, setOrdersList] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => { fetchInvoices(); }, [selectedStoreId]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (selectedStoreId) params.store_id = selectedStoreId;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await invoices.list(params);
      setList(res.data?.data || []);
    } catch {
      setError('Errore nel caricamento fatture');
    } finally {
      setLoading(false);
    }
  };

  const openGenerate = async () => {
    setShowGen(true);
    try {
      const res = await orders.getOrders({ store_id: selectedStoreId, limit: 50, status: 'paid' });
      setOrdersList(res.data?.data || []);
    } catch { setOrdersList([]); }
  };

  const handleGenerate = async () => {
    if (!selectedOrder) return;
    try {
      setGenerating(true);
      await invoices.generate(selectedOrder);
      setShowGen(false);
      setSelectedOrder('');
      fetchInvoices();
    } catch (err) {
      alert(err.response?.data?.message || 'Errore generazione fattura');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (inv) => {
    try {
      const res = await invoices.download(inv.id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${inv.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Errore download fattura');
    }
  };

  const filtered = list.filter(inv => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.customer_name?.toLowerCase().includes(q)
    );
  });

  if (loading) return <SkeletonTable />;

  return (
    <>
      <div className="section-header">
        <div className="section-title">
          Fatture
          <span className="section-subtitle"> — {list.length} documenti</span>
        </div>
        <button className="btn btn-gold" onClick={openGenerate}>
          <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"/></svg>
          Genera Fattura
        </button>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div className="search-box">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style={{ color: 'var(--muted)', flexShrink: 0 }}>
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
            </svg>
            <input
              placeholder="Cerca per numero fattura o cliente…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <input type="date" className="filter-chip" value={dateFrom} onChange={e => { setDateFrom(e.target.value); }} style={{ minWidth: 130 }} />
          <input type="date" className="filter-chip" value={dateTo} onChange={e => { setDateTo(e.target.value); }} style={{ minWidth: 130 }} />
          <button className="btn btn-ghost" onClick={fetchInvoices} style={{ fontSize: 12 }}>Filtra</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Numero</th>
              <th>Data</th>
              <th>Cliente</th>
              <th>Totale</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(inv => (
              <tr key={inv.id}>
                <td><span className="mono">{inv.invoice_number}</span></td>
                <td>{inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('it-IT') : '—'}</td>
                <td style={{ fontWeight: 500, color: 'var(--text)' }}>{inv.customer_name || '—'}</td>
                <td>
                  <span className="mono positive">
                    €{(inv.grand_total || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </td>
                <td>
                  <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => handleDownload(inv)}>
                    PDF ↓
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)' }}>
                  Nessuna fattura trovata
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error && (
        <div className="alert-banner" style={{ borderColor: 'rgba(230,76,60,.4)', marginTop: 16 }}>
          <span className="icon">✕</span>
          <span>{error}</span>
        </div>
      )}

      {/* Generate Modal */}
      {showGen && (
        <div className="modal-overlay" onClick={() => setShowGen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Genera Fattura da Ordine</h3>
              <button className="modal-close" onClick={() => setShowGen(false)}>×</button>
            </div>
            <div className="modal-body">
              <label className="form-label">Seleziona Ordine Pagato</label>
              <select className="form-input" value={selectedOrder} onChange={e => setSelectedOrder(e.target.value)}>
                <option value="">— seleziona —</option>
                {ordersList.map(o => (
                  <option key={o.id} value={o.id}>
                    #{String(o.id).padStart(4, '0')} — €{(o.grand_total || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    {o.customer ? ` — ${o.customer.first_name} ${o.customer.last_name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowGen(false)}>Annulla</button>
              <button className="btn btn-gold" onClick={handleGenerate} disabled={generating || !selectedOrder}>
                {generating ? 'Generazione…' : 'Genera Fattura'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
