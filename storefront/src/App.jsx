import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ShoppingCart, Search, User, X, Menu } from 'lucide-react';
import Hero3D from './components/Hero3D';
import CartDrawer from './components/CartDrawer';
import ShopPage from './pages/ShopPage';
import { CartProvider, useCart } from './context/CartContext';

gsap.registerPlugin(ScrollTrigger);

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

function Category3DCard({ cat, idx, navigate }) {
  const cardRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    // Scroll-triggered stagger entrance
    gsap.fromTo(cardRef.current,
      { y: 60, opacity: 0 },
      {
        scrollTrigger: {
          trigger: cardRef.current,
          start: 'top 85%',
          once: true,
        },
        y: 0, opacity: 1, duration: 0.8, delay: idx * 0.12, ease: 'power3.out',
      }
    );
  }, []);

  const handleMouseMove = (e) => {
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rx = ((y - cy) / cy) * -10;
    const ry = ((x - cx) / cx) * 10;
    gsap.to(card, { rotateX: rx, rotateY: ry, transformPerspective: 900, duration: 0.3, ease: 'power2.out' });
    gsap.to(imgRef.current, { scale: 1.06, duration: 0.5, ease: 'power2.out' });
  };

  const handleMouseLeave = () => {
    gsap.to(cardRef.current, { rotateX: 0, rotateY: 0, duration: 0.6, ease: 'power3.out' });
    gsap.to(imgRef.current, { scale: 1, duration: 0.5, ease: 'power2.out' });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => navigate('/shop')}
      style={{
        position: 'relative',
        background: 'rgba(255,255,255,0.025)',
        border: `1px solid rgba(255,255,255,0.06)`,
        borderRadius: 28, overflow: 'hidden',
        cursor: 'pointer',
        willChange: 'transform',
        transformStyle: 'preserve-3d',
        transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = `0 30px 80px -10px ${cat.accent}33`;
        e.currentTarget.style.borderColor = `${cat.accent}44`;
      }}
      onMouseOut={e => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
      }}
    >
      {/* Background image with parallax */}
      <div style={{ height: 180, overflow: 'hidden' }}>
        <img
          ref={imgRef}
          src={cat.img}
          alt={cat.label}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }}
        />
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 180,
          background: `linear-gradient(to bottom, rgba(5,5,5,0.1) 0%, rgba(5,5,5,0.7) 100%)`,
        }} />
        {/* Badge */}
        <div style={{
          position: 'absolute', top: 14, left: 14,
          background: cat.accent,
          color: '#000', fontSize: '0.6rem', fontWeight: 900,
          padding: '4px 12px', borderRadius: 100,
          letterSpacing: '1.5px', textTransform: 'uppercase',
        }}>
          {cat.badge}
        </div>
        {/* Icon */}
        <div style={{
          position: 'absolute', top: 12, right: 14,
          fontSize: '1.8rem', filter: 'drop-shadow(0 0 8px rgba(0,0,0,0.5))',
        }}>
          {cat.icon}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '1.5rem' }}>
        <h3 style={{ fontWeight: 900, fontSize: '1.25rem', color: '#fff', marginBottom: '0.6rem', letterSpacing: '-0.02em' }}>
          {cat.label}
        </h3>
        <p style={{ color: '#666', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1.2rem' }}>
          {cat.desc}
        </p>

        {/* Mini product list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: '1.5rem' }}>
          {cat.products.map(p => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: cat.accent, flexShrink: 0 }} />
              <span style={{ fontSize: '0.78rem', color: '#555', fontWeight: 600 }}>{p}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: cat.accent }}>
            Sfoglia categoria →
          </span>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: `${cat.accent}18`,
            border: `1px solid ${cat.accent}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1rem',
          }}>
            {cat.icon}
          </div>
        </div>
      </div>
    </div>
  );
}

function Home({ onCartOpen }) {
  const navigate = useNavigate();
  return (
    <main>
      <Navbar onCartOpen={onCartOpen} />
      <Hero3D onShopClick={() => navigate('/shop')} />

      {/* 3D Animated Categories Section */}
      <section style={{ padding: '6rem 5vw 8rem', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'rgba(181,141,61,0.08)', border: '1px solid rgba(181,141,61,0.25)',
            borderRadius: 100, padding: '6px 18px', marginBottom: '1.5rem',
          }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#B58D3D', letterSpacing: '2px', textTransform: 'uppercase' }}>
              Esplora il Catalogo
            </span>
          </div>
          <h2 style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, color: '#fff',
            letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '1rem',
          }}>
            Tutto quello che<br />
            <span style={{
              background: 'linear-gradient(120deg, #B58D3D, #e8c97a)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>cerchi, in un posto.</span>
          </h2>
          <p style={{ color: '#555', fontSize: '1rem', maxWidth: 500, margin: '0 auto' }}>
            Dai dispositivi di ultima generazione ai liquidi artigianali — sfoglia le nostre categorie curate.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.5rem',
        }}>
          {[
            {
              label: 'Hardware',
              icon: '⚡',
              desc: 'Pod mod, box mod e kit completi per ogni livello di esperienza.',
              accent: '#B58D3D',
              products: ['Vaporesso ECO One Pro', 'Uwell Caliburn G3', 'GeekVape Aegis'],
              badge: 'Più Venduto',
              img: 'https://images.unsplash.com/photo-1534802046520-4f27db7f3ae5?w=400&q=80',
            },
            {
              label: 'Liquidi',
              icon: '💧',
              desc: 'Aromi concentrati, shortfill, mini shot e liquidi pronti TPD.',
              accent: '#5B8CFF',
              products: ['Suprem-e One', 'TNT Booms', 'Svaponext'],
              badge: 'Nuovi Arrivi',
              img: 'https://images.unsplash.com/photo-1614483888-c84fdaae28b2?w=400&q=80',
            },
            {
              label: 'Accessori',
              icon: '🔧',
              desc: 'Coil di ricambio, pod, batterie e tutto per personalizzare il tuo setup.',
              accent: '#FF6B6B',
              products: ['Coil Mesh 0.2Ω', 'Batteria 18650', 'Pod di ricambio'],
              badge: 'Essenziali',
              img: 'https://images.unsplash.com/photo-1603903631918-a3c0ee7db0f2?w=400&q=80',
            },
            {
              label: 'Usa e Getta',
              icon: '🌬️',
              desc: 'Dispositivi usa e getta compatti, senza manutenzione, pronti all\'uso.',
              accent: '#1BC47D',
              products: ['Elf Bar', 'Lost Mary', 'Vozol Star'],
              badge: 'Zero Config',
              img: 'https://images.unsplash.com/photo-1574871864461-b2a2a5a0ac2b?w=400&q=80',
            },
          ].map((cat, idx) => (
            <Category3DCard key={cat.label} cat={cat} idx={idx} navigate={navigate} />
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
