import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * HeroCanvas3D
 * ─────────────────────────────────────────────────────────────────────────────
 * A premium scroll-driven 3D assembly animation for a vape pod device.
 * Built with raw Three.js (no R3F) + GSAP ScrollTrigger scrub.
 *
 * Assembly sequence as the user scrolls:
 *   0%  → all parts scattered far from center in 3D space
 *   30% → body snaps into position (cylinder)
 *   55% → mouthpiece descends from top
 *   75% → button & panel appear from the side
 *   90% → logo text fades in on the device's face
 *  100% → camera slowly orbits to showcase the full device
 */
export default function HeroCanvas3D({ scrollRef }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const partsRef = useRef({});
  const lightsRef = useRef({});
  const progressRef = useRef({ value: 0 });
  const frameRef = useRef(null);
  const materialCache = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(W, H, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = null; // transparent — CSS handles bg
    sceneRef.current = scene;

    // ── Camera ────────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 80);
    camera.position.set(0, 0, 7);
    cameraRef.current = camera;

    // ── Materials ─────────────────────────────────────────────────────────────
    const matBody = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1a1a1a'),
      metalness: 0.85,
      roughness: 0.15,
    });
    const matMouth = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#111111'),
      metalness: 0.95,
      roughness: 0.1,
    });
    const matAccent = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#B58D3D'),
      metalness: 1,
      roughness: 0.05,
      emissive: new THREE.Color('#B58D3D'),
      emissiveIntensity: 0.2,
    });
    const matGlass = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#aaddff'),
      metalness: 0.1,
      roughness: 0,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const matScreen = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#0a1628'),
      metalness: 0.3,
      roughness: 0.6,
      emissive: new THREE.Color('#1a4080'),
      emissiveIntensity: 0.3,
    });
    materialCache.current = [matBody, matMouth, matAccent, matGlass, matScreen];

    // ── Geometry helpers ──────────────────────────────────────────────────────

    /** Rounded rectangle shape for body profile */
    function roundedBox(w, h, d, r, seg = 4) {
      // Use BoxGeometry with slight bevel via chamfer if needed,
      // or just a regular box for simplicity + material finish sells it.
      return new THREE.BoxGeometry(w, h, d, seg, seg, seg);
    }

    // ── Device Parts ──────────────────────────────────────────────────────────

    // 1. Body — main rectangular slab
    const bodyGeo = roundedBox(0.9, 3.2, 0.45);
    const body = new THREE.Mesh(bodyGeo, matBody);
    body.castShadow = true;
    body.position.set(0, 0, 0);

    // 2. Mouthpiece — tapered cylinder on top
    const mouthGeo = new THREE.CylinderGeometry(0.18, 0.28, 0.9, 32);
    const mouth = new THREE.Mesh(mouthGeo, matMouth);
    mouth.position.set(0, 2.0, 0);
    mouth.castShadow = true;

    // 3. Tip (very top of mouthpiece)
    const tipGeo = new THREE.CylinderGeometry(0.08, 0.18, 0.3, 32);
    const tip = new THREE.Mesh(tipGeo, matAccent);
    tip.position.set(0, 2.6, 0);

    // 4. Gold ring (accent band near mouthpiece)
    const ring1Geo = new THREE.TorusGeometry(0.32, 0.03, 16, 64);
    const ring1 = new THREE.Mesh(ring1Geo, matAccent);
    ring1.position.set(0, 1.55, 0);
    ring1.rotation.x = Math.PI / 2;

    // 5. Second gold ring (near bottom)
    const ring2 = ring1.clone();
    ring2.position.set(0, -1.45, 0);

    // 6. Fire button — small raised rectangle on side
    const btnGeo = new THREE.BoxGeometry(0.15, 0.4, 0.12);
    const btn = new THREE.Mesh(btnGeo, matAccent);
    btn.position.set(0.52, 0.3, 0);

    // 7. LED window (small glowing glass panel)
    const ledGeo = new THREE.BoxGeometry(0.5, 0.7, 0.05);
    const led = new THREE.Mesh(ledGeo, matScreen);
    led.position.set(0, -0.6, 0.24);

    // 8. Glass pod area (top of device, transparent)
    const podGeo = new THREE.BoxGeometry(0.7, 1.0, 0.3);
    const pod = new THREE.Mesh(podGeo, matGlass);
    pod.position.set(0, 0.8, 0);

    // 9. USB-C port at the bottom
    const portGeo = new THREE.BoxGeometry(0.22, 0.08, 0.1);
    const port = new THREE.Mesh(portGeo, matAccent);
    port.position.set(0, -1.7, 0.2);

    // 10. Subtle logo plane on front face
    const logoGeo = new THREE.PlaneGeometry(0.5, 0.15);
    const logoMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#B58D3D'),
      emissive: new THREE.Color('#B58D3D'),
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0,
    });
    const logo = new THREE.Mesh(logoGeo, logoMat);
    logo.position.set(0, -1.1, 0.23);
    materialCache.current.push(logoMat);

    // ── Group all parts ────────────────────────────────────────────────────────
    const device = new THREE.Group();
    device.add(body, pod, mouth, tip, ring1, ring2, btn, led, logo, port);
    scene.add(device);

    partsRef.current = { device, body, pod, mouth, tip, ring1, ring2, btn, led, logo, port, logoMat };

    // ── Store initial "scattered" positions for assembly anim ─────────────────
    const scatterY = 12, scatterX = 8;
    const scattered = {
      body:  { x: -scatterX, y: -scatterY, z: -4, rx: -1.2, ry: 0 },
      pod:   { x: scatterX,  y: scatterY,  z: 3,  rx: 0,    ry: 1.5 },
      mouth: { x: 0,         y: scatterY + 4, z: 0, rx: 0,  ry: 0 },
      tip:   { x: 0,         y: scatterY + 6, z: 0, rx: 0,  ry: 0 },
      ring1: { x: -scatterX, y: 0,         z: 2,  rx: 0,    ry: 0 },
      ring2: { x: scatterX,  y: 0,         z: 2,  rx: 0,    ry: 0 },
      btn:   { x: scatterX + 3, y: 0.3,   z: 0,  rx: 0,    ry: 0 },
      led:   { x: -scatterX - 3, y: -0.6, z: 0,  rx: 0,    ry: 0 },
      port:  { x: 0,         y: -scatterY - 4, z: 0, rx: 0, ry: 0 },
    };

    // Apply scattered positions initially
    body.position.set(scattered.body.x, scattered.body.y, scattered.body.z);
    body.rotation.set(scattered.body.rx, scattered.body.ry, 0);
    pod.position.set(scattered.pod.x, scattered.pod.y + 0.8, scattered.pod.z);
    mouth.position.set(scattered.mouth.x, scattered.mouth.y, 0);
    tip.position.set(scattered.tip.x, scattered.tip.y, 0);
    ring1.position.set(scattered.ring1.x, 1.55, scattered.ring1.z);
    ring2.position.set(scattered.ring2.x, -1.45, scattered.ring2.z);
    btn.position.set(scattered.btn.x, scattered.btn.y, 0);
    led.position.set(scattered.led.x, scattered.led.y, 0.24);
    port.position.set(0, scattered.port.y, 0.2);
    logo.position.set(0, -1.1, 0.23);
    logo.scale.set(0, 0, 0);

    // Hide logo initially
    logoMat.opacity = 0;

    // ── Lights ────────────────────────────────────────────────────────────────

    const ambientLight = new THREE.AmbientLight('#ffffff', 0.3);
    scene.add(ambientLight);

    // Key light — warm golden from upper right
    const keyLight = new THREE.DirectionalLight('#fff8e7', 3);
    keyLight.position.set(3, 6, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    // Rim light — cool blue from behind
    const rimLight = new THREE.DirectionalLight('#4488ff', 1.5);
    rimLight.position.set(-4, 2, -5);
    scene.add(rimLight);

    // Gold point light — floats near device for accent
    const goldLight = new THREE.PointLight('#B58D3D', 4, 6);
    goldLight.position.set(0, 0, 2.5);
    scene.add(goldLight);
    lightsRef.current.gold = goldLight;

    // Fill light from below
    const fillLight = new THREE.PointLight('#2244aa', 2, 8);
    fillLight.position.set(0, -4, 2);
    scene.add(fillLight);

    // ── GSAP ScrollTrigger Assembly ───────────────────────────────────────────
    const p = progressRef.current;

    const st = ScrollTrigger.create({
      trigger: scrollRef.current,
      start: 'top top',
      end: '+=300%',
      scrub: 1.5,
      pin: true,
      onUpdate: (self) => {
        const progress = self.progress;
        p.value = progress;
      },
    });

    // ── Render Loop ───────────────────────────────────────────────────────────
    function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
    function remap(v, inMin, inMax) { return Math.max(0, Math.min(1, (v - inMin) / (inMax - inMin))); }

    let time = 0;
    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      time += 0.012;

      const prog = p.value;

      // ── Phase 1 (0→0.3): body assembles to center ──────────────────────────
      const ph1 = easeInOut(remap(prog, 0, 0.3));
      body.position.x = THREE.MathUtils.lerp(scattered.body.x, 0, ph1);
      body.position.y = THREE.MathUtils.lerp(scattered.body.y, 0, ph1);
      body.position.z = THREE.MathUtils.lerp(scattered.body.z, 0, ph1);
      body.rotation.x = THREE.MathUtils.lerp(scattered.body.rx, 0, ph1);

      pod.position.x = THREE.MathUtils.lerp(scattered.pod.x, 0, ph1);
      pod.position.y = THREE.MathUtils.lerp(scattered.pod.y + 0.8, 0.8, ph1);
      pod.position.z = THREE.MathUtils.lerp(scattered.pod.z, 0, ph1);
      pod.rotation.y = THREE.MathUtils.lerp(scattered.pod.ry, 0, ph1);

      // ── Phase 2 (0.25→0.55): mouthpiece descends ───────────────────────────
      const ph2 = easeInOut(remap(prog, 0.25, 0.55));
      mouth.position.y = THREE.MathUtils.lerp(scattered.mouth.y, 2.0, ph2);
      tip.position.y   = THREE.MathUtils.lerp(scattered.tip.y, 2.6, ph2);

      // ── Phase 3 (0.45→0.7): rings snap from sides ──────────────────────────
      const ph3 = easeInOut(remap(prog, 0.45, 0.7));
      ring1.position.x = THREE.MathUtils.lerp(scattered.ring1.x, 0, ph3);
      ring1.position.z = THREE.MathUtils.lerp(scattered.ring1.z, 0, ph3);
      ring2.position.x = THREE.MathUtils.lerp(scattered.ring2.x, 0, ph3);
      ring2.position.z = THREE.MathUtils.lerp(scattered.ring2.z, 0, ph3);

      // ── Phase 4 (0.6→0.82): button + LED click into place ──────────────────
      const ph4 = easeInOut(remap(prog, 0.6, 0.82));
      btn.position.x = THREE.MathUtils.lerp(scattered.btn.x, 0.52, ph4);
      led.position.x = THREE.MathUtils.lerp(scattered.led.x, 0,    ph4);

      // ── Phase 5 (0.75→0.9): USB port slides in from below ──────────────────
      const ph5 = easeInOut(remap(prog, 0.75, 0.9));
      port.position.y = THREE.MathUtils.lerp(scattered.port.y, -1.7, ph5);

      // ── Phase 6 (0.87→1): logo reveal ──────────────────────────────────────
      const ph6 = remap(prog, 0.87, 1.0);
      logoMat.opacity = ph6;
      logo.scale.setScalar(ph6);

      // ── Continuous gentle device rotation (slows as assembled) ─────────────
      const assembled = easeInOut(remap(prog, 0.7, 1.0));
      device.rotation.y = Math.sin(time * 0.4) * 0.18 * assembled + (1 - assembled) * time * 0.15;
      device.rotation.x = Math.sin(time * 0.25) * 0.06 * assembled;

      // ── Gold light pulse ────────────────────────────────────────────────────
      lightsRef.current.gold.intensity = 3 + Math.sin(time * 1.5) * 1.2;
      lightsRef.current.gold.position.x = Math.sin(time * 0.8) * 1.5;

      // ── Camera zoom in as assembly completes ────────────────────────────────
      camera.position.z = THREE.MathUtils.lerp(7, 5.2, easeInOut(remap(prog, 0.8, 1.0)));

      renderer.render(scene, camera);
    }
    animate();

    // ── Resize handler ────────────────────────────────────────────────────────
    function onResize() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      st.kill();
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      materialCache.current.forEach(m => m.dispose());
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
}
