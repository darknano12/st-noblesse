import { bus } from '../../core/bus';
import { must } from '../../utils/dom';

/**
 * Preloader — branded splash shown until assets settle.
 *
 * DOM contract:
 *   #preloader       — root (toggles .done)
 *   .pre-name        — brand name
 *   .pre-bar i       — progress bar fill
 *
 * Emits:  preloader:done
 */
export function initPreloader(duration = 1100): void {
  const preloader = must('#preloader');

  window.setTimeout(() => {
    preloader.classList.add('done');
    bus.emit('preloader:done', undefined);
  }, duration);
}
