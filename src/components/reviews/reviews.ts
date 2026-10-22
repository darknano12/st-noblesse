import { bus } from '../../core/bus';
import type { Review } from '../../core/types';
import { must, qs } from '../../utils/dom';

/**
 * ReviewsCarousel — auto-rotating testimonial slider.
 *
 * DOM contract:
 *   #revSlides   — slide container (rendered)
 *   #revDots     — dot buttons (rendered)
 *   #revPrev     — previous button
 *   #revNext     — next button
 *
 * Emits:  reviews:slide-change
 */
export function initReviews(reviews: Review[], intervalMs = 6500): void {
  const slidesRoot = must('#revSlides');
  const dotsRoot = must('#revDots');
  const prevBtn = must('#revPrev');
  const nextBtn = must('#revNext');

  let index = 0;
  let timer: number | null = null;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- render slides + dots ---- */
  slidesRoot.innerHTML = reviews
    .map(
      (r) =>
        `<div class="rev-slide">` +
        `<div class="rev-stars">${'★'.repeat(r.s)}</div>` +
        `<p class="rev-text">${escapeHtml(r.t)}</p>` +
        `<div class="rev-who"><b>${escapeHtml(r.n)}</b><span>${escapeHtml(r.c)}</span></div>` +
        `</div>`
    )
    .join('');

  dotsRoot.innerHTML = reviews
    .map(
      (_, i) =>
        `<button data-i="${i}" aria-label="Review ${i + 1}"></button>`
    )
    .join('');

  const slides = Array.from(slidesRoot.querySelectorAll('.rev-slide'));
  const dots = Array.from(dotsRoot.querySelectorAll('button'));

  /* ---- navigation ---- */
  function go(i: number): void {
    index = ((i % reviews.length) + reviews.length) % reviews.length;
    slides.forEach((s, j) => s.classList.toggle('active', j === index));
    dots.forEach((d, j) => d.classList.toggle('active', j === index));
    bus.emit('reviews:slide-change', { index, review: reviews[index]! });
    restartTimer();
  }

  function restartTimer(): void {
    if (timer !== null) window.clearInterval(timer);
    if (reduced) return;
    timer = window.setInterval(() => go(index + 1), intervalMs);
  }

  /* ---- controls ---- */
  nextBtn.addEventListener('click', () => go(index + 1));
  prevBtn.addEventListener('click', () => go(index - 1));
  dotsRoot.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!btn) return;
    go(Number(btn.dataset.i));
  });

  /* ---- pause on hover ---- */
  const box = must('#revBox');
  box.addEventListener('mouseenter', () => {
    if (timer !== null) window.clearInterval(timer);
  });
  box.addEventListener('mouseleave', restartTimer);

  /* ---- keyboard ---- */
  box.setAttribute('tabindex', '0');
  box.setAttribute('role', 'region');
  box.setAttribute('aria-roledescription', 'carousel');
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(index + 1);
    if (e.key === 'ArrowLeft') go(index - 1);
  });

  /* ---- start ---- */
  go(0);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
