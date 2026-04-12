import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ShoppingCart, Search, User, X, Menu } from 'lucide-react';
import Hero3D from './components/Hero3D';
import CartDrawer from './components/CartDrawer';
import ShopPage from './pages/ShopPage';
import { CartProvider, useCart } from './context/CartContext';

function Navbar({ onCartOpen }) {
  const { totalItems } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const logoRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    gsap.fromTo(logoRef.current, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.8, ease: 'power3.out' });
  }, []);

  return (
    <nav className="glass-nav">
      {/* Logo */}
      <div
        ref={logoRef}
        onClick={() => navigate('/')}
        style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-1px', cursor: 'pointer' }}
      >
        Sva<span style={{ color: 'var(--accent-color)' }}>Pro</span>
        <span style={{ color: 'var(--accent-color)', fontWeight: 400 }}>.</span>
      </div>

      {/* Center Links */}
      <div style={{ display: 'flex', gap: '2rem', fontSize: '0.9rem', fontWeight: 600, color: '#888' }}>
        {['Hardware', 'Liquidi', 'Accessori', 'Novità'].map(label => (
          <Link
            key={label}
            to="/shop"
            style={{
              color: '#888', textDecoration: 'none', transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.target.style.color = '#fff')}
            onMouseLeave={e => (e.target.style.color = '#888')}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'center', color: '#888' }}>
        <Search size={20} style={{ cursor: 'pointer', transition: 'color 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = '#888')}
        />
        <User size={20} style={{ cursor: 'pointer', transition: 'color 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = '#888')}
        />
        <button
          onClick={onCartOpen}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            position: 'relative', color: '#888', display: 'flex', alignItems: 'center',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = '#888')}
        >
          <ShoppingCart size={20} />
          {totalItems > 0 && (
            <span style={{
              position: 'absolute', top: -8, right: -8,
              background: '#ff3366', color: '#fff',
              width: 18, height: 18, borderRadius: '50%',
              fontSize: '0.65rem', fontWeight: 900,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {totalItems}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}

function Home({ onCartOpen }) {
  const navigate = useNavigate();
  return (
    <main>
      <Navbar onCartOpen={onCartOpen} />
      <Hero3D onShopClick={() => navigate('/shop')} />

      {/* Quick Category Strip */}
      <section style={{ padding: '5rem 2rem', maxWidth: 1400, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, color: '#fff', marginBottom: '3rem', letterSpacing: '-0.03em' }}>
          Esplora le Categorie
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
          {[
            { label: 'Hardware', emoji: '🔧', desc: 'Mod, pod e kit completi' },
            { label: 'Liquidi', emoji: '💧', desc: 'Shortfill, salt nic e aromi' },
            { label: 'Accessori', emoji: '⚙️', desc: 'Coil, batterie e ricambi' },
            { label: 'Novità', emoji: '✨', desc: 'Le ultime uscite del settore' },
          ].map(cat => (
            <Link to="/shop" key={cat.label} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 20, padding: '2rem',
                  textAlign: 'center', cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,51,102,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(255,51,102,0.3)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>{cat.emoji}</div>
                <div style={{ fontWeight: 800, color: '#fff', marginBottom: '0.4rem' }}>{cat.label}</div>
                <div style={{ color: '#555', fontSize: '0.85rem' }}>{cat.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function AppContent() {
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <>
      <Routes>
        <Route path="/" element={<Home onCartOpen={() => setCartOpen(true)} />} />
        <Route path="/shop" element={
          <div>
            <Navbar onCartOpen={() => setCartOpen(true)} />
            <ShopPage />
          </div>
        } />
      </Routes>
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}

function App() {
  return (
    <CartProvider>
      <Router>
        <AppContent />
      </Router>
    </CartProvider>
  );
}

export default App;
