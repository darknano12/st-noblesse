/**
 * st.noblesse — Main Application Bootstrap
 * Maison de Haute Parfumerie
 */

// Styles
import './styles/main.css';

// Core
import { bus } from './core/bus';
import { createCatalog } from './core/catalog-store';
import { createCart } from './core/cart-store';
import { createUi } from './core/ui-store';
import type { AppConfig, FilterFamily, ImageMap, Product, Review } from './core/types';
import { formatPrice } from './utils/format';
import { initLocale, t, getProductDesc, getLanguageSettings, saveLanguageSettings } from './core/i18n';
import { pb } from './services/pocketbase';

// Data
import productsData from './data/products.json';
import reviewsData from './data/reviews.json';
import configData from './data/config.json';
import imagesData from './data/images.json';

// Components
import { initPreloader } from './components/preloader/preloader';
import { initParticles } from './components/particles/particles';
import { initHeader } from './components/header/header';
import { initHero } from './components/hero/hero';
import { initCollections, initCatalog } from './components/catalog/catalog';
import { initReviews } from './components/reviews/reviews';
import { initPrivileges } from './components/privileges/privileges';
import { initNewsletter } from './components/newsletter/newsletter';
import { initToTop } from './components/to-top/to-top';
import { initToast } from './components/toast/toast';
import { initProductModal } from './components/product-modal/product-modal';
import { initCartDrawer } from './components/cart-drawer/cart-drawer';
import { initAuthModal } from './components/auth-modal/auth-modal';
import { initAccountDrawer } from './components/account-drawer/account-drawer';
import { initAdminStudio } from './components/admin-studio/admin-studio';
import { initFooter, initMarquee, initAnchorLinks } from './components/footer/footer';
import { initLangSwitch } from './components/lang-switch/lang-switch';
import { revealOnScroll } from './utils/animation';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize internationalization
  initLocale();
  initLangSwitch();

  /* ------------------------------------------------------------------ */
  /* 1. Core Stores                                                     */
  /* ------------------------------------------------------------------ */
  const initialProducts = pb.getLocalProducts() || (productsData as Product[]);
  const catalog = createCatalog(initialProducts);
  const ui = createUi();

  const cart = createCart({
    resolveProduct: (id) => catalog.byId(id),
    freeShipThreshold: configData.freeShipThreshold,
    storageKey: configData.cartStorageKey,
    formatPrice,
  });

  // Restore cart from localStorage
  cart.hydrate();

  /* ------------------------------------------------------------------ */
  /* 2. Visual & Shell Components                                       */
  /* ------------------------------------------------------------------ */
  initPreloader(configData.preloaderDuration);
  initParticles(configData as AppConfig, ui);
  initHeader(ui);
  initHero(imagesData as ImageMap, ui);
  initCollections(catalog);
  initNewsletter();
  initToTop();
  initToast();
  initMarquee();
  initAnchorLinks();
  revealOnScroll('.reveal', { threshold: 0.1 });

  /* ------------------------------------------------------------------ */
  /* 3. Catalog & Reviews                                               */
  /* ------------------------------------------------------------------ */
  initCatalog(
    catalog,
    imagesData as Record<string, string>,
    formatPrice,
    configData.families
  );

  const initialReviews = pb.getLocalReviews() || (reviewsData as Review[]);
  initReviews(initialReviews, configData.reviewInterval);

  // Asynchronous hydration from PocketBase backend (with graceful offline fallback)
  pb.getProducts().then((liveProducts) => {
    if (liveProducts && liveProducts.length > 0) {
      catalog.setProducts(liveProducts);
    }
  }).catch(() => {});

  pb.getReviews().then((liveReviews) => {
    if (liveReviews && liveReviews.length > 0) {
      initReviews(liveReviews, configData.reviewInterval);
    }
  }).catch(() => {});

  /* ------------------------------------------------------------------ */
  /* 4. Modals & Drawers                                                */
  /* ------------------------------------------------------------------ */
  const modalApi = initProductModal(
    ui,
    (key) => (imagesData as Record<string, string>)[key] || key
  );
  const drawerApi = initCartDrawer(
    cart,
    ui,
    (key) => (imagesData as Record<string, string>)[key] || key,
    configData.families
  );
  const authModalApi = initAuthModal();
  const accountDrawerApi = initAccountDrawer();
  const adminStudioApi = initAdminStudio(catalog, imagesData as Record<string, string>);

  initPrivileges(cart);
  initFooter((fam) => catalog.setFilter(fam as FilterFamily));

  /* ------------------------------------------------------------------ */
  /* 5. Cross-Component Event Wiring via Event Bus                      */
  /* ------------------------------------------------------------------ */

  // Quick view trigger from product cards
  bus.on('grid:quick-view', ({ productId }) => {
    const product = catalog.byId(productId);
    if (product) {
      modalApi.open(product);
    }
  });

  // Pending item memory for seamless auto-fulfillment after registration/login
  let pendingCartItem: { productId: string; volume: import('./core/types').Volume; qty: number } | null = null;

  function handleAddToCart(
    productId: string,
    volume: import('./core/types').Volume,
    qty = 1,
    fromModal = false
  ) {
    if (!pb.getCurrentUser()) {
      pendingCartItem = { productId, volume, qty };
      bus.emit('toast:show', {
        html: t('toast.auth_required_cart'),
        duration: 3500,
      });
      bus.emit('auth:open', { tab: 'register' });
      if (fromModal) {
        modalApi.close();
      }
      return;
    }

    cart.add(productId, volume, qty);
    const p = catalog.byId(productId);
    if (p) {
      bus.emit('toast:show', {
        html: t('toast.added_with_details', { name: p.name, volume }),
      });
    }
    if (fromModal) {
      modalApi.close();
    }
  }

  // Direct add-to-cart from catalog card (defaults to 50ml)
  bus.on('grid:add-to-cart', ({ productId, volume }) => {
    handleAddToCart(productId, volume, 1, false);
  });

  // Add-to-cart from inside the product modal
  bus.on('modal:add-to-cart', ({ productId, volume }) => {
    handleAddToCart(productId, volume, 1, true);
  });

  // Auto-fulfill pending cart item once client signs in / registers
  bus.on('auth:change', ({ user }) => {
    if (user && pendingCartItem) {
      const item = pendingCartItem;
      pendingCartItem = null;
      cart.add(item.productId, item.volume, item.qty);
      const p = catalog.byId(item.productId);
      if (p) {
        bus.emit('toast:show', {
          html: t('toast.added_with_details', { name: p.name, volume: item.volume }),
        });
      }
      drawerApi.open();
    }
  });

  // Open drawer from header cart button
  bus.on('header:cart-click', () => {
    drawerApi.open();
  });

  // Sync drawer state with UI store
  bus.on('drawer:opened', () => {
    ui.openDrawer();
  });

  bus.on('drawer:closed', () => {
    ui.closeDrawer();
  });

  // Close with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modalApi.isOpen()) modalApi.close();
      drawerApi.close();
      accountDrawerApi.close();
      authModalApi.close();
      adminStudioApi.close();
      ui.closeMobileNav();
    }
  });

  // Handle returning from Stripe Checkout session
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('order_status') === 'success') {
    const sessionId = urlParams.get('session_id') || `SN-${Math.floor(1000 + Math.random() * 9000)}`;
    cart.clear();
    drawerApi.open();
    const orderNumEl = document.querySelector<HTMLElement>('#orderNum');
    if (orderNumEl) orderNumEl.textContent = t('cart.order_number', { num: sessionId.slice(0, 12) });
    document.querySelector('#cart')?.classList.add('ok');
    bus.emit('toast:show', {
      html: t('toast.payment_success', { orderId: sessionId.slice(0, 12) }),
    });
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (urlParams.get('order_status') === 'cancelled') {
    bus.emit('toast:show', {
      html: t('toast.checkout_cancelled'),
    });
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Deep linking: open fragrance modal if ?product=slug or #product-slug is in URL
  const initialProductParam = urlParams.get('product') ||
    (window.location.hash.startsWith('#product-') ? window.location.hash.replace('#product-', '') : null);
  if (initialProductParam) {
    const initialProduct = catalog.byId(initialProductParam);
    if (initialProduct) {
      setTimeout(() => modalApi.open(initialProduct), 200);
    }
  }

  bus.on('modal:opened', ({ productId }) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('product', productId);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  });

  bus.on('modal:closed', () => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('product')) {
        url.searchParams.delete('product');
        window.history.replaceState({}, '', url.toString());
      }
    } catch {}
  });

  // Expose for testing, debugging, and admin access
  (window as any).__st = {
    cart,
    catalog,
    ui,
    bus,
    modalApi,
    drawerApi,
    authModalApi,
    accountDrawerApi,
    adminStudioApi,
    pb,
    t,
    i18n: {
      t,
      getProductDesc,
      getLanguageSettings,
      saveLanguageSettings,
    },
  };

  // Notify system that app is booted
  bus.emit('app:ready', undefined);
});
