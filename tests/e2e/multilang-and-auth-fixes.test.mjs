import http from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run() {
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9244',
    '--disable-gpu',
    '--no-sandbox',
    'http://localhost:3000/'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    const list = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9244/json/list', res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });

    const page = list.find(p => p.type === 'page');
    if (!page) throw new Error('No page target found');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });

    let id = 1;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
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
        awaitPromise: true
      });
      return res?.result?.value;
    }

    console.log('1. Testing Header Single-Button Language Dropdown...');
    const headerState = await evalCode(`
      (() => {
        const dropdown = document.querySelector('#langSwitch');
        const btn = document.querySelector('#headerLangBtn');
        const code = document.querySelector('#headerLangCode')?.textContent.trim();
        const flag = document.querySelector('#headerLangFlag')?.textContent.trim();
        const items = document.querySelectorAll('#headerLangList .lang-switch-item');
        return {
          isDropdown: dropdown?.classList.contains('lang-switch-dropdown'),
          hasBtn: Boolean(btn),
          code,
          flag,
          itemCount: items.length
        };
      })()
    `);
    console.log('✓ Header lang initial state:', headerState);
    assert.strictEqual(headerState.isDropdown, true);
    assert.strictEqual(headerState.hasBtn, true);
    assert.strictEqual(headerState.code, 'EN');
    assert.strictEqual(headerState.itemCount, 9);

    console.log('2. Clicking header lang button to open dropdown and switching to German...');
    const switchRes = await evalCode(`
      (() => {
        const btn = document.querySelector('#headerLangBtn');
        btn.click();
        const isOpenAfterClick = document.querySelector('#langSwitch').classList.contains('active');
        
        // Click German (de)
        const deItem = document.querySelector('#headerLangList .lang-switch-item[data-lang="de"]');
        deItem?.click();

        return {
          isOpenAfterClick,
          newCode: document.querySelector('#headerLangCode')?.textContent.trim(),
          isClosedAfterSelect: !document.querySelector('#langSwitch').classList.contains('active'),
          docLang: document.documentElement.getAttribute('lang')
        };
      })()
    `);
    console.log('✓ Switch result:', switchRes);
    assert.strictEqual(switchRes.isOpenAfterClick, true);
    assert.strictEqual(switchRes.newCode, 'DE');
    assert.strictEqual(switchRes.isClosedAfterSelect, true);
    assert.strictEqual(switchRes.docLang, 'de');

    console.log('3. Authenticating as admin to verify 9 languages in Product and Review editors...');
    const loginRes = await evalCode(`
      (async () => {
        const { pb } = await import('/src/services/pocketbase.ts');
        const user = await pb.login('admin@noblesse.com', 'noblesse12345');
        const { bus } = await import('/src/core/bus.ts');
        bus.emit('admin:open');
        return { isAdmin: user.isAdmin, isOpen: document.querySelector('#adminStudioModal').classList.contains('open') };
      })()
    `);
    console.log('✓ Admin login and open Studio:', loginRes);
    assert.strictEqual(loginRes.isAdmin, true);
    assert.strictEqual(loginRes.isOpen, true);

    console.log('4. Verifying 9 language tabs in Fragrance Olfactory Narrative...');
    const productLangTabs = await evalCode(`
      (() => {
        const tabs = Array.from(document.querySelectorAll('#adminDescLangTabs .desc-lang-tab')).map(b => b.getAttribute('data-desc-lang'));
        const nlTab = document.querySelector('#adminDescLangTabs .desc-lang-tab[data-desc-lang="nl"]');
        nlTab?.click();
        const badgeText = document.querySelector('#adminDescLangBadge')?.textContent;
        return {
          tabs,
          count: tabs.length,
          badgeText
        };
      })()
    `);
    console.log('✓ Product lang tabs:', productLangTabs);
    assert.strictEqual(productLangTabs.count, 9);
    assert.ok(productLangTabs.badgeText.includes('Nederlands'));

    console.log('5. Switching to Client Reviews tab and verifying 9 language tabs...');
    const reviewLangTabs = await evalCode(`
      (() => {
        document.querySelector('#adminTabReviews')?.click();
        const tabs = Array.from(document.querySelectorAll('#adminReviewLangTabs .desc-lang-tab')).map(b => b.getAttribute('data-rev-lang'));
        const frTab = document.querySelector('#adminReviewLangTabs .desc-lang-tab[data-rev-lang="fr"]');
        frTab?.click();
        const badgeText = document.querySelector('#adminReviewLangBadge')?.textContent;
        return {
          tabs,
          count: tabs.length,
          badgeText
        };
      })()
    `);
    console.log('✓ Review lang tabs:', reviewLangTabs);
    assert.strictEqual(reviewLangTabs.count, 9);
    assert.ok(reviewLangTabs.badgeText.includes('Français'));

    console.log('6. Testing client registration (resolving "Failed to fetch" on other devices)...');
    const regRes = await evalCode(`
      (async () => {
        const { pb } = await import('/src/services/pocketbase.ts');
        pb.logout();
        const testEmail = 'vip_guest_' + Date.now() + '@noblesse.luxury';
        const user = await pb.register(testEmail, 'luxurySecret123', 'VIP Client');
        const token = pb.getAuthToken();
        const currentUser = pb.getCurrentUser();
        return {
          registeredId: user.id,
          email: user.email,
          hasToken: Boolean(token),
          currentUserMatches: currentUser?.email === testEmail
        };
      })()
    `);
    console.log('✓ Registration result:', regRes);
    assert.ok(regRes.registeredId);
    assert.strictEqual(regRes.hasToken, true);
    assert.strictEqual(regRes.currentUserMatches, true);

    console.log('\n🎉 ALL 4 CORE FIXES (Header Lang Button, Product 9-Langs, Review 9-Langs, Client Registration) VERIFIED 100%!');
  } finally {
    chrome.kill();
  }
}

run().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
