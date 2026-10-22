import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalog } from '../../src/core/catalog-store.ts';

const mockProducts = [
  {
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
  },
  {
    id: 'ambre-velours',
    img: 'p7',
    name: 'Ambre Velours',
    fam: 'oriental',
    gender: 'Unisex',
    badge: '',
    desc: 'Golden amber',
    notes: { top: ['Bitter Orange'], heart: ['Amber'], base: ['Vanilla'] },
    price: { '50': 99, '100': 139 },
    rating: 4.9,
    rev: 143,
  },
  {
    id: 'oud-serein',
    img: 'p3',
    name: 'Oud Serein',
    fam: 'woody',
    gender: 'Unisex',
    badge: '',
    desc: 'Serene oud',
    notes: { top: ['Saffron'], heart: ['Oud'], base: ['Sandalwood'] },
    price: { '50': 119, '100': 159 },
    rating: 5.0,
    rev: 96,
  },
];

test('catalog initializes with full product list', () => {
  const catalog = createCatalog(mockProducts);
  assert.equal(catalog.all().length, 3);
  assert.equal(catalog.visible().length, 3);
  assert.equal(catalog.filter.value, 'all');
});

test('catalog byId finds product or returns undefined', () => {
  const catalog = createCatalog(mockProducts);
  const p = catalog.byId('azure-epure');
  assert.ok(p);
  assert.equal(p.name, 'Azure Épure');

  assert.equal(catalog.byId('non-existent'), undefined);
});

test('catalog setFilter correctly filters visible fragrances', () => {
  const catalog = createCatalog(mockProducts);

  catalog.setFilter('fresh');
  assert.equal(catalog.filter.value, 'fresh');
  assert.equal(catalog.visible().length, 1);
  assert.equal(catalog.visible()[0].name, 'Azure Épure');

  catalog.setFilter('oriental');
  assert.equal(catalog.visible().length, 1);
  assert.equal(catalog.visible()[0].name, 'Ambre Velours');

  catalog.setFilter('woody');
  assert.equal(catalog.visible().length, 1);
  assert.equal(catalog.visible()[0].name, 'Oud Serein');

  catalog.setFilter('all');
  assert.equal(catalog.visible().length, 3);
});

test('catalog setProducts updates product list dynamically (CMS hydration)', () => {
  const catalog = createCatalog(mockProducts);
  assert.equal(catalog.all().length, 3);

  const updatedProducts = [
    ...mockProducts,
    {
      id: 'rose-imperiale',
      img: 'p1',
      name: 'Rose Impériale',
      fam: 'floral',
      gender: 'Women',
      badge: 'Limited',
      desc: 'May Rose from Grasse',
      notes: { top: ['Rose'], heart: ['Peony'], base: ['Musk'] },
      price: { '50': 105, '100': 145 },
      rating: 4.8,
      rev: 54,
    },
  ];

  catalog.setProducts(updatedProducts);
  assert.equal(catalog.all().length, 4);
  assert.equal(catalog.visible().length, 4);
  assert.ok(catalog.byId('rose-imperiale'));
});
