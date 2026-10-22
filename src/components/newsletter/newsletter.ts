import { bus } from '../../core/bus';
import { must } from '../../utils/dom';
import { t } from '../../core/i18n';
import { pb } from '../../services/pocketbase';

/**
 * Newsletter — email capture form with validation + success state.
 *
 * DOM contract:
 *   #nl          — container (toggles .done)
 *   #nlForm      — form element
 *   #nlEmail     — email input (gets .err on invalid)
 *
 * Emits:  newsletter:submitted, newsletter:success, newsletter:error
 */
export function initNewsletter(): void {
  const nl = must('#nl');
  const form = must<HTMLFormElement>('#nlForm');
  const emailInput = must<HTMLInputElement>('#nlEmail');

  const EMAIL_RE = /^\S+@\S+\.\S+$/;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();

    if (!EMAIL_RE.test(email)) {
      emailInput.classList.remove('err');
      void emailInput.offsetWidth; // reflow to restart shake
      emailInput.classList.add('err');
      bus.emit('newsletter:error', { message: t('newsletter.error_email') });
      return;
    }

    pb.subscribeNewsletter(email).catch(() => {});
    bus.emit('newsletter:submitted', { email });
    nl.classList.add('done');
    bus.emit('newsletter:success', undefined);
    bus.emit('toast:show', { html: t('newsletter.toast_success') });
  });

  emailInput.addEventListener('input', () => {
    emailInput.classList.remove('err');
  });
}
