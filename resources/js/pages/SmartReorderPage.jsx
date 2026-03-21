import React, { useState, useEffect } from 'react';
import { inventory } from '../api.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';

export default function SmartReorderPage() {
  const [alerts, setAlerts] = useState([]);
  const [suggestedOrders, setSuggestedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRun, setLoadingRun] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { fetchPreview(); }, []);

  const fetchPreview = async () => {
    try {
      setLoading(true); setError('');
      const response = await inventory.getSmartReorderPreview();
      setAlerts(response.data.alerts || []);
      setSuggestedOrders(response.data.suggested_orders || []);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento della preview');
    } finally { setLoading(false); }
  };

  const handleRunSmartReorder = async () => {
    try {
      setLoadingRun(true); setError(''); setSuccess('');
      const response = await inventory.runSmartReorder();
      setSuccess(`${response.data.orders_created || 0} ordine/i creato/i con successo`);
      setTimeout(() => { fetchPreview(); setSuccess(''); }, 3000);
    } catch (err) {
      setError(err.message || "Errore nell'esecuzione dello smart reorder");
    } finally { setLoadingRun(false); }
  };

  const totalCost = suggestedOrders.reduce((s, o) => s + (o.suggested_qty * o.unit_cost), 0);

  if (loading) return <LoadingSpinner />;

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="page-head-title">Smart Inventory Reorder</div>
          <div className="page-head-sub">Gestione automatica degli ordini di magazzino</div>
        </div>
        <button
          className="btn btn-gold"
          onClick={handleRunSmartReorder}
          disabled={loadingRun || alerts.length === 0}
          style={{opacity: (loadingRun || alerts.length === 0) ? .5 : 1, cursor: (loadingRun || alerts.length === 0) ? 'not-allowed' : 'pointer'}}
        >
          {loadingRun ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{animation:'spin 1s linear infinite'}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              Esecuzione...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Esegui Reorder
            </>
          )}
        </button>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchPreview} />}

      {success && (
        <div className="banner banner-success">
          <svg className="banner-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span className="banner-text"><strong>Completato:</strong> {success}</span>
        </div>
      )}

      {/* Alert info banner */}
      <div className="banner banner-warn">
        <svg className="banner-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <div className="banner-text">
          <strong>Stock Basso Rilevato:</strong> {alerts.length} prodotto/i con stock inferiore alla soglia di riordino
        </div>
      </div>

      {/* Alerts table */}
      <div className="table-card">
        <div className="table-toolbar">
          <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>Avvisi Stock Basso</span>
          <span className="badge low" style={{marginLeft:8}}>{alerts.length}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Magazzino</th>
              <th>Prodotto</th>
              <th>Disponibile</th>
              <th>Soglia</th>
              <th>Venduto (30gg)</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length > 0 ? alerts.map((alert, idx) => (
              <tr key={idx}>
                <td style={{fontWeight:600,color:'var(--text)'}}>{alert.store_name}</td>
                <td style={{color:'var(--muted2)'}}>{alert.product_name}</td>
                <td><span className="mono negative">{alert.on_hand}</span> <span style={{color:'var(--muted)',fontSize:12}}>un.</span></td>
                <td><span className="mono" style={{color:'var(--amber)'}}>{alert.reorder_point}</span> <span style={{color:'var(--muted)',fontSize:12}}>un.</span></td>
                <td><span className="mono" style={{color:'var(--muted2)'}}>{alert.sold_qty || 0}</span> <span style={{color:'var(--muted)',fontSize:12}}>un.</span></td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" style={{textAlign:'center',padding:'40px 0',color:'var(--muted)'}}>
                  Nessun avviso stock basso
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Suggested orders table */}
      <div className="table-card">
        <div className="table-toolbar">
          <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>Ordini Suggeriti</span>
          <span className="badge mid" style={{marginLeft:8}}>{suggestedOrders.length}</span>
          {suggestedOrders.length > 0 && (
            <span style={{marginLeft:'auto',fontSize:13,fontWeight:700,color:'var(--gold)',fontFamily:'IBM Plex Mono, monospace'}}>
              Totale: â‚¬{totalCost.toFixed(2)}
            </span>
          )}
        </div>
        <table>
          <thead>
            <tr>
              <th>Magazzino</th>
              <th>Fornitore</th>
              <th>Prodotto</th>
              <th>QuantitÃ </th>
              <th>Costo unitario</th>
              <th>Totale</th>
            </tr>
          </thead>
          <tbody>
            {suggestedOrders.length > 0 ? suggestedOrders.map((order, idx) => (
              <tr key={idx}>
                <td style={{fontWeight:600,color:'var(--text)'}}>{order.store_name}</td>
                <td style={{color:'var(--muted2)'}}>{order.supplier_name}</td>
                <td style={{color:'var(--muted2)'}}>{order.product_name}</td>
                <td><span className="mono" style={{color:'var(--text)'}}>{order.suggested_qty}</span></td>
                <td><span className="mono" style={{color:'var(--muted2)'}}>â‚¬{order.unit_cost?.toFixed(2)}</span></td>
                <td><span className="mono positive">â‚¬{(order.suggested_qty * order.unit_cost)?.toFixed(2)}</span></td>
              </tr>
            )) : (
              <tr>
                <td colSpan="6" style={{textAlign:'center',padding:'40px 0',color:'var(--muted)'}}>
                  Nessun ordine suggerito
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

