import { prefersReducedMotion } from './a11y';

/**
 * Animation helpers — reduced-motion aware.
 */

/**
 * Create an IntersectionObserver that adds a class once, then unobserves.
 * Ideal for scroll-reveal animations.
 */
export function revealOnScroll(
  selector: string,
  options: IntersectionObserverInit = { threshold: 0.15 },
  root: ParentNode = document
): IntersectionObserver {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('in');
      observer.unobserve(entry.target);
    }
  }, options);

  root.querySelectorAll(selector).forEach((el) => observer.observe(el));
  return observer;
}

/**
 * Count-up animation for stat elements with data-target.
 * Respects prefers-reduced-motion (jumps straight to final value).
 */
export function countUp(container: Element, durationMs = 1400): void {
  const targets = container.querySelectorAll<HTMLElement>('b[data-target]');
  const reduced = prefersReducedMotion();

  targets.forEach((el) => {
    const target = Number(el.dataset.target ?? '0');
    const suffix = el.dataset.suffix ?? '';

    if (reduced) {
      el.textContent = String(target) + suffix;
      return;
    }

    let start: number | null = null;
    function step(now: number): void {
      if (start === null) start = now;
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      el.textContent = String(Math.round(target * eased)) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

/**
 * Smooth scroll to a target, honouring reduced motion.
 */
export function scrollToTarget(
  target: string | HTMLElement,
  behavior: ScrollBehavior = 'smooth'
): void {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  el.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : behavior,
    block: 'start',
  });
}

/** Smooth-scroll back to page top */
export function scrollToTop(behavior: ScrollBehavior = 'smooth'): void {
  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotion() ? 'auto' : behavior,
  });
}

/** rAF-driven tween helper */
export function tween(
  from: number,
  to: number,
  durationMs: number,
  onUpdate: (value: number) => void,
  easing: (t: number) => number = (t) => 1 - Math.pow(1 - t, 3)
): () => void {
  let start: number | null = null;
  let raf = 0;

  function frame(now: number): void {
    if (start === null) start = now;
    const t = Math.min(1, (now - start) / durationMs);
    onUpdate(from + (to - from) * easing(t));
    if (t < 1) raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
