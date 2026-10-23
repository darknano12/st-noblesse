import { bus } from '../../core/bus';
import type { Review } from '../../core/types';
import { must } from '../../utils/dom';

let currentReviews: Review[] = [];
let currentIndex = 0;
let autoTimer: number | null = null;
let isInitialized = false;
let configuredInterval = 6500;

function escapeHtml(s: string): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clearAutoTimer(): void {
  if (autoTimer !== null) {
    window.clearInterval(autoTimer);
    autoTimer = null;
  }
}

function startAutoTimer(): void {
  clearAutoTimer();
  if (typeof window === 'undefined') return;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (reduced || currentReviews.length <= 1) return;
  autoTimer = window.setInterval(() => goToSlide(currentIndex + 1), configuredInterval);
}

function goToSlide(i: number): void {
  const slidesRoot = document.querySelector<HTMLElement>('#revSlides');
  const dotsRoot = document.querySelector<HTMLElement>('#revDots');
  if (!slidesRoot || !dotsRoot || currentReviews.length === 0) return;

  const len = currentReviews.length;
  currentIndex = ((i % len) + len) % len;

  const slides = Array.from(slidesRoot.querySelectorAll('.rev-slide'));
  const dots = Array.from(dotsRoot.querySelectorAll('button'));

  slides.forEach((s, j) => s.classList.toggle('active', j === currentIndex));
  dots.forEach((d, j) => d.classList.toggle('active', j === currentIndex));

  if (currentReviews[currentIndex]) {
    bus.emit('reviews:slide-change', { index: currentIndex, review: currentReviews[currentIndex] });
  }
  startAutoTimer();
}

/**
 * Render or re-render slides & dots safely
 */
export function updateReviews(reviews: Review[]): void {
  currentReviews = Array.isArray(reviews) ? [...reviews] : [];

  const slidesRoot = document.querySelector<HTMLElement>('#revSlides');
  const dotsRoot = document.querySelector<HTMLElement>('#revDots');
  if (!slidesRoot || !dotsRoot) return;

  clearAutoTimer();

  if (currentReviews.length === 0) {
    slidesRoot.innerHTML = `
      <div class="rev-slide active" style="opacity: 1; transform: none; pointer-events: auto;">
        <div class="rev-stars">★★★★★</div>
        <p class="rev-text">"La Haute Parfumerie is an art of patience and quiet distinction."</p>
        <div class="rev-who"><b>st.noblesse</b><span>Atelier Privé</span></div>
      </div>
    `;
    dotsRoot.innerHTML = '';
    return;
  }

  slidesRoot.innerHTML = currentReviews
    .map((r) => {
      const starsCount = Math.max(1, Math.min(5, Number(r.s) || 5));
      return (
        `<div class="rev-slide">` +
        `<div class="rev-stars">${'★'.repeat(starsCount)}${'☆'.repeat(5 - starsCount)}</div>` +
        `<p class="rev-text">${escapeHtml(r.t)}</p>` +
        `<div class="rev-who"><b>${escapeHtml(r.n)}</b><span>${escapeHtml(r.c)}</span></div>` +
        `</div>`
      );
    })
    .join('');

  dotsRoot.innerHTML = currentReviews
    .map((_, i) => `<button data-i="${i}" aria-label="Review ${i + 1}"></button>`)
    .join('');

  goToSlide(0);
}

export function getLiveReviews(): Review[] {
  return [...currentReviews];
}

/**
 * Initialize Reviews Carousel (run once on bootstrap)
 */
export function initReviews(reviews: Review[], intervalMs = 6500): void {
  configuredInterval = intervalMs;
  updateReviews(reviews);

  if (isInitialized) return;
  isInitialized = true;

  const prevBtn = document.querySelector<HTMLElement>('#revPrev');
  const nextBtn = document.querySelector<HTMLElement>('#revNext');
  const dotsRoot = document.querySelector<HTMLElement>('#revDots');
  const box = document.querySelector<HTMLElement>('#revBox');

  if (nextBtn) {
    nextBtn.addEventListener('click', () => goToSlide(currentIndex + 1));
  }
  if (prevBtn) {
    prevBtn.addEventListener('click', () => goToSlide(currentIndex - 1));
  }

  if (dotsRoot) {
    dotsRoot.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!btn || btn.dataset.i === undefined) return;
      goToSlide(Number(btn.dataset.i));
    });
  }

  if (box) {
    box.addEventListener('mouseenter', clearAutoTimer);
    box.addEventListener('mouseleave', startAutoTimer);
    box.setAttribute('tabindex', '0');
    box.setAttribute('role', 'region');
    box.setAttribute('aria-roledescription', 'carousel');
    box.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') goToSlide(currentIndex + 1);
      if (e.key === 'ArrowLeft') goToSlide(currentIndex - 1);
    });
  }

  // Listen for real-time review updates across the application
  bus.on('reviews:update', ({ reviews }: { reviews: Review[] }) => {
    updateReviews(reviews);
  });
}
