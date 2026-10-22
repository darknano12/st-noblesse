/**
 * DOM helpers — safe, typed wrappers around common vanilla patterns.
 */

/** querySelector that throws if missing (catches template bugs early) */
export function must<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`[dom] required element not found: ${selector}`);
  return el;
}

/** querySelector that returns null when absent */
export function qs<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document
): T | null {
  return root.querySelector<T>(selector);
}

/** querySelectorAll → Array */
export function qsa<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document
): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

/** Closest-match event delegation */
export function delegate<K extends keyof HTMLElementEventMap>(
  root: Element | Document,
  type: K | string,
  selector: string,
  handler: (event: HTMLElementEventMap[K], matched: Element) => void
): () => void {
  const listener = (event: Event): void => {
    const target = (event.target as Element | null)?.closest(selector);
    if (target && root.contains(target)) {
      handler(event as HTMLElementEventMap[K], target);
    }
  };
  root.addEventListener(type as string, listener);
  return () => root.removeEventListener(type as string, listener);
}

/** Escape HTML for safe interpolation */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Toggle a class and return previous state */
export function toggleClass(el: Element, cls: string, force?: boolean): boolean {
  return el.classList.toggle(cls, force);
}

/** Add a class, force a reflow, then remove — restarts CSS animations */
export function restartAnimation(el: Element, cls: string): void {
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
}

/** Scoped $/$$ aliases for component roots */
export function within<T extends Element>(root: ParentNode) {
  return {
    qs: <E extends Element = HTMLElement>(sel: string) => root.querySelector<E>(sel),
    qsa: <E extends Element = HTMLElement>(sel: string) => Array.from(root.querySelectorAll<E>(sel)),
    must: <E extends Element = HTMLElement>(sel: string) => must<E>(sel, root),
    delegate: <K extends keyof HTMLElementEventMap>(
      type: K | string,
      sel: string,
      handler: (event: HTMLElementEventMap[K], matched: Element) => void
    ) => delegate(root as Element, type, sel, handler),
  };
}
