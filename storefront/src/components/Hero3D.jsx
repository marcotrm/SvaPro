import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import HeroCanvas3D from './HeroCanvas3D';

gsap.registerPlugin(ScrollTrigger);

export default function Hero3D({ onShopClick }) {
  const sectionRef = useRef(null);
  const overlayRef = useRef(null);
  const titleWordsRef = useRef([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // ── Text entrance (on load) ────────────────────────────────────────────
      gsap.fromTo('.hero3d-eyebrow',
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, delay: 0.3, ease: 'power3.out' }
      );
      gsap.fromTo('.hero3d-word',
        { y: 60, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, stagger: 0.13, delay: 0.5, ease: 'power4.out' }
      );
      gsap.fromTo('.hero3d-sub',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, delay: 0.9, ease: 'power3.out' }
      );
      gsap.fromTo('.hero3d-cta',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, delay: 1.1, ease: 'power3.out' }
      );

      // ── Overlay text fades out as user scrolls + "Assembled" message fades in
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top top',
        end: '+=300%',
        scrub: 0.8,
        onUpdate: (self) => {
          const p = self.progress;
          // Intro text fades out in first 20% of scroll
          const overlayOpacity = Math.max(0, 1 - p * 5);
          if (overlayRef.current) overlayRef.current.style.opacity = overlayOpacity;

          // Show final CTA when assembly is complete (>90%)
          const finalEl = document.getElementById('hero3d-final-cta');
          if (finalEl) {
            finalEl.style.opacity = Math.max(0, (p - 0.9) * 10);
            finalEl.style.transform = `translateY(${Math.max(0, (1 - (p - 0.9) * 10) * 30)}px)`;
          }
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={sectionRef}
      style={{
        position: 'relative',
        height: '400vh',
        background: '#050505',
      }}
    >
      {/* ── GSAP will pin .hero3d-sticky during scroll ── */}
      <div className="hero3d-sticky" style={{
        position: 'relative',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'stretch',
      }}>
        {/* Background gradient */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'radial-gradient(ellipse 70% 70% at 70% 50%, rgba(181,141,61,0.06) 0%, transparent 70%), #050505',
        }} />

        {/* Grid lines */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
          backgroundImage: [
            'linear-gradient(rgba(181,141,61,0.03) 1px, transparent 1px)',
            'linear-gradient(90deg, rgba(181,141,61,0.03) 1px, transparent 1px)',
          ].join(','),
          backgroundSize: '70px 70px',
        }} />

        {/* 3D Canvas — right side */}
        <div style={{
          position: 'absolute', right: 0, top: 0,
          width: '55%', height: '100%',
          zIndex: 5,
        }}>
          <HeroCanvas3D scrollRef={sectionRef} />
        </div>

        {/* Left overlay text — fades out with scroll */}
        <div
          ref={overlayRef}
          style={{
            position: 'relative', zIndex: 10,
            width: '50%', maxWidth: 640,
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            padding: '0 5vw',
          }}
        >
          {/* Eyebrow */}
          <div className="hero3d-eyebrow" style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'rgba(181,141,61,0.1)',
            border: '1px solid rgba(181,141,61,0.3)',
            borderRadius: 100, padding: '6px 18px',
            width: 'fit-content', marginBottom: '2rem', opacity: 0,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#B58D3D', display: 'block',
              boxShadow: '0 0 10px #B58D3D',
            }} />
            <span style={{
              fontSize: '0.7rem', fontWeight: 800, color: '#B58D3D',
              letterSpacing: '2.5px', textTransform: 'uppercase',
            }}>
              Nuova Collezione 2025
            </span>
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: 'clamp(2.8rem, 6.5vw, 5.5rem)',
            fontWeight: 900, lineHeight: 1.05,
            letterSpacing: '-0.04em',
            marginBottom: '1.5rem',
          }}>
            {[
              { text: 'Il',    gold: false },
              { text: 'Futuro', gold: false },
              { text: 'dello', gold: false },
              { text: 'Svapo', gold: true  },
              { text: 'è',     gold: false },
              { text: 'Qui.', gold: true  },
            ].map(({ text, gold }, i) => (
              <span
                key={i}
                className="hero3d-word"
                style={{
                  display: 'inline-block',
                  marginRight: '0.28em',
                  opacity: 0,
                  ...(gold ? {
                    background: 'linear-gradient(120deg, #B58D3D 0%, #e8c97a 50%, #B58D3D 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  } : {
                    color: '#ffffff',
                  })
                }}
              >
                {text}
              </span>
            ))}
          </h1>

          <p className="hero3d-sub" style={{
            fontSize: 'clamp(1rem, 1.8vw, 1.2rem)',
            color: '#666', lineHeight: 1.75,
            maxWidth: 460, marginBottom: '2.5rem',
            opacity: 0,
          }}>
            Scorri per assistere all'assemblaggio del nostro dispositivo di punta.
            Ingegneria di precisione, design senza compromessi.
          </p>

          <div className="hero3d-cta" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', opacity: 0 }}>
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
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 50px rgba(181,141,61,0.55)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 0 40px rgba(181,141,61,0.4)'; }}
            >
              Scopri i Prodotti →
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#555', fontSize: '0.85rem', fontWeight: 600 }}>
              <span>↓ Scorri per l'anteprima 3D</span>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '2.5rem', marginTop: '3rem', flexWrap: 'wrap' }}>
            {[['20+', 'Negozi'], ['500+', 'Prodotti'], ['50K+', 'Clienti']].map(([n, l]) => (
              <div key={l}>
                <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#B58D3D', lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: 3 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Final assembled CTA — appears when device is fully built */}
        <div
          id="hero3d-final-cta"
          style={{
            position: 'absolute',
            bottom: '8%', left: '50%', transform: 'translateX(-50%)',
            zIndex: 20,
            textAlign: 'center',
            opacity: 0,
            transition: 'none',
            pointerEvents: 'none',
          }}
        >
          <div style={{
            background: 'rgba(8,8,8,0.85)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(181,141,61,0.3)',
            borderRadius: 24, padding: '1.5rem 3rem',
            boxShadow: '0 20px 80px rgba(181,141,61,0.2)',
          }}>
            <div style={{ color: '#B58D3D', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 8 }}>
              ✅ Assemblaggio Completato
            </div>
            <div style={{ color: '#fff', fontSize: '1.3rem', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>
              Vaporesso ECO One Pro
            </div>
            <div style={{ color: '#555', fontSize: '0.85rem', marginBottom: '1.2rem' }}>
              Pod da 2ml · Potenza 25W · Ricarica USB-C · Autonomia 1000mAh
            </div>
            <button
              onClick={onShopClick}
              style={{
                background: 'linear-gradient(135deg, #B58D3D, #e8c97a)',
                border: 'none', borderRadius: 100,
                padding: '0.9rem 2.2rem',
                fontWeight: 800, fontSize: '0.95rem',
                cursor: 'pointer', fontFamily: 'inherit',
                color: '#0a0a0a', pointerEvents: 'all',
              }}
            >
              Acquista Ora — €39.90 →
            </button>
          </div>
        </div>

        {/* Scroll progress indicator */}
        <div style={{
          position: 'absolute', right: '2rem', top: '50%', transform: 'translateY(-50%)',
          zIndex: 20, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
        }}>
          {['Corpo', 'Bocchino', 'Anelli', 'Pulsanti', 'Completo'].map((step, i) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(181,141,61,0.3)' }} />
              <span style={{ fontSize: '0.6rem', color: '#333', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
