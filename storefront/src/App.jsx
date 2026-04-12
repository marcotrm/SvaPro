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

/* ──────────────────────────────── Scroll Products ── */
const PRODUCTS = [
  {
    label: 'ECO One Pro',
    tagline: '01 — Bestseller',
    headline: 'Design che non\ncompromette.',
    body: 'Pod compatta da 2ml, potenza fino a 25W, ricarica USB-C in 45 minuti. Realizzata in alluminio aeronautico di grado 6061.',
    specs: ['25W Max Output', 'Batteria 1000mAh', '0.6Ω / 1.2Ω'],
    price: '€39.90',
    accent: '#C8963C',
    img: '/img/hero_vape_1.png',
  },
  {
    label: 'Nexus Pod Kit',
    tagline: '02 — Nuovissimo',
    headline: 'Tecnologia.\nRidefinita.',
    body: 'Sistema dual-coil con airflow a doppio canale. Il vapore più denso della sua categoria, con zero leaking garantito.',
    specs: ['Airflow Regolabile', 'Pod da 3ml', 'Draw-activated'],
    price: '€54.90',
    accent: '#5B8CFF',
    img: '/img/hero_vape_2.png',
  },
  {
    label: 'Zeus Sub-Ohm',
    tagline: '03 — Pro Series',
    headline: 'Potenza senza\ncompromessi.',
    body: 'Mod 80W con schermo OLED, controllo temperatura avanzato e protezioni complete. Per i vaper più esigenti.',
    specs: ['80W Output', 'Schermo OLED', 'Temp Control'],
    price: '€89.90',
    accent: '#FF6B6B',
    img: '/img/hero_vape_1.png',
  },
];

function ScrollProducts({ navigate }) {
  const sectionRef  = useRef(null);
  const imgRefs     = useRef([]);   // 3 img separate per il crossfade
  const glowRefs    = useRef([]);
  const textPanels  = useRef([]);

  useEffect(() => {
    const ctx = gsap.context(() => {

      // Stato iniziale: solo il primo prodotto visibile
      imgRefs.current.forEach((el, i) => gsap.set(el,  { opacity: i === 0 ? 1 : 0, scale: i === 0 ? 1 : 0.88 }));
      glowRefs.current.forEach((el, i) => gsap.set(el, { opacity: i === 0 ? 1 : 0 }));
      textPanels.current.forEach((el, i) => gsap.set(el, { opacity: i === 0 ? 0 : 0, x: i === 0 ? 0 : 90 }));

      // Timeline unica scrubbed sull'intera sezione
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.0,
        },
      });

      // Total duration = 1 (0 → 1)
      // Prodotto 0:  0.00 → 0.33
      // Prodotto 1:  0.33 → 0.66
      // Prodotto 2:  0.66 → 1.00
      const STEP = 1 / PRODUCTS.length; // 0.333

      PRODUCTS.forEach((_, i) => {
        const start    = i * STEP;
        const midStart = start + STEP * 0.15;  // testo entra
        const midEnd   = start + STEP * 0.75;  // testo esce
        const end      = start + STEP;         // prossimo step

        // Testo IN
        tl.to(textPanels.current[i], {
          opacity: 1, x: 0, duration: STEP * 0.18, ease: 'power3.out'
        }, midStart);

        if (i < PRODUCTS.length - 1) {
          // Testo OUT
          tl.to(textPanels.current[i], {
            opacity: 0, x: -70, duration: STEP * 0.12, ease: 'power3.in'
          }, midEnd);

          // Immagine crossfade: corrente esce, prossima entra
          tl.to(imgRefs.current[i], {
            opacity: 0, scale: 1.1, duration: STEP * 0.18, ease: 'power2.in'
          }, midEnd);
          tl.to(glowRefs.current[i], { opacity: 0, duration: STEP * 0.15 }, midEnd);

          tl.to(imgRefs.current[i + 1], {
            opacity: 1, scale: 1, duration: STEP * 0.22, ease: 'power2.out'
          }, midEnd + STEP * 0.08);
          tl.to(glowRefs.current[i + 1], { opacity: 1, duration: STEP * 0.2 }, midEnd + STEP * 0.08);
        }
      });

    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{ background: '#000', position: 'relative', height: `${PRODUCTS.length * 100}vh` }}
    >
      {/* Sticky viewport */}
      <div style={{
        position: 'sticky', top: 0, height: '100vh',
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        alignItems: 'center', overflow: 'hidden',
        background: '#000',
      }}>

        {/* ── LEFT: tutti e 3 i prodotti sovrapposti, crossfade ── */}
        <div style={{ height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {PRODUCTS.map((prod, i) => (
            <React.Fragment key={i}>
              {/* Glow */}
              <div
                ref={el => (glowRefs.current[i] = el)}
                style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)',
                  width: '55%', height: '55%',
                  background: `radial-gradient(circle, ${prod.accent}22 0%, transparent 65%)`,
                  filter: 'blur(70px)',
                  pointerEvents: 'none',
                }}
              />
              {/* Prodotto — NO sfondo, screen blend su div nero */}
              <img
                ref={el => (imgRefs.current[i] = el)}
                src={prod.img}
                alt={prod.label}
                style={{
                  position: 'absolute',
                  width: '62%', maxWidth: 380,
                  objectFit: 'contain',
                  mixBlendMode: 'screen',        // magia: sfondo nero sparisce
                  filter: `drop-shadow(0 0 60px ${prod.accent}55)`,
                  animation: 'float 4s ease-in-out infinite',
                  animationDelay: `${i * 0.4}s`,
                }}
              />
            </React.Fragment>
          ))}
        </div>

        {/* ── RIGHT: pannelli testo sovrapposti ── */}
        <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}>
          {PRODUCTS.map((prod, i) => (
            <div
              key={i}
              ref={el => (textPanels.current[i] = el)}
              style={{ position: 'absolute', left: 0, right: 0, padding: '0 6vw 0 2vw' }}
            >
              {/* Numero / tagline */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.8rem' }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#3a3a3a', letterSpacing: '1px' }}>
                  {prod.tagline.split('—')[0].trim()}
                </span>
                <span style={{ width: 28, height: 1, background: prod.accent }} />
                <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: prod.accent, letterSpacing: '2px' }}>
                  {prod.tagline.split('—')[1]?.trim()}
                </span>
              </div>

              <div style={{ fontSize: '0.7rem', color: '#3a3a3a', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                {prod.label}
              </div>

              <h2 style={{ fontSize: 'clamp(2.2rem, 3.8vw, 3.5rem)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.04em', color: '#fff', marginBottom: '1.8rem', whiteSpace: 'pre-line' }}>
                {prod.headline}
              </h2>

              <p style={{ color: '#666', fontSize: '1rem', lineHeight: 1.8, maxWidth: 400, marginBottom: '2.5rem', fontWeight: 400 }}>
                {prod.body}
              </p>

              {/* Specs */}
              <div style={{ display: 'flex', gap: '2.4rem', marginBottom: '3rem' }}>
                {prod.specs.map((s, si) => (
                  <div key={si} style={{ borderLeft: `2px solid ${prod.accent}55`, paddingLeft: 12 }}>
                    <div style={{ fontSize: '0.7rem', color: prod.accent, fontWeight: 800 }}>{s}</div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.8rem' }}>
                <div style={{ fontSize: '2rem', color: prod.accent, fontWeight: 900, letterSpacing: '-1px' }}>{prod.price}</div>
                <button
                  onClick={() => navigate('/shop')}
                  style={{ background: '#fff', color: '#000', border: 'none', borderRadius: 100, padding: '1rem 2.2rem', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = prod.accent; e.currentTarget.style.transform = 'scale(1.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'scale(1)'; }}
                >Acquista Ora</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-16px)} }`}</style>
    </section>
  );
}

/* ──────────────────────────────── Categories Section ── */
function CategoriesSection({ navigate }) {
  const CATS = [
    { label: 'Hardware',    desc: 'Pod, mod e kit',     accent: '#C8963C', img: '/img/hero_vape_1.png' },
    { label: 'Liquidi',     desc: 'Aromi e shortfill',  accent: '#5B8CFF', img: '/img/liquidi.png' },
    { label: 'Accessori',   desc: 'Coil e ricambi',     accent: '#FF6B6B', img: '/img/accessori.png' },
    { label: 'Usa e Getta', desc: 'Zero config',        accent: '#1BC47D', img: '/img/hero_vape_2.png' },
  ];

  return (
    <section style={{ background: '#000', padding: '8rem 5vw 10rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '3px', color: '#C8963C', textTransform: 'uppercase', marginBottom: '1rem' }}>— Esplora</div>
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em' }}>
            La tua categoria.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '2rem' }}>
          {CATS.map((cat, idx) => (
            <CategoryCard key={cat.label} cat={cat} idx={idx} navigate={navigate} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────── Home ── */
function Home({ onCartOpen }) {
  const navigate = useNavigate();

  return (
    <main>
      <Navbar onCartOpen={onCartOpen} />
      <Hero3D onShopClick={() => navigate('/shop')} />

      {/* ── Scroll Storytelling Products ── */}
      <ScrollProducts navigate={navigate} />

      {/* ── Categories Section ── */}
      <CategoriesSection navigate={navigate} />
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
