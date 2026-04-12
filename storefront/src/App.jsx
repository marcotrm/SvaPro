import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ShoppingCart, Search, User } from 'lucide-react';
import Hero3D from './components/Hero3D';
import CartDrawer from './components/CartDrawer';
import ShopPage from './pages/ShopPage';
import { CartProvider, useCart } from './context/CartContext';

gsap.registerPlugin(ScrollTrigger);

/* ─────────────────────────────────────── Navbar ── */
function Navbar({ onCartOpen }) {
  const { totalItems } = useCart();
  const navigate = useNavigate();

  return (
    <nav id="main-navbar" className="glass-nav">
      {/* Logo */}
      <div onClick={() => navigate('/')} style={{
        fontSize: '1.45rem', fontWeight: 900, letterSpacing: '-1px',
        cursor: 'pointer', color: '#fff',
      }}>
        Sva<span style={{ color: '#C8963C' }}>Pro</span><span style={{ color: '#C8963C', fontWeight: 400 }}>.</span>
      </div>

      {/* Links */}
      <div style={{ display: 'flex', gap: '2rem', fontSize: '0.86rem', fontWeight: 600 }}>
        {['Hardware', 'Liquidi', 'Accessori', 'Novità'].map(label => (
          <Link key={label} to="/shop" style={{ color: '#666', textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={e => (e.target.style.color = '#fff')}
            onMouseLeave={e => (e.target.style.color = '#666')}
          >{label}</Link>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '1.4rem', alignItems: 'center', color: '#aaa' }}>
        <Search size={18} style={{ cursor: 'pointer', transition: 'color 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#111')}
          onMouseLeave={e => (e.currentTarget.style.color = '#aaa')} />
        <User size={18} style={{ cursor: 'pointer', transition: 'color 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#111')}
          onMouseLeave={e => (e.currentTarget.style.color = '#aaa')} />
        <button onClick={onCartOpen} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          position: 'relative', color: '#aaa', display: 'flex', alignItems: 'center',
          transition: 'color 0.2s',
        }}
          onMouseEnter={e => (e.currentTarget.style.color = '#111')}
          onMouseLeave={e => (e.currentTarget.style.color = '#aaa')}
        >
          <ShoppingCart size={18} />
          {totalItems > 0 && (
            <span style={{
              position: 'absolute', top: -8, right: -8,
              background: '#ff3366', color: '#fff',
              width: 17, height: 17, borderRadius: '50%',
              fontSize: '0.6rem', fontWeight: 900,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{totalItems}</span>
          )}
        </button>
      </div>
    </nav>
  );
}

/* ─────────────────────────────── Category Card ── */
function CategoryCard({ cat, idx, navigate }) {
  const cardRef = useRef(null);
  const imgRef  = useRef(null);

  useEffect(() => {
    // Scroll entrance
    gsap.fromTo(cardRef.current,
      { y: 50, opacity: 0 },
      {
        scrollTrigger: { trigger: cardRef.current, start: 'top 88%', once: true },
        y: 0, opacity: 1, duration: 0.8, delay: idx * 0.1, ease: 'power4.out',
      }
    );
    // Float loop
    gsap.to(imgRef.current, {
      y: -10, duration: 3 + idx * 0.3, repeat: -1, yoyo: true, ease: 'sine.inOut',
    });
  }, []);

  const onMove = (e) => {
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    gsap.to(cardRef.current, { rotateX: -y * 12, rotateY: x * 12, transformPerspective: 900, duration: 0.35, ease: 'power2.out' });
    gsap.to(imgRef.current, { x: x * 10, duration: 0.4, ease: 'power2.out' });
  };
  const onLeave = () => {
    gsap.to(cardRef.current, { rotateX: 0, rotateY: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
    gsap.to(imgRef.current, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={() => navigate('/shop')}
      style={{
        cursor: 'pointer',
        transformStyle: 'preserve-3d',
        opacity: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '0 8px',
      }}
    >
      {/* Floating product image — dark bg card with screen blend */}
      <div ref={imgRef} style={{
        width: '100%', aspectRatio: '1 / 1',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
        background: '#0d0d0d',
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: '1.2rem',
      }}>
        {/* Colored glow behind product */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(circle at 50% 60%, ${cat.accent}22 0%, transparent 70%)`,
        }} />
        <img
          src={cat.img}
          alt={cat.label}
          style={{
            width: '72%', height: '72%', objectFit: 'contain',
            position: 'relative', zIndex: 2,
            filter: `drop-shadow(0 16px 32px ${cat.accent}55)`,
            mixBlendMode: 'screen',    // black bg disappears → product floats
          }}
        />
      </div>

      {/* Minimal label */}
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#fff', letterSpacing: '-0.02em' }}>
            {cat.label}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#444', fontWeight: 600, marginTop: 2 }}>
            {cat.desc}
          </div>
        </div>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          border: `1px solid ${cat.accent}50`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: cat.accent, fontWeight: 900, fontSize: '0.8rem',
          background: `${cat.accent}0f`,
          transition: 'all 0.2s',
        }}>→</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── Home ── */
function Home({ onCartOpen }) {
  const navigate = useNavigate();

  return (
    <main>
      <Navbar onCartOpen={onCartOpen} />
      <Hero3D onShopClick={() => navigate('/shop')} />

      {/* ── Dark Categories Section ── */}
      <section style={{ background: '#070707', padding: '8rem 5vw 10rem' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: '5rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '3px', color: '#C8963C', textTransform: 'uppercase', marginBottom: '1rem' }}>
              — Catalogo
            </div>
            <h2 style={{
              fontSize: 'clamp(2.5rem, 5vw, 4rem)',
              fontWeight: 900, color: '#fff',
              letterSpacing: '-0.04em', lineHeight: 1.04,
            }}>
              Scegli la tua<br />
              <span style={{ color: '#C8963C' }}>categoria.</span>
            </h2>
          </div>

          {/* Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '2.5rem',
          }}>
            {[
              { label: 'Hardware',    desc: 'Pod, mod e kit', accent: '#C8963C', img: '/img/hardware.png' },
              { label: 'Liquidi',     desc: 'Aromi e shortfill', accent: '#5B8CFF', img: '/img/liquidi.png' },
              { label: 'Accessori',   desc: 'Coil e ricambi', accent: '#FF6B6B', img: '/img/accessori.png' },
              { label: 'Usa e Getta', desc: 'Zero config', accent: '#1BC47D', img: '/img/usa_getta.png' },
            ].map((cat, idx) => (
              <CategoryCard key={cat.label} cat={cat} idx={idx} navigate={navigate} />
            ))}
          </div>

        </div>
      </section>
    </main>
  );
}

/* ───────────────────────────────────── AppContent ── */
function AppContent() {
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <>
      <Routes>
        <Route path="/" element={<Home onCartOpen={() => setCartOpen(true)} />} />
        <Route path="/shop" element={
          <div style={{ background: '#070707', minHeight: '100vh' }}>
            <nav className="glass-nav" style={{ background: 'rgba(7,7,7,0.85)' }}>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#fff' }}>
                Sva<span style={{ color: '#C8963C' }}>Pro</span><span style={{ color: '#C8963C', fontWeight: 400 }}>.</span>
              </div>
              <div style={{ display: 'flex', gap: '2rem', fontSize: '0.86rem', fontWeight: 600 }}>
                {['Hardware', 'Liquidi', 'Accessori', 'Novità'].map(l => (
                  <Link key={l} to="/shop" style={{ color: '#555', textDecoration: 'none' }}>{l}</Link>
                ))}
              </div>
              <button onClick={() => setCartOpen(true)} style={{
                background: 'transparent', border: 'none', cursor: 'pointer', color: '#666',
                position: 'relative',
              }}>
                <ShoppingCart size={18} />
              </button>
            </nav>
            <ShopPage />
          </div>
        } />
      </Routes>
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}

export default function App() {
  return (
    <CartProvider>
      <Router>
        <AppContent />
      </Router>
    </CartProvider>
  );
}
