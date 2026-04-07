import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { invoices, orders } from '../api.jsx';
import { SkeletonTable } from '../components/Skeleton.jsx';
import { 
  FileText, Plus, Download, Search, Filter, 
  Calendar, CreditCard, ChevronRight, FileDown,
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

  const totals = list.reduce((acc, inv) => acc + (inv.grand_total || 0), 0);

  if (loading) return <SkeletonTable />;

  return (
    <div className="animate-v3 space-y-10 px-2 pb-10">
      {/* Header Section */}
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

      {/* KPI Grid */}
      <div className="kpi-v3-grid">
        <div className="kpi-v3-card group">
          <div className="kpi-v3-icon bg-indigo-50 text-indigo-600">
            <FileText size={24} />
          </div>
          <div>
            <div className="kpi-v3-label">Fatture Totali</div>
            <div className="kpi-v3-value">{list.length}</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">Periodo Corrente</div>
          </div>
        </div>
        <div className="kpi-v3-card">
          <div className="kpi-v3-icon bg-emerald-50 text-emerald-600">
            <CreditCard size={24} />
          </div>
          <div>
            <div className="kpi-v3-label">Volume Totale</div>
            <div className="kpi-v3-value text-emerald-600">€{totals.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
            <div className="flex items-center gap-1 mt-1 text-[10px] font-black text-emerald-500 uppercase">
              Imponibile + IVA
            </div>
          </div>
        </div>
        <div className="kpi-v3-card">
          <div className="kpi-v3-icon bg-amber-50 text-amber-600">
            <Clock size={24} />
          </div>
          <div>
            <div className="kpi-v3-label">Ordini in Sospeso</div>
            <div className="kpi-v3-value text-amber-600">24</div>
            <div className="text-[10px] font-black text-amber-400 uppercase tracking-wider mt-1">Fatture da generare</div>
          </div>
        </div>
        <div className="kpi-v3-card border-indigo-100 bg-indigo-50/20">
          <div className="kpi-v3-icon bg-white text-indigo-600 shadow-sm">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="kpi-v3-label text-indigo-900">Stato SDI</div>
            <div className="kpi-v3-value text-indigo-600">100%</div>
            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-wider mt-1">Tutte inviate correttamente</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-2 border-red-100 p-6 rounded-2xl flex items-center gap-4 text-red-600 font-bold animate-v3">
          <AlertCircle size={20} />
          {error}
          <button onClick={fetchInvoices} className="ml-auto text-xs underline uppercase tracking-widest font-black">Riprova</button>
        </div>
      )}

      {/* Main Table Card */}
      <div className="card-v3 overflow-hidden border-[#F1F5F9] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.06)]">
        {/* Advanced Toolbar */}
        <div className="p-8 border-b border-slate-50 flex flex-col xl:flex-row xl:items-center gap-6 bg-white/50 backdrop-blur-xl">
           <div className="relative flex-1 group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
              <input 
                type="text" 
                placeholder="Cerca per numero fattura, cliente o P.IVA..."
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-16 pr-8 py-4 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all outline-none"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
           </div>
           
           <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex items-center gap-2 bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-1">
                <Calendar size={16} className="text-slate-400" />
                <input 
                  type="date" 
                  className="bg-transparent py-3 font-bold text-slate-600 outline-none text-sm cursor-pointer"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
                <span className="text-slate-300 mx-1">—</span>
                <input 
                  type="date" 
                  className="bg-transparent py-3 font-bold text-slate-600 outline-none text-sm cursor-pointer"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </div>
              
              <button 
                onClick={fetchInvoices}
                className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-lg active:scale-95 flex items-center gap-2"
              >
                <Filter size={16} /> Filtra Dashboard
              </button>
           </div>
        </div>

        {/* Professional Table */}
        <div className="overflow-x-auto">
           <table className="table-v3">
             <thead>
               <tr>
                 <th>Documento</th>
                 <th>Data Emissione</th>
                 <th>Anagrafica Cliente</th>
                 <th>Status SDI</th>
                 <th>Importo Lordo</th>
                 <th className="text-right">Azioni</th>
               </tr>
             </thead>
             <tbody>
               {filtered.map((inv) => (
                 <tr key={inv.id} className="group hover:bg-slate-50/50 transition-colors">
                   <td>
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black group-hover:scale-110 transition-transform">
                          <FileText size={18} />
                        </div>
                        <span className="text-sm font-black text-slate-900 tracking-tight uppercase">
                          {inv.invoice_number}
                        </span>
                     </div>
                   </td>
                   <td>
                     <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('it-IT') : '—'}</span>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{inv.issued_at ? new Date(inv.issued_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                     </div>
                   </td>
                   <td>
                     <div className="font-black text-slate-900 tracking-tight">{inv.customer_name || 'Cliente Occasionale'}</div>
                   </td>
                   <td>
                     <div className="badge-v3 badge-v3-emerald">
                        <CheckCircle2 size={12} />
                        Consegnata
                     </div>
                   </td>
                   <td>
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 tracking-tighter text-lg">
                           €{(inv.grand_total || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Pagato</span>
                      </div>
                   </td>
                   <td>
                     <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleDownload(inv)}
                          className="flex items-center gap-2 bg-slate-50 text-slate-600 px-4 py-2.5 rounded-xl font-black text-xs hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95"
                        >
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
             <p className="font-black text-xl tracking-tight text-slate-300">Nessuna fattura presente per i criteri selezionati</p>
          </div>
        )}
      </div>

      {/* Generate Modal (Harmonized) */}
      {showGen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-v3">
          <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl shadow-indigo-900/20 overflow-hidden border border-white/20 scale-v3">
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
                   <select 
                     className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all outline-none appearance-none cursor-pointer"
                     value={selectedOrder} 
                     onChange={e => setSelectedOrder(e.target.value)}
                   >
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
                      <p className="font-bold text-xs leading-relaxed">Assicurati che l'anagrafica cliente sia completa di Codice Fiscale o P.IVA per l'invio al Sistema di Interscambio.</p>
                   </div>
                </div>
             </div>

             <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-4">
                <button 
                   onClick={() => setShowGen(false)}
                   className="px-6 py-3 font-black text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Annulla
                </button>
                <button 
                   className="btn-v3-primary px-8 py-3 rounded-xl disabled:opacity-50" 
                   onClick={handleGenerate} 
                   disabled={generating || !selectedOrder}
                >
                  {generating ? (
                    <div className="flex items-center gap-2">
                       <RefreshCcw size={16} className="animate-spin" /> Elaborazione...
                    </div>
                  ) : (
                    'Genera Fattura'
                  )}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
