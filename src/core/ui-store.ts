import { createStore, type Store } from './store';

/**
 * Global UI state — modals, drawers, flags.
 * Kept separate from domain stores so visual state never leaks into business logic.
 */
export interface UiState {
  /** Product modal open with which product */
  modal: { open: boolean; productId: string | null };
  /** Cart drawer open */
  drawer: boolean;
  /** Mobile nav open */
  mobileNav: boolean;
  /** Header scrolled past threshold */
  headerScrolled: boolean;
  /** Back-to-top visible */
  toTopVisible: boolean;
  /** Preloader finished */
  preloaderDone: boolean;
  /** User prefers reduced motion */
  reducedMotion: boolean;
  /** Fine pointer (real mouse) available */
  finePointer: boolean;
}

export interface UiApi {
  store: Store<UiState>;
  openModal(productId: string): void;
  closeModal(): void;
  openDrawer(): void;
  closeDrawer(): void;
  toggleMobileNav(force?: boolean): void;
  closeMobileNav(): void;
  setHeaderScrolled(v: boolean): void;
  setToTopVisible(v: boolean): void;
  markPreloaderDone(): void;
}

export function createUi(): UiApi {
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const finePointer =
    typeof window !== 'undefined' &&
    window.matchMedia('(pointer: fine)').matches;

  const store = createStore<UiState>({
    modal: { open: false, productId: null },
    drawer: false,
    mobileNav: false,
    headerScrolled: false,
    toTopVisible: false,
    preloaderDone: false,
    reducedMotion,
    finePointer,
  });

  const patch = (partial: Partial<UiState>): void => {
    store.set({ ...store.value, ...partial });
  };

  return {
    store,

    openModal(productId: string): void {
      patch({ modal: { open: true, productId } });
      document.body.style.overflow = 'hidden';
    },

    closeModal(): void {
      if (!store.value.modal.open) return;
      patch({ modal: { open: false, productId: null } });
      document.body.style.overflow = '';
    },

    openDrawer(): void {
      patch({ drawer: true });
      document.body.style.overflow = 'hidden';
    },

    closeDrawer(): void {
      patch({ drawer: false });
      document.body.style.overflow = '';
    },

    toggleMobileNav(force?: boolean): void {
      const next = force ?? !store.value.mobileNav;
      patch({ mobileNav: next });
      document.body.style.overflow = next ? 'hidden' : '';
    },

    closeMobileNav(): void {
      if (!store.value.mobileNav) return;
      patch({ mobileNav: false });
      document.body.style.overflow = '';
    },

    setHeaderScrolled(v: boolean): void {
      if (store.value.headerScrolled !== v) patch({ headerScrolled: v });
    },

    setToTopVisible(v: boolean): void {
      if (store.value.toTopVisible !== v) patch({ toTopVisible: v });
    },

    markPreloaderDone(): void {
      patch({ preloaderDone: true });
    },
  };
}
