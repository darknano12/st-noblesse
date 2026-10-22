import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPrice, formatPriceWith } from '../../src/utils/format.ts';

test('formatPrice correctly formats integer amounts with Euro symbol', () => {
  assert.equal(formatPrice(89), '€89');
  assert.equal(formatPrice(129), '€129');
  assert.equal(formatPrice(0), '€0');
  assert.equal(formatPrice(1500), '€1,500');
});

test('formatPriceWith supports custom currency symbols and locales', () => {
  assert.equal(formatPriceWith(89, '$', 'en-US'), '$89');
  assert.equal(formatPriceWith(129, '£', 'en-GB'), '£129');
});
