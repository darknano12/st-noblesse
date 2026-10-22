import { bus } from '../../core/bus';
import type { Product, Volume } from '../../core/types';
import type { UiApi } from '../../core/ui-store';
import { must } from '../../utils/dom';
import { formatPrice, formatRating, stars } from '../../utils/format';
import { openFocusScope } from '../../utils/a11y';
import { getProductDesc, t } from '../../core/i18n';

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

  /* ---- volume buttons ---- */
  function renderVolumes(): void {
    if (!current) return;
    mdVol.innerHTML = (['50', '100'] as Volume[])
      .map((v) => {
        const active = v === selectedVolume ? ' active' : '';
        return (
          `<button type="button" data-vol="${v}" class="${active}">${v} ml` +
          `<b>${formatPrice(current!.price[v])}</b></button>`
        );
      })
      .join('');
    mdPrice.textContent = formatPrice(current.price[selectedVolume]);
  }

  /* ---- note chips row ---- */
  function row(label: string, notes: string[]): string {
    const chips = notes.map((n) => `<i>${escapeHtml(n)}</i>`).join('');
    return (
      `<div class="row"><span>${label}</span><div class="chips">${chips}</div></div>`
    );
  }

  /* ---- open / close ---- */
  function open(product: Product): void {
    current = product;
    selectedVolume = '100';

    mdImg.src = (product.img && imageSrc(product.img)) || 'img/placeholder.svg';
    mdImg.alt = product.name;
    mdFam.textContent = product.badge
      ? `${product.fam} · ${product.badge}`
      : product.fam;
    mdName.textContent = product.name;
    mdStars.textContent = stars(product.rating);
    mdRev.textContent = t('modal.reviews_count', {
      rating: formatRating(product.rating),
      count: product.rev,
    });
    mdDesc.textContent = getProductDesc(product.desc);
    mdNotes.innerHTML =
      row(t('modal.notes_top'), product.notes.top) +
      row(t('modal.notes_heart'), product.notes.heart) +
      row(t('modal.notes_base'), product.notes.base);

    renderVolumes();

    modal.classList.add('open');
    releaseFocus = openFocusScope(modal);
    ui.openModal(product.id);
    bus.emit('modal:opened', { productId: product.id, product });
  }

  bus.on('i18n:change', () => {
    if (current && modal.classList.contains('open')) {
      mdDesc.textContent = getProductDesc(current.desc);
      mdRev.textContent = t('modal.reviews_count', {
        rating: formatRating(current.rating),
        count: current.rev,
      });
      mdNotes.innerHTML =
        row(t('modal.notes_top'), current.notes.top) +
        row(t('modal.notes_heart'), current.notes.heart) +
        row(t('modal.notes_base'), current.notes.base);
      renderVolumes();
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
    if (!current) return;
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
