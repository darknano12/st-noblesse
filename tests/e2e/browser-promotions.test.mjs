import http from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run() {
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9256',
    '--disable-gpu',
    '--no-sandbox',
    'http://localhost:3000/'
  ]);

  await new Promise((r) => setTimeout(r, 1500));

  try {
    const list = await new Promise((resolve, reject) => {
      http
        .get('http://127.0.0.1:9256/json/list', (res) => {
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

    async function evalCode(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return res?.result?.value;
    }

    console.log('1. Setting up authenticated user for test...');
    const userResult = await evalCode(`
      (async () => {
        const { pb } = await import('/src/services/pocketbase.ts');
        const { bus } = await import('/src/core/bus.ts');
        const testEmail = 'patron_' + Date.now() + '@noblesse.luxury';
        const user = await pb.register(testEmail, 'luxuryPass123', 'Monsieur Laurent');
        bus.emit('auth:change', { user });
        return { userEmail: user.email, current: pb.getCurrentUser()?.email };
      })()
    `);
    console.log('✓ Authenticated member:', userResult);

    console.log('2. Verifying #privileges section rendered in DOM...');
    const privInfo = await evalCode(`
      (() => {
        const sec = document.getElementById('privileges');
        const h2 = sec ? sec.querySelector('h2') : null;
        const perks = sec ? sec.querySelectorAll('.priv-perk') : [];
        return {
          exists: !!sec,
          title: h2 ? h2.textContent : '',
          perksCount: perks.length
        };
      })()
    `);
    assert.equal(privInfo.exists, true, '#privileges section must exist in DOM');
    assert.equal(privInfo.perksCount, 3, 'Must render 3 perks in privileges section');
    console.log('✓ Privileges section in DOM:', privInfo);

    console.log('3. Adding 1st item to cart & opening bag...');
    const clickRes = await evalCode(`
      (() => {
        const btn = document.querySelector('#grid [data-add]');
        if (!btn) return { found: false };
        btn.click();
        const cartBtn = document.querySelector('#cartBtn');
        if (cartBtn) cartBtn.click();
        return {
          found: true,
          cartCount: document.querySelector('#cartCount')?.textContent.trim(),
          drawerOpen: document.querySelector('#cart')?.classList.contains('open')
        };
      })()
    `);
    console.log('Click 1 res:', clickRes);
    await new Promise((r) => setTimeout(r, 600));

    const state1 = await evalCode(`
      (() => {
        const banner = document.getElementById('cartPromoBanner');
        const msg = document.getElementById('cartPromoMsg');
        const subtotal = document.getElementById('cartSubtotalVal');
        const total = document.getElementById('cartTotal');
        const freeRow = document.getElementById('cartFreeFlaconRow');
        return {
          bannerVisible: banner ? window.getComputedStyle(banner).display !== 'none' : false,
          msg: msg ? msg.textContent : '',
          subtotal: subtotal ? subtotal.textContent : '',
          total: total ? total.textContent : '',
          freeRowVisible: freeRow ? window.getComputedStyle(freeRow).display !== 'none' : false
        };
      })()
    `);
    console.log('✓ 1-item cart state:', state1);
    assert.equal(state1.bannerVisible, true);
    assert.equal(state1.freeRowVisible, false);

    console.log('4. Adding 2nd item to cart...');
    await evalCode(`
      (() => {
        const incBtn = document.querySelector('.qty button[data-d="1"]');
        if (incBtn) incBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const state2 = await evalCode(`
      (() => {
        const banner = document.getElementById('cartPromoBanner');
        const msg = document.getElementById('cartPromoMsg');
        const freeRow = document.getElementById('cartFreeFlaconRow');
        return {
          bannerVisible: banner ? window.getComputedStyle(banner).display !== 'none' : false,
          msg: msg ? msg.textContent : '',
          freeRowVisible: freeRow ? window.getComputedStyle(freeRow).display !== 'none' : false
        };
      })()
    `);
    console.log('✓ 2-items cart state:', state2);
    assert.equal(state2.bannerVisible, true);
    assert.equal(state2.freeRowVisible, false);

    console.log('5. Adding 3rd item to cart (triggers Buy 2 Get 1 Free)...');
    await evalCode(`
      (() => {
        const incBtn = document.querySelector('.qty button[data-d="1"]');
        if (incBtn) incBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const state3 = await evalCode(`
      (() => {
        const banner = document.getElementById('cartPromoBanner');
        const msg = document.getElementById('cartPromoMsg');
        const freeRow = document.getElementById('cartFreeFlaconRow');
        const freeVal = document.getElementById('cartFreeFlaconVal');
        const total = document.getElementById('cartTotal');
        const subtotal = document.getElementById('cartSubtotalVal');
        return {
          bannerVisible: banner ? window.getComputedStyle(banner).display !== 'none' : false,
          msg: msg ? msg.textContent : '',
          freeRowVisible: freeRow ? window.getComputedStyle(freeRow).display !== 'none' : false,
          freeVal: freeVal ? freeVal.textContent : '',
          subtotal: subtotal ? subtotal.textContent : '',
          total: total ? total.textContent : ''
        };
      })()
    `);
    console.log('✓ 3-items cart state (3ème Flacon Offert):', state3);
    assert.equal(state3.freeRowVisible, true, 'Free flacon row must be visible for 3 items');
    assert.ok(state3.freeVal.includes('-'), 'Free flacon value should show negative discount');

    console.log('6. Applying promo code NOBLESSE15...');
    await evalCode(`
      (() => {
        const input = document.getElementById('cartPromoInput');
        const btn = document.getElementById('cartPromoApply');
        if (input && btn) {
          input.value = 'NOBLESSE15';
          btn.click();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const statePromo = await evalCode(`
      (() => {
        const promoRow = document.getElementById('cartPromoDiscountRow');
        const promoVal = document.getElementById('cartPromoDiscountVal');
        const promoActive = document.getElementById('cartPromoActive');
        const activeCode = document.getElementById('cartPromoActiveCode');
        const total = document.getElementById('cartTotal');
        return {
          promoRowVisible: promoRow ? window.getComputedStyle(promoRow).display !== 'none' : false,
          promoVal: promoVal ? promoVal.textContent : '',
          activeVisible: promoActive ? window.getComputedStyle(promoActive).display !== 'none' : false,
          activeCode: activeCode ? activeCode.textContent : '',
          total: total ? total.textContent : ''
        };
      })()
    `);
    console.log('✓ Cart state after promo applied:', statePromo);
    assert.equal(statePromo.promoRowVisible, true, 'Promo discount row should be visible');
    assert.equal(statePromo.activeVisible, true, 'Active promo pill should be visible');
    assert.ok(statePromo.activeCode.includes('NOBLESSE15'), 'Active code should display NOBLESSE15');

    console.log('7. Switching language to French (FR) and checking translations...');
    const frState = await evalCode(`
      (async () => {
        const { setLocale } = await import('/src/core/i18n.ts');
        setLocale('fr');
        await new Promise(r => setTimeout(r, 200));

        const privTitle = document.querySelector('#privileges h2')?.textContent;
        const freeBadge = document.querySelector('#cartFreeFlaconRow .priv-badge-mini')?.textContent;
        const bannerMsg = document.getElementById('cartPromoMsg')?.textContent;
        return { privTitle, freeBadge, bannerMsg };
      })()
    `);
    console.log('✓ French translations in DOM:', frState);
    assert.ok(frState.privTitle.includes("L'Art de l'Acquisition"), 'Privileges title should be in French');
    assert.equal(frState.freeBadge, 'Offert', 'Free badge should be Offert');
    assert.ok(frState.bannerMsg.includes('Privilège appliqué'), 'Banner msg should be in French');

    console.log('8. Switching language to German (DE) and checking translations...');
    const deState = await evalCode(`
      (async () => {
        const { setLocale } = await import('/src/core/i18n.ts');
        setLocale('de');
        await new Promise(r => setTimeout(r, 200));

        const privTitle = document.querySelector('#privileges h2')?.textContent;
        const freeBadge = document.querySelector('#cartFreeFlaconRow .priv-badge-mini')?.textContent;
        const bannerMsg = document.getElementById('cartPromoMsg')?.textContent;
        return { privTitle, freeBadge, bannerMsg };
      })()
    `);
    console.log('✓ German translations in DOM:', deState);
    assert.ok(deState.privTitle.includes('Die Kunst des Schenkens'), 'Privileges title should be in German');
    assert.equal(deState.freeBadge, 'Gratis', 'Free badge should be Gratis');
    assert.ok(deState.bannerMsg.includes('Privileg aktiv'), 'Banner msg should be in German');

    console.log('\n🎉 BROWSER PROMOTIONS & MULTILINGUAL VERIFIED 100%!');
  } finally {
    chrome.kill();
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
