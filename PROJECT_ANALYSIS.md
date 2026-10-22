# st.noblesse — Project Analysis & Refactoring Roadmap

> **Goal:** Identify architectural minuses, separate components for agentic development, and prepare for scalable feature development.

---

## 📊 Project Overview

**Type:** Luxury perfume e-commerce SPA (single HTML + vanilla JS + CSS)  
**Stack:** HTML5, CSS Custom Properties, Vanilla JS (IIFE), IntersectionObserver, Canvas API  
**Features:** Hero, Collections, Catalog (filtering), Story, Reviews Carousel, Newsletter, Cart Drawer, Product Modal, Preloader, Custom Cursor, Particle System

---

## ❌ CRITICAL MINUSES (Architecture & Maintainability)

### 1. **Monolithic Single-File Architecture**
| File | Lines | Issues |
|------|-------|--------|
| `index.html` | 310 | All markup in one file; no partials/includes |
| `css/styles.css` | 481 | All styles in one file; no modular organization |
| `js/app.js` | 341 | All logic in one IIFE; no module separation |

**Impact:** Impossible to work on features in parallel; merge conflicts inevitable; no code reuse.

---

### 2. **No Module System / Dependency Management**
- Single IIFE wrapper pollutes global scope minimally but prevents:
  - Tree-shaking / dead code elimination
  - Lazy-loading non-critical features
  - Unit testing individual modules
  - TypeScript migration path

---

### 3. **Data Hardcoded in JS**
```javascript
// js/app.js lines 4-30
var IMG = {...};
var P = [...];        // Products
var REVIEWS = [...];  // Reviews
```
**Problems:**
- No CMS/headless integration path
- Cannot add products without code deploy
- No i18n support (strings mixed with logic)
- No schema validation

---

### 4. **Tight Coupling: DOM ↔ Logic**
- Selectors scattered throughout (`$('#grid')`, `$('.pc-add')`, etc.)
- HTML structure changes break JS silently
- No component abstraction (e.g., `ProductCard`, `CartDrawer`)
- Event delegation mixed with direct listeners

---

### 5. **No State Management Pattern**
- `cart` object mutated directly in 5+ places
- No single source of truth
- No reactivity — `renderCart()` called manually everywhere
- Race conditions possible (async localStorage + UI)

---

### 6. **Accessibility Gaps**
| Issue | Location |
|-------|----------|
| Custom cursor breaks `prefers-reduced-motion` for pointer | `cursor-on` class added regardless |
| Modal focus trap missing | `#modal` opens without focus management |
| Cart drawer not in tab order when closed | `transform: translateX(102%)` only |
| `aria-live` missing for toast/cart count | `#toast`, `#cartCount` |
| Keyboard navigation for volume buttons | `.vol button` — no arrow key support |
| Color contrast: `--muted2` (#79829a) on `--bg` (#0a0e1a) = 3.8:1 (fail AA) | CSS tokens |

---

### 7. **Performance Anti-Patterns**
| Issue | Impact |
|-------|--------|
| `mousemove` listener fires on **every frame** for cursor + parallax | 60fps main thread load |
| Particle canvas runs `requestAnimationFrame` unconditionally | Battery drain on mobile |
| No `IntersectionObserver` for images below fold | All hero/catalog images load eagerly |
| `localStorage` sync on every cart mutation | Blocking I/O |
| No code splitting — 17KB JS loads upfront | Slow 3G FCP |

---

### 8. **CSS Architecture Issues**
- **No BEM / naming convention** — `.pc`, `.pc-media`, `.pc-body`, `.ci`, `.ci-name` inconsistent
- **Magic numbers everywhere** — `top:-14px`, `width:calc(62% + 48px)`, `transition-delay:.05s`
- **No design token abstraction** — spacing, radii, shadows not systematized
- **Media queries scattered** — 3 breakpoints duplicated across 15+ rules
- **Animation keyframes inline** — not reusable

---

### 9. **No Build / Tooling Pipeline**
- No minification, bundling, transpilation
- No linting (ESLint), formatting (Prettier), type-checking
- No CI/CD, no preview deployments
- Images unoptimized (hero.jpg = 211KB, atelier.jpg = 117KB)

---

### 10. **Error Handling & Resilience**
| Gap | Risk |
|-----|------|
| `localStorage` try/catch swallows errors silently | Cart data loss undetected |
| No `fetch` fallback for images | Broken UX on 404 |
| No service worker / offline support | PWA opportunity lost |
| No CSP headers defined | XSS surface |

---

## ⚠️ MODERATE MINUSES (Developer Experience)

### 11. **Mixed Language in Codebase**
- JS comments in Russian (`/* ============ ДАННЫЕ ============ */`)
- CSS/HTML in English
- **Team onboarding friction**

### 12. **Inconsistent Naming**
| Pattern | Examples |
|---------|----------|
| CamelCase | `cartCount`, `addToCart`, `mdP` |
| Kebab-case (data attrs) | `data-fam`, `data-add`, `data-view` |
| Abbreviated | `mdP`, `mdVol`, `rIdx`, `rT`, `io`, `rio` |
| Semantic | `FAMS`, `P`, `REVIEWS` (uppercase constants) |

### 13. **No Type Safety**
- `P` array objects have implicit shape
- `cart` key format `id::vol` parsed by string split
- `byId()` returns `null` but callers don't check

### 14. **Hardcoded Business Logic**
```javascript
var FREE_SHIP = 150;           // Should be config
var N = innerWidth < 700 ? 34 : 66;  // Magic breakpoint
```
- Currency hardcoded to EUR (`€`) but cart shows `₽` (line 274 in HTML)
- No tax calculation, no shipping zones

---

## 🔧 LOW MINUSES (Polish)

### 15. **Image Optimization**
- No WebP/AVIF, no responsive `srcset`, no `loading="lazy"` on hero

### 16. **SEO / Meta**
- Single `index.html` — no dynamic meta per product
- No JSON-LD structured data for products

### 17. **Analytics / Telemetry**
- None — no events for add-to-cart, checkout, filter usage

---

## ✅ STRENGTHS (Don't Break These)

| Strength | Why It Matters |
|----------|----------------|
| **Zero dependencies** | Fast load, no supply chain risk |
| **Custom properties for theming** | Easy dark/light, brand updates |
| **`prefers-reduced-motion` respected** | Accessibility baseline |
| **IntersectionObserver for reveal** | Performant scroll animations |
| **LocalStorage cart persistence** | Survives refresh |
| **Semantic HTML structure** | SEO foundation solid |
| **Custom cursor + parallax** | Brand-differentiating UX |
| **Clean CSS organization** (sections commented) | Readable despite monolith |

---

## 🧩 COMPONENT SEPARATION MAP

### Target Architecture (Module-Based)

```
st.noblesse/
├── public/
│   ├── index.html              # Shell only
│   ├── manifest.json           # PWA
│   └── sw.js                   # Service worker
├── src/
│   ├── main.js                 # App bootstrap
│   ├── core/
│   │   ├── state.js            # Reactive store (cart, filters, locale)
│   │   ├── events.js           # Event bus (pub/sub)
│   │   ├── router.js           # Hash/history router (future)
│   │   └── i18n.js             # Translation system
│   ├── components/
│   │   ├── Header/
│   │   │   ├── Header.js
│   │   │   ├── Header.css
│   │   │   └── index.js
│   │   ├── Hero/
│   │   ├── Collections/
│   │   ├── ProductGrid/
│   │   ├── ProductCard/
│   │   ├── ProductModal/
│   │   ├── CartDrawer/
│   │   ├── ReviewsCarousel/
│   │   ├── Newsletter/
│   │   ├── Footer/
│   │   ├── Preloader/
│   │   ├── Toast/
│   │   ├── Cursor/
│   │   └── Particles/
│   ├── data/
│   │   ├── products.json       # Product catalog
│   │   ├── reviews.json
│   │   └── config.json         # FREE_SHIP, currency, etc.
│   ├── services/
│   │   ├── api.js              # Fetch wrapper (future CMS)
│   │   ├── storage.js          # localStorage abstraction
│   │   └── analytics.js        # Event tracking
│   ├── utils/
│   │   ├── dom.js              # $, $$, delegate, trapFocus
│   │   ├── format.js           # price, number, date
│   │   ├── a11y.js             # focus management, announcements
│   │   └── animation.js        # reduced-motion helpers
│   └── styles/
│       ├── tokens.css          # Design tokens (colors, spacing, type)
│       ├── reset.css
│       ├── globals.css         # Base, utilities
│       ├── components/         # Component-scoped CSS
│       └── main.css            # Entry point
├── package.json
├── vite.config.js              # Or webpack/rollup
├── tsconfig.json
└── .github/workflows/ci.yml
```

---

## 🎯 PRIORITY REFACTORING SEQUENCE

### Phase 1: Foundation (Week 1-2) — **Non-breaking**
1. **Add build tooling** (Vite recommended) — keep current output identical
2. **Extract data** → `src/data/products.json`, `reviews.json`, `config.json`
3. **Split CSS** → tokens, reset, components, globals using `@import` or postcss-import
4. **Add TypeScript** — `tsconfig.json` with `checkJs: true` for gradual migration
5. **Add ESLint + Prettier + Husky** — enforce consistency

### Phase 2: Component Extraction (Week 2-3)
| Order | Component | Reason |
|-------|-----------|--------|
| 1 | `CartDrawer` + `CartStore` | Isolate business-critical state |
| 2 | `ProductCard` + `ProductGrid` | Reusable, testable, most DOM-coupled |
| 3 | `ProductModal` | Complex, high interaction surface |
| 4 | `Header` + `MobileNav` | Navigation backbone |
| 5 | `Hero` | Visual centerpiece, parallax/cursor logic |
| 6 | `ReviewsCarousel` | Self-contained, swappable |
| 7 | `Newsletter` | Form validation pattern |
| 8 | `Cursor` + `Particles` | Optional enhancements, lazy-load |

### Phase 3: State & Architecture (Week 3-4)
1. **Introduce reactive store** (tiny: `proxy` + subscribers or `nanostores`)
2. **Migrate cart to store** — single source of truth
3. **Event bus for cross-component communication** (cart → header badge, modal → cart)
4. **Focus management utilities** — modal trap, restore focus

### Phase 4: Polish & Scale (Week 4+)
- Image optimization pipeline (sharp/vite-imagetools)
- PWA: manifest, service worker, offline cart
- i18n: extract all strings, add locale switching
- Analytics: GA4/Plausible events
- CSP headers, security headers
- E2E tests (Playwright): cart flow, filter, modal

---

## 🤖 AGENTIC DEVELOPMENT READINESS

### What "Agentic Ready" Means Here
| Capability | Current | Target |
|------------|---------|--------|
| **Add new product** | Edit JS array + add image | CMS / JSON file + image drop |
| **Add new section** | Edit HTML + CSS + JS in 3 files | `src/components/NewSection/` only |
| **Run tests** | None | `npm test` (unit + e2e) |
| **Deploy preview** | Manual | PR → Netlify/Vercel preview URL |
| **Rollback** | Git revert | Atomic deploy + instant rollback |
| **Type-safe refactor** | ❌ | ✅ TypeScript |

### Required Interfaces for Agents
```typescript
// src/core/state.ts
interface CartStore {
  items: CartItem[];
  add(productId: string, volume: string, qty: number): void;
  remove(key: string): void;
  update(key: string, qty: number): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
}

// src/components/ProductCard/ProductCard.ts
interface ProductCardProps {
  product: Product;
  onQuickView: (id: string) => void;
  onAddToCart: (id: string, volume: string) => void;
}
```

---

## 📋 IMMEDIATE ACTION ITEMS (Do This Week)

| # | Task | Effort | Risk |
|---|------|--------|------|
| 1 | `npm init -y && npm i -D vite typescript` | 15 min | Zero |
| 2 | Move `js/app.js` → `src/main.ts`, `css/styles.css` → `src/styles/main.css` | 30 min | Zero |
| 3 | Extract `P`, `REVIEWS`, `IMG`, `FREE_SHIP` → `src/data/*.json` | 20 min | Low |
| 4 | Add `vite.config.ts` with `build: { minify: 'esbuild' }` | 10 min | Zero |
| 5 | Run `npx vite build` → verify `dist/` matches current behavior | 15 min | Low |
| 6 | Add `.github/workflows/ci.yml` (lint + build) | 20 min | Zero |
| 7 | Create `COMPONENT_CONTRACTS.md` defining each component's API | 1 hr | Zero |

---

## 🎨 DESIGN TOKEN EXTRACTION (From CSS)

```css
/* src/styles/tokens.css */
:root {
  /* Color */
  --color-bg: #0a0e1a;
  --color-bg-elevated: #0d1222;
  --color-panel: #111a2e;
  --color-panel-elevated: #182338;
  --color-gold: #c8a24d;
  --color-gold-light: #ecd9a8;
  --color-gold-deep: #8a6a2f;
  --color-ink: #f3ede1;
  --color-muted: #a3abc0;
  --color-muted-dim: #79829a;
  --color-line: rgba(200,162,77,.18);
  --color-line-strong: rgba(200,162,77,.32);
  --color-error: #a33b3b;
  --color-success: #2e7d32;

  /* Gradient */
  --grad-gold: linear-gradient(135deg, #8a6a2f, #c8a24d 38%, #f2e2b0 62%, #c8a24d);

  /* Typography */
  --font-serif: 'Didot', 'Bodoni MT', 'Playfair Display', 'Cormorant Garamond', Georgia, serif;
  --font-sans: 'Segoe UI', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
  --fs-xs: 0.58rem; --fs-sm: 0.62rem; --fs-base: 0.7rem; --fs-md: 0.86rem;
  --fs-lg: 0.98rem; --fs-xl: 1.02rem; --fs-2xl: 1.14rem; --fs-3xl: 1.32rem;
  --fs-4xl: 1.5rem; --fs-5xl: 1.7rem; --fs-6xl: 2.1rem; --fs-7xl: clamp(2rem,4.4vw,3.3rem);
  --fs-8xl: clamp(3rem,8vw,6.4rem);

  /* Spacing (4px base) */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
  --space-12: 48px; --space-16: 64px; --space-20: 80px; --space-24: 96px;

  /* Radius */
  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px; --radius-full: 999px;

  /* Shadow */
  --shadow-sm: 0 4px 12px rgba(0,0,0,.3);
  --shadow-md: 0 12px 32px rgba(0,0,0,.4);
  --shadow-lg: 0 24px 70px rgba(0,0,0,.55);

  /* Transition */
  --ease: cubic-bezier(.16,1,.3,1);
  --duration-fast: 150ms; --duration-base: 300ms; --duration-slow: 500ms;

  /* Z-index */
  --z-dropdown: 50; --z-sticky: 60; --z-modal: 100; --z-toast: 120;
  --z-cursor: 400; --z-preloader: 500;
}
```

---

## 🧪 TEST STRATEGY

| Layer | Tool | Coverage Target |
|-------|------|-----------------|
| Unit | Vitest | Store, formatters, utils ≥ 80% |
| Component | Vitest + @testing-library/dom | Each component render + interactions |
| E2E | Playwright | Critical paths: cart, checkout, filter, modal |
| Visual | Playwright + pixelmatch | Hero, product cards, modal states |
| A11y | axe-core (CI) | Zero violations AA |

---

## 📦 DEPENDENCY BUDGET (Post-Refactor)

| Category | Current | Target | Notes |
|----------|---------|--------|-------|
| Runtime | 0 | ≤ 5kb gz | `nanostores` (1kb), `zod` (validation, 3kb) |
| Dev | 0 | Standard | Vite, TS, ESLint, Prettier, Vitest, Playwright |
| CSS | 33KB | ≤ 15KB gz | PurgeCSS, critical CSS inlining |

---

## 🔮 FUTURE-PROOFING CHECKLIST

- [ ] **Headless CMS ready** — product data fetched, not bundled
- [ ] **Multi-currency** — price formatting abstracted
- [ ] **Multi-language** — all strings in i18n files
- [ ] **Admin preview** — draft mode via query param
- [ ] **A/B testing hooks** — variant assignment in store
- [ ] **Web Components option** — for embeddable product cards
- [ ] **Server-side rendering** — Astro/Next migration path documented

---

*Generated: 2026-10-15 | Analysis based on current codebase state*