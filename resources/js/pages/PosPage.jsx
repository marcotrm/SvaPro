import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { orders as ordersApi, catalog, customers as customersApi, inventory, getImageUrl } from '../api.jsx';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, X, User,
  MapPin, Zap, Package, ChevronRight, ReceiptText, Loader2,
  ScanBarcode, Cherry, RotateCcw, UserCircle, Tag
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import PosCheckoutModal from '../components/PosCheckoutModal.jsx';

/* ─── Category palette (colori di fallback card) ─── */
const CAT_PALETTES = [
  { bg: 'linear-gradient(135deg,#7B6FD0 0%,#5B50B0 100%)', accent: '#7B6FD0' },
  { bg: 'linear-gradient(135deg,#F472B6 0%,#DB2777 100%)', accent: '#F472B6' },
  { bg: 'linear-gradient(135deg,#34D399 0%,#059669 100%)', accent: '#34D399' },
  { bg: 'linear-gradient(135deg,#60A5FA 0%,#2563EB 100%)', accent: '#60A5FA' },
  { bg: 'linear-gradient(135deg,#FB923C 0%,#EA580C 100%)', accent: '#FB923C' },
  { bg: 'linear-gradient(135deg,#A78BFA 0%,#7C3AED 100%)', accent: '#A78BFA' },
  { bg: 'linear-gradient(135deg,#2DD4BF 0%,#0D9488 100%)', accent: '#2DD4BF' },
  { bg: 'linear-gradient(135deg,#FBBF24 0%,#D97706 100%)', accent: '#FBBF24' },
];
const catPalette = (catId) => CAT_PALETTES[(catId || 0) % CAT_PALETTES.length];

const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);

/* ─── ProductCard ───────────────────────────────── */
function ProductCard({ product, onAdd, onInfo, stockMap, displayMode }) {
  const variant   = product.variants?.[0];
  const price     = parseFloat(variant?.sale_price) || 0;
  const stockInfo = variant ? stockMap[variant.id] : null;
  const onHand    = stockInfo?.on_hand ?? 0;
  const palette   = catPalette(product.category_id);
  const imgUrl    = product.image_url ? getImageUrl(product.image_url) : null;
  const inStock   = onHand > 0;

  return (
    <div
      onClick={() => onAdd(product)}
      style={{
        background: 'white',
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        border: '1px solid #eee',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'all 0.18s cubic-bezier(.4,0,.2,1)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        opacity: inStock ? 1 : 0.65,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.13)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)';
      }}
    >
      {/* Immagine o gradient placeholder */}
      <div style={{ height: 120, flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
          />
        ) : null}
        {/* Fallback gradient — shown when no image or image fails */}
        <div style={{
          width: '100%', height: '100%',
          background: palette.bg,
          display: imgUrl ? 'none' : 'flex',
          alignItems: 'center', justifyContent: 'center',
          position: imgUrl ? 'absolute' : 'relative',
          inset: 0,
        }}>
          <Package size={32} color="rgba(255,255,255,0.5)" />
        </div>

        {/* Stock badge */}
        <div style={{
          position: 'absolute', top: 7, left: 7,
          background: inStock ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)',
          color: '#fff', borderRadius: 8, padding: '2px 7px', fontSize: 10, fontWeight: 700,
          backdropFilter: 'blur(4px)',
        }}>
          {inStock ? onHand : '✕'}
        </div>

        {/* Info button */}
        <button
          onClick={e => { e.stopPropagation(); onInfo(product); }}
          style={{
            position: 'absolute', top: 7, right: 7,
            background: 'rgba(255,255,255,0.85)', border: 'none',
            borderRadius: 8, width: 26, height: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', backdropFilter: 'blur(4px)',
          }}
        >
          <Search size={12} color="#555" strokeWidth={2.5} />
        </button>
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35, color: '#1a1a2e', WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {displayMode === 'sku' ? (product.sku || product.name) : product.name}
        </div>
        {variant?.flavor && (
          <div style={{ fontSize: 10, color: '#8b7fcc', fontWeight: 600 }}>
            <Cherry size={9} style={{ display: 'inline', marginRight: 3 }} />{variant.flavor}
          </div>
        )}
        <div style={{ marginTop: 'auto', paddingTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: palette.accent }}>
            {fmt(price)}
          </span>
          {variant?.location && (
            <span style={{ fontSize: 9, color: '#aaa', display: 'flex', alignItems: 'center', gap: 2 }}>
              <MapPin size={8} />{variant.location}
            </span>
          )}
        </div>
      </div>

      {/* Hover add overlay */}
      <div className="pos-add-overlay" style={{
        position: 'absolute', inset: 0, background: 'rgba(123,111,208,0.08)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        paddingBottom: 10, opacity: 0, transition: 'opacity 0.15s',
        pointerEvents: 'none',
      }}>
        <div style={{ background: '#7B6FD0', color: '#fff', borderRadius: 20, padding: '4px 14px', fontSize: 11, fontWeight: 700 }}>
          + Aggiungi
        </div>
      </div>
    </div>
  );
}

/* ─── CartItem ──────────────────────────────────── */
function CartItem({ line, onUpdateQty, onRemove }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto auto',
      gap: 10, alignItems: 'center',
      padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {line.name}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
          {fmt(line.price)} cad. · tot. <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>{fmt(line.price * line.qty)}</span>
        </div>
      </div>

      {/* Qty stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
        <button
          onClick={() => onUpdateQty(-1)}
          style={{ background: 'none', border: 'none', color: '#fff', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Minus size={12} />
        </button>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 800, minWidth: 22, textAlign: 'center' }}>{line.qty}</span>
        <button
          onClick={() => onUpdateQty(1)}
          style={{ background: 'none', border: 'none', color: '#fff', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Plus size={12} />
        </button>
      </div>

      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 4, display: 'flex' }}>
        <X size={14} />
      </button>
    </div>
  );
}

/* ─── PosPage ───────────────────────────────────── */
export default function PosPage() {
  const { selectedStoreId, displayMode } = useOutletContext();
  const [loading, setLoading]           = useState(true);

  const [products, setProducts]         = useState([]);
  const [categories, setCategories]     = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchTerm, setSearchTerm]     = useState('');
  const [flavorTerm, setFlavorTerm]     = useState('');
  const searchRef                       = useRef(null);

  const [cartLines, setCartLines]       = useState([]);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);

  const [stockMap, setStockMap]         = useState({});
  const [warehouseId, setWarehouseId]   = useState('');
  const [employees, setEmployees]       = useState([]);
  const [soldByEmployeeId, setSoldByEmployeeId] = useState('');
  const [note, setNote]                 = useState('');

  const [allCustomers, setAllCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch]     = useState('');
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);
  const [showProductInfo, setShowProductInfo]   = useState(null);

  /* Load data */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const sp = selectedStoreId ? { store_id: selectedStoreId } : {};
      const [pRes, cRes, aRes, oRes, stRes] = await Promise.all([
        catalog.getProducts({ ...sp, limit: 500 }),
        catalog.getCategories(),
        customersApi.getCustomers({ limit: 1000 }),
        ordersApi.getOptions(sp),
        inventory.getStock({ ...sp, limit: 2000 }),
      ]);
      setProducts(pRes.data?.data || []);
      const allCats = cRes.data?.data || [];
      setCategories(allCats.filter(c => !c.parent_id));
      setAllCustomers(aRes.data?.data || []);
      setEmployees(oRes.data?.data?.employees || []);
      const whs = oRes.data?.data?.warehouses || [];
      if (whs.length > 0) setWarehouseId(whs[0].id);
      // Auto-seleziona il primo operatore disponibile
      const emps = oRes.data?.data?.employees || [];
      if (emps.length > 0 && !soldByEmployeeId) setSoldByEmployeeId(String(emps[0].id));
      const sm = {};
      (stRes.data?.data || []).forEach(si => { sm[si.product_variant_id] = si; });
      setStockMap(sm);
    } catch { toast.error('Errore caricamento dati POS'); }
    finally { setLoading(false); }
  }, [selectedStoreId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* Cart logic */
  const addToCart = useCallback((product) => {
    const variant = product.variants?.[0];
    if (!variant) return;
    setCartLines(prev => {
      const ex = prev.find(l => l.product_variant_id === variant.id);
      if (ex) return prev.map(l => l.product_variant_id === variant.id ? { ...l, qty: l.qty + 1 } : l);
      return [...prev, {
        product_variant_id: variant.id,
        name: product.name,
        sku: product.sku,
        price: parseFloat(variant.sale_price) || 0,
        qty: 1,
        location: variant.location || '',
      }];
    });
    toast.success(`${product.name}`, { duration: 900, icon: '🛒' });
  }, []);

  const updateQty = (variantId, delta) => {
    setCartLines(prev => prev.map(l => {
      if (l.product_variant_id !== variantId) return l;
      const n = l.qty + delta;
      return n <= 0 ? null : { ...l, qty: n };
    }).filter(Boolean));
  };

  const removeFromCart = (variantId) => setCartLines(prev => prev.filter(l => l.product_variant_id !== variantId));
  const clearCart = () => setCartLines([]);

  const cartTotal = useMemo(() => cartLines.reduce((s, l) => s + l.price * l.qty, 0), [cartLines]);
  const cartCount = useMemo(() => cartLines.reduce((s, l) => s + l.qty, 0), [cartLines]);

  /* Checkout */
  const handleCheckout = async (payload) => {
    if (!cartLines.length) return toast.error('Carrello vuoto');
    // Risolvi operatore: usa selezionato o fallback al primo disponibile
    const resolvedEmpId = soldByEmployeeId || (employees.length > 0 ? String(employees[0].id) : null);
    if (!resolvedEmpId) return toast.error('Nessun operatore disponibile');
    try {
      setPlacingOrder(true);
      await ordersApi.place({
        channel: 'pos',
        store_id: selectedStoreId,
        warehouse_id: Number(warehouseId),
        employee_id: Number(resolvedEmpId),          // richiesto dal backend POS
        sold_by_employee_id: Number(resolvedEmpId),  // per commissioni/stats
        customer_id: selectedCustomer?.id,
        lines: cartLines.map(l => ({ product_variant_id: l.product_variant_id, qty: l.qty })),
        notes: note + (payload.receipt_type ? ` [${payload.receipt_type}]` : ''),
        status: 'paid',
        payments: payload.payments,
        order_discount_amount: payload.order_discount_amount,
      });
      toast.success('✅ Vendita completata!');
      setCartLines([]); setSelectedCustomer(null); setNote(''); setShowCheckoutModal(false);
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.errors
        ? Object.values(err.response.data.errors).flat().join(' • ')
        : err.response?.data?.message || 'Errore durante il pagamento';
      toast.error(msg);
    }
    finally { setPlacingOrder(false); }
  };


  /* Filters */
  const filteredProducts = useMemo(() => products.filter(p => {
    const s = searchTerm.toLowerCase().trim();
    const f = flavorTerm.toLowerCase().trim();
    const matchS = !s || p.name?.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s)
      || p.variants?.some(v => v.barcode?.toLowerCase().includes(s));
    const matchF = !f || p.variants?.some(v => v.flavor?.toLowerCase().includes(f)) || p.name?.toLowerCase().includes(f);
    const matchC = !activeCategory || p.category_id === activeCategory;
    return matchS && matchF && matchC;
  }), [products, searchTerm, flavorTerm, activeCategory]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return allCustomers.slice(0, 8);
    const s = customerSearch.toLowerCase();
    return allCustomers.filter(c => c.name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s)).slice(0, 8);
  }, [allCustomers, customerSearch]);

  /* Cross-sell */
  const crossSell = useMemo(() => {
    if (!cartLines.length || !products.length) return [];
    const last = cartLines[cartLines.length - 1];
    const lastP = products.find(p => p.variants?.[0]?.id === last.product_variant_id);
    const cartIds = new Set(cartLines.map(l => l.product_variant_id));
    const catId = lastP?.category_id;
    let rel = catId ? products.filter(p => p.category_id === catId && !cartIds.has(p.variants?.[0]?.id)).slice(0, 5) : [];
    if (!rel.length) rel = products.filter(p => !cartIds.has(p.variants?.[0]?.id)).slice(0, 5);
    return rel;
  }, [cartLines, products]);

  /* Barcode scan on Enter */
  const handleSearchKey = (e) => {
    if (e.key === 'Enter' && searchTerm) {
      const match = products.find(p => p.barcode === searchTerm || p.sku === searchTerm || p.variants?.some(v => v.barcode === searchTerm));
      if (match) { addToCart(match); setSearchTerm(''); }
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#7B6FD0', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ fontSize: 14, color: '#9ca3af', fontWeight: 600 }}>Caricamento POS in corso...</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden', background: '#f5f4ff', gap: 0 }}>

      {/* ─── SINISTRA: Catalogo ─────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '20px 20px 0' }}>

        {/* Search bar + flavor */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {/* Campo prodotto / barcode */}
          <div style={{ position: 'relative' }}>
            <ScanBarcode size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
            <input
              ref={searchRef}
              className="sp-input"
              style={{ paddingLeft: 38, paddingRight: 34, height: 42, fontSize: 13, borderRadius: 12, background: '#fff', border: '1.5px solid #e5e7eb' }}
              placeholder="Barcode, nome o SKU..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKey}
              autoFocus
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: '#e5e7eb', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={10} color="#666" />
              </button>
            )}
          </div>

          {/* Campo aroma */}
          <div style={{ position: 'relative' }}>
            <Cherry size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#F472B6', pointerEvents: 'none' }} />
            <input
              className="sp-input"
              style={{ paddingLeft: 38, paddingRight: 34, height: 42, fontSize: 13, borderRadius: 12, background: '#fff', border: '1.5px solid #e5e7eb' }}
              placeholder="Aroma / gusto..."
              value={flavorTerm}
              onChange={e => setFlavorTerm(e.target.value)}
            />
            {flavorTerm && (
              <button onClick={() => setFlavorTerm('')}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: '#e5e7eb', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={10} color="#666" />
              </button>
            )}
          </div>
        </div>

        {/* Category pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 14, paddingBottom: 4 }}>
          <button
            onClick={() => setActiveCategory(null)}
            style={{
              padding: '7px 18px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
              background: !activeCategory ? '#7B6FD0' : '#fff',
              color: !activeCategory ? '#fff' : '#6b7280',
              boxShadow: !activeCategory ? '0 4px 12px rgba(123,111,208,0.35)' : '0 1px 3px rgba(0,0,0,0.07)',
              transition: 'all 0.15s',
            }}
          >
            Tutti ({products.length})
          </button>
          {categories.map(cat => {
            const pal = catPalette(cat.id);
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(active ? null : cat.id)}
                style={{
                  padding: '7px 18px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                  background: active ? pal.accent : '#fff',
                  color: active ? '#fff' : '#6b7280',
                  boxShadow: active ? `0 4px 12px ${pal.accent}55` : '0 1px 3px rgba(0,0,0,0.07)',
                  transition: 'all 0.15s',
                }}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Risultati label */}
        <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 10 }}>
          {filteredProducts.length} prodotti
          {(searchTerm || flavorTerm || activeCategory) && (
            <button onClick={() => { setSearchTerm(''); setFlavorTerm(''); setActiveCategory(null); }}
              style={{ marginLeft: 10, color: '#7B6FD0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
              <RotateCcw size={10} style={{ marginRight: 3 }} />Reset filtri
            </button>
          )}
        </div>

        {/* Product grid — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 20 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
          }}>
            {filteredProducts.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                onAdd={addToCart}
                onInfo={setShowProductInfo}
                stockMap={stockMap}
                displayMode={displayMode}
              />
            ))}
            {filteredProducts.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                <Package size={48} style={{ opacity: 0.2, margin: '0 auto 12px', display: 'block' }} />
                <p style={{ fontWeight: 600 }}>Nessun prodotto trovato</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── DESTRA: Carrello ───────────────────────────────── */}
      <div style={{
        width: 380, flexShrink: 0,
        background: '#0f172a',
        display: 'flex', flexDirection: 'column',
        borderLeft: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
      }}>

        {/* Cart Header */}
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#7B6FD0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingCart size={16} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Carrello</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  {cartCount > 0 ? `${cartCount} articol${cartCount === 1 ? 'o' : 'i'}` : 'Vuoto'}
                </div>
              </div>
            </div>
            {cartLines.length > 0 && (
              <button
                onClick={clearCart}
                style={{ background: 'rgba(239,68,68,0.12)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#fc8181', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Trash2 size={12} /> Svuota
              </button>
            )}
          </div>

          {/* Operatore */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Operatore
            </div>
            <select
              value={soldByEmployeeId}
              onChange={e => setSoldByEmployeeId(e.target.value)}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '9px 12px', fontSize: 12, fontWeight: 600, color: '#fff',
                cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="" style={{ background: '#1e293b' }}>— Seleziona operatore —</option>
              {employees.map(e => (
                <option key={e.id} value={e.id} style={{ background: '#1e293b' }}>{e.name}</option>
              ))}
            </select>
          </div>

          {/* Cliente */}
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Cliente
            </div>
            {selectedCustomer ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(123,111,208,0.15)', border: '1px solid rgba(123,111,208,0.3)', borderRadius: 10, padding: '9px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserCircle size={16} color="#8b7fcc" />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{selectedCustomer.name}</div>
                    {selectedCustomer.email && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{selectedCustomer.email}</div>}
                  </div>
                </div>
                <button onClick={() => setSelectedCustomer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex' }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <User size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
                <input
                  value={customerSearch}
                  onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true); }}
                  onFocus={() => setShowCustomerDrop(true)}
                  placeholder="Cerca cliente..."
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10, padding: '9px 12px 9px 34px', fontSize: 12, color: '#fff', outline: 'none', boxSizing: 'border-box',
                  }}
                />
                {showCustomerDrop && customerSearch && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: 4, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                    {filteredCustomers.map(c => (
                      <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setShowCustomerDrop(false); }}
                        style={{ display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#fff' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(123,111,208,0.15)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700 }}>{c.name}</div>
                        {c.email && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{c.email}</div>}
                      </button>
                    ))}
                    {filteredCustomers.length === 0 && <div style={{ padding: 14, fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>Nessun cliente</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Cart Items — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 22px' }}>
          {cartLines.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, opacity: 0.3 }}>
              <ShoppingCart size={52} color="#fff" />
              <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, margin: 0 }}>Carrello vuoto</p>
              <p style={{ color: '#fff', fontSize: 11, margin: 0 }}>Clicca un prodotto per aggiungerlo</p>
            </div>
          ) : (
            <div style={{ paddingTop: 4 }}>
              {cartLines.map(line => (
                <CartItem
                  key={line.product_variant_id}
                  line={line}
                  onUpdateQty={delta => updateQty(line.product_variant_id, delta)}
                  onRemove={() => removeFromCart(line.product_variant_id)}
                />
              ))}

              {/* Cross-sell */}
              {crossSell.length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    <Zap size={10} style={{ display: 'inline', marginRight: 4 }} />Potrebbe interessare
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {crossSell.map(p => (
                      <button key={p.id} onClick={() => addToCart(p)}
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '4px 12px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', whiteSpace: 'nowrap', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        + {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Note */}
              <div style={{ marginTop: 14 }}>
                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Nota ordine..."
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.6)', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Cart Footer — Total + CTA */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '16px 22px 24px' }}>
          {/* Subtotale riga per riga */}
          {cartLines.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {cartLines.map(l => (
                <div key={l.product_variant_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{l.name} ×{l.qty}</span>
                  <span>{fmt(l.price * l.qty)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Totale */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Totale</span>
            <span style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: -1 }}>
              {fmt(cartTotal)}
            </span>
          </div>

          {/* Bottone Cassa */}
          <button
            onClick={() => setShowCheckoutModal(true)}
            disabled={placingOrder || cartLines.length === 0}
            style={{
              width: '100%', height: 56, borderRadius: 14, border: 'none', cursor: cartLines.length ? 'pointer' : 'not-allowed',
              background: cartLines.length ? 'linear-gradient(135deg, #7B6FD0, #5B50B0)' : 'rgba(255,255,255,0.08)',
              color: cartLines.length ? '#fff' : 'rgba(255,255,255,0.25)',
              fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: cartLines.length ? '0 8px 24px rgba(123,111,208,0.5)' : 'none',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { if (cartLines.length) e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {placingOrder
              ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
              : <><ReceiptText size={18} /> Vai alla Cassa</>
            }
          </button>
        </div>
      </div>

      {/* ─── Checkout Modal ─── */}
      {showCheckoutModal && (
        <PosCheckoutModal
          cartTotal={cartTotal}
          onComplete={handleCheckout}
          onCancel={() => setShowCheckoutModal(false)}
        />
      )}

      {/* ─── Info Prodotto Modal ─── */}
      {showProductInfo && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowProductInfo(null)}
        >
          <div
            style={{ background: '#fff', width: '100%', maxWidth: 400, borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
            className="sp-animate-in"
            onClick={e => e.stopPropagation()}
          >
            {/* Header immagine */}
            {(() => {
              const imgUrl = showProductInfo.image_url ? getImageUrl(showProductInfo.image_url) : null;
              const pal = catPalette(showProductInfo.category_id);
              return (
                <div style={{ height: 140, position: 'relative', overflow: 'hidden' }}>
                  {imgUrl
                    ? <img src={imgUrl} alt={showProductInfo.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', background: pal.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Package size={48} color="rgba(255,255,255,0.4)" />
                      </div>
                  }
                  <button onClick={() => setShowProductInfo(null)}
                    style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <X size={16} />
                  </button>
                </div>
              );
            })()}

            <div style={{ padding: '20px 24px 24px' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#1a1a2e' }}>{showProductInfo.name}</h3>
              {showProductInfo.sku && <p style={{ margin: '0 0 16px', fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>SKU: {showProductInfo.sku}</p>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {[
                  ['Prezzo vendita', fmt(showProductInfo.variants?.[0]?.sale_price), true],
                  ['Tipo', showProductInfo.product_type],
                  showProductInfo.variants?.[0]?.flavor && ['Aroma', showProductInfo.variants[0].flavor],
                  showProductInfo.variants?.[0]?.resistance_ohm && ['Resistenza', `${showProductInfo.variants[0].resistance_ohm} Ω`],
                  showProductInfo.variants?.[0]?.nicotine_strength && ['Nicotina', `${showProductInfo.variants[0].nicotine_strength} mg/ml`],
                  showProductInfo.variants?.[0]?.volume_ml && ['Volume', `${showProductInfo.variants[0].volume_ml} ml`],
                  showProductInfo.variants?.[0]?.location && ['Ubicazione', showProductInfo.variants[0].location],
                ].filter(Boolean).map(([label, value, bold]) => value && (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingBottom: 8, borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#6b7280' }}>{label}</span>
                    <span style={{ fontWeight: bold ? 800 : 600, color: bold ? '#7B6FD0' : '#1a1a2e', fontSize: bold ? 16 : 13 }}>{value}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => { addToCart(showProductInfo); setShowProductInfo(null); }}
                style={{ width: '100%', height: 48, background: 'linear-gradient(135deg, #7B6FD0, #5B50B0)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Plus size={16} /> Aggiungi al Carrello
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
