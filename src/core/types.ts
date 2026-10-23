/**
 * Core domain types for st.noblesse
 */

/** Olfactory family of a fragrance */
export type Family = 'floral' | 'oriental' | 'woody' | 'fresh';

/** Filter selection — includes 'all' for unfiltered */
export type FilterFamily = 'all' | Family;

/** Target gender for a fragrance */
export type Gender = 'Unisex' | 'Men' | 'Women';

/** Volume in millilitres — constrained to available sizes */
export type Volume = '50' | '100';

/** Three-tier olfactory pyramid */
export interface Notes {
  top: string[];
  heart: string[];
  base: string[];
}

/** Price per volume (key = ml as string) */
export type PriceMap = Record<Volume, number>;

/** Product catalog entry */
export interface Product {
  /** URL-safe unique identifier, e.g. 'azure-epure' */
  id: string;
  /** Direct PocketBase record ID, e.g. 'vxrj6v469h8iqke' */
  recordId?: string;
  /** Key into the images map or direct image data/url */
  img: string;
  name: string;
  fam: Family;
  gender: Gender;
  /** Optional gold badge, empty string = none */
  badge: string;
  desc: string;
  notes: Notes;
  price: PriceMap;
  /** Average rating, 0–5 */
  rating: number;
  /** Total review count */
  rev: number;
  /** Optional discount percentage, 0-99 */
  discountPercent?: number;
  /** Optional promotion / discount label, e.g. "Autumn Privilege", "Winter Privilege" */
  discountLabel?: string;
  /** In-stock availability, defaults to true */
  inStock?: boolean;
}

/** Composite cart key: `${productId}::${volume}` */
export type CartKey = `${string}::${Volume}`;

/** Parsed cart key parts */
export interface CartKeyParts {
  productId: string;
  volume: Volume;
}

/** One line in the shopping bag */
export interface CartLine {
  key: CartKey;
  product: Product;
  volume: Volume;
  qty: number;
  /** unit × qty */
  lineTotal: number;
}

/** Derived cart snapshot */
export interface CartSnapshot {
  lines: CartLine[];
  count: number;
  subtotal: number;
  discount: number;
  total: number;
  freeFlaconDiscount: number;
  freeFlaconsCount: number;
  promoCode?: string;
  promoDiscount: number;
  /** Amount still needed to unlock free shipping (0 = unlocked) */
  shipRemaining: number;
  /** 0–100 progress toward free shipping */
  shipProgress: number;
  freeShipUnlocked: boolean;
}

/** Customer review for the carousel */
export interface Review {
  id?: string;
  t: string;
  n: string;
  c: string;
  s: number;
  created?: string;
}

/** Root app configuration */
export interface AppConfig {
  freeShipThreshold: number;
  shipping?: {
    carrier: 'DHL';
    freeThreshold: number;
    rates: {
      DE: number;
      EU: number;
    };
    notifications: 'email';
  };
  currency: string;
  currencySymbol: string;
  locale: string;
  particleCount: { mobile: number; desktop: number };
  particleMobileBreakpoint: number;
  families: Record<Family, string>;
  navLinks: { label: string; href: string }[];
  preloaderDuration: number;
  reviewInterval: number;
  cartStorageKey: string;
}

/** Image path map */
export interface ImageMap {
  hero: string;
  atelier: string;
  p1: string;
  p2: string;
  p3: string;
  p4: string;
  p5: string;
  p6: string;
  p7: string;
  p8: string;
  logo: string;
}

/** Authenticated user model */
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  isAdmin: boolean;
  avatar?: string;
}

/** Order record from database */
export interface OrderRecord {
  id: string;
  stripe_session_id: string;
  customer_email?: string;
  items: Array<{ productId: string; volume: Volume; qty: number; name?: string }>;
  total: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed';
  created: string;
}

/** Localized map for multi-language fields */
export interface LocalizedText {
  de?: string;
  en?: string;
  fr?: string;
  es?: string;
  [locale: string]: string | undefined;
}

/** Global language display settings */
export interface LanguageSettings {
  showSwitcher: boolean;
  defaultLocale?: string;
  switcherPosition?: 'header' | 'footer' | 'both';
  languages: {
    en: boolean;
    de: boolean;
    nl?: boolean;
    fr: boolean;
    es: boolean;
    it?: boolean;
    nb?: boolean;
    sv?: boolean;
    da?: boolean;
    [locale: string]: boolean | undefined;
  };
}

/** Product form data for Studio add/edit */
export interface ProductFormData {
  id?: string;
  recordId?: string;
  slug?: string;
  name: string;
  family: Family;
  gender: Gender;
  badge?: string;
  desc: string;
  desc_translations?: LocalizedText;
  notes_top: string[];
  notes_heart: string[];
  notes_base: string[];
  price_50: number;
  price_100: number;
  discount_percent?: number;
  discount_label?: string;
  in_stock?: boolean;
  image?: string;
}
