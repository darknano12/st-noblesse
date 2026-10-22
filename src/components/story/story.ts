import { must } from '../../utils/dom';
import { countUp } from '../../utils/animation';

/**
 * Story — "La Maison" section.
 *
 * DOM contract:
 *   #story           — root section
 *   #atelierImg      — perfumer's atelier photo
 *   .stats           — numerical indicators with data-target
 */
export function initStory(atelierImageSrc: string): void {
  const img = document.querySelector<HTMLImageElement>('#atelierImg');
  if (img && atelierImageSrc) {
    img.src = atelierImageSrc;
  }

  const storySection = document.querySelector<HTMLElement>('#story');
  if (!storySection) return;

  const statsContainer = storySection.querySelector<HTMLElement>('.stats');
  if (!statsContainer) return;

  // Run countUp animation when stats enter viewport
  let animated = false;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && !animated) {
          animated = true;
          countUp(statsContainer, 1600);
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.2 }
  );

  observer.observe(statsContainer);
}
