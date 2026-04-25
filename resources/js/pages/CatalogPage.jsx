import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { catalog, suppliers, inventory, orders as ordersApi, clearApiCache } from '../api.jsx';
import { getImageUrl } from '../api.jsx';
import api from '../api.jsx';
import CatalogModal from '../components/CatalogModal.jsx';
import ProductInventoryModal from '../components/ProductInventoryModal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import BulkExciseModal from '../components/BulkExciseModal.jsx';
import { Search, Plus, Package, Layers, AlertTriangle, MapPin, Edit3, Copy, Upload, X, CheckCircle, Loader2, ShoppingBag, Star, Trash2, DollarSign, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function CatalogPage() {
  const navigate = useNavigate();
  const { selectedStoreId, displayMode, selectedStore, user } = useOutletContext();
  const isDipendente = (user?.roles || []).includes('dipendente') || user?.role === 'dipendente';
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmToDelete, setConfirmToDelete] = useState(null); // product | null
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [suppliersList, setSuppliersList] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [duplicating, setDuplicating] = useState(null); // product id in corso
  const [showPsImport, setShowPsImport] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [showBulkExcise, setShowBulkExcise] = useState(false);
  const [inventoryProduct, setInventoryProduct] = useState(null);
  
  // Paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 100;

  // Resetta la pagina quando cambiano i filtri
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter]);

  useEffect(() => { fetchData(); }, [selectedStoreId]);

  const fetchData = async () => {
    try {
      setLoading(true); setError('');
      // Invalida la cache ogni volta per avere sempre dati aggiornati
      clearApiCache();
      // Catalogo admin: mostra SEMPRE tutti i prodotti del tenant (no filtro store_id)
      // L'assegnazione per negozio è già inclusa in variant.assigned_stores nella risposta
      const [pRes, sRes, cRes] = await Promise.all([
        catalog.getProducts({ limit: 10000 }),
        suppliers.getAll().catch(() => ({ data: { data: [] } })),
        catalog.getCategories()
      ]);
      setProducts(pRes.data?.data || []);
      setSuppliersList(sRes.data?.data || []);
      setCategories(cRes.data?.data || []);
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

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const currentFiltered = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const lowStockCount = products.filter(p => {
    const qty = p.variants?.[0]?.stock_quantity ?? 0;
    return qty > 0 && qty < 5;
  }).length;
  const outOfStockCount = products.filter(p => (p.variants?.[0]?.stock_quantity ?? 0) <= 0).length;

  const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);

  const handleToggleFeatured = async (product) => {
    const newVal = !product.is_featured;
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_featured: newVal } : p));
    try {
      await catalog.toggleFeatured(product.id, newVal);
      toast.success(newVal ? `⭐ "${product.name}" messo in evidenza nel POS` : `"${product.name}" rimosso dall'evidenza`, { duration: 2000 });
    } catch (err) {
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_featured: !newVal } : p));
      toast.error('Errore nell\'aggiornamento');
    }
  };

  const handleToggleOnline = async (product) => {
    const newVal = !product.is_online;
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_online: newVal } : p));
    try {
      await catalog.toggleOnline(product.id, newVal);
      toast.success(newVal ? `🌐 "${product.name}" attivo online` : `🚫 "${product.name}" nascosto online`, { duration: 2000 });
    } catch (err) {
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_online: !newVal } : p));
      toast.error(err.response?.data?.message || 'Errore nell\'aggiornamento');
    }
  };

  const handleDuplicate = async (product) => {
    setDuplicating(product.id);
    try {
      const existingSkus = new Set(products.map(p => p.sku));
      let newSku = product.sku ? `${product.sku}-COPIA` : `COPIA-${product.id}`;
      let attempt = 1;
      while (existingSkus.has(newSku)) {
        attempt++;
        newSku = product.sku ? `${product.sku}-COPIA-${attempt}` : `COPIA-${product.id}-${attempt}`;
      }

      const payload = {
        sku:         newSku,
        name:        product.name + ' (Copia)',
        product_type: product.product_type || 'other',
        pli_code:    product.pli_code    || undefined,
        barcode:     undefined,
        brand_id:    product.brand_id    || undefined,
        category_id: product.category_id || undefined,
        image_url:   product.image_url   || undefined,
        auto_reorder_enabled: product.auto_reorder_enabled ?? true,
        reorder_days: product.reorder_days || 30,
        min_stock_qty: product.min_stock_qty || 0,
        nicotine_mg:  product.nicotine_mg  || undefined,
        volume_ml:    product.volume_ml    || undefined,
        variants: (product.variants || []).map(v => ({
          flavor:           v.flavor           || undefined,
          resistance_ohm:   v.resistance_ohm   || undefined,
          nicotine_strength: v.nicotine_strength || undefined,
          volume_ml:        v.volume_ml         || undefined,
          color:            v.color             || undefined,
          barcode:          undefined,
          location:         v.location          || undefined,
          pack_size:        v.pack_size         || 1,
          cost_price:       v.cost_price        || 0,
          sale_price:       v.sale_price        || 0,
          price_list_2:     v.price_list_2      || undefined,
          price_list_3:     v.price_list_3      || undefined,
          tax_class_id:     v.tax_class_id      || undefined,
        })),
      };

      await catalog.createProduct(payload);
      toast.success(`«${product.name}» duplicato con SKU ${newSku}`, { duration: 3000 });
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.message
        || (err.response?.data?.errors ? Object.values(err.response.data.errors).flat().join(' | ') : null)
        || 'Errore durante la duplicazione';
      toast.error(msg);
    } finally {
      setDuplicating(null);
    }
  };

  const handleDelete = async (product) => {
    setConfirmToDelete(product);
  };

  const doDelete = async () => {
    if (!confirmToDelete) return;
    try {
      await catalog.deleteProduct(confirmToDelete.id);
      toast.success(`«${confirmToDelete.name}» eliminato`);
      setConfirmToDelete(null);
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.message || "Errore durante l'eliminazione";
      toast.error(msg);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%' }} className="sp-spin" />
    </div>
  );

  if (isDipendente) return (
    <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>Sezione non disponibile</div>
      <div style={{ fontSize: 13, marginTop: 8 }}>Contatta un amministratore per informazioni sui prodotti.</div>
    </div>
  );

  return (
    <>
    <ConfirmModal
      isOpen={!!confirmToDelete}
      title="Elimina prodotto"
      message={`Stai per eliminare definitivamente «${confirmToDelete?.name}». Tutte le varianti e i dati di stock associati verranno rimossi.`}
      onConfirm={doDelete}
      onCancel={() => setConfirmToDelete(null)}
    />
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
          <button
            className="sp-btn sp-btn-secondary"
            onClick={() => setShowPsImport(true)}
            title="Importa prodotti da PrestaShop"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ShoppingBag size={16} /> Importa PrestaShop
          </button>
          <button
            className="sp-btn sp-btn-secondary"
            onClick={() => setShowCsvImport(true)}
            title="Importa prodotti da file CSV"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Upload size={16} /> Importa CSV
          </button>
          <button
            className="sp-btn sp-btn-secondary"
            onClick={() => setShowBulkExcise(true)}
            title="Applica accisa a piu prodotti in blocco"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <DollarSign size={16} /> Accise Massive
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
              <th style={{ textAlign: 'center' }}>POS ⭐</th>
              <th style={{ textAlign: 'center' }}>Online 🌐</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {currentFiltered.length > 0 ? currentFiltered.map(product => {
              const variant = product.variants?.[0];
              const priceNet = parseFloat(variant?.sale_price) || 0;
              const vatMap = { '1': 22, '2': 10, '3': 4 };
              const vatRate = vatMap[String(variant?.tax_class_id)] || 0;
              const priceGross = vatRate ? priceNet * (1 + vatRate / 100) : priceNet;
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
                  <td style={{ fontWeight: 700 }}>
                    {fmt(priceGross)}
                    {vatRate > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 500 }}>
                        IVA {vatRate}% incl. · netto {fmt(priceNet)}
                      </div>
                    )}
                  </td>
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
                  <td style={{ textAlign: 'center' }}>
                    <button
                      title={product.is_featured ? 'Rimuovi da In Evidenza nel POS' : 'Metti In Evidenza nel POS'}
                      onClick={() => handleToggleFeatured(product)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '4px 6px', borderRadius: 8, display: 'inline-flex',
                        alignItems: 'center', justifyContent: 'center',
                        transition: 'transform 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.25)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <Star
                        size={18}
                        fill={product.is_featured ? '#FBBF24' : 'none'}
                        color={product.is_featured ? '#FBBF24' : 'var(--color-text-tertiary)'}
                        strokeWidth={2}
                      />
                    </button>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {/* Toggle Online */}
                    <button
                      title={product.is_online ? 'Visibile online — clicca per nascondere' : 'Nascosto online — clicca per attivare'}
                      onClick={() => handleToggleOnline(product)}
                      style={{
                        background: product.is_online ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.08)',
                        border: `1.5px solid ${product.is_online ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}`,
                        color: product.is_online ? '#16a34a' : '#ef4444',
                        cursor: 'pointer', padding: '3px 10px', borderRadius: 20,
                        fontSize: 11, fontWeight: 800, transition: 'all 0.15s',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {product.is_online ? '🌐 Online' : '🚫 Offline'}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {/* Giacenze Cross-Store */}
                      <button 
                        className="sp-btn sp-btn-ghost sp-btn-sm"
                        onClick={() => setInventoryProduct(product)}
                        title="Vedi giacenze per ogni negozio"
                        style={{ color: '#10B981' }}
                      >
                        <MapPin size={14} />
                      </button>
                      <button 
                        className="sp-btn sp-btn-ghost sp-btn-sm"
                        onClick={() => { setSelectedProduct(product); setShowModal(true); }}
                        title="Modifica prodotto"
                      >
                        <Edit3 size={14} />
                      </button>
                      {/* Duplica prodotto */}
                      <button
                        className="sp-btn sp-btn-ghost sp-btn-sm"
                        title="Duplica prodotto"
                        disabled={duplicating === product.id}
                        onClick={() => handleDuplicate(product)}
                        style={{ opacity: duplicating === product.id ? 0.5 : 1 }}
                      >
                        {duplicating === product.id
                          ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                          : <Copy size={14} />}
                      </button>
                      {/* Elimina prodotto */}
                      <button
                        className="sp-btn sp-btn-ghost sp-btn-sm"
                        title="Elimina prodotto"
                        onClick={() => handleDelete(product)}
                        style={{ color: 'var(--color-error)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan="8" className="sp-table-empty">Nessun prodotto trovato</td></tr>
            )}
          </tbody>
        </table>
        
        {/* Paginazione */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Pagina {currentPage} di {totalPages}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', 
                  borderRadius: 6, border: '1px solid var(--color-border)', 
                  background: currentPage === 1 ? 'transparent' : 'var(--color-surface)', 
                  color: currentPage === 1 ? 'var(--color-text-tertiary)' : 'var(--color-text)',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronLeft size={16} /> Precedente
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', 
                  borderRadius: 6, border: '1px solid var(--color-border)', 
                  background: currentPage === totalPages ? 'transparent' : 'var(--color-surface)', 
                  color: currentPage === totalPages ? 'var(--color-text-tertiary)' : 'var(--color-text)',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                Successiva <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showBulkExcise && (
        <BulkExciseModal
          categories={categories}
          onClose={() => setShowBulkExcise(false)}
          onSave={() => {
            setShowBulkExcise(false);
            fetchData();
          }}
        />
      )}

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

      {showPsImport && (
        <PrestashopImportModal
          onClose={() => setShowPsImport(false)}
          onImported={() => { setShowPsImport(false); fetchData(); }}
        />
      )}

      {showCsvImport && (
        <CsvImportModal
          onClose={() => setShowCsvImport(false)}
          onImported={() => { setShowCsvImport(false); fetchData(); }}
        />
      )}

      {/* Modal Giacenze Cross-Store */}
      {inventoryProduct && <ProductInventoryModal product={inventoryProduct} onClose={() => setInventoryProduct(null)} />}
    </div>
    </>
  );
}



/* ─── Modale Importa da CSV ─────────────────────────────────────────────── */
function CsvImportModal({ onClose, onImported }) {
  const [file, setFile]       = useState(null);
  const [status, setStatus]   = useState('idle'); // idle | uploading | done | error
  const [result, setResult]   = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const CSV_FORMAT = 'sku,name,type_code,category,price,barcode,stock';
  const CSV_EXAMPLE = 'SKU-001,Kiwi Spark 20mg,liquid,Liquidi,18.00,1234567890,50\nSKU-002,Pod Kit V2,hardware,Hardware,29.90,0987654321,10';

  const handleFile = async (f) => {
    if (!f) return;
    if (!f.name.match(/\.(csv|txt)$/i)) { toast.error('Carica un file CSV o TXT'); return; }
    setFile(f);
    setStatus('idle');
    setResult(null);
  };

  const startImport = async () => {
    if (!file) { toast.error('Seleziona un file CSV prima'); return; }
    setStatus('uploading');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await catalog.importProducts(fd);
      const data = res.data;
      setResult(data);
      setStatus('done');
      toast.success(`${data.imported ?? 0} prodotti importati dal CSV!`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Errore durante l\'importazione CSV';
      setStatus('error');
      setResult({ error: msg });
      toast.error(msg);
    }
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 20, width: '100%', maxWidth: 560, boxShadow: '0 24px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={18} color="#22C55E" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--color-text)' }}>Importa da CSV</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Carica un file CSV per importare prodotti in batch</div>
            </div>
          </div>
          <button onClick={onClose} disabled={status === 'uploading'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Format instructions */}
          <div style={{ background: 'var(--color-bg)', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Formato CSV richiesto
            </div>
            <code style={{ fontSize: 11, fontFamily: 'monospace', color: '#22C55E', display: 'block', marginBottom: 6 }}>{CSV_FORMAT}</code>
            <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>Esempio:</div>
            <pre style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--color-text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>{CSV_EXAMPLE}</pre>
            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--color-text-tertiary)' }}>
              • <strong>type_code</strong>: liquid / hardware / accessori / pod<br/>
              • <strong>price</strong>: usa il punto come separatore decimale (es. 18.00)<br/>
              • <strong>stock</strong>: quantità iniziale (opzionale, default 0)
            </div>
          </div>

          {/* Drop zone */}
          <div
            style={{
              border: `2px dashed ${dragOver ? 'var(--color-accent)' : file ? '#22C55E' : 'var(--color-border)'}`,
              borderRadius: 12, padding: '24px 16px', textAlign: 'center', cursor: 'pointer',
              background: dragOver ? 'rgba(var(--accent-rgb),0.04)' : 'transparent',
              transition: 'all 0.15s',
            }}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files[0])} />
            {file ? (
              <div style={{ color: '#22C55E', fontWeight: 700 }}>
                <CheckCircle size={24} style={{ marginBottom: 6 }} />
                <div style={{ fontSize: 14 }}>{file.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                  {(file.size / 1024).toFixed(1)} KB · Clicca per cambiare
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--color-text-tertiary)' }}>
                <Upload size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>Trascina il CSV qui o clicca per selezionare</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Supporta .csv e .txt</div>
              </div>
            )}
          </div>

          {/* Result */}
          {result && status === 'done' && (
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle size={18} color="#22C55E" />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#22C55E' }}>Importazione completata!</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  {result.imported ?? 0} prodotti importati · {result.skipped ?? 0} saltati (duplicati) · {result.errors ?? 0} errori
                </div>
              </div>
            </div>
          )}
          {result && status === 'error' && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#EF4444' }}>
              ❌ {result.error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {status === 'done' ? (
            <button className="sp-btn sp-btn-primary" onClick={onImported}>
              <CheckCircle size={15} /> Chiudi e aggiorna catalogo
            </button>
          ) : (
            <>
              <button className="sp-btn sp-btn-secondary" onClick={onClose} disabled={status === 'uploading'}>Annulla</button>
              <button
                className="sp-btn sp-btn-primary"
                onClick={startImport}
                disabled={!file || status === 'uploading'}
                style={{ background: '#22C55E', border: 'none', minWidth: 140 }}
              >
                {status === 'uploading'
                  ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Importazione...</>
                  : <><Upload size={14} /> Importa CSV</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
/* ─── Modale Importa da PrestaShop ───────────────────────────────────────── */
function PrestashopImportModal({ onClose, onImported }) {
  const [psUrl, setPsUrl]       = useState('');
  const [apiKey, setApiKey]     = useState('');
  const [status, setStatus]     = useState('idle'); // idle | testing | importing | done | error
  const [progress, setProgress] = useState({ imported: 0, total: 0, errors: 0 });
  const [log, setLog]           = useState([]);
  const [testOk, setTestOk]     = useState(false);
  const abortRef = useRef(false);

  const addLog = (msg, type = 'info') => setLog(prev => [...prev, { msg, type, ts: Date.now() }]);

  const cleanUrl = (u) => u.trim().replace(/\/$/, '');

  const wipeCatalog = async () => {
    if (!window.confirm("Sei SICURO di voler CANCELLARE TUTTO IL CATALOGO e azzerare tutte le giacenze? L'operazione è irreversibile!")) return;
    setStatus('testing');
    addLog('Svuotamento catalogo in corso...', 'warn');
    try {
      const res = await api.get('/prestashop/wipe-all-products');
      toast.success(res.data?.message || 'Catalogo svuotato con successo!');
      addLog('🗑 Catalogo e giacenze svuotati completamente.', 'success');
      onImported();
    } catch (err) {
      const msg = err.response?.data?.message || 'Errore durante lo svuotamento';
      toast.error(msg);
      addLog(`❌ ${msg}`, 'error');
    } finally {
      setStatus('idle');
    }
  };

  const testConnection = async () => {
    if (!psUrl || !apiKey) { toast.error('Inserisci URL PrestaShop e API Key'); return; }
    setStatus('testing'); setTestOk(false); setLog([]);
    addLog('Connessione a PrestaShop in corso...');
    try {
      const res = await api.post('/prestashop/test', {
        url: cleanUrl(psUrl),
        api_key: apiKey,
      });
      addLog(`✅ Connessione riuscita! (tempo: ${res.data?.response_ms ?? '?'}ms)`, 'success');
      addLog(`Trovati ${res.data?.products_count ?? '?'} prodotti nel catalogo PrestaShop.`, 'info');
      setTestOk(true);
      setStatus('idle');
    } catch (err) {
      const msg = err.response?.data?.message || 'Impossibile connettersi a PrestaShop';
      addLog(`❌ ${msg}`, 'error');
      setStatus('error');
    }
  };

  const startImport = async () => {
    if (!testOk) { toast.error('Prima testa la connessione'); return; }
    abortRef.current = false;
    setStatus('importing');
    setProgress({ imported: 0, total: 0, errors: 0 });
    addLog('Calcolo dei prodotti da importare...');

    try {
      const res = await api.post('/prestashop/import/start', {
        url: cleanUrl(psUrl),
        api_key: apiKey,
      });
      const ids = res.data.ids || [];
      const total = res.data.total || 0;
      const skipped = res.data.skipped || 0;
      
      if (skipped > 0) {
        addLog(`Saltati ${skipped} prodotti già presenti in SvaPro.`);
      }

      if (total === 0) {
        addLog('Nessun nuovo prodotto da importare.', 'info');
        setStatus('idle');
        return;
      }
      
      setProgress({ imported: 0, total: total, errors: 0 });
      addLog(`Trovati ${total} prodotti. Importazione a blocchi di 10 (ottimizzato per velocità)...`);

      const batchSize = 10;
      let importedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < ids.length; i += batchSize) {
        if (abortRef.current) {
            addLog('⚠ Importazione annullata dall\'utente.', 'warn');
            break;
        }

        const batchIds = ids.slice(i, i + batchSize);
        addLog(`Elaborazione blocco ${Math.floor(i/batchSize)+1}/${Math.ceil(total/batchSize)}...`);
        
        try {
            const batchRes = await api.post('/prestashop/import/batch', {
                url: cleanUrl(psUrl),
                api_key: apiKey,
                batchIds: batchIds
            });
            
            const data = batchRes.data;
            importedCount += data.imported || 0;
            errorCount += data.errors || 0;
            
            setProgress({ imported: importedCount, total: total, errors: errorCount });
            
            if (data.errors > 0 && data.first_error) {
                addLog(`⚠ Errore nel blocco: ${data.first_error}`, 'error');
            }
        } catch (batchErr) {
            errorCount += batchIds.length;
            setProgress({ imported: importedCount, total: total, errors: errorCount });
            const msg = batchErr.response?.data?.message || batchErr.message || 'Errore sconosciuto';
            addLog(`❌ Fallimento fatale blocco: ${msg}`, 'error');
        }
      }

      if (errorCount > 0) {
        addLog(`⚠ ${errorCount} prodotti non importati (duplicati SKU o dati incompleti).`, 'warn');
      }
      
      addLog(`✅ Importazione completata: ${importedCount} prodotti importati su ${total} totali.`, 'success');
      toast.success('Importazione completata!');
      onImported();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Errore di connessione a SvaPro';
      toast.error(msg);
      addLog(`❌ ${msg}`, 'error');
    } finally {
      setStatus('idle');
    }
  };

  const isBusy = status === 'testing' || status === 'importing';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 20, width: '100%', maxWidth: 560, boxShadow: '0 24px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(123,111,208,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={18} color="#7B6FD0" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--color-text)' }}>Importa da PrestaShop</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Importa l'intero catalogo via API. Funziona con 4500+ prodotti.</div>
            </div>
          </div>
          <button onClick={onClose} disabled={isBusy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>URL del negozio PrestaShop</label>
            <input
              className="sp-input"
              placeholder="es. https://tuonegozio.com"
              value={psUrl}
              onChange={e => { setPsUrl(e.target.value); setTestOk(false); }}
              disabled={isBusy}
            />
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>Inserisci l'URL base del tuo sito PrestaShop (senza /api)</div>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>API Key PrestaShop</label>
            <input
              className="sp-input sp-font-mono"
              placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); setTestOk(false); }}
              disabled={isBusy}
              type="password"
            />
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
              Vai su PrestaShop → Parametri Avanzati → Webservice → Aggiungi chiave con permesso <strong>prodotti GET</strong>
            </div>
          </div>

          {/* Progress bar */}
          {status === 'importing' && (
            <div style={{ background: 'var(--color-bg)', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, fontWeight: 600 }}>
                <span>Importazione in corso...</span>
                <span style={{ color: 'var(--color-accent)' }}>{progress.imported} / {progress.total || '?'}</span>
              </div>
              <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: 'linear-gradient(90deg, #7B6FD0, #5B50B0)',
                  borderRadius: 6, transition: 'width 0.4s',
                  width: progress.total ? `${Math.min(100, (progress.imported / progress.total) * 100)}%` : '60%',
                  animation: progress.total ? 'none' : 'pulse 1.5s ease-in-out infinite',
                }} />
              </div>
            </div>
          )}

          {/* Log */}
          {log.length > 0 && (
            <div style={{ background: '#0f172a', borderRadius: 10, padding: 12, fontFamily: 'monospace', fontSize: 12, maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {log.map((entry, i) => (
                <div key={i} style={{ color: entry.type === 'error' ? '#fc8181' : entry.type === 'success' ? '#86efac' : entry.type === 'warn' ? '#fbbf24' : '#94a3b8' }}>
                  {entry.msg}
                </div>
              ))}
            </div>
          )}

          {status === 'done' && (
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle size={18} color="#10b981" />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#10b981' }}>Importazione completata!</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  {progress.imported} prodotti importati · {progress.errors} errori
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {status === 'done' ? (
            <button className="sp-btn sp-btn-primary" onClick={onImported}>
              <CheckCircle size={15} /> Chiudi e aggiorna catalogo
            </button>
          ) : (
            <>
              <button
                className="sp-btn"
                onClick={wipeCatalog}
                disabled={isBusy}
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', marginRight: 'auto' }}
              >
                <Trash2 size={14} /> Svuota Catalogo
              </button>
              <button className="sp-btn sp-btn-secondary" onClick={testConnection} disabled={isBusy || !psUrl || !apiKey}>
                {status === 'testing' ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Attendere...</> : 'Testa connessione'}
              </button>
              <button
                className="sp-btn sp-btn-primary"
                onClick={startImport}
                disabled={isBusy || !testOk}
                style={{ opacity: testOk ? 1 : 0.5 }}
              >
                {status === 'importing'
                  ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Importazione...</>
                  : <><Upload size={14} /> Avvia importazione</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
