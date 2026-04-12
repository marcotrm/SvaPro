/**
 * Hero3D.jsx — "Google Anti-Gravity" Canvas Image Sequence Scrubber
 * ──────────────────────────────────────────────────────────────────
 * Implementazione ESATTA del tutorial Apple-Style 3D (GSAP + Canvas).
 *
 * ISTRUZIONI PER I FRAME REALI:
 * 1. Vai su Google Labs (VideoFX), Luma o Kling AI.
 * 2. Genera un video di 3 secondi del prodotto che si monta ("exploded view").
 * 3. Usa un tool per estrarre il video in frame (es. 90 immagini).
 * 4. Salvali in `storefront/public/frames/` nominandoli `frame_0001.webp`, `frame_0002.webp`, ecc.
 * 5. Imposta `USE_REAL_SEQUENCE = true` qui sotto.
 */
import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Cambia in TRUE quando hai inserito le immagini estratte nella cartella public/frames!
const USE_REAL_SEQUENCE = false;
const FRAME_COUNT = 90; 
const FRAME_FORMAT = (i) => `/frames/frame_${String(i).padStart(4, '0')}.webp`;

const GOLD = '#C8963C';

const SCENES = [
  {
    label: '01',
    tagline: 'Google Anti-Gravity',
    headline: ['Il Futuro', 'del Vaping.'],
    sub: null,
    cta: null,
  },
  {
    label: '02',
    tagline: 'Assemblaggio',
    headline: ['Ogni Dettaglio.', 'Perfetto.'],
    sub: null,
    cta: null,
  },
  {
    label: '03',
    tagline: 'Collezione 2025',
    headline: ['Vaporesso', 'ECO One Pro'],
    sub: 'Pod 2ml · 25W · USB-C',
    cta: true,
  },
];

export default function Hero3D({ onShopClick }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const textRefs = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Auto-resize canvas
    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);

    // Hide navbar logic
    const navbar = document.getElementById('main-navbar');
    if (navbar) gsap.set(navbar, { opacity: 0, y: -14, pointerEvents: 'none' });

    // GSAP Context
    const gsCtx = gsap.context(() => {
      const seq = { frame: 0 };
      const images = [];
      const singleImageFallback = new Image();

      // Drow function per coprire il canvas (tipo object-fit: cover)
      const renderRealFrame = (index) => {
        if (!images[index] || !images[index].complete) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const img = images[index];
        const hRatio = canvas.width / img.width;
        const vRatio = canvas.height / img.height;
        const ratio = Math.max(hRatio, vRatio);
        const centerShift_x = (canvas.width - img.width * ratio) / 2;
        const centerShift_y = (canvas.height - img.height * ratio) / 2;
        ctx.drawImage(img, 0, 0, img.width, img.height,
          centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);
      };

      // Simulazione 3D mozzafiato per riempire il vuoto finché non metti i veri frame
      const renderFallback = (progress) => {
        if (!singleImageFallback.complete) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();

        // Background puro nero
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Effetto "Anti-Gravity": rotazione + scala + blur basati sul progresso
        const scale = 2.5 - (progress * 1.5);
        const rotation = (1 - progress) * (Math.PI / 2); // da 90° a 0°
        const yOffset = (1 - progress) * -300;
        
        ctx.translate(canvas.width / 2, (canvas.height / 2) + yOffset);
        ctx.rotate(rotation);
        ctx.scale(scale, scale);

        // Simulazione glow
        ctx.shadowColor = GOLD;
        ctx.shadowBlur = 80 - (progress * 40);
        ctx.globalCompositeOperation = 'screen';

        const w = Math.min(canvas.width * 0.4, 500);
        const ratio = singleImageFallback.height / singleImageFallback.width;
        const h = w * ratio;

        // Contrasto aggiuntivo per eliminare aloni scuri
        ctx.filter = `brightness(${1 + progress * 0.4}) contrast(1.4)`;
        ctx.drawImage(singleImageFallback, -w / 2, -h / 2, w, h);

        ctx.restore();
      };

      const render = () => {
        if (USE_REAL_SEQUENCE) {
          renderRealFrame(Math.round(seq.frame));
        } else {
          renderFallback(seq.frame / (FRAME_COUNT - 1));
        }
      };

      if (USE_REAL_SEQUENCE) {
        for (let i = 1; i <= FRAME_COUNT; i++) {
          const img = new Image();
          img.src = FRAME_FORMAT(i);
          images.push(img);
        }
        images[0].onload = render;
      } else {
        singleImageFallback.src = '/img/hero_device.png';
        singleImageFallback.onload = () => renderFallback(0);
      }

      /* ── TIMELINE SCRUB ── */
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrapRef.current,
          pin: true,
          scrub: 1.2,
          start: 'top top',
          end: '+=500%', // Lunghezza scroll
          onUpdate: ({ progress: p }) => {
            // Navbar fader
            if (navbar) {
              const v = p > 0.85 ? Math.min(1, (p - 0.85) / 0.1) : 0;
              gsap.set(navbar, { opacity: v, y: v === 0 ? -14 : 0, pointerEvents: v > 0 ? 'all' : 'none' });
            }
          }
        }
      });

      // Animazione dei Frame(0 -> 89) lungo tutto lo scroll
      tl.to(seq, {
        frame: FRAME_COUNT - 1,
        snap: "frame",
        ease: "none",
        onUpdate: render,
        duration: 1, // Durata base mappata sulla timeline
      }, 0);

      /* ── ANIMAZIONE TESTI SOPRA AL CANVAS (Timeline relativa) ── */
      textRefs.current.forEach((el) => gsap.set(el, { opacity: 0, y: 40 }));

      // Scena 1
      tl.to(textRefs.current[0], { opacity: 1, y: 0, duration: 0.08, ease: 'power2.out' }, 0.1);
      tl.to(textRefs.current[0], { opacity: 0, y: -40, duration: 0.05, ease: 'power2.in' }, 0.3);

      // Scena 2
      tl.to(textRefs.current[1], { opacity: 1, y: 0, duration: 0.08, ease: 'power2.out' }, 0.4);
      tl.to(textRefs.current[1], { opacity: 0, y: -40, duration: 0.05, ease: 'power2.in' }, 0.6);

      // Scena 3
      tl.to(textRefs.current[2], { opacity: 1, y: 0, duration: 0.08, ease: 'power2.out' }, 0.7);
      // Non usciamo la scena 3, resta visibile per il tasto acquista!

    }, wrapRef);

    return () => {
      gsCtx.revert();
      window.removeEventListener('resize', setCanvasSize);
      if (navbar) gsap.set(navbar, { opacity: 1, y: 0, pointerEvents: 'all' });
    };
  }, []);

  return (
    <div ref={wrapRef} style={{ position: 'relative', height: '100vh', background: '#000', overflow: 'hidden' }}>
      
      {/* BACKGROUND CANVAS FRAME SCRUBBER */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100vw', height: '100vh',
          zIndex: 1,
        }}
      />

      {/* OVERLAY EFFETTI LUMINOSI */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
        background: 'radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.8) 100%)'
      }} />

      {/* PANNELLI TESTO (Stile Apple / Minimalist Overlay) */}
      {SCENES.map((scene, i) => (
        <div
          key={i}
          ref={el => (textRefs.current[i] = el)}
          style={{
            position: 'absolute',
            left: '6vw',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10,
            maxWidth: 450,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#444' }}>{scene.label}</span>
            <span style={{ width: 24, height: 1, background: GOLD }} />
            <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: GOLD }}>{scene.tagline}</span>
          </div>

          {scene.headline.map((line, li) => (
            <div key={li} style={{
              fontSize: 'clamp(3rem, 6vw, 5.5rem)',
              fontWeight: 900, lineHeight: 1.05,
              letterSpacing: '-0.04em',
              color: '#fff',
            }}>
              {line}
            </div>
          ))}

          {scene.sub && (
             <p style={{ marginTop: '1.5rem', color: '#888', fontSize: '0.9rem', fontWeight: 600 }}>
             {scene.sub}
           </p>
          )}

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
                  cursor: 'pointer', transition: 'transform 0.2s, background 0.2s'
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

      {/* MOUSE SCROLL INDICATOR */}
      <div style={{
        position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10
      }}>
        <div style={{ width: 1, height: 60, background: 'linear-gradient(to bottom, transparent, #FFFFFF44)' }} />
        <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '2px', color: '#FFFFFF66' }}>SCROLL</span>
      </div>

    </div>
  );
}
