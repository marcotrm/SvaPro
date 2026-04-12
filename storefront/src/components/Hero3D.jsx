/**
 * Hero3D.jsx — Apple-style cinematic scroll hero
 * ──────────────────────────────────────────────
 *  Pure black background, product centered and large.
 *  GSAP ScrollTrigger scrubs 5 phases:
 *
 *  Phase 0 → 0.18  Product emerges from dark (scale + brightness)
 *  Phase 0.18→0.38  TEXT 1:  "Il Futuro del Vaping."
 *  Phase 0.38→0.58  TEXT 2:  "Ogni Dettaglio. Perfetto."
 *  Phase 0.58→0.80  TEXT 3:  "Vaporesso ECO One Pro" + price + CTA
 *  Phase 0.82→1.00  Navbar fades in
 *
 *  Product rotates ±12° between panels for a breathing feel.
 */
import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const GOLD = '#C8963C';

/* ── Line-by-line split text helper ── */
function SplitText({ text, style }) {
  return (
    <span style={style}>
      {text.split('').map((ch, i) => (
        <span
          key={i}
          className={`hero-char char-${i}`}
          style={{ display: 'inline-block', whiteSpace: ch === ' ' ? 'pre' : undefined }}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

const SCENES = [
  {
    label: '01',
    tagline: '— Design',
    headline: ['Il Futuro', 'del Vaping.'],
    sub: null,
    cta: null,
  },
  {
    label: '02',
    tagline: '— Qualità',
    headline: ['Ogni Dettaglio.', 'Perfetto.'],
    sub: null,
    cta: null,
  },
  {
    label: '03',
    tagline: '— Collezione 2025',
    headline: ['Vaporesso', 'ECO One Pro.'],
    sub: 'Pod 2ml · 25W · USB-C · 1000mAh',
    cta: true,
  },
];

export default function Hero3D({ onShopClick }) {
  const wrapRef   = useRef(null);
  const stickyRef = useRef(null);
  const imgWrapRef = useRef(null);
  const glowRef   = useRef(null);
  const sceneRefs = useRef([]);   // one per scene

  useEffect(() => {
    const navbar = document.getElementById('main-navbar');
    if (navbar) {
      gsap.set(navbar, { opacity: 0, y: -14, pointerEvents: 'none' });
    }

    const ctx = gsap.context(() => {

      /* ── Initial state ── */
      gsap.set(imgWrapRef.current,  { scale: 0.5, filter: 'brightness(0) saturate(0)', rotationY: -15 });
      gsap.set(glowRef.current,     { scale: 0, opacity: 0 });
      sceneRefs.current.forEach(el => el && gsap.set(el, { opacity: 0, x: -60 }));

      /* ── ScrollTrigger timeline ── */
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrapRef.current,
          pin: stickyRef.current,
          start: 'top top',
          end: '+=500%',
          scrub: 2.2,
          anticipatePin: 1,
          onUpdate: ({ progress: p }) => {
            if (!navbar) return;
            const v = p >= 0.84 ? Math.min(1, (p - 0.84) / 0.10) : 0;
            gsap.set(navbar, { opacity: v, y: v === 0 ? -14 : 0, pointerEvents: v > 0 ? 'all' : 'none' });
          },
        },
      });

      /* Phase 0→0.18 — Product emerges */
      tl.to(imgWrapRef.current, {
        scale: 1,
        filter: 'brightness(1) saturate(1)',
        rotationY: 0,
        duration: 0.18,
        ease: 'power3.out',
      }, 0);
      tl.to(glowRef.current, {
        scale: 1, opacity: 1, duration: 0.18, ease: 'power2.out',
      }, 0);

      /* Phase 0.18→0.38 — Scene 1 slides in, product tilts right */
      tl.to(imgWrapRef.current, { rotationY: 10, duration: 0.10, ease: 'power2.inOut' }, 0.18);
      tl.to(sceneRefs.current[0], { opacity: 1, x: 0, duration: 0.09, ease: 'power3.out' }, 0.19);
      /* Scene 1 exits */
      tl.to(sceneRefs.current[0], { opacity: 0, x: -50, duration: 0.07, ease: 'power2.in' }, 0.36);

      /* Phase 0.38→0.58 — Scene 2, product tilts left */
      tl.to(imgWrapRef.current, { rotationY: -10, duration: 0.10, ease: 'power2.inOut' }, 0.39);
      tl.to(sceneRefs.current[1], { opacity: 1, x: 0, duration: 0.09, ease: 'power3.out' }, 0.40);
      tl.to(sceneRefs.current[1], { opacity: 0, x: -50, duration: 0.07, ease: 'power2.in' }, 0.57);

      /* Phase 0.58→0.84 — Scene 3 (CTA), product straightens + tiny zoom */
      tl.to(imgWrapRef.current, { rotationY: 0, scale: 1.04, duration: 0.12, ease: 'power2.inOut' }, 0.59);
      tl.to(sceneRefs.current[2], { opacity: 1, x: 0, duration: 0.10, ease: 'power3.out' }, 0.61);
      /* stays visible — no exit */
    }, wrapRef);

    return () => {
      ctx.revert();
      if (navbar) {
        gsap.set(navbar, { opacity: 1, y: 0, pointerEvents: 'all' });
      }
    };
  }, []);

  return (
    <div ref={wrapRef} style={{ height: '600vh', background: '#000', position: 'relative' }}>

      {/* ── Sticky fullscreen ── */}
      <div ref={stickyRef} style={{
        position: 'relative',
        height: '100vh',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>

        {/* Very subtle grain overlay */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', opacity: 0.025,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }} />

        {/* Soft vignette */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)',
        }} />

        {/* Ambient gold glow behind product */}
        <div ref={glowRef} style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: '50vw', height: '50vw',
          maxWidth: 680, maxHeight: 680,
          background: `radial-gradient(circle, ${GOLD}1a 0%, transparent 65%)`,
          filter: 'blur(48px)',
          zIndex: 3, pointerEvents: 'none',
          transformOrigin: 'center center',
        }} />

        {/* ── Product Image ── */}
        <div ref={imgWrapRef} style={{
          position: 'relative', zIndex: 10,
          width: 'min(520px, 46vw)',
          transformStyle: 'preserve-3d',
          perspective: '1000px',
        }}>
          {/* Ground shadow */}
          <div style={{
            position: 'absolute', bottom: -40, left: '15%', right: '15%',
            height: 60, borderRadius: '50%',
            background: `${GOLD}`,
            filter: 'blur(28px)', opacity: 0.12,
          }} />

          <img
            src="/img/hero_device.png"
            alt="Vaporesso ECO One Pro"
            style={{
              width: '100%',
              display: 'block',
              mixBlendMode: 'screen',
              filter: `
                drop-shadow(0 0 60px ${GOLD}55)
                drop-shadow(0 30px 80px rgba(0,0,0,0.8))
              `,
            }}
          />
        </div>

        {/* ── Scene Panels ── */}
        {SCENES.map((scene, i) => (
          <div
            key={i}
            ref={el => (sceneRefs.current[i] = el)}
            style={{
              position: 'absolute',
              left: '5.5vw',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 20,
              maxWidth: 500,
            }}
          >
            {/* Scene number + tagline */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              marginBottom: '1.6rem',
            }}>
              <span style={{
                fontSize: '0.62rem', fontWeight: 700, color: '#333',
                letterSpacing: '1px',
              }}>{scene.label}</span>
              <span style={{ width: 28, height: 1, background: GOLD }} />
              <span style={{
                fontSize: '0.62rem', fontWeight: 700, color: GOLD,
                letterSpacing: '2px', textTransform: 'uppercase',
              }}>{scene.tagline.replace('— ', '')}</span>
            </div>

            {/* Headlines */}
            {scene.headline.map((line, li) => (
              <div key={li} style={{
                fontSize: 'clamp(2.8rem, 6vw, 5.2rem)',
                fontWeight: 900,
                lineHeight: 1.0,
                letterSpacing: '-0.05em',
                color: li === 1 && i === 2 ? GOLD : '#fff',
                whiteSpace: 'nowrap',
              }}>
                {line}
              </div>
            ))}

            {/* Sub-line */}
            {scene.sub && (
              <p style={{
                marginTop: '1.2rem',
                fontSize: '0.85rem', fontWeight: 600,
                color: '#444', letterSpacing: '1px',
              }}>
                {scene.sub}
              </p>
            )}

            {/* Price + CTA */}
            {scene.cta && (
              <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#444', letterSpacing: '1px', textTransform: 'uppercase' }}>Prezzo</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: GOLD, lineHeight: 1, marginTop: 2 }}>€ 39<span style={{ fontSize: '1rem' }}>.90</span></div>
                </div>
                <button
                  onClick={onShopClick}
                  style={{
                    background: '#fff',
                    border: 'none', borderRadius: 100,
                    padding: '1rem 2.2rem',
                    fontWeight: 900, fontSize: '0.9rem',
                    cursor: 'pointer', fontFamily: 'inherit',
                    color: '#000',
                    transition: 'background 0.25s ease, color 0.25s ease',
                    letterSpacing: '-0.01em',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = GOLD; e.currentTarget.style.color = '#000'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#000'; }}
                >
                  Acquista →
                </button>
              </div>
            )}
          </div>
        ))}

        {/* ── Scene counter indicator — right side ── */}
        <div style={{
          position: 'absolute', right: '4vw', top: '50%', transform: 'translateY(-50%)',
          zIndex: 20, display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {SCENES.map((_, i) => (
            <div key={i} style={{
              width: 1, height: 32,
              background: 'rgba(255,255,255,0.08)',
            }} />
          ))}
        </div>

        {/* ── Scroll hint ── */}
        <div style={{
          position: 'absolute', bottom: 36, left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, textAlign: 'center',
          color: '#2a2a2a', fontSize: '0.65rem', fontWeight: 700,
          letterSpacing: '2px', textTransform: 'uppercase',
        }}>
          <div style={{
            width: 1, height: 44,
            background: 'linear-gradient(to bottom, transparent, #333)',
            margin: '0 auto 8px',
          }} />
          Scorri
        </div>

      </div>
    </div>
  );
}
