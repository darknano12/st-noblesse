import { bus } from './bus';
import { createStore, type Store } from './store';
import type {
  CartKey,
  CartLine,
  CartSnapshot,
  PriceMap,
  Product,
  Volume,
} from './types';

/* ------------------------------------------------------------------ */
/* Raw persisted shape: { "azure-epure::50": 2, ... }                 */
/* ------------------------------------------------------------------ */
type RawCart = Record<string, number>;

const VOLUMES: Volume[] = ['50', '100'];

/* ------------------------------------------------------------------ */
/* Key helpers — single place that knows the `id::vol` format          */
/* ------------------------------------------------------------------ */
export function makeKey(productId: string, volume: Volume): CartKey {
  return `${productId}::${volume}`;
}

export function parseKey(key: string): { productId: string; volume: Volume } | null {
  const i = key.indexOf('::');
  if (i === -1) return null;
  const productId = key.slice(0, i);
  const volume = key.slice(i + 2) as Volume;
  if (!productId || !VOLUMES.includes(volume)) return null;
  return { productId, volume };
}

export const VALID_PROMOS: Record<string, { percent: number; label: string }> = {
  NOBLESSE15: { percent: 15, label: '15% Off Privilege' },
  BIENVENUE10: { percent: 10, label: '10% Welcome Gift' },
  VIP20: { percent: 20, label: '20% VIP Salon' },
};

/* ------------------------------------------------------------------ */
/* Cart store                                                          */
/* ------------------------------------------------------------------ */
export interface CartStoreOptions {
  /** Lookup used to resolve products at render time */
  resolveProduct: (id: string) => Product | undefined;
  /** Free-shipping threshold in currency units */
  freeShipThreshold: number;
  /** localStorage key */
  storageKey: string;
  /** Currency formatter (defaults to EUR) */
  formatPrice?: (n: number) => string;
}

export interface CartApi {
  store: Store<RawCart>;
  /** Derived, read-only snapshot (products resolved) */
  snapshot(): CartSnapshot;
  add(productId: string, volume: Volume, qty?: number): void;
  setQty(key: CartKey, qty: number): void;
  remove(key: CartKey): void;
  clear(): void;
  count(): number;
  subtotal(): number;
  applyPromo(code: string): { ok: boolean; message?: string; discountPercent?: number };
  removePromo(): void;
  getPromoCode(): string | undefined;
  /** Hydrate from localStorage — call once on boot */
  hydrate(): void;
}

export function createCart(opts: CartStoreOptions): CartApi {
  const store = createStore<RawCart>({});
  let appliedPromoCode: string | null = null;

  /* ---- persistence ---- */
  function persist(): void {
    try {
      localStorage.setItem(opts.storageKey, JSON.stringify(store.value));
      if (appliedPromoCode) {
        localStorage.setItem(`${opts.storageKey}_promo`, appliedPromoCode);
      } else {
        localStorage.removeItem(`${opts.storageKey}_promo`);
      }
    } catch {
      /* quota or private mode — fail silently */
    }
  }

  function hydrate(): void {
    try {
      const raw = localStorage.getItem(opts.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as RawCart;
        if (parsed && typeof parsed === 'object') {
          // Sanitize: keep only valid keys with positive int quantities
          const clean: RawCart = {};
          for (const [k, v] of Object.entries(parsed)) {
            if (parseKey(k) && Number.isInteger(v) && v > 0) clean[k] = v;
          }
          store.set(clean);
        }
      }
      const rawPromo = localStorage.getItem(`${opts.storageKey}_promo`);
      if (rawPromo && VALID_PROMOS[rawPromo.trim().toUpperCase()]) {
        appliedPromoCode = rawPromo.trim().toUpperCase();
      }
    } catch {
      /* corrupted data — start empty */
    }
  }

  /* ---- derived values ---- */
  function resolveLine(key: string, qty: number): CartLine | null {
    const parts = parseKey(key);
    if (!parts) return null;
    const product = opts.resolveProduct(parts.productId);
    if (!product) return null;
    const unit = product.price[parts.volume];
    if (typeof unit !== 'number') return null;
    return {
      key: key as CartKey,
      product,
      volume: parts.volume,
      qty,
      lineTotal: unit * qty,
    };
  }

  function snapshot(): CartSnapshot {
    const raw = store.value;
    const lines: CartLine[] = [];
    const unitPrices: number[] = [];
    let count = 0;
    let subtotal = 0;

    for (const [k, v] of Object.entries(raw)) {
      const line = resolveLine(k, v);
      if (!line) continue;
      lines.push(line);
      count += line.qty;
      subtotal += line.lineTotal;
      const unit = line.product.price[line.volume];
      if (typeof unit === 'number') {
        for (let i = 0; i < line.qty; i++) {
          unitPrices.push(unit);
        }
      }
    }

    // Buy 2 Get 1 Free: For every 3 flacons, the 3rd flacon (lowest unit price) is complimentary
    unitPrices.sort((a, b) => a - b);
    const freeFlaconsCount = Math.floor(count / 3);
    let freeFlaconDiscount = 0;
    for (let i = 0; i < freeFlaconsCount; i++) {
      freeFlaconDiscount += unitPrices[i];
    }

    // Promo code applied to the remaining subtotal after free flacon privilege
    let promoDiscount = 0;
    if (appliedPromoCode && VALID_PROMOS[appliedPromoCode]) {
      const percent = VALID_PROMOS[appliedPromoCode].percent;
      const eligibleSubtotal = Math.max(0, subtotal - freeFlaconDiscount);
      promoDiscount = Math.round(eligibleSubtotal * (percent / 100));
    }

    const discount = freeFlaconDiscount + promoDiscount;
    const total = Math.max(0, subtotal - discount);
    const remaining = Math.max(0, opts.freeShipThreshold - subtotal);

    return {
      lines,
      count,
      subtotal,
      discount,
      total,
      freeFlaconDiscount,
      freeFlaconsCount,
      promoCode: appliedPromoCode || undefined,
      promoDiscount,
      shipRemaining: remaining,
      shipProgress: Math.min(100, (subtotal / opts.freeShipThreshold) * 100),
      freeShipUnlocked: subtotal >= opts.freeShipThreshold,
    };
  }

  function count(): number {
    let n = 0;
    for (const v of Object.values(store.value)) n += v;
    return n;
  }

  function subtotal(): number {
    let t = 0;
    for (const [k, v] of Object.entries(store.value)) {
      const line = resolveLine(k, v);
      if (line) t += line.lineTotal;
    }
    return t;
  }

  /* ---- mutations (all emit + persist atomically) ---- */
  function commit(next: RawCart): void {
    store.set(next);
    persist();
    bus.emit('cart:changed', snapshot());
  }

  function add(productId: string, volume: Volume, qty = 1): void {
    const key = makeKey(productId, volume);
    const next = { ...store.value, [key]: (store.value[key] ?? 0) + qty };
    commit(next);
    bus.emit('cart:item-added', { productId, volume, qty });
  }

  function setQty(key: CartKey, qty: number): void {
    const next = { ...store.value };
    if (qty <= 0) {
      delete next[key];
    } else {
      next[key] = qty;
    }
    commit(next);
  }

  function remove(key: CartKey): void {
    const next = { ...store.value };
    delete next[key];
    commit(next);
    bus.emit('cart:item-removed', { key });
  }

  function clear(): void {
    commit({});
    bus.emit('cart:cleared', undefined);
  }

  function applyPromo(code: string): { ok: boolean; message?: string; discountPercent?: number } {
    const clean = (code || '').trim().toUpperCase();
    if (!clean || !VALID_PROMOS[clean]) {
      return { ok: false, message: 'Invalid or expired code' };
    }
    appliedPromoCode = clean;
    persist();
    bus.emit('cart:changed', snapshot());
    return { ok: true, discountPercent: VALID_PROMOS[clean].percent };
  }

  function removePromo(): void {
    appliedPromoCode = null;
    persist();
    bus.emit('cart:changed', snapshot());
  }

  function getPromoCode(): string | undefined {
    return appliedPromoCode || undefined;
  }

  return {
    store,
    snapshot,
    add,
    setQty,
    remove,
    clear,
    count,
    subtotal,
    applyPromo,
    removePromo,
    getPromoCode,
    hydrate,
  };
}

export type { PriceMap };
