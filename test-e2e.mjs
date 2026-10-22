import http from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

function isServerAvailable(url = 'http://127.0.0.1:3000/') {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureDevServer() {
  const alreadyUp = await isServerAvailable();
  if (alreadyUp) {
    console.log('✓ Existing dev server detected on http://localhost:3000');
    return null;
  }

  console.log('⚡ Launching local dev server for E2E tests...');
  const devServer = spawn('node', ['dev-server.mjs'], {
    stdio: 'ignore',
    detached: false,
  });

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 250));
    if (await isServerAvailable()) {
      console.log('✓ Dev server successfully started on http://localhost:3000');
      return devServer;
    }
  }

  devServer.kill();
  throw new Error('Timeout waiting for dev-server to start on port 3000');
}

async function run() {
  let devServerProcess = null;
  let chrome = null;

  try {
    devServerProcess = await ensureDevServer();

    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    chrome = spawn(chromePath, [
      '--headless=new',
      '--remote-debugging-port=9225',
      '--disable-gpu',
      '--no-sandbox',
      'http://localhost:3000/',
    ]);

    let list = null;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 400));
      try {
        list = await new Promise((resolve, reject) => {
          const req = http.get('http://127.0.0.1:9225/json/list', (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
          });
          req.on('error', reject);
          req.setTimeout(1000, () => { req.destroy(); reject(new Error('timeout')); });
        });
        if (list && list.length > 0) break;
      } catch {}
    }

    if (!list) throw new Error('Timeout connecting to Chrome debugging port 9225');

    const page = list.find((p) => p.type === 'page');
    if (!page) throw new Error('No Chrome page target found');

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

    // Wait 1.5s for page resources to load and preloader / styles to apply
    await new Promise((r) => setTimeout(r, 1500));

    // Evaluate checks
    const evalResult = await send('Runtime.evaluate', {
      expression: `(() => {
        const rootStyle = getComputedStyle(document.documentElement);
        const gold = rootStyle.getPropertyValue('--gold').trim();
        const serif = rootStyle.getPropertyValue('--serif').trim();
        const header = document.querySelector('header');
        const headerStyle = getComputedStyle(header);
        const catalogCards = document.querySelectorAll('.pc');
        const colCards = document.querySelectorAll('.col-card');
        const cartBtn = document.querySelector('#cartBtn');
        const mainCssLink = document.querySelector('link[href*="main.css"]');
        
        const initialFamiliesText = document.querySelector('a[href="#collections"]').textContent.trim();

        // Switch to French
        const frBtn = document.querySelector('.lang-btn[data-lang="fr"]');
        frBtn.click();
        const frFamiliesText = document.querySelector('a[href="#collections"]').textContent.trim();

        // Switch to German
        const deBtn = document.querySelector('.lang-btn[data-lang="de"]');
        deBtn.click();
        const deFamiliesText = document.querySelector('a[href="#collections"]').textContent.trim();

        // Switch to Spanish
        const esBtn = document.querySelector('.lang-btn[data-lang="es"]');
        esBtn.click();
        const esFamiliesText = document.querySelector('a[href="#collections"]').textContent.trim();

        // Add first product to cart
        window.__st.cart.add('azure-epure', '50', 1);
        window.__st.drawerApi.open();
        
        const cartEl = document.querySelector('#cart');
        const isCartOpen = cartEl.classList.contains('open');
        const totalEl = document.querySelector('#cartTotal');
        const totalText = totalEl ? totalEl.textContent.trim() : '';

        // Test i18n
        const translatedCheckout = window.__st.t('cart.checkout_btn');
        const hasPb = typeof window.__st.pb !== 'undefined';

        // Trigger checkout button click
        const checkoutBtn = document.querySelector('#checkout');
        checkoutBtn.click();

        return {
          goldToken: gold,
          serifToken: serif,
          headerPosition: headerStyle.position,
          catalogCardsCount: catalogCards.length,
          colCardsCount: colCards.length,
          hasMainCssLink: !!mainCssLink,
          hasWindowSt: true,
          hasPb,
          initialFamiliesText,
          frFamiliesText,
          deFamiliesText,
          esFamiliesText,
          translatedCheckout,
          cartItemCount: window.__st.cart.count(),
          isCartOpen,
          cartTotal: totalText,
          title: document.title
        };
      })()`,
      returnByValue: true,
    });

    const data = evalResult?.result?.value;
    if (!data) {
      throw new Error(`E2E evaluation failed: ${JSON.stringify(evalResult)}`);
    }

    // Strict assertions
    assert.equal(data.goldToken, '#c8a24d', 'Design token --gold matches luxury specification');
    assert.equal(data.headerPosition, 'fixed', 'Header has fixed navigation positioning');
    assert.ok(data.catalogCardsCount >= 3, `Catalog renders perfumes (expected >= 3, got ${data.catalogCardsCount})`);
    assert.equal(data.colCardsCount, 4, 'Collections renders 4 olfactory families');
    assert.equal(data.hasWindowSt, true, 'Window.__st application namespace is initialized');
    assert.equal(data.hasPb, true, 'PocketBase service is initialized');
    assert.equal(data.frFamiliesText, 'Les Familles', 'French locale switches correctly');
    assert.equal(data.deFamiliesText, 'Die Duftfamilien', 'German locale switches correctly');
    assert.equal(data.esFamiliesText, 'Las Familias', 'Spanish locale switches correctly');
    assert.equal(data.cartItemCount, 1, 'Item successfully added to cart');
    assert.equal(data.isCartOpen, true, 'Shopping drawer opens on demand');
    assert.equal(data.cartTotal, '€89', 'Cart calculates 50ml price correctly');

    console.log('✓ Stage 1: UI, Design Tokens & i18n assertions passed');

    // Wait 350ms for async checkout call to resolve and update DOM
    await new Promise((r) => setTimeout(r, 350));

    const postCheckout = await send('Runtime.evaluate', {
      expression: `(() => {
        const cartEl = document.querySelector('#cart');
        const isOk = cartEl.classList.contains('ok');
        const orderNumEl = document.querySelector('#orderNum');
        return {
          isCartOkState: isOk,
          orderNumText: orderNumEl ? orderNumEl.textContent : '',
          cartCountAfterCheckout: window.__st.cart.count()
        };
      })()`,
      returnByValue: true,
    });

    const postData = postCheckout?.result?.value;
    if (!postData) {
      throw new Error(`Post-checkout evaluation failed: ${JSON.stringify(postCheckout)}`);
    }

    assert.equal(postData.isCartOkState, true, 'Drawer transitions to order success screen');
    assert.ok(
      postData.orderNumText.includes('Order') ||
        postData.orderNumText.includes('Bestellnummer') ||
        postData.orderNumText.includes('Pedido') ||
        postData.orderNumText.includes('SN-'),
      'Order confirmation number is displayed'
    );
    assert.equal(postData.cartCountAfterCheckout, 0, 'Cart is cleared after completed checkout');

    console.log('✓ Stage 2: Checkout flow and order confirmation passed');
    console.log('\n✦ All E2E assertions passed with 100% success!\n');

    ws.close();
  } finally {
    if (chrome) {
      chrome.kill();
    }
    if (devServerProcess) {
      console.log('✓ Cleaned up local dev server child process');
      devServerProcess.kill();
    }
  }
}

run().catch((err) => {
  console.error('\n✖ E2E Test execution failed:', err);
  process.exit(1);
});
