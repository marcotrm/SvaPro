import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { orders as ordersApi, catalog, customers as customersApi, inventory, stores, getImageUrl, clearApiCache, promotions as promotionsApi } from '../api.jsx';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, X, User,
  MapPin, Zap, Package, ChevronRight, ReceiptText, Loader2,
  ScanBarcode, Cherry, RotateCcw, UserCircle, Tag, Star,
  Calendar as CalendarIcon, ShieldCheck
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import PosCheckoutModal from '../components/PosCheckoutModal.jsx';
import ProductInventoryModal from '../components/ProductInventoryModal.jsx';

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
  const onHand    = variant?.stock_quantity ?? variant?.on_hand ?? stockInfo?.on_hand ?? 0;
  const palette   = catPalette(product.category_id);
  const imgUrl    = product.image_url ? getImageUrl(product.image_url) : null;
  const inStock   = onHand > 0;
  const qscarePrice = parseFloat(product.qscare_price) || 0;
  const [popped, setPopped] = React.useState(false);

  const handleAdd = () => {
    onAdd(product);
    setPopped(true);
    setTimeout(() => setPopped(false), 380);
  };

  return (
    <div
      onClick={handleAdd}
      className={popped ? 'sp-pos-card-added' : ''}
      style={{
        background: 'white',
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        border: qscarePrice > 0 ? '1px solid rgba(99,102,241,0.25)' : '1px solid #eee',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'all 0.18s cubic-bezier(.4,0,.2,1)',
        boxShadow: qscarePrice > 0 ? '0 1px 6px rgba(99,102,241,0.15)' : '0 1px 4px rgba(0,0,0,0.06)',
        opacity: inStock ? 1 : 0.65,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = qscarePrice > 0 ? '0 12px 28px rgba(99,102,241,0.25)' : '0 12px 28px rgba(0,0,0,0.13)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = qscarePrice > 0 ? '0 1px 6px rgba(99,102,241,0.15)' : '0 1px 4px rgba(0,0,0,0.06)';
      }}
    >
      {/* Immagine o gradient placeholder */}
      <div style={{ height: 88, flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
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
          background: inStock ? 'rgba(16,185,129,0.92)' : 'rgba(239,68,68,0.92)',
          color: '#fff', borderRadius: 8, padding: '2px 8px', fontSize: 10, fontWeight: 800,
          backdropFilter: 'blur(6px)',
          boxShadow: inStock ? '0 2px 8px rgba(16,185,129,0.4)' : '0 2px 8px rgba(239,68,68,0.4)',
          letterSpacing: '0.02em',
        }}>
          {inStock ? onHand : '×'}
        </div>

        {/* QScare badge — visibile solo per hardware con prezzo configurato */}
        {qscarePrice > 0 && (
          <div style={{
            position: 'absolute', bottom: 7, left: 7,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.92), rgba(139,92,246,0.92))',
            color: '#fff', borderRadius: 8, padding: '2px 7px', fontSize: 9, fontWeight: 800,
            backdropFilter: 'blur(6px)',
            boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
            display: 'flex', alignItems: 'center', gap: 3,
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
          }}>
            🛡 {fmt(qscarePrice)}
          </div>
        )}



        {/* Featured badge */}
        {product.is_featured && (
          <div style={{
            position: 'absolute', bottom: 7, right: 7,
            background: 'rgba(251,191,36,0.92)',
            borderRadius: '50%', width: 22, height: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(251,191,36,0.5)',
          }}>
            <Star size={11} fill="#fff" color="#fff" strokeWidth={0} />
          </div>
        )}
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
          <button
            onClick={e => { e.stopPropagation(); onInfo(product); }}
            style={{
              background: 'var(--color-bg)', border: 'none',
              borderRadius: 8, padding: '4px 8px', fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 4,
              cursor: 'pointer', color: 'var(--color-text-secondary)'
            }}
          >
            Dettagli
          </button>
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
  const { selectedStoreId, displayMode, user } = useOutletContext();
  // Controllo ruolo dipendente
  const isDipendente = (user?.roles || []).includes('dipendente') || user?.role === 'dipendente';
  const [loading, setLoading]           = useState(true);
  const [products, setProducts]         = useState([]);
  const [categories, setCategories]     = useState([]);
  const [activeCategory, setActiveCategory] = useState('top_selling');
  const [fetchedCats, setFetchedCats]   = useState(new Set(['top_selling', 'featured']));

  const [searchTerm, setSearchTerm]     = useState('');
  const [flavorTerm, setFlavorTerm]     = useState('');
  
  // Effetto Debounce per Ricerca Globale su tutto il magazzino
  useEffect(() => {
    if (!searchTerm || searchTerm.trim().length < 2) return;
    const timer = setTimeout(async () => {
      try {
        const res = await catalog.getProducts({ search: searchTerm.trim(), limit: 40 });
        const newProds = res.data?.data || [];
        if (newProds.length > 0) {
          setProducts(prev => {
            const map = new Map(prev.map(p => [String(p.id), p]));
            newProds.forEach(np => map.set(String(np.id), np));
            return Array.from(map.values());
          });
        }
      } catch (err) {}
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  const searchRef                       = useRef(null);

  const [cartLines, setCartLines]       = useState([]);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);

  const [stockMap, setStockMap]         = useState({});
  const [warehouseId, setWarehouseId]   = useState('');
  const [employees, setEmployees]       = useState([]);
  const [soldByEmployeeId, setSoldByEmployeeId] = useState('');
  const [operatorBarcode, setOperatorBarcode] = useState('');
  const [operatorName, setOperatorName]   = useState('');
  const [operatorError, setOperatorError] = useState('');
  const [showOperatorDrop, setShowOperatorDrop] = useState(false);
  const operatorBarcodeRef = useRef(null);
  const operatorDebounceRef = useRef(null);
  const [note, setNote]                   = useState('');
  const [showResoModal, setShowResoModal] = useState(false);
  const [showMyShifts, setShowMyShifts]   = useState(false);

  const [allCustomers, setAllCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch]     = useState('');
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);
  const [showProductInfo, setShowProductInfo]   = useState(null);
  const [inventoryProduct, setInventoryProduct] = useState(null);

  const [qscareLines, setQscareLines] = useState({}); // { [product_variant_id]: bool }

  // ── Codice Promozionale ────────────────────────────────────────────────────
  const [promoCode,    setPromoCode]    = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null); // { id, name, type, value, discount_amount }
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError,   setPromoError]   = useState('');
  const promoRef = useRef(null);

  /* Load data */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const sp = selectedStoreId ? { store_id: selectedStoreId } : {};

      // Carica prodotti — top 20 più venduti + prodotti in evidenza
      let topProds = [], featProds = [], allCats = [];
      try {
        const topRes = await catalog.getProducts({ sort: 'top_selling', limit: 20, ...(selectedStoreId ? { store_id: selectedStoreId } : {}) });
        topProds = topRes.data?.data || [];
      } catch (err) { console.error('Error loading top products', err); }

      try {
        const featRes = await catalog.getProducts({ limit: 30, is_featured: 1, ...(selectedStoreId ? { store_id: selectedStoreId } : {}) });
        featProds = featRes.data?.data || [];
      } catch (err) { console.error('Error loading featured products', err); }

      try {
        const cRes = await catalog.getCategories();
        allCats = cRes.data?.data || [];
        setCategories(allCats.filter(c => !c.parent_id));
      } catch (err) { console.error('Error loading categories', err); }

      // Merge top-selling + featured, senza duplicati
      const merged = new Map();
      [...topProds, ...featProds].forEach(p => merged.set(p.id, p));
      setProducts(Array.from(merged.values()));

      // Carica stock separatamente
      try {
        const stRes = await inventory.getStock({ ...sp, limit: 2000 });
        const sm = {};
        (stRes.data?.data || []).forEach(si => { sm[si.product_variant_id] = si; });
        setStockMap(sm);
      } catch { /* stock non disponibile */ }

      // Carica clienti separatamente
      try {
        const aRes = await customersApi.getCustomers({ limit: 1000 });
        const normalizedCustomers = (aRes.data?.data || []).map(c => ({
          ...c,
          name: c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || `Cliente #${c.id}`,
        }));
        setAllCustomers(normalizedCustomers);
      } catch { setAllCustomers([]); }

      // Carica opzioni ordine (warehouse, employees)
      try {
        const oRes = await ordersApi.getOptions(sp);
        const optEmp = oRes.data?.data?.employees || [];
        const whs = oRes.data?.data?.warehouses || [];
        if (whs.length > 0) setWarehouseId(whs[0].id);
        setEmployees(optEmp);
        // Arricchisci con dipendenti cross-store in background
        import('../api.jsx').then(({ employees: empApi }) => {
          empApi.getAllEmployees().then(r => {
            const all = r.data?.data || r.data || [];
            if (Array.isArray(all) && all.length > optEmp.length) setEmployees(all);
          }).catch(() => {});
        });
      } catch { /* continua senza warehouse/employees */ }

    } catch (err) { 
      console.error('POS Gen error:', err);
      toast.error('Errore caricamento POS: ' + (err.message || 'Controlla connessione')); 
    }
    finally { setLoading(false); }
  }, [selectedStoreId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Caricamento dinamico categorie
  useEffect(() => {
    if (activeCategory && activeCategory !== 'top_selling' && activeCategory !== 'featured' && !fetchedCats.has(activeCategory)) {
      setFetchedCats(prev => new Set(prev).add(activeCategory));
      catalog.getProducts({
        category_id: activeCategory,
        limit: 80,  // Limitato a 80 per performance (era 1000)
        ...(selectedStoreId ? { store_id: selectedStoreId } : {}),
      }).then(res => {
         const newProds = res.data?.data || [];
         setProducts(prev => {
            const map = new Map(prev.map(p => [p.id, p]));
            newProds.forEach(p => map.set(p.id, p));
            return Array.from(map.values());
         });
      });
    }
  }, [activeCategory, fetchedCats, selectedStoreId]);


  // Auto-precompila operatore se l'utente loggato è un dipendente
  useEffect(() => {
    if (!user) return;
    const empId = user.employee_id || (user.role === 'dipendente' ? user.id : null);
    if (empId && !soldByEmployeeId) {
      setSoldByEmployeeId(String(empId));
      const name = `${user.first_name || user.name || ''}`.trim() || `Operatore #${empId}`;
      setOperatorName(name);
    }
  }, [user]);

  // Auto-invio per codice operatore dopo aver finito di digitare (debounce 1 secondo)
  useEffect(() => {
    if (!operatorBarcode.trim() || soldByEmployeeId) return;
    const delayId = setTimeout(async () => {
      const val = operatorBarcode.trim();
      const valLow = val.toLowerCase();
      let found = employees.find(em =>
        (em.barcode && em.barcode.toLowerCase() === valLow) ||
        (em.employee_code && em.employee_code.toLowerCase() === valLow) ||
        String(em.id) === valLow
      );

      if (!found) {
        try {
          const { employees: empApi } = await import('../api.jsx');
          const res = await empApi.getEmployees({ search: val, limit: 10 });
          const list = res.data?.data || [];
          found = list.find(em => 
            (em.barcode && em.barcode.toLowerCase() === valLow) ||
            (em.employee_code && em.employee_code.toLowerCase() === valLow) ||
            String(em.id) === valLow
          ) || (/^\d+$/.test(val) && list.find(em => String(em.id) === val));
        } catch {}
      }

      if (found) {
        setSoldByEmployeeId(String(found.id));
        setOperatorName(`${found.first_name || ''} ${found.last_name || ''}`.trim() || `Operatore #${found.id}`);
        setOperatorError('');
        setOperatorBarcode('');
      } else {
        setOperatorError(`Codice "${val}" non trovato`);
        setOperatorBarcode('');
      }
    }, 1000); // ASPETTA 1 SECONDO DOPO AVER FINITO DI DIGITARE!
    return () => clearTimeout(delayId);
  }, [operatorBarcode, employees, soldByEmployeeId]);


  /* Cart logic */

  // Helper: determina se un prodotto è hardware/dispositivo (dichiarato prima di addToCart per evitare TDZ)
  const isHardwareProduct = useCallback((product) => {
    const cat = categories.find(c => c.id === product.category_id);
    const n = cat?.name?.toLowerCase() || '';
    return (
      n.includes('hardware') ||
      n.includes('dispositiv') ||
      n.includes('device') ||
      n.includes('mod') ||
      product.product_type === 'device'
    );
  }, [categories]);

  const addToCart = useCallback((product) => {
    const variant = product.variants?.[0];
    if (!variant) return;
    // Blocca aggiunta se stock 0
    const stockInfo = stockMap[variant.id];
    const onHand = product.variants?.[0]?.stock_quantity ?? product.variants?.[0]?.on_hand ?? stockInfo?.on_hand ?? 0;
    if (onHand <= 0) {
      toast.error(`❌ ${product.name} non disponibile in magazzino`, { duration: 2000 });
      return;
    }
    setCartLines(prev => {
      const ex = prev.find(l => l.product_variant_id === variant.id);
      if (ex) return prev.map(l => l.product_variant_id === variant.id ? { ...l, qty: l.qty + 1 } : l);
      return [...prev, {
        product_variant_id: variant.id,
        name: product.name,
        sku: product.sku,
        image: product.image,
        price: parseFloat(variant.sale_price) || 0,
        qty: 1,
        location: variant.location || '',
      }];
    });
    // QScare è di default DISATTIVA. L'operatore sceglierà manualmente la quantità.
    toast.success(`${product.name}`, { duration: 900, icon: '🛒' });
  }, [stockMap, isHardwareProduct]);

  const updateQty = (variantId, delta) => {
    setCartLines(prev => prev.map(l => {
      if (l.product_variant_id !== variantId) return l;
      const n = l.qty + delta;
      
      // Controllo QScare: riduci la quantità QScare se eccede la nuova quantità del carrello
      if (n > 0) {
         setQscareLines(qsc => {
            const currentQsc = qsc[variantId] || 0;
            if (currentQsc > n) return { ...qsc, [variantId]: n };
            return qsc;
         });
      }
      
      return n <= 0 ? null : { ...l, qty: n };
    }).filter(Boolean));
  };

  const removeFromCart = (variantId) => {
    setCartLines(prev => prev.filter(l => l.product_variant_id !== variantId));
    // Rimuovendo prodotti il totale cambia: invalida promo se min_order_amount non soddisfatto
    setAppliedPromo(null);
    setPromoError('');
  };
  const clearCart = () => setCartLines([]);

  const cartTotal = useMemo(() => cartLines.reduce((s, l) => s + l.price * l.qty, 0), [cartLines]);
  const cartCount = useMemo(() => cartLines.reduce((s, l) => s + l.qty, 0), [cartLines]);

  // ── Funzione: applica codice promo ─────────────────────────────────────────
  const applyPromoCode = async () => {
    const code = promoCode.trim();
    if (!code) return;
    setPromoLoading(true);
    setPromoError('');
    try {
      const res = await promotionsApi.validateCode({ code, cart_total: cartTotal });
      const { promotion, discount_amount, message } = res.data;
      setAppliedPromo({ ...promotion, discount_amount: parseFloat(discount_amount) || 0 });
      setPromoCode('');
      toast.success(message || `Codice "${code}" applicato!`, { icon: '🎟️', duration: 3000 });
    } catch (err) {
      const msg = err.response?.data?.message || err.userFriendlyMessage || 'Codice promozionale non valido';
      setPromoError(msg);
    } finally {
      setPromoLoading(false);
    }
  };

  // Controlla se il carrello contiene dispositivi (categoria il cui nome contiene 'dispositiv' oppure product_type 'device')
  const cartHasDevice = useMemo(() => {
    return cartLines.some(line => {
      const product = products.find(p => p.variants?.some(v => v.id === line.product_variant_id));
      if (!product) return false;
      return isHardwareProduct(product);
    });
  }, [cartLines, products, isHardwareProduct]);

  // QScare: calcolato sulle righe hardware dove l'operatore ha attivato la copertura
  const cartQscarePrice = useMemo(() => {
    let total = 0;
    cartLines.forEach(line => {
      const qscQty = qscareLines[line.product_variant_id] || 0;
      if (qscQty > 0) {
        const p = products.find(prod => prod.variants?.some(v => v.id === line.product_variant_id));
        if (p && isHardwareProduct(p)) {
          total += (parseFloat(p.qscare_price) || 0) * qscQty;
        }
      }
    });
    return total;
  }, [cartLines, products, isHardwareProduct, qscareLines]);

  // Pulisce qscareLines quando una riga viene rimossa
  useEffect(() => {
    const validIds = new Set(cartLines.map(l => l.product_variant_id));
    setQscareLines(prev => {
      const next = {};
      for (const k of Object.keys(prev)) {
        if (validIds.has(Number(k)) || validIds.has(String(k))) next[k] = prev[k];
      }
      return next;
    });
  }, [cartLines]);

  const updateQscareForLine = (variantId, delta, maxQty) => {
    setQscareLines(prev => {
      const current = prev[variantId] || 0;
      const nextRaw = current + delta;
      const next = Math.max(0, Math.min(nextRaw, maxQty)); // Non può eccedere la qty del carrello
      return { ...prev, [variantId]: next };
    });
  };

  const effectiveQscarePrice = cartQscarePrice; // somma delle QScare attivate per-riga
  const cartTotalWithQscare  = cartTotal + effectiveQscarePrice;
  const promoDiscount        = appliedPromo?.discount_amount || 0;
  const customerDiscountPct  = parseFloat(selectedCustomer?.personal_discount || 0);
  const customerDiscountAmt  = customerDiscountPct > 0
    ? Math.round(Math.max(0, cartTotalWithQscare - promoDiscount) * customerDiscountPct * 100) / 10000
    : 0;
  const cartTotalFinal       = Math.max(0, cartTotalWithQscare - promoDiscount - customerDiscountAmt);


  // Sconto totale combinato (promo codice + sconto personale cliente)
  const totalCombinedDiscount = promoDiscount + customerDiscountAmt;

  const handleCheckout = async (payload) => {
    if (!cartLines.length) return toast.error('Carrello vuoto');
    // Risolvi operatore dal barcode
    if (!soldByEmployeeId) return toast.error('Scansiona il codice operatore prima di procedere');
    const resolvedEmpId = soldByEmployeeId;
    try {
      setPlacingOrder(true);
      const empId = Number(resolvedEmpId) > 0 ? Number(resolvedEmpId) : null;
      // Costruisce righe QScare per-hardware
      const qscareServiceLines = cartLines.flatMap(l => {
        const qscQty = qscareLines[l.product_variant_id] || 0;
        if (qscQty <= 0) return [];
        const p = products.find(prod => prod.variants?.some(v => v.id === l.product_variant_id));
        if (!p || !isHardwareProduct(p)) return [];
        const unitPrice = parseFloat(p.qscare_price) || 0;
        if (unitPrice <= 0) return [];
        return [{
          product_variant_id: null,
          qty: qscQty,
          is_service: true,
          service_name: `QScare — ${l.name}`,
          unit_price: unitPrice,
        }];
      });

      await ordersApi.place({
        channel: 'pos',
        store_id: selectedStoreId || null,
        warehouse_id: Number(warehouseId) || null,
        employee_id: empId,
        sold_by_employee_id: empId,
        customer_id: selectedCustomer?.id ?? null,
        promotion_id: appliedPromo?.id ?? null,
        lines: [
          ...cartLines.map(l => ({ product_variant_id: l.product_variant_id, qty: l.qty })),
          ...qscareServiceLines,
        ],
        notes: note + (payload.receipt_type ? ` [${payload.receipt_type}]` : ''),
        status: 'paid',
        payments: payload.payments,
        // Invia lo sconto combinato (promo + cliente) calcolato nel POS
        // NON sommiamo il payload.order_discount_amount del modal (che già parte da cartTotalFinal)
        order_discount_amount: totalCombinedDiscount > 0 ? totalCombinedDiscount : (payload.order_discount_amount ?? 0),
      });
      toast.success('✅ Vendita completata!');
      setCartLines([]); setSelectedCustomer(null); setNote(''); setShowCheckoutModal(false); setQscareLines({});
      setAppliedPromo(null); setPromoCode(''); setPromoError('');
      // Reset operatore dopo ogni vendita (deve riscannerizzare)
      setSoldByEmployeeId(''); setOperatorBarcode(''); setOperatorName(''); setOperatorError('');
      setTimeout(() => operatorBarcodeRef.current?.focus(), 100);
      // Notifica dashboard e altri componenti che è avvenuta una vendita
      window.dispatchEvent(new CustomEvent('orderPlaced'));
      clearApiCache(); fetchData();
    } catch (err) {
      const msg = err.response?.data?.errors
        ? Object.values(err.response.data.errors).flat().join(' • ')
        : err.response?.data?.message || 'Errore durante il pagamento';
      toast.error(msg);
        throw err;
    }
    finally { setPlacingOrder(false); }
  };


  /* Filters */
  const hasFeatured = products.some(p => p.is_featured);
  const filteredProducts = useMemo(() => products.filter(p => {
    const s = searchTerm.toLowerCase().trim();
    const f = flavorTerm.toLowerCase().trim();
    const hasSearch = s.length > 0 || f.length > 0;

    // Applica filtro categoria SOLO se non c'è una ricerca di testo in corso
    if (!hasSearch) {
      if (activeCategory === 'top_selling') {
        // Mostra i 20 più venduti (già in products grazie al fetch iniziale)
        // Nessun filtro ulteriore — la lista è già ordinata per vendite
      }
      if (activeCategory === 'featured' && !p.is_featured) return false;
      if (typeof activeCategory === 'number' && p.category_id !== activeCategory) return false;
    }


    const matchS = !s || p.name?.toLowerCase().includes(s) 
      || p.sku?.toLowerCase().includes(s) 
      || p.barcode?.toLowerCase().includes(s)
      || p.variants?.some(v => v.barcode?.toLowerCase().includes(s) || v.sku?.toLowerCase().includes(s));
    // Fix ricerca aroma: controlla anche description e tags, normalizza accenti
    const normalize = str => (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const fNorm = normalize(f);
    const matchF = !f || p.variants?.some(v =>
      normalize(v.flavor)?.includes(fNorm) ||
      normalize(v.description)?.includes(fNorm)
    ) || normalize(p.name)?.includes(fNorm) || normalize(p.description)?.includes(fNorm);
    const matchC = true; // category match gestito sopra
    return matchS && matchF && matchC;
  }).slice(0, 30), [products, searchTerm, flavorTerm, activeCategory]);

  const filteredCustomers = useMemo(() => {
    const s = customerSearch.toLowerCase().trim();
    if (!s) return allCustomers.slice(0, 8);
    return allCustomers.filter(c => {
      // Per i dipendenti, ricerca solo per nome/cognome/codice tessera (no dati sensibili)
      const fields = isDipendente
        ? [c.first_name, c.last_name, c.code, String(c.id)]
        : [c.name, c.email, c.first_name, c.last_name, c.fidelity_card, c.phone, c.code, String(c.id)];
      const haystack = fields.filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(s);
    }).slice(0, 8);
  }, [allCustomers, customerSearch, isDipendente]);

  // Auto-selezione cliente: invio automatico dopo essersi fermati per 1 secondo
  useEffect(() => {
    if (!customerSearch.trim() || selectedCustomer) return;
    const delayId = setTimeout(() => {
      const s = customerSearch.trim().toLowerCase();
      const exactMatch = allCustomers.find(c =>
        (c.fidelity_card && c.fidelity_card.toLowerCase() === s) ||
        (c.phone         && c.phone.toLowerCase()         === s) ||
        (c.email         && c.email.toLowerCase()         === s) ||
        (c.code          && c.code.toLowerCase()          === s) ||
        String(c.id) === s
      );
      if (exactMatch) {
        setSelectedCustomer(exactMatch);
        setCustomerSearch('');
        setShowCustomerDrop(false);
        toast.success(`Cliente: ${exactMatch.name || `${exactMatch.first_name || ''} ${exactMatch.last_name || ''}`}`, { icon: '👤' });
      }
    }, 1000); // 1 SECONDO WAIT
    return () => clearTimeout(delayId);
  }, [customerSearch, allCustomers, selectedCustomer]);

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

  /* Barcode scan su Enter — prodotto o fidelity card cliente */
  const handleSearchKey = async (e) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      const bc = searchTerm.trim().toLowerCase();
      let match = products.find(p =>
        p.barcode?.toLowerCase() === bc ||
        p.sku?.toLowerCase() === bc ||
        p.variants?.some(v =>
          v.barcode?.toLowerCase() === bc ||
          v.sku?.toLowerCase() === bc
        )
      );

      if (!match) {
        // Fallback server per barcode non caricati in memoria
        try {
          const res = await catalog.getProducts({ barcode: searchTerm.trim(), limit: 1 });
          if (res.data?.data?.length > 0) {
            match = res.data.data[0];
            setProducts(prev => {
              const map = new Map(prev.map(p => [p.id, p]));
              map.set(match.id, match);
              return Array.from(map.values());
            });
          }
        } catch {}
      }

      if (match) {
        addToCart(match);
        setSearchTerm('');
        searchRef.current?.focus();
      } else {
        toast.error('Prodotto non indicato in anagrafica');
      }
    }
  };

  /* Barcode scan fidelity card nel campo cliente */
  const handleCustomerBarcode = (e) => {
    if (e.key === 'Enter' && customerSearch) {
      const found = allCustomers.find(c =>
        c.fidelity_card === customerSearch ||
        c.phone === customerSearch ||
        c.email?.toLowerCase() === customerSearch.toLowerCase()
      );
      if (found) {
        setSelectedCustomer(found);
        setCustomerSearch('');
        setShowCustomerDrop(false);
        toast.success(`Cliente: ${found.name}`, { icon: '👤' });
      } else {
        toast.error('Cliente non trovato con questo codice');
      }
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#7B6FD0', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ fontSize: 14, color: '#9ca3af', fontWeight: 600 }}>Caricamento POS in corso...</p>
    </div>
  );

  return (
    <div className="sp-pos-layout">
      {/* ─── SINISTRA: Catalogo ─────────────────────────────── */}
      <div className="sp-pos-products">

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

          {/* Toggle Top Selling */}
          <button
            onClick={() => setActiveCategory('top_selling')}
            style={{
              padding: '7px 18px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
              background: activeCategory === 'top_selling' ? 'linear-gradient(135deg,#7B6FD0,#4F46E5)' : '#fff',
              color: activeCategory === 'top_selling' ? '#fff' : '#6b7280',
              boxShadow: activeCategory === 'top_selling' ? '0 4px 12px rgba(123,111,208,0.4)' : '0 1px 3px rgba(0,0,0,0.07)',
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            🏆 Top 20
          </button>

          {/* Toggle In Evidenza (Preferiti) */}

          <button
            onClick={() => setActiveCategory('featured')}
            style={{
              padding: '7px 18px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
              background: activeCategory === 'featured' ? 'linear-gradient(135deg,#FBBF24,#D97706)' : '#fff',
              color: activeCategory === 'featured' ? '#fff' : '#6b7280',
              boxShadow: activeCategory === 'featured' ? '0 4px 12px rgba(251,191,36,0.35)' : '0 1px 3px rgba(0,0,0,0.07)',
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <Star size={14} fill={activeCategory === 'featured' ? '#fff' : 'none'} color={activeCategory === 'featured' ? '#fff' : '#FBBF24'} /> Preferiti
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

        {/* ─── CROSS-SELL — Sezione grande fuori dal carrello ─── */}
        {crossSell.length > 0 && (
          <div style={{ flexShrink: 0, paddingBottom: 16, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Zap size={13} color="#FBBF24" />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Potrebbe interessarti</span>
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {crossSell.map(p => {
                const pal = catPalette(p.category_id);
                const imgUrl = p.image_url ? getImageUrl(p.image_url) : null;
                const sv = p.variants?.[0];
                const sInfo = sv ? stockMap[sv.id] : null;
                const avail = sv?.stock_quantity ?? sv?.on_hand ?? sInfo?.on_hand ?? 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={avail <= 0}
                    style={{
                      flexShrink: 0, width: 130, background: '#fff', border: '1.5px solid #eee',
                      borderRadius: 14, overflow: 'hidden', textAlign: 'left', cursor: avail > 0 ? 'pointer' : 'not-allowed',
                      opacity: avail > 0 ? 1 : 0.45, transition: 'all 0.15s', padding: 0,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    }}
                    onMouseEnter={e => { if (avail > 0) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.12)'; } }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
                  >
                    <div style={{ height: 72, overflow: 'hidden' }}>
                      {imgUrl
                        ? <img src={imgUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', background: pal.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Package size={22} color="rgba(255,255,255,0.6)" />
                          </div>
                      }
                    </div>
                    <div style={{ padding: '8px 10px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{p.name}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 900, color: pal.accent }}>{fmt(parseFloat(sv?.sale_price) || 0)}</span>
                        <span style={{ fontSize: 9, background: avail > 0 ? '#d1fae5' : '#fee2e2', color: avail > 0 ? '#065f46' : '#991b1b', borderRadius: 6, padding: '1px 5px', fontWeight: 700 }}>{avail > 0 ? avail : '✕'}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── DESTRA: Carrello ───────────────────────────────── */}
      <div className="sp-pos-cart">

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
            {soldByEmployeeId && (
              <button
                onClick={() => setShowMyShifts(true)}
                style={{ background: 'rgba(99,102,241,0.15)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#a5b4fc', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                <CalendarIcon size={12} /> Turni
              </button>
            )}
            <button
              onClick={() => setShowResoModal(true)}
              style={{ background: 'rgba(251,191,36,0.12)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#fbbf24', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
              <RotateCcw size={12} /> Reso
            </button>
          </div>

          {/* ─── Operatore + Cliente in 2 colonne ─── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

            {/* Operatore */}
            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                <ScanBarcode size={9} /> Operatore
              </div>
              {soldByEmployeeId ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '7px 10px', minHeight: 36 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#86efac', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>✓ {operatorName}</span>
                  <button onClick={() => { setSoldByEmployeeId(''); setOperatorBarcode(''); setOperatorName(''); setOperatorError(''); setTimeout(() => operatorBarcodeRef.current?.focus(), 50); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex', flexShrink: 0 }}>
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input
                    ref={operatorBarcodeRef}
                    value={operatorBarcode}
                    onChange={e => {
                      setOperatorBarcode(e.target.value);
                      setOperatorError('');
                      setShowOperatorDrop(e.target.value.trim().length > 0);
                    }}
                    onKeyDown={async e => {
                      if (e.key === 'Escape') { setShowOperatorDrop(false); return; }
                      if (e.key === 'Enter' && operatorBarcode.trim()) {
                        const val = operatorBarcode.trim();
                        const valLow = val.toLowerCase();
                        const empFull = (em) => ((em.first_name || '') + ' ' + (em.last_name || '')).toLowerCase();
                        let found = employees.find(em =>
                          (em.barcode && em.barcode.toLowerCase() === valLow) ||
                          em.id.toString() === valLow ||
                          empFull(em).includes(valLow) ||
                          (em.employee_code && em.employee_code.toLowerCase() === valLow)
                        );
                        if (!found) {
                          try {
                            const { employees: empApi } = await import('../api.jsx');
                            const res = await empApi.getEmployees({ search: val, limit: 10 });
                            found = (res.data?.data || [])[0];
                          } catch {}
                        }
                        if (found) {
                          setSoldByEmployeeId(String(found.id));
                          setOperatorName(((found.first_name || '') + ' ' + (found.last_name || '')).trim() || ('Operatore #' + found.id));
                          setOperatorError('');
                          setOperatorBarcode('');
                          setShowOperatorDrop(false);
                        } else {
                          setOperatorError('"' + val + '" non trovato');
                          setOperatorBarcode('');
                        }
                      }
                    }}
                    onBlur={() => setTimeout(() => setShowOperatorDrop(false), 150)}
                    onFocus={() => operatorBarcode.trim() && setShowOperatorDrop(true)}
                    placeholder="Nome o Badge..."
                    autoFocus
                    style={{
                      width: '100%',
                      background: operatorError ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.06)',
                      border: '1px solid ' + (operatorError ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'),
                      borderRadius: 8, padding: '7px 10px', fontSize: 11, fontWeight: 600, color: '#fff',
                      outline: 'none', fontFamily: 'inherit', letterSpacing: 0, boxSizing: 'border-box',
                    }}
                  />
                  {showOperatorDrop && (() => {
                    const q = operatorBarcode.trim().toLowerCase();
                    if (!q) return null;
                    const empFull = (em) => ((em.first_name || '') + ' ' + (em.last_name || '')).toLowerCase();
                    const suggestions = employees.filter(em =>
                      empFull(em).includes(q) ||
                      (em.barcode && em.barcode.toLowerCase().includes(q)) ||
                      em.id.toString().includes(q)
                    ).slice(0, 8);
                    if (!suggestions.length) return null;
                    return (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 300,
                        background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                      }}>
                        {suggestions.map(em => (
                          <div
                            key={em.id}
                            onMouseDown={() => {
                              setSoldByEmployeeId(String(em.id));
                              setOperatorName(((em.first_name || '') + ' ' + (em.last_name || '')).trim() || ('Operatore #' + em.id));
                              setOperatorBarcode('');
                              setOperatorError('');
                              setShowOperatorDrop(false);
                            }}
                            style={{
                              padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                              color: '#fff', display: 'flex', alignItems: 'center', gap: 8,
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(123,111,208,0.25)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(123,111,208,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>
                              {(em.first_name || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <div>{em.first_name} {em.last_name}</div>
                              {em.store_name && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{em.store_name}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {operatorError && <div style={{ fontSize: 10, color: '#fc8181', marginTop: 4 }}>&#9888; {operatorError}</div>}
                </div>
              )}
            </div>

            {/* Cliente */}
            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                <User size={9} /> Cliente
              </div>
              {selectedCustomer ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(123,111,208,0.15)', border: '1px solid rgba(123,111,208,0.3)', borderRadius: 8, padding: '7px 10px', minHeight: 36 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedCustomer.name}</div>
                    {customerDiscountPct > 0 && (
                      <div style={{ fontSize: 9, fontWeight: 800, color: '#86efac' }}>🎟️ -{customerDiscountPct}%</div>
                    )}
                  </div>
                  <button onClick={() => setSelectedCustomer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex', flexShrink: 0 }}>
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <User size={11} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
                  <input
                    value={customerSearch}
                    onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true); }}
                    onFocus={() => setShowCustomerDrop(true)}
                    onKeyDown={handleCustomerBarcode}
                    placeholder="Nome, tessera..."
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8, padding: '7px 10px 7px 28px', fontSize: 11, color: '#fff', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  {showCustomerDrop && customerSearch && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: 4, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                      {filteredCustomers.map(c => (
                        <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setShowCustomerDrop(false); }}
                          style={{ display: 'block', width: '100%', padding: '9px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#fff' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(123,111,208,0.15)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{c.first_name || c.name} {c.last_name || ''}</div>
                          {!isDipendente && c.email && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{c.email}</div>}
                          {c.code && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Tessera: {c.code}</div>}
                        </button>
                      ))}
                      {filteredCustomers.length === 0 && <div style={{ padding: 12, fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>Nessun cliente</div>}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Cart Summary compatta — lista completa nel modal checkout */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 22px' }}>
          {cartLines.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, opacity: 0.3 }}>
              <ShoppingCart size={52} color="#fff" />
              <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, margin: 0 }}>Carrello vuoto</p>
              <p style={{ color: '#fff', fontSize: 11, margin: 0 }}>Clicca un prodotto per aggiungerlo</p>
            </div>
          ) : (
            <div style={{ paddingTop: 4 }}>
              {/* Riepilogo compatto — ogni articolo come riga slim */}
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 10 }}>
                {cartLines.map((line, idx) => (
                  <div key={line.product_variant_id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', gap: 8,
                    borderBottom: idx < cartLines.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {line.name}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>x{line.qty}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#c4b5fd' }}>
                        {(line.price * line.qty).toLocaleString('it-IT', { minimumFractionDigits: 2 })} €
                      </span>
                      <button
                        onClick={() => removeFromCart(line.product_variant_id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', display: 'flex', padding: 0 }}
                        title="Rimuovi"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>


              {/* Codice Promozionale */}
              <div style={{ marginTop: 10 }}>
                {appliedPromo ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 10, padding: '8px 12px' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#a5b4fc' }}>🎟️ {appliedPromo.name}</div>
                      <div style={{ fontSize: 10, color: 'rgba(165,180,252,0.7)', marginTop: 1 }}>
                        Sconto: {appliedPromo.type === 'percentage' ? `${appliedPromo.value}%` : `€${appliedPromo.value}`}
                      </div>
                    </div>
                    <button onClick={() => { setAppliedPromo(null); setPromoError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(165,180,252,0.6)', display: 'flex' }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <Tag size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: promoError ? '#fc8181' : 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
                      <input
                        ref={promoRef}
                        value={promoCode}
                        onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError(''); }}
                        onKeyDown={e => e.key === 'Enter' && applyPromoCode()}
                        placeholder="Codice promozionale..."
                        style={{
                          width: '100%', background: promoError ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${promoError ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.1)'}`,
                          borderRadius: 10, padding: '8px 10px 8px 30px', fontSize: 11, fontWeight: 700,
                          color: '#fff', outline: 'none', letterSpacing: '0.08em', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <button
                      onClick={applyPromoCode}
                      disabled={promoLoading || !promoCode.trim()}
                      style={{
                        flexShrink: 0, background: promoCode.trim() ? 'rgba(99,102,241,0.8)' : 'rgba(255,255,255,0.06)',
                        border: 'none', borderRadius: 10, padding: '0 14px', fontSize: 11, fontWeight: 800,
                        color: promoCode.trim() ? '#fff' : 'rgba(255,255,255,0.25)', cursor: promoCode.trim() ? 'pointer' : 'not-allowed',
                        transition: 'all 0.15s',
                      }}
                    >
                      {promoLoading ? '...' : 'Applica'}
                    </button>
                  </div>
                )}
                {promoError && <div style={{ fontSize: 10, color: '#fc8181', marginTop: 5, paddingLeft: 4 }}>⚠ {promoError}</div>}
              </div>
            </div>
          )}
        </div>

        {/* ─── QScare per-prodotto (una riga per ogni hardware con prezzo configurato) ─── */}
        {cartLines.length > 0 && cartHasDevice && (
          <div style={{ padding: '0 22px 12px' }}>
            {cartLines.map(line => {
              const p = products.find(prod => prod.variants?.some(v => v.id === line.product_variant_id));
              if (!p || !isHardwareProduct(p)) return null;
              const qscarePrice = parseFloat(p.qscare_price) || 0;
              if (qscarePrice <= 0) return (
                <div key={line.product_variant_id} style={{
                  background: 'rgba(234,179,8,0.08)', border: '1.5px solid rgba(234,179,8,0.2)',
                  borderRadius: 12, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
                }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ShieldCheck size={18} color="#EAB308" opacity={0.8} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(234,179,8,0.9)' }}>QScare — {line.name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Prezzo non configurato in anagrafica</div>
                  </div>
                </div>
              );
              const qscQty = qscareLines[line.product_variant_id] || 0;
              const hasQscare = qscQty > 0;
              return (
                <div
                  key={line.product_variant_id}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
                    background: hasQscare ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
                    border: `1.5px solid ${hasQscare ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 12, padding: '9px 12px', textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: hasQscare ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${hasQscare ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ShieldCheck size={18} color={hasQscare ? "#10B981" : "rgba(255,255,255,0.3)"} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: hasQscare ? '#86efac' : '#fff' }}>
                      QScare — {line.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>Copertura guasti accidentali</div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: hasQscare ? '#86efac' : 'rgba(255,255,255,0.5)' }}>
                      +{fmt(qscarePrice * qscQty)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button 
                        onClick={() => updateQscareForLine(line.product_variant_id, -1, line.qty)}
                        disabled={qscQty <= 0}
                        style={{ width: 22, height: 22, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: qscQty > 0 ? 'pointer' : 'not-allowed', opacity: qscQty > 0 ? 1 : 0.4 }}
                      >-</button>
                      <span style={{ fontSize: 11, fontWeight: 800, color: hasQscare ? '#86efac' : '#fff', minWidth: 20, textAlign: 'center' }}>
                        {qscQty} <span style={{ fontSize: 9, opacity: 0.6 }}>/ {line.qty}</span>
                      </span>
                      <button 
                        onClick={() => updateQscareForLine(line.product_variant_id, 1, line.qty)}
                        disabled={qscQty >= line.qty}
                        style={{ width: 22, height: 22, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: qscQty < line.qty ? 'pointer' : 'not-allowed', opacity: qscQty < line.qty ? 1 : 0.4 }}
                      >+</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}




        {/* Cart Footer — Total + CTA */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '16px 22px 24px' }}>


          {/* Totale */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: effectiveQscarePrice > 0 ? 4 : 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Subtotale</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: 'rgba(255,255,255,0.7)' }}>{fmt(cartTotal)}</span>
          </div>
          {effectiveQscarePrice > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#86efac' }}>🛡 QScare</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#86efac' }}>+{fmt(effectiveQscarePrice)}</span>
            </div>
          )}
          {promoDiscount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc' }}>🎟️ Sconto promo</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#a5b4fc' }}>-{fmt(promoDiscount)}</span>
            </div>
          )}
          {customerDiscountAmt > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#86efac' }}>👤 Sconto cliente ({customerDiscountPct}%)</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#86efac' }}>-{fmt(customerDiscountAmt)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Totale</span>
            <span style={{ fontSize: 28, fontWeight: 900, color: (promoDiscount > 0 || customerDiscountAmt > 0) ? '#86efac' : '#fff', letterSpacing: -1 }}>
              {fmt(cartTotalFinal)}
            </span>
          </div>


          {/* Bottone Cassa */}
          <button
            onClick={() => {
              if (!soldByEmployeeId) {
                toast.error('⚠️ Inserisci il codice operatore prima di procedere con la vendita!', { duration: 3500 });
                operatorBarcodeRef.current?.focus();
                return;
              }
              setShowCheckoutModal(true);
            }}
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
              : <><ReceiptText size={18} /> Vai alla Cassa
                {cartCount > 0 && (
                  <span style={{
                    background: 'rgba(255,255,255,0.25)',
                    borderRadius: 20,
                    padding: '1px 9px',
                    fontSize: 13,
                    fontWeight: 900,
                    marginLeft: 4,
                  }}>{cartCount}</span>
                )}
              </>
            }
          </button>
        </div>
      </div>

      {/* ─── Checkout Modal ─── */}
      {showCheckoutModal && (
        <PosCheckoutModal
          cartTotal={cartTotalFinal}
          cartLines={cartLines}
          qscareTotal={effectiveQscarePrice}
          onComplete={handleCheckout}
          onCancel={() => setShowCheckoutModal(false)}
          lockDiscount={isDipendente}
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

              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <button
                  onClick={() => { setInventoryProduct(showProductInfo); setShowProductInfo(null); }}
                  style={{ flex: 1, padding: '12px 0', border: '1.5px solid #10B981', background: 'rgba(16,185,129,0.1)', color: '#10B981', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <MapPin size={16} /> Cerca in altri negozi
                </button>
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
      {showMyShifts && (
        <MyShiftsModal
          employeeId={soldByEmployeeId}
          employeeName={operatorName}
          onClose={() => setShowMyShifts(false)}
        />
      )}
      {/* Reso Modal */}
      {showResoModal && <PosResoModal
        storeId={selectedStoreId}
        onClose={() => setShowResoModal(false)}
        onDone={() => { setShowResoModal(false); clearApiCache(); fetchData(); }}
      />}
      
      {/* ─── Modal Giacenze Multi-Store ─── */}
      {inventoryProduct && (
        <ProductInventoryModal product={inventoryProduct} onClose={() => setInventoryProduct(null)} />
      )}
    </div>
  );
}

/* ─── Modal Reso POS ──────────────────────────────────────────── */
function PosResoModal({ storeId, onClose, onDone }) {
  const [orderId, setOrderId] = useState('');
  const [order, setOrder]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [reason, setReason]   = useState('customer_request');
  const [lines, setLines]     = useState([]);

  const searchOrder = async () => {
    if (!orderId.trim()) return;
    // Rimuove '#', spazi e zeri iniziali — accetta sia "42" che "#000042" che "  42 "
    const cleanId = orderId.trim().replace(/^#0*/, '').replace(/\D/g, '') || orderId.trim().replace(/^#/, '').trim();
    if (!cleanId) return;
    try {
      setLoading(true); setError(''); setOrder(null);
      const { orders: ordersApi2 } = await import('../api.jsx');
      const res = await ordersApi2.getOrder(cleanId);
      const o = res.data?.data || res.data;
      if (!o) { setError('Ordine non trovato.'); return; }
      setOrder(o);
      setLines((o.lines || []).map(l => ({ ...l, qty_return: l.qty || 1 })));
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) {
        setError(`Ordine #${cleanId} non trovato. Controlla il numero e riprova.`);
      } else {
        setError(err.response?.data?.message || 'Errore di connessione. Riprova.');
      }
    }
    finally { setLoading(false); }
  };


  const handleReso = async () => {
    if (!order) return;
    try {
      setSaving(true); setError('');
      const api2 = await import('../api.jsx');
      await api2.default.post('/returns', {
        original_order_id: order.id,
        store_id: storeId,
        reason,
        lines: lines.filter(l => l.qty_return > 0).map(l => ({
          product_variant_id: l.product_variant_id,
          qty: l.qty_return,
          unit_refund_amount: l.unit_price ?? l.sale_price ?? 0,
        })),
      });
      toast.success('✅ Reso registrato correttamente');
      onDone();
    } catch (e) {
      setError(e.response?.data?.message || 'Errore nella registrazione del reso');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 500, boxShadow: '0 32px 80px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: '#0f172a', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RotateCcw size={18} color="#fbbf24" />
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>Reso / Rimborso</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}><X size={18}/></button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Cerca ordine */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', display: 'block', marginBottom: 6 }}>N. Ordine</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={orderId}
                onChange={e => setOrderId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchOrder()}
                placeholder="Inserisci il numero ordine (es. 42)"
                autoFocus
                style={{ flex: 1, padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none' }}
              />
              <button onClick={searchOrder} disabled={loading}
                style={{ padding: '10px 18px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                {loading ? '...' : 'Cerca'}
              </button>
            </div>
          </div>

          {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px', color: '#dc2626', fontSize: 13 }}>{error}</div>}

          {order && (
            <>
              <div style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 16px', fontSize: 13 }}>
                <strong>Ordine #{order.id}</strong> — {order.customer_name || 'Cliente anonimo'} — {new Date(order.created_at).toLocaleDateString('it-IT')}
              </div>

              {/* Motivazione */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', display: 'block', marginBottom: 6 }}>Motivazione</label>
                <select value={reason} onChange={e => setReason(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none' }}>
                  <option value="customer_request">Richiesta cliente</option>
                  <option value="bottiglia_danneggiata">Bottiglia danneggiata</option>
                  <option value="sigaretta_non_accende">Sigaretta non si accende</option>
                  <option value="sigaretta_graffiata">Sigaretta graffiata</option>
                  <option value="resistenza_difettosa">Resistenza difettosa</option>
                  <option value="atomizzatore_perde">Atomizzatore perde liquido</option>
                  <option value="other">Altro</option>
                </select>
              </div>

              {/* Righe reso */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', display: 'block', marginBottom: 8 }}>Prodotti da restituire</label>
                {lines.map((l, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{l.product_name || `Variante #${l.product_variant_id}`}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>max {l.qty}</div>
                    <input type="number" min="0" max={l.qty} value={l.qty_return}
                      onChange={e => { const ls = [...lines]; ls[i] = { ...ls[i], qty_return: Math.min(l.qty, Math.max(0, parseInt(e.target.value)||0)) }; setLines(ls); }}
                      style={{ width: 60, padding: '6px 8px', border: '1.5px solid #e5e7eb', borderRadius: 8, textAlign: 'center', fontWeight: 700, fontSize: 13, outline: 'none' }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid #f0f0f0' }}>
                <button onClick={onClose} style={{ padding: '10px 18px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: 13 }}>Annulla</button>
                <button onClick={handleReso} disabled={saving || lines.every(l => l.qty_return === 0)}
                  style={{ padding: '10px 20px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                  {saving ? 'Registrazione...' : '✓ Registra Reso'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Modal "I Miei Turni" POS ────────────────────────────────────── */
function MyShiftsModal({ employeeId, employeeName, onClose }) {
  const [myShifts, setMyShifts] = React.useState([]);
  const [loading, setLoading]   = React.useState(true);

  React.useEffect(() => {
    if (!employeeId) return;
    const now = new Date();
    const start = new Date(now); start.setDate(start.getDate() - 3);
    const end   = new Date(now); end.setDate(end.getDate() + 14);
    const fmtD = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    import('../api.jsx').then(({ shifts: shiftsAPI }) => {
      shiftsAPI.getAll({ employee_id: employeeId, start_date: fmtD(start), end_date: fmtD(end) })
        .then(res => setMyShifts(res.data?.data || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, [employeeId]);

  const DAY_IT = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
      onClick={onClose}>
      <div style={{ background:'#0f172a', borderRadius:20, width:'100%', maxWidth:400, boxShadow:'0 32px 80px rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.08)', overflow:'hidden' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding:'18px 22px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'rgba(99,102,241,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <CalendarIcon size={18} color="#a5b4fc" />
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:800, color:'#fff' }}>I Miei Turni</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>{employeeName}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.4)' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding:'16px 22px 22px', maxHeight:420, overflowY:'auto' }}>
          {loading ? (
            <div style={{ textAlign:'center', padding:'32px 0', color:'rgba(255,255,255,0.3)' }}>
              <Loader2 size={24} style={{ margin:'0 auto 8px', display:'block' }} />
              <div style={{ fontSize:12 }}>Caricamento turni...</div>
            </div>
          ) : myShifts.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px 0', color:'rgba(255,255,255,0.3)', fontSize:13 }}>
              📅 Nessun turno assegnato nei prossimi giorni
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {myShifts.map(s => {
                const d = new Date(s.date + 'T12:00:00');
                const isToday = s.date === today;
                const isPast  = s.date < today;
                return (
                  <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:12, background: isToday ? 'rgba(16,185,129,0.12)' : isPast ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)', border: isToday ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.07)', opacity: isPast ? 0.6 : 1 }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background: s.color || '#7B6FD0', flexShrink:0 }} />
                    <div style={{ minWidth:90 }}>
                      <div style={{ fontSize:12, fontWeight:800, color: isToday ? '#86efac' : '#fff' }}>
                        {isToday ? '📍 OGGI' : DAY_IT[d.getDay()]} {d.getDate()}/{d.getMonth()+1}
                      </div>
                      {s.store?.name && <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginTop:1 }}>{s.store.name}</div>}
                    </div>
                    <div style={{ marginLeft:'auto', textAlign:'right' }}>
                      {s.start_time && s.end_time ? (
                        <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.85)', fontFamily:'monospace' }}>{s.start_time.slice(0,5)} – {s.end_time.slice(0,5)}</div>
                      ) : (
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>Orario non impostato</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
