import { bus } from '../../core/bus';
import { must } from '../../utils/dom';

/**
 * Toast — transient notification popup.
 *
 * DOM contract:
 *   #toast       — container (toggles .show)
 *   #toastTxt    — HTML content
 *
 * Listens:  toast:show  { html, duration? }
 */
export function initToast(defaultDuration = 2600): void {
  const toast = must('#toast');
  const toastTxt = must('#toastTxt');
  let timer: number | null = null;

  function show(html: string, duration = defaultDuration): void {
    toastTxt.innerHTML = html;
    toast.classList.add('show');
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => toast.classList.remove('show'), duration);
  }

  function hide(): void {
    toast.classList.remove('show');
    if (timer !== null) window.clearTimeout(timer);
  }

  bus.on('toast:show', ({ html, duration }) => show(html, duration));
  bus.on('newsletter:error', ({ message }) => show(message));
}
