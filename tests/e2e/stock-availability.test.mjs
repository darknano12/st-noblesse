import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

async function run() {
  console.log('--- 1. Testing Locales for Stock Availability Keys ---');
  const locales = ['en', 'de', 'fr', 'es', 'nl', 'it', 'nb', 'sv', 'da'];
  const cyrillicRegex = /[\u0400-\u04FF]/;

  for (const l of locales) {
    const filePath = resolve(`src/data/locales/${l}.json`);
    const content = readFileSync(filePath, 'utf-8');
    const json = JSON.parse(content);

    assert.ok(json.catalog?.out_of_stock, `Locale ${l} missing catalog.out_of_stock`);
    assert.ok(json.admin?.field_in_stock, `Locale ${l} missing admin.field_in_stock`);
    assert.ok(json.admin?.stock_in, `Locale ${l} missing admin.stock_in`);
    assert.ok(json.admin?.stock_out, `Locale ${l} missing admin.stock_out`);

    // Verify zero Russian / Cyrillic in any of the values
    assert.ok(!cyrillicRegex.test(json.catalog.out_of_stock), `Locale ${l} catalog.out_of_stock contains Cyrillic!`);
    assert.ok(!cyrillicRegex.test(json.admin.field_in_stock), `Locale ${l} admin.field_in_stock contains Cyrillic!`);
    assert.ok(!cyrillicRegex.test(json.admin.stock_in), `Locale ${l} admin.stock_in contains Cyrillic!`);
    assert.ok(!cyrillicRegex.test(json.admin.stock_out), `Locale ${l} admin.stock_out contains Cyrillic!`);

    console.log(`✓ Locale ${l} has valid localized stock strings: "${json.catalog.out_of_stock}" / "${json.admin.stock_in}" / "${json.admin.stock_out}"`);
  }

  console.log('--- 2. Checking HTML Markup for Admin Stock Switch ---');
  const htmlPath = resolve('index.html');
  const htmlContent = readFileSync(htmlPath, 'utf-8');
  assert.ok(htmlContent.includes('id="adminProductInStock"'), 'adminProductInStock element missing in index.html');
  assert.ok(htmlContent.includes('id="adminStockStatusLabel"'), 'adminStockStatusLabel missing in index.html');
  assert.ok(htmlContent.includes('data-i18n="admin.field_in_stock"'), 'data-i18n="admin.field_in_stock" missing in index.html');
  console.log('✓ index.html contains adminProductInStock toggle and status label');

  console.log('--- 3. Checking CSS for Sold Out badges & disabled actions ---');
  const catalogCss = readFileSync(resolve('src/components/catalog/catalog.css'), 'utf-8');
  assert.ok(catalogCss.includes('.badge.badge-soldout'), 'badge.badge-soldout CSS missing');
  assert.ok(catalogCss.includes('.pc-add.pc-add-disabled'), 'pc-add.pc-add-disabled CSS missing');
  assert.ok(catalogCss.includes('.pc.pc-soldout'), 'pc.pc-soldout CSS missing');

  const modalCss = readFileSync(resolve('src/components/product-modal/product-modal.css'), 'utf-8');
  assert.ok(modalCss.includes('#mdAdd.btn-soldout'), '#mdAdd.btn-soldout CSS missing');

  const studioCss = readFileSync(resolve('src/components/admin-studio/admin-studio.css'), 'utf-8');
  assert.ok(studioCss.includes('.admin-item-stock-out'), '.admin-item-stock-out CSS missing');
  console.log('✓ All CSS definitions present and correctly styled');

  console.log('\n🎉 ALL STOCK AVAILABILITY CHECKS PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
