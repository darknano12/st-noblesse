import { bus } from '../../core/bus';
import { must } from '../../utils/dom';
import { scrollToTarget } from '../../utils/animation';

/**
 * Footer — bottom links, socials, boutique contact.
 *
 * DOM contract (static in HTML, lightly wired here):
 *   footer          — root
 *   .f-col a[data-fam]  — family filter shortcuts
 *   .f-col a[href^="#"] — in-page anchors
 *
 * Emits:  collections:family-click (when a family shortcut is clicked)
 */
export function initFooter(setFilter: (fam: string) => void): void {
  const footer = document.querySelector<HTMLElement>('footer');
  if (!footer) return;

  footer.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest<HTMLAnchorElement>('a');
    if (!link) return;

    const fam = link.dataset.fam;
    const href = link.getAttribute('href') ?? '';

    if (fam) {
      e.preventDefault();
      bus.emit('collections:family-click', { family: fam as never });
      setFilter(fam);
      scrollToTarget('#catalog');
      return;
    }

    if (href.startsWith('#') && href.length > 1) {
      e.preventDefault();
      scrollToTarget(href);
    }
  });
}

/** Marquee — duplicates content once so the CSS loop is seamless */
export function initMarquee(): void {
  const track = document.getElementById('mqTrack');
  if (!track) return;
  track.innerHTML += track.innerHTML;
}

/** Scroll-to helper for any remaining in-page anchors not covered above */
export function initAnchorLinks(): void {
  document.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href === '#') return;
    // Let other handlers opt out first
    if (link.hasAttribute('data-fam')) return;
    e.preventDefault();
    scrollToTarget(href);
  });
}
