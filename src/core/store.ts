/**
 * Tiny dependency-free reactive store.
 *
 *   const counter = createStore(0);
 *   const off = counter.subscribe(v => console.log(v));
 *   counter.set(1);   // notifies
 *   counter.update(n => n + 1);
 *
 * Perfect for small apps — no framework needed.
 */
export interface Store<T> {
  /** Current immutable snapshot */
  readonly value: T;
  /** Replace state (no-op if Object.is equal) */
  set(next: T): void;
  /** Derive next state from current */
  update(fn: (current: T) => T): void;
  /** Subscribe to changes. Fires immediately with current value. Returns unsubscribe. */
  subscribe(listener: (value: T) => void): () => void;
  /** Subscribe without the initial fire */
  watch(listener: (value: T) => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let current = initial;
  const listeners = new Set<(value: T) => void>();

  function notify(): void {
    for (const listener of [...listeners]) {
      try {
        listener(current);
      } catch (err) {
        console.error('[store] listener error', err);
      }
    }
  }

  return {
    get value() {
      return current;
    },
    set(next: T): void {
      if (Object.is(current, next)) return;
      current = next;
      notify();
    },
    update(fn: (cur: T) => T): void {
      this.set(fn(current));
    },
    subscribe(listener: (value: T) => void): () => void {
      listeners.add(listener);
      listener(current);
      return () => listeners.delete(listener);
    },
    watch(listener: (value: T) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
