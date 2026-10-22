/**
 * Accessibility utilities — focus management, live regions, keyboard support.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** All focusable descendants of a container */
export function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

/**
 * Trap Tab key inside a container.
 * Returns a cleanup function that also restores focus.
 */
export function trapFocus(container: HTMLElement): () => void {
  function onKeyDown(e: KeyboardEvent): void {
    if (e.key !== 'Tab') return;
    const items = focusableWithin(container);
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  container.addEventListener('keydown', onKeyDown);
  return () => container.removeEventListener('keydown', onKeyDown);
}

/**
 * Open a modal surface: remember previous focus, move focus inside,
 * return a close function that restores focus.
 */
export function openFocusScope(container: HTMLElement): () => void {
  const previous = document.activeElement as HTMLElement | null;
  const releaseTrap = trapFocus(container);
  // Focus first focusable, or the container itself
  const items = focusableWithin(container);
  (items[0] ?? container).focus({ preventScroll: true });

  return () => {
    releaseTrap();
    previous?.focus({ preventScroll: true });
  };
}

/** Announce a message to screen readers via a shared polite live region */
export function announce(message: string): void {
  let region = document.getElementById('a11y-announcer');
  if (!region) {
    region = document.createElement('div');
    region.id = 'a11y-announcer';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    region.style.cssText =
      'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
    document.body.appendChild(region);
  }
  // Clear then set — ensures repeat messages are re-announced
  region.textContent = '';
  window.setTimeout(() => {
    region!.textContent = message;
  }, 50);
}

/** Check if the user prefers reduced motion */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Check for a fine pointer (mouse/trackpad vs touch) */
export function hasFinePointer(): boolean {
  return window.matchMedia('(pointer: fine)').matches;
}
