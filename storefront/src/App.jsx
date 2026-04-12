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
  const glowRef = useRef(null);
  const floatTlRef = useRef(null);

  useEffect(() => {
    // Scroll-triggered stagger entrance
    gsap.fromTo(cardRef.current,
      { y: 80, opacity: 0, scale: 0.92 },
      {
        scrollTrigger: {
          trigger: cardRef.current,
          start: 'top 88%',
          once: true,
        },
        y: 0, opacity: 1, scale: 1,
        duration: 0.9, delay: idx * 0.14, ease: 'power4.out',
      }
    );

    // Perpetual subtle floating animation
    floatTlRef.current = gsap.to(imgRef.current, {
      y: -10, duration: 2.5 + idx * 0.3, repeat: -1, yoyo: true,
      ease: 'sine.inOut',
    });

    return () => floatTlRef.current?.kill();
  }, []);

  // 3D magnetic tilt on mouse move
  const handleMouseMove = (e) => {
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    gsap.to(card, {
      rotateX: -y * 16,
      rotateY: x * 16,
      transformPerspective: 1000,
      duration: 0.4,
      ease: 'power2.out',
    });
    // Move image slightly in opposite direction for depth illusion
    gsap.to(imgRef.current, {
      x: x * 18,
      y: y * 18 - 10,
      duration: 0.5,
      ease: 'power2.out',
    });
    // Glow tracks mouse
    if (glowRef.current) {
      gsap.to(glowRef.current, {
        left: `${(x + 0.5) * 100}%`,
        top: `${(y + 0.5) * 100}%`,
        opacity: 0.8,
        duration: 0.3,
      });
    }
  };

  const handleMouseLeave = () => {
    gsap.to(cardRef.current, {
      rotateX: 0, rotateY: 0, duration: 0.7, ease: 'elastic.out(1, 0.6)',
    });
    gsap.to(imgRef.current, {
      x: 0, y: -10, duration: 0.7, ease: 'elastic.out(1, 0.5)',
    });
    if (glowRef.current) {
      gsap.to(glowRef.current, { opacity: 0, duration: 0.4 });
    }
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => navigate('/shop')}
      style={{
        position: 'relative',
        cursor: 'pointer',
        // No card background — pure floating content
        willChange: 'transform',
        transformStyle: 'preserve-3d',
        opacity: 0, // set by gsap
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 10px 24px',
      }}
    >
      {/* Radial glow that follows cursor */}
      <div ref={glowRef} style={{
        position: 'absolute',
        width: 200, height: 200,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${cat.accent}55 0%, transparent 70%)`,
        transform: 'translate(-50%, -50%)',
        left: '50%', top: '50%',
        pointerEvents: 'none',
        opacity: 0,
        filter: 'blur(20px)',
        zIndex: 0,
      }} />

      {/* Product image — floating, no background */}
      <div ref={imgRef} style={{
        width: '80%',
        aspectRatio: '1/1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 2,
        marginBottom: '0.5rem',
      }}>
        {/* Soft glow under image */}
        <div style={{
          position: 'absolute',
          bottom: -20, left: '15%', right: '15%',
          height: 40,
          background: cat.accent,
          filter: 'blur(18px)',
          opacity: 0.35,
          borderRadius: '50%',
        }} />
        <img
          src={cat.img}
          alt={cat.label}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter: `drop-shadow(0 20px 40px ${cat.accent}66) drop-shadow(0 5px 15px rgba(0,0,0,0.6))`,
            mixBlendMode: 'lighten',
          }}
        />
      </div>

      {/* Text content area — thin border bottom attachment feeling */}
      <div style={{
        width: '100%',
        background: 'rgba(255,255,255,0.02)',
        backdropFilter: 'blur(10px)',
        border: `1px solid ${cat.accent}22`,
        borderTop: `2px solid ${cat.accent}`,
        borderRadius: '0 0 20px 20px',
        padding: '1.4rem 1.5rem',
        position: 'relative',
        zIndex: 2,
        transition: 'border-color 0.3s ease',
      }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = `${cat.accent}88`)}
        onMouseLeave={e => (e.currentTarget.style.borderColor = `${cat.accent}22`)}
      >
        {/* Badge */}
        <div style={{
          display: 'inline-block',
          background: cat.accent,
          color: '#000',
          fontSize: '0.58rem', fontWeight: 900,
          padding: '3px 10px', borderRadius: 100,
          letterSpacing: '1.5px', textTransform: 'uppercase',
          marginBottom: '0.7rem',
        }}>
          {cat.badge}
        </div>

        <h3 style={{
          fontWeight: 900, fontSize: '1.35rem', color: '#fff',
          marginBottom: '0.5rem', letterSpacing: '-0.02em',
        }}>
          {cat.icon} {cat.label}
        </h3>

        <p style={{ color: '#555', fontSize: '0.82rem', lineHeight: 1.65, marginBottom: '1rem' }}>
          {cat.desc}
        </p>

        {/* Mini product pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: '1.2rem' }}>
          {cat.products.map(p => (
            <span key={p} style={{
              fontSize: '0.68rem', fontWeight: 700, color: cat.accent,
              background: `${cat.accent}15`,
              border: `1px solid ${cat.accent}30`,
              padding: '3px 10px', borderRadius: 100,
            }}>{p}</span>
          ))}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: cat.accent }}>
            Sfoglia →
          </span>
          <span style={{ fontSize: '1.2rem' }}>{cat.icon}</span>
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
              accent: '#C8963C',
              products: ['Vaporesso ECO One Pro', 'Uwell Caliburn G3', 'GeekVape Aegis'],
              badge: 'Più Venduto',
              img: '/img/hardware.png',
            },
            {
              label: 'Liquidi',
              icon: '💧',
              desc: 'Aromi concentrati, shortfill, mini shot e liquidi pronti TPD.',
              accent: '#5B8CFF',
              products: ['Suprem-e One', 'TNT Booms', 'Svaponext'],
              badge: 'Nuovi Arrivi',
              img: '/img/liquidi.png',
            },
            {
              label: 'Accessori',
              icon: '🔧',
              desc: 'Coil di ricambio, pod, batterie e tutto il necessario per il tuo setup.',
              accent: '#FF6B6B',
              products: ['Coil Mesh 0.2Ω', 'Batteria 18650', 'Pod di ricambio'],
              badge: 'Essenziali',
              img: '/img/accessori.png',
            },
            {
              label: 'Usa e Getta',
              icon: '🌬️',
              desc: 'Dispositivi compatti, zero manutenzione, pronti all\'uso immediato.',
              accent: '#1BC47D',
              products: ['Elf Bar', 'Lost Mary', 'Vozol Star'],
              badge: 'Zero Config',
              img: '/img/usa_getta.png',
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
