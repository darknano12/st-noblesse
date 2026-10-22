# ⚜️ st.noblesse — Maison de Haute Parfumerie

> High-end authorial fragrance e-commerce Single Page Application (SPA) crafted with pure **Vanilla TypeScript**, modular CSS architecture, **PocketBase** backend, and **Stripe Checkout**.

---

## 🏛️ Architecture & Principles

- **Zero Heavy Runtime Frameworks:** Pure, typed Vanilla TypeScript with native reactive stores (`createStore`) and decoupled event bus (`EventBus`). Fast 60 FPS animations, sub-50ms Time-to-Interactive, and zero framework overhead.
- **Component-Driven Modular CSS:** Extracted from a monolithic stylesheet into dedicated component modules under `src/components/` and design tokens under `src/styles/`.
- **PocketBase Admin & Database:** Built-in admin panel (`/_/`) allowing non-technical store managers to add perfumes, adjust prices, edit descriptions, view customer reviews, and inspect orders.
- **Stripe Checkout via Server Hooks:** Server-side price calculation directly from PocketBase records to prevent client manipulation, with automatic complimentary shipping thresholds.
- **Extensible i18n:** Reactive internationalization engine supporting **English (EN)**, **French (FR)**, and **Russian (RU)** with automatic language detection, `localStorage` persistence, and instant UI re-rendering.
- **Offline & Dev Resilient:** `PocketBaseService` features seamless fallback to local JSON data (`src/data/products.json`, `src/data/reviews.json`) if the backend server is offline or unreachable.

---

## 📁 Project Structure

```text
st.noblesse/
├── index.html                   # HTML5 Shell with meta tags, links & modal containers
├── dev-server.mjs               # Zero-dependency Node 24 native dev server
├── test-e2e.mjs                 # Headless Chrome CDP E2E verification test
├── AGENTIC_WORKFLOW.md          # Multi-agent architecture and phase roadmap
├── COMPONENT_CONTRACTS.md       # Exact DOM and EventBus contracts
├── pocketbase/
│   ├── pb_schema.json           # PocketBase collections schema (products, reviews, orders)
│   ├── seed.json                # Launch fragrance seed data
│   └── README.md                # PocketBase setup and operations manual
├── pb_hooks/
│   └── stripe.pb.js             # PocketBase JS hooks (POST /api/create-checkout-session)
└── src/
    ├── main.ts                  # Application bootstrap and cross-component event wiring
    ├── core/
    │   ├── bus.ts               # Global EventBus singleton
    │   ├── event-map.ts         # Strongly-typed event contracts
    │   ├── store.ts             # Reactive store primitive
    │   ├── cart-store.ts        # Shopping bag state, quantities & local persistence
    │   ├── catalog-store.ts     # Product filter state and selectors
    │   ├── ui-store.ts          # Drawer, modal, and mobile menu visibility state
    │   ├── i18n.ts              # Reactive multi-language translation engine
    │   └── types.ts             # Domain interfaces (Product, Review, Order, etc.)
    ├── services/
    │   └── pocketbase.ts        # PocketBase REST client with offline fallback
    ├── data/
    │   ├── products.json        # 3 launch fragrances (Azure Épure, Ambre Velours, Oud Serein)
    │   ├── reviews.json         # Customer reviews
    │   ├── config.json          # Free-shipping threshold, particles, durations
    │   ├── images.json          # Asset mappings
    │   └── locales/
    │       ├── en.json          # English dictionary
    │       ├── fr.json          # French dictionary
    │       └── ru.json          # Russian dictionary
    ├── styles/
    │   ├── tokens.css           # Gold palette, typography, easing, shadows
    │   ├── reset.css            # CSS reset, film grain & vignette overlays
    │   ├── globals.css          # Container, buttons, typography, marquee ribbon
    │   └── main.css             # Master stylesheet aggregator
    └── components/
        ├── header/              # Header, crest logo, desktop navigation
        ├── hero/                # Kinetic typography, floating statistics
        ├── catalog/             # Family collections grid and perfume cards
        ├── product-modal/       # Quick View flacon modal with olfactory notes
        ├── cart-drawer/         # Slide-in shopping bag and shipping meter
        ├── lang-switch/         # Desktop & mobile language switcher
        ├── reviews/             # Infinite review carousel with star ratings
        ├── newsletter/          # VIP sanctuary email subscription
        ├── footer/              # Grasse maison details and copyright
        ├── cursor/              # Luxury magnetic gold cursor
        ├── particles/           # Canvas gold dust particles
        ├── preloader/           # Monogram diamond entry loader
        ├── toast/               # Slide-up notification toasts
        └── to-top/              # Floating scroll-to-top button
```

---

## 🚀 Running the Project

### Development Server
Run the zero-dependency dev server (requires Node 22+ or Node 24):
```bash
node dev-server.mjs
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Automated End-to-End Verification
To execute the automated headless Chrome CDP test suite:
```bash
node test-e2e.mjs
```
Verifies design tokens, DOM rendering, language switching (EN → FR → RU), add-to-bag flow, quantity manipulation, and checkout order creation.

---

## 🌐 Launch Fragrances

| Flacon | Family | Notes | 50 ml | 100 ml |
| :--- | :--- | :--- | :--- | :--- |
| **Azure Épure** | Fresh | Bergamot, Neroli, Lemon · Iris, Green Tea · White Musk, Cedar | €89 | €129 |
| **Ambre Velours** | Oriental | Bitter Orange · Amber, Benzoin, Rose · Bourbon Vanilla, Tonka Bean | €99 | €139 |
| **Oud Serein** | Woody | Saffron · Laotian Oud, Cedar · Sandalwood, Vetiver, Grey Amber | €119 | €159 |

---

## 🔒 Security & Payment Handling

1. **Client Price Tampering Defense:** The client passes only `{ productId, volume, qty }` to `/api/create-checkout-session`. The server fetches actual rates directly from PocketBase records and calculates the true charge.
2. **Complimentary Shipping Calculation:** Calculated dynamically on the server: orders over €150 receive free shipping; otherwise a €15 courier rate is applied.
3. **Discreet Storage:** Cart lines are persisted in browser `localStorage` under `st_noblesse_cart_v1` and survive page refreshes.
