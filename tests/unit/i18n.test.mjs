import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage and document for Node testing environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    documentElement: {
      setAttribute: () => {},
      getAttribute: () => 'en',
    },
  };
}

import { getLocale, setLocale, t, initLocale } from '../../src/core/i18n.ts';

test('i18n returns English translations by default', () => {
  setLocale('en');
  assert.equal(getLocale(), 'en');
  assert.equal(t('nav.families'), 'The Families');
  assert.equal(t('cart.checkout_btn'), 'Proceed to Checkout');
  assert.equal(t('catalog.add_to_bag'), 'Add to Bag');
});

test('i18n switches to French correctly', () => {
  setLocale('fr');
  assert.equal(getLocale(), 'fr');
  assert.equal(t('nav.families'), 'Les Familles');
  assert.equal(t('cart.checkout_btn'), 'Procéder au Paiement');
  assert.equal(t('catalog.add_to_bag'), 'Ajouter au Panier');
});

test('i18n switches to German correctly', () => {
  setLocale('de');
  assert.equal(getLocale(), 'de');
  assert.equal(t('nav.families'), 'Die Duftfamilien');
  assert.equal(t('cart.checkout_btn'), 'Zur Kasse');
  assert.equal(t('catalog.add_to_bag'), 'In den Warenkorb');
});

test('i18n switches to Spanish correctly', () => {
  setLocale('es');
  assert.equal(getLocale(), 'es');
  assert.equal(t('nav.families'), 'Las Familias');
  assert.equal(t('cart.checkout_btn'), 'Tramitar Pedido');
  assert.equal(t('catalog.add_to_bag'), 'Añadir a la Cesta');
});

test('i18n switches to Notre Succès languages (nl, it, nb, sv, da) correctly', () => {
  setLocale('nl');
  assert.equal(getLocale(), 'nl');
  assert.equal(t('nav.families'), 'De Geurfamilies');
  assert.equal(t('cart.checkout_btn'), 'Afrekenen');

  setLocale('it');
  assert.equal(getLocale(), 'it');
  assert.equal(t('nav.families'), 'Le Famiglie');
  assert.equal(t('cart.checkout_btn'), 'Procedi all\'Acquisto');

  setLocale('nb');
  assert.equal(getLocale(), 'nb');
  assert.equal(t('nav.families'), 'Duftfamiliene');
  assert.equal(t('cart.checkout_btn'), 'Gå til Kassen');

  setLocale('sv');
  assert.equal(getLocale(), 'sv');
  assert.equal(t('nav.families'), 'Doftfamiljerna');
  assert.equal(t('cart.checkout_btn'), 'Till Kassan');

  setLocale('da');
  assert.equal(getLocale(), 'da');
  assert.equal(t('nav.families'), 'Duftfamilierne');
  assert.equal(t('cart.checkout_btn'), 'Gå til Kassen');
});

test('i18n supports parameter interpolation', () => {
  setLocale('en');
  const interpolated = t('cart.shipping_progress', { amount: '€61' });
  assert.equal(interpolated, '€61 away from complimentary DHL shipping');

  setLocale('fr');
  const frInterpolated = t('cart.shipping_progress', { amount: '€61' });
  assert.equal(frInterpolated, 'Plus que €61 pour la livraison DHL offerte');

  setLocale('de');
  const deInterpolated = t('cart.shipping_progress', { amount: '61 €' });
  assert.equal(deInterpolated, 'Noch 61 € bis zum kostenfreien DHL-Versand');

  setLocale('es');
  const esInterpolated = t('cart.shipping_progress', { amount: '61 €' });
  assert.equal(esInterpolated, 'Añada 61 € más para envío gratuito con DHL');
});

test('i18n translates toast and cart status keys with interpolation', () => {
  setLocale('en');
  assert.equal(
    t('toast.added_with_details', { name: 'Azure Épure', volume: 50 }),
    'Added to bag: <b>Azure Épure</b> (50 ml)'
  );
  assert.equal(
    t('toast.payment_success', { orderId: 'SN-TEST12' }),
    'Payment successful! Order <b>SN-TEST12</b> confirmed via Email.'
  );
  assert.equal(t('cart.order_number', { num: 'SN-123456' }), 'Order № SN-123456');

  setLocale('de');
  assert.equal(
    t('toast.added_with_details', { name: 'Azure Épure', volume: 50 }),
    'Hinzugefügt: <b>Azure Épure</b> (50 ml)'
  );
  assert.equal(
    t('toast.payment_success', { orderId: 'SN-TEST12' }),
    'Zahlung erfolgreich! Bestellung <b>SN-TEST12</b> per E-Mail bestätigt.'
  );
  assert.equal(t('cart.order_number', { num: 'SN-123456' }), 'Bestellnummer SN-123456');

  setLocale('es');
  assert.equal(
    t('toast.added_with_details', { name: 'Azure Épure', volume: 50 }),
    'Añadido: <b>Azure Épure</b> (50 ml)'
  );
  assert.equal(t('cart.order_number', { num: 'SN-123456' }), 'Pedido № SN-123456');

  setLocale('fr');
  assert.equal(
    t('toast.added_with_details', { name: 'Azure Épure', volume: 50 }),
    'Ajouté au panier : <b>Azure Épure</b> (50 ml)'
  );
});

test('i18n returns the key itself when translation is not found', () => {
  assert.equal(t('non_existent.nested.key'), 'non_existent.nested.key');
});

test('i18n translates newly added sections across all 4 locales', () => {
  setLocale('en');
  assert.equal(t('hero.kicker'), 'Maison de Haute Parfumerie');
  assert.equal(t('collections.kicker'), 'Les Familles');
  assert.equal(t('catalog.quick_view'), 'Quick View');
  assert.equal(t('catalog.from'), 'from');

  setLocale('fr');
  assert.equal(t('hero.kicker'), 'Maison de Haute Parfumerie');
  assert.equal(t('collections.kicker'), 'Les Familles');
  assert.equal(t('catalog.quick_view'), 'Aperçu Rapide');
  assert.equal(t('catalog.from'), 'à partir de');

  setLocale('de');
  assert.equal(t('hero.kicker'), 'Maison de Haute Parfumerie');
  assert.equal(t('collections.kicker'), 'Die Duftfamilien');
  assert.equal(t('catalog.quick_view'), 'Schnellansicht');
  assert.equal(t('catalog.from'), 'ab');

  setLocale('es');
  assert.equal(t('hero.kicker'), 'Maison de Haute Parfumerie');
  assert.equal(t('collections.kicker'), 'Las Familias Olfativas');
  assert.equal(t('catalog.quick_view'), 'Vista Rápida');
  assert.equal(t('catalog.from'), 'desde');
});
