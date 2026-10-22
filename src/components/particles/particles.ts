import type { AppConfig } from '../../core/types';
import type { UiApi } from '../../core/ui-store';

/**
 * Particles — floating golden dust on a full-screen canvas.
 *
 * DOM contract:
 *   #dust        — fixed full-viewport canvas (z-index 2, pointer-events none)
 *
 * Disabled when reduced-motion.
 */
export function initParticles(config: AppConfig, ui: UiApi): void {
  if (ui.store.value.reducedMotion) return;

  const canvas = document.getElementById('dust') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let W = 0;
  let H = 0;
  let raf = 0;

  function resize(): void {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* ---- particle pool ---- */
  interface Particle {
    x: number;
    y: number;
    r: number;
    vx: number;
    vy: number;
    a: number;
    va: number;
    al: number;
  }

  const count =
    window.innerWidth < config.particleMobileBreakpoint
      ? config.particleCount.mobile
      : config.particleCount.desktop;

  const particles: Particle[] = Array.from({ length: count }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: 0.5 + Math.random() * 1.5,
    vy: -(0.06 + Math.random() * 0.32),
    vx: (Math.random() - 0.5) * 0.12,
    a: Math.random() * Math.PI * 2,
    va: 0.008 + Math.random() * 0.02,
    al: 0.18 + Math.random() * 0.45,
  }));

  /* ---- loop ---- */
  function loop(): void {
    ctx!.clearRect(0, 0, W, H);
    for (const p of particles) {
      p.a += p.va;
      p.y += p.vy;
      p.x += p.vx + Math.sin(p.a) * 0.1;
      if (p.y < -8) {
        p.y = H + 8;
        p.x = Math.random() * W;
      }
      if (p.x < -8) p.x = W + 8;
      if (p.x > W + 8) p.x = -8;

      const alpha = p.al * (0.5 + 0.5 * Math.sin(p.a * 1.7));
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx!.fillStyle = `rgba(222,186,120,${alpha.toFixed(3)})`;
      ctx!.fill();
    }
    raf = requestAnimationFrame(loop);
  }

  raf = requestAnimationFrame(loop);

  /* ---- pause when tab hidden (battery saving) ---- */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(loop);
    }
  });

  window.addEventListener('pagehide', () => cancelAnimationFrame(raf));
}
