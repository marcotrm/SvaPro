import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { orders } from '../api.jsx';
import { OrdersSkeleton } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import OrderModal from '../components/OrderModal.jsx';

export default function OrdersPage() {
  const { selectedStoreId, selectedStore } = useOutletContext();
  const [ordersList, setOrdersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { fetchOrders(); }, [selectedStoreId]);

  const fetchOrders = async () => {
    try {
      setLoading(true); setError('');
      const response = await orders.getOrders(selectedStoreId ? { store_id: selectedStoreId } : {});
      setOrdersList(response.data.data || []);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento degli ordini');
    } finally { setLoading(false); }
  };

  const handleOpenModal = () => { setSelectedOrder(null); setShowModal(true); };
  const handleCloseModal = () => { setShowModal(false); setSelectedOrder(null); };
  const handleSaveOrder = async () => { await fetchOrders(); handleCloseModal(); };

  const statusLabel = { paid: 'Pagato', draft: 'Bozza', pending: 'Pendente' };
  const statusBadge = { paid: 'high', draft: 'mid', pending: 'low' };

  const filtered = statusFilter === 'all' ? ordersList
    : ordersList.filter(o => o.status === statusFilter);

  if (loading) return <OrdersSkeleton />;

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="page-head-title">Ordini</div>
          <div className="page-head-sub">
            {ordersList.length} ordini totali{selectedStore ? ` - Store: ${selectedStore.name}` : ''}
          </div>
        </div>
        <button className="btn btn-gold" onClick={handleOpenModal}>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuovo Ordine
        </button>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchOrders} />}

      {/* Table */}
      <div className="table-card">
        <div className="table-toolbar">
          {['all','paid','draft','pending'].map(s => (
            <button
              key={s}
              className={`filter-chip${statusFilter === s ? ' active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'Tutti' : statusLabel[s]}
            </button>
          ))}
          <span style={{fontSize:12,color:'var(--muted)',marginLeft:'auto'}}>
            {filtered.length} risultati
          </span>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Cliente</th>
              <th>Magazzino</th>
              <th>Totale</th>
              <th>Loyalty</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(order => (
              <tr key={order.id}>
                <td><span className="mono" style={{color:'var(--muted2)'}}>#{order.id}</span></td>
                <td style={{fontWeight:600,color:'var(--text)'}}>
                  {order.customer?.first_name} {order.customer?.last_name}
                </td>
                <td style={{color:'var(--muted2)'}}>{order.warehouse?.name || 'â€”'}</td>
                <td><span className="mono positive">â‚¬{order.grand_total?.toFixed(2)}</span></td>
                <td style={{color:'var(--amber)',fontFamily:'IBM Plex Mono, monospace',fontSize:13}}>
                  +{order.loyalty_points_awarded || 0} pt
                </td>
                <td>
                  <span className={`badge ${statusBadge[order.status] || 'mid'}`}>
                    <span className="badge-dot" />
                    {statusLabel[order.status] || order.status}
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="6" style={{textAlign:'center',padding:'40px 0',color:'var(--muted)'}}>
                  Nessun ordine trovato
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <OrderModal
          order={selectedOrder}
          selectedStoreId={selectedStoreId}
          onClose={handleCloseModal}
          onSave={handleSaveOrder}
        />
      )}
    </>
  );
}

