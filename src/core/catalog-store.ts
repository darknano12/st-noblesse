import { bus } from './bus';
import { createStore, type Store } from './store';
import type { FilterFamily, Product } from './types';

/**
 * Catalog store — holds the full product list and current family filter.
 * Products are injected once (from JSON / CMS); the filter is user-driven.
 */
export interface CatalogApi {
  /** Raw filter value */
  filter: Store<FilterFamily>;
  /** Full, unfiltered product list */
  all(): Product[];
  /** Currently visible products */
  visible(): Product[];
  /** Change the active family filter */
  setFilter(fam: FilterFamily): void;
  /** Look up a product by id */
  byId(id: string): Product | undefined;
  /** Replace the catalog (CMS / hot reload) */
  setProducts(products: Product[]): void;
}

export function createCatalog(products: Product[]): CatalogApi {
  const filter = createStore<FilterFamily>('all');
  let list: Product[] = [...products];

  function visible(): Product[] {
    const fam = filter.value;
    return fam === 'all' ? list : list.filter((p) => p.fam === fam);
  }

  function setFilter(fam: FilterFamily): void {
    if (filter.value === fam) return;
    filter.set(fam);
    bus.emit('filter:changed', fam);
  }

  function byId(id: string): Product | undefined {
    return list.find((p) => p.id === id);
  }

  function setProducts(next: Product[]): void {
    list = [...next];
    // Re-broadcast so grid re-renders with new data
    bus.emit('filter:changed', filter.value);
    bus.emit('catalog:updated', { products: list });
  }

  return {
    filter,
    all: () => list,
    visible,
    setFilter,
    byId,
    setProducts,
  };
}
