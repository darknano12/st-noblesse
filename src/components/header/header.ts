import { bus } from '../../core/bus';
import type { UiApi } from '../../core/ui-store';
import { delegate, must } from '../../utils/dom';
import { scrollToTarget } from '../../utils/animation';
import { pb } from '../../services/pocketbase';

/**
 * Header — fixed top bar with logo, desktop nav, cart button, user account button, burger.
 *
 * DOM contract:
 *   #header            — root (toggles .scrolled)
 *   .logo              — home link
 *   nav.desk a         — desktop nav
 *   #cartBtn           — cart trigger
 *   #cartCount         — badge
 *   #userBtn           — user profile / auth modal trigger
 *   #burger            — mobile menu trigger (toggles .open)
 *   #mnav              — mobile overlay (toggles .open)
 *
 * Emits:  header:cart-click, header:menu-toggle, nav:link-click, auth:open, account:open
 */
export function initHeader(ui: UiApi): void {
  const header = must('#header');
  const burger = must('#burger');
  const mnav = must('#mnav');
  const cartBtn = must('#cartBtn');
  const cartCount = must('#cartCount');
  const userBtn = document.querySelector<HTMLButtonElement>('#userBtn');

  /* ---- scroll state ---- */
  let ticking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        ui.setHeaderScrolled(y > 30);
        ui.setToTopVisible(y > 650);
        header.classList.toggle('scrolled', ui.store.value.headerScrolled);
        ticking = false;
      });
    },
    { passive: true }
  );

  /* ---- user / auth state ---- */
  function syncUserState() {
    const user = pb.getCurrentUser();
    if (userBtn) {
      userBtn.classList.toggle('has-user', Boolean(user));
      userBtn.setAttribute('title', user ? (user.isAdmin ? `Atelier Studio (${user.name})` : `Sanctuaire Privé (${user.name || user.email})`) : 'Sign In / Register');
    }
  }

  syncUserState();

  bus.on('auth:change', () => {
    syncUserState();
  });

  if (userBtn) {
    userBtn.addEventListener('click', () => {
      const user = pb.getCurrentUser();
      if (user) {
        bus.emit('account:open', undefined);
      } else {
        bus.emit('auth:open', undefined);
      }
    });
  }

  /* ---- cart badge ---- */
  bus.on('cart:changed', (snapshot) => {
    const n = snapshot.count;
    cartCount.textContent = String(n);
    cartCount.classList.toggle('on', n > 0);
  });

  /* ---- cart button ---- */
  cartBtn.addEventListener('click', () => {
    bus.emit('header:cart-click', undefined);
  });

  /* ---- burger ---- */
  burger.addEventListener('click', () => {
    ui.toggleMobileNav();
    burger.classList.toggle('open', ui.store.value.mobileNav);
    mnav.classList.toggle('open', ui.store.value.mobileNav);
    bus.emit('header:menu-toggle', { open: ui.store.value.mobileNav });
  });

  /* ---- mobile nav links ---- */
  delegate(mnav, 'click', 'a', (e, el) => {
    const href = (el as HTMLAnchorElement).getAttribute('href') ?? '';
    ui.closeMobileNav();
    burger.classList.remove('open');
    mnav.classList.remove('open');
    if (href === '#account') {
      e.preventDefault();
      const user = pb.getCurrentUser();
      if (user) {
        bus.emit('account:open', undefined);
      } else {
        bus.emit('auth:open', undefined);
      }
      return;
    }
    if (href.startsWith('#')) {
      e.preventDefault();
      scrollToTarget(href);
    }
    bus.emit('nav:link-click', { href });
  });

  /* ---- desktop nav + logo ---- */
  delegate(header, 'click', 'nav.desk a', (e, el) => {
    const href = (el as HTMLAnchorElement).getAttribute('href') ?? '';
    if (href.startsWith('#')) {
      e.preventDefault();
      scrollToTarget(href);
    }
    bus.emit('nav:link-click', { href });
  });

  delegate(header, 'click', '.logo', (e) => {
    e.preventDefault();
    scrollToTarget('#hero');
  });

  /* ---- escape key: close nav ---- */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (ui.store.value.mobileNav) {
      ui.closeMobileNav();
      burger.classList.remove('open');
      mnav.classList.remove('open');
    }
  });
}
