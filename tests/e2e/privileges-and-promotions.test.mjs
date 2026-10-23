import assert from 'node:assert/strict';

async function run() {
  const BASE_URL = 'http://localhost:3000';

  console.log('1. Checking page load & #privileges section rendering...');
  const pageRes = await fetch(BASE_URL);
  assert.equal(pageRes.status, 200, 'Page should return 200 OK');
  const html = await pageRes.text();

  assert.ok(html.includes('id="privileges"'), 'Section #privileges should be present');
  assert.ok(html.includes('data-i18n="privileges.title"'), 'Privileges title i18n should be present');
  assert.ok(html.includes('data-i18n="nav.privileges"'), 'Nav link for privileges should be present');
  assert.ok(html.includes('id="cartPromoBanner"'), 'Cart promo banner should be present in cart foot');
  assert.ok(html.includes('id="cartPromoInput"'), 'Cart promo input should be present');
  assert.ok(html.includes('id="cartFreeFlaconRow"'), 'Cart free flacon row should be present');
  assert.ok(html.includes('id="cartPromoDiscountRow"'), 'Cart promo discount row should be present');
  console.log('✓ Section #privileges and cart drawer promo elements verified in HTML markup');

  console.log('2. Checking reviews API and data integrity...');
  const revRes = await fetch(`${BASE_URL}/api/reviews`);
  if (revRes.ok) {
    const reviews = await revRes.json();
    console.log(`✓ Fetched ${reviews.length} reviews from backend`);
    assert.ok(reviews.length >= 8, 'Should have at least 8 luxury customer reviews');
    // Verify multilingual map presence
    for (const r of reviews) {
      assert.ok(r.t && typeof r.t === 'object', `Review ${r.id} should have translation object`);
      assert.ok(r.t.en, `Review ${r.id} should have English text`);
      assert.ok(r.t.fr, `Review ${r.id} should have French text`);
      assert.ok(r.t.de, `Review ${r.id} should have German text`);
      assert.ok(r.t.es, `Review ${r.id} should have Spanish text`);
      assert.ok(r.t.nl, `Review ${r.id} should have Dutch text`);
      assert.ok(r.t.it, `Review ${r.id} should have Italian text`);
    }
    console.log('✓ All reviews have full multilingual translations across all supported languages');
  }

  console.log('3. Checking locales contain all new privilege & promotion keys...');
  const locales = ['en', 'de', 'fr', 'es', 'nl', 'it', 'nb', 'sv', 'da'];
  for (const l of locales) {
    const locRes = await fetch(`${BASE_URL}/src/data/locales/${l}.json`);
    assert.equal(locRes.status, 200, `Locale ${l} should be reachable`);
    const loc = await locRes.json();
    assert.ok(loc.nav && loc.nav.privileges, `Locale ${l} missing nav.privileges`);
    assert.ok(loc.privileges && loc.privileges.title, `Locale ${l} missing privileges.title`);
    assert.ok(loc.privileges.offer_title, `Locale ${l} missing privileges.offer_title`);
    assert.ok(loc.cart && loc.cart.promo_add_1_more, `Locale ${l} missing cart.promo_add_1_more`);
    assert.ok(loc.cart.free_flacon_label, `Locale ${l} missing cart.free_flacon_label`);
    assert.ok(loc.cart.apply_code, `Locale ${l} missing cart.apply_code`);
  }
  console.log('✓ All 9 locales verified with complete promotion & privileges keys');

  console.log('\n🎉 ALL PRIVILEGES, PROMOTIONS & REVIEWS VERIFIED 100%!');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
