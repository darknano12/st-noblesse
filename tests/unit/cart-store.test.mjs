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
