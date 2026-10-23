import { scrollToTarget } from '../../utils/animation';

/**
 * Initializes the Privileges & Seasonal Pre-Launch section.
 */
export function initPrivileges(_cart?: any): void {
  const container = document.getElementById('privileges');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const cta = target.closest<HTMLAnchorElement>('a[href="#catalog"]');
    if (cta) {
      e.preventDefault();
      scrollToTarget('#catalog');
    }
  });
}
