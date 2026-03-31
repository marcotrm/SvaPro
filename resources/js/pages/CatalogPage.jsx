import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { catalog, suppliers } from '../api.jsx';
import { CatalogSkeleton } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import CatalogModal from '../components/CatalogModal.jsx';

export default function CatalogPage() {
  const { selectedStoreId, selectedStore, storesList } = useOutletContext();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [suppliersList, setSuppliersList] = useState([]);
  useEffect(() => { fetchProducts(); }, [selectedStoreId]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError('');
      const productsRes = await catalog.getProducts(selectedStoreId ? { store_id: selectedStoreId, limit: 60 } : { limit: 60 });
      setProducts(productsRes.data.data || []);
      
      const suppliersRes = await suppliers.getAll();
      setSuppliersList(suppliersRes.data.data || []);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (product = null) => { setSelectedProduct(product); setShowModal(true); };
  const handleCloseModal = () => { setShowModal(false); setSelectedProduct(null); };
  const handleSaveProduct = async () => { await fetchProducts(); handleCloseModal(); };

  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setLoading(true);
      setError('');
      const formData = new FormData();
      formData.append('file', file);
      
      await catalog.importProducts(formData);
      await fetchProducts();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore importazione CSV');
    } finally {
      setLoading(false);
      e.target.value = null; // reset input
    }
  };

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPrimaryVariant = product => product.variants?.[0] || null;
  const getStoresLabel = product => {
    if (!product.store_count) return 'Nessuno store';
    if (product.store_count === 1) return '1 store';
    return `${product.store_count} store`;
  };
  const getFiscalSummary = product => {
    const variant = getPrimaryVariant(product);
    if (!variant) return 'Regime standard';

    const parts = [];
    if (variant.excise_profile_code) parts.push(`Accisa ${variant.excise_profile_code}`);
    if (variant.excise_unit_amount_override !== null && variant.excise_unit_amount_override !== undefined) {
      parts.push(`Override €${Number(variant.excise_unit_amount_override).toFixed(2)}`);
    }
    if (variant.prevalenza_code) parts.push(`Prev. ${variant.prevalenza_code}`);

    return parts.length ? parts.join(' • ') : 'Regime standard';
  };

  if (loading) return <CatalogSkeleton />;

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="page-head-title">Catalogo Prodotti</div>
          <div className="page-head-sub">
            {products.length} prodotti nel database{selectedStore ? ` - Store: ${selectedStore.name}` : ''}
          </div>
        </div>
        <div style={{display:'flex', gap: '8px'}}>
          <label className="btn btn-light" style={{cursor: 'pointer'}}>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Importa CSV
            <input type="file" accept=".csv" style={{display: 'none'}} onChange={handleImportCSV} />
          </label>
          <button className="btn btn-gold" onClick={() => handleOpenModal()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nuovo Prodotto
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchProducts} />}

      {/* Table */}
      <div className="table-card">
        <div className="table-toolbar">
          <div className="search-box">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--muted)',flexShrink:0}}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              placeholder="Cerca per nome o SKU..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <span style={{fontSize:12,color:'var(--muted)',marginLeft:'auto'}}>
            {filtered.length} risultati
          </span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>SKU / PLI</th>
              <th>Variante Principale</th>
              <th>Prezzo</th>
              <th>Accise / Prevalenza</th>
              <th>Store Abilitati</th>
              <th style={{textAlign:'right'}}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(product => (
              <tr key={product.id}>
                <td style={{fontWeight:600,color:'var(--text)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    {product.image_url ? (
                      <img src={product.image_url} alt="img" style={{width:24,height:24,borderRadius:4,objectFit:'cover'}} />
                    ) : (
                      <div style={{width:24,height:24,borderRadius:4,backgroundColor:'var(--muted-bg)'}} />
                    )}
                    {product.name}
                  </div>
                </td>
                <td>
                  <span className="mono" style={{color:'var(--muted2)'}}>{product.sku}</span>
                  {product.pli_code && (
                    <div style={{fontSize:'0.75rem',marginTop:2,color:'var(--text)',fontWeight:500}}>
                      PLI: {product.pli_code}
                    </div>
                  )}
                </td>
                <td style={{color:'var(--muted2)'}}>{getPrimaryVariant(product)?.flavor || getPrimaryVariant(product)?.resistance_ohm || '-'}</td>
                <td><span className="mono positive">€{Number(getPrimaryVariant(product)?.sale_price || 0).toFixed(2)}</span></td>
                <td style={{color:'var(--muted2)', maxWidth: 220}}>{getFiscalSummary(product)}</td>
                <td>
                  <span className={`badge ${product.store_count > 1 ? 'high' : 'mid'}`}>
                    <span className="badge-dot" />
                    {getStoresLabel(product)}
                  </span>
                </td>
                <td>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:4}}>
                    <button className="icon-action edit" onClick={() => handleOpenModal(product)} title="Modifica">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button className="icon-action danger" title="Elimina">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="7" style={{textAlign:'center',padding:'40px 0',color:'var(--muted)'}}>
                  Nessun prodotto trovato
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CatalogModal
          product={selectedProduct}
          storesList={storesList}
          suppliers={suppliersList}
          selectedStoreId={selectedStoreId}
          onClose={handleCloseModal}
          onSave={handleSaveProduct}
        />
      )}
    </>
  );
}
