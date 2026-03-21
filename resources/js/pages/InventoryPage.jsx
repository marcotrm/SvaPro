import React, { useState, useEffect } from 'react';
import { inventory } from '../api.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';

export default function InventoryPage() {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);

  useEffect(() => { fetchStock(); }, []);

  const fetchStock = async () => {
    try {
      setLoading(true); setError('');
      const response = await inventory.getStock();
      setStock(response.data.data || []);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento dello stock');
    } finally { setLoading(false); }
  };

  const lowCount = stock.filter(i => i.on_hand < i.reorder_point).length;
  const filtered = filterLowStock ? stock.filter(i => i.on_hand < i.reorder_point) : stock;

  if (loading) return <LoadingSpinner />;

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="page-head-title">Magazzino</div>
          <div className="page-head-sub">{stock.length} referenze â€” {lowCount} in stock basso</div>
        </div>
        <button
          className={`filter-chip${filterLowStock ? ' active' : ''}`}
          onClick={() => setFilterLowStock(v => !v)}
          style={{cursor:'pointer'}}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Solo stock basso
        </button>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchStock} />}

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
                    {item.product_variant?.product?.name}
                    {item.product_variant?.name && (
                      <span style={{color:'var(--muted2)',fontWeight:400}}> â€” {item.product_variant.name}</span>
                    )}
                  </td>
                  <td style={{color:'var(--muted2)'}}>{item.warehouse?.name}</td>
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <span className={`mono ${isLow ? 'negative' : 'positive'}`}>{item.on_hand}</span>
                      <div style={{width:48,height:3,background:'var(--border)',borderRadius:2,overflow:'hidden'}}>
                        <div style={{width:`${pct*100}%`,height:'100%',background: isLow ? 'var(--red)' : 'var(--green)',borderRadius:2}} />
                      </div>
                    </div>
                  </td>
                  <td className="mono" style={{color:'var(--muted2)'}}>{item.reserved || 0}</td>
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
    </>
  );
}
