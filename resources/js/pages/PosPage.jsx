import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { pos, orders as ordersApi, catalog } from '../api.jsx';
import { SkeletonTable } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';

export default function PosPage() {
  const { selectedStoreId, selectedStore, storesList } = useOutletContext();
  const [activeSession, setActiveSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('cassa'); // 'cassa' | 'sessioni'
  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');

  // Quick sale state
  const [products, setProducts] = useState([]);
  const [cartLines, setCartLines] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);

  useEffect(() => { fetchData(); }, [selectedStoreId]);

  const fetchData = async () => {
    try {
      setLoading(true); setError('');
      const [activeRes, sessionsRes] = await Promise.all([
        pos.getActive(),
        pos.getSessions({ limit: 50 }),
      ]);
      setActiveSession(activeRes.data?.data || null);
      setSessions(sessionsRes.data?.data || []);

      // Load products for quick sale
      const prodRes = await catalog.getProducts(selectedStoreId ? { store_id: selectedStoreId, limit: 200 } : { limit: 200 });
      setProducts(prodRes.data?.data || []);
    } catch (err) {
      if (err.response?.status !== 404) {
        setError(err.response?.data?.message || err.message || 'Errore nel caricamento');
      } else {
        setActiveSession(null);
      }
    } finally { setLoading(false); }
  };

  const handleOpenSession = async () => {
    try {
      setOpening(true); setError('');
      await pos.open({ opening_amount: parseFloat(openingAmount) || 0 });
      setOpeningAmount('');
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nell\'apertura');
    } finally { setOpening(false); }
  };

  const handleCloseSession = async () => {
    if (!activeSession) return;
    if (!confirm('Chiudere la sessione POS corrente?')) return;
    try {
      setClosing(true); setError('');
      await pos.close(activeSession.id);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nella chiusura');
    } finally { setClosing(false); }
  };

  const addToCart = (product) => {
    const variant = product.variants?.[0];
    if (!variant) return;
    const existing = cartLines.find(l => l.product_variant_id === variant.id);
    if (existing) {
      setCartLines(cartLines.map(l => l.product_variant_id === variant.id ? { ...l, qty: l.qty + 1 } : l));
    } else {
      setCartLines([...cartLines, {
        product_variant_id: variant.id,
        product_name: product.name,
        flavor: variant.flavor || '',
        sale_price: parseFloat(variant.sale_price) || 0,
        qty: 1,
      }]);
    }
  };

  const updateCartQty = (variantId, qty) => {
    if (qty <= 0) {
      setCartLines(cartLines.filter(l => l.product_variant_id !== variantId));
    } else {
      setCartLines(cartLines.map(l => l.product_variant_id === variantId ? { ...l, qty } : l));
    }
  };

  const cartTotal = cartLines.reduce((sum, l) => sum + l.sale_price * l.qty, 0);

  const handlePlaceOrder = async (paymentMethod) => {
    if (!cartLines.length) return;
    try {
      setPlacingOrder(true); setError('');
      const res = await ordersApi.place({
        channel: 'pos',
        store_id: selectedStoreId || undefined,
        warehouse_id: undefined,
        status: 'paid',
        payment_method: paymentMethod,
        lines: cartLines.map(l => ({ product_variant_id: l.product_variant_id, qty: l.qty })),
      });
      setLastOrder(res.data);
      setCartLines([]);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nel piazzamento ordine');
    } finally { setPlacingOrder(false); }
  };

  const fmtCurrency = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);
  const fmtDate = v => v ? new Date(v).toLocaleString('it-IT') : '-';

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <SkeletonTable />;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head-title">Punto Cassa (POS)</div>
          <div className="page-head-sub">
            {activeSession ? `Sessione attiva #${activeSession.id}` : 'Nessuna sessione attiva'}
            {selectedStore ? ` - ${selectedStore.name}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn ${tab === 'cassa' ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setTab('cassa')}>Cassa</button>
          <button className={`btn ${tab === 'sessioni' ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setTab('sessioni')}>Sessioni</button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchData} />}

      {tab === 'cassa' && (
        <>
          {/* Session Controls */}
          {!activeSession ? (
            <div className="table-card" style={{ padding: 24, textAlign: 'center' }}>
              <p style={{ marginBottom: 16, color: 'var(--muted)' }}>Nessuna sessione POS aperta. Apri una sessione per iniziare a vendere.</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' }}>
                <input className="field-input" type="number" step="0.01" placeholder="Fondo cassa €" value={openingAmount} onChange={e => setOpeningAmount(e.target.value)} style={{ width: 140 }} />
                <button className="btn btn-gold" disabled={opening} onClick={handleOpenSession}>
                  {opening ? 'Apertura...' : 'Apri Sessione'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Active Session Info */}
              <div className="kpi-grid" style={{ marginBottom: 16 }}>
                <div className="kpi-card">
                  <div className="kpi-label">Sessione</div>
                  <div className="kpi-value">#{activeSession.id}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Fondo Cassa</div>
                  <div className="kpi-value">{fmtCurrency(activeSession.opening_amount)}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Vendite</div>
                  <div className="kpi-value gold">{activeSession.orders_count || 0}</div>
                </div>
                <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={handleCloseSession}>
                  <div className="kpi-label">Azione</div>
                  <div className="kpi-value red" style={{ fontSize: 14 }}>{closing ? 'Chiusura...' : 'Chiudi Cassa'}</div>
                </div>
              </div>

              {/* Last order confirmation */}
              {lastOrder && (
                <div className="banner banner-success" style={{ marginBottom: 16 }}>
                  <span className="banner-icon">✓</span>
                  <div className="banner-text">
                    Ordine <strong>#{lastOrder.order_id}</strong> registrato — {fmtCurrency(lastOrder.totals?.grand_total)}
                    {lastOrder.has_stock_alert && <span style={{ color: '#ef4444', marginLeft: 8 }}>⚠ Alert stock generato</span>}
                  </div>
                  <button className="banner-action" onClick={() => setLastOrder(null)}>Chiudi</button>
                </div>
              )}

              {/* Quick Sale: Products + Cart */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
                {/* Product Grid */}
                <div className="table-card">
                  <div className="table-toolbar">
                    <input className="search-input" placeholder="Cerca prodotto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ maxWidth: 280 }} />
                    <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>{filteredProducts.length} prodotti</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, padding: 12, maxHeight: 480, overflow: 'auto' }}>
                    {filteredProducts.map(p => {
                      const v = p.variants?.[0];
                      return (
                        <div key={p.id} onClick={() => addToCart(p)} style={{
                          padding: '12px 10px', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer',
                          transition: 'border-color .15s', textAlign: 'center', fontSize: 13,
                        }} onMouseEnter={e => e.currentTarget.style.borderColor = '#c9a227'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                          <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                          {v?.flavor && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{v.flavor}</div>}
                          <div style={{ fontWeight: 700, color: '#c9a227', marginTop: 4 }}>{fmtCurrency(v?.sale_price)}</div>
                        </div>
                      );
                    })}
                    {!filteredProducts.length && (
                      <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Nessun prodotto</div>
                    )}
                  </div>
                </div>

                {/* Cart */}
                <div className="table-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="table-toolbar"><div className="section-title">Carrello</div></div>
                  <div style={{ flex: 1, overflow: 'auto', padding: '0 12px' }}>
                    {cartLines.length > 0 ? cartLines.map(line => (
                      <div key={line.product_variant_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{line.product_name}</div>
                          {line.flavor && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{line.flavor}</div>}
                          <div style={{ fontSize: 12, color: '#c9a227' }}>{fmtCurrency(line.sale_price)} × {line.qty}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 14 }} onClick={() => updateCartQty(line.product_variant_id, line.qty - 1)}>−</button>
                          <span className="mono" style={{ minWidth: 20, textAlign: 'center' }}>{line.qty}</span>
                          <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 14 }} onClick={() => updateCartQty(line.product_variant_id, line.qty + 1)}>+</button>
                        </div>
                      </div>
                    )) : (
                      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>Carrello vuoto</div>
                    )}
                  </div>
                  <div style={{ borderTop: '2px solid var(--border)', padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontWeight: 700, fontSize: 18 }}>
                      <span>Totale</span>
                      <span style={{ color: '#c9a227' }}>{fmtCurrency(cartTotal)}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <button className="btn btn-gold" disabled={!cartLines.length || placingOrder} onClick={() => handlePlaceOrder('cash')}>
                        {placingOrder ? '...' : '💵 Contanti'}
                      </button>
                      <button className="btn btn-gold" disabled={!cartLines.length || placingOrder} onClick={() => handlePlaceOrder('card')}>
                        {placingOrder ? '...' : '💳 Carta'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Sessions History */}
      {tab === 'sessioni' && (
        <div className="table-card">
          <div className="table-toolbar">
            <div className="section-title">Storico Sessioni</div>
            <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>{sessions.length} sessioni</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Operatore</th>
                <th>Store</th>
                <th>Fondo</th>
                <th>Vendite</th>
                <th>Incasso</th>
                <th>Stato</th>
                <th>Aperta</th>
                <th>Chiusa</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length > 0 ? sessions.map(s => (
                <tr key={s.id}>
                  <td className="mono">#{s.id}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>{s.user_name || '-'}</td>
                  <td>{s.store_name || '-'}</td>
                  <td className="mono">{fmtCurrency(s.opening_amount)}</td>
                  <td className="mono">{s.orders_count || 0}</td>
                  <td className="mono positive">{fmtCurrency(s.total_revenue)}</td>
                  <td>
                    <span className={`badge ${s.closed_at ? 'high' : 'mid'}`}>
                      <span className="badge-dot" />{s.closed_at ? 'Chiusa' : 'Aperta'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--muted2)' }}>{fmtDate(s.opened_at || s.created_at)}</td>
                  <td style={{ color: 'var(--muted2)' }}>{fmtDate(s.closed_at)}</td>
                </tr>
              )) : (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>Nessuna sessione trovata</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
