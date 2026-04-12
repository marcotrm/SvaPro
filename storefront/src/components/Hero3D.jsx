/**
 * Hero3D.jsx  —  Apple-style fullscreen scroll hero
 * ─────────────────────────────────────────────────
 *  • Product image centered, full-screen, with white bg (multiply blend removes it)
 *  • Pinned 500vh section gives lots of scroll travel
 *  • GSAP ScrollTrigger drives 3 text panels + product transforms
 *
 *  Scroll sequence:
 *    0–20%   Product starts dark/blurred/small → brightens and grows
 *    20–45%  PANEL 1: "Ingegneria di Precisione."  slides in left
 *    45–70%  PANEL 2: "Portalo Ovunque."           slides in left (prev fades)
 *    70–92%  PANEL 3: "Acquistalo Ora."  + CTA     slides in left (prev fades)
 *    92–100% Navbar fades in
 */

import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const GOLD = '#C8963C';

const PANELS = [
  {
    eyebrow: 'Design',
    headline: 'Ingegneria\ndi Precisione.',
    body: 'Ogni componente scelto con cura. Ogni dettaglio pensato per durare.',
  },
  {
    eyebrow: 'Portabilità',
    headline: 'Tascabile.\nSempre con te.',
    body: 'Compatto al punto giusto. Perfetto per ogni momento della giornata.',
  },
  {
    eyebrow: 'Collezione 2025',
    headline: 'Il Futuro\ndello Svapo.',
    body: null, // shows CTA instead
    cta: 'Scopri la Collezione →',
  },
];

export default function Hero3D({ onShopClick }) {
  const wrapRef   = useRef(null);
  const stickyRef = useRef(null);
  const imgRef    = useRef(null);
  const glowRef   = useRef(null);
  const panelRefs = useRef([]);

  useEffect(() => {
    // Hide navbar initially
    const navbar = document.getElementById('main-navbar');
    if (navbar) gsap.set(navbar, { opacity: 0, y: -16, pointerEvents: 'none' });

    const ctx = gsap.context(() => {
      /* ── Initial states ── */
      gsap.set(imgRef.current, { scale: 0.42, filter: 'brightness(0) blur(22px)', rotationY: -30 });
      gsap.set(glowRef.current, { scale: 0, opacity: 0 });
      panelRefs.current.forEach(p => gsap.set(p, { x: -80, opacity: 0 }));

      /* ── Main scrollTrigger: pin the sticky div ── */
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrapRef.current,
          pin: stickyRef.current,
          start: 'top top',
          end: '+=450%',
          scrub: 1.8,
          anticipatePin: 1,
          onUpdate: (self) => {
            // Navbar fades in at 90%+
            if (navbar) {
              const p = self.progress;
              const v = p >= 0.90 ? Math.min(1, (p - 0.90) / 0.08) : 0;
              navbar.style.opacity = v;
              navbar.style.transform = `translateY(${v === 0 ? -16 : 0}px)`;
              navbar.style.pointerEvents = v > 0 ? 'all' : 'none';
            }
          },
        },
      });

      // Phase 0→0.22: product emerges
      tl.to(imgRef.current, {
        scale: 1,
        filter: 'brightness(1) blur(0px)',
        rotationY: 0,
        duration: 0.22,
        ease: 'power3.out',
      }, 0);
      tl.to(glowRef.current, {
        scale: 1, opacity: 1, duration: 0.22, ease: 'power2.out',
      }, 0);

      // Phase 0.20→0.44: product slight rotation + PANEL 1 IN
      tl.to(imgRef.current, {
        rotationY: 8, duration: 0.12, ease: 'power2.inOut',
      }, 0.22);
      tl.to(panelRefs.current[0], {
        x: 0, opacity: 1, duration: 0.1, ease: 'power3.out',
      }, 0.22);
      // Panel 1 lingers until 0.44
      tl.to(panelRefs.current[0], {
        x: -60, opacity: 0, duration: 0.07, ease: 'power2.in',
      }, 0.44);

      // Phase 0.44→0.68: product rotates other way + PANEL 2 IN
      tl.to(imgRef.current, {
        rotationY: -8, duration: 0.12, ease: 'power2.inOut',
      }, 0.45);
      tl.to(panelRefs.current[1], {
        x: 0, opacity: 1, duration: 0.1, ease: 'power3.out',
      }, 0.45);
      tl.to(panelRefs.current[1], {
        x: -60, opacity: 0, duration: 0.07, ease: 'power2.in',
      }, 0.68);

      // Phase 0.68→0.90: product straightens + PANEL 3 IN
      tl.to(imgRef.current, {
        rotationY: 0, scale: 0.95, duration: 0.12, ease: 'power2.inOut',
      }, 0.69);
      tl.to(panelRefs.current[2], {
        x: 0, opacity: 1, duration: 0.1, ease: 'power3.out',
      }, 0.70);
      // Panel 3 stays visible (no fadeout — CTA is the end state)
    });

    return () => {
      ctx.revert();
      if (navbar) {
        navbar.style.opacity = '1';
        navbar.style.transform = 'translateY(0)';
        navbar.style.pointerEvents = 'all';
      }
    };
  }, []);

  return (
    <div ref={wrapRef} style={{ height: '550vh', position: 'relative', background: '#fff' }}>
      {/* ── Sticky fullscreen panel ── */}
      <div ref={stickyRef} style={{
        position: 'relative',
        height: '100vh',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>

        {/* Subtle warm vignette at edges */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(230,220,210,0.6) 100%)',
        }} />

        {/* Ambient glow behind product */}
        <div ref={glowRef} style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '55vw', height: '55vw',
          maxWidth: 700, maxHeight: 700,
          background: `radial-gradient(circle, ${GOLD}22 0%, transparent 68%)`,
          filter: 'blur(50px)',
          zIndex: 2, pointerEvents: 'none',
          transformOrigin: 'center center',
        }} />

        {/* ── Center product ── */}
        <div ref={imgRef} style={{
          position: 'relative', zIndex: 5,
          width: 'min(460px, 44vw)',
          transformStyle: 'preserve-3d',
          perspective: '1200px',
        }}>
          {/* Soft shadow under */}
          <div style={{
            position: 'absolute', bottom: -30, left: '15%', right: '15%',
            height: 50, borderRadius: '50%',
            background: 'rgba(180,140,60,0.18)',
            filter: 'blur(20px)',
          }} />
          <img
            src="/img/hero_device.png"
            alt="Vaporesso ECO One Pro"
            style={{
              width: '100%', display: 'block',
              mixBlendMode: 'multiply',   // removes white bg on white page
              filter: 'drop-shadow(0 30px 60px rgba(180,140,60,0.2))',
            }}
          />
        </div>

        {/* ── 3 Text Panels (abs-positioned left side) ── */}
        {PANELS.map((p, i) => (
          <div
            key={i}
            ref={el => (panelRefs.current[i] = el)}
            style={{
              position: 'absolute',
              left: '5vw', top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              maxWidth: 420,
              opacity: 0,
            }}
          >
            {/* Eyebrow */}
            <div style={{
              fontSize: '0.68rem', fontWeight: 800, letterSpacing: '3px',
              textTransform: 'uppercase', color: GOLD,
              marginBottom: '1.2rem',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ width: 24, height: 1, background: GOLD, display: 'inline-block' }} />
              {p.eyebrow}
            </div>

            {/* Headline */}
            <h2 style={{
              fontSize: 'clamp(2.4rem, 5vw, 4.2rem)',
              fontWeight: 900, lineHeight: 1.04,
              letterSpacing: '-0.04em',
              color: '#111',
              whiteSpace: 'pre-line',
              marginBottom: '1.4rem',
            }}>
              {p.headline}
            </h2>

            {/* Body or CTA */}
            {p.body && (
              <p style={{ color: '#888', fontSize: '1rem', lineHeight: 1.7, maxWidth: 320 }}>
                {p.body}
              </p>
            )}
            {p.cta && (
              <button
                onClick={onShopClick}
                style={{
                  marginTop: '0.5rem',
                  background: '#111', border: 'none', borderRadius: 100,
                  padding: '1rem 2.4rem',
                  fontWeight: 800, fontSize: '0.95rem',
                  cursor: 'pointer', fontFamily: 'inherit', color: '#fff',
                  transition: 'background 0.25s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = GOLD)}
                onMouseLeave={e => (e.currentTarget.style.background = '#111')}
              >
                {p.cta}
              </button>
            )}
          </div>
        ))}

        {/* ── Scroll hint (fades out as user scrolls) ── */}
        <div style={{
          position: 'absolute', bottom: 36, left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, textAlign: 'center',
          color: '#bbb', fontSize: '0.68rem', fontWeight: 700,
          letterSpacing: '2px', textTransform: 'uppercase',
        }}>
          <div style={{
            width: 1, height: 40, background: 'linear-gradient(to bottom, transparent, #ccc)',
            margin: '0 auto 8px',
          }} />
          Scorri
        </div>

        {/* ── Small product name badge bottom-right ── */}
        <div style={{
          position: 'absolute', bottom: 40, right: '5vw',
          zIndex: 20,
          textAlign: 'right',
        }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#ccc', letterSpacing: '2px', textTransform: 'uppercase' }}>ECO ONE PRO</div>
          <div style={{ fontSize: '0.8rem', color: '#999', fontWeight: 600, marginTop: 2 }}>Pod 2ml · 25W · USB-C</div>
          <div style={{ fontSize: '1rem', color: GOLD, fontWeight: 900, marginTop: 4 }}>€ 39.90</div>
        </div>

      </div>
    </div>
  );
}
