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
      <div onClick={() => navigate('/')} style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-1px', cursor: 'pointer' }}>
        Sva<span style={{ color: 'var(--accent-color)' }}>Pro</span>
        <span style={{ color: 'var(--accent-color)', fontWeight: 400 }}>.</span>
      </div>

      <div style={{ display: 'flex', gap: '2rem', fontSize: '0.88rem', fontWeight: 600, color: '#666' }}>
        {['Hardware', 'Liquidi', 'Accessori', 'Novità'].map(label => (
          <Link key={label} to="/shop" style={{ color: '#666', textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={e => (e.target.style.color = '#fff')}
            onMouseLeave={e => (e.target.style.color = '#666')}
          >{label}</Link>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '1.4rem', alignItems: 'center', color: '#666' }}>
        <Search size={19} style={{ cursor: 'pointer', transition: 'color 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = '#666')} />
        <User size={19} style={{ cursor: 'pointer', transition: 'color 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = '#666')} />
        <button onClick={onCartOpen} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          position: 'relative', color: '#666', display: 'flex', alignItems: 'center',
          transition: 'color 0.2s',
        }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = '#666')}
        >
          <ShoppingCart size={19} />
          {totalItems > 0 && (
            <span style={{
              position: 'absolute', top: -8, right: -8,
              background: '#ff3366', color: '#fff',
              width: 18, height: 18, borderRadius: '50%',
              fontSize: '0.65rem', fontWeight: 900,
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
  const imgRef = useRef(null);
  const glowRef = useRef(null);

  useEffect(() => {
    gsap.fromTo(cardRef.current,
      { y: 60, opacity: 0 },
      {
        scrollTrigger: { trigger: cardRef.current, start: 'top 88%', once: true },
        y: 0, opacity: 1, duration: 0.9, delay: idx * 0.12, ease: 'power4.out',
      }
    );
    // Perpetual float
    gsap.to(imgRef.current, {
      y: -8, duration: 2.8 + idx * 0.4, repeat: -1, yoyo: true, ease: 'sine.inOut',
    });
  }, []);

  const onMove = (e) => {
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    gsap.to(cardRef.current, { rotateX: -y * 14, rotateY: x * 14, transformPerspective: 900, duration: 0.35, ease: 'power2.out' });
    gsap.to(imgRef.current, { x: x * 14, duration: 0.4, ease: 'power2.out' });
    gsap.to(glowRef.current, { left: `${(x + 0.5) * 100}%`, top: `${(y + 0.5) * 100}%`, opacity: 1, duration: 0.3 });
  };
  const onLeave = () => {
    gsap.to(cardRef.current, { rotateX: 0, rotateY: 0, duration: 0.7, ease: 'elastic.out(1, 0.5)' });
    gsap.to(imgRef.current, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
    gsap.to(glowRef.current, { opacity: 0, duration: 0.4 });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={() => navigate('/shop')}
      style={{
        position: 'relative', cursor: 'pointer',
        transformStyle: 'preserve-3d', opacity: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}
    >
      {/* Cursor glow */}
      <div ref={glowRef} style={{
        position: 'absolute', width: 180, height: 180, borderRadius: '50%',
        background: `radial-gradient(circle, ${cat.accent}40 0%, transparent 70%)`,
        transform: 'translate(-50%, -50%)',
        left: '50%', top: '40%',
        pointerEvents: 'none', opacity: 0,
        filter: 'blur(18px)', zIndex: 0,
      }} />

      {/* Floating product image */}
      <div ref={imgRef} style={{
        width: '75%', aspectRatio: '1/1',
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '-1rem',
      }}>
        {/* Glow pool underneath */}
        <div style={{
          position: 'absolute', bottom: -10, left: '20%', right: '20%',
          height: 30, borderRadius: '50%',
          background: cat.accent, filter: 'blur(14px)', opacity: 0.28,
        }} />
        <img
          src={cat.img}
          alt={cat.label}
          style={{
            width: '100%', height: '100%', objectFit: 'contain',
            filter: `drop-shadow(0 24px 40px ${cat.accent}55)`,
            mixBlendMode: 'screen',
          }}
        />
      </div>

      {/* Minimal text panel */}
      <div style={{
        width: '100%', zIndex: 2, position: 'relative',
        borderTop: `1px solid ${cat.accent}44`,
        padding: '1.2rem 1rem 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff', letterSpacing: '-0.02em' }}>
            {cat.label}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#444', fontWeight: 600, marginTop: 2 }}>
            {cat.desc}
          </div>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          border: `1px solid ${cat.accent}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.8rem', color: cat.accent, fontWeight: 900,
          transition: 'all 0.2s ease',
          background: `${cat.accent}0f`,
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

      {/* Categories */}
      <section style={{ padding: '7rem 5vw 9rem', maxWidth: 1300, margin: '0 auto' }}>
        {/* Section label */}
        <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
          <h2 style={{
            fontSize: 'clamp(2rem, 4.5vw, 3.2rem)', fontWeight: 900, color: '#fff',
            letterSpacing: '-0.04em', lineHeight: 1.05,
          }}>
            Categorie
          </h2>
          <p style={{ color: '#444', fontSize: '0.95rem', marginTop: '0.8rem' }}>
            Tutto ciò che ti serve, curato per te.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '2rem',
        }}>
          {[
            {
              label: 'Hardware',
              desc: 'Pod, mod e kit',
              accent: '#C8963C',
              img: '/img/hardware.png',
            },
            {
              label: 'Liquidi',
              desc: 'Aromi e shortfill',
              accent: '#5B8CFF',
              img: '/img/liquidi.png',
            },
            {
              label: 'Accessori',
              desc: 'Coil, batterie, ricambi',
              accent: '#FF6B6B',
              img: '/img/accessori.png',
            },
            {
              label: 'Usa e Getta',
              desc: 'Zero manutenzione',
              accent: '#1BC47D',
              img: '/img/usa_getta.png',
            },
          ].map((cat, idx) => (
            <CategoryCard key={cat.label} cat={cat} idx={idx} navigate={navigate} />
          ))}
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

export default function App() {
  return (
    <CartProvider>
      <Router>
        <AppContent />
      </Router>
    </CartProvider>
  );
}
