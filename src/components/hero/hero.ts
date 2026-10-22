import type { ImageMap } from '../../core/types';
import type { UiApi } from '../../core/ui-store';
import { must } from '../../utils/dom';

/**
 * Hero — full-height opening section.
 *
 * DOM contract:
 *   #hero          — root
 *   #heroImg       — hero image (src injected)
 *   .hero-media    — parallax target
 *   .hero-cta a    — CTA buttons (handled by nav)
 *
 * Side effects: injects hero image, wires parallax (requires Cursor).
 */
export function initHero(images: ImageMap, ui: UiApi): void {
  const heroImg = must<HTMLImageElement>('#heroImg');
  const media = document.querySelector<HTMLElement>('.hero-media');

  // Inject hero image
  heroImg.src = images.hero;

  // Parallax — driven by cursor position (see cursor.ts)
  if (!media) return;

  bus_heroParallax(media, ui);
}

function bus_heroParallax(media: HTMLElement, ui: UiApi): void {
  if (!ui.store.value.finePointer || ui.store.value.reducedMotion) return;

  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let raf = 0;

  function update(): void {
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;
    media.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)`;
    raf = requestAnimationFrame(update);
  }

  function onMove(e: MouseEvent): void {
    const dx = e.clientX / window.innerWidth - 0.5;
    const dy = e.clientY / window.innerHeight - 0.5;
    targetX = dx * -16;
    targetY = dy * -10;
  }

  document.addEventListener('mousemove', onMove, { passive: true });
  raf = requestAnimationFrame(update);

  // Cleanup hook (pagehide for SPA navigation)
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(raf);
    document.removeEventListener('mousemove', onMove);
  });
}
