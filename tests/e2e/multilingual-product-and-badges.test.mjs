import http from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run() {
  const port = 9260;
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--disable-gpu',
    '--no-sandbox',
    'http://localhost:3000/'
  ]);

  await new Promise((r) => setTimeout(r, 1500));

  try {
    const list = await new Promise((resolve, reject) => {
      http
        .get(`http://127.0.0.1:${port}/json/list`, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve(JSON.parse(data)));
        })
        .on('error', reject);
    });

    const page = list.find((p) => p.type === 'page');
    if (!page) throw new Error('No page target found');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });

    let id = 1;
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const msgId = id++;
        const handler = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === msgId) {
            ws.removeEventListener('message', handler);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });

    await send('Runtime.enable');
    await send('Page.enable');

    const evalCode = async (expr) => {
      const res = await send('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.exceptionDetails) {
        throw new Error(JSON.stringify(res.exceptionDetails));
      }
      return res.result.value;
    };

    console.log('1. Setting up admin session and product with both Gold Badge & Sale Badge...');
    const setupRes = await evalCode(`
      (async () => {
        const { pb, bus, catalog } = window.__st;

        // Authenticate admin
        const adminUser = {
          id: 'admin_test_01',
          email: 'director@noblesse.luxury',
          name: 'Directeur Artistique',
          isAdmin: true
        };
        localStorage.setItem('st_noblesse_auth_user', JSON.stringify(adminUser));
        bus.emit('auth:change', { user: adminUser });

        // Set up product 1 with BOTH gold badge AND discount
        const prods = catalog.all();
        if (prods && prods.length > 0) {
          prods[0].badge = 'Rare Extract';
          prods[0].discountPercent = 25;
          prods[0].discountLabel = 'Autumn Privilege';
          catalog.setProducts([...prods]);
          pb.saveLocalProducts(prods);
          bus.emit('catalog:updated', { products: prods });
        }
        await new Promise(r => setTimeout(r, 200));

        const card = document.querySelector('#grid .pc');
        const goldBadge = card ? card.querySelector('.badge:not(.badge-sale)') : null;
        const saleBadge = card ? card.querySelector('.badge.badge-sale') : null;

        return {
          goldBadgeText: goldBadge ? goldBadge.textContent.trim() : null,
          saleBadgeText: saleBadge ? saleBadge.textContent.trim() : null,
          cardHtml: card ? card.querySelector('.pc-media').innerHTML : ''
        };
      })()
    `);

    console.log('✓ Catalog card badges verification:', setupRes);
    assert.equal(setupRes.goldBadgeText, 'Rare Extract', 'Gold Badge must be rendered on card');
    assert.equal(setupRes.saleBadgeText, 'Autumn Privilege -25%', 'Sale Badge must be rendered on card');
    assert.ok(
      setupRes.cardHtml.includes('badge') && setupRes.cardHtml.includes('badge-sale'),
      'Both badges must coexist in .pc-media'
    );

    console.log('2. Verifying both badges in Quick View modal...');
    const modalRes = await evalCode(`
      (async () => {
        const card = document.querySelector('#grid .pc');
        const qvBtn = card?.querySelector('.qv');
        if (qvBtn) qvBtn.click();
        await new Promise(r => setTimeout(r, 200));

        const mdFam = document.querySelector('#mdFam');
        const modal = document.querySelector('#modal');
        const famText = mdFam ? mdFam.textContent.trim() : '';

        // Close modal
        const closeBtn = document.querySelector('#mdClose');
        if (closeBtn) closeBtn.click();

        return {
          modalOpen: modal?.classList.contains('open'),
          famText
        };
      })()
    `);

    console.log('✓ Quick View modal badges verification:', modalRes);
    assert.ok(modalRes.famText.includes('Rare Extract'), 'Modal must display Gold Badge');
    assert.ok(modalRes.famText.includes('Autumn Privilege -25%'), 'Modal must display Discount Label');

    console.log('3. Testing Admin Studio unified multilingual product editor...');
    const studioRes = await evalCode(`
      (async () => {
        const { bus, pb } = window.__st;

        // Open Studio
        bus.emit('admin:open', undefined);
        await new Promise(r => setTimeout(r, 300));

        const modal = document.querySelector('#adminStudioModal');
        const langTabs = document.querySelector('#adminProductLangTabs');
        const tabsCount = langTabs ? langTabs.querySelectorAll('.desc-lang-tab').length : 0;
        const nameInput = document.querySelector('#adminProductName');
        const badgeInput = document.querySelector('#adminProductBadge');
        const discInput = document.querySelector('#adminProductDiscountLabel');
        const descInput = document.querySelector('#adminProductDesc');
        const langBadge = document.querySelector('#adminProductLangBadge');

        // 1. Set distinct English values
        nameInput.value = 'Azure Celestial';
        badgeInput.value = 'Rare Extract';
        discInput.value = 'Autumn Privilege';
        descInput.value = 'An imperial and luminous sillage.';

        const enValues = {
          name: nameInput.value,
          badge: badgeInput.value,
          disc: discInput.value,
          tabsCount,
          badgeText: langBadge ? langBadge.textContent.trim() : ''
        };

        // 2. Click FR tab
        const frTab = langTabs.querySelector('[data-prod-lang="fr"]');
        if (frTab) frTab.click();
        await new Promise(r => setTimeout(r, 100));

        // Set French values
        nameInput.value = 'Étoile Céleste';
        badgeInput.value = 'Extrait Rare';
        discInput.value = "Privilège d'Automne";
        descInput.value = 'Un sillage impérial et mystique.';

        const frBadgeText = langBadge ? langBadge.textContent.trim() : '';

        // 3. Switch back to EN tab to verify English values are intact
        const enTab = langTabs.querySelector('[data-prod-lang="en"]');
        if (enTab) enTab.click();
        await new Promise(r => setTimeout(r, 100));

        const enRecheckName = nameInput.value;

        // 4. Switch back to FR tab to ensure in-memory preservation
        if (frTab) frTab.click();
        await new Promise(r => setTimeout(r, 100));

        const frRecheckName = nameInput.value;
        const frRecheckDisc = discInput.value;

        // 5. Submit form to persist multilingual data
        const form = document.querySelector('#adminProductForm');
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        await new Promise(r => setTimeout(r, 400));

        // Check stored product in pocketbase
        const savedList = pb.getLocalProducts();
        const firstProd = savedList[0];

        return {
          enValues,
          frBadgeText,
          enRecheckName,
          frRecheckName,
          frRecheckDisc,
          savedName: firstProd.name,
          savedDiscountLabel: firstProd.discountLabel
        };
      })()
    `);

    console.log('✓ Admin Studio multilingual editor verification:', studioRes);
    assert.equal(studioRes.enValues.tabsCount, 9, 'Admin Product editor must have 9 language tabs');
    assert.ok(studioRes.frBadgeText.includes('Français'), 'Language badge must reflect French');
    assert.notEqual(studioRes.enRecheckName, 'Étoile Céleste', 'English name must remain distinct from French');
    assert.equal(studioRes.frRecheckName, 'Étoile Céleste', 'French name must be preserved across tab switches');
    assert.equal(studioRes.frRecheckDisc, "Privilège d'Automne", 'French discount label preserved');
    assert.ok(studioRes.savedName.includes('Étoile Céleste'), 'Saved name must contain multilingual JSON');
    assert.ok(studioRes.savedDiscountLabel.includes("Privilège d'Automne"), 'Saved discount label must contain multilingual JSON');

    console.log('4. Verifying site language switch dynamically translates product card...');
    const switchLangRes = await evalCode(`
      (async () => {
        const { setLocale } = await import('/src/core/i18n.ts');

        // Switch site to French
        setLocale('fr');
        await new Promise(r => setTimeout(r, 200));

        const card = document.querySelector('#grid .pc');
        const cardNameFr = card ? card.querySelector('.pc-name')?.textContent.trim() : '';
        const saleBadgeFr = card ? card.querySelector('.badge.badge-sale')?.textContent.trim() : '';
        const goldBadgeFr = card ? card.querySelector('.badge:not(.badge-sale)')?.textContent.trim() : '';

        // Switch site back to English
        setLocale('en');
        await new Promise(r => setTimeout(r, 200));

        const cardEn = document.querySelector('#grid .pc');
        const cardNameEn = cardEn ? cardEn.querySelector('.pc-name')?.textContent.trim() : '';
        const saleBadgeEn = cardEn ? cardEn.querySelector('.badge.badge-sale')?.textContent.trim() : '';

        return {
          cardNameFr,
          saleBadgeFr,
          goldBadgeFr,
          cardNameEn,
          saleBadgeEn
        };
      })()
    `);

    console.log('✓ Dynamic site language switch verification:', switchLangRes);
    assert.equal(switchLangRes.cardNameFr, 'Étoile Céleste', 'Catalog product name must render French when locale is FR');
    assert.ok(switchLangRes.saleBadgeFr.includes("Privilège d'Automne"), 'Sale badge must render French when locale is FR');
    assert.equal(switchLangRes.goldBadgeFr, 'Extrait Rare', 'Gold badge must render French when locale is FR');
    assert.notEqual(switchLangRes.cardNameEn, 'Étoile Céleste', 'Catalog product name must return to English when locale is EN');

    console.log('\n🎉 ALL MULTILINGUAL PRODUCT EDITOR & DUAL BADGE TESTS PASSED 100%!\n');
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  } finally {
    chrome.kill();
  }
}

run();
