import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { pos, orders as ordersApi, catalog, customers as customersApi, loyalty as loyaltyApi } from '../api.jsx';
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
  
  // Loyalty & Customer state
  const [customerSearch, setCustomerSearch] = useState('');
  const [allCustomers, setAllCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerPoints, setCustomerPoints] = useState(0);
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  
  const [options, setOptions] = useState({ employees: [], warehouses: [] });
  const [soldByEmployeeId, setSoldByEmployeeId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [expandedCats, setExpandedCats] = useState(['Generale']); // For accordions

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

      const [prodRes, optRes, custRes] = await Promise.all([
        catalog.getProducts(selectedStoreId ? { store_id: selectedStoreId, limit: 200 } : { limit: 200 }),
        ordersApi.getOptions(selectedStoreId ? { store_id: selectedStoreId } : {}),
        customersApi.getCustomers({ limit: 500 })
      ]);
      setProducts(prodRes.data?.data || []);
      setOptions({
        employees: optRes.data?.data?.employees || [],
        warehouses: optRes.data?.data?.warehouses || []
      });
      setAllCustomers(custRes.data?.data || []);
      if (optRes.data?.data?.warehouses?.length > 0 && !warehouseId) {
        setWarehouseId(optRes.data.data.warehouses[0].id);
      }
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
      await pos.open({ 
        store_id: selectedStoreId,
        opening_cash: parseFloat(openingAmount) || 0 
      });
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
  
  const pointsDiscount = usePoints ? Math.floor(pointsToRedeem / 100) * 5 : 0;
  const finalTotal = Math.max(0, cartTotal - pointsDiscount);

  useEffect(() => {
    if (selectedCustomer) {
      loyaltyApi.getWallet(selectedCustomer.id).then(res => {
        setCustomerPoints(res.data?.data?.points_balance || 0);
      }).catch(() => setCustomerPoints(0));
    } else {
      setCustomerPoints(0);
      setUsePoints(false);
      setPointsToRedeem(0);
    }
  }, [selectedCustomer]);

  useEffect(() => {
    // Auto-calculate redeemable points when usePoints is toggled or customer points change
    if (usePoints && selectedCustomer) {
      const maxRedeemableByWallet = Math.floor(customerPoints / 100) * 100;
      const amountNeeded = Math.ceil(cartTotal / 5) * 100;
      setPointsToRedeem(Math.min(maxRedeemableByWallet, amountNeeded));
    } else {
      setPointsToRedeem(0);
    }
  }, [usePoints, customerPoints, cartTotal]);

  const handlePlaceOrder = async (paymentMethod) => {
    if (!cartLines.length) return;
    try {
      if (!soldByEmployeeId) {
        setError('Seleziona il dipendente che sta effettuando la vendita (Venduto da).');
        return;
      }
      if (!warehouseId) {
        setError('Seleziona un magazzino di scarico.');
        return;
      }

      setPlacingOrder(true); setError('');
      const res = await ordersApi.place({
        channel: 'pos',
        store_id: selectedStoreId || undefined,
        warehouse_id: Number(warehouseId),
        employee_id: activeSession?.employee_id, // Who opened the session
        sold_by_employee_id: Number(soldByEmployeeId), // Who is making the sale
        status: 'paid',
        payment_method: paymentMethod,
        customer_id: selectedCustomer?.id,
        points_to_redeem: pointsToRedeem > 0 ? pointsToRedeem : undefined,
        lines: cartLines.map(l => ({ product_variant_id: l.product_variant_id, qty: l.qty })),
      });
      setLastOrder(res.data);
      setCartLines([]);
      setSelectedCustomer(null);
      setUsePoints(false);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nel piazzamento ordine');
    } finally { setPlacingOrder(false); }
  };

  const fmtCurrency = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);
  const fmtDate = v => v ? new Date(v).toLocaleString('it-IT') : '-';

  const categoryGroups = useMemo(() => {
    const groups = { 'Generale': ['All'] };
    products.forEach(p => {
      const type = p.product_type || 'Altro';
      if (!groups[type]) groups[type] = [];
      if (!groups[type].includes(type)) groups[type].push(type);
    });
    return groups;
  }, [products]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = activeCategory === 'All' || p.product_type === activeCategory;
    return matchesSearch && matchesCat;
  });

  const filteredCustomers = allCustomers.filter(c => {
    const term = customerSearch.toLowerCase();
    return c.first_name?.toLowerCase().includes(term) || c.last_name?.toLowerCase().includes(term) || c.email?.toLowerCase().includes(term);
  });

  const toggleCat = (cat) => {
    setExpandedCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

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

              {/* Quick Sale: Professional 3-Column Layout */}
              <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 380px', gap: 24, height: 'calc(100vh - 280px)', minHeight: 600 }}>
                
                {/* Column 1: Categories (Accordions) */}
                <div className="table-card" style={{ 
                  background: 'rgba(19, 32, 58, 0.4)', 
                  backdropFilter: 'blur(10px)', 
                  border: '1px solid var(--border)',
                  overflowY: 'auto',
                  padding: 12
                }}>
                  <div style={{ padding: '0 8px 16px', fontSize: 11, fontWeight: 700, color: 'var(--gold)', letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.7 }}>
                    Esplora Catalogo
                  </div>
                  
                  {Object.entries(categoryGroups).map(([group, items]) => (
                    <div key={group} style={{ marginBottom: 4 }}>
                      <button 
                        onClick={() => toggleCat(group)}
                        style={{ 
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px', background: 'var(--surface2)', border: 'none', borderRadius: 8,
                          color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      >
                        <span>{group}</span>
                        <span style={{ fontSize: 10, opacity: 0.5, transform: expandedCats.includes(group) ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                      </button>
                      
                      {expandedCats.includes(group) && (
                        <div style={{ padding: '4px 0 8px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {items.map(item => (
                            <button
                              key={item}
                              onClick={() => setActiveCategory(item)}
                              style={{
                                padding: '8px 12px', background: activeCategory === item ? 'var(--gold-glow)' : 'transparent',
                                border: 'none', borderRadius: 6, color: activeCategory === item ? 'var(--gold)' : 'var(--muted2)',
                                textAlign: 'left', fontSize: 12, fontWeight: 500, cursor: 'pointer'
                              }}
                            >
                              • {item}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Column 2: Product Grid (Premium Cards) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="table-card" style={{ padding: '12px 20px', border: 'none', background: 'var(--surface)' }}>
                    <div className="search-box" style={{ maxWidth: '100%', flex: 1, height: 44, background: 'var(--bg)', borderRadius: 12 }}>
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ opacity: 0.5 }}><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/></svg>
                      <input placeholder="Cerca prodottp o scansiona barcode..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ fontSize: 14 }} />
                    </div>
                  </div>

                  <div className="table-card" style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, padding: 20, overflowY: 'auto', background: 'transparent', border: 'none' }}>
                    {filteredProducts.map(p => {
                      const v = p.variants?.[0];
                      return (
                        <div key={p.id} onClick={() => addToCart(p)} className="kpi-card" style={{
                          padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12,
                          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative'
                        }} onMouseEnter={e => {
                          e.currentTarget.style.transform = 'translateY(-4px)';
                          e.currentTarget.style.borderColor = 'var(--gold-dim)';
                          e.currentTarget.style.boxShadow = '0 10px 30px rgba(201, 162, 39, 0.1)';
                        }} onMouseLeave={e => {
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}>
                          <div style={{ 
                            width: '100%', height: 120, background: 'var(--surface2)', borderRadius: 10, 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' 
                          }}>
                            {p.image_url ? (
                              <img src={p.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ opacity: 0.2, fontSize: 32 }}>📦</div>
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                              <span className="mono" style={{ color: 'var(--gold)', fontWeight: 800, fontSize: 16 }}>{fmtCurrency(v?.sale_price)}</span>
                              <span style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--surface2)', padding: '2px 6px', borderRadius: 4 }}>{v?.flavor || 'Standard'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Column 3: Cart (Glassmorphism Sidebar) */}
                <div style={{ 
                  display: 'flex', flexDirection: 'column', 
                  background: 'rgba(19, 32, 58, 0.6)', backdropFilter: 'blur(20px)',
                  borderLeft: '1px solid var(--gold-dim)', borderRadius: '24px 0 0 24px',
                  boxShadow: '-10px 0 30px rgba(0,0,0,0.5)', overflow: 'hidden'
                }}>
                  <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(201, 162, 39, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="section-title" style={{ color: 'var(--gold)', letterSpacing: 1 }}>Riepilogo Ordine</div>
                    <button onClick={() => setCartLines([])} style={{ background: 'transparent', border: 'none', color: 'var(--red)', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: 0.7 }}>SVUOTA</button>
                  </div>
                  
                  <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Customer Selection */}
                    <div style={{ position: 'relative' }}>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted2)', marginBottom: 6, textTransform: 'uppercase' }}>Cliente</label>
                      {selectedCustomer ? (
                        <div style={{ 
                          background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px', 
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          border: '1px solid var(--gold-dim)'
                        }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>{selectedCustomer.first_name} {selectedCustomer.last_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Saldo: <strong>{customerPoints} pt</strong> (≈ {fmtCurrency(customerPoints / 100 * 5)})</div>
                          </div>
                          <button onClick={() => setSelectedCustomer(null)} style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 10, fontWeight: 800 }}>X</button>
                        </div>
                      ) : (
                        <>
                          <div className="search-box" style={{ background: 'var(--bg)', borderRadius: 10, height: 40, border: '1px solid var(--border)' }}>
                            <input 
                              placeholder="Cerca cliente..." 
                              value={customerSearch} 
                              onChange={e => setCustomerSearch(e.target.value)} 
                              style={{ fontSize: 13 }} 
                            />
                          </div>
                          {customerSearch.length >= 2 && (
                            <div style={{ 
                              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                              marginTop: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                            }}>
                              {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                                <div key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }} style={{ 
                                  padding: '10px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                                  fontSize: 13, transition: 'background 0.2s'
                                }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  {c.first_name} {c.last_name} <span style={{ opacity: 0.5, fontSize: 11 }}>({c.email || 'no email'})</span>
                                </div>
                              )) : (
                                <div style={{ padding: 10, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>Nessun cliente trovato</div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Points Redemption Toggle */}
                    {selectedCustomer && customerPoints >= 100 && (
                      <div style={{ 
                        background: 'rgba(201, 162, 39, 0.05)', borderRadius: 10, padding: '12px 14px',
                        border: '1px solid' + (usePoints ? ' var(--gold)' : ' var(--border)'),
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: usePoints ? 'var(--gold)' : 'var(--text)' }}>Usa Punti Fidelity</div>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>Riscatta {pointsToRedeem} pt / -{fmtCurrency(pointsDiscount)}</div>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={usePoints} 
                          onChange={e => setUsePoints(e.target.checked)} 
                          style={{ width: 20, height: 20, cursor: 'pointer' }}
                        />
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted2)', marginBottom: 6, textTransform: 'uppercase' }}>Operatore</label>
                      <select 
                        value={soldByEmployeeId} 
                        onChange={e => setSoldByEmployeeId(e.target.value)}
                        style={{ 
                          width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', 
                          borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 13 
                        }}
                      >
                        <option value="">Chi sta effettuando la vendita?</option>
                        {options.employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
                    {cartLines.length > 0 ? cartLines.map(line => (
                      <div key={line.product_variant_id} style={{ 
                        display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0', 
                        borderBottom: '1px solid rgba(255,255,255,0.05)'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>{line.product_name}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted2)' }}>{fmtCurrency(line.sale_price)} × {line.qty}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
                          <button style={{ width: 24, height: 24, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 16 }} onClick={() => updateCartQty(line.product_variant_id, line.qty - 1)}>−</button>
                          <span className="mono" style={{ width: 30, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{line.qty}</span>
                          <button style={{ width: 24, height: 24, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 16 }} onClick={() => updateCartQty(line.product_variant_id, line.qty + 1)}>+</button>
                        </div>
                      </div>
                    )) : (
                      <div style={{ textAlign: 'center', padding: '100px 0', opacity: 0.2 }}>
                        <div style={{ fontSize: 60, marginBottom: 16 }}>🛒</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>Inizia ad aggiungere prodotti</div>
                      </div>
                    )}
                  </div>

                  <div style={{ padding: 24, background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(201, 162, 39, 0.2)' }}>
                    {usePoints && pointsDiscount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: 'var(--gold)' }}>
                        <span>Sconto Punti ({pointsToRedeem} pt)</span>
                        <span>-{fmtCurrency(pointsDiscount)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: 24 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted2)' }}>TOTALE DA PAGARE</span>
                      <span style={{ fontSize: 32, fontWeight: 800, color: 'white', fontFamily: 'Sora', textShadow: '0 0 20px rgba(201,162,39,0.3)' }}>{fmtCurrency(finalTotal)}</span>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <button 
                        className="btn btn-gold" 
                        style={{ height: 64, borderRadius: 12, fontSize: 14, fontWeight: 800, letterSpacing: 1 }} 
                        disabled={!cartLines.length || placingOrder} 
                        onClick={() => handlePlaceOrder('cash')}
                      >
                        💵 CONTANTI
                      </button>
                      <button 
                        className="btn btn-gold" 
                        style={{ height: 64, borderRadius: 12, fontSize: 14, fontWeight: 800, letterSpacing: 1 }} 
                        disabled={!cartLines.length || placingOrder} 
                        onClick={() => handlePlaceOrder('card')}
                      >
                        💳 CARTA
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
