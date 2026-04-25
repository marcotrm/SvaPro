import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { invoices, orders, stockTransfers } from '../api.jsx';
import { SkeletonTable } from '../components/Skeleton.jsx';
import DatePicker from '../components/DatePicker.jsx';
import {
  FileText, Plus, Download, Search, Filter,
  CreditCard, ChevronRight, FileDown,
  Clock, AlertCircle, CheckCircle2
} from 'lucide-react';

export default function InvoicesPage() {
  const { selectedStoreId, selectedStore } = useOutletContext();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeTab, setActiveTab] = useState('invoices');
  const [ddtList, setDdtList] = useState([]);
  const [ddtLoading, setDdtLoading] = useState(false);

  /* generate modal */
  const [showGen, setShowGen] = useState(false);
  const [ordersList, setOrdersList] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState('');
  const [generating, setGenerating] = useState(false);

  const fetchInvoices = async () => {
    try {
      setLoading(true); setError('');
      const params = {};
      if (selectedStoreId) params.store_id = selectedStoreId;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await invoices.list(params);
      setList(res.data?.data || []);
    } catch { setError('Errore nel caricamento fatture'); }
    finally { setLoading(false); }
  };

  const fetchDdt = async (status) => {
    try {
      setDdtLoading(true);
      const res = await stockTransfers.getAll({ status, limit: 200 });
      setDdtList(res.data?.data || []);
    } catch {} finally { setDdtLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'invoices') fetchInvoices();
    else if (activeTab === 'ddt')      fetchDdt('received');
    else if (activeTab === 'proforma') fetchDdt('in_transit');
  }, [activeTab, selectedStoreId]);

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
      setShowGen(false); setSelectedOrder('');
      fetchInvoices();
    } catch (err) {
      alert(err.response?.data?.message || 'Errore generazione fattura');
    } finally { setGenerating(false); }
  };

  const handleDownload = async (inv) => {
    try {
      const res = await invoices.download(inv.id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `${inv.invoice_number}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch { alert('Errore download fattura'); }
  };

  const printDdtInvoice = (t, isProforma = false) => {
    const w = window.open('', '_blank');
    const tipo = isProforma ? 'FATTURA PROFORMA' : 'FATTURA DDT';
    w.document.write(`<!DOCTYPE html><html><head>
<title>${tipo} ${t.ddt_number}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 32px; color: #111; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .sub { color:#888; font-size:13px; margin-bottom:24px; }
  .badge { display:inline-block; background:${isProforma?'#fef3c7':'#d1fae5'}; color:${isProforma?'#92400e':'#065f46'}; padding:2px 10px; border-radius:20px; font-size:12px; font-weight:700; margin-bottom:20px; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px; background:#f5f5f7; padding:16px; border-radius:8px; }
  .info-block h3 { font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#888; margin-bottom:4px; }
  .info-block p { font-size:14px; font-weight:600; }
  table { width:100%; border-collapse:collapse; }
  th { text-align:left; padding:8px 12px; font-size:11px; text-transform:uppercase; background:#f0f0f0; }
  td { padding:8px 12px; border-bottom:1px solid #eee; font-size:13px; }
  .footer { margin-top:40px; display:flex; justify-content:space-between; }
  .sign-box { border-top:1px solid #ccc; width:200px; text-align:center; padding-top:8px; font-size:12px; color:#666; }
</style></head><body>
<h1>${tipo}</h1>
<div class="sub">N. ${t.ddt_number} &nbsp;|&nbsp; Data: ${new Date(t.created_at).toLocaleString('it-IT')}</div>
<div class="badge">${isProforma ? 'PROFORMA — Non costituisce documento fiscale' : 'DOCUMENTO DI TRASPORTO RICEVUTO'}</div>
<div class="info-grid">
  <div class="info-block"><h3>Mittente</h3><p>${t.from_store_name}</p></div>
  <div class="info-block"><h3>Destinatario</h3><p>${t.to_store_name}</p></div>
  <div class="info-block"><h3>Stato</h3><p>${isProforma ? 'In Transito' : 'Ricevuto'}</p></div>
  <div class="info-block"><h3>Data Ricezione</h3><p>${t.received_at ? new Date(t.received_at).toLocaleDateString('it-IT') : '—'}</p></div>
  ${t.notes ? `<div class="info-block" style="grid-column:span 2"><h3>Note</h3><p>${t.notes}</p></div>` : ''}
</div>
<table>
  <thead><tr><th>Prodotto</th><th>Qtà Inviata</th><th>Qtà Ricevuta</th></tr></thead>
  <tbody>
    ${(t.items || []).map(i => `<tr><td>${i.product_name || ''}${i.flavor ? ' – ' + i.flavor : ''}</td><td>${i.quantity_sent}</td><td>${i.quantity_received ?? '—'}</td></tr>`).join('')}
  </tbody>
</table>
<div class="footer">
  <div class="sign-box">Firma Mittente</div>
  <div class="sign-box">Firma Destinatario</div>
</div>
</body></html>`);
    w.document.close(); w.print();
  };

  const filtered = list.filter(inv => {
    if (!search) return true;
    const q = search.toLowerCase();
    return inv.invoice_number?.toLowerCase().includes(q) || inv.customer_name?.toLowerCase().includes(q);
  });

  const totals = list.reduce((acc, inv) => acc + (inv.grand_total || 0), 0);

  if (loading && activeTab === 'invoices') return <SkeletonTable />;

  return (
    <div className="animate-v3 space-y-6 px-2 pb-10">

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { id: 'invoices', label: '📄 Fatture Vendita' },
          { id: 'ddt',      label: '🚚 DDT Attivi (Ricevuti)' },
          { id: 'proforma', label: '📝 Proforma (In Transito)' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-6 py-3 rounded-2xl font-black text-sm transition-all ${
              activeTab === t.id ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── DDT / Proforma Tab ── */}
      {(activeTab === 'ddt' || activeTab === 'proforma') && (
        <div className="card-v3 overflow-hidden">
          {ddtLoading ? <SkeletonTable /> : (
            <table className="table-v3">
              <thead><tr>
                <th>N. DDT</th><th>Tipo</th><th>Mittente ? Destinatario</th>
                <th>Articoli</th><th>Data</th><th className="text-right">Azioni</th>
              </tr></thead>
              <tbody>
                {ddtList.length > 0 ? ddtList.map(t => (
                  <tr key={t.id} className="group hover:bg-slate-50/50">
                    <td><span className="font-black text-slate-900">{t.ddt_number}</span></td>
                    <td>
                      <span className={`badge-v3 ${activeTab === 'ddt' ? 'badge-v3-emerald' : 'badge-v3-amber'}`}>
                        {activeTab === 'ddt' ? 'Fattura DDT' : 'Proforma'}
                      </span>
                    </td>
                    <td>
                      <span className="font-bold">{t.from_store_name}</span>
                      <span className="text-indigo-500 mx-2">?</span>
                      <span className="font-bold">{t.to_store_name}</span>
                    </td>
                    <td className="text-slate-500">{(t.items||[]).reduce((s,i) => s+(i.quantity_sent||0), 0)} pz</td>
                    <td className="text-slate-400 text-sm">
                      {t.received_at
                        ? new Date(t.received_at).toLocaleDateString('it-IT')
                        : new Date(t.sent_at||t.created_at).toLocaleDateString('it-IT')}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => printDdtInvoice(t, activeTab === 'proforma')}
                          className="flex items-center gap-2 bg-slate-50 text-slate-600 px-4 py-2.5 rounded-xl font-black text-xs hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                          <FileDown size={14} /> {activeTab === 'proforma' ? 'Stampa Proforma' : 'Stampa Fattura DDT'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="6" className="text-center py-16 text-slate-300">
                    {activeTab === 'ddt' ? 'Nessun DDT ricevuto.' : 'Nessun trasferimento in transito.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Fatture Vendita Tab ── */}
      {activeTab === 'invoices' && (<>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Documenti Fiscali</h1>
            <p className="text-slate-400 font-bold flex items-center gap-2">
              <FileText size={16} className="text-indigo-500" />
              {list.length} fatture emesse{selectedStore ? ` • ${selectedStore.name}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-v3 flex items-center gap-2 px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl text-slate-600 font-black hover:border-indigo-500 hover:text-indigo-500 transition-all shadow-sm">
              <Download size={18} /> Export CSV
            </button>
            <button className="btn-v3-primary flex items-center gap-2 px-8 py-4 rounded-2xl shadow-xl shadow-indigo-100" onClick={openGenerate}>
              <Plus size={20} strokeWidth={3} /> Genera Fattura
            </button>
          </div>
        </div>

        <div className="kpi-v3-grid">
          <div className="kpi-v3-card group">
            <div className="kpi-v3-icon bg-indigo-50 text-indigo-600"><FileText size={24} /></div>
            <div>
              <div className="kpi-v3-label">Fatture Totali</div>
              <div className="kpi-v3-value">{list.length}</div>
            </div>
          </div>
          <div className="kpi-v3-card">
            <div className="kpi-v3-icon bg-emerald-50 text-emerald-600"><CreditCard size={24} /></div>
            <div>
              <div className="kpi-v3-label">Volume Totale</div>
              <div className="kpi-v3-value text-emerald-600">€{totals.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-100 p-6 rounded-2xl flex items-center gap-4 text-red-600 font-bold">
            <AlertCircle size={20} /> {error}
            <button onClick={fetchInvoices} className="ml-auto text-xs underline uppercase tracking-widest font-black">Riprova</button>
          </div>
        )}

        <div className="card-v3 overflow-hidden border-[#F1F5F9] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.06)]">
          <div className="p-6 border-b border-slate-50 flex flex-col xl:flex-row xl:items-center gap-4 bg-white/50 backdrop-blur-xl">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <input type="text" placeholder="Cerca per numero fattura, cliente..."
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-6 py-3 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all outline-none"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div style={{ minWidth: 160 }}>
                <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Da..." />
              </div>
              <span className="text-slate-300 font-black">—</span>
              <div style={{ minWidth: 160 }}>
                <DatePicker value={dateTo} onChange={setDateTo} placeholder="A..." />
              </div>
              <button onClick={fetchInvoices} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-lg active:scale-95 flex items-center gap-2">
                <Filter size={16} /> Filtra
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table-v3">
              <thead><tr>
                <th>Documento</th><th>Data Emissione</th><th>Cliente</th><th>Status</th><th>Importo</th><th className="text-right">Azioni</th>
              </tr></thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black group-hover:scale-110 transition-transform">
                          <FileText size={18} />
                        </div>
                        <span className="text-sm font-black text-slate-900 tracking-tight uppercase">{inv.invoice_number}</span>
                      </div>
                    </td>
                    <td><span className="font-bold text-slate-700">{inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('it-IT') : '—'}</span></td>
                    <td><div className="font-black text-slate-900">{inv.customer_name || 'Cliente Occasionale'}</div></td>
                    <td><div className="badge-v3 badge-v3-emerald"><CheckCircle2 size={12} /> Consegnata</div></td>
                    <td><span className="font-black text-slate-900 text-lg">€{(inv.grand_total || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span></td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleDownload(inv)}
                          className="flex items-center gap-2 bg-slate-50 text-slate-600 px-4 py-2.5 rounded-xl font-black text-xs hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95">
                          <FileDown size={14} /> PDF
                        </button>
                        <button className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-95">
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="p-20 text-center flex flex-col items-center justify-center text-slate-200">
              <FileText size={64} strokeWidth={1} className="mb-4" />
              <p className="font-black text-xl tracking-tight text-slate-300">Nessuna fattura presente</p>
            </div>
          )}
        </div>

        {/* Generate Modal */}
        {showGen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
            <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl shadow-indigo-900/20 overflow-hidden">
              <div className="p-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white relative">
                <h3 className="text-2xl font-black tracking-tight mb-2">Genera Nuovo Documento</h3>
                <p className="text-slate-400 font-bold text-sm">Converti un ordine pagato in fattura ufficiale</p>
                <button onClick={() => setShowGen(false)} className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Seleziona l'ordine</label>
                  <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all outline-none appearance-none cursor-pointer"
                    value={selectedOrder} onChange={e => setSelectedOrder(e.target.value)}>
                    <option value="">— Scegli un ordine recente —</option>
                    {ordersList.map(o => (
                      <option key={o.id} value={o.id}>
                        #{String(o.id).padStart(4, '0')} • €{(o.grand_total || 0).toLocaleString('it-IT')} {o.customer ? ` • ${o.customer.last_name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bg-amber-50 border-2 border-amber-100 p-6 rounded-2xl flex gap-4 text-amber-700">
                  <AlertCircle size={20} className="shrink-0 mt-1" />
                  <div>
                    <p className="font-black text-sm">Nota SDI</p>
                    <p className="font-bold text-xs leading-relaxed">Assicurati che l'anagrafica cliente sia completa di Codice Fiscale o P.IVA.</p>
                  </div>
                </div>
              </div>
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-4">
                <button onClick={() => setShowGen(false)} className="px-6 py-3 font-black text-slate-400 hover:text-slate-600 transition-colors">Annulla</button>
                <button className="btn-v3-primary px-8 py-3 rounded-xl disabled:opacity-50" onClick={handleGenerate} disabled={generating || !selectedOrder}>
                  {generating ? 'Elaborazione...' : 'Genera Fattura'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>)}

    </div>
  );
}
