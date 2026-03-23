import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { inventory } from '../api.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import InventoryMovementModal from '../components/InventoryMovementModal.jsx';

export default function InventoryPage() {
  const { user } = useOutletContext();
  const [stock, setStock] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [showMovementModal, setShowMovementModal] = useState(false);

  useEffect(() => { fetchStockAndMovements(); }, []);
  useEffect(() => { fetchMovements(); }, [searchTerm, movementTypeFilter, warehouseFilter, dateFromFilter, dateToFilter]);

  const fetchStockAndMovements = async () => {
    try {
      setLoading(true); setError('');
      const [stockResponse, movementsResponse] = await Promise.all([
        inventory.getStock(),
        inventory.getMovements(),
      ]);
      setStock(stockResponse.data.data || []);
      setMovements(movementsResponse.data.data || []);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento dello stock');
    } finally { setLoading(false); }
  };

  const fetchMovements = async () => {
    try {
      const response = await inventory.getMovements({
        q: searchTerm || undefined,
        movement_type: movementTypeFilter || undefined,
        warehouse_id: warehouseFilter || undefined,
        date_from: dateFromFilter || undefined,
        date_to: dateToFilter || undefined,
      });
      setMovements(response.data.data || []);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento dei movimenti');
    }
  };

  const lowCount = stock.filter(i => i.on_hand < i.reorder_point).length;
  const filtered = filterLowStock ? stock.filter(i => i.on_hand < i.reorder_point) : stock;
  const warehouses = Array.from(new Map(stock.map(item => [item.warehouse_id, { id: item.warehouse_id, name: item.warehouse_name }])).values());
  const movementTypes = Array.from(new Set(movements.map(item => item.movement_type))).filter(Boolean).sort();

  const formatDateTime = value => value ? new Date(value).toLocaleString('it-IT') : '-';
  const userRoles = user?.roles || [];
  const canAdjustInventory = userRoles.includes('superadmin') || userRoles.includes('admin_cliente');

  const handleSavedMovement = async () => {
    await fetchStockAndMovements();
    setShowMovementModal(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="page-head-title">Magazzino</div>
          <div className="page-head-sub">{stock.length} referenze - {lowCount} in stock basso</div>
        </div>
        <button
          className={`filter-chip${filterLowStock ? ' active' : ''}`}
          onClick={() => setFilterLowStock(v => !v)}
          style={{cursor:'pointer'}}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Solo stock basso
        </button>
        {canAdjustInventory && (
          <button className="btn btn-gold" onClick={() => setShowMovementModal(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nuovo Movimento
          </button>
        )}
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchStockAndMovements} />}

      {/* Low stock banner */}
      {lowCount > 0 && (
        <div className="banner banner-warn">
          <svg className="banner-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div className="banner-text">
            <strong>Stock basso rilevato:</strong> {lowCount} articolo/i sotto il punto di riordino
          </div>
        </div>
      )}

      {/* Table */}
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Prodotto</th>
              <th>Magazzino</th>
              <th>Disponibile</th>
              <th>Riservato</th>
              <th>Punto Riordino</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(item => {
              const isLow = item.on_hand < item.reorder_point;
              const pct = item.reorder_point > 0 ? Math.min(item.on_hand / item.reorder_point, 1) : 1;
              return (
                <tr key={item.id}>
                  <td style={{fontWeight:600,color:'var(--text)'}}>
                    {item.product_name}
                    {item.flavor && (
                      <span style={{color:'var(--muted2)',fontWeight:400}}> - {item.flavor}</span>
                    )}
                  </td>
                  <td style={{color:'var(--muted2)'}}>{item.warehouse_name}</td>
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <span className={`mono ${isLow ? 'negative' : 'positive'}`}>{item.available}</span>
                      <div style={{width:48,height:3,background:'var(--border)',borderRadius:2,overflow:'hidden'}}>
                        <div style={{width:`${pct*100}%`,height:'100%',background: isLow ? 'var(--red)' : 'var(--green)',borderRadius:2}} />
                      </div>
                    </div>
                  </td>
                  <td className="mono" style={{color:'var(--muted2)'}}>{item.reserved}</td>
                  <td className="mono" style={{color:'var(--muted2)'}}>{item.reorder_point}</td>
                  <td>
                    <span className={`badge ${isLow ? 'low' : 'high'}`}>
                      <span className="badge-dot" />
                      {isLow ? 'Stock Basso' : 'OK'}
                    </span>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan="6" style={{textAlign:'center',padding:'40px 0',color:'var(--muted)'}}>
                  {filterLowStock ? 'Nessun articolo in stock basso' : 'Nessun articolo trovato'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="table-card" style={{marginTop: 20}}>
        <div className="table-toolbar" style={{gap: 10, flexWrap: 'wrap'}}>
          <div className="search-box" style={{minWidth: 240}}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--muted)',flexShrink:0}}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              placeholder="Cerca per prodotto, SKU o causale..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <select className="form-select" style={{maxWidth: 200}} value={movementTypeFilter} onChange={e => setMovementTypeFilter(e.target.value)}>
            <option value="">Tutte le causali</option>
            {movementTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <select className="form-select" style={{maxWidth: 220}} value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}>
            <option value="">Tutti i magazzini</option>
            {warehouses.map(warehouse => (
              <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
            ))}
          </select>

          <input className="form-select" type="date" value={dateFromFilter} onChange={e => setDateFromFilter(e.target.value)} style={{maxWidth: 170}} />
          <input className="form-select" type="date" value={dateToFilter} onChange={e => setDateToFilter(e.target.value)} style={{maxWidth: 170}} />

          <span style={{fontSize:12,color:'var(--muted)',marginLeft:'auto'}}>{movements.length} movimenti</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Prodotto</th>
              <th>Magazzino</th>
              <th>Causale</th>
              <th>Quantita</th>
              <th>Operatore</th>
              <th>Riferimento</th>
            </tr>
          </thead>
          <tbody>
            {movements.length > 0 ? movements.map(item => (
              <tr key={item.id}>
                <td style={{color:'var(--muted2)'}}>{formatDateTime(item.occurred_at)}</td>
                <td style={{fontWeight:600,color:'var(--text)'}}>
                  {item.product_name}
                  {item.flavor ? <span style={{color:'var(--muted2)',fontWeight:400}}> - {item.flavor}</span> : null}
                </td>
                <td style={{color:'var(--muted2)'}}>{item.warehouse_name}</td>
                <td><span className="badge mid"><span className="badge-dot" />{item.movement_type}</span></td>
                <td><span className={`mono ${item.qty < 0 ? 'negative' : 'positive'}`}>{item.qty > 0 ? `+${item.qty}` : item.qty}</span></td>
                <td style={{color:'var(--muted2)'}}>{item.actor_name || 'Sistema'}</td>
                <td className="mono" style={{color:'var(--muted2)'}}>{item.reference_type ? `${item.reference_type}:${item.reference_id || '-'}` : '-'}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="7" style={{textAlign:'center',padding:'40px 0',color:'var(--muted)'}}>
                  Nessun movimento trovato con i filtri selezionati
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showMovementModal && (
        <InventoryMovementModal
          stock={stock}
          onClose={() => setShowMovementModal(false)}
          onSaved={handleSavedMovement}
        />
      )}
    </>
  );
}
