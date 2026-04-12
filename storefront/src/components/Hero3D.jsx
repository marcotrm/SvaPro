/**
 * Hero3D.jsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Scroll-driven product reveal hero.
 *
 * SEQUENCE (while section is pinned over 3×100vh of scroll travel):
 *   0%  – 30%  → Product enters from bottom, spinning + scaling up, cinematic glow builds
 *   30% – 65%  → Product rotates 360° with particle burst
 *   65% – 90%  → Product settles center-right, glow fades into brand color
 *   90% – 100% → Headline + CTA + header navbar fade in (AFTER animation)
 *
 * Navbar is hidden (opacity 0) until progress ≥ 0.85.
 */

import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const GOLD = '#C8963C';
const SCROLL_HEIGHT = '400vh'; // How much the section occupies in scroll distance

export default function Hero3D({ onShopClick }) {
  const wrapRef = useRef(null);   // outer 400vh wrapper
  const stickyRef = useRef(null); // 100vh sticky panel
  const imgRef = useRef(null);    // product image
  const glowRef = useRef(null);
  const glowInnerRef = useRef(null);
  const copyRef = useRef(null);   // headline + CTA

  useEffect(() => {
    // Hide navbar until animation ends
    const navbar = document.getElementById('main-navbar');
    if (navbar) {
      gsap.set(navbar, { opacity: 0, y: -20, pointerEvents: 'none' });
    }

    const ctx = gsap.context(() => {

      /* ── Initial states ── */
      gsap.set(imgRef.current,  { y: 140, scale: 0.55, rotationY: -180, opacity: 0, rotationX: 20 });
      gsap.set(glowRef.current, { scale: 0, opacity: 0 });
      gsap.set(copyRef.current, { y: 40, opacity: 0 });

      /* ── Scroll timeline ── */
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrapRef.current,
          pin: stickyRef.current,
          start: 'top top',
          end: '+=300%',
          scrub: 2,
          anticipatePin: 1,
          onUpdate: (self) => {
            const p = self.progress;

            // Show navbar + copy after 85%
            if (navbar) {
              const navOpacity = p >= 0.85 ? Math.min(1, (p - 0.85) / 0.1) : 0;
              gsap.set(navbar, { opacity: navOpacity, y: navOpacity === 0 ? -20 : 0, pointerEvents: navOpacity > 0 ? 'all' : 'none' });
            }
          },
          onLeaveBack: () => {
            if (navbar) gsap.set(navbar, { opacity: 0, y: -20, pointerEvents: 'none' });
          },
        },
      });

      /* Phase 1 (0→0.35): Device rises and unspins */
      tl.to(imgRef.current, {
        y: 0, scale: 1, rotationY: 0, rotationX: 0, opacity: 1,
        duration: 0.35, ease: 'power3.out',
      }, 0);
      tl.to(glowRef.current, {
        scale: 1, opacity: 1, duration: 0.35, ease: 'power2.out',
      }, 0);

      /* Phase 2 (0.35→0.65): Slow proud full rotation */
      tl.to(imgRef.current, {
        rotationY: 360, duration: 0.3, ease: 'none',
      }, 0.35);

      /* Phase 3 (0.65→0.85): Settle right + glow shifts to gold */
      tl.to(imgRef.current, {
        x: '12vw', scale: 0.88, duration: 0.2, ease: 'power2.inOut',
      }, 0.65);
      tl.to(glowInnerRef.current, {
        background: `radial-gradient(circle, ${GOLD}55 0%, transparent 65%)`,
        duration: 0.2,
      }, 0.65);

      /* Phase 4 (0.85→1): Copy fades in */
      tl.to(copyRef.current, {
        y: 0, opacity: 1, duration: 0.15, ease: 'power3.out',
      }, 0.85);
    }, wrapRef);

    return () => {
      ctx.revert();
      // Restore navbar on unmount
      const navbar = document.getElementById('main-navbar');
      if (navbar) gsap.set(navbar, { opacity: 1, y: 0, pointerEvents: 'all' });
    };
  }, []);

  return (
    <div ref={wrapRef} style={{ height: SCROLL_HEIGHT, background: '#050505', position: 'relative' }}>

      {/* ── Sticky panel ── */}
      <div ref={stickyRef} style={{
        position: 'relative',
        height: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        background: '#050505',
      }}>

        {/* Subtle grid */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          backgroundImage: [
            'linear-gradient(rgba(200,150,60,0.025) 1px, transparent 1px)',
            'linear-gradient(90deg, rgba(200,150,60,0.025) 1px, transparent 1px)',
          ].join(','),
          backgroundSize: '72px 72px',
        }} />

        {/* Ambient glow container */}
        <div ref={glowRef} style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '60vw', height: '60vw',
          maxWidth: 720, maxHeight: 720,
          zIndex: 1, pointerEvents: 'none',
        }}>
          <div ref={glowInnerRef} style={{
            width: '100%', height: '100%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(180,180,255,0.25) 0%, transparent 65%)',
            filter: 'blur(40px)',
          }} />
        </div>

        {/* Product image — CSS 3D transforms driven by GSAP */}
        <div ref={imgRef} style={{
          position: 'relative', zIndex: 10,
          width: 'min(440px, 42vw)',
          transformStyle: 'preserve-3d',
          perspective: '1200px',
        }}>
          {/* Shadow reflection under device */}
          <div style={{
            position: 'absolute', bottom: -40, left: '10%', right: '10%',
            height: 60, borderRadius: '50%',
            background: GOLD,
            filter: 'blur(24px)',
            opacity: 0.3,
          }} />

          <img
            src="/img/hero_device.png"
            alt="Premium Vape Device"
            style={{
              width: '100%',
              display: 'block',
              filter: `drop-shadow(0 40px 80px ${GOLD}55) drop-shadow(0 0 60px rgba(100,140,255,0.3))`,
              mixBlendMode: 'lighten',
            }}
          />
        </div>

        {/* Copy — appears last */}
        <div ref={copyRef} style={{
          position: 'absolute', left: '5vw',
          top: '50%', transform: 'translateY(-50%)',
          zIndex: 20, maxWidth: 520,
        }}>
          <h1 style={{
            fontSize: 'clamp(3rem, 6vw, 5.5rem)',
            fontWeight: 900, lineHeight: 1.04,
            letterSpacing: '-0.04em', marginBottom: '1.5rem',
            color: '#fff',
          }}>
            Il Futuro<br />
            dello <span style={{
              background: `linear-gradient(120deg, ${GOLD} 0%, #f0d070 50%, ${GOLD} 100%)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>Svapo.</span>
          </h1>

          <p style={{
            color: '#555', fontSize: '1.05rem', lineHeight: 1.7,
            marginBottom: '2.5rem', maxWidth: 380,
          }}>
            Dispositivi premium, design senza compromessi.
          </p>

          <button
            onClick={onShopClick}
            style={{
              background: `linear-gradient(135deg, ${GOLD} 0%, #f0d070 100%)`,
              border: 'none', borderRadius: 100,
              padding: '1.1rem 2.6rem',
              fontWeight: 900, fontSize: '1rem',
              cursor: 'pointer', fontFamily: 'inherit',
              color: '#0a0a0a',
              boxShadow: `0 0 50px ${GOLD}44`,
              transition: 'transform 0.25s ease, box-shadow 0.25s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 14px 60px ${GOLD}66`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 0 50px ${GOLD}44`; }}
          >
            Acquista Ora →
          </button>
        </div>

        {/* Scroll hint — visible only at start */}
        <div id="hero-scroll-hint" style={{
          position: 'absolute', bottom: 36, left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, textAlign: 'center',
          color: '#333', fontSize: '0.72rem', fontWeight: 700,
          letterSpacing: '2px', textTransform: 'uppercase',
        }}>
          <div style={{
            width: 1, height: 48, background: 'linear-gradient(to bottom, transparent, #444)',
            margin: '0 auto 10px',
          }} />
          Scorri
        </div>

      </div>
    </div>
  );
}
