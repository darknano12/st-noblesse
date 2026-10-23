import { bus } from '../../core/bus';
import type { CartApi } from '../../core/cart-store';
import type { UiApi } from '../../core/ui-store';
import { must } from '../../utils/dom';
import { formatPrice } from '../../utils/format';
import { announce, openFocusScope } from '../../utils/a11y';
import { scrollToTarget } from '../../utils/animation';
import { pb } from '../../services/pocketbase';
import { getLocalizedText, t } from '../../core/i18n';

/**
 * CartDrawer — slide-in shopping bag.
 *
 * DOM contract (static in HTML):
 *   #overlay      — backdrop (click closes)
 *   #cart         — drawer root (toggles .open, .ok)
 *   #cartClose    — close button
 *   #cartN        — "(3)" count text
 *   #cartItems    — rendered line items
 *   #cartFoot     — totals + checkout (hidden when empty)
 *   #shipTxt      — free-shipping message
 *   #shipBar      — progress bar fill
 *   #cartTotal    — subtotal
 *   #checkout     — checkout button
 *   .order-ok     — success screen (shown when .ok)
 *   #orderNum     — generated order number
 *   #okClose      — "Continue Shopping" button
 *
 * Emits:  drawer:opened, drawer:closed, drawer:checkout, drawer:continue-shopping
 */
export interface CartDrawerApi {
  open(): void;
  close(): void;
}

export function initCartDrawer(
  cart: CartApi,
  ui: UiApi,
  imageSrc: (key: string) => string,
  familyLabel: Record<string, string>
): CartDrawerApi {
  const overlay = must('#overlay');
  const drawer = must('#cart');
  const cartClose = must('#cartClose');
  const cartN = must('#cartN');
  const cartItems = must('#cartItems');
  const cartFoot = must('#cartFoot');
  const shipTxt = must('#shipTxt');
  const shipBar = must('#shipBar');
  const cartTotal = must('#cartTotal');
  const checkoutBtn = must('#checkout');
  const orderNum = must('#orderNum');
  const okClose = must('#okClose');

  const cartPromoBanner = document.getElementById('cartPromoBanner');
  const cartPromoMsg = document.getElementById('cartPromoMsg');
  const cartPromoInput = document.getElementById('cartPromoInput') as HTMLInputElement | null;
  const cartPromoApply = document.getElementById('cartPromoApply');
  const cartPromoInputRow = document.getElementById('cartPromoInputRow');
  const cartPromoActive = document.getElementById('cartPromoActive');
  const cartPromoActiveCode = document.getElementById('cartPromoActiveCode');
  const cartPromoRemove = document.getElementById('cartPromoRemove');
  const cartPromoFeedback = document.getElementById('cartPromoFeedback');

  const cartSubtotalVal = document.getElementById('cartSubtotalVal');
  const cartFreeFlaconRow = document.getElementById('cartFreeFlaconRow');
  const cartFreeFlaconVal = document.getElementById('cartFreeFlaconVal');
  const cartPromoDiscountRow = document.getElementById('cartPromoDiscountRow');
  const cartPromoDiscountLabel = document.getElementById('cartPromoDiscountLabel');
  const cartPromoDiscountVal = document.getElementById('cartPromoDiscountVal');

  let releaseFocus: (() => void) | null = null;

  /* ---- rendering ---- */
  function renderEmpty(): void {
    cartItems.innerHTML =
      `<div class="cart-empty">` +
      `<svg viewBox="0 0 24 24"><path d="M9 6L7.5 3h9L15 6M6 6h12l-1.2 14H7.2L6 6z"/><path d="M10 11v5M14 11v5"/></svg>` +
      `<b>${escapeHtml(t('cart.empty_title'))}</b>` +
      `<span>${escapeHtml(t('cart.empty_subtitle'))}</span>` +
      `<button class="btn btn-ghost" id="goCat" style="margin-top:8px">${escapeHtml(t('cart.explore_collection'))}</button>` +
      `</div>`;
    cartFoot.style.display = 'none';
  }

  function renderLines(): void {
    const snap = cart.snapshot();
    if (snap.lines.length === 0) {
      renderEmpty();
      return;
    }
    cartFoot.style.display = '';

    cartItems.innerHTML = snap.lines
      .map((line) => {
        const img = (line.product.img && imageSrc(line.product.img)) || 'img/placeholder.svg';
        const lineName = getLocalizedText(line.product.name);
        return (
          `<div class="ci">` +
          `<img src="${escapeHtml(img)}" alt="${escapeHtml(lineName)}">` +
          `<div>` +
          `<div class="ci-name">${escapeHtml(lineName)}</div>` +
          `<div class="ci-meta">${familyLabel[line.product.fam] ?? line.product.fam} · ${line.volume} ml</div>` +
          `<div class="qty">` +
          `<button data-k="${escapeHtml(line.key)}" data-d="-1" aria-label="Decrease">−</button>` +
          `<b>${line.qty}</b>` +
          `<button data-k="${escapeHtml(line.key)}" data-d="1" aria-label="Increase">+</button>` +
          `</div></div>` +
          `<div class="ci-right">` +
          `<div class="ci-price">${formatPrice(line.lineTotal)}</div>` +
          `<button class="ci-del" data-k="${escapeHtml(line.key)}" aria-label="Remove">✕</button>` +
          `</div></div>`
        );
      })
      .join('');

    cartTotal.textContent = formatPrice(snap.total);

    if (cartPromoBanner && cartPromoMsg) {
      if (snap.count === 1) {
        cartPromoBanner.style.display = 'flex';
        cartPromoMsg.textContent = t('cart.promo_add_2_more');
      } else if (snap.count === 2) {
        cartPromoBanner.style.display = 'flex';
        cartPromoMsg.textContent = t('cart.promo_add_1_more');
      } else if (snap.freeFlaconsCount > 0) {
        cartPromoBanner.style.display = 'flex';
        cartPromoMsg.textContent = t('cart.promo_applied', { count: snap.freeFlaconsCount });
      } else {
        cartPromoBanner.style.display = 'none';
      }
    }

    if (cartSubtotalVal) {
      cartSubtotalVal.textContent = formatPrice(snap.subtotal);
    }

    if (cartFreeFlaconRow && cartFreeFlaconVal) {
      if (snap.freeFlaconDiscount > 0) {
        cartFreeFlaconRow.style.display = 'flex';
        cartFreeFlaconVal.textContent = `-${formatPrice(snap.freeFlaconDiscount)}`;
      } else {
        cartFreeFlaconRow.style.display = 'none';
      }
    }

    if (cartPromoDiscountRow && cartPromoDiscountVal && cartPromoDiscountLabel) {
      if (snap.promoCode && snap.promoDiscount > 0) {
        cartPromoDiscountRow.style.display = 'flex';
        cartPromoDiscountLabel.textContent = `${snap.promoCode} (${t('cart.privilege_code')})`;
        cartPromoDiscountVal.textContent = `-${formatPrice(snap.promoDiscount)}`;
      } else {
        cartPromoDiscountRow.style.display = 'none';
      }
    }

    if (cartPromoInputRow && cartPromoActive && cartPromoActiveCode) {
      if (snap.promoCode) {
        cartPromoInputRow.style.display = 'none';
        cartPromoActive.style.display = 'inline-flex';
        cartPromoActiveCode.textContent = `✦ ${snap.promoCode}`;
      } else {
        cartPromoInputRow.style.display = 'flex';
        cartPromoActive.style.display = 'none';
      }
    }

    shipTxt.innerHTML = snap.freeShipUnlocked
      ? `<b>${t('cart.shipping_free')}</b>`
      : t('cart.shipping_progress', { amount: formatPrice(snap.shipRemaining) });
    shipBar.style.width = `${snap.shipProgress}%`;
  }

  function renderHeader(): void {
    const snap = cart.snapshot();
    cartN.textContent = snap.count > 0 ? `(${snap.count})` : '';
  }

  /* ---- open / close ---- */
  function open(): void {
    renderLines();
    renderHeader();
    drawer.classList.add('open');
    overlay.classList.add('show');
    releaseFocus = openFocusScope(drawer);
    ui.openDrawer();
    bus.emit('drawer:opened', undefined);
  }

  function close(): void {
    if (!drawer.classList.contains('open')) return;
    drawer.classList.remove('open');
    drawer.classList.remove('ok');
    overlay.classList.remove('show');
    releaseFocus?.();
    releaseFocus = null;
    ui.closeDrawer();
    bus.emit('drawer:closed', undefined);
  }

  /* ---- line item interactions ---- */
  cartItems.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    const qtyBtn = target.closest<HTMLElement>('[data-d]');
    if (qtyBtn) {
      const key = qtyBtn.dataset.k as `${string}::${'50' | '100'}`;
      const delta = Number(qtyBtn.dataset.d);
      const currentQty = cart.store.value[key] ?? 0;
      cart.setQty(key, currentQty + delta);
      return;
    }

    const delBtn = target.closest<HTMLElement>('.ci-del');
    if (delBtn) {
      const key = delBtn.dataset.k as `${string}::${'50' | '100'}`;
      cart.remove(key);
      announce(t('toast.item_removed'));
      return;
    }

    if (target.closest('#goCat')) {
      close();
      scrollToTarget('#catalog');
    }
  });

  /* ---- promo code interactions ---- */
  function handleApplyPromo(): void {
    if (!cartPromoInput) return;
    const code = cartPromoInput.value.trim();
    if (!code) return;
    const res = cart.applyPromo(code);
    if (res.ok) {
      if (cartPromoFeedback) {
        cartPromoFeedback.className = 'cart-promo-feedback success';
        cartPromoFeedback.textContent = t('cart.promo_applied_success', {
          code: code.toUpperCase(),
          percent: res.discountPercent ?? 15,
        });
        setTimeout(() => {
          if (cartPromoFeedback) cartPromoFeedback.textContent = '';
        }, 3500);
      }
      cartPromoInput.value = '';
    } else {
      if (cartPromoFeedback) {
        cartPromoFeedback.className = 'cart-promo-feedback error';
        cartPromoFeedback.textContent = t('cart.promo_invalid');
        setTimeout(() => {
          if (cartPromoFeedback) cartPromoFeedback.textContent = '';
        }, 3500);
      }
    }
  }

  cartPromoApply?.addEventListener('click', handleApplyPromo);
  cartPromoInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApplyPromo();
    }
  });

  cartPromoRemove?.addEventListener('click', () => {
    cart.removePromo();
    if (cartPromoFeedback) cartPromoFeedback.textContent = '';
  });

  /* ---- checkout ---- */
  checkoutBtn.addEventListener('click', async () => {
    const snap = cart.snapshot();
    if (snap.count === 0) return;

    if (!pb.getCurrentUser()) {
      bus.emit('toast:show', {
        html: t('toast.auth_required_checkout'),
        duration: 3500,
      });
      bus.emit('auth:open', { tab: 'register' });
      return;
    }

    const originalText = checkoutBtn.textContent;
    checkoutBtn.setAttribute('disabled', 'true');
    checkoutBtn.textContent = t('cart.preparing');

    try {
      const payload = snap.lines.map((l) => ({
        productId: l.product.id,
        volume: l.volume,
        qty: l.qty,
      }));

      const res = await pb.createCheckout(payload, snap.promoCode);

      // If redirected to Stripe hosted checkout
      if (res.checkoutUrl && !res.mock && res.checkoutUrl.includes('stripe.com')) {
        window.location.href = res.checkoutUrl;
        return;
      }

      // Local mock or completion
      const num = res.sessionId
        ? `SN-${res.sessionId.slice(-6).toUpperCase()}`
        : `SN-${Math.floor(1000 + Math.random() * 9000)}`;
      orderNum.textContent = t('cart.order_number', { num });
      cart.clear();
      drawer.classList.add('ok');
      bus.emit('cart:checkout', { orderNumber: num });
    } catch (err: any) {
      console.error('Checkout error:', err);
      bus.emit('toast:show', {
        html: `<b>Error:</b> ${escapeHtml(err?.message || t('common.error'))}`,
        duration: 3500,
      });
    } finally {
      checkoutBtn.removeAttribute('disabled');
      checkoutBtn.textContent = originalText;
    }
  });

  /* ---- close triggers ---- */
  cartClose.addEventListener('click', close);
  okClose.addEventListener('click', close);
  overlay.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) close();
  });

  /* ---- reactive re-render ---- */
  cart.store.subscribe(() => {
    renderHeader();
    if (drawer.classList.contains('open')) renderLines();
  });

  bus.on('cart:changed', () => {
    renderHeader();
    if (drawer.classList.contains('open')) renderLines();
  });

  bus.on('i18n:change', () => {
    renderHeader();
    if (drawer.classList.contains('open')) renderLines();
  });

  /* ---- header cart button ---- */
  bus.on('header:cart-click', open);

  /* ---- initial paint ---- */
  renderHeader();
  renderLines();

  return { open, close };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
