import http from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run() {
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9255',
    '--disable-gpu',
    '--no-sandbox',
    'http://localhost:3000/'
  ]);

  await new Promise((r) => setTimeout(r, 1500));

  try {
    const list = await new Promise((resolve, reject) => {
      http
        .get('http://127.0.0.1:9255/json/list', (res) => {
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

    console.log('1. Ensuring unauthenticated state (logged out)...');
    const initLoggedOut = await evalCode(`
      (async () => {
        const { pb } = await import('/src/services/pocketbase.ts');
        pb.logout();
        localStorage.removeItem('st_noblesse_cart_v1');
        return {
          user: pb.getCurrentUser(),
          cartCount: document.querySelector('#cartCount')?.textContent.trim()
        };
      })()
    `);
    console.log('✓ Initial unauthenticated state:', initLoggedOut);
    assert.strictEqual(initLoggedOut.user, null);

    console.log('2. Clicking "+ Add to Bag" as unauthenticated guest...');
    const guestAddAttempt = await evalCode(`
      (() => {
        const addBtn = document.querySelector('#grid [data-add]');
        if (!addBtn) return { found: false };
        addBtn.click();
        const authModal = document.querySelector('#authModal');
        const regTab = document.querySelector('#tabRegister');
        const isAuthOpen = authModal?.classList.contains('open');
        const isRegActive = regTab?.classList.contains('active');
        const cartCount = document.querySelector('#cartCount')?.textContent.trim();
        return {
          found: true,
          isAuthOpen,
          isRegActive,
          cartCount
        };
      })()
    `);
    console.log('✓ Guest add attempt result:', guestAddAttempt);
    assert.strictEqual(guestAddAttempt.found, true);
    assert.strictEqual(guestAddAttempt.isAuthOpen, true);
    assert.strictEqual(guestAddAttempt.isRegActive, true);
    assert.strictEqual(guestAddAttempt.cartCount, '0');

    console.log('3. Registering account to unlock fragrance acquisition...');
    const regResult = await evalCode(`
      (async () => {
        const { pb } = await import('/src/services/pocketbase.ts');
        const { bus } = await import('/src/core/bus.ts');
        const testEmail = 'patron_' + Date.now() + '@noblesse.luxury';
        const user = await pb.register(testEmail, 'luxuryPass123', 'Monsieur Laurent');
        bus.emit('auth:change', { user });
        await new Promise(r => setTimeout(r, 200));

        const cartDrawer = document.querySelector('#cart');
        const isDrawerOpen = cartDrawer?.classList.contains('open');
        const cartCount = document.querySelector('#cartCount')?.textContent.trim();
        return {
          userEmail: user.email,
          isDrawerOpen,
          cartCount
        };
      })()
    `);
    console.log('✓ Registration & auto-fulfillment result:', regResult);
    assert.strictEqual(regResult.isDrawerOpen, true);
    assert.strictEqual(regResult.cartCount, '1');

    console.log('4. Adding another fragrance as an authenticated member...');
    const memberAdd = await evalCode(`
      (async () => {
        const addBtns = document.querySelectorAll('#grid [data-add]');
        if (addBtns.length > 1) {
          addBtns[1].click();
        }
        await new Promise(r => setTimeout(r, 100));
        const authModal = document.querySelector('#authModal');
        const isAuthOpen = authModal?.classList.contains('open');
        const cartCount = document.querySelector('#cartCount')?.textContent.trim();
        return {
          isAuthOpen,
          cartCount
        };
      })()
    `);
    console.log('✓ Member add result:', memberAdd);
    assert.strictEqual(memberAdd.isAuthOpen, false);
    assert.strictEqual(memberAdd.cartCount, '2');

    console.log('\n🎉 AUTHENTICATION GATE FOR CART & BUYING VERIFIED 100%!');
  } finally {
    chrome.kill();
  }
}

run().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
