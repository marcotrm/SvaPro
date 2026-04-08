import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { catalog, suppliers, inventory, stores as storesApi } from '../api.jsx';
import { getImageUrl } from '../api.jsx';
import CatalogModal from '../components/CatalogModal.jsx';
import { Search, Plus, Package, Layers, AlertTriangle, MapPin, Edit3, PackagePlus } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function CatalogPage() {
  const navigate = useNavigate();
  const { selectedStoreId, displayMode, selectedStore } = useOutletContext();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [suppliersList, setSuppliersList] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockPopover, setStockPopover] = useState(null);
  const [warehousesList, setWarehousesList] = useState([]);

  useEffect(() => { fetchData(); }, [selectedStoreId]);

  const fetchData = async () => {
    try {
      setLoading(true); setError('');
      const sp = selectedStoreId ? { store_id: selectedStoreId } : {};
      const [pRes, sRes, cRes] = await Promise.all([
        catalog.getProducts({ ...sp, limit: 200 }),
        suppliers.getAll().catch(() => ({ data: { data: [] } })),
        catalog.getCategories()
      ]);
      setProducts(pRes.data?.data || []);
      setSuppliersList(sRes.data?.data || []);
      setCategories(cRes.data?.data || []);
      // Carica magazzini (per adjust stock)
      try {
        const wRes = await inventory.getStock({ limit: 1 });
        // Recupera l'ID del primo magazzino dall'inventario esistente oppure fallback
        const firstWarehouseId = wRes.data?.data?.[0]?.warehouse_id || null;
        if (firstWarehouseId) setWarehousesList([{ id: firstWarehouseId }]);
      } catch {}
    } catch (err) {
      setError(err.message || 'Errore caricamento dati');
    } finally { setLoading(false); }
  };

  const filtered = products.filter(p => {
    const s = searchTerm.toLowerCase();
    const matchSearch = !s || p.name?.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s);
    const matchCat = categoryFilter === 'all' || p.category_id === parseInt(categoryFilter);
    return matchSearch && matchCat;
  });

  const lowStockCount = products.filter(p => {
    const qty = p.variants?.[0]?.stock_quantity ?? 0;
    return qty > 0 && qty < 5;
  }).length;
  const outOfStockCount = products.filter(p => (p.variants?.[0]?.stock_quantity ?? 0) <= 0).length;

  const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);

  const handleQuickStock = async (variantId, qty) => {
    if (!qty || isNaN(parseInt(qty)) || parseInt(qty) === 0) {
      toast.error('Inserisci una quantità valida');
      return;
    }
    const warehouseId = warehousesList[0]?.id;
    if (!warehouseId) {
      toast.error('Nessun magazzino configurato. Vai in Magazzino per crearne uno.');
      return;
    }
    try {
      await inventory.adjustStock({
        warehouse_id: warehouseId,
        product_variant_id: variantId,
        qty: parseInt(qty),
        movement_type: 'adjustment',
      });
      toast.success(`Quantità aggiornata (+${qty})`);
      setStockPopover(null);
      fetchData();
    } catch (err) {
      const msgs = err.response?.data?.errors
        ? Object.values(err.response.data.errors).flat().join(' • ')
        : err.response?.data?.message || 'Errore aggiornamento stock';
      toast.error(msgs);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%' }} className="sp-spin" />
    </div>
  );

  return (
    <div className="sp-animate-in">
      {/* Header */}
      <div className="sp-page-header">
        <div>
          <h1 className="sp-page-title">Catalogo Prodotti</h1>
          <p className="sp-page-subtitle">
            <Package size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            {products.length} referenze{selectedStore ? ` — ${selectedStore.name}` : ''}
          </p>
        </div>
        <div className="sp-page-actions">
          <button className="sp-btn sp-btn-secondary" onClick={() => navigate('/catalog/categories')}>
            <Layers size={16} /> Categorie
          </button>
          <button className="sp-btn sp-btn-primary" onClick={() => { setSelectedProduct(null); setShowModal(true); }}>
            <Plus size={16} /> Nuovo Prodotto
          </button>
        </div>
      </div>

      {error && (
        <div className="sp-alert sp-alert-error">
          <AlertTriangle size={16} /> {error}
          <button className="sp-btn sp-btn-ghost sp-btn-sm" onClick={fetchData} style={{ marginLeft: 'auto' }}>Riprova</button>
        </div>
      )}

      {/* Stats */}
      <div className="sp-stats-grid">
        <div className="sp-stat-card">
          <div className="sp-stat-label">Totale Prodotti</div>
          <div className="sp-stat-value">{products.length}</div>
        </div>
        <div className="sp-stat-card">
          <div className="sp-stat-label">Categorie</div>
          <div className="sp-stat-value">{categories.filter(c => !c.parent_id).length}</div>
        </div>
        <div className="sp-stat-card">
          <div className="sp-stat-label">Stock Basso</div>
          <div className="sp-stat-value" style={{ color: lowStockCount > 0 ? 'var(--color-warning)' : 'inherit' }}>{lowStockCount}</div>
        </div>
        <div className="sp-stat-card">
          <div className="sp-stat-label">Esaurito</div>
          <div className="sp-stat-value" style={{ color: outOfStockCount > 0 ? 'var(--color-error)' : 'inherit' }}>{outOfStockCount}</div>
        </div>
      </div>

      {/* Table */}
      <div className="sp-table-wrap">
        <div className="sp-table-toolbar">
          <div className="sp-search-box" style={{ flex: 1, maxWidth: 300 }}>
            <Search size={14} />
            <input className="sp-input" placeholder="Cerca prodotto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <select className="sp-select" style={{ maxWidth: 200 }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">Tutte le categorie</option>
            {categories.filter(c => !c.parent_id).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            {filtered.length} risultati
          </span>
        </div>
        <table className="sp-table">
          <thead>
            <tr>
              <th>Prodotto</th>
              <th>SKU</th>
              <th>Categoria</th>
              <th>Ubicazione</th>
              <th>Prezzo</th>
              <th>Stock</th>
              <th>Stato</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(product => {
              const variant = product.variants?.[0];
              const price = parseFloat(variant?.sale_price) || 0;
              const stock = variant?.stock_quantity ?? 0;
              const category = categories.find(c => c.id === product.category_id);
              const location = variant?.location;

              return (
                <tr key={product.id}>
                  <td className="sp-cell-primary" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {product.image_url ? (
                      <img src={getImageUrl(product.image_url)} alt={product.name}
                        style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--color-border)' }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--color-border)' }}>
                        <Package size={16} style={{ opacity: 0.3 }} />
                      </div>
                    )}
                    <span>{product.name}</span>
                  </td>
                  <td className="sp-cell-secondary sp-font-mono">{product.sku || '—'}</td>
                  <td>
                    {category ? (
                      <span className="sp-badge sp-badge-neutral">{category.name}</span>
                    ) : <span className="sp-cell-secondary">—</span>}
                  </td>
                  <td>
                    {location ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        <MapPin size={12} /> {location}
                      </span>
                    ) : <span className="sp-cell-secondary">—</span>}
                  </td>
                  <td style={{ fontWeight: 600 }}>{fmt(price)}</td>
                  <td>
                    <span className="sp-font-mono" style={{ fontWeight: 600, color: stock <= 0 ? 'var(--color-error)' : stock < 5 ? 'var(--color-warning)' : 'var(--color-text)' }}>
                      {stock}
                    </span>
                  </td>
                  <td>
                    {stock <= 0 ? (
                      <span className="sp-badge sp-badge-error"><span className="sp-badge-dot" /> Esaurito</span>
                    ) : stock < 5 ? (
                      <span className="sp-badge sp-badge-warning"><span className="sp-badge-dot" /> Basso</span>
                    ) : (
                      <span className="sp-badge sp-badge-success"><span className="sp-badge-dot" /> Disponibile</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', position: 'relative' }}>
                      <button 
                        className="sp-btn sp-btn-ghost sp-btn-sm"
                        onClick={() => { setSelectedProduct(product); setShowModal(true); }}
                        title="Modifica prodotto"
                      >
                        <Edit3 size={14} />
                      </button>
                      {/* Quick stock button */}
                      <button
                        className="sp-btn sp-btn-ghost sp-btn-sm"
                        title="Aggiungi quantità"
                        onClick={() => setStockPopover(stockPopover?.variantId === variant?.id ? null : { variantId: variant?.id, productName: product.name, qty: '' })}
                      >
                        <PackagePlus size={14} />
                      </button>
                      {/* Popover stock */}
                      {stockPopover?.variantId === variant?.id && (
                        <div style={{
                          position: 'absolute', right: 0, top: '100%', zIndex: 100, marginTop: 4,
                          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                          borderRadius: 12, padding: 14, boxShadow: 'var(--shadow-md)', minWidth: 200,
                        }}>
                          <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--color-text)' }}>Aggiungi pezzi a magazzino</p>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              autoFocus
                              type="number" min="1"
                              className="sp-input"
                              style={{ fontSize: 13, width: 80 }}
                              placeholder="Q.tà"
                              value={stockPopover.qty}
                              onChange={e => setStockPopover(p => ({ ...p, qty: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') handleQuickStock(variant.id, stockPopover.qty); if (e.key === 'Escape') setStockPopover(null); }}
                            />
                            <button className="sp-btn sp-btn-primary sp-btn-sm" onClick={() => handleQuickStock(variant.id, stockPopover.qty)}>OK</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan="8" className="sp-table-empty">Nessun prodotto trovato</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CatalogModal
          product={selectedProduct}
          storesList={[]}
          categories={categories}
          suppliers={suppliersList}
          onClose={() => { setShowModal(false); setSelectedProduct(null); }}
          onSave={() => { setShowModal(false); setSelectedProduct(null); fetchData(); }}
        />
      )}
    </div>
  );
}
