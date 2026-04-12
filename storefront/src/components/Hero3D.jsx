import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const GOLD = '#C8963C';

const SCENES = [
  {
    label: '01',
    tagline: 'Engineering',
    headline: ['Ingegneria', 'Aerospaziale.'],
    sub: 'Materiali premium, tolleranze microscopiche.',
  },
  {
    label: '02',
    tagline: 'Anti-Gravity Flow',
    headline: ['Scomposto.', 'Ri-assemblato.'],
    sub: 'Vivi ogni singolo strato di pura tecnologia.',
  },
  {
    label: '03',
    tagline: 'Collezione 2025',
    headline: ['Vaporesso', 'ECO One Pro.'],
    sub: 'Disponibile ora in edizione limitata.',
    cta: true,
  },
];

export default function Hero3D({ onShopClick }) {
  const wrapRef = useRef(null);
  const stickyRef = useRef(null);
  const textRefs = useRef([]);
  
  // Immagini
  const imgFloatingRef = useRef(null);
  const imgExplodedRef = useRef(null);
  const ambientGlowRef = useRef(null);

  useEffect(() => {
    const navbar = document.getElementById('main-navbar');
    if (navbar) gsap.set(navbar, { opacity: 0, y: -16, pointerEvents: 'none' });

    const ctx = gsap.context(() => {

      // Setup initial positions
      gsap.set(imgFloatingRef.current, { scale: 1.1, opacity: 0, filter: 'blur(20px)', y: 40 });
      gsap.set(imgExplodedRef.current, { scale: 0.9, opacity: 0, filter: 'blur(10px)', y: -20 });
      gsap.set(ambientGlowRef.current, { opacity: 0, scale: 0.5 });
      textRefs.current.forEach((el) => gsap.set(el, { opacity: 0, x: -60, filter: 'blur(4px)' }));

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrapRef.current,
          pin: stickyRef.current,
          scrub: 1.2,
          start: 'top top',
          end: '+=450%',
          onUpdate: ({ progress: p }) => {
            if (navbar) {
              const v = p > 0.85 ? Math.min(1, (p - 0.85) / 0.1) : 0;
              gsap.set(navbar, { opacity: v, y: v === 0 ? -16 : 0, pointerEvents: v > 0 ? 'all' : 'none' });
            }
          }
        }
      });

      // === PHASE 0: Emerges from darkness (Floating Vape) ===
      tl.to(ambientGlowRef.current, { opacity: 0.8, scale: 1, duration: 0.2, ease: 'power2.out' }, 0);
      tl.to(imgFloatingRef.current, { 
        opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', duration: 0.25, ease: 'power3.out' 
      }, 0);

      // Scena 1 slide in
      tl.to(textRefs.current[0], { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.15, ease: 'power3.out' }, 0.15);

      // === PHASE 1: Transition to Exploded View ===
      // Scena 1 exits
      tl.to(textRefs.current[0], { opacity: 0, x: -40, filter: 'blur(4px)', duration: 0.1, ease: 'power3.in' }, 0.35);
      
      // Floating fades out, Exploded fades in, scaling up majestically
      tl.to(imgFloatingRef.current, { opacity: 0, scale: 1.15, filter: 'blur(15px)', duration: 0.2 }, 0.36);
      tl.to(imgExplodedRef.current, { opacity: 1, scale: 1.05, y: 0, filter: 'blur(0px)', duration: 0.2 }, 0.40);
      
      // Ambient glow shifts color
      tl.to(ambientGlowRef.current, { background: 'radial-gradient(circle at center, rgba(160, 200, 255, 0.15) 0%, transparent 70%)', duration: 0.2 }, 0.40);

      // Scena 2 slide in
      tl.to(textRefs.current[1], { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.15, ease: 'power3.out' }, 0.45);

      // === PHASE 2: CTA ===
      // Scena 2 exits
      tl.to(textRefs.current[1], { opacity: 0, x: -40, filter: 'blur(4px)', duration: 0.1, ease: 'power3.in' }, 0.65);
      
      // Exploded slightly focuses
      tl.to(imgExplodedRef.current, { scale: 1.0, y: -10, duration: 0.15, ease: 'power2.inOut' }, 0.70);

      // Scena 3 slide in
      tl.to(textRefs.current[2], { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.15, ease: 'power3.out' }, 0.75);

    }, wrapRef);

    return () => {
      ctx.revert();
      if (navbar) gsap.set(navbar, { opacity: 1, y: 0, pointerEvents: 'all' });
    };
  }, []);

  return (
    <div ref={wrapRef} style={{ position: 'relative', height: '550vh', background: '#000' }}>
      
      {/* Pinned Viewport */}
      <div ref={stickyRef} style={{
        position: 'relative', height: '100vh', background: '#000',
        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>

        {/* Ambient Glow */}
        <div ref={ambientGlowRef} style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '60vw', height: '60vw', maxWidth: 800, maxHeight: 800,
          background: `radial-gradient(circle at center, ${GOLD}22 0%, transparent 65%)`,
          filter: 'blur(50px)', pointerEvents: 'none', zIndex: 1
        }} />

        {/* --- Image 1: Floating Tech Vaporizer --- */}
        <div ref={imgFloatingRef} style={{
            position: 'absolute', inset: 0, zIndex: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <img 
            src="/img/hero_vape_2.png" 
            alt="Premium Vape Anti-Gravity"
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              mixBlendMode: 'screen' // Remuvo pure black bg
            }}
          />
        </div>

        {/* --- Image 2: Exploded Assembly View --- */}
        <div ref={imgExplodedRef} style={{
            position: 'absolute', inset: 0, zIndex: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <img 
            src="/img/hero_vape_1.png" 
            alt="Exploded Vape Architecture"
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              mixBlendMode: 'screen',
              filter: 'contrast(1.1) brightness(1.1)' 
            }}
          />
        </div>

        {/* Vignette Overlay to ensure text readability */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 8, pointerEvents: 'none',
          background: 'linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 30%, transparent 100%)'
        }} />

        {/* Scene Text Panels */}
        {SCENES.map((scene, i) => (
          <div
            key={i}
            ref={el => (textRefs.current[i] = el)}
            style={{
              position: 'absolute', left: '6vw', top: '50%',
              transform: 'translateY(-50%)', zIndex: 10,
              maxWidth: 480
            }}
          >
            {/* Tagline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.2rem' }}>
              <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#666', letterSpacing: '1px' }}>{scene.label}</span>
              <span style={{ width: 30, height: 1, background: GOLD }} />
              <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: GOLD, letterSpacing: '2px' }}>
                {scene.tagline}
              </span>
            </div>

            {/* Headlines */}
            {scene.headline.map((line, li) => (
              <div key={li} style={{
                fontSize: 'clamp(2.8rem, 5.5vw, 4.5rem)', fontWeight: 900,
                lineHeight: 1.05, letterSpacing: '-0.04em',
                color: '#fff', textShadow: '0 10px 40px rgba(0,0,0,0.5)'
              }}>
                {line}
              </div>
            ))}

            {/* Paragraph */}
            {scene.sub && (
               <p style={{ marginTop: '1.5rem', color: '#999', fontSize: '0.95rem', fontWeight: 500, lineHeight: 1.6, maxWidth: 350 }}>
               {scene.sub}
             </p>
            )}

            {/* CTA */}
            {scene.cta && (
              <div style={{ marginTop: '2.5rem', display: 'flex', alignItems: 'center', gap: '2rem' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800, textTransform: 'uppercase' }}>Prezzo Base</div>
                  <div style={{ fontSize: '2rem', color: GOLD, fontWeight: 900, lineHeight: 1, marginTop: 4 }}>
                    €39<span style={{ fontSize: '1rem' }}>.90</span>
                  </div>
                </div>
                <button
                  onClick={onShopClick}
                  style={{
                    background: '#fff', color: '#000',
                    border: 'none', borderRadius: 100,
                    padding: '1.2rem 2.5rem',
                    fontWeight: 900, fontSize: '0.9rem',
                    cursor: 'pointer', transition: 'transform 0.2s, background 0.2s',
                    boxShadow: '0 0 40px rgba(255,255,255,0.1)'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = GOLD; e.currentTarget.style.transform = 'scale(1.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  Acquista Ora
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Scroll Indicator */}
        <div style={{
          position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10
        }}>
          <div style={{ width: 1, height: 60, background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.4))' }} />
          <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '3px', color: 'rgba(255,255,255,0.6)' }}>SCROLL</span>
        </div>

      </div>
    </div>
  );
}
