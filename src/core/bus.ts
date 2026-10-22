import type { AppEvents } from './event-map';
import { EventBus } from './events';

/**
 * App-wide singleton event bus.
 * Import this everywhere instead of wiring components directly.
 */
export const bus = new EventBus<AppEvents>();

/**
 * Sugar: subscribe and auto-log in dev.
 *
 *   off = onCart(state => badge.update(state.count));
 */
export function on<K extends keyof AppEvents>(
  type: K,
  handler: (payload: AppEvents[K]) => void
): () => void {
  return bus.on(type, handler);
}

/** Sugar: emit */
export function emit<K extends keyof AppEvents>(
  type: K,
  ...args: AppEvents[K] extends undefined ? [] : [AppEvents[K]]
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bus.emit(type, args[0] as any);
}
