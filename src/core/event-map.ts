import type {
  CartSnapshot,
  FilterFamily,
  Product,
  Review,
  Volume,
} from './types';

/**
 * Global application event map.
 * Keys = event name, value = payload type.
 * Add new events here so the bus stays type-safe.
 */
export interface AppEvents {
  /* ---- Cart ---- */
  'cart:changed': CartSnapshot;
  'cart:item-added': { productId: string; volume: Volume; qty: number };
  'cart:item-removed': { key: string };
  'cart:qty-changed': { key: string; delta: number };
  'cart:cleared': undefined;
  'cart:checkout': { orderNumber: string };

  /* ---- Filters & Catalog ---- */
  'filter:changed': FilterFamily;
  'catalog:updated': { products: Product[] };

  /* ---- Modal ---- */
  'modal:opened': { productId: string; product: Product };
  'modal:closed': undefined;
  'modal:add-to-cart': { productId: string; volume: Volume };
  'modal:volume-changed': { volume: Volume };

  /* ---- Cart drawer ---- */
  'drawer:opened': undefined;
  'drawer:closed': undefined;
  'drawer:checkout': undefined;
  'drawer:continue-shopping': undefined;

  /* ---- Product grid ---- */
  'grid:quick-view': { productId: string };
  'grid:add-to-cart': { productId: string; volume: Volume };

  /* ---- Header / nav ---- */
  'header:cart-click': undefined;
  'header:menu-toggle': { open: boolean };
  'nav:link-click': { href: string };

  /* ---- Collections ---- */
  'collections:family-click': { family: FilterFamily };

  /* ---- Reviews ---- */
  'reviews:slide-change': { index: number; review: Review };

  /* ---- Newsletter ---- */
  'newsletter:submitted': { email: string };
  'newsletter:success': undefined;
  'newsletter:error': { message: string };

  /* ---- UI ---- */
  'toast:show': { html: string; duration?: number };
  'preloader:done': undefined;
  'scroll:top-click': undefined;

  /* ---- Lifecycle & i18n ---- */
  'app:ready': undefined;
  'i18n:change': { locale: string };
  'i18n:settings-changed': { settings: import('./types').LanguageSettings };

  /* ---- Auth & Account ---- */
  'auth:change': { user: import('./types').AuthUser | null };
  'auth:open': { tab?: 'login' | 'register' } | undefined;
  'account:open': undefined;
  'admin:open': undefined;
  'admin:product-saved': { product: Product };
  'admin:product-deleted': { productId: string };
}
