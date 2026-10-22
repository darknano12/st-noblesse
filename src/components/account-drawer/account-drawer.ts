import { bus } from '../../core/bus';
import { pb } from '../../services/pocketbase';
import { t } from '../../core/i18n';
import { formatPrice } from '../../utils/format';
import { escapeHtml, must } from '../../utils/dom';

export interface AccountDrawerApi {
  open(): void;
  close(): void;
}

export function initAccountDrawer(): AccountDrawerApi {
  const drawer = must('#accountDrawer');
  const overlay = must('#accountOverlay');
  const closeBtn = must('#accountClose');
  const userNameEl = must('#accountUserName');
  const userEmailEl = must('#accountUserEmail');
  const logoutBtn = must('#accountLogout');
  const ordersListEl = must('#accountOrdersList');
  const adminBtn = must('#accountAdminBtn');

  function open() {
    renderUser();
    loadOrders();
    drawer.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function renderUser() {
    const user = pb.getCurrentUser();
    if (!user) {
      close();
      return;
    }

    userNameEl.textContent = user.name || user.email.split('@')[0];
    userEmailEl.textContent = user.email;

    if (user.isAdmin) {
      adminBtn.style.display = 'block';
    } else {
      adminBtn.style.display = 'none';
    }
  }

  async function loadOrders() {
    ordersListEl.innerHTML = `<div class="orders-loading">${t('common.loading')}</div>`;
    const orders = await pb.getUserOrders();

    if (!orders || orders.length === 0) {
      ordersListEl.innerHTML = `
        <div class="orders-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
            <path d="M6 8h12l-1 13H7L6 8z"/>
            <path d="M9 8V6a3 3 0 016 0v2"/>
          </svg>
          <b>${t('account.no_orders')}</b>
          <p>${t('account.no_orders_sub')}</p>
        </div>
      `;
      return;
    }

    ordersListEl.innerHTML = orders.map((o) => {
      const dateStr = new Date(o.created).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      const orderRef = (o.stripe_session_id || o.id || 'SN-ORDER').slice(-8).toUpperCase();

      const itemsHtml = o.items.map((it) => `
        <div class="order-item-line">
          <span>${escapeHtml(it.name || it.productId || 'Fragrance')} (${escapeHtml(String(it.volume))}ml)</span>
          <b>× ${Number(it.qty) || 1}</b>
        </div>
      `).join('');

      return `
        <div class="order-card">
          <div class="order-card-head">
            <div>
              <span class="order-num">${escapeHtml(t('account.order_number'))} ${orderRef}</span>
              <small class="order-date">${escapeHtml(dateStr)}</small>
            </div>
            <span class="order-status status-${escapeHtml(o.status || 'paid')}">${escapeHtml((o.status || 'PAID').toUpperCase())}</span>
          </div>
          <div class="order-items-box">
            ${itemsHtml}
          </div>
          <div class="order-card-foot">
            <span>${escapeHtml(t('account.order_total'))}</span>
            <b>${formatPrice(o.total)}</b>
          </div>
        </div>
      `;
    }).join('');
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', close);

  logoutBtn.addEventListener('click', () => {
    pb.logout();
    bus.emit('auth:change', { user: null });
    bus.emit('toast:show', { html: 'You have signed out of your account.' });
    close();
  });

  adminBtn.addEventListener('click', () => {
    close();
    bus.emit('admin:open', undefined);
  });

  bus.on('account:open', () => open());

  return { open, close };
}
