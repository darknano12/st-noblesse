/**
 * Minimal typed event bus for cross-component communication.
 *
 * Usage:
 *   const off = bus.on('cart:changed', state => render(state));
 *   bus.emit('cart:changed', snapshot);
 *   off();
 */

type Handler<T = unknown> = (payload: T) => void;

export class EventBus<EventMap extends Record<string, unknown>> {
  private handlers = new Map<keyof EventMap, Set<Handler>>();

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   */
  on<K extends keyof EventMap>(
    type: K,
    handler: Handler<EventMap[K]>
  ): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as Handler);
    return () => this.off(type, handler);
  }

  /**
   * Subscribe — fires at most once.
   */
  once<K extends keyof EventMap>(
    type: K,
    handler: Handler<EventMap[K]>
  ): () => void {
    const off = this.on(type, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  /**
   * Unsubscribe a specific handler.
   */
  off<K extends keyof EventMap>(type: K, handler: Handler<EventMap[K]>): void {
    const set = this.handlers.get(type);
    if (set) set.delete(handler as Handler);
  }

  /**
   * Emit an event to all subscribers.
   */
  emit<K extends keyof EventMap>(type: K, payload: EventMap[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    // Copy so handlers can unsubscribe during emit
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] handler error for "${String(type)}"`, err);
      }
    }
  }

  /**
   * Remove all handlers (all events or one event).
   */
  clear(type?: keyof EventMap): void {
    if (type) this.handlers.delete(type);
    else this.handlers.clear();
  }

  /** Number of handlers registered for a type (for tests/debug). */
  listenerCount(type: keyof EventMap): number {
    return this.handlers.get(type)?.size ?? 0;
  }
}
