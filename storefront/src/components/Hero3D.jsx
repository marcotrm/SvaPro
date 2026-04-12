import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function Hero3D({ onShopClick }) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const deviceRef = useRef(null);
  const glowRef = useRef(null);
  const particlesRef = useRef(null);
  const badgeRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {

      // 1. Entrance sequence
      const tl = gsap.timeline({ delay: 0.2 });
      tl.fromTo('.hero-eyebrow',
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' }
      )
      .fromTo('.hero-title-word',
        { y: 80, opacity: 0, rotationX: -40 },
        { y: 0, opacity: 1, rotationX: 0, duration: 0.9, stagger: 0.12, ease: 'power4.out' },
        '-=0.3'
      )
      .fromTo('.hero-subtitle',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' },
        '-=0.4'
      )
      .fromTo('.hero-cta-group',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' },
        '-=0.3'
      );

      // 2. Device floating
      gsap.fromTo(deviceRef.current,
        { x: 150, opacity: 0, rotationY: -40 },
        { x: 0, opacity: 1, rotationY: 0, duration: 1.4, delay: 0.5, ease: 'power4.out' }
      );
      gsap.to(deviceRef.current, {
        y: -18, duration: 2.8, repeat: -1, yoyo: true, ease: 'sine.inOut',
      });

      // 3. Glow pulse
      gsap.to(glowRef.current, {
        scale: 1.2, opacity: 0.65, duration: 2.5, repeat: -1, yoyo: true, ease: 'sine.inOut',
      });

      // 4. Badge pop
      gsap.fromTo(badgeRef.current,
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.8, delay: 1.2, ease: 'back.out(2)' }
      );

      // 5. Scroll parallax
      gsap.to(textRef.current, {
        scrollTrigger: { trigger: containerRef.current, start: 'top top', end: 'bottom top', scrub: 1.2 },
        y: -180, opacity: 0, ease: 'none',
      });
      gsap.to(deviceRef.current, {
        scrollTrigger: { trigger: containerRef.current, start: 'top top', end: 'bottom top', scrub: 1 },
        y: 120, rotationY: 40, rotationX: 20, scale: 1.3, ease: 'none',
      });

      // 6. Vapor particles float up
      if (particlesRef.current) {
        const dots = particlesRef.current.querySelectorAll('.vapor-dot');
        dots.forEach((p, i) => {
          gsap.set(p, { y: 0, opacity: 0 });
          gsap.to(p, {
            y: -(280 + Math.random() * 180),
            x: (Math.random() - 0.5) * 100,
            opacity: 0.5,
            scale: 0.6 + Math.random(),
            duration: 4 + Math.random() * 3,
            delay: i * 0.35,
            repeat: -1,
            yoyo: true,
            ease: 'power1.inOut',
          });
        });
      }
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} style={{
      position: 'relative',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      background: 'radial-gradient(ellipse 80% 60% at 65% 40%, rgba(181,141,61,0.08) 0%, transparent 70%), #050505',
    }}>

      {/* Grid lines */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        backgroundImage: `linear-gradient(rgba(181,141,61,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(181,141,61,0.04) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }} />

      {/* Glow orb */}
      <div ref={glowRef} style={{
        position: 'absolute', right: '12%', top: '50%',
        transform: 'translate(0, -50%)',
        width: '44vw', height: '44vw',
        maxWidth: 580, maxHeight: 580,
        background: 'radial-gradient(circle, rgba(181,141,61,0.18) 0%, transparent 70%)',
        borderRadius: '50%', zIndex: 2, filter: 'blur(30px)',
        transformOrigin: 'center center',
      }} />

      {/* Vapor particles */}
      <div ref={particlesRef} style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}>
        {Array.from({ length: 14 }, (_, i) => (
          <div key={i} className="vapor-dot" style={{
            position: 'absolute',
            left: `${30 + (i * 4) % 40}%`,
            bottom: '12%',
            width: `${4 + (i % 3) * 4}px`,
            height: `${4 + (i % 3) * 4}px`,
            borderRadius: '50%',
            background: i % 2 === 0 ? '#B58D3D' : 'rgba(255,255,255,0.35)',
            filter: 'blur(2px)',
          }} />
        ))}
      </div>

      {/* Left: Text */}
      <div ref={textRef} style={{
        position: 'relative', zIndex: 10,
        maxWidth: 680, padding: '0 5vw',
        flex: 1, paddingTop: 80,
      }}>

        {/* Eyebrow */}
        <div className="hero-eyebrow" style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          background: 'rgba(181,141,61,0.1)',
          border: '1px solid rgba(181,141,61,0.3)',
          borderRadius: 100, padding: '6px 18px',
          marginBottom: '2rem',
          opacity: 0,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#B58D3D', display: 'block', boxShadow: '0 0 8px #B58D3D' }} />
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#B58D3D', letterSpacing: '2.5px', textTransform: 'uppercase' }}>
            Nuova Collezione 2025
          </span>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 'clamp(3rem, 7.5vw, 6.5rem)',
          fontWeight: 900,
          lineHeight: 1.02,
          letterSpacing: '-0.04em',
          marginBottom: '1.5rem',
        }}>
          {['Svapa', 'in', 'Stile.'].map((word, i) => (
            <span key={i} className="hero-title-word" style={{
              display: 'inline-block', marginRight: '0.28em',
              background: i === 2
                ? 'linear-gradient(120deg, #B58D3D 0%, #e8c97a 50%, #B58D3D 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #aaaaaa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              opacity: 0,
            }}>{word}</span>
          ))}
        </h1>

        {/* Subtitle */}
        <p className="hero-subtitle" style={{
          fontSize: 'clamp(1rem, 2vw, 1.2rem)',
          color: '#666',
          lineHeight: 1.75,
          maxWidth: 500,
          marginBottom: '2.5rem',
          opacity: 0,
        }}>
          Dispositivi premium, liquidi artigianali e accessori curati.<br />
          Il punto di riferimento del vaping in Italia —{' '}
          <span style={{ color: '#B58D3D', fontWeight: 700 }}>oltre 20 negozi</span> in tutta la penisola.
        </p>

        {/* CTAs */}
        <div className="hero-cta-group" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', opacity: 0 }}>
          <button
            onClick={onShopClick}
            style={{
              background: 'linear-gradient(135deg, #B58D3D 0%, #e8c97a 100%)',
              border: 'none', borderRadius: 100,
              padding: '1rem 2.4rem',
              fontWeight: 800, fontSize: '1rem',
              cursor: 'pointer', fontFamily: 'inherit',
              color: '#0a0a0a',
              boxShadow: '0 0 40px rgba(181,141,61,0.4)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.03)'; e.currentTarget.style.boxShadow = '0 12px 50px rgba(181,141,61,0.55)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 0 40px rgba(181,141,61,0.4)'; }}
          >
            Scopri i Prodotti →
          </button>
          <button
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 100, padding: '1rem 2.4rem',
              fontWeight: 600, fontSize: '1rem',
              cursor: 'pointer', fontFamily: 'inherit', color: '#777',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(181,141,61,0.5)'; e.currentTarget.style.color = '#B58D3D'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#777'; }}
          >
            Trova un Negozio
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '2.5rem', marginTop: '3rem', flexWrap: 'wrap' }}>
          {[['20+', 'Negozi'], ['500+', 'Prodotti'], ['50K+', 'Clienti']].map(([num, label]) => (
            <div key={label}>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#B58D3D', lineHeight: 1 }}>{num}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Device */}
      <div style={{
        position: 'absolute', right: '5%', top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 8,
        width: 'clamp(260px, 36vw, 500px)',
        perspective: '1000px',
      }}>
        <div ref={deviceRef} style={{ position: 'relative', transformStyle: 'preserve-3d' }}>

          {/* Product image */}
          <img
            src="https://images.unsplash.com/photo-1560707303-4e980ce876ad?w=700&q=90"
            alt="Premium Vape Device"
            style={{
              width: '100%',
              borderRadius: 24,
              filter: 'drop-shadow(0 40px 100px rgba(181,141,61,0.45)) drop-shadow(0 0 40px rgba(181,141,61,0.2))',
            }}
          />

          {/* Product badge */}
          <div ref={badgeRef} style={{
            position: 'absolute', top: '8%', left: '-18%',
            background: 'rgba(8,8,8,0.9)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(181,141,61,0.35)',
            borderRadius: 18, padding: '14px 20px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            opacity: 0,
          }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#B58D3D', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 5 }}>🏆 Bestseller</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>Vaporesso ECO One Pro</div>
            <div style={{ fontSize: '1rem', color: '#B58D3D', fontWeight: 900, marginTop: 4 }}>€ 39.90</div>
          </div>

          {/* Review badge */}
          <div style={{
            position: 'absolute', bottom: '10%', right: '-14%',
            background: 'rgba(8,8,8,0.85)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16, padding: '10px 18px',
            fontSize: '0.8rem', color: '#fff', fontWeight: 700,
            boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
          }}>
            ⭐ 4.9 &nbsp;<span style={{ color: '#555', fontWeight: 400 }}>· 2.341 recensioni</span>
          </div>
        </div>
      </div>
    </section>
  );
}
