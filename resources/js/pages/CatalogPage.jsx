import React, { useState, useEffect } from 'react';
import { catalog } from '../api.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import CatalogModal from '../components/CatalogModal.jsx';

export default function CatalogPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true); setError('');
      const response = await catalog.getProducts();
      setProducts(response.data.data || []);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento dei prodotti');
    } finally { setLoading(false); }
  };

  const handleOpenModal = (product = null) => { setSelectedProduct(product); setShowModal(true); };
  const handleCloseModal = () => { setShowModal(false); setSelectedProduct(null); };
  const handleSaveProduct = async () => { await fetchProducts(); handleCloseModal(); };

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <LoadingSpinner />;

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="page-head-title">Catalogo Prodotti</div>
          <div className="page-head-sub">{products.length} prodotti nel database</div>
        </div>
        <button className="btn btn-gold" onClick={() => handleOpenModal()}>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuovo Prodotto
        </button>
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
              <th>SKU</th>
              <th>Brand</th>
              <th>Categoria</th>
              <th>Prezzo</th>
              <th style={{textAlign:'right'}}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(product => (
              <tr key={product.id}>
                <td style={{fontWeight:600,color:'var(--text)'}}>{product.name}</td>
                <td><span className="mono" style={{color:'var(--muted2)'}}>{product.sku}</span></td>
                <td style={{color:'var(--muted2)'}}>{product.brand?.name || '—'}</td>
                <td style={{color:'var(--muted2)'}}>{product.category?.name || '—'}</td>
                <td><span className="mono positive">€{product.price?.toFixed(2)}</span></td>
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
                <td colSpan="6" style={{textAlign:'center',padding:'40px 0',color:'var(--muted)'}}>
                  Nessun prodotto trovato
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CatalogModal product={selectedProduct} onClose={handleCloseModal} onSave={handleSaveProduct} />
      )}
    </>
  );
}
