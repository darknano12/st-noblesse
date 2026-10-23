import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage if running in pure Node
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

import { createCart, makeKey, parseKey } from '../../src/core/cart-store.ts';

const mockProduct = {
  id: 'azure-epure',
  img: 'p8',
  name: 'Azure Épure',
  fam: 'fresh',
  gender: 'Unisex',
  badge: 'Signature',
  desc: 'Azure-clean air',
  notes: { top: ['Bergamot'], heart: ['Iris'], base: ['Musk'] },
  price: { '50': 89, '100': 129 },
  rating: 4.9,
  rev: 187,
};

function setupCart() {
  globalThis.localStorage.clear();
  return createCart({
    resolveProduct: (id) => (id === 'azure-epure' ? mockProduct : undefined),
    freeShipThreshold: 150,
    storageKey: 'test_cart_key',
    formatPrice: (n) => `€${n}`,
  });
}

test('makeKey and parseKey correctly encode and decode volume identifiers', () => {
  const key = makeKey('azure-epure', '50');
  assert.equal(key, 'azure-epure::50');

  const parsed = parseKey(key);
  assert.deepEqual(parsed, { productId: 'azure-epure', volume: '50' });

  assert.equal(parseKey('invalid-key'), null);
  assert.equal(parseKey('azure-epure::250'), null);
});

test('createCart adds items, increments quantity and computes subtotal correctly', () => {
  const cart = setupCart();

  assert.equal(cart.count(), 0);
  assert.equal(cart.subtotal(), 0);

  // Add 1x 50ml (€89)
  cart.add('azure-epure', '50', 1);
  assert.equal(cart.count(), 1);
  assert.equal(cart.subtotal(), 89);

  let snap = cart.snapshot();
  assert.equal(snap.lines.length, 1);
  assert.equal(snap.lines[0].lineTotal, 89);
  assert.equal(snap.freeShipUnlocked, false);
  assert.equal(snap.shipRemaining, 61); // 150 - 89 = 61

  // Add another 1x 50ml -> total 2x 50ml (€178)
  cart.add('azure-epure', '50', 1);
  assert.equal(cart.count(), 2);
  assert.equal(cart.subtotal(), 178);

  snap = cart.snapshot();
  assert.equal(snap.lines.length, 1);
  assert.equal(snap.lines[0].qty, 2);
  assert.equal(snap.lines[0].lineTotal, 178);
  assert.equal(snap.freeShipUnlocked, true);
  assert.equal(snap.shipRemaining, 0);
  assert.equal(snap.shipProgress, 100);
});

test('createCart supports multiple volumes for the same product as separate lines', () => {
  const cart = setupCart();

  cart.add('azure-epure', '50', 1);   // €89
  cart.add('azure-epure', '100', 1);  // €129

  assert.equal(cart.count(), 2);
  assert.equal(cart.subtotal(), 218); // 89 + 129 = 218

  const snap = cart.snapshot();
  assert.equal(snap.lines.length, 2);
  assert.equal(snap.freeShipUnlocked, true);
});

test('createCart setQty, remove, and clear operations', () => {
  const cart = setupCart();
  cart.add('azure-epure', '50', 3);

  const key = makeKey('azure-epure', '50');
  cart.setQty(key, 1);
  assert.equal(cart.count(), 1);
  assert.equal(cart.subtotal(), 89);

  cart.remove(key);
  assert.equal(cart.count(), 0);
  assert.equal(cart.subtotal(), 0);

  cart.add('azure-epure', '100', 2);
  assert.equal(cart.count(), 2);
  cart.clear();
  assert.equal(cart.count(), 0);
  assert.equal(cart.subtotal(), 0);
});

test('createCart Buy 2 Get 1 Free: 3 flacons triggers 1 complimentary lowest price flacon', () => {
  const cart = setupCart();

  // Add 2x 100ml (€129 each = €258) + 1x 50ml (€89)
  cart.add('azure-epure', '100', 2);
  cart.add('azure-epure', '50', 1);

  assert.equal(cart.count(), 3);
  assert.equal(cart.subtotal(), 347); // 258 + 89 = 347

  const snap = cart.snapshot();
  assert.equal(snap.freeFlaconsCount, 1);
  assert.equal(snap.freeFlaconDiscount, 89); // lowest unit price is €89
  assert.equal(snap.discount, 89);
  assert.equal(snap.total, 258); // 347 - 89 = 258
});

test('createCart Buy 2 Get 1 Free: 6 flacons triggers 2 complimentary flacons', () => {
  const cart = setupCart();

  // 4x 100ml (€129) + 2x 50ml (€89) -> 6 items total
  cart.add('azure-epure', '100', 4); // 4 * 129 = 516
  cart.add('azure-epure', '50', 2);  // 2 * 89 = 178
  // subtotal = 694

  const snap = cart.snapshot();
  assert.equal(snap.count, 6);
  assert.equal(snap.freeFlaconsCount, 2);
  // Lowest 2 unit prices are the 2x 50ml flacons (€89 + €89 = €178)
  assert.equal(snap.freeFlaconDiscount, 178);
  assert.equal(snap.total, 516);
});

test('createCart promo code application, percentage calculation, case insensitivity, and removal', () => {
  const cart = setupCart();
  cart.add('azure-epure', '50', 1); // €89

  // Invalid code
  const badRes = cart.applyPromo('INVALID_CODE');
  assert.equal(badRes.ok, false);

  // Valid code: NOBLESSE15 (15%)
  const goodRes = cart.applyPromo('noblesse15');
  assert.equal(goodRes.ok, true);
  assert.equal(goodRes.discountPercent, 15);
  assert.equal(cart.getPromoCode(), 'NOBLESSE15');

  let snap = cart.snapshot();
  assert.equal(snap.promoCode, 'NOBLESSE15');
  assert.equal(snap.promoDiscount, 13); // round(89 * 0.15) = 13
  assert.equal(snap.discount, 13);
  assert.equal(snap.total, 76); // 89 - 13 = 76

  // Remove promo
  cart.removePromo();
  assert.equal(cart.getPromoCode(), undefined);
  snap = cart.snapshot();
  assert.equal(snap.promoCode, undefined);
  assert.equal(snap.promoDiscount, 0);
  assert.equal(snap.total, 89);
});
