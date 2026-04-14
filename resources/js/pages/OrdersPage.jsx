import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { orders, getOfflineSalesQueueSize, onOfflineSalesQueueChanged, syncOfflineSalesNow } from '../api.jsx';
import { OrdersSkeleton } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import OrderModal from '../components/OrderModal.jsx';
import { 
  Plus, 
  Search, 
  Filter, 
  RefreshCw, 
  TrendingUp, 
  ShoppingCart, 
  CreditCard,
  ChevronRight,
  MoreHorizontal
} from 'lucide-react';

export default function OrdersPage() {
  const { selectedStoreId, selectedStore } = useOutletContext();
  const [ordersList, setOrdersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [suppliersList, setSuppliersList] = useState([]);
  const [offlineQueueSize, setOfflineQueueSize] = useState(getOfflineSalesQueueSize());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncingOffline, setSyncingOffline] = useState(false);

  useEffect(() => { fetchOrders(); }, [selectedStoreId, supplierFilter, typeFilter]);

  useEffect(() => {
    const fetchSelectData = async () => {
      try {
        const { suppliers } = await import('../api.jsx');
        const suppRes = await suppliers.getAll();
        setSuppliersList(suppRes.data?.data || []);
      } catch (err) { }
    };
    fetchSelectData();
  }, []);

  useEffect(() => {
    const unsubscribe = onOfflineSalesQueueChanged((size) => setOfflineQueueSize(size));
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true); setError('');
      const params = { limit: 500 };
      if (selectedStoreId) params.store_id = selectedStoreId;
      if (supplierFilter) params.supplier_id = supplierFilter;
      if (typeFilter) params.product_type = typeFilter;
      
      const response = await orders.getOrders(params);
      setOrdersList(response.data.data || []);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento degli ordini');
    } finally { setLoading(false); }
  };

  const handleOpenModal = () => { setSelectedOrder(null); setShowModal(true); };
  const handleCloseModal = () => { setShowModal(false); setSelectedOrder(null); };
  const handleSaveOrder = async () => { await fetchOrders(); handleCloseModal(); };

  const handleSyncOffline = async () => {
    try {
      setSyncingOffline(true);
      const result = await syncOfflineSalesNow();
      setOfflineQueueSize(result.remaining);
      if (result.synced > 0) {
        await fetchOrders();
      }
    } finally {
      setSyncingOffline(false);
    }
  };

  const statusLabel = { paid: 'Completato', draft: 'Bozza', pending: 'In Attesa' };
  const statusClass = { paid: 'badge-v3-success', draft: 'badge-v3-neutral', pending: 'badge-v3-warning' };

  const filtered = statusFilter === 'all' ? ordersList
    : ordersList.filter(o => o.status === statusFilter);

  const totalRevenue = ordersList.reduce((acc, curr) => acc + (curr.grand_total || 0), 0);
  const avgOrder = ordersList.length > 0 ? (totalRevenue / ordersList.length).toFixed(2) : 0;

  if (loading) return <OrdersSkeleton />;

  return (
    <div className="space-y-10 animate-v3 pb-20">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Cronologia Vendite</h1>
          <p className="text-sm font-bold text-slate-400 mt-1">Gestione flussi di vendita e terminali</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
             <div className="w-2 h-2 rounded-full bg-green animate-pulse" />
             <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{selectedStore?.name || 'Global Terminal'}</span>
          </div>
          <button className="btn-v3-primary" onClick={handleOpenModal}>
            <Plus size={20} strokeWidth={3} />
            <span>Nuova Vendita</span>
          </button>
        </div>
      </div>

      {/* ── KPI Widgets ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-v3 metric-card-v3 bg-charcoal text-white">
          <div className="flex items-center justify-between mb-4">
             <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-accent"><TrendingUp size={20} /></div>
             <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Revenue</span>
          </div>
          <div className="text-3xl font-black">€{totalRevenue.toLocaleString()}</div>
          <p className="text-[10px] font-bold text-emerald-400 mt-2 uppercase tracking-widest">+12.4% vs last week</p>
        </div>

        <div className="card-v3 metric-card-v3">
          <div className="flex items-center justify-between mb-4">
             <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400"><ShoppingCart size={20} /></div>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Volume</span>
          </div>
          <div className="text-3xl font-black text-slate-900">{ordersList.length}</div>
          <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">Active transactions</p>
        </div>

        <div className="card-v3 metric-card-v3">
          <div className="flex items-center justify-between mb-4">
             <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400"><CreditCard size={20} /></div>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AOV</span>
          </div>
          <div className="text-3xl font-black text-slate-900">€{avgOrder}</div>
          <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">Average Order Value</p>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchOrders} />}

      {offlineQueueSize > 0 && (
        <div className="card-v3 !p-6 bg-amber-50 border-amber-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600"><RefreshCw className={syncingOffline ? 'animate-spin' : ''} size={20} /></div>
             <div>
                <p className="text-sm font-black text-amber-900">{offlineQueueSize} vendita/e in coda offline.</p>
                <p className="text-xs font-bold text-amber-700/60 uppercase racking-widest">
                   {isOnline ? 'Pronti per la sincronizzazione istantanea.' : 'In attesa di connessione stabile...'}
                </p>
             </div>
          </div>
          {isOnline && (
            <button className="btn-v3-primary !bg-amber-600 !shadow-amber-600/20" onClick={handleSyncOffline} disabled={syncingOffline}>
              {syncingOffline ? 'Syncing...' : 'Sincronizza Ora'}
            </button>
          )}
        </div>
      )}

      {/* ── Main Order Table ── */}
      <div className="card-v3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-10">
           <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
              {['all','paid','draft','pending'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap 
                    ${statusFilter === s ? 'bg-charcoal text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                >
                  {s === 'all' ? 'Tutte le Vendite' : statusLabel[s]}
                </button>
              ))}
           </div>
           
           <div className="flex items-center gap-3">
              <div className="relative group">
                 <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                 <input type="text" placeholder="Cerca ordine or cliente..." className="input-v3 !py-2.5 !pl-10 !text-xs !w-64" />
              </div>
              <button className="w-11 h-11 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-500 transition-all"><Filter size={18} /></button>
           </div>
        </div>

        <div className="table-v3-container">
          <table className="table-v3">
            <thead>
              <tr>
                <th>ID Ordine</th>
                <th>Operatore/Cliente</th>
                <th>Magazzino</th>
                <th>Data Acquisizione</th>
                <th>Punti Loyalty</th>
                <th>Totale</th>
                <th>Stato</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map(order => (
                <tr key={order.id} onClick={() => { setSelectedOrder(order); setShowModal(true); }} className="cursor-pointer">
                  <td>
                    <div className="flex items-center gap-3">
                       <span className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-400">#</span>
                       <span className="text-sm font-black text-slate-900">{order.id}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col">
                       <span className="text-sm font-black text-slate-900">{order.customer?.first_name} {order.customer?.last_name || 'Generic Client'}</span>
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{order.employee?.name || 'Main POS Terminal'}</span>
                    </div>
                  </td>
                  <td><span className="text-xs font-bold text-slate-500">{order.warehouse?.name || '—'}</span></td>
                  <td><span className="text-xs font-bold text-slate-500">{new Date(order.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'})}</span></td>
                  <td>
                    <div className="flex items-center gap-2 text-indigo-500 font-black text-xs">
                       <TrendingUp size={14} />
                       +{order.loyalty_points_awarded || 0} pts
                    </div>
                  </td>
                  <td><span className="text-sm font-black text-slate-900">€{order.grand_total?.toFixed(2)}</span></td>
                  <td>
                    <span className={`badge-v3 ${statusClass[order.status] || 'badge-v3-neutral'}`}>
                      {statusLabel[order.status] || order.status}
                    </span>
                  </td>
                  <td className="text-right">
                    <button className="w-10 h-10 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-300 hover:text-slate-900 transition-all">
                       <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="8" className="!py-20 text-center">
                    <div className="flex flex-col items-center">
                       <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 mb-4"><ShoppingCart size={32} /></div>
                       <p className="text-sm font-black text-slate-400 uppercase tracking-[2px]">Nessuna vendita nel database</p>
                       <p className="text-xs font-bold text-slate-300 mt-1">Modifica i filtri o registra una nuova vendita dal POS.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <OrderModal
          order={selectedOrder}
          selectedStoreId={selectedStoreId}
          onClose={handleCloseModal}
          onSave={handleSaveOrder}
        />
      )}
    </div>
  );
}

