import { bus } from '../../core/bus';
import type { Product, Volume } from '../../core/types';
import type { UiApi } from '../../core/ui-store';
import { must } from '../../utils/dom';
import { formatPrice, formatRating, stars } from '../../utils/format';
import { openFocusScope } from '../../utils/a11y';
import { getLocalizedText, getProductDesc, t } from '../../core/i18n';

/**
 * ProductModal — quick-view dialog for a single product.
 *
 * Returns { open, close } so main.ts controls display with a resolved Product.
 *
 * DOM contract (static in HTML):
 *   #modal, .md-panel, #mdClose, #mdImg, #mdFam, #mdName,
 *   #mdStars, #mdRev, #mdDesc, #mdNotes, #mdVol, #mdPrice, #mdAdd
 *
 * Emits:  modal:opened, modal:closed, modal:add-to-cart, modal:volume-changed
 */
export interface ProductModalApi {
  open(product: Product): void;
  close(): void;
  isOpen(): boolean;
}

export function initProductModal(
  ui: UiApi,
  imageResolver?: (key: string) => string
): ProductModalApi {
  const modal = must('#modal');
  const mdImg = must<HTMLImageElement>('#mdImg');
  const mdFam = must('#mdFam');
  const mdName = must('#mdName');
  const mdStars = must('#mdStars');
  const mdRev = must('#mdRev');
  const mdDesc = must('#mdDesc');
  const mdNotes = must('#mdNotes');
  const mdVol = must('#mdVol');
  const mdPrice = must('#mdPrice');
  const mdAdd = must('#mdAdd');
  const mdClose = must('#mdClose');

  let current: Product | null = null;
  let selectedVolume: Volume = '100';
  let releaseFocus: (() => void) | null = null;
  /** Resolver injected by main.ts so modal can prefix image paths */
  const imageSrc: (key: string) => string = imageResolver || ((k) => k);

  function getEffectivePrice(p: Product, vol: Volume): number {
    if (p.discountPercent && p.discountPercent > 0) {
      return Math.round(p.price[vol] * (1 - p.discountPercent / 100));
    }
    return p.price[vol];
  }

  /* ---- volume buttons ---- */
  function renderVolumes(): void {
    if (!current) return;
    mdVol.innerHTML = (['50', '100'] as Volume[])
      .map((v) => {
        const active = v === selectedVolume ? ' active' : '';
        const eff = getEffectivePrice(current!, v);
        const hasDiscount = eff < current!.price[v];
        return (
          `<button type="button" data-vol="${v}" class="${active}">${v} ml` +
          `<b>${formatPrice(eff)}</b>` +
          (hasDiscount ? `<s style="opacity:0.5;font-size:0.75em;margin-left:4px;color:var(--muted2)">${formatPrice(current!.price[v])}</s>` : '') +
          `</button>`
        );
      })
      .join('');

    const effSelected = getEffectivePrice(current, selectedVolume);
    if (effSelected < current.price[selectedVolume]) {
      mdPrice.innerHTML = `<b>${formatPrice(effSelected)}</b> <s style="opacity:0.5;font-size:0.75em;margin-left:6px;font-weight:normal;color:var(--muted2);">${formatPrice(current.price[selectedVolume])}</s>`;
    } else {
      mdPrice.textContent = formatPrice(effSelected);
    }
  }

  /* ---- note chips row ---- */
  function row(label: string, notes: string[]): string {
    const chips = notes.map((n) => `<i>${escapeHtml(n)}</i>`).join('');
    return (
      `<div class="row"><span>${label}</span><div class="chips">${chips}</div></div>`
    );
  }

  function updateModalDetails(product: Product): void {
    const localizedName = getLocalizedText(product.name);
    const localizedBadge = getLocalizedText(product.badge);
    const localizedDiscountLabel = getLocalizedText(product.discountLabel);
    const saleTag = localizedDiscountLabel
      ? `${localizedDiscountLabel}${product.discountPercent ? ` -${product.discountPercent}%` : ''}`
      : (product.discountPercent ? `-${product.discountPercent}%` : '');

    const localizedFamKey = `catalog.filter_${product.fam}`;
    const famText = t(localizedFamKey) !== localizedFamKey ? t(localizedFamKey) : product.fam;
    const isSoldOut = product.inStock === false;
    const soldOutText = t('catalog.out_of_stock') || 'Out of Stock';

    const metaParts = [famText, localizedBadge, saleTag, isSoldOut ? soldOutText : ''].filter(Boolean);
    mdFam.textContent = metaParts.join(' · ');
    mdName.textContent = localizedName;
    mdImg.alt = localizedName;
    mdDesc.textContent = getProductDesc(product.desc);
    mdRev.textContent = t('modal.reviews_count', {
      rating: formatRating(product.rating),
      count: product.rev,
    });
    mdNotes.innerHTML =
      row(t('modal.notes_top'), product.notes.top) +
      row(t('modal.notes_heart'), product.notes.heart) +
      row(t('modal.notes_base'), product.notes.base);
    renderVolumes();

    if (isSoldOut) {
      mdAdd.disabled = true;
      mdAdd.textContent = soldOutText;
      mdAdd.classList.add('btn-soldout');
    } else {
      mdAdd.disabled = false;
      mdAdd.textContent = t('modal.add_to_bag') || 'Add to Bag';
      mdAdd.classList.remove('btn-soldout');
    }
  }

  /* ---- open / close ---- */
  function open(product: Product): void {
    current = product;
    selectedVolume = '100';

    mdImg.src = (product.img && imageSrc(product.img)) || 'img/placeholder.svg';
    mdStars.textContent = stars(product.rating);
    updateModalDetails(product);

    modal.classList.add('open');
    releaseFocus = openFocusScope(modal);
    ui.openModal(product.id);
    bus.emit('modal:opened', { productId: product.id, product });
  }

  bus.on('i18n:change', () => {
    if (current && modal.classList.contains('open')) {
      updateModalDetails(current);
    }
  });

  function close(): void {
    if (!modal.classList.contains('open')) return;
    modal.classList.remove('open');
    releaseFocus?.();
    releaseFocus = null;
    ui.closeModal();
    bus.emit('modal:closed', undefined);
  }

  /* ---- DOM wiring ---- */
  mdClose.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  mdVol.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-vol]');
    if (!btn) return;
    selectedVolume = btn.dataset.vol as Volume;
    renderVolumes();
    bus.emit('modal:volume-changed', { volume: selectedVolume });
  });

  mdAdd.addEventListener('click', () => {
    if (!current || current.inStock === false) return;
    bus.emit('modal:add-to-cart', {
      productId: current.id,
      volume: selectedVolume,
    });
    close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  return {
    open,
    close,
    isOpen: () => modal.classList.contains('open'),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
