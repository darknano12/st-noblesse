# Component Contracts — st.noblesse

> **Purpose:** Define explicit APIs for each component so agents (human or AI) can develop, test, and replace them independently.

---

## 📐 Core Types

```typescript
// src/core/types.ts

/** Product catalog entry */
export interface Product {
  id: string;                    // 'azure-epure'
  img: string;                   // key in IMG map: 'p8'
  name: string;                  // 'Azure Épure'
  fam: 'floral' | 'oriental' | 'woody' | 'fresh';
  gender: 'Unisex' | 'Men' | 'Women';
  badge?: string;                // 'Signature' | ''
  desc: string;
  notes: {
    top: string[];
    heart: string[];
    base: string[];
  };
  price: Record<string, number>; // { '50': 89, '100': 129 } — keys = volume in ml
  rating: number;                // 0-5
  rev: number;                   // review count
}

/** Cart line item key format: `${productId}::${volume}` */
export type CartKey = string;

export interface CartItem {
  key: CartKey;
  productId: string;
  volume: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CartState {
  items: CartItem[];
  total: number;
  count: number;
  freeShipRemaining: number;
  freeShipProgress: number; // 0-100
}

/** Review for carousel */
export interface Review {
  t: string;  // text
  n: string;  // name
  c: string;  // context (location · product)
  s: number;  // stars 1-5
}

/** Filter state */
export type FilterFamily = 'all' | 'floral' | 'oriental' | 'woody' | 'fresh';

export interface AppConfig {
  freeShipThreshold: number;     // 150
  currency: string;              // 'EUR'
  currencySymbol: string;        // '€'
  locale: string;                // 'en'
  particleCount: { mobile: number; desktop: number };
}
```

---

## 🗄️ Store Contracts

### CartStore (`src/core/stores/cart.ts`)

```typescript
interface CartStore {
  /** Current immutable state snapshot */
  readonly state: CartState;

  /** Subscribe to changes — returns unsubscribe fn */
  subscribe(listener: (state: CartState) => void): () => void;

  /** Add or increment item */
  add(productId: string, volume: string, qty?: number): void;

  /** Set exact quantity (0 = remove) */
  setQty(key: CartKey, qty: number): void;

  /** Remove line entirely */
  remove(key: CartKey): void;

  /** Clear all */
  clear(): void;

  /** Persist to storage (called automatically) */
  persist(): void;

  /** Hydrate from storage (called on init) */
  hydrate(): void;
}
```

**Events emitted (via EventBus):**
- `cart:changed` — payload: `CartState`
- `cart:item-added` — payload: `{ productId, volume, qty }`
- `cart:item-removed` — payload: `{ key }`
- `cart:cleared` — no payload

---

### FilterStore (`src/core/stores/filter.ts`)

```typescript
interface FilterStore {
  readonly current: FilterFamily;
  subscribe(listener: (fam: FilterFamily) => void): () => void;
  set(fam: FilterFamily): void;
  reset(): void;
}
```

**Events:**
- `filter:changed` — payload: `FilterFamily`

---

### UIStore (`src/core/stores/ui.ts`)

```typescript
interface UIStore {
  /** Modal open state */
  readonly modal: { open: boolean; productId?: string };
  /** Cart drawer open state */
  readonly cartDrawer: boolean;
  /** Mobile nav open state */
  readonly mobileNav: boolean;
  /** Preloader done */
  readonly preloaderDone: boolean;
  /** Reduced motion preference */
  readonly reducedMotion: boolean;
  /** Fine pointer (mouse) */
  readonly finePointer: boolean;

  // Actions
  openModal(productId: string): void;
  closeModal(): void;
  openCart(): void;
  closeCart(): void;
  toggleMobileNav(): void;
  closeMobileNav(): void;
  markPreloaderDone(): void;
}
```

**Events:**
- `ui:modal-opened` / `ui:modal-closed`
- `ui:cart-opened` / `ui:cart-closed`
- `ui:mobile-nav-toggled`

---

## 🧩 Component Contracts

### 1. Header (`src/components/Header/`)

```typescript
// Props (none — reads from stores)
interface HeaderState {
  scrolled: boolean;
  cartCount: number;
}

// Events emitted
type HeaderEvents =
  | { type: 'header:cart-click' }
  | { type: 'header:menu-click' }
  | { type: 'header:logo-click' }
  | { type: 'header:nav-click'; href: string };
```

**DOM API:**
- `<header id="header">` — root
- `[data-header-cart]` — cart button (click → `header:cart-click`)
- `[data-header-menu]` — burger (click → `header:menu-click`)
- `[data-header-logo]` — logo (click → `header:logo-click`)
- `nav.desk a, #mnav a` — nav links (click → `header:nav-click`)

**CSS Classes (state):**
- `.scrolled` — on header when `scrollY > 30`
- `.open` — on `#mnav` and `.burger` when mobile menu open

---

### 2. Hero (`src/components/Hero/`)

```typescript
interface HeroConfig {
  images: { hero: string; flac: string }; // from IMG map
  stats: Array<{ value: number; suffix?: string; label: string }>;
}

interface HeroState {
  parallaxOffset: { x: number; y: number }; // -1 to 1
  cursorVisible: boolean;
  cursorRingBig: boolean;
}

// No external events — purely presentational + cursor/parallax side effects
```

**DOM API:**
- `#hero` — root
- `#heroImg` — hero image (src set from config)
- `.hero-media` — parallax target
- `.cur-dot`, `.cur-ring` — custom cursor elements

**Init:** Requires `finePointer && !reducedMotion` from UIStore

---

### 3. Collections (`src/components/Collections/`)

```typescript
interface CollectionsConfig {
  families: Array<{
    id: FilterFamily;
    label: string;      // 'Florale'
    icon: string;       // SVG path
    description: string;
    order: number;      // I, II, III, IV
  }>;
}

interface CollectionsEvents =
  | { type: 'collections:family-click'; family: FilterFamily };
```

**DOM API:**
- `#collections` — root
- `.col-card[data-fam]` — click → `collections:family-click`

**Behavior:** Clicking a family card sets FilterStore → triggers ProductGrid reload

---

### 4. ProductGrid (`src/components/ProductGrid/`)

```typescript
interface ProductGridProps {
  products: Product[];        // filtered by FilterStore
  onQuickView: (id: string) => void;
  onAddToCart: (id: string, volume: string) => void;
}

interface ProductGridState {
  visibleCount: number;       // for intersection observer stagger
}
```

**Events emitted:**
- `productgrid:quickview` — payload: `{ productId }`
- `productgrid:addtocart` — payload: `{ productId, volume }`

**DOM API:**
- `#grid` — root (receives rendered cards)
- `.pc[data-id]` — each card
- `[data-view]` — quick view trigger
- `[data-add]` — add to cart trigger (defaults to 50ml)

**Render:** Re-renders on `filter:changed` + `products` prop change

---

### 5. ProductCard (`src/components/ProductCard/`)

```typescript
interface ProductCardProps {
  product: Product;
  index: number;              // for stagger delay
  onQuickView: () => void;
  onAddToCart: (volume: string) => void;
  defaultVolume?: string;     // '50'
}

// No internal state — purely presentational
```

**DOM API (output):**
```html
<article class="pc pc-out" data-id="{product.id}" style="transition-delay: {index%4*80}ms">
  <div class="pc-media" data-view>
    {badge? <span class="badge">{badge}</span> : ''}
    <img src="{IMG[product.img]}" alt="{product.name}" loading="lazy">
    <button class="qv" type="button">Quick View</button>
  </div>
  <div class="pc-body">
    <span class="pc-fam">{FAMS[product.fam]} · {product.gender}</span>
    <h3 class="pc-name">{product.name}</h3>
    <p class="pc-notes">{top[0]} · {top[1]} · {heart[0]}</p>
    <div class="pc-row">
      <span class="pc-price">from {formatPrice(product.price['50'])}</span>
      <button class="pc-add" type="button" data-add aria-label="Add to bag">+</button>
    </div>
  </div>
</article>
```

**Animation:** `.pc-out` → `.pc-out.in` via IntersectionObserver (handled by ProductGrid)

---

### 6. ProductModal (`src/components/ProductModal/`)

```typescript
interface ProductModalProps {
  product: Product | null;    // null = closed
  onClose: () => void;
  onAddToCart: (volume: string) => void;
}

interface ProductModalState {
  selectedVolume: string;     // '50' | '100'
  isOpen: boolean;
}
```

**Events emitted:**
- `modal:addtocart` — payload: `{ productId, volume }`
- `modal:closed` — no payload

**DOM API:**
- `#modal` — root
- `#mdImg` — product image
- `#mdFam` — family + gender + badge
- `#mdName` — product name
- `#mdStars` / `#mdRev` — rating
- `#mdDesc` — description
- `#mdNotes` — note chips (top/heart/base)
- `#mdVol` — volume selector buttons `[data-vol]`
- `#mdPrice` — price for selected volume
- `#mdAdd` — add to cart button

**A11y Requirements:**
- Focus trap when open
- Restore focus to trigger on close
- `Escape` closes
- `aria-modal="true"`, `role="dialog"`

---

### 7. CartDrawer (`src/components/CartDrawer/`)

```typescript
interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

interface CartDrawerState {
  // Derived from CartStore
  items: CartItem[];
  total: number;
  count: number;
  freeShipRemaining: number;
  freeShipProgress: number;
}
```

**Events emitted:**
- `cartdrawer:qty-change` — payload: `{ key, delta }`
- `cartdrawer:remove` — payload: `{ key }`
- `cartdrawer:checkout` — no payload
- `cartdrawer:continue-shopping` — no payload
- `cartdrawer:closed` — no payload

**DOM API:**
- `#cart` — root
- `#overlay` — backdrop (click → close)
- `#cartItems` — list of `.ci` items
- `.qty [data-d]` — qty buttons (-1 / +1)
- `.ci-del[data-k]` — remove button
- `#shipTxt` / `#shipBar` — free shipping progress
- `#cartTotal` — subtotal
- `#checkout` — proceed button
- `.order-ok` — success state (shown after checkout)

**A11y:**
- Focus trap when open
- `aria-label="Shopping bag"`
- Restore focus to cart button on close

---

### 8. ReviewsCarousel (`src/components/ReviewsCarousel/`)

```typescript
interface ReviewsCarouselProps {
  reviews: Review[];
  autoPlay?: boolean;         // default true
  interval?: number;          // default 6500ms
}

interface ReviewsCarouselState {
  currentIndex: number;
  isPlaying: boolean;
}
```

**Events emitted:**
- `reviews:slide-change` — payload: `{ index, review }`

**DOM API:**
- `#revSlides` — container for `.rev-slide`
- `#revPrev`, `#revNext` — navigation
- `#revDots button[data-i]` — dot navigation

**Behavior:** Auto-pauses on hover, respects `reducedMotion`

---

### 9. Newsletter (`src/components/Newsletter/`)

```typescript
interface NewsletterProps {
  onSubmit: (email: string) => Promise<void>;
}

interface NewsletterState {
  status: 'idle' | 'submitting' | 'success' | 'error';
  errorMessage?: string;
}
```

**Events emitted:**
- `newsletter:submitted` — payload: `{ email }`
- `newsletter:success` — no payload
- `newsletter:error` — payload: `{ message }`

**DOM API:**
- `#nlForm` — form
- `#nlEmail` — email input
- `.nl-note` — helper text
- `.nl-done` — success state (shown when `status === 'success'`)

**Validation:** RFC 5322 compliant regex, shows `.err` state on invalid

---

### 10. Toast (`src/components/Toast/`)

```typescript
interface ToastStore {
  show(html: string, duration?: number): void;  // default 2600ms
  hide(): void;
}

interface ToastState {
  visible: boolean;
  content: string;
}
```

**DOM API:**
- `#toast` — root
- `#toastTxt` — content (HTML allowed)

**Behavior:** Single toast queue (new replaces current), auto-dismiss

---

### 11. Particles (`src/components/Particles/`)

```typescript
interface ParticlesConfig {
  count: { mobile: number; desktop: number };
  colors: string[];           // ['rgba(222,186,120,0.3)']
  bounds: { x: number; y: number };
}

interface ParticlesProps {
  enabled: boolean;           // !reducedMotion
  config: ParticlesConfig;
}

// No events — purely visual
```

**DOM API:**
- `#dust` — canvas element (fixed, full viewport, z-index: 2)

**Lifecycle:** `init()` → `requestAnimationFrame` loop → `destroy()` on unmount

---

### 12. Cursor (`src/components/Cursor/`)

```typescript
interface CursorProps {
  enabled: boolean;           // finePointer && !reducedMotion
}

interface CursorState {
  position: { x: number; y: number };
  ringPosition: { x: number; y: number };
  ringBig: boolean;
}

// No events — drives parallax on Hero via side effect
```

**DOM API:**
- `.cur-dot` — 6px dot (immediate follow)
- `.cur-ring` — 34px ring (lerped follow, expands on hover)

**Behavior:**
- `mousemove` → updates dot immediately, ring via lerp (0.14)
- `mouseover` on interactive elements → `.big` class on ring
- `body.cursor-on` class toggles visibility

---

### 13. Preloader (`src/components/Preloader/`)

```typescript
interface PreloaderProps {
  duration: number;           // default 1100ms
  onComplete: () => void;
}

// No state — one-shot animation
```

**DOM API:**
- `#preloader` — root
- `.done` class added on complete → fade out

---

### 14. Footer (`src/components/Footer/`)

```typescript
interface FooterProps {
  links: {
    collection: Array<{ label: string; href: string; fam?: FilterFamily }>;
    care: Array<{ label: string; href: string }>;
    boutique: { address: string; phone: string; email: string };
  };
  socials: Array<{ label: string; href: string; icon: string }>;
}

// Presentational only — no events
```

---

## 🔄 Event Bus Contract (`src/core/events.ts`)

```typescript
type AppEvent =
  | { type: 'cart:changed'; payload: CartState }
  | { type: 'cart:item-added'; payload: { productId: string; volume: string; qty: number } }
  | { type: 'cart:item-removed'; payload: { key: string } }
  | { type: 'cart:cleared' }
  | { type: 'filter:changed'; payload: FilterFamily }
  | { type: 'ui:modal-opened'; payload: { productId: string } }
  | { type: 'ui:modal-closed' }
  | { type: 'ui:cart-opened' }
  | { type: 'ui:cart-closed' }
  | { type: 'ui:mobile-nav-toggled'; payload: { open: boolean } }
  | { type: 'productgrid:quickview'; payload: { productId: string } }
  | { type: 'productgrid:addtocart'; payload: { productId: string; volume: string } }
  | { type: 'modal:addtocart'; payload: { productId: string; volume: string } }
  | { type: 'modal:closed' }
  | { type: 'cartdrawer:qty-change'; payload: { key: string; delta: number } }
  | { type: 'cartdrawer:remove'; payload: { key: string } }
  | { type: 'cartdrawer:checkout' }
  | { type: 'cartdrawer:continue-shopping' }
  | { type: 'cartdrawer:closed' }
  | { type: 'reviews:slide-change'; payload: { index: number; review: Review } }
  | { type: 'newsletter:submitted'; payload: { email: string } }
  | { type: 'newsletter:success' }
  | { type: 'newsletter:error'; payload: { message: string } }
  | { type: 'header:cart-click' }
  | { type: 'header:menu-click' }
  | { type: 'header:logo-click' }
  | { type: 'header:nav-click'; payload: { href: string } }
  | { type: 'collections:family-click'; payload: { family: FilterFamily } };

interface EventBus {
  on<T extends AppEvent['type']>(type: T, handler: (payload: Extract<AppEvent, { type: T }>['payload']) => void): () => void;
  emit<T extends AppEvent['type']>(type: T, payload: Extract<AppEvent, { type: T }>['payload']): void;
  off<T extends AppEvent['type']>(type: T, handler: Function): void;
}
```

**Usage Pattern:**
```typescript
// In component init
const unsubscribeCart = eventBus.on('cart:changed', (state) => {
  this.updateBadge(state.count);
});

// In component destroy
unsubscribeCart();
```

---

## 🎯 Integration Map

```
┌─────────────┐     filter:changed      ┌──────────────────┐
│ Collections │ ──────────────────────▶ │   FilterStore    │
└─────────────┘                         └────────┬─────────┘
                                                 │ current
                                                 ▼
┌─────────────┐     products (filtered)  ┌──────────────────┐
│ ProductGrid │ ◀──────────────────────── │   ProductGrid    │
└─────────────┘                            └────────┬─────────┘
                                                     │ events
                          ┌──────────────────────────┼──────────────────────────┐
                          ▼                          ▼                          ▼
                 ┌───────────────┐          ┌───────────────┐          ┌───────────────┐
                 │ ProductModal  │          │  CartStore    │          │  CartDrawer   │
                 └───────┬───────┘          └───────┬───────┘          └───────┬───────┘
                         │                          │                          │
                         │ modal:addtocart          │ cart:changed             │
                         ▼                          ▼                          ▼
                 ┌─────────────────────────────────────────────────────────────────┐
                 │                        EventBus                                  │
                 └─────────────────────────────────────────────────────────────────┘
```

---

## ✅ Acceptance Criteria per Component

| Component | Must Render | Must Emit | Must Handle | A11y |
|-----------|-------------|-----------|-------------|------|
| Header | ✅ | `header:*` | `cart:changed` (badge) | Focus order, ARIA labels |
| Hero | ✅ | — | `ui:finePointer`, `ui:reducedMotion` | Reduced motion respected |
| Collections | ✅ | `collections:family-click` | — | Keyboard accessible cards |
| ProductGrid | ✅ | `productgrid:*` | `filter:changed` | Semantic list |
| ProductCard | ✅ | — | `onQuickView`, `onAddToCart` | Button semantics |
| ProductModal | ✅ | `modal:*` | `product` prop, `Escape` | Focus trap, restore |
| CartDrawer | ✅ | `cartdrawer:*` | `cart:changed`, `Escape` | Focus trap, restore |
| ReviewsCarousel | ✅ | `reviews:slide-change` | `reviews` prop, `reducedMotion` | Live region for slide |
| Newsletter | ✅ | `newsletter:*` | `onSubmit` promise | Form validation |
| Toast | ✅ | — | `show/hide` | `aria-live="polite"` |
| Particles | ✅ | — | `enabled` prop | `prefers-reduced-motion` |
| Cursor | ✅ | — | `enabled` prop | Hidden from AT |
| Preloader | ✅ | — | `duration` prop | `aria-hidden` |
| Footer | ✅ | — | — | Semantic links |

---

*Contracts version: 1.0 | Update when component APIs change*