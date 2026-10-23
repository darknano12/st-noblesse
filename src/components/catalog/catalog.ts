import type { AppConfig, Family, Product } from '../../core/types';
import { bus } from '../../core/bus';
import type { CatalogApi } from '../../core/catalog-store';
import { delegate, must, qs } from '../../utils/dom';
import { scrollToTarget } from '../../utils/animation';
import type { FilterFamily } from '../../core/types';
import { getLocalizedText, t } from '../../core/i18n';

/**
 * Collections — "Les Familles" section with 4 family cards.
 *
 * DOM contract (static in HTML):
 *   #collections          — root
 *   .col-card[data-fam]   — family card (floral/oriental/woody/fresh)
 *
 * Emits:  collections:family-click  → sets catalog filter + scrolls to #catalog
 */
export function initCollections(catalog: CatalogApi): void {
  const root = must('#collections');

  delegate(root, 'click', '.col-card', (_e, el) => {
    const fam = (el as HTMLElement).dataset.fam as Family | undefined;
    if (!fam) return;
    bus.emit('collections:family-click', { family: fam });
    catalog.setFilter(fam);
    scrollToTarget('#catalog');
  });
}

/**
 * Catalog — filters + product grid.
 *
 * DOM contract:
 *   #filters              — filter pills container
 *   .pill[data-fam]       — one pill per family (+ 'all')
 *   #grid                 — rendered product cards go here
 *
 * Card markup produced by renderCard():
 *   .pc.pc-out[data-id]   — card root (gets .in via IntersectionObserver)
 *   [data-view]           — quick-view trigger
 *   [data-add]            — add-to-cart trigger (adds 50ml)
 *
 * Emits:  grid:quick-view, grid:add-to-cart, filter:changed
 */
export function initCatalog(
  catalog: CatalogApi,
  images: Record<string, string>,
  formatPrice: (n: number) => string,
  familyLabel: Record<string, string>
): void {
  const grid = must('#grid');
  const filters = must('#filters');

  /* ---- reveal observer for cards ---- */
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    },
    { threshold: 0.12 }
  );

  /* ---- card template ---- */
  function noteLine(p: Product): string {
    return [p.notes.top[0], p.notes.top[1], p.notes.heart[0]]
      .filter(Boolean)
      .join(' · ');
  }

  function renderCard(p: Product, index: number): string {
    const delay = (index % 4) * 80;
    const img = (p.img && (images[p.img] || p.img)) || images['placeholder'] || 'img/placeholder.svg';
    const localizedFamKey = `catalog.filter_${p.fam}`;
    const famText = t(localizedFamKey) !== localizedFamKey ? t(localizedFamKey) : (familyLabel[p.fam] ?? p.fam);
    const fromText = t('catalog.from');
    const qvText = t('catalog.quick_view');
    const addLabel = t('catalog.add_to_bag');

    const effectivePrice50 = p.discountPercent && p.discountPercent > 0
      ? Math.round(p.price['50'] * (1 - p.discountPercent / 100))
      : p.price['50'];
    const hasDiscount = effectivePrice50 < p.price['50'];

    const localizedName = getLocalizedText(p.name);
    const localizedBadge = getLocalizedText(p.badge);
    const localizedDiscountLabel = getLocalizedText(p.discountLabel);

    let goldBadgeHtml = '';
    if (localizedBadge) {
      goldBadgeHtml = `<span class="badge">${escapeHtml(localizedBadge)}</span>`;
    }

    let saleBadgeHtml = '';
    if (localizedDiscountLabel || (p.discountPercent && p.discountPercent > 0)) {
      const saleText = localizedDiscountLabel
        ? `${localizedDiscountLabel}${p.discountPercent ? ` -${p.discountPercent}%` : ''}`
        : `-${p.discountPercent}%`;
      saleBadgeHtml = `<span class="badge badge-sale">${escapeHtml(saleText)}</span>`;
    }

    let badgesHtml = '';
    if (goldBadgeHtml || saleBadgeHtml) {
      badgesHtml = `<div class="pc-badges">${goldBadgeHtml}${saleBadgeHtml}</div>`;
    }

    let priceHtml = '';
    if (hasDiscount) {
      priceHtml = `<span class="pc-price">${escapeHtml(fromText)} <b>${formatPrice(effectivePrice50)}</b> <s class="old-price">${formatPrice(p.price['50'])}</s></span>`;
    } else {
      priceHtml = `<span class="pc-price">${escapeHtml(fromText)} ${formatPrice(p.price['50'])}</span>`;
    }

    return (
      `<article class="pc pc-out" data-id="${escapeHtml(p.id)}" style="transition-delay:${delay}ms">` +
      `<div class="pc-media" data-view>` +
      badgesHtml +
      `<img src="${escapeHtml(img)}" alt="${escapeHtml(localizedName)}" loading="lazy">` +
      `<button class="qv" type="button">${escapeHtml(qvText)}</button>` +
      `</div>` +
      `<div class="pc-body">` +
      `<span class="pc-fam">${escapeHtml(famText)} · ${escapeHtml(p.gender)}</span>` +
      `<h3 class="pc-name">${escapeHtml(localizedName)}</h3>` +
      `<p class="pc-notes">${escapeHtml(noteLine(p))}</p>` +
      `<div class="pc-row">${priceHtml}` +
      `<button class="pc-add" type="button" data-add aria-label="${escapeHtml(addLabel)}">` +
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 5v14M5 12h14"/></svg>` +
      `</button></div></div></article>`
    );
  }

  /* ---- render ---- */
  function render(): void {
    const list = catalog.visible();
    grid.innerHTML = list.map(renderCard).join('');
    grid.querySelectorAll<HTMLElement>('.pc-out').forEach((el) => io.observe(el));
  }

  /* ---- pill state ---- */
  function syncPills(fam: FilterFamily): void {
    filters.querySelectorAll<HTMLElement>('.pill').forEach((b) => {
      b.classList.toggle('active', b.dataset.fam === fam);
    });
  }

  /* ---- events ---- */
  filters.addEventListener('click', (e) => {
    const pill = (e.target as HTMLElement).closest<HTMLElement>('.pill');
    if (!pill) return;
    const fam = pill.dataset.fam as FilterFamily | undefined;
    if (fam) catalog.setFilter(fam);
  });

  grid.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const card = target.closest<HTMLElement>('.pc');
    if (!card) return;
    const id = card.dataset.id;
    if (!id) return;

    if (target.closest('[data-add]')) {
      bus.emit('grid:add-to-cart', { productId: id, volume: '50' });
      return;
    }
    if (target.closest('[data-view]')) {
      bus.emit('grid:quick-view', { productId: id });
    }
  });

  catalog.filter.subscribe((fam) => {
    syncPills(fam);
    render();
  });

  bus.on('filter:changed', (fam) => {
    syncPills(fam);
    render();
  });

  bus.on('catalog:updated', () => {
    render();
  });

  bus.on('i18n:change', () => {
    render();
  });

  // Initial paint
  syncPills('all');
  render();
}

/** Local HTML escape (kept here to avoid a util import cycle) */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
