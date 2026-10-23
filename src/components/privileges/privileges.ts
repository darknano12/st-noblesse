import { bus } from '../../core/bus';
import { t } from '../../core/i18n';
import type { CartApi } from '../../core/cart-store';

/**
 * Initializes the Privileges & Exceptional Offers section.
 * Supports 1-click code copying and direct application to cart.
 */
export function initPrivileges(cart: CartApi): void {
  const container = document.getElementById('privileges');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const pill = target.closest<HTMLElement>('.priv-promo-pill');
    if (pill) {
      const code = pill.dataset.code || 'NOBLESSE15';
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code);
        }
      } catch {
        /* clipboard error fallback */
      }
      cart.applyPromo(code);
      bus.emit('toast:show', {
        html: `✦ <b>${code}</b> · ${t('toast.promo_copied', { code })}`,
        duration: 3500,
      });
    }
  });
}
