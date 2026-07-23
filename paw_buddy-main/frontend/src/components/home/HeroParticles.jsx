import React, { useRef, useEffect } from 'react';

/* Subtle kibble particle field that sits BEHIND the hero paw graphic.
   The cursor acts as a soft repulsor with a warm orange glow; particles
   drift gently and spring back to their anchor points. Deliberately low
   contrast so it reads as ambient texture, never a distraction. */

// Drop a transparent PNG of a dog-food kibble here to use real sprites.
// Leave empty to use the built-in canvas-drawn kibble.
const KIBBLE_IMG_URL = '';

// ---- Physics knobs (tweak freely) ----
const REPULSION_RADIUS = 130;   // px around the cursor that pushes kibble away
const REPULSION_FORCE = 0.9;    // how hard the cursor shoves particles
const RETURN_SPEED = 0.012;     // spring strength pulling kibble home (higher = snappier)
const FRICTION = 0.86;          // velocity damping (lower = more sluggish/elastic)

const HeroParticles = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const parent = canvas.parentElement;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0, height = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let particles = [];
    let raf = 0;
    const mouse = { x: -9999, y: -9999, active: false };

    let sprite = null;
    if (KIBBLE_IMG_URL) {
      sprite = new Image();
      sprite.src = KIBBLE_IMG_URL;
    }

    const WARM = ['rgba(230,106,26,', 'rgba(208,92,25,', 'rgba(178,120,74,', 'rgba(196,85,17,'];

    const build = () => {
      const rect = parent.getBoundingClientRect();
      width = rect.width; height = rect.height;
      canvas.width = width * dpr; canvas.height = height * dpr;
      canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Density scales with area but stays sparse; fewer on small screens.
      const target = Math.round(Math.min(width * height / 14000, width < 640 ? 26 : 54));
      particles = Array.from({ length: target }, () => {
        const hx = Math.random() * width;
        const hy = Math.random() * height;
        return {
          hx, hy, x: hx, y: hy, vx: 0, vy: 0,
          r: 3 + Math.random() * 4,
          rot: Math.random() * Math.PI,
          color: WARM[(Math.random() * WARM.length) | 0],
          alpha: 0.10 + Math.random() * 0.16,
          phase: Math.random() * Math.PI * 2,
          drift: 0.4 + Math.random() * 0.7,
        };
      });
    };

    const drawKibble = (p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (sprite && sprite.complete && sprite.naturalWidth) {
        ctx.globalAlpha = Math.min(p.alpha * 3, 0.55);
        ctx.drawImage(sprite, -p.r * 1.6, -p.r * 1.6, p.r * 3.2, p.r * 3.2);
      } else {
        ctx.fillStyle = p.color + p.alpha + ')';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r * 1.25, p.r * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const render = (t) => {
      ctx.clearRect(0, 0, width, height);

      // Warm glow following the cursor (flashlight feel).
      if (mouse.active && !reduced) {
        const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, REPULSION_RADIUS * 1.4);
        g.addColorStop(0, 'rgba(230,106,26,0.16)');
        g.addColorStop(1, 'rgba(230,106,26,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
      }

      for (const p of particles) {
        // gentle idle drift around the anchor
        const bob = Math.sin(t * 0.0005 + p.phase) * p.drift;

        // cursor repulsion
        if (mouse.active) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < REPULSION_RADIUS && dist > 0.01) {
            const f = (1 - dist / REPULSION_RADIUS) * REPULSION_FORCE;
            p.vx += (dx / dist) * f;
            p.vy += (dy / dist) * f;
          }
        }

        // spring home + friction
        p.vx += (p.hx - p.x) * RETURN_SPEED;
        p.vy += (p.hy + bob - p.y) * RETURN_SPEED;
        p.vx *= FRICTION;
        p.vy *= FRICTION;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += 0.002;

        drawKibble(p);
      }

      raf = requestAnimationFrame(render);
    };

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };
    const onLeave = () => { mouse.active = false; mouse.x = -9999; mouse.y = -9999; };

    build();

    if (reduced) {
      // Static, no animation, no cursor tracking.
      ctx.clearRect(0, 0, width, height);
      particles.forEach(drawKibble);
    } else {
      raf = requestAnimationFrame(render);
      window.addEventListener('mousemove', onMove, { passive: true });
      window.addEventListener('mouseout', onLeave, { passive: true });
    }

    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); build(); if (!reduced) raf = requestAnimationFrame(render); else particles.forEach(drawKibble); });
    ro.observe(parent);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseout', onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
};

export default HeroParticles;
