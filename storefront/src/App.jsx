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
        width: '100%', aspectRatio: '1 / 1.2',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
        background: 'transparent', // Rimossa la card dietro
        marginBottom: '1.2rem',
      }}>
        {/* Colored glow behind product */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '60%', height: '60%',
          background: `radial-gradient(circle, ${cat.accent}22 0%, transparent 70%)`,
          filter: 'blur(30px)'
        }} />
        <img
          src={cat.img}
          alt={cat.label}
          style={{
            width: '85%', height: '85%', objectFit: 'contain',
            position: 'relative', zIndex: 2,
            filter: `drop-shadow(0 20px 40px rgba(0,0,0,0.8))`,
            mixBlendMode: 'screen',
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

      {/* ── Bestselling 3D Products Section ── */}
      <section style={{ background: '#000000', padding: '6rem 5vw 4rem', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          
          <div style={{ marginBottom: '4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '3px', color: '#C8963C', textTransform: 'uppercase', marginBottom: '1rem' }}>
                — In Evidenza
              </div>
              <h2 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1.04 }}>
                Capolavori<br />
                <span style={{ color: '#aaa' }}>Senza Tempo.</span>
              </h2>
            </div>
            <Link to="/shop" style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 800, textDecoration: 'none', borderBottom: '1px solid #C8963C', paddingBottom: 4 }}>
              Vedi Tutti →
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '3rem' }}>
            {[
              { label: 'ECO One Pro', desc: 'Edizione Limitata', accent: '#C8963C', img: '/img/hero_vape_1.png', price: '€39.90' },
              { label: 'Nexus Pod', desc: 'Titanio Spaziale', accent: '#5B8CFF', img: '/img/hero_vape_2.png', price: '€45.00' },
              // Uso gli asset Hero come campione puro 3D
              { label: 'Zeus Sub-Ohm', desc: 'Flusso Pieno', accent: '#FF6B6B', img: '/img/hero_vape_1.png', price: '€29.90' },
            ].map((prod, idx) => (
              <div key={idx} onClick={() => navigate('/shop')} style={{ cursor: 'pointer', textAlign: 'center', transition: 'transform 0.3s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-10px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                <div style={{
                  width: '100%', aspectRatio: '1 / 1.3', position: 'relative',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '50%', height: '50%', background: `radial-gradient(circle, ${prod.accent}15 0%, transparent 60%)`, filter: 'blur(40px)' }} />
                  <img src={prod.img} alt={prod.label} style={{ width: '90%', height: '90%', objectFit: 'contain', mixBlendMode: 'screen', position: 'relative', zIndex: 2, filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.9))' }} />
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontWeight: 900, fontSize: '1.4rem', color: '#fff', letterSpacing: '-1px' }}>{prod.label}</div>
                  <div style={{ fontSize: '0.85rem', color: '#666', fontWeight: 600, marginTop: 4 }}>{prod.desc}</div>
                  <div style={{ fontSize: '1.1rem', color: '#C8963C', fontWeight: 800, marginTop: 12 }}>{prod.price}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── Dark Categories Section ── */}
      <section style={{ background: '#000000', padding: '6rem 5vw 10rem' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>

          <div style={{ width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)', marginBottom: '6rem' }} />

          {/* Header */}
          <div style={{ marginBottom: '5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '3px', color: '#C8963C', textTransform: 'uppercase', marginBottom: '1rem' }}>
              — Esplora
            </div>
            <h2 style={{
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 900, color: '#fff',
              letterSpacing: '-0.04em', lineHeight: 1.04,
            }}>
              Scegli la tua categoria.
            </h2>
          </div>

          {/* Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '2.5rem',
          }}>
            {[
              { label: 'Hardware',    desc: 'Pod, mod e kit', accent: '#C8963C', img: '/img/hero_vape_1.png' },
              { label: 'Liquidi',     desc: 'Aromi e shortfill', accent: '#5B8CFF', img: '/img/liquidi.png' },
              { label: 'Accessori',   desc: 'Coil e ricambi', accent: '#FF6B6B', img: '/img/accessori.png' },
              { label: 'Usa e Getta', desc: 'Zero config', accent: '#1BC47D', img: '/img/hero_vape_2.png' },
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
