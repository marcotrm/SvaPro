import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Filter, Search } from 'lucide-react';
import { getProducts, getCategories, getProductsByCategory, MOCK_PRODUCTS } from '../api/woocommerce';
import ProductCard from '../components/ProductCard';

const WC_CONFIGURED = !!import.meta.env.VITE_WC_URL;

export default function ShopPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const gridRef = useRef(null);

  useEffect(() => {
    loadCategories();
    loadProducts();
  }, []);

  useEffect(() => {
    loadProducts(activeCategory);
  }, [activeCategory]);

  const loadCategories = async () => {
    if (!WC_CONFIGURED) {
      // Mock categories
      setCategories([
        { id: 1, name: 'Liquidi', count: 3 },
        { id: 2, name: 'Hardware', count: 2 },
        { id: 3, name: 'Accessori', count: 1 },
      ]);
      return;
    }
    const data = await getCategories();
    if (data) setCategories(data);
  };

  const loadProducts = async (categoryId = null) => {
    setLoading(true);
    let data;
    if (!WC_CONFIGURED) {
      // Use mock data in development
      await new Promise(r => setTimeout(r, 400)); // simula latenza
      data = categoryId
        ? MOCK_PRODUCTS.filter(p => p.categories?.some(c => c.id === categoryId))
        : MOCK_PRODUCTS;
    } else {
      data = categoryId
        ? await getProductsByCategory(categoryId)
        : await getProducts();
    }
    setProducts(data || []);
    setLoading(false);

    // GSAP stagger entrance animation for cards
    if (gridRef.current) {
      const cards = gridRef.current.querySelectorAll('.product-card-anim');
      gsap.fromTo(cards,
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: 'power3.out' }
      );
    }
  };

  const filteredProducts = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '8rem 2rem 5rem', maxWidth: 1400, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>
          Il Negozio
        </h1>
        <p style={{ color: '#555', marginTop: '0.5rem', fontSize: '1rem' }}>
          {WC_CONFIGURED ? 'Prodotti live da WooCommerce' : '⚠️ Modalità Demo — Configura VITE_WC_URL per dati reali'}
        </p>
      </div>

      {/* Search + Filter Bar */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
          <input
            type="text"
            placeholder="Cerca prodotti..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '12px 12px 12px 42px',
              color: '#fff', fontFamily: 'inherit', fontSize: '0.95rem',
              outline: 'none',
            }}
          />
        </div>

        {/* Category Filters */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => setActiveCategory(null)} style={filterBtnStyle(activeCategory === null)}>
            Tutti
          </button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={filterBtnStyle(activeCategory === cat.id)}>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '5rem', color: '#555' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'spin 1s linear infinite' }}>◌</div>
          Caricamento prodotti...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '5rem', color: '#555' }}>
          <Filter size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
          <p>Nessun prodotto trovato.</p>
        </div>
      ) : (
        <div ref={gridRef} style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1.5rem',
        }}>
          {filteredProducts.map(product => (
            <div key={product.id} className="product-card-anim">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const filterBtnStyle = (active) => ({
  padding: '8px 16px',
  borderRadius: '100px',
  border: active ? 'none' : '1px solid rgba(255,255,255,0.1)',
  background: active ? '#ff3366' : 'rgba(255,255,255,0.04)',
  color: active ? '#fff' : '#888',
  fontWeight: 700,
  fontSize: '0.85rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all 0.2s ease',
});
