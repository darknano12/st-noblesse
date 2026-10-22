import type { AppConfig } from '../core/types';

/**
 * Formatting helpers — currency, numbers, stars, dates.
 * All locale-aware via injected config.
 */

const DEFAULTS: Pick<AppConfig, 'currencySymbol' | 'locale'> = {
  currencySymbol: '€',
  locale: 'en',
};

let cfg = DEFAULTS;

/** One-time setup from app boot */
export function configureFormat(options: Partial<typeof DEFAULTS>): void {
  cfg = { ...cfg, ...options };
}

/** €1,234 */
export function formatPrice(n: number): string {
  return (
    cfg.currencySymbol +
    n.toLocaleString(cfg.locale, { maximumFractionDigits: 0 })
  );
}

/** €1,234 — with explicit symbol/locale override */
export function formatPriceWith(n: number, symbol: string, locale: string): string {
  return symbol + n.toLocaleString(locale, { maximumFractionDigits: 0 });
}

/** 4.9 */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/** ★★★★☆ — full 5-char star string */
export function stars(rating: number): string {
  const rounded = Math.round(rating);
  let out = '';
  for (let i = 0; i < 5; i++) out += i < rounded ? '★' : '☆';
  return out;
}

/** Repeat a character n times (e.g. review stars) */
export function repeatChar(ch: string, n: number): string {
  return ch.repeat(n);
}

/** Order number: SN-4821 */
export function makeOrderNumber(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `SN-${num}`;
}

/** Percentage clamped to 0–100 */
export function clampPercent(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, (value / max) * 100);
}
