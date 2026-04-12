import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Hero3D.jsx — 4K Animated Frame Sequence (Canvas Scrubber)
 * 
 * ENGINE PRONTO PER I FRAME LOCALI:
 * Quando avrai generato il video della Vape Pod con Google Labs Flow 
 * e avrai esportato le singole foto 4K, imposta LOCAL_FRAMES = true 
 * e mettile nella cartella /public/frames/.
 */
const IS_LOCAL_FRAMES = true; // Impostato a true per usare i tuoi 200 frames sfusi
const FRAME_COUNT = 200; // Numero esatto di frame caricati nella cartella

const getFramePath = (index) => {
  if (IS_LOCAL_FRAMES) {
    // La tua cartella quando li avrai generati
    return `/frames/frame_${index.toString().padStart(4, '0')}.jpg`;
  } else {
    // DEMO: Sequenza video 3D originale di riferimento 4K (AirPods Lightpass Tutorial style)
    // Usata come placeholder per farti vedere l'animazione reale funzionante!
    return `https://www.apple.com/105/media/us/airpods-pro/2019/1299e2f5_9206_4470_b28e_08307a42f19b/anim/sequence/large/01-hero-lightpass/${index.toString().padStart(4, '0')}.jpg`;
  }
};

const SCENES = [
  {
    label: '01',
    tagline: 'Animazione 3D 4K',
    headline: ['Il Futuro', 'del Vaping.'],
    sub: 'Scrubbing fotogramma per fotogramma a 60fps.',
  },
  {
    label: '02',
    tagline: 'Esploso Dinamico',
    headline: ['Scomposto.', 'Ri-assemblato.'],
    sub: 'Effetto Anti-Gravity puro sincronizzato allo scroll.',
  },
  {
    label: '03',
    tagline: 'Canvas Engine',
    headline: ['Vaporesso', 'ECO One Pro.'],
    sub: 'Pronto per i tuoi frames generati da AI.',
    cta: true,
  },
];

export default function Hero3D({ onShopClick }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const textRefs = useRef([]);
  const imagesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const seq = { frame: 0 };
    
    // Dimensione Canvas per copertura 4K
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';

    const render = () => {
      // Background nero puro
      context.fillStyle = '#000000';
      context.fillRect(0, 0, canvas.width, canvas.height);

      const img = imagesRef.current[Math.round(seq.frame)];
      if (img && img.complete) {
        // Disegno con Object-Fit: Cover custom
        const hRatio = canvas.width / img.width;
        const vRatio = canvas.height / img.height;
        const ratio = Math.max(hRatio, vRatio);
        const centerShift_x = (canvas.width - img.width * ratio) / 2;
        const centerShift_y = (canvas.height - img.height * ratio) / 2;
        
        // Disegna l'immagine video 4K scalata perfectly
        context.drawImage(img, 0, 0, img.width, img.height,
          centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);
      }
    };

    // Precaricamento massivo dei frame 4K per prestazioni top
    for (let i = 1; i <= FRAME_COUNT; i++) {
        const img = new Image();
        img.src = getFramePath(i);
        imagesRef.current.push(img);
        
        // Renderizza il primo frame appena ready
        if (i === 1) {
          img.onload = render;
        }
    }

    // GSAP ScrollTrigger per legare i fotogrammi allo scroll
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: wrapRef.current,
        pin: true,
        // pinSpacing: true (default) → riserva spazio scroll, i prodotti compaiono DOPO la hero
        scrub: 1.2,
        start: 'top top',
        end: '+=600%',
      }
    });

    // 1. Scrub del Video Frame-by-Frame
    tl.to(seq, {
      frame: FRAME_COUNT - 1,
      snap: 'frame',
      ease: 'none',
      onUpdate: () => render(),
      duration: 1, // Durata relativa gestita dalla Timeline
    }, 0);

    // 2. Transizioni dei Testi
    textRefs.current.forEach(el => gsap.set(el, { opacity: 0, y: 30 }));
    
    // Scena 1
    tl.to(textRefs.current[0], { opacity: 1, y: 0, duration: 0.08, ease: 'power2.out' }, 0.05);
    tl.to(textRefs.current[0], { opacity: 0, y: -30, duration: 0.06, ease: 'power2.in' }, 0.25);
    
    // Scena 2
    tl.to(textRefs.current[1], { opacity: 1, y: 0, duration: 0.08, ease: 'power2.out' }, 0.40);
    tl.to(textRefs.current[1], { opacity: 0, y: -30, duration: 0.06, ease: 'power2.in' }, 0.65);
    
    // Scena 3 (Rimane visibile)
    tl.to(textRefs.current[2], { opacity: 1, y: 0, duration: 0.08, ease: 'power2.out' }, 0.80);

    // Navbar Overlay Logic
    const navbar = document.getElementById('main-navbar');
    if (navbar) {
      gsap.set(navbar, { opacity: 0, y: -20, pointerEvents: 'none' });
      gsap.to(navbar, { 
        scrollTrigger: {
            trigger: wrapRef.current,
            start: 'bottom bottom',
            scrub: true,
            onUpdate: self => {
                const navVal = self.progress > 0.9 ? 1 : 0;
                gsap.set(navbar, { opacity: navVal, y: navVal === 1 ? 0 : -20, pointerEvents: navVal ? 'all' : 'none' });
            }
        }
      });
    }

    // Handle Window Resize ri-calcolo canvas
    const handleResize = () => {
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      render();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      tl.kill();
      window.removeEventListener('resize', handleResize);
      if (navbar) gsap.set(navbar, { opacity: 1, y: 0, pointerEvents: 'all' });
    };
  }, []);

  return (
    <div ref={wrapRef} style={{ position: 'relative', height: '100vh', background: '#000', overflow: 'hidden' }}>
      
      {/* Motore Frame-by-Frame Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute', inset: 0, zIndex: 1,
          width: '100%', height: '100%', objectFit: 'cover' // gestito pure in JS
        }}
      />

      {/* Ombra Overlay per Testi Leggibili */}
      <div style={{
          position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
          background: 'linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 20%, transparent 100%)'
      }} />

      {/* Testi Apple-Style */}
      {SCENES.map((scene, i) => (
        <div
            key={i}
            ref={el => (textRefs.current[i] = el)}
            style={{
                position: 'absolute', left: '6vw', top: '50%',
                transform: 'translateY(-50%)', zIndex: 10, maxWidth: 500
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.2rem' }}>
              <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#666', letterSpacing: '1px' }}>{scene.label}</span>
              <span style={{ width: 30, height: 1, background: '#C8963C' }} />
              <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: '#C8963C', letterSpacing: '2px' }}>
                {scene.tagline}
              </span>
            </div>

            {scene.headline.map((line, li) => (
              <div key={li} style={{
                  fontSize: 'clamp(3rem, 5.5vw, 4.8rem)', fontWeight: 900,
                  lineHeight: 1.05, letterSpacing: '-0.04em',
                  color: '#fff', textShadow: '0 10px 40px rgba(0,0,0,0.5)'
              }}>
                  {line}
              </div>
            ))}

            {scene.sub && (
               <p style={{ marginTop: '1.5rem', color: '#999', fontSize: '1rem', fontWeight: 500, lineHeight: 1.6, maxWidth: 350 }}>
               {scene.sub}
             </p>
            )}

            {scene.cta && (
              <div style={{ marginTop: '2.5rem', display: 'flex', alignItems: 'center', gap: '2rem' }}>
                  <div>
                      <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800, textTransform: 'uppercase' }}>Prezzo Base</div>
                      <div style={{ fontSize: '2rem', color: '#C8963C', fontWeight: 900, lineHeight: 1, marginTop: 4 }}>
                          €39<span style={{ fontSize: '1rem' }}>.90</span>
                      </div>
                  </div>
                  <button
                      onClick={onShopClick}
                      style={{
                          background: '#fff', color: '#000',
                          border: 'none', borderRadius: 100,
                          padding: '1.2rem 2.8rem',
                          fontWeight: 900, fontSize: '1rem',
                          cursor: 'pointer', transition: 'transform 0.2s, background 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#C8963C'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                      Acquista Ora
                  </button>
              </div>
            )}
        </div>
      ))}

      {/* Indicatore Scroll */}
      <div style={{
          position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10
      }}>
          <div style={{ width: 1, height: 60, background: 'linear-gradient(to bottom, transparent, rgba(200,150,60,0.5))' }} />
          <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '3px', color: '#C8963C' }}>SCROLL</span>
      </div>
    </div>
  );
}
