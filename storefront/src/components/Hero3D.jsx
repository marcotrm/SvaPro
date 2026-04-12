import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function Hero3D() {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const modelRef = useRef(null);

  useEffect(() => {
    // Basic Hero Text Entry Animation
    gsap.fromTo(textRef.current, 
      { y: 100, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 1.5, ease: "power4.out" }
    );

    // 3D Parallax Scroll Animation for the "Model"
    gsap.to(modelRef.current, {
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top top",
        end: "bottom top",
        scrub: 1,
      },
      y: 300,
      rotationX: 45,
      rotationY: 45,
      scale: 1.5,
      ease: "none"
    });

    // Text parallax
    gsap.to(textRef.current, {
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top top",
        end: "bottom top",
        scrub: 1,
      },
      y: -150,
      opacity: 0,
      ease: "none"
    });
  }, []);

  return (
    <section className="hero-section" ref={containerRef}>
      {/* Decorative Orbs */}
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>

      <div className="container flex-center">
        <div className="hero-content" ref={textRef}>
          <h1 className="title-xl">
            Il Futuro<br/>Dello Svapo.
          </h1>
          <p className="subtitle">Scopri le nostre collezioni esclusive con un'esperienza premium.</p>
          <button className="btn-primary">Esplora Ora</button>
        </div>
      </div>

      <div className="model-container" ref={modelRef}>
        {/* We use a radiant circle simulating a 3D glass/neon object for now */}
        <div className="model-placeholder"></div>
      </div>
    </section>
  );
}
