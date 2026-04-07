import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { orders as ordersApi, catalog, customers as customersApi, inventory } from '../api.jsx';
import { 
  Search, Plus, Minus, Trash2, CreditCard, Banknote, 
  ShoppingCart, X, User, MapPin, ChevronDown, ListRestart
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import PosCheckoutModal from '../components/PosCheckoutModal.jsx';

export default function PosPage() {
  const { selectedStoreId, displayMode, user } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Products & categories
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Cart
  const [cartLines, setCartLines] = useState([]);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Options
  const [stockMap, setStockMap] = useState({});
  const [warehouseId, setWarehouseId] = useState('');
  const [soldByEmployeeId, setSoldByEmployeeId] = useState('');
  const [employees, setEmployees] = useState([]);
  const [note, setNote] = useState('');

  // Customer
  const [allCustomers, setAllCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  useEffect(() => { fetchData(); }, [selectedStoreId]);

  const fetchData = async () => {
    try {
      setLoading(true); setError('');
      const sp = selectedStoreId ? { store_id: selectedStoreId } : {};
      const [pRes, cRes, aRes, oRes, stRes] = await Promise.all([
        catalog.getProducts({ ...sp, limit: 500 }),
        catalog.getCategories(),
        customersApi.getCustomers({ limit: 1000 }),
        ordersApi.getOptions(sp),
        inventory.getStock({ ...sp, limit: 2000 })
      ]);

      setProducts(pRes.data?.data || []);

      const allCats = cRes.data?.data || [];
      setCategories(allCats.filter(c => !c.parent_id));
      setSubCategories(allCats.filter(c => c.parent_id));

      setAllCustomers(aRes.data?.data || []);
      setEmployees(oRes.data?.data?.employees || []);
      
      const warehouses = oRes.data?.data?.warehouses || [];
      if (warehouses.length > 0) setWarehouseId(warehouses[0].id);

      const smap = {};
      (stRes.data?.data || []).forEach(si => { smap[si.product_variant_id] = si; });
      setStockMap(smap);

    } catch (err) {
      setError('Errore caricamento dati POS');
      console.error(err);
    } finally { setLoading(false); }
  };

  const addToCart = (product) => {
    const variant = product.variants?.[0];
    if (!variant) return;
    
    const existing = cartLines.find(l => l.product_variant_id === variant.id);

    if (existing) {
      setCartLines(cartLines.map(l => 
        l.product_variant_id === variant.id ? { ...l, qty: l.qty + 1 } : l
      ));
    } else {
      setCartLines([...cartLines, { 
        product_variant_id: variant.id, 
        name: product.name, 
        sku: product.sku,
        price: parseFloat(variant.sale_price) || 0, 
        qty: 1,
        location: variant.location || '',
      }]);
    }
    toast.success(`${product.name} aggiunto`, { duration: 1000 });
  };

  const updateQty = (variantId, delta) => {
    setCartLines(cartLines.map(l => {
      if (l.product_variant_id !== variantId) return l;
      const newQty = l.qty + delta;
      return newQty <= 0 ? null : { ...l, qty: newQty };
    }).filter(Boolean));
  };

  const removeFromCart = (variantId) => {
    setCartLines(cartLines.filter(l => l.product_variant_id !== variantId));
  };

  const cartTotal = useMemo(() => {
    return cartLines.reduce((sum, l) => sum + l.price * l.qty, 0);
  }, [cartLines]);

  const cartCount = useMemo(() => {
    return cartLines.reduce((sum, l) => sum + l.qty, 0);
  }, [cartLines]);

  const [showProductInfo, setShowProductInfo] = useState(null);

  const handleAdvancedCheckout = async (payload) => {
    if (!cartLines.length) return toast.error('Carrello vuoto');
    if (!soldByEmployeeId) return toast.error('Seleziona un operatore');
    
    try {
      setPlacingOrder(true);
      await ordersApi.place({
        channel: 'pos',
        store_id: selectedStoreId,
        warehouse_id: Number(warehouseId),
        sold_by_employee_id: Number(soldByEmployeeId),
        customer_id: selectedCustomer?.id,
        lines: cartLines.map(l => ({ 
          product_variant_id: l.product_variant_id, 
          qty: l.qty 
        })),
        notes: note + (payload.receipt_type ? ` [Stampa: ${payload.receipt_type}]` : ''),
        status: 'paid',
        payments: payload.payments,
        order_discount_amount: payload.order_discount_amount
      });
      toast.success('Vendita completata con successo!');
      setCartLines([]);
      setSelectedCustomer(null);
      setNote('');
      setShowCheckoutModal(false);
      fetchData();
    } catch (err) { 
      toast.error(err.response?.data?.message || 'Errore durante il pagamento');
    } finally { setPlacingOrder(false); }
  };

  const clearSession = (level) => {
    setCartLines([]);
    if (level === 'all') {
      setSelectedCustomer(null);
      setNote('');
    }
    setShowClearConfirm(false);
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const s = searchTerm.toLowerCase();
      const matchSearch = !s || p.name?.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s);
      const matchCat = !activeCategory || p.category_id === activeCategory;
      return matchSearch && matchCat;
    });
  }, [products, searchTerm, activeCategory]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return allCustomers.slice(0, 10);
    const s = customerSearch.toLowerCase();
    return allCustomers.filter(c => 
      c.name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s)
    ).slice(0, 10);
  }, [allCustomers, customerSearch]);

  const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%' }} className="sp-spin" />
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--color-text-secondary)' }}>Caricamento POS...</p>
      </div>
    </div>
  );

  return (
    <div className="sp-pos-layout">
      {/* LEFT — Products */}
      <div className="sp-pos-products">
        {/* Search */}
        <div className="sp-search-box sp-mb-4">
          <Search size={16} />
          <input 
            className="sp-input" 
            placeholder="Cerca prodotto per nome o SKU..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Category chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          <button 
            className={`sp-chip ${!activeCategory ? 'active' : ''}`}
            onClick={() => setActiveCategory(null)}
          >
            Tutti
          </button>
          {categories.map(cat => (
            <button 
              key={cat.id}
              className={`sp-chip ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="sp-pos-product-grid">
          {filteredProducts.map(product => {
            const variant = product.variants?.[0];
            const price = parseFloat(variant?.sale_price) || 0;
            const stockInfo = variant ? stockMap[variant.id] : null;
            const onHand = stockInfo?.on_hand ?? '—';
            const location = variant?.location;
            
            return (
              <div 
                key={product.id} 
                className="sp-pos-product-card"
                onClick={() => addToCart(product)}
              >
                <div className="sp-pos-product-name">
                  {displayMode === 'sku' ? (product.sku || product.name) : product.name}
                </div>
                <div className="sp-pos-product-price">{fmt(price)}</div>
                <div className="sp-pos-product-stock">
                  Disp: {onHand}
                </div>
                {location && (
                  <div className="sp-pos-product-location">
                    <MapPin size={8} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                    {location}
                  </div>
                )}
                <button 
                  style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.8)', border: 'none', borderRadius: 12, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-primary)' }}
                  onClick={(e) => { e.stopPropagation(); setShowProductInfo(product); }}
                >
                  <Search size={12} strokeWidth={3} />
                </button>
              </div>
            );
          })}
          {filteredProducts.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: 'var(--color-text-tertiary)' }}>
              Nessun prodotto trovato
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — Cart */}
      <div className="sp-pos-cart">
        <div className="sp-pos-cart-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCart size={18} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>Carrello</span>
            {cartCount > 0 && (
              <span className="sp-badge sp-badge-info" style={{ marginLeft: 4 }}>{cartCount}</span>
            )}
          </div>
          {cartLines.length > 0 && (
            <button className="sp-btn sp-btn-ghost sp-btn-sm" onClick={() => setShowClearConfirm(true)}>
              <Trash2 size={14} /> Svuota
            </button>
          )}
        </div>

        {showClearConfirm && (
          <div style={{ padding: '12px 20px', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 13, alignSelf: 'center', fontWeight: 600 }}>Svuota:</span>
            <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => clearSession('cart')}>Solo carrello</button>
            <button className="sp-btn sp-btn-secondary sp-btn-sm" onClick={() => clearSession('all')}>Tutto (anche cliente)</button>
            <button className="sp-btn sp-btn-ghost sp-btn-sm" onClick={() => setShowClearConfirm(false)}><X size={14}/></button>
          </div>
        )}

        {/* Operator selector */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--color-border-light)' }}>
          <select 
            className="sp-select" 
            value={soldByEmployeeId} 
            onChange={(e) => setSoldByEmployeeId(e.target.value)}
            style={{ fontSize: 12 }}
          >
            <option value="">Seleziona operatore...</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>

        {/* Customer selector */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--color-border-light)' }}>
          {selectedCustomer ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <User size={14} style={{ color: 'var(--color-accent)' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedCustomer.name}</span>
              </div>
              <button className="sp-btn sp-btn-ghost sp-btn-sm" onClick={() => setSelectedCustomer(null)}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input 
                className="sp-input"
                placeholder="Cerca cliente..."
                value={customerSearch}
                onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerPicker(true); }}
                onFocus={() => setShowCustomerPicker(true)}
                style={{ fontSize: 12 }}
              />
              {showCustomerPicker && customerSearch && (
                <div style={{ 
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)', maxHeight: 200, overflowY: 'auto'
                }}>
                  {filteredCustomers.map(c => (
                    <button 
                      key={c.id} 
                      style={{ display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left', fontSize: 12, borderBottom: '1px solid var(--color-border-light)' }}
                      onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setShowCustomerPicker(false); }}
                    >
                      <strong>{c.name}</strong> <span style={{ color: 'var(--color-text-tertiary)' }}>{c.email}</span>
                    </button>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <div style={{ padding: '12px', fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
                      Nessun cliente trovato
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cart items */}
        <div className="sp-pos-cart-items">
          {cartLines.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
              <ShoppingCart size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p>Il carrello è vuoto</p>
              <p style={{ fontSize: 11, marginTop: 4 }}>Clicca su un prodotto per aggiungerlo</p>
            </div>
          ) : (
            cartLines.map(line => (
              <div key={line.product_variant_id} className="sp-pos-cart-item">
                <div className="sp-pos-cart-item-info">
                  <div className="sp-pos-cart-item-name">{line.name}</div>
                  <div className="sp-pos-cart-item-price">{fmt(line.price)} cad.</div>
                </div>
                <div className="sp-pos-cart-qty">
                  <button onClick={() => updateQty(line.product_variant_id, -1)}>
                    <Minus size={14} />
                  </button>
                  <span>{line.qty}</span>
                  <button onClick={() => updateQty(line.product_variant_id, 1)}>
                    <Plus size={14} />
                  </button>
                </div>
                <div style={{ minWidth: 65, textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                  {fmt(line.price * line.qty)}
                </div>
                <button 
                  onClick={() => removeFromCart(line.product_variant_id)}
                  style={{ color: 'var(--color-error)', padding: 4 }}
                >
                  <X size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Note e Cross-selling */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border-light)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cartLines.length > 0 && (
            <input 
              className="sp-input" 
              placeholder="Note ordine..." 
              value={note} 
              onChange={(e) => setNote(e.target.value)}
              style={{ fontSize: 12 }}
            />
          )}
          {/* Sezione Cross-Selling Base */}
          {cartLines.length > 0 && products.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>Potrebbe interessare:</div>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                {products.slice(0, 3).map(cp => (
                  <button 
                    key={cp.id} 
                    className="sp-chip" 
                    style={{ fontSize: 11, whiteSpace: 'nowrap' }}
                    onClick={() => addToCart(cp)}
                  >
                    + {cp.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer with total and payment */}
        <div className="sp-pos-cart-footer">
          <div className="sp-pos-total-row">
            <span className="sp-pos-total-label">Totale</span>
            <span className="sp-pos-total-value">{fmt(cartTotal)}</span>
          </div>
          <div className="sp-pos-payment-btns">
            <button 
              className="sp-btn sp-btn-primary sp-btn-lg"
              style={{ width: '100%', display: 'flex', justifyContent: 'center', height: 64, fontSize: 18 }}
              onClick={() => setShowCheckoutModal(true)}
              disabled={placingOrder || !cartLines.length}
            >
              Cassa e Pagamento
            </button>
          </div>
        </div>
      </div>

      {showCheckoutModal && (
        <PosCheckoutModal 
          cartTotal={cartTotal}
          onComplete={handleAdvancedCheckout}
          onCancel={() => setShowCheckoutModal(false)}
        />
      )}

      {/* Info Prodotto Modal */}
      {showProductInfo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setShowProductInfo(null)}>
          <div style={{
            background: 'var(--color-surface)', width: '100%', maxWidth: 400,
            borderRadius: 12, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }} className="sp-animate-in" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{showProductInfo.name}</h3>
              <button 
                onClick={() => setShowProductInfo(null)} 
                style={{ background: 'var(--color-bg)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>SKU</span>
                <span className="sp-font-mono">{showProductInfo.sku || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Tipo</span>
                <span>{showProductInfo.product_type}</span>
              </div>
              
              {showProductInfo.variants?.[0] && (
                <>
                  <div style={{ width: '100%', height: 1, background: 'var(--color-border-light)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Prezzo Vendita</span>
                    <span style={{ fontWeight: 700 }}>{fmt(showProductInfo.variants[0].sale_price)}</span>
                  </div>
                  {showProductInfo.variants[0].flavor && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Aroma</span>
                      <span>{showProductInfo.variants[0].flavor}</span>
                    </div>
                  )}
                  {showProductInfo.variants[0].resistance_ohm && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Resistenza (Ohm)</span>
                      <span>{showProductInfo.variants[0].resistance_ohm}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <button 
              className="sp-btn sp-btn-primary sp-btn-block" 
              style={{ marginTop: 24 }}
              onClick={() => { addToCart(showProductInfo); setShowProductInfo(null); }}
            >
              <Plus size={14} /> Aggiungi al Carrello
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
