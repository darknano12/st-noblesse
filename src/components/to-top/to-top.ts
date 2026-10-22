import { bus } from '../../core/bus';
import { must } from '../../utils/dom';
import { scrollToTop } from '../../utils/animation';

/**
 * ToTop — floating "back to top" button.
 *
 * DOM contract:
 *   #toTop       — button (toggles .show, driven by header scroll handler)
 */
export function initToTop(): void {
  const toTop = must('#toTop');
  toTop.addEventListener('click', () => {
    scrollToTop();
    bus.emit('scroll:top-click', undefined);
  });
}
